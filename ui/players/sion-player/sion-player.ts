// oxlint-disable-next-line typescript/triple-slash-reference -- Bundler asset declarations.
/// <reference path="./assets.d.ts" />
import { EVENT_BLUR, EVENT_CHANGE, EVENT_CLICK, EVENT_INPUT, EVENT_KEY_DOWN, EVENT_KEY_UP, EVENT_LOST_POINTER_CAPTURE, EVENT_PAGE_HIDE, EVENT_POINTER_CANCEL, EVENT_POINTER_DOWN, EVENT_POINTER_UP, EVENT_SION_ENDED, EVENT_SION_ERROR, EVENT_SION_PLAY, EVENT_SION_READY, EVENT_SION_STOP, EVENT_VISIBILITY_CHANGE } from "../../../event-constants.ts"
import styles from "./sion-player.css?inline"
import { examples } from "./sion-examples.mjs"
import { SiONDAW } from "./sion-daw.ts"
import { registerAudioContextOutput } from "../../interfaces/audio-context-output.ts"
import type { SiONDriver, SiONPresetVoice } from "./engine/sion/index.js"
import type { SiONAudioHost } from "./engine/SiONAudioHost.js"

const notes = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B", "C"]
const keys = [
    "KeyZ",
    "KeyS",
    "KeyX",
    "KeyD",
    "KeyC",
    "KeyV",
    "KeyG",
    "KeyB",
    "KeyH",
    "KeyN",
    "KeyJ",
    "KeyM",
    "Comma",
]

/** A self-contained frontend for the original SiON engine. Audio starts on interaction. */
export class SiONPlayer extends HTMLElement {
    private static owner?: SiONPlayer
    private static initializationQueue: Promise<void> = Promise.resolve()
    private root = this.attachShadow({ mode: "open" })
    private listeners?: AbortController
    private context?: AudioContext
    private audio?: SiONAudioHost
    private output?: GainNode
    /** Optional procedural score preparation, using this player's audio lifecycle. */
    sessionFactory?: (driver: SiONDriver) => void
    get position() {
        return this.driver?.position ?? 0
    }
    get isPlaying() {
        return this.driver?.isPlaying ?? false
    }
    get outputNode() {
        return this.output ?? null
    }
    private driver?: SiONDriver
    private presets?: SiONPresetVoice
    private initializing?: Promise<void>
    private held = new Map<string, number>()
    private command = 0
    private poll?: ReturnType<typeof setInterval>

