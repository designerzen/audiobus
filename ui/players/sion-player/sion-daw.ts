import { EVENT_CHANGE, EVENT_CLICK, EVENT_INPUT } from "../../../event-constants.ts"
import { createProject, instruments, parseProject, projectMML } from "./sion-daw-project.mjs"
import {
    composeSong,
    songProject,
    moodPresets,
    rhythmPresets,
    keyNames,
} from "./sion-song-builder.mjs"

const storageKey = "photosynth.sion-daw.v1"

/** Track editor sharing the playground's SiON driver and audio lifecycle. */
export class SiONDAW {
    private project = createProject()
    private tracks: HTMLElement
    private generated?: ReturnType<typeof composeSong>

    constructor(
        private root: HTMLElement,
        play: (mml: string) => Promise<void>,
        stop: () => void,
        private message: (message: string, error?: boolean) => void,
        signal: AbortSignal,
    ) {
        root.innerHTML = `
          <h2>Make a song</h2>
          <p>Choose a style and a feeling. Get a complete song with melody, chords, bass and drums.</p>
          <div class="toolbar">
            <label class="field grow">Style<select data-compose="groove">${rhythmPresets.map((style) => `<option value="${style.id}" ${style.id === "electronic" ? "selected" : ""}>${style.label}</option>`).join("")}</select></label>
            <label class="field grow">Feeling<select data-compose="mood">${moodPresets.map((mood) => `<option value="${mood.id}">${mood.emoji} ${mood.name}</option>`).join("")}</select></label>
          </div>
          <div class="toolbar">
            <button type="button" class="primary" data-action="compose">✨ Make &amp; play</button>
            <button type="button" data-action="play">▶ Play song</button>
            <button type="button" data-action="stop">■ Stop</button>
          </div>
          <p class="hint" data-song-description>Start with Make &amp; play, or play your current arrangement.</p>
          <div class="toolbar" aria-label="Song variations">
            <button type="button" data-action="melody" data-variation disabled>🎲 New melody</button>
            <button type="button" data-action="harmony" data-variation disabled>🎲 New harmony</button>
            <button type="button" data-action="sounds" data-variation disabled>🎲 New sounds</button>
          </div>
          <p class="hint">Variations keep your style, key and tempo. New harmony adapts the melody and bass too. Press Play song to hear an edit.</p>
          <div class="toolbar">
            <label for="volume">Volume</label><input id="volume" type="range" min="0" max="100" value="30" aria-describedby="volume-value"><output id="volume-value" for="volume">30%</output>
          </div>
          <p class="status" data-daw-status role="status" aria-live="polite">Ready. Choose a style, then Make &amp; play.</p>
          <details><summary>Fine-tune your song</summary><div class="toolbar">
            <label class="field">Key<select data-compose="key">${keyNames.map((key, i) => `<option value="${i}">${key}</option>`).join("")}</select></label>
            <label class="field">Energy<select data-compose="energy"><option value="35">Gentle</option><option value="65" selected>Balanced</option><option value="90">Driving</option></select></label>
            <label class="field">Length<select data-compose="length"><option value="short">Short song</option><option value="full">Full song</option></select></label>
          </div><p class="hint">The style sets the tempo and metre. Change the tempo below after generating. Melodies use repeating motifs, chord tones on strong beats, stepwise movement and phrase endings; the arrangement builds into a chorus.</p></details>
          <details data-advanced><summary>Edit tracks, mix &amp; save your project</summary>
          <h2>Mini DAW</h2>
          <p>Arrange independent MML parts and mix them into a SiON score.</p>
          <div class="toolbar">
            <label class="field">Tempo (BPM)<input data-project="tempo" type="number" min="30" max="300" required></label>
            <label class="field">Repeats<input data-project="repeats" type="number" min="1" max="8" required></label>
          </div>
          <p class="hint">Changes take effect on the next Play. Parts start together; pad shorter parts with rests to keep repeats aligned. Master volume is below the score editor.</p>
          <div class="daw-tracks"></div>
          <div class="toolbar">
            <button type="button" data-action="add">+ Add track</button>
            <button type="button" data-action="save">Save project</button>
            <button type="button" data-action="load">Open project</button>
            <button type="button" data-action="export">Export MML</button>
            <button type="button" data-action="demo">Reset demo</button>
            <input type="file" accept=".json,application/json" hidden aria-label="Open DAW project">
          </div>
          <details><summary>Writing a track</summary><p class="hint">Use <code>o5 l8 c e g r</code> for notes and rests, <code>[c e g e]4</code> to repeat, and <code>c+</code> for a sharp. One part per track, without <code>;</code>. Instrument, tempo, volume and pan are set before each part; MML commands inside the part can override them. Projects are saved in this browser as you edit; Save project downloads a backup.</p></details></details>`
        this.tracks = root.querySelector(".daw-tracks")!
        try {
            const saved = localStorage.getItem(storageKey)
            if (saved) {
                this.project = parseProject(saved)
                message("Restored your DAW project.")
            }
        } catch {
            message("A saved project could not be restored. The demo is available.")
        }
        this.render()
        root.addEventListener(
            EVENT_INPUT,
            (event) => {
                const input = event.target as HTMLInputElement
                if (input.type === "file") return
                if (input.dataset.project) {
                    if (!input.checkValidity()) return
                    this.project[input.dataset.project as "tempo" | "repeats"] = Number(input.value)
                } else {
                    const row = input.closest<HTMLElement>("[data-track]")
                    if (!row) return
                    const track = this.project.tracks[Number(row.dataset.track)]!
                    const field = input.dataset.field
                    if (field === "mute" || field === "solo") track[field] = input.checked
                    else if (field === "volume" || field === "pan" || field === "instrument")
                        track[field] = Number(input.value)
                    else if (field === "name" || field === "mml") track[field] = input.value
                    if (input.type === "range")
                        row.querySelector<HTMLOutputElement>(`[data-value="${field}"]`)!.value =
                            input.value
                }
                this.persist()
                this.describeSong()
            },
            { signal },
        )
        root.addEventListener(
            EVENT_CLICK,
            (event) => {
                const button = (event.target as Element).closest<HTMLButtonElement>(
                    "button[data-action]",
                )
                if (!button) return
                try {
                    switch (button.dataset.action) {
                        case "compose": {
                            stop()
                            const options = Object.fromEntries(
                                Array.from(
                                    root.querySelectorAll<HTMLSelectElement>("[data-compose]"),
                                ).map((input) => [input.dataset.compose!, input.value]),
                            )
                            this.generated = composeSong({ ...options, seed: crypto.randomUUID() })
                            this.project = songProject(this.generated)
                            this.changed()
                            this.describeSong()
                            void play(projectMML(this.project))
                            break
                        }
                        case "melody":
                        case "harmony": {
                            if (!this.generated) return
                            stop()
                            const previous = this.generated
                            const next = composeSong({
                                ...previous.settings,
                                seed: crypto.randomUUID(),
                                ...(button.dataset.action === "melody"
                                    ? {
                                          harmony: previous.chords.map((chord: string) =>
                                              keyNames.indexOf(chord.replace(/m$/, "")),
                                          ),
                                      }
                                    : {}),
                            })
                            const generatedProject = songProject(next)
                            this.project.tracks.forEach((track, index) => {
                                if (button.dataset.action === "harmony" || index === 0)
                                    track.mml = generatedProject.tracks[index]!.mml
                            })
                            this.generated =
                                button.dataset.action === "harmony"
                                    ? next
                                    : {
                                          ...previous,
                                          settings: next.settings,
                                          tracks: previous.tracks.map((track, i) =>
                                              i === 0 ? next.tracks[0]! : track,
                                          ),
                                      }
                            this.changed()
                            this.describeSong()
                            message("Variation ready. Press Play song to hear it.")
                            break
                        }
                        case "sounds": {
                            if (!this.generated) return
                            stop()
                            const choices = [
                                [4, 5, 11, 12, 13],
                                [4, 5, 11, 13],
                                [5, 6, 13],
                                [5, 6, 13],
                                [5, 6, 13],
                                [5, 11, 13],
                                [7, 13],
                            ]
                            this.project.tracks.forEach((track, i) => {
                                const alternatives = choices[i]?.filter(
                                    (instrument) => instrument !== track.instrument,
                                )
                                if (alternatives?.length)
                                    track.instrument =
                                        alternatives[
                                            crypto.getRandomValues(new Uint32Array(1))[0]! %
                                                alternatives.length
                                        ]!
                            })
                            this.changed()
                            message("New sounds, same notes and drums. Press Play song.")
                            break
                        }
                        case "play":
                            if (!this.valid()) return
                            void play(projectMML(this.project))
                            break
                        case "stop":
                            stop()
                            break
                        case "add":
                            this.generated = undefined
                            if (this.project.tracks.length >= 16)
                                throw new Error("The maximum is 16 tracks.")
                            this.project.tracks.push({
                                name: `Track ${this.project.tracks.length + 1}`,
                                instrument: 0,
                                volume: 60,
                                pan: 0,
                                mute: false,
                                solo: false,
                                mml: "o5 l8 c e g r",
                            })
                            this.changed()
                            this.tracks.lastElementChild?.querySelector("input")?.focus()
                            break
                        case "remove":
                            this.generated = undefined
                            this.project.tracks.splice(
                                Number(button.closest<HTMLElement>("[data-track]")!.dataset.track),
                                1,
                            )
                            this.changed()
                            root.querySelector<HTMLButtonElement>('[data-action="add"]')!.focus()
                            break
                        case "save":
                            if (!this.valid()) return
                            this.download(
                                "sion-project.json",
                                JSON.stringify(parseProject(this.project), null, 2),
                                "application/json",
                            )
                            message("Project downloaded.")
                            break
                        case "load":
                            root.querySelector<HTMLInputElement>('[type="file"]')!.click()
                            break
                        case "export":
                            if (!this.valid()) return
                            this.download(
                                "sion-arrangement.mml",
                                projectMML(this.project),
                                "text/plain",
                            )
                            message(
                                "MML downloaded. Open it in the score editor to edit the combined arrangement.",
                            )
                            break
                        case "demo":
                            stop()
                            this.generated = undefined
                            this.project = createProject()
                            this.changed()
                            message("Demo restored.")
                            break
                    }
                } catch (error) {
                    this.report(error)
                }
            },
            { signal },
        )
        root.querySelector<HTMLInputElement>('[type="file"]')!.addEventListener(
            EVENT_CHANGE,
            async (event) => {
                const input = event.target as HTMLInputElement
                const file = input.files?.[0]
                if (!file) return
                try {
                    if (file.size > 300000)
                        throw new Error("Project files must be smaller than 300 KB.")
                    const project = parseProject(await file.text())
                    if (signal.aborted) return
                    stop()
                    this.project = project
                    this.generated = undefined
                    this.changed()
                    message("Project opened.")
                } catch (error) {
                    this.report(error)
                } finally {
                    input.value = ""
                }
            },
            { signal },
        )
    }

