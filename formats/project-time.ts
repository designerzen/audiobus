/** Project files store absolute ticks; integrate tempo changes before making audio commands. */
export interface ProjectTempo {
	position: number
	bpm: number
}
export function projectTick(value: unknown): number {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
		throw new Error("Project ticks must be nonnegative safe integers")
	}
	return value
}

export function projectTimeAxis(ppq: number, tempos: ProjectTempo[]) {
	if (!Number.isSafeInteger(ppq) || ppq <= 0 || ppq > 705600000 || tempos.length > 10000) {
		throw new Error("Invalid project resolution or too many tempo changes")
	}
	const changes = new Map<number, number>([[0, 120]])
	for (const tempo of tempos) {
		if (!tempo || !Number.isFinite(tempo.bpm) || tempo.bpm <= 0 || tempo.bpm > 10000) {
			throw new Error("Invalid project tempo")
		}
		changes.set(projectTick(tempo.position), tempo.bpm)
	}
	const points = [...changes]
		.sort(([a], [b]) => a - b)
		.map(([position, bpm]) => ({ position, bpm, seconds: 0 }))
	for (let i = 1; i < points.length; i++) {
		const previous = points[i - 1]
		points[i].seconds =
			previous.seconds +
			(((points[i].position - previous.position) / ppq) * 60) / previous.bpm
	}
	return (tick: number) => {
		projectTick(tick)
		let low = 0,
			high = points.length
		while (low + 1 < high) {
			const middle = (low + high) >>> 1
			if (points[middle].position <= tick) {
				low = middle
			} else {
				high = middle
			}
		}
		const point = points[low]
		return point.seconds + (((tick - point.position) / ppq) * 60) / point.bpm
	}
}

/** SVP may contain NUL-separated compatibility copies; load the newest version. */
export function parseMusicJSON(text: string): any {
	const copies = text
		.replace(/^\uFEFF/, "")
		.split("\0")
		.filter((part) => part.trim())
	if (!copies.length || copies.length > 8) {
		throw new Error("Invalid JSON project")
	}
	const projects = copies.map((part) => JSON.parse(part))
	if (
		projects.length > 1 &&
		projects.some((data) => !data?.time || !Array.isArray(data.tracks))
	) {
		throw new Error("Only Synthesizer V projects support multiple JSON copies")
	}
	return projects.sort((a, b) => (b?.version ?? 0) - (a?.version ?? 0))[0]
}