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
	/** Tree height at the moment the note was released. */
	releaseY?: number
	/** Where the branch leaves its parent branch, or the trunk. */
	origin: TreePoint
	/** The lane the branch grows up vertically once its arc is complete. */
	targetX: number
	/** Height of the curved fork. Zero when the branch carries a released stem onwards. */
	arc: number
	/** Lowest height the tip may stop at, so short notes stay visible and forks stay attached. */
	floor: number
	side: number
	lane: number
	/** Whether sub-branches prefer lanes away from (1) or towards (-1) the trunk. */
	direction: number
	parent?: TreeBranch
	/** A chord progression carries the released root of the previous chord onwards. */
	continues?: TreeBranch
	continuedBy?: TreeBranch
	/** The branch that used this lane before, restored if the chord is rearranged. */
	under?: TreeBranch
}

export const TREE_SPEED = 42
/** The trunk's leading shoot stays this far above the branch tips. */
export const TREE_TRUNK_LEAD = 16
const GROUP_WINDOW = 0.055
/** A chord released this recently is still carried onwards by the next chord. */
const LEGATO = 0.2
const LANE_WIDTH = 22
const TRUNK_GAP = 30
const FORK_STEP = 12
/** Each onset makes the whole tree surge, so a new chord unfurls at once. */
const SPURT = 0.3

const arcHeight = (distance: number): number => Math.min(72, 14 + Math.abs(distance) * 0.6)
export const forkX = (u: number): number => u * u * (3 - 2 * u)
export const forkY = (u: number): number => {
	const v = 1 - u
	return 3 * v * v * u * 0.3 + 3 * v * u * u * 0.35 + u * u * u
}

/** A point on the fork: it leaves the parent along its direction, swings out, and
 * arrives in its lane already vertical. There are no corners anywhere on the path. */
export function branchArcPoint(branch: TreeBranch, u: number): TreePoint {
	return {
		x: branch.origin.x + (branch.targetX - branch.origin.x) * forkX(u),
		y: branch.origin.y + branch.arc * forkY(u)
	}
}
export function branchPathPoint(branch: TreeBranch, height: number): TreePoint {
	if (height >= branch.arc) {
		return { x: branch.targetX, y: branch.origin.y + Math.max(0, height) }
	}
	let low = 0,
		high = 1
	for (let step = 0; step < 20; step++) {
		const middle = (low + high) / 2
		if (forkY(middle) * branch.arc < height) {
			low = middle
		} else {
			high = middle
		}
	}
	return branchArcPoint(branch, Math.max(0, height) <= 0 ? 0 : (low + high) / 2)
}
/** The height a branch stops at. A held branch has no limit yet. */
export function branchLimit(branch: TreeBranch): number {
	return branch.end === undefined ? Infinity : Math.max(branch.releaseY ?? 0, branch.floor)
}
export function leafLength(branch: TreeBranch): number {
	return 10 + (branch.velocity / 127) * 14
}

export class TreeModel {
	readonly held = new Map<string, TreeBranch>()
	readonly branches: TreeBranch[] = []
	started?: number
	harmony?: HarmonicState
	private serial = 0
	private side = -1
	private sideBefore = -1
	private group: TreeBranch[] = []
	private groupAt = -Infinity
	private groupY = 0
	private groupOffset = 0
	private root?: TreeBranch
	private previous: TreeBranch[] = []
	private previousRoot?: TreeBranch
	/** The newest branch in each lane, indexed by lane number, for the left and right side. */
	private lanes: Array<Array<TreeBranch | undefined>> = [[], []]
	private spurtAt: number[] = []
	private spurtSize: number[] = []
	private spurtSum: number[] = []

	/** Height of the growing tips: steady growth plus a surge for every onset. */
	heightAt = (time: number): number => {
		if (this.started === undefined) {
			return 0
		}
		let y = Math.max(0, time - this.started) * TREE_SPEED,
			index = this.spurtAt.length - 1
		for (; index >= 0 && time - this.spurtAt[index] < SPURT; index--) {
			const progress = (time - this.spurtAt[index]) / SPURT
			if (progress > 0) {
				y += this.spurtSize[index] * (1 - (1 - progress) ** 3)
			}
		}
		return index < 0 ? y : y + this.spurtSum[index] + this.spurtSize[index]
	}
	tipY(branch: TreeBranch, time: number): number {
		return Math.max(branch.origin.y, Math.min(branchLimit(branch), this.heightAt(time)))
	}
	tip(branch: TreeBranch, time: number): TreePoint {
		return branchPathPoint(branch, this.tipY(branch, time) - branch.origin.y)
	}