    connectedCallback() {
        if (!this.root.childElementCount) this.render()
        this.listeners = new AbortController()
        const options = { signal: this.listeners.signal }
        if (this.hasAttribute("transport-only")) {
            this.get("#play").addEventListener(EVENT_CLICK, () => void this.play(), options)
            this.get("#stop").addEventListener(EVENT_CLICK, () => this.stop(), options)
            this.get<HTMLInputElement>("#volume").addEventListener(
                EVENT_INPUT,
                () => {
                    const value = Number(this.get<HTMLInputElement>("#volume").value)
                    this.get<HTMLOutputElement>("#volume-value").value = value + "%"
                    if (this.driver) this.driver.volume = value / 100
                },
                options,
            )
            document.addEventListener(
                EVENT_VISIBILITY_CHANGE,
                () => {
                    if (document.hidden) this.stop()
                },
                options,
            )
            window.addEventListener(EVENT_PAGE_HIDE, () => this.dispose(), options)
            this.poll = setInterval(() => {
                if (
                    this.driver &&
                    !this.driver.isPlaying &&
                    this.get("#play").hasAttribute("data-playing")
                ) {
                    this.get("#play").removeAttribute("data-playing")
                    this.status("Playback finished.")
                    this.dispatchEvent(new CustomEvent(EVENT_SION_ENDED))
                }
            }, 100)
            return
        }
        new SiONDAW(
            this.get("#daw"),
            (mml) => this.play(mml),
            () => this.stop(),
            (message, error) => this.status(message, error),
            this.listeners.signal,
        )
        this.get<HTMLButtonElement>("#play").addEventListener(
            EVENT_CLICK,
            () => void this.play(),
            options,
        )
        this.get<HTMLButtonElement>("#stop").addEventListener(EVENT_CLICK, () => this.stop(), options)
        this.get<HTMLSelectElement>("#example").addEventListener(
            EVENT_CHANGE,
            () => {
                const example = examples[Number(this.get<HTMLSelectElement>("#example").value)]!
                this.get<HTMLTextAreaElement>("#mml").value = example.mml
                this.get("#example-description").textContent = example.description
                this.status("Example loaded. Press Play to hear it.")
            },
            options,
        )
        this.get<HTMLInputElement>("#volume").addEventListener(
            EVENT_INPUT,
            () => {
                const value = Number(this.get<HTMLInputElement>("#volume").value)
                this.get<HTMLOutputElement>("#volume-value").value = value + "%"
                if (this.driver) this.driver.volume = value / 100
            },
            options,
        )
        this.get<HTMLSelectElement>("#octave").addEventListener(
            EVENT_CHANGE,
            () => this.releaseNotes(),
            options,
        )
        this.get<HTMLSelectElement>("#voice").addEventListener(
            EVENT_CHANGE,
            () => this.releaseNotes(),
            options,
        )
        this.root.addEventListener(
            EVENT_KEY_DOWN,
            (event) => this.keyEvent(event as KeyboardEvent, true),
            options,
        )
        this.root.addEventListener(
            EVENT_KEY_UP,
            (event) => this.keyEvent(event as KeyboardEvent, false),
            options,
        )
        for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-note]")) {
            button.addEventListener(
                EVENT_POINTER_DOWN,
                (event) => {
                    if (event.button !== 0) return
                    event.preventDefault()
                    button.focus()
                    button.setPointerCapture(event.pointerId)
                    void this.startNote("pointer:" + event.pointerId, Number(button.dataset.note))
                },
                options,
            )
            for (const type of [EVENT_POINTER_UP, EVENT_POINTER_CANCEL, EVENT_LOST_POINTER_CAPTURE]) {
                button.addEventListener(
                    type,
                    (event) => this.endNote("pointer:" + (event as PointerEvent).pointerId),
                    options,
                )
            }
        }
        window.addEventListener(EVENT_BLUR, () => this.releaseNotes(), options)
        document.addEventListener(
            EVENT_VISIBILITY_CHANGE,
            () => {
                if (document.hidden) this.stop()
            },
            options,
        )
        window.addEventListener(EVENT_PAGE_HIDE, () => this.dispose(), options)
        this.poll = setInterval(() => {
            if (this.driver?.isPlaying && this.get("#play").hasAttribute("data-playing")) {
                this.status(
                    this.context?.state === "running"
                        ? `Playing score. ${Math.max(0, this.driver.position / 1000).toFixed(1)} s`
                        : "Audio paused. Press Play to resume.",
                )
            }
            if (
                this.driver &&
                !this.driver.isPlaying &&
                this.get("#play").hasAttribute("data-playing")
            ) {
                this.get("#play").removeAttribute("data-playing")
                this.status("Playback finished.")
            }
        }, 250)
    }

    disconnectedCallback() {
        this.listeners?.abort()
        clearInterval(this.poll)
        this.dispose()
    }

    private get<T extends Element = HTMLElement>(selector: string): T {
        return this.root.querySelector<T>(selector)!
    }

    private render() {
        if (this.hasAttribute("transport-only")) {
            this.root.innerHTML = `<style>${styles}</style><div class="panel"><div class="toolbar">
                <button id="play" class="primary" type="button">▶ Play song</button>
                <button id="stop" type="button">■ Stop</button>
                <label for="volume">Volume</label><input id="volume" type="range" min="0" max="100" value="35" aria-describedby="volume-value">
                <output id="volume-value" for="volume">35%</output>
                </div><p id="status" class="status" role="status" aria-live="polite">Ready. Press Play to enable audio.</p></div>`
            return
        }
        this.root.innerHTML = `<style>${styles}</style>
      <div class="panel">
        <section id="daw" aria-label="SiON multitrack DAW"></section>
        <details><summary>Advanced: MML score editor &amp; keyboard</summary>
        <section aria-labelledby="score-title">
          <h2 id="score-title">MML editor</h2>
          <p>Compose a score using Music Macro Language, or start with an example.</p>
          <div class="toolbar"><label class="field grow">Example
            <select id="example" aria-describedby="example-description">${[...new Set(examples.map((example) => example.category))].map((category) => `<optgroup label="${category}">${examples.map((example, i) => (example.category === category ? `<option value="${i}">${example.name}</option>` : "")).join("")}</optgroup>`).join("")}</select>
          </label></div>
          <p id="example-description" class="hint">${examples[0]!.description}</p>
          <label for="mml">Your score</label>
          <textarea id="mml" spellcheck="false" aria-describedby="mml-help"></textarea>
          <p id="mml-help" class="hint">The score sets its own tempo and instruments. The voice selector below applies to the keyboard.</p>
          <div class="toolbar">
            <button id="play" class="primary" type="button">▶ Play score</button>
            <button id="stop" type="button">■ Stop all sound</button>
          </div>
          <p id="status" class="status" role="status" aria-live="polite">Ready. Play a score or press a piano key to enable audio.</p>
        </section>
        <section aria-labelledby="keyboard-title">
          <h2 id="keyboard-title">Play a voice</h2>
          <div class="toolbar">
            <label class="field grow">Instrument<select id="voice"><option value="">Default SiON voice</option></select></label>
            <label class="field">Octave<select id="octave">${[2, 3, 4, 5, 6].map((i) => `<option ${i === 4 ? "selected" : ""}>${i}</option>`).join("")}</select></label>
          </div>
          <div class="keyboard" role="group" aria-label="Piano keyboard">${notes.map((note, i) => `<button class="key ${note.includes("♯") ? "black" : ""}" type="button" data-note="${i}" aria-label="${note}${i === 12 ? ", upper octave" : ""}" aria-pressed="false"><span>${note}</span><kbd>${keys[i] === "Comma" ? "," : keys[i]!.slice(3)}</kbd></button>`).join("")}</div>
          <p class="hint">Hold a key with your mouse or touch, or focus the keyboard and play Z–M (S, D, G, H and J are the sharps). Enter and Space play the focused key.</p>
        </section>
        <details><summary>MML quick reference</summary><ul>
          <li><code>c d e f g a b</code> play notes; <code>r</code> adds a rest.</li>
          <li><code>t120</code> sets tempo; <code>o5</code> sets octave; <code>l8</code> sets eighth notes.</li>
          <li><code>c4</code> is a quarter note; <code>c+</code> is C sharp.</li>
          <li><code>&lt;</code> and <code>&gt;</code> change octave; <code>;</code> separates tracks.</li>
        </ul></details></details>
      </div>`
        this.get<HTMLTextAreaElement>("#mml").value = this.getAttribute("mml") ?? examples[0]!.mml
    }

    private async enableAudio() {
        if (!this.isConnected) throw new DOMException("Player disconnected", "AbortError")
        if (!this.initializing && !this.driver) {
            SiONPlayer.owner?.dispose()
            SiONPlayer.owner = this
            this.status("Loading SiON…")
            const context = (this.context = new AudioContext())
            // Resume in the original user gesture, before the dynamic import resolves.
            const resumed = context.resume()
            const initialize = async () => {
                await resumed
                if (!this.isConnected || this.context !== context) return
                const libraryURL = this.getAttribute("library-url")
                const { loadSiON } = (libraryURL ? await import(
                    /* @vite-ignore */ libraryURL
                ) : await import("./engine/SiON.js")) as typeof import("./engine/SiON.js")
                if (!this.isConnected || this.context !== context) return
                this.output = context.createGain()
                this.output.connect(context.destination)
                registerAudioContextOutput(context, this.output)
                const library = await loadSiON(context, this.output)
                this.audio = library.audio
                this.audio!.onError = (error) => {
                    this.stop()
                    this.report(error)
                }
                this.driver = library.SiONDriver.mutex ?? new library.SiONDriver()
                this.driver.debugMode = true
                this.driver.volume = Number(this.get<HTMLInputElement>("#volume").value) / 100
                this.presets = library.SiONPresetVoice.mutex ?? new library.SiONPresetVoice()
                const selector = this.get<HTMLSelectElement>("#voice")
                if (selector) {
                    selector.replaceChildren(new Option("Default SiON voice", ""))
                    for (const name of Object.keys(this.presets).sort()) {
                        if (
                            !name.startsWith("_") &&
                            this.presets[name] instanceof library.SiONVoice
                        )
                            selector.add(new Option(name, name))
                    }
                }
                this.status("Audio ready.")
                this.dispatchEvent(new CustomEvent(EVENT_SION_READY, { bubbles: true, composed: true }))
            }
            this.initializing = SiONPlayer.initializationQueue
                .then(initialize)
                .catch((error) => {
                    this.dispose()
                    throw error
                })
                .finally(() => {
                    this.initializing = undefined
                })
            SiONPlayer.initializationQueue = this.initializing.catch(() => {})
        }
        await this.initializing
        if (!this.driver || !this.context)
            throw new DOMException("Player stopped while loading", "AbortError")
        await this.context.resume()
    }

    /** Play MML supplied by the caller, or the current editor contents. */
    async play(mml = this.get<HTMLTextAreaElement>("#mml")?.value ?? "") {
        const command = ++this.command
        try {
            if (!this.sessionFactory && !mml.trim())
                throw new Error("Enter a score before playing.")
            await this.enableAudio()
            if (command !== this.command) return
            this.releaseNotes()
            this.driver!.stop()
            if (this.sessionFactory) this.sessionFactory(this.driver!)
            else {
                const data = this.driver!.compile(mml)
                this.driver!.autoStop = true
                this.driver!.play(data)
            }
            this.get("#play").setAttribute("data-playing", "")
            this.status("Playing score.")
            this.dispatchEvent(new CustomEvent(EVENT_SION_PLAY))
        } catch (error) {
            this.report(error)
        }
    }

    stop() {
        ++this.command
        this.releaseNotes()
        this.driver?.stop()
        this.get("#play")?.removeAttribute("data-playing")
        this.status("Stopped.")
        this.dispatchEvent(new CustomEvent(EVENT_SION_STOP))
    }

    private async startNote(token: string, offset: number) {
        if (this.held.has(token)) return
        const note = (Number(this.get<HTMLSelectElement>("#octave").value) + 1) * 12 + offset
        this.held.set(token, note)
        this.updateKeys()
        try {
            await this.enableAudio()
            if (this.held.get(token) !== note) return
            this.driver!.autoStop = false
            if (!this.driver!.isPlaying) this.driver!.play()
            const voice = this.get<HTMLSelectElement>("#voice").value
            this.driver!.noteOn(note, voice ? this.presets![voice] : null)
            this.status("Playing " + notes[offset] + ".")
        } catch (error) {
            this.endNote(token)
            this.report(error)
        }
    }

    private endNote(token: string) {
        const note = this.held.get(token)
        this.held.delete(token)
        if (note !== undefined && ![...this.held.values()].includes(note))
            this.driver?.noteOff(note)
        this.updateKeys()
    }

    private releaseNotes() {
        for (const token of this.held.keys()) this.endNote(token)
    }

    private updateKeys() {
        const base = (Number(this.get<HTMLSelectElement>("#octave").value) + 1) * 12
        for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-note]")) {
            button.setAttribute(
                "aria-pressed",
                String([...this.held.values()].includes(base + Number(button.dataset.note))),
            )
        }
    }

    private keyEvent(event: KeyboardEvent, down: boolean) {
        const target = event.target as HTMLElement
        if (
            target.matches("textarea, input, select") ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey
        )
            return
        let offset = keys.indexOf(event.code)
        if ((event.code === "Space" || event.code === "Enter") && target.dataset.note)
            offset = Number(target.dataset.note)
        if (offset < 0) return
        event.preventDefault()
        const token = "key:" + event.code
        if (down && !event.repeat) void this.startNote(token, offset)
        else if (!down) this.endNote(token)
    }

    private status(message: string, error = false) {
        const status = this.get("#status")
        if (!status) return
        status.textContent = message
        status.toggleAttribute("data-error", error)
        const dawStatus = this.root.querySelector("[data-daw-status]")
        if (dawStatus) {
            dawStatus.textContent = message
            dawStatus.toggleAttribute("data-error", error)
        }
    }

    private report(error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return
        const message = error instanceof Error ? error.message : String(error)
        this.status(message, true)
        this.dispatchEvent(
            new CustomEvent(EVENT_SION_ERROR, { detail: { message }, bubbles: true, composed: true }),
        )
    }

    /** Release this player's audio resources. It can be enabled again by a gesture. */
    dispose() {
        this.stop()
        this.audio?.dispose()
        this.audio = undefined
        this.output?.disconnect()
        this.output = undefined
        this.driver = undefined
        this.presets = undefined
        const context = this.context
        this.context = undefined
        if (context && context.state !== "closed") void context.close().catch(() => {})
        if (SiONPlayer.owner === this) SiONPlayer.owner = undefined
    }
}

if (!customElements.get("sion-player")) customElements.define("sion-player", SiONPlayer)
