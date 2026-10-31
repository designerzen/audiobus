import { mod12 } from "./pitch-class-set"

export const SATB_RANGES = [[40, 60], [48, 67], [55, 74], [60, 81]] as const
export interface ClassicalRules {
	lower: number
	upper: number
	leap: number
	common: boolean
	root: number
	leadingTone: boolean
	parallels: boolean
}
/** Hard constraints: ordered voices, SATB ranges, upper spacing, overlap and optional parallels. */
export function classicalVoicing(notes: number[], previous: number[], rules: ClassicalRules): number[] {
	const classes = [...new Set(notes.map(mod12))]
	if (!classes.length || classes.length > 4) return []
	const choices = SATB_RANGES.map(([low, high]) => Array.from({ length: 128 }, (_, n) => n)
		.filter((n) => n >= Math.max(low, rules.lower) && n <= Math.min(high, rules.upper) && classes.includes(mod12(n))))
	let best: number[] = [], bestCost = Infinity
	const search = (part: number[], cost: number) => {
		const i = part.length
		if (i === 4) {
			if (classes.some((pc) => !part.some((n) => mod12(n) === pc))) return
			if (cost < bestCost) { best = [...part]; bestCost = cost }
			return
		}
		for (const note of choices[i]) {
			if (i && (note <= part[i - 1] || (i > 1 && note - part[i - 1] > 12) || (i === 1 && note - part[0] > 19))) continue
			if (previous.length === 4) {
				if ((i && note < previous[i - 1]) || (i < 3 && note > previous[i + 1])) continue
				if (rules.leadingTone && mod12(previous[i]) === mod12(rules.root - 1) && note !== previous[i] && note !== previous[i] + 1) continue
				if (rules.parallels && part.some((lower, j) => {
					const before = mod12(previous[i] - previous[j]), after = mod12(note - lower)
					const direction = Math.sign(note - previous[i])
					return (before === 0 || before === 7) && before === after && direction !== 0 && direction === Math.sign(lower - previous[j])
				})) continue
			}
			const target = previous[i] ?? [48, 55, 64, 72][i]
			const motion = Math.abs(note - target)
			const next = cost + motion + Math.max(0, motion - rules.leap) * 4 + (rules.common && previous.includes(note) ? -3 : 0)
			search([...part, note], next)
		}
	}
	search([], 0)
	return best
}
