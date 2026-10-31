import { AI_MODEL_INDEX_URL, type AIModelDefinition } from "./ai-model-catalogue"

export function musicAttribution(model: AIModelDefinition): HTMLElement {
	const credits = document.createElement("p")
	credits.className = "ai-model-attribution"
	credits.append(`By ${model.attribution.author}. `)
	for (const [label, url] of [
		["Source", model.attribution.sourceUrl],
		["Model and checkpoint credits", AI_MODEL_INDEX_URL],
		[model.attribution.license, model.attribution.licenseUrls[0]],
		["Checkpoint configuration", `${model.checkpoint}/config.json`]
	]) {
		const link = document.createElement("a")
		link.textContent = label
		link.href = url
		link.target = "_blank"
		link.rel = "noopener noreferrer"
		credits.append(link, " ")
	}
	return credits
}