	noteOn(note: number, velocity: number, channel: number, now: number): void {
		if (!Number.isInteger(note) || note < 0 || note > 127 || !Number.isFinite(velocity)) {
			return
		}
		this.noteOff(note, channel, now)
		if (velocity <= 0) {
			return
		}
		const key = `${channel}:${note}`
		this.started ??= now
		if (
			now - this.groupAt > GROUP_WINDOW ||
			!this.group.some((branch) => branch.end === undefined)
		) {
			const gap = Number.isFinite(this.groupAt) ? Math.max(0, now - this.groupAt) : 0.25
			// Onsets close together sit slightly tighter than those after a pause.
			this.groupOffset = (0.5 - Math.exp(-gap / 0.4)) * 6
			this.previous = this.group
			this.previousRoot = this.root
			this.group = []
			this.groupAt = now
			this.groupY = this.heightAt(now)
			this.sideBefore = this.side
			this.spurtSum.push((this.spurtSum.at(-1) ?? 0) + (this.spurtSize.at(-1) ?? 0))
			this.spurtAt.push(now)
			this.spurtSize.push(0)
		}
		const branch: TreeBranch = {
			id: this.serial++,
			key,
			note,
			velocity: Math.min(127, velocity),
			start: now,
			origin: { x: 0, y: this.groupY },
			targetX: 0,
			arc: 0,
			floor: 0,
			side: this.side,
			lane: 0,
			direction: 1
		}
		this.group.push(branch)
		this.held.set(key, branch)
		this.branches.push(branch)
		this.arrange()
	}

	private lanesOf(side: number): Array<TreeBranch | undefined> {
		return this.lanes[side < 0 ? 0 : 1]
	}
	/** The height above which a lane is free again, leaf included. */
	private top(branch?: TreeBranch): number {
		return branch ? branchLimit(branch) + leafLength(branch) + 6 : -Infinity
	}
	private occupy(branch: TreeBranch, side: number, lane: number): void {
		const lanes = this.lanesOf(side)
		branch.side = side
		branch.lane = lane
		branch.under = lanes[lane]
		lanes[lane] = branch
	}
	private laneX(side: number, lane: number): number {
		return side * (TRUNK_GAP + (lane - 1) * LANE_WIDTH + this.groupOffset)
	}

	private live(side: number, lane: number): boolean {
		const branch = this.lanesOf(side)[lane]
		return branch !== undefined && branch.end === undefined
	}
	/** The growing branch furthest from the trunk: nothing beyond it can be crossed. */
	private outermost(side: number): TreeBranch | undefined {
		const lanes = this.lanesOf(side)
		for (let lane = lanes.length - 1; lane >= 1; lane--) {
			if (this.live(side, lane)) {
				return lanes[lane]
			}
		}
	}
	/** Fork a branch from its parent into a lane, no lower than `base` and clear
	 * of the leaf of whatever grew in that lane before. */
	private fork(branch: TreeBranch, parent: TreeBranch, lane: number, base: number): number {
		const side = parent.side,
			targetX = this.laneX(side, lane),
			arc = arcHeight(targetX - parent.targetX)
		const y = Math.max(
			base,
			parent.origin.y + (parent.arc ? parent.arc * 0.7 : 6),
			this.top(this.lanesOf(side)[lane]) - arc / 2
		)
		branch.parent = parent
		branch.origin = { x: branchPathPoint(parent, y - parent.origin.y).x, y }
		branch.targetX = targetX
		branch.arc = arc
		branch.floor = y + arc
		parent.floor = Math.max(parent.floor, y + 8)
		this.occupy(branch, side, lane)
		return y
	}

