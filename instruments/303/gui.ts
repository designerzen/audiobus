import { EVENT_CONFIGURATION_CHANGED, EVENT_INPUT } from "../../event-constants"
import { devicePanel } from "../../io/device-controls"
import { SYNTH_303_PARAMETERS, type Synth303Settings } from "./parameters"

type Parameter = keyof Synth303Settings
interface Synth303Controls extends EventTarget {
	readonly options: Synth303Settings
	configure(patch: Partial<Synth303Settings>): void
}

export function create303Gui(device: Synth303Controls, signal: AbortSignal): HTMLElement {
	const host = devicePanel()
	const root = host.attachShadow({ mode: "open" })
	const style = document.createElement("style")
	style.textContent = `
		:host { display:block; container-type:inline-size; width:100%; color:#242723; font:12px Arial,sans-serif; color-scheme:light; }
		* { box-sizing:border-box; }
		.panel { border:1px solid #8e938d; border-bottom:7px solid #71756e; border-radius:9px;
			padding:18px; background:repeating-linear-gradient(0deg,#ffffff08 0 1px,#00000003 1px 2px),
			linear-gradient(120deg,#e5e6df,#bdc2ba 65%,#d8dbd2); box-shadow:inset 0 1px #fff9,0 3px 8px #0003; }
		header { display:flex; justify-content:space-between; align-items:center; gap:12px;
			border-bottom:4px solid #bd4b2f; padding-bottom:10px; }
		h2 { font-size:38px; line-height:1; letter-spacing:-.065em; margin:0; }
		.identity { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
		.subtitle { font-size:12px; letter-spacing:.14em; font-weight:800; }
		.model { font-size:9px; text-transform:uppercase; letter-spacing:.12em; text-align:right; line-height:1.5; }
		section { margin-top:16px; }
		h3 { margin:0 0 12px; font-size:9px; letter-spacing:.16em; text-transform:uppercase; }
		.tone { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; }
		.control { display:flex; flex-direction:column; align-items:center; gap:9px; min-width:0; }
		.caption { font-size:9px; font-weight:800; letter-spacing:.025em; text-transform:uppercase; text-align:center; min-height:22px; }
		.fader { display:flex; justify-content:center; width:100%; padding:6px 0; border-radius:4px;
			background:repeating-linear-gradient(to top,transparent 0 13px,#555b5040 13px 14px) center / 34px 100% no-repeat; }
		input[type=range] { appearance:none; background:transparent; cursor:pointer; margin:0; }
		.vertical { writing-mode:vertical-lr; direction:rtl; width:32px; height:124px; }
		input::-webkit-slider-runnable-track { background:#42473e; border:1px solid #20271e; border-radius:3px; box-shadow:inset 1px 1px 2px #0008; }
		.vertical::-webkit-slider-runnable-track { width:5px; }
		input::-webkit-slider-thumb { appearance:none; width:27px; height:13px; border:1px solid #141a12; border-radius:2px;
			background:linear-gradient(#4b5147 0 43%,#eee9d5 43% 57%,#252b22 57%); box-shadow:1px 2px 3px #0006; margin-left:-12px; }
		input::-moz-range-track { background:#42473e; border:1px solid #20271e; border-radius:3px; }
		.vertical::-moz-range-track { width:5px; }
		input::-moz-range-thumb { width:27px; height:13px; border:1px solid #141a12; border-radius:2px;
			background:linear-gradient(#4b5147 0 43%,#eee9d5 43% 57%,#252b22 57%); }
		input:focus-visible,summary:focus-visible,a:focus-visible { outline:2px solid #99321d; outline-offset:4px; border-radius:2px; }
		output { font:10px ui-monospace,monospace; font-variant-numeric:tabular-nums; white-space:nowrap; }
		.utility { display:grid; grid-template-columns:1fr 1fr; gap:18px; border-top:2px solid #4c5147; padding-top:13px; }
		.horizontal { width:100%; height:24px; }
		.horizontal::-webkit-slider-runnable-track { height:5px; }
		.horizontal::-webkit-slider-thumb { width:13px; height:23px; margin-left:0; margin-top:-10px;
			background:linear-gradient(90deg,#4b5147 0 42%,#eee9d5 42% 58%,#252b22 58%); }
		.horizontal::-moz-range-track { height:5px; }
		.horizontal::-moz-range-thumb { width:13px; height:23px;
			background:linear-gradient(90deg,#4b5147 0 42%,#eee9d5 42% 58%,#252b22 58%); }
		.utility .control,.effects .control { align-items:stretch; gap:5px; }
		.utility .caption,.effects .caption { min-height:0; text-align:left; }
		.utility output,.effects output { text-align:right; }
		.wave-labels { display:flex; justify-content:space-between; font-size:9px; font-weight:bold; }
		details { border-top:1px solid #747b6c; margin-top:16px; padding-top:11px; }
		summary { cursor:pointer; font-size:10px; font-weight:bold; text-transform:uppercase; letter-spacing:.08em; }
		.effects { display:grid; grid-template-columns:repeat(auto-fit,minmax(105px,1fr)); gap:16px; margin-top:16px; }
		footer { border-top:1px solid #747b6c; margin-top:14px; padding-top:10px; font-size:10px; line-height:1.6; color:#454c40; }
		footer p { margin:0 0 5px; } a { color:inherit; text-underline-offset:3px; }
		@container(max-width:420px) { .tone { grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px 8px; } .panel { padding:14px; } }
	`
	const panel = document.createElement("div")
	panel.className = "panel"
	panel.setAttribute("role", "group")
	panel.setAttribute("aria-label", "303 bass synthesizer")
	panel.innerHTML = `
		<header><div class="identity"><h2>303</h2><span class="subtitle">BASS LINE</span></div><span class="model">TB-303 inspired<br>Wavetable synthesizer</span></header>
		<section aria-label="Tone controls"><h3>Tone / filter</h3><div class="tone"></div></section>
		<section class="utility" aria-label="Waveform and output"></section>
		<details><summary>Distortion &amp; delay</summary><div class="effects"></div></details>
		<footer><p>Overlap notes for slide. Velocity 100–127 adds accent.</p><a href="https://github.com/designerzen/audiobus/blob/ts2wp2es6pug/source/code/typescript/audiobus/instruments/TB303/TB303.ts" target="_blank" rel="noopener noreferrer">Original AudioBus synth by Emil Loer · GPL-3.0-or-later</a></footer>
	`
	const updates: Array<() => void> = []
	const control = (id: Parameter, title: string, parent: Element, vertical = false) => {
		const config = SYNTH_303_PARAMETERS[id]
		const label = document.createElement("label")
		label.className = "control"
		const caption = document.createElement("span")
		caption.className = "caption"
		caption.textContent = title
		const input = document.createElement("input")
		input.type = "range"
		input.name = id
		input.className = vertical ? "vertical" : "horizontal"
		input.setAttribute("aria-label", config.label)
		if (vertical) input.setAttribute("aria-orientation", "vertical")
		const logarithmic = id === "cutoff"
		input.min = String(logarithmic ? 0 : config.minValue)
		input.max = String(logarithmic ? 1 : config.maxValue)
		input.step = String(logarithmic ? 0.001 : config.step)
		const value = document.createElement("output")
		const update = () => {
			const raw = device.options[id]
			input.value = String(
				logarithmic
					? Math.log(raw / config.minValue) / Math.log(config.maxValue / config.minValue)
					: raw
			)
			value.value =
				id === "waveform"
					? raw === 0
						? "Saw"
						: "Square"
					: id === "cutoff"
						? `${Math.round(raw)} Hz`
						: id === "decay"
							? `${Math.round(raw)} ms`
							: id === "delayTime"
								? `${raw.toFixed(2)} s`
								: id === "tuning"
									? `${raw > 0 ? "+" : ""}${raw.toFixed(2)} st`
									: `${Math.round(raw * 100)}%`
			input.setAttribute("aria-valuetext", value.value)
		}
		input.addEventListener(
			EVENT_INPUT,
			() => {
				const position = Number(input.value)
				const raw = logarithmic
					? config.minValue * (config.maxValue / config.minValue) ** position
					: position
				device.configure({ [id]: Math.round(raw / config.step) * config.step })
			},
			{ signal }
		)
		label.append(caption)
		if (vertical) {
			const track = document.createElement("div")
			track.className = "fader"
			track.append(input)
			label.append(track)
		} else label.append(input)
		if (id === "waveform") {
			const choices = document.createElement("span")
			choices.className = "wave-labels"
			choices.setAttribute("aria-hidden", "true")
			choices.innerHTML = "<span>SAW ↗</span><span>SQUARE ⊓</span>"
			label.append(choices)
		}
		label.append(value)
		parent.append(label)
		updates.push(update)
		update()
	}
	const tone = panel.querySelector(".tone")!
	for (const [id, label] of [
		["tuning", "Tuning"],
		["cutoff", "Cut off freq"],
		["resonance", "Resonance"],
		["envMod", "Env mod"],
		["decay", "Decay"],
		["accent", "Accent"]
	] as const) {
		control(id, label, tone, true)
	}
	const utility = panel.querySelector(".utility")!
	control("waveform", "Waveform", utility)
	control("volume", "Volume", utility)
	const effects = panel.querySelector(".effects")!
	for (const [id, label] of [
		["threshold", "Distortion"],
		["shape", "Foldback shape"],
		["delaySend", "Delay send"],
		["delayTime", "Delay time"],
		["delayFeedback", "Feedback"]
	] as const) {
		control(id, label, effects)
	}
	device.addEventListener(
		EVENT_CONFIGURATION_CHANGED,
		() => updates.forEach((update) => update()),
		{ signal }
	)
	root.append(style, panel)
	return host
}