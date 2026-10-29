export const BROWSER_AI_DOWNLOAD_PROGRESS = "downloadprogress"

export interface BrowserAISession {
	prompt(
		input: string,
		options: { signal: AbortSignal; responseConstraint: object }
	): Promise<string>
	destroy(): void
}

interface BrowserAI {
	availability(options: object): Promise<string>
	create(options: object): Promise<BrowserAISession>
}

const SESSION_OPTIONS = {
	expectedInputs: [{ type: "text", languages: ["en"] }],
	expectedOutputs: [{ type: "text", languages: ["en"] }]
}

export function browserAI(): BrowserAI | undefined {
	return (globalThis as typeof globalThis & { LanguageModel?: BrowserAI }).LanguageModel
}

/** Own a short-lived session per request so prompts cannot accumulate context. */
export async function promptBrowserAI(
	prompt: string,
	schema: object,
	signal: AbortSignal,
	status: (message: string) => void = () => {}
): Promise<unknown> {
	signal.throwIfAborted()
	const api = browserAI()
	if (!api) {
		throw new Error(
			"Built-in AI is unavailable. Use a browser with the LanguageModel Prompt API enabled."
		)
	}
	const availability = await api.availability(SESSION_OPTIONS)
	signal.throwIfAborted()
	if (availability === "unavailable") {
		throw new Error("Built-in AI is unavailable on this device.")
	}
	status(availability === "available" ? "Preparing browser AI…" : "Downloading browser AI model…")
	const session = await api.create({
		...SESSION_OPTIONS,
		signal,
		monitor: (monitor: EventTarget) =>
			monitor.addEventListener(BROWSER_AI_DOWNLOAD_PROGRESS, (event: Event) => {
				if (!signal.aborted) {
					status(
						`Downloading browser AI model: ${Math.round((event as Event & { loaded: number }).loaded * 100)}%`
					)
				}
			})
	})
	const abort = () => session.destroy()
	signal.addEventListener("abort", abort, { once: true })
	try {
		signal.throwIfAborted()
		status("Generating music…")
		const response = await session.prompt(prompt, { signal, responseConstraint: schema })
		signal.throwIfAborted()
		return JSON.parse(response)
	} finally {
		signal.removeEventListener("abort", abort)
		session.destroy()
	}
}

export const MIDI_NOTES_SCHEMA = {
	type: "array",
	minItems: 1,
	maxItems: 64,
	items: { type: "integer", minimum: 0, maximum: 127 }
}

export function validateMidiNotes(value: unknown, limit = 64): number[] {
	if (
		!Array.isArray(value) ||
		!value.length ||
		value.length > limit ||
		!value.every((note) => Number.isInteger(note) && note >= 0 && note <= 127)
	) {
		throw new Error(`AI must return 1–${limit} MIDI notes between 0 and 127.`)
	}
	return value
}