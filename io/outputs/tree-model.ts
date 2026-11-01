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
	origin: TreePoint
	side: number
	parent?: number
	drift: number
	stem?: TreeBranch
	forkAt?: number
}

export const TREE_SPEED = 42
const GROUP_WINDOW = 0.055

/** World coordinates grow upwards; completed branches never change their geometry. */
export function branchPoint(branch: TreeBranch, time: number): TreePoint {
	const end = Math.min(time, branch.end ?? time)
	if (branch.stem && end < branch.forkAt!) {
		return branchPoint(branch.stem, end)
	}
	const origin = branch.stem ? branchPoint(branch.stem, branch.forkAt!) : branch.origin
	const age = Math.max(0, end - (branch.forkAt ?? branch.start))
	const bend = 1 - Math.exp(-age / 0.8)
	return {
		x:
			origin.x +
			branch.side * (42 + (branch.note % 12) * 3) * bend * bend +
			branch.drift * bend,
		y: origin.y + age * TREE_SPEED
	}
}

function joiningDrift(branch: TreeBranch, time: number): number {
	const at = Math.min(time, branch.end ?? time)
	return (branchPoint(branch, at).x - branchPoint(branch, at - 0.001).x) * 800
}

export class TreeModel {
	readonly held = new Map<string, TreeBranch>()
	branches: TreeBranch[] = []
	started?: number
	harmony?: HarmonicState
	private serial = 0
	private side = -1
	private group: TreeBranch[] = []
	private groupAt = -Infinity
	private previousRoot?: TreeBranch
	private previousChord = false
	private attachment?: TreeBranch

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
			this.previousRoot = this.group.find((branch) => branch.parent === this.attachment?.id)
			this.previousChord = this.group.length > 1
			this.group = []
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
			drift: 0
		}
		this.group.push(branch)
		this.held.set(key, branch)
		this.branches.push(branch)
		this.arrangeGroup(now)
		// Keep held notes, but bound completed history even in a long-running session.
		if (this.branches.length > 1024) {
			const removable = this.branches.findIndex(
				(item) => item.end !== undefined && !this.group.includes(item)
			)
			if (removable >= 0) {
				this.branches.splice(removable, 1)
			}
		}
	}

	private arrangeGroup(now: number): void {
		const notes = this.group.map((branch) => branch.note)
		const rootPitch = describeChord(notes).root ?? this.harmony?.root
		const root =
			this.group.find((branch) => branch.note % 12 === rootPitch) ??
			this.group.reduce((a, b) => (a.note < b.note ? a : b))
		if (this.group.length === 1) {
			this.side *= -1
		}
		// Consecutive chords continue the previous root, including across short rests.
		if (
			this.group.length > 1 &&
			this.previousChord &&
			this.previousRoot &&
			this.groupAt - (this.previousRoot.end ?? now) < 4
		) {
			this.attachment = this.previousRoot
		}
		root.parent = this.attachment?.id
		root.stem = undefined
		root.forkAt = undefined
		root.origin = this.attachment
			? branchPoint(this.attachment, this.groupAt)
			: { x: 0, y: (root.start - this.started!) * TREE_SPEED }
		root.drift = this.attachment ? joiningDrift(this.attachment, this.groupAt) : 0
		root.side = this.side
		let index = 0
		for (const branch of this.group) {
			if (branch === root) {
				continue
			}
			branch.parent = root.id
			branch.stem = root
			branch.forkAt = Math.max(branch.start, root.start + 0.25 + index * 0.12)
			branch.origin = branchPoint(root, branch.forkAt)
			branch.side = ++index % 2 ? -root.side : root.side
			branch.drift = joiningDrift(root, branch.forkAt)
		}
	}

	noteOff(note: number, channel: number, now: number): void {
		const key = `${channel}:${note}`,
			branch = this.held.get(key)
		if (branch) {
			branch.end = Math.max(branch.start, now)
			this.held.delete(key)
		}
	}
	allNotesOff(now: number): void {
		for (const branch of this.held.values()) {
			branch.end = Math.max(branch.start, now)
		}
		this.held.clear()
	}
	reset(): void {
		this.branches = []
		this.held.clear()
		this.started = undefined
		this.group = []
		this.groupAt = -Infinity
		this.previousRoot = undefined
		this.attachment = undefined
		this.previousChord = false
		this.side = -1
	}
}