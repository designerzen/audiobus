import { describeChord } from "../../tuning/chords/describe-chord"
import type { HarmonicState } from "../harmony"

export interface TreePoint {
	x: number
	y: number
}
export interface TreeBranch {
	id: number
	key: string
	note: number
	velocity: number
	start: number
	end?: number
	endY?: number
	origin: TreePoint
	side: number
	parent?: number
	spread: number
	targetX: number
	minimumHeight: number
	onset: number
	projectTime: (time: number) => number
	stem?: TreeBranch
	forkAt?: number
	junction?: TreeBranch
}

export const TREE_SPEED = 42
export const TREE_FORK_HEIGHT = 14
const GROUP_WINDOW = 0.055
const LANE_WIDTH = 22

/** A short, smooth lane change followed by an exactly vertical stem. */
export function branchPathPoint(branch: TreeBranch, height: number): TreePoint {
	const u = Math.max(0, Math.min(1, height / TREE_FORK_HEIGHT))
	const curve = u * u * u * (10 + u * (-15 + 6 * u))
	return {
		x: branch.origin.x + (branch.targetX - branch.origin.x) * curve,
		y: branch.origin.y + Math.max(0, height)
	}
}
export function branchHeight(branch: TreeBranch, time: number): number {
	return Math.max(
		branch.minimumHeight,
		(branch.end !== undefined && time >= branch.end
			? (branch.endY ?? branch.projectTime(branch.end))
			: branch.projectTime(time)) - branch.origin.y
	)
}
export function branchPoint(branch: TreeBranch, time: number): TreePoint {
	return branchPathPoint(branch, branchHeight(branch, time))
}

export class TreeModel {
	readonly held = new Map<string, TreeBranch>()
	private history: TreeBranch[] = []
	get branches(): TreeBranch[] {
		this.layout()
		return this.history
	}
	started?: number
	trunkTop = 0
	harmony?: HarmonicState
	private serial = 0
	private side = -1
	private group: TreeBranch[] = []
	private groupAt = -Infinity
	private previousRoot?: TreeBranch
	private previousChord = false
	private attachment?: TreeBranch
	private groupSpacing = 1
	private dirty = false
	private rows: Array<{ at: number; y: number }> = []
	heightAt = (time: number): number => {
		let low = 0,
			high = this.rows.length
		while (low < high) {
			const middle = (low + high) >>> 1
			if (this.rows[middle].at <= time) {
				low = middle + 1
			} else {
				high = middle
			}
		}
		const row = this.rows[low - 1]
		return row ? row.y + Math.max(0, time - row.at) * TREE_SPEED : 0
	}

	noteOn(note: number, velocity: number, channel: number, now: number): void {
		if (!Number.isInteger(note) || note < 0 || note > 127 || !Number.isFinite(velocity)) {
			return
		}
		if (velocity <= 0) {
			this.noteOff(note, channel, now)
			return
		}
		const key = `${channel}:${note}`
		this.noteOff(note, channel, now)
		this.started ??= now
		if (now - this.groupAt > GROUP_WINDOW) {
			const gap = Number.isFinite(this.groupAt) ? Math.max(0, now - this.groupAt) : 0.25
			this.groupSpacing = 0.72 + 0.28 * (1 - Math.exp(-gap / 0.4))
			this.previousRoot = this.group.find((branch) => branch.parent === this.attachment?.id)
			this.previousChord = this.group.length > 1
			this.group = []
			this.groupAt = now
			this.attachment = undefined
		}
		this.group = this.group.filter((branch) => branch.end === undefined)
		if (!this.group.length) {
			this.groupAt = now
			this.attachment = undefined
		}
		const branch: TreeBranch = {
			id: this.serial++,
			key,
			note,
			velocity: Math.min(127, velocity),
			start: now,
			origin: { x: 0, y: (now - this.started) * TREE_SPEED },
			side: this.side,
			spread: (40 + (note % 12) * 1.5) * this.groupSpacing,
			targetX: 0,
			minimumHeight: TREE_FORK_HEIGHT + 8,
			onset: this.groupAt,
			projectTime: this.heightAt
		}
		this.group.push(branch)
		this.held.set(key, branch)
		this.history.push(branch)
		this.arrangeGroup()
		this.dirty = true
	}

	private arrangeGroup(): void {
		const rootPitch =
			describeChord(this.group.map((branch) => branch.note)).root ?? this.harmony?.root
		const root =
			this.group.find((branch) => branch.note % 12 === rootPitch) ??
			this.group.reduce((a, b) => (a.note < b.note ? a : b))
		if (this.group.length === 1) {
			this.side *= -1
		}
		if (
			this.group.length > 1 &&
			this.previousChord &&
			this.previousRoot?.end === undefined &&
			this.previousRoot &&
			!this.attachment
		) {
			this.side *= -1
			this.attachment = this.previousRoot
		}
		// An existing fork may remain connected after its parent ends, but a new
		// root must never be attached to that closed parent.
		if (this.attachment?.end !== undefined && root.parent !== this.attachment.id) {
			this.attachment = undefined
		}
		root.parent = this.attachment?.id
		root.junction = this.attachment
		root.stem = undefined
		root.forkAt = undefined
		root.origin = {
			x: 0,
			y: this.attachment
				? branchPoint(this.attachment, this.groupAt).y
				: (root.start - this.started!) * TREE_SPEED
		}
		root.side = this.attachment?.side ?? this.side
		let index = 0
		for (const branch of this.group) {
			if (branch === root) {
				continue
			}
			const offset = 12 + index++ * (12 + 2 * this.groupSpacing)
			branch.parent = root.id
			branch.stem = root
			branch.junction = undefined
			branch.forkAt = root.start + offset / TREE_SPEED
			branch.origin = { x: 0, y: root.origin.y + offset }
			branch.side = root.side
		}
	}

