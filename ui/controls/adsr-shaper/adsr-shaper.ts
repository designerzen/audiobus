import {
	EVENT_CHANGE,
	EVENT_INPUT,
	EVENT_KEY_DOWN,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_MOVE,
	EVENT_POINTER_UP,
	EVENT_POINTER_CANCEL,
	EVENT_LOST_POINTER_CAPTURE
} from "../../../event-constants.ts"

export const ADSR_STAGES = ["attack", "decay", "sustain", "release"] as const
export type AdsrStage = (typeof ADSR_STAGES)[number]
export type AdsrValue = Record<AdsrStage, number>
const DEFAULTS: AdsrValue = { attack: 0.01, decay: 0.2, sustain: 0.65, release: 0.15 }

/** Audio-independent envelope editor. Programmatic value updates are silent;
 * user edits emit bubbling, composed input/change events with an AdsrValue detail.
 * Time limits can be set with attack-max, decay-max and release-max attributes.
 */
export class AdsrShaper extends HTMLElement {
	static observedAttributes = [...ADSR_STAGES, "attack-max", "decay-max", "release-max"]
	private root = this.attachShadow({ mode: "open" })
	private state = { ...DEFAULTS }
	private inputs = new Map<AdsrStage, HTMLInputElement>()
	private handles = new Map<AdsrStage, HTMLButtonElement>()
	private knobs = new Map<AdsrStage, HTMLInputElement>()
	private graph: HTMLElement
	private line: SVGPathElement
	private fill: SVGPathElement
	private noteOff: SVGLineElement
	private drag?: {
		id: number
		knob?: boolean
		stage: AdsrStage
		x: number
		y: number
		value: AdsrValue
		width: number
		height: number
	}