	/** Lay out the current chord. Notes of one chord arrive one at a time, so the
	 * chord is laid out again from scratch whenever another note joins it. */
	private arrange(): void {
		const group = this.group,
			y = this.groupY
		for (const branch of group) {
			const lanes = this.lanesOf(branch.side)
			if (lanes[branch.lane] === branch) {
				lanes[branch.lane] = branch.under
			}
			if (branch.continues) {
				branch.continues.continuedBy = undefined
			}
			branch.under = branch.continues = branch.parent = undefined
		}
		const rootPitch =
			describeChord(group.map((branch) => branch.note)).root ?? this.harmony?.root
		const root = (this.root =
			group.find((branch) => branch.note % 12 === rootPitch) ??
			group.reduce((a, b) => (a.note < b.note ? a : b)))
		const progression = group.length > 1 && this.previous.length > 1
		const held = this.previous.filter((branch) => branch.end === undefined)
		const last = this.previousRoot
		this.side = this.sideBefore
		root.direction = 1
		if (progression && held.length) {
			// The previous chord still sounds: fork from it, weaving back into the
			// lanes of older, finished chords when there is room, else outwards.
			const side = held[0].side
			const inner = held.reduce((a, b) => (a.lane < b.lane ? a : b))
			let inward = inner.lane - group.length >= 1
			for (let lane = inner.lane - 1; inward && lane >= inner.lane - group.length; lane--) {
				inward = !this.live(side, lane)
			}
			const parent = inward ? inner : this.outermost(side)!
			root.direction = inward ? -1 : 1
			this.fork(root, parent, parent.lane + root.direction, y - 6)
		} else if (
			progression &&
			last?.end !== undefined &&
			this.groupAt - last.end <= LEGATO &&
			this.lanesOf(last.side)[last.lane] === last
		) {
			// The previous chord has just been released: its root stem carries on.
			last.continuedBy = root
			root.continues = last
			root.direction = last.direction
			root.origin = { x: last.targetX, y: branchLimit(last) }
			root.targetX = last.targetX
			root.arc = 0
			root.floor = root.origin.y + 8
			this.occupy(root, last.side, last.lane)
		} else {
			// A new bough from the trunk, on alternating sides. When a growing
			// branch is in the way on both sides, fork from the outermost one
			// instead: a new branch never crosses one that is still growing.
			const preferred = -this.sideBefore
			const reach = (side: number) =>
				this.top(this.lanesOf(side)[1]) - arcHeight(this.laneX(side, 1)) / 2
			let side = [preferred, -preferred].find((side) => reach(side) <= y + 12)
			if (side === undefined) {
				const a = this.outermost(preferred),
					b = this.outermost(-preferred)
				const parent = a && b ? (a.lane <= b.lane ? a : b) : (a ?? b)
				if (parent) {
					this.side = parent.side
					this.fork(root, parent, parent.lane + 1, y - 6)
				} else {
					side = preferred
				}
			}
			if (side !== undefined) {
				this.side = side
				root.origin = { x: 0, y: Math.max(y, Math.min(y + 12, reach(side))) }
				root.targetX = this.laneX(side, 1)
				root.arc = arcHeight(root.targetX)
				root.floor = root.origin.y + root.arc
				this.occupy(root, side, 1)
			}
		}

		// Sub-branches take the free lanes next to their root. The furthest forks
		// lowest, so no fork ever has to cross a sibling.
		const children = group.filter((branch) => branch !== root).sort((a, b) => a.note - b.note)
		const side = root.side,
			chosen: number[] = []
		for (const direction of [root.direction, -root.direction]) {
			for (
				let lane = root.lane + direction;
				chosen.length < children.length && lane >= 1 && !this.live(side, lane);
				lane += direction
			) {
				chosen.push(lane)
			}
		}
		const next = [0, 0]
		const order = chosen
			.map((_, index) => index)
			.sort((a, b) => Math.abs(chosen[b] - root.lane) - Math.abs(chosen[a] - root.lane))
		for (const index of order) {
			const outward = Number(chosen[index] > root.lane)
			next[outward] =
				this.fork(children[index], root, chosen[index], next[outward]) + FORK_STEP
		}
		// With no free lane left beside the root, the rest fork beyond whatever
		// is still growing on this side.
		for (const child of children.slice(chosen.length)) {
			const parent = this.outermost(side)
			this.fork(
				child,
				parent ?? root,
				parent ? parent.lane + 1 : this.lanesOf(side).length,
				y - 6
			)
		}
		let highest = 0
		for (const branch of group) {
			branch.direction = root.direction
			highest = Math.max(highest, branch.floor)
		}
		const spurt = this.spurtSize.length - 1
		this.spurtSize[spurt] = Math.max(this.spurtSize[spurt], 14, (highest - y) * 0.7)
	}

	noteOff(note: number, channel: number, now: number): void {
		const key = `${channel}:${note}`,
			branch = this.held.get(key)
		if (branch) {
			this.release(branch, now)
			this.held.delete(key)
		}
	}
	allNotesOff(now: number): void {
		for (const branch of this.held.values()) {
			this.release(branch, now)
		}
		this.held.clear()
	}
	private release(branch: TreeBranch, now: number): void {
		branch.end = Math.max(branch.start, now)
		branch.releaseY = this.heightAt(branch.end)
	}
	reset(): void {
		this.branches.length = 0
		this.held.clear()
		this.started = undefined
		this.serial = 0
		this.group = []
		this.groupAt = -Infinity
		this.groupY = 0
		this.groupOffset = 0
		this.root = undefined
		this.previous = []
		this.previousRoot = undefined
		this.side = this.sideBefore = -1
		this.lanes = [[], []]
		this.spurtAt = []
		this.spurtSize = []
		this.spurtSum = []
	}
}