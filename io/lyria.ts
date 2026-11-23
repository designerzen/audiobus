export const LYRIA_MODELS = ["lyria-3.5", "lyria-3-clip-preview"] as const
export const MAX_TRACK_BYTES = 32 * 1024 * 1024

export interface LyriaTrack {
	bytes: ArrayBuffer
	mimeType: string
	text: string
}

/** Uses the owner's key directly; keys must never enter device options or URLs. */
export async function generateLyriaTrack(
	apiKey: string,
	prompt: string,
	model: (typeof LYRIA_MODELS)[number],
	signal: AbortSignal
): Promise<LyriaTrack> {
	if (!apiKey.trim() || !prompt.trim()) {
		throw new Error("Enter a Gemini API key and a music description")
	}
	if (!LYRIA_MODELS.includes(model)) {
		throw new Error("Unsupported Lyria model")
	}
	const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Api-Revision": "2026-05-20",
			"x-goog-api-key": apiKey.trim()
		},
		body: JSON.stringify({ model, input: prompt, store: false }),
		signal
	})
	if (!response.ok) {
		const reason =
			response.status === 429
				? "Quota exhausted; check billing or try later"
				: [401, 403].includes(response.status)
					? "Check your Gemini key, billing and model access"
					: "Music generation failed; try again later"
		// Do not echo provider response bodies, which may include request data.
		throw new Error(`${reason} (HTTP ${response.status})`)
	}
	const result = await response.json()
	const blocks: any[] = (result.steps ?? [])
		.filter((step: any) => step.type === "model_output")
		.flatMap((step: any) => step.content ?? [])
	const audio =
		[...blocks].reverse().find((block: any) => block.type === "audio" && block.data) ??
		result.output_audio
	if (!audio || typeof audio.data !== "string") {
		throw new Error("Lyria returned no audio. Try a different description")
	}
	if (audio.data.length > Math.ceil(MAX_TRACK_BYTES / 3) * 4) {
		throw new Error("Generated audio exceeds 32 MB")
	}
	const mimeType = audio.mime_type ?? "audio/mpeg"
	if (!["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"].includes(mimeType)) {
		throw new Error("Lyria returned an unsupported audio format")
	}
	const binary = atob(audio.data)
	if (!binary.length || binary.length > MAX_TRACK_BYTES) {
		throw new Error("Generated audio is empty or exceeds 32 MB")
	}
	return {
		bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer,
		mimeType,
		text: blocks
			.filter((block: any) => block.type === "text")
			.map((block: any) => block.text ?? "")
			.join("\n")
	}
}