	constructor() {
		super()
		this.root.innerHTML = `
		<style>
		:host { display:block; min-width:0; --envelope-accent:var(--instrument-color, var(--node-accent, var(--color-accent, currentColor))); font:inherit; background:#2d2d2d; color:#ccc; border-radius:6px; padding:10px 12px; }
		* { box-sizing:border-box; }
		.title { text-align:center; color:var(--envelope-accent); font-size:.9em; margin:0 0 8px; font-weight:600; }
		.graph { position:relative; height:clamp(180px, 40vw, 250px); border-bottom:1px solid #666; }
		svg { width:100%; height:100%; display:block; overflow:visible; }
		.grid { stroke:currentColor; opacity:.12; stroke-width:1; }
		.line { fill:none; stroke:var(--envelope-accent); stroke-width:2.5; stroke-linejoin:round; }
		.fill { display:none; }
		.off { display:none; }
		.handle { position:absolute; width:36px; height:36px; transform:translate(-50%,-50%); border:0; padding:0; background:transparent; color:var(--envelope-accent); cursor:grab; touch-action:none; }
		.handle span { display:grid; place-items:center; width:22px; height:22px; margin:auto; background:var(--envelope-accent); color:#202020; border-radius:50%; font:16px/1 sans-serif; }
		.handle:hover span { transform:scale(1.12); }
		.handle:focus-visible { outline:2px solid currentColor; border-radius:5px; }
		.handle:active { cursor:grabbing; }
		.values { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.5rem; margin-top:16px; }
		label { display:grid; justify-items:center; gap:4px; min-width:0; font-size:.85em; }
		.entry { display:flex; align-items:center; gap:.2em; font-size:.8em; width:100%; }
		.knob { position:relative; width:clamp(38px,12vw,62px); aspect-ratio:1; border-radius:50%; background:conic-gradient(from 225deg, var(--envelope-accent) calc(var(--position)*270deg), #444 0 270deg, transparent 0); padding:5px; }
		.knob::before { content:""; position:absolute; inset:7px; border-radius:50%; background:linear-gradient(135deg,#fff,#aaa); border:3px solid #202020; box-shadow:0 2px 4px #111; }
		.needle { position:absolute; inset:0; transform:rotate(calc(-135deg + var(--position)*270deg)); pointer-events:none; }
		.needle::after { content:""; position:absolute; left:calc(50% - 1.5px); top:14%; width:3px; height:22%; border-radius:1px; background:#222; }
		.knob input { position:absolute; inset:0; opacity:0; cursor:ns-resize; touch-action:none; width:100%; height:100%; margin:0; }
		.knob:focus-within { outline:2px solid var(--envelope-accent); outline-offset:3px; }
		input { width:100%; min-width:0; min-height:28px; border:1px solid color-mix(in srgb,currentColor 30%,transparent); border-radius:4px; padding:.3rem; background:transparent; color:inherit; font:inherit; }
		.hint { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
		.axis { display:none; position:absolute; bottom:3px; font-size:10px; opacity:.65; pointer-events:none; }
		.on { left:4%; } .end { right:4%; }

		</style>
		<div class="title">ADSR</div>
		<div class="graph" part="graph">
		<svg viewBox="0 0 560 180" preserveAspectRatio="none" aria-hidden="true">
		<path class="grid" d="M0 24H560 M0 54H560 M0 84H560 M0 114H560 M0 144H560"/>
		<path class="fill"/><line class="off" y1="20" y2="148"/><path class="line"/>
		</svg><span class="axis on">Note on</span><span class="axis end">Time →</span></div>
		<div class="values" part="controls"></div>
		<p class="hint">Drag points to shape the sound. Decay also sets sustain. Dashed line: note off. Short stages are widened for editing.</p>`
		this.graph = this.root.querySelector(".graph")!
		this.line = this.root.querySelector(".line")!
		this.fill = this.root.querySelector(".fill")!
		this.noteOff = this.root.querySelector(".off")!
		for (const stage of ADSR_STAGES) {
			const name = stage[0].toUpperCase() + stage.slice(1)
			const handle = document.createElement("button")
			handle.type = "button"
			handle.className = "handle"
			const letter = document.createElement("span")
			letter.textContent = name[0]
			letter.setAttribute("aria-hidden", "true")
			handle.append(letter)
			handle.dataset.stage = stage
			handle.setAttribute("aria-label", `${name} point`)
			handle.title = `${name}: drag or use arrow keys; Shift for fine adjustment`
			handle.addEventListener(EVENT_POINTER_DOWN, (event) => this.begin(event, stage))
			handle.addEventListener(EVENT_KEY_DOWN, (event) => {
				if (
					!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(
						event.key
					)
				) {
					return
				}
				event.preventDefault()
				const delta = ["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 1
				const next =
					event.key === "Home"
						? 0
						: event.key === "End"
							? this.max(stage)
							: this.state[stage] + delta * (event.shiftKey ? 0.01 : 0.1)
				this.edit({ [stage]: next })
				this.emit(EVENT_CHANGE)
			})
			this.graph.append(handle)
			this.handles.set(stage, handle)
			const label = document.createElement("label")
			label.title = name
			const knob = document.createElement("span")
			knob.className = "knob"
			const needle = document.createElement("span")
			needle.className = "needle"
			const dial = document.createElement("input")
			dial.type = "range"
			dial.min = "0"
			dial.setAttribute("aria-label", `${name} dial`)
			dial.addEventListener(EVENT_INPUT, (event) => {
				event.stopPropagation()
				this.edit({ [stage]: dial.valueAsNumber })
			})
			dial.addEventListener(EVENT_CHANGE, (event) => {
				event.stopPropagation()
				this.emit(EVENT_CHANGE)
			})
			dial.addEventListener(EVENT_POINTER_DOWN, (event) => {
				if (this.drag || event.button !== 0) {
					return
				}
				event.preventDefault()
				dial.focus()
				dial.setPointerCapture(event.pointerId)
				this.drag = {
					id: event.pointerId,
					knob: true,
					stage,
					x: event.clientX,
					y: event.clientY,
					value: this.value,
					width: 1,
					height: 1
				}
			})
			knob.append(needle, dial)
			const caption = document.createElement("span")
			caption.textContent = name[0]
			label.append(knob, caption)
			this.knobs.set(stage, dial)
			const entry = document.createElement("span")
			entry.className = "entry"
			const input = document.createElement("input")
			input.type = "number"
			input.name = stage
			input.min = "0"
			input.setAttribute("aria-label", name)
			input.addEventListener(EVENT_INPUT, (event) => {
				event.stopPropagation()
				if (Number.isFinite(input.valueAsNumber)) {
					this.edit({ [stage]: input.valueAsNumber / (stage === "sustain" ? 100 : 1) })
				}
			})
			input.addEventListener(EVENT_CHANGE, (event) => {
				event.stopPropagation()
				this.render()
				this.emit(EVENT_CHANGE)
			})
			const unit = document.createElement("span")
			unit.textContent = stage === "sustain" ? "%" : "s"
			entry.append(input, unit)
			label.append(entry)
			this.root.querySelector(".values")!.append(label)
			this.inputs.set(stage, input)
		}
		this.root.addEventListener(
			EVENT_POINTER_MOVE,
			(raw) => {
				const event = raw as PointerEvent
				const drag = this.drag
				if (!drag || event.pointerId !== drag.id) {
					return
				}
				if (drag.knob) {
					const delta = (drag.y - event.clientY) / (event.shiftKey ? 1600 : 160)
					this.edit({
						[drag.stage]: drag.value[drag.stage] + delta * this.max(drag.stage)
					})
					return
				}
				const dx = ((event.clientX - drag.x) * 560) / drag.width
				const dy = ((event.clientY - drag.y) * 180) / drag.height / 120
				const patch: Partial<AdsrValue> =
					drag.stage === "sustain"
						? { sustain: drag.value.sustain - dy }
						: {
								[drag.stage]:
									this.max(drag.stage) *
									Math.max(
										0,
										Math.sqrt(drag.value[drag.stage] / this.max(drag.stage)) +
											dx / 106
									) **
										2
							}
				if (drag.stage === "decay") {
					patch.sustain = drag.value.sustain - dy
				}
				this.edit(patch)
			},
			true
		)
		for (const type of [EVENT_POINTER_UP, EVENT_POINTER_CANCEL, EVENT_LOST_POINTER_CAPTURE]) {
			this.root.addEventListener(
				type,
				(event) => {
					if ((event as PointerEvent).pointerId !== this.drag?.id) {
						return
					}
					this.drag = undefined
					this.emit(EVENT_CHANGE)
				},
				true
			)
		}
		this.render()
	}

	get value(): AdsrValue {
		return { ...this.state }
	}
	set value(value: Partial<AdsrValue>) {
		for (const stage of ADSR_STAGES) {
			const next = value[stage]
			if (typeof next === "number" && Number.isFinite(next)) {
				this.state[stage] =
					Math.round(Math.max(0, Math.min(this.max(stage), next)) * 100) / 100
			}
		}
		this.render()
	}
	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (ADSR_STAGES.includes(name as AdsrStage)) {
			this.value = { [name]: value === null ? DEFAULTS[name as AdsrStage] : Number(value) }
		} else {
			this.value = this.state
		}
	}
	disconnectedCallback() {
		this.drag = undefined
	}
	private max(stage: AdsrStage) {
		if (stage === "sustain") {
			return 1
		}
		const value = Number(this.getAttribute(`${stage}-max`) ?? (stage === "release" ? 8 : 4))
		return Number.isFinite(value) && value > 0 ? value : 4
	}
	private begin(event: PointerEvent, stage: AdsrStage) {
		if (this.drag || event.button !== 0) {
			return
		}
		event.preventDefault()
		const rect = this.graph.getBoundingClientRect()
		if (!rect.width || !rect.height) {
			return
		}
		this.handles.get(stage)!.focus()
		this.graph.setPointerCapture(event.pointerId)
		this.drag = {
			id: event.pointerId,
			stage,
			x: event.clientX,
			y: event.clientY,
			value: this.value,
			width: rect.width,
			height: rect.height
		}
	}
	private edit(patch: Partial<AdsrValue>) {
		this.value = patch
		this.emit(EVENT_INPUT)
	}
	private emit(type: string) {
		this.dispatchEvent(
			new CustomEvent(type, { detail: this.value, bubbles: true, composed: true })
		)
	}
	private render() {
		const { attack, decay, sustain, release } = this.state
		// Fixed square-root scales make short times easy to edit without moving the
		// time scale underneath the pointer. The sustain hold is illustrative.
		const width = (stage: AdsrStage, value: number) =>
			40 + 106 * Math.sqrt(value / this.max(stage))
		const a = 24 + width("attack", attack),
			d = a + width("decay", decay),
			s = d + 72,
			r = s + width("release", release)
		const y = 144 - sustain * 120
		const path = `M24 144 L${a} 24 C${a + (d - a) * 0.18} ${y} ${a + (d - a) * 0.45} ${y} ${d} ${y} L${s} ${y} C${s + (r - s) * 0.18} 144 ${s + (r - s) * 0.45} 144 ${r} 144`
		this.line.setAttribute("d", path)
		this.fill.setAttribute("d", `${path} Z`)
		this.noteOff.setAttribute("x1", String(s))
		this.noteOff.setAttribute("x2", String(s))
		const points = { attack: [a, 24], decay: [d, y], sustain: [s, y], release: [r, 144] }
		for (const stage of ADSR_STAGES) {
			const input = this.inputs.get(stage)!
			const percent = stage === "sustain"
			input.max = String(this.max(stage) * (percent ? 100 : 1))
			input.step = percent ? "1" : "0.01"
			const displayed = percent ? Math.round(this.state[stage] * 100) : this.state[stage]
			if (input.valueAsNumber !== displayed) {
				input.value = String(displayed)
			}
			const text = percent
				? `${Math.round(this.state[stage] * 100)}%`
				: `${this.state[stage].toFixed(2)} s`
			const dial = this.knobs.get(stage)!
			dial.max = String(this.max(stage))
			dial.step = "0.01"
			dial.value = String(this.state[stage])
			dial.setAttribute("aria-valuetext", text)
			dial.parentElement!.style.setProperty(
				"--position",
				String(this.state[stage] / this.max(stage))
			)
			input.setAttribute("aria-valuetext", text)
			const handle = this.handles.get(stage)!
			handle.style.left = `${(points[stage][0] / 560) * 100}%`
			handle.style.top = `${(points[stage][1] / 180) * 100}%`
			handle.setAttribute(
				"aria-label",
				`${stage[0].toUpperCase() + stage.slice(1)} point: ${text}`
			)
		}
	}
}

if (!customElements.get("adsr-shaper")) {
	customElements.define("adsr-shaper", AdsrShaper)
}