	/** Pack non-overlapping time intervals into reusable Git-style lane blocks.
	 * Within a family, newer forks sit inside older forks, so their short
	 * connectors never cut across an existing vertical stem. No work per frame
	 * is needed until notes or releases change the topology. */
	layout(): void {
		if (!this.dirty) {
			return
		}
		// Give every start/release a graph row. Simultaneous chord notes share
		// their time but receive separate fork rows, with the detected root first.
		// Real time still contributes to spacing and to growth between events.
		const events = this.history.flatMap((branch) =>
			branch.end === undefined
				? [{ branch, at: branch.onset, on: true }]
				: [
						{ branch, at: branch.onset, on: true },
						{ branch, at: branch.end, on: false }
					]
		)
		events.sort(
			(a, b) =>
				a.at - b.at ||
				Number(a.on) - Number(b.on) ||
				Number(!!a.branch.stem) - Number(!!b.branch.stem) ||
				a.branch.id - b.branch.id
		)
		this.rows = []
		let y = -26,
			previous = this.started ?? 0
		for (const event of events) {
			y += 26 + Math.max(0, event.at - previous) * TREE_SPEED
			if (event.on) {
				event.branch.origin.y = y
			} else {
				event.branch.endY = y
			}
			const last = this.rows.at(-1)
			if (last?.at === event.at) {
				last.y = y
			} else {
				this.rows.push({ at: event.at, y })
			}
			previous = event.at
		}
		const children = new Map<number, TreeBranch[]>()
		const roots: TreeBranch[] = []
		for (const branch of this.history) {
			if (branch.parent === undefined) {
				roots.push(branch)
			} else {
				const siblings = children.get(branch.parent) ?? []
				siblings.push(branch)
				children.set(branch.parent, siblings)
			}
		}
		for (const siblings of children.values()) {
			siblings.sort((a, b) => b.origin.y - a.origin.y || b.id - a.id)
		}
		const floors = new Map<number, number[]>([
			[-1, []],
			[1, []]
		])
		this.trunkTop = 0
		for (const root of roots) {
			this.trunkTop = Math.max(this.trunkTop, root.origin.y)
		}
		for (let i = roots.length - 1; i >= 0; i--) {
			const root = roots[i],
				family: TreeBranch[] = [],
				stack = [root]
			let top = root.origin.y
			while (stack.length) {
				const branch = stack.pop()!
				family.push(branch)
				top =
					branch.end === undefined
						? Infinity
						: Math.max(top, branchPoint(branch, branch.end).y)
				const descendants = children.get(branch.id) ?? []
				for (let child = descendants.length - 1; child >= 0; child--) {
					stack.push(descendants[child])
				}
			}
			const columns = floors.get(root.side)!
			let column = 0
			for (;;) {
				let conflict = -1
				for (let offset = 0; offset < family.length; offset++) {
					if (
						columns[column + offset] !== undefined &&
						top + 12 >= columns[column + offset]
					) {
						conflict = column + offset
						break
					}
				}
				if (conflict < 0) {
					break
				}
				column = conflict + 1
			}
			for (let offset = 0; offset < family.length; offset++) {
				const branch = family[offset]
				branch.targetX =
					root.side *
					((column + offset + 1) * LANE_WIDTH +
						(branch.spread / (40 + (branch.note % 12) * 1.5) - 0.72) * 10)
				branch.origin.x = (branch.stem ?? branch.junction)?.targetX ?? 0
				branch.side = root.side
				columns[column + offset] = root.origin.y
			}
		}
		this.dirty = false
	}
	noteOff(note: number, channel: number, now: number): void {
		const key = `${channel}:${note}`,
			branch = this.held.get(key)
		if (branch) {
			branch.end = Math.max(branch.start, now)
			this.held.delete(key)
			this.dirty = true
		}
	}
	allNotesOff(now: number): void {
		for (const branch of this.held.values()) {
			branch.end = Math.max(branch.start, now)
		}
		this.held.clear()
		this.dirty = true
	}
	reset(): void {
		this.history = []
		this.held.clear()
		this.started = undefined
		this.serial = 0
		this.group = []
		this.groupAt = -Infinity
		this.previousRoot = undefined
		this.attachment = undefined
		this.previousChord = false
		this.side = -1
		this.groupSpacing = 1
		this.trunkTop = 0
		this.rows = []
		this.dirty = false
	}
}