    private valid() {
        for (const input of this.root.querySelectorAll<HTMLInputElement>("input[data-project]")) {
            if (!input.reportValidity()) return false
        }
        return true
    }

    private report(error: unknown) {
        this.message(error instanceof Error ? error.message : String(error), true)
    }

    private changed() {
        this.render()
        this.persist()
    }

    private describeSong() {
        const song = this.generated
        if (!song) {
            this.root.querySelector("[data-song-description]")!.textContent =
                `Current arrangement · ${this.project.tracks.length} tracks · ${this.project.tempo} BPM. Make & play creates a new song; your track editor is below.`
            return
        }
        this.root.querySelector("[data-song-description]")!.textContent =
            `${song.title} · ${song.rhythm} · ${keyNames[song.settings.key]} ${song.minor ? "minor" : "major"} · ${this.project.tempo} BPM · ${song.beats}/4 · ${song.chords.join(" → ")} · ${song.totalBars} bars / 10 layers`
    }

    private persist() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(this.project))
        } catch {
            this.message("Browser storage is unavailable. Use Save project to keep your work.")
        }
    }

    private render() {
        this.describeSong()
        for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-variation]"))
            button.disabled = !this.generated
        for (const field of ["tempo", "repeats"] as const)
            this.root.querySelector<HTMLInputElement>(`[data-project="${field}"]`)!.value = String(
                this.project[field],
            )
        this.tracks.replaceChildren()
        this.project.tracks.forEach((track, index) => {
            const row = document.createElement("fieldset")
            row.className = "daw-track"
            row.dataset.track = String(index)
            row.innerHTML = `<legend>Track ${index + 1}</legend>
              <div class="toolbar">
                <label class="field grow">Name<input data-field="name" maxlength="80"></label>
                <label class="field grow">Instrument<select data-field="instrument">${instruments.map((item, i) => `<option value="${i}">${item.name}</option>`).join("")}</select></label>
                <label><input data-field="mute" type="checkbox"> Mute</label>
                <label><input data-field="solo" type="checkbox"> Solo</label>
                <button type="button" data-action="remove" ${this.project.tracks.length === 1 ? "disabled" : ""}>Remove</button>
              </div>
              <div class="toolbar">
                <label>Level <input data-field="volume" type="range" min="0" max="100"> <output data-value="volume"></output>%</label>
                <label>Pan <input data-field="pan" type="range" min="-64" max="64"> <output data-value="pan"></output></label>
              </div>
              <label class="field">MML part<textarea data-field="mml" spellcheck="false" maxlength="16000"></textarea></label>`
            for (const field of ["name", "instrument", "volume", "pan", "mml"] as const) {
                row.querySelector<HTMLInputElement>(`[data-field="${field}"]`)!.value = String(
                    track[field],
                )
            }
            for (const field of ["mute", "solo"] as const)
                row.querySelector<HTMLInputElement>(`[data-field="${field}"]`)!.checked =
                    track[field]
            for (const field of ["volume", "pan"] as const)
                row.querySelector<HTMLOutputElement>(`[data-value="${field}"]`)!.value = String(
                    track[field],
                )
            this.tracks.append(row)
        })
        this.root.querySelector<HTMLButtonElement>('[data-action="add"]')!.disabled =
            this.project.tracks.length >= 16
    }

    private download(name: string, contents: string, type: string) {
        const url = URL.createObjectURL(new Blob([contents], { type }))
        const link = document.createElement("a")
        link.href = url
        link.download = name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
}