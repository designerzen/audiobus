import {
	EVENT_BLUR,
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_DRAG_OVER,
	EVENT_DROP,
	EVENT_FOCUS_OUT,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_LOST_POINTER_CAPTURE,
	EVENT_POINTER_CANCEL,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_MOVE,
	EVENT_POINTER_UP
} from "../../../events/event-constants"
const escape = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
	)
const noteName = (note) =>
	`${["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][note % 12]}${Math.floor(note / 12) - 1}`
const fields = {
	sample: [
		["start", "Start", 0, 0.9999, 0.001],
		["end", "End", 0.0001, 1, 0.001],
		["loopStart", "Loop start", 0, 0.9999, 0.001],
		["loopEnd", "Loop end", 0.0001, 1, 0.001],
		["root", "Root note", 0, 127, 1],
		["tune", "Tune (st)", -24, 24, 0.01],
		["gain", "Gain", 0, 2, 0.01]
	],
	envelope: [
		["attack", "Attack (s)", 0, 10, 0.001],
		["decay", "Decay (s)", 0, 10, 0.001],
		["sustain", "Sustain", 0, 1, 0.01],
		["release", "Release (s)", 0, 20, 0.001]
	],
	filter: [
		["cutoff", "Cutoff (Hz)", 20, 20000, 1],
		["resonance", "Resonance (Q)", 0.1, 20, 0.1]
	],
	layer: [
		["velocityLow", "Velocity start", 0, 1, 0.01],
		["fadeIn", "Fade in to", 0, 1, 0.01],
		["fadeOut", "Fade out from", 0, 1, 0.01],
		["velocityHigh", "Velocity end", 0, 1, 0.01],
		["gain", "Layer gain", 0, 2, 0.01],
		["velocitySensitivity", "Velocity sensitivity", 0, 1, 0.01]
	]
}

export const setupSamplerEditor = (root, getBackend) => {
	if (!root) {
		return null
	}
	let key = 60,
		selected = 0,
		tab = "sample",
		backend,
		loading = false,
		drag,
		velocity = 0.8
	let disposed = false
	const events = new AbortController()
	const listen = (type, handler) =>
		root.addEventListener(type, handler, { signal: events.signal })
	const waveforms = new WeakMap()
	const engine = () => (disposed ? null : getBackend())
	const layer = () => engine()?.getLayers(key)[selected]
	const status = (message) => {
		root.querySelector("[data-sampler-status]")?.replaceChildren(message)
	}
	const control = ([name, label, min, max, step], l) =>
		`<label>${label}<input type="number" data-sampler-param="${name}" min="${min}" max="${max}" step="${step}" value="${l[name]}" /></label>`
	const render = () => {
		if (!engine()) {
			return
		}
		const layers = engine().getLayers(key),
			l = layers[selected]
		root.innerHTML = `<section class="sampler-machine" aria-label="Layered sampler">
			<header><strong>ChromaticSampler</strong><span>4 LAYERS · AUDIOWORKLET</span></header>
			<div class="sampler-screen">
			<nav aria-label="Sampler editor">${Object.keys(fields)
				.map(
					(id) =>
						`<button type="button" data-sampler-tab="${id}" aria-pressed="${tab === id}">${id}</button>`
				)
				.join("")}</nav>
			<div class="sampler-toolbar"><label>Key <select data-sampler-key aria-label="Sample key">${Array.from({ length: 128 }, (_, note) => `<option value="${note}"${note === key ? " selected" : ""}>${noteName(note)}</option>`).join("")}</select></label><button type="button" data-sampler-clear>Clear layer</button></div>
			<div class="sampler-slots">${layers.map((item, index) => `<button type="button" data-sampler-layer="${index}" aria-pressed="${index === selected}" title="${escape(item.name)}">${String(index + 1).padStart(2, "0")} ${item.channels ? escape(item.name) : "ADD"}</button>`).join("")}</div>
			${tab === "sample" ? `<div class="sampler-drop"><label>Load sample<input type="file" accept="audio/*,.wav,.aif,.aiff,.flac,.ogg,.mp3" data-sampler-file${loading ? " disabled" : ""} /></label><span>or drop an audio file here</span></div><svg class="sampler-wave" viewBox="0 0 600 160" role="img" aria-label="Sample waveform and trim points"></svg><div class="sampler-switches"><label><input type="checkbox" data-sampler-param="loop"${l.loop ? " checked" : ""} /> Loop</label><label><input type="checkbox" data-sampler-param="oneShot"${l.oneShot ? " checked" : ""} /> One shot</label></div>` : ""}
			${tab === "envelope" ? '<svg class="sampler-envelope" viewBox="0 0 600 160" role="img" aria-label="Amplitude envelope"></svg>' : ""}
			${tab === "filter" ? `<label>Filter type<select data-sampler-param="filter">${["lowpass", "highpass", "bandpass", "off"].map((id) => `<option${id === l.filter ? " selected" : ""}>${id}</option>`).join("")}</select></label><svg class="sampler-filter" viewBox="0 0 600 160" role="img" aria-label="Filter response"></svg>` : ""}
			${tab === "layer" ? `<div class="sampler-layer-graphs">${layers.map((item, index) => `<button type="button" data-sampler-layer="${index}" aria-pressed="${index === selected}"><span>${index + 1} · ${escape(item.name)}</span><svg viewBox="0 0 600 70" aria-hidden="true"><path d="M ${item.velocityLow * 600} 65 L ${item.fadeIn * 600} 5 L ${item.fadeOut * 600} 5 L ${item.velocityHigh * 600} 65 Z" /></svg></button>`).join("")}<small>Soft velocity → Loud velocity</small><button type="button" data-sampler-split>Split loaded layers evenly</button></div>` : ""}
			<div class="sampler-parameters">${fields[tab].map((field) => control(field, l)).join("")}</div>
			<p data-sampler-status role="status" aria-live="polite">${l.channels ? `${escape(l.name)} · ${(l.channels[0].length / l.sampleRate).toFixed(2)} s` : "Load a sample to begin."}</p>
			</div>
			<label class="sampler-velocity">Audition velocity<input type="range" data-sampler-velocity min="0.01" max="1" step="0.01" value="${velocity}" /></label>
			<div class="sampler-keyboard" aria-label="Audition keyboard">${Array.from(
				{ length: 13 },
				(_, i) => {
					const note = Math.max(0, Math.min(115, key - 5)) + i
					return `<button type="button" data-sampler-note="${note}" class="${[1, 3, 6, 8, 10].includes(note % 12) ? "accidental" : ""}" aria-label="Play ${noteName(note)}">${noteName(note)}</button>`
				}
			).join("")}</div>
			<small>Samples and edits save with your workspace. Unmapped notes transpose the nearest sample.</small>
		</section>`
		draw()
	}
	const draw = () => {
		const l = layer()
		if (!l) {
			return
		}
		const svg = root.querySelector(".sampler-wave")
		if (svg) {
			let wave = ""
			const data = l.channels?.[0]
			if (data) {
				wave = waveforms.get(data)
				if (wave === undefined) {
					wave = ""
					for (let x = 0; x < 600; x++) {
						let min = 0,
							max = 0
						const start = Math.floor((x * data.length) / 600),
							end = Math.min(
								data.length,
								Math.max(start + 1, Math.floor(((x + 1) * data.length) / 600))
							)
						for (let i = start; i < end; i++) {
							min = Math.min(min, data[i])
							max = Math.max(max, data[i])
						}
						wave += `M${x} ${80 - min * 75}V${80 - max * 75}`
					}
					waveforms.set(data, wave)
				}
			}
			svg.innerHTML = `<rect width="600" height="160" fill="#143335"/><rect x="${l.start * 600}" width="${(l.end - l.start) * 600}" height="160" fill="#adf9f0"/><rect x="${l.loopStart * 600}" width="${(l.loopEnd - l.loopStart) * 600}" height="160" fill="#e9f668" opacity="${l.loop ? 0.7 : 0.15}"/><path d="${wave}" fill="none" stroke="#032020" stroke-width="1"/>${["start", "end", "loopStart", "loopEnd"].map((name, i) => `<g data-sampler-marker="${name}" style="cursor:ew-resize"><path d="M${l[name] * 600} 0V160" stroke="${i < 2 ? "#fff" : "#eeff45"}" stroke-width="2"/><rect x="${Math.max(0, Math.min(554, l[name] * 600 - 23))}" y="${i * 19}" width="46" height="18" fill="#001718"/><text x="${Math.max(23, Math.min(577, l[name] * 600))}" y="${i * 19 + 12}" text-anchor="middle" fill="#fff" font-size="9">${name}</text></g>`).join("")}`
		}
		const envelope = root.querySelector(".sampler-envelope")
		if (envelope) {
			const duration = l.attack + l.decay + l.release + 0.5,
				a = (l.attack / duration) * 600,
				d = ((l.attack + l.decay) / duration) * 600,
				r = 600 - (l.release / duration) * 600
			envelope.innerHTML = `<path d="M0 155 L${a} 5 L${d} ${155 - l.sustain * 150} L${r} ${155 - l.sustain * 150} L600 155"/>`
		}
		const filter = root.querySelector(".sampler-filter")
		if (filter) {
			const x = (Math.log(l.cutoff / 20) / Math.log(1000)) * 600
			filter.innerHTML = `<path d="${l.filter === "off" ? "M0 30H600" : l.filter === "highpass" ? `M0 150 Q${x} 150 ${x} 30 H600` : l.filter === "bandpass" ? `M0 150 Q${x} 150 ${x} 30 Q${x} 150 600 150` : `M0 30 H${x} Q${x} 150 600 150`}"/>`
		}
	}
	const update = (name, value) => {
		const l = engine().updateLayer(key, selected, { [name]: value })
		for (const input of root.querySelectorAll("[data-sampler-param]")) {
			const field = input.dataset.samplerParam
			if (input.type === "checkbox") {
				input.checked = l[field]
			} else {
				input.value = l[field]
			}
		}
		if (tab === "layer") {
			render()
		} else {
			draw()
		}
	}
	const load = async (file) => {
		if (!file || loading || !engine()) {
			return
		}
		const target = engine(),
			targetKey = key,
			targetLayer = selected
		loading = true
		render()
		status("Decoding sample…")
		try {
			await target.loadSample(targetKey, targetLayer, file)
			loading = false
			render()
			status(`Loaded ${file.name}`)
		} catch (error) {
			loading = false
			render()
			status(error.message)
		}
	}
	listen(EVENT_CHANGE, (event) => {
		const input = event.target
		if (input.matches("[data-sampler-velocity]")) {
			velocity = Number(input.value)
		}
		if (input.matches("[data-sampler-key]")) {
			key = Number(input.value)
			render()
		}
		if (input.matches("[data-sampler-file]")) {
			void load(input.files[0])
		}
		if (input.dataset.samplerParam) {
			update(
				input.dataset.samplerParam,
				input.type === "checkbox"
					? input.checked
					: input.type === "number"
						? Number(input.value)
						: input.value
			)
		}
	})
	listen(EVENT_CLICK, (event) => {
		const button = event.target.closest("button")
		if (!button) {
			return
		}
		if (button.dataset.samplerTab) {
			tab = button.dataset.samplerTab
			render()
		}
		if (button.dataset.samplerLayer !== undefined) {
			selected = Number(button.dataset.samplerLayer)
			render()
		}
		if (button.hasAttribute("data-sampler-clear")) {
			engine().clearLayer(key, selected)
			render()
		}
		if (button.hasAttribute("data-sampler-split")) {
			const loaded = engine()
				.getLayers(key)
				.map((l, i) => (l.channels ? i : -1))
				.filter((i) => i >= 0)
			loaded.forEach((index, i) =>
				engine().updateLayer(key, index, {
					velocityLow: i / loaded.length,
					fadeIn: i / loaded.length,
					fadeOut: (i + 1) / loaded.length,
					velocityHigh: (i + 1) / loaded.length
				})
			)
			render()
		}
	})
	listen(EVENT_DRAG_OVER, (event) => {
		event.preventDefault()
		event.stopPropagation()
	})
	listen(EVENT_DROP, (event) => {
		event.preventDefault()
		event.stopPropagation()
		void load(event.dataTransfer.files[0])
	})
	const stop = () => {
		engine()?.stopPreview()
		root.querySelectorAll(".playing").forEach((button) => button.classList.remove("playing"))
		drag = undefined
	}
	listen(EVENT_POINTER_DOWN, (event) => {
		const button = event.target.closest("[data-sampler-note]")
		if (button) {
			event.preventDefault()
			button.setPointerCapture(event.pointerId)
			button.classList.add("playing")
			engine()?.preview(Number(button.dataset.samplerNote), velocity)
		}
		const marker = event.target.closest("[data-sampler-marker]")
		if (marker) {
			event.preventDefault()
			drag = marker.dataset.samplerMarker
			root.setPointerCapture(event.pointerId)
		}
	})
	listen(EVENT_POINTER_MOVE, (event) => {
		if (!drag) {
			return
		}
		const rect = root.querySelector(".sampler-wave").getBoundingClientRect()
		update(drag, Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)))
	})
	for (const type of [EVENT_POINTER_UP, EVENT_POINTER_CANCEL, EVENT_LOST_POINTER_CAPTURE]) {
		listen(type, stop)
	}
	listen(EVENT_KEY_DOWN, (event) => {
		if (
			event.target.matches("[data-sampler-note]") &&
			[" ", "Enter"].includes(event.key) &&
			!event.repeat
		) {
			event.preventDefault()
			engine()?.preview(Number(event.target.dataset.samplerNote), velocity)
			event.target.classList.add("playing")
		}
		if (event.target.matches("input,select,button")) {
			event.stopPropagation()
		}
	})
	listen(EVENT_KEY_UP, (event) => {
		if (event.target.matches("[data-sampler-note]") && [" ", "Enter"].includes(event.key)) {
			event.preventDefault()
			stop()
		}
	})
	listen(EVENT_FOCUS_OUT, stop)
	root.ownerDocument.defaultView.addEventListener(EVENT_BLUR, stop, { signal: events.signal })
	return {
		refresh() {
			const next = engine()
			if (next !== backend) {
				backend = next
				if (next) {
					render()
				}
			}
		},
		destroy() {
			stop()
			disposed = true
			events.abort()
			root.replaceChildren()
		}
	}
}