import { EVENT_NOTE_CLICK, EVENT_CLICK, EVENT_TOGGLE } from "../event-constants.ts"
/**
 * Song Visualiser UI Wrapper
 *
 * Provides controls and integration for the SongVisualiser component
 */

import "./song-visualiser.ts"
import type SongVisualiser from "./song-visualiser.ts"
import type { IAudioCommand } from "../audio-command-interface.ts"
import type OPFSStorage from "../storage/opfs-storage.ts"

export class SongVisualiserUI extends HTMLElement {
	private visualiser: SongVisualiser | null = null
	private storage: OPFSStorage | null = null
	private darkMode: boolean = false
	private themeMediaQuery: MediaQueryList | null = null
	private commandSource: (() => IAudioCommand[] | Promise<IAudioCommand[]>) | null = null
	private commandPage = 0
	private refreshTask: Promise<void> | null = null
	private generation = 0

	constructor() {
		super()
	}

	private themeChangeHandler = () => {
		this.detectAndApplyTheme()
		this.updateStyles()
	}

	private detectAndApplyTheme() {
		// Check for explicit theme attribute
		const themeAttr = this.getAttribute("data-theme")
		if (themeAttr === "dark") {
			this.darkMode = true
		} else if (themeAttr === "light") {
			this.darkMode = false
		} else {
			// Auto-detect system preference
			this.darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches
		}
	}

	private setupThemeListener() {
		// Listen for system theme changes
		this.themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
		this.themeMediaQuery.addEventListener("change", this.themeChangeHandler)
	}

	private updateStyles() {
		const styleEl = this.shadowRoot?.querySelector("style")
		if (styleEl) {
			styleEl.textContent = this.getStyles()
		}
	}

	disconnectedCallback() {
		if (this.themeMediaQuery) {
			this.themeMediaQuery.removeEventListener("change", this.themeChangeHandler)
		}
	}

	connectedCallback() {
		this.detectAndApplyTheme()
		if (!this.shadowRoot) {
			this.render()
		}
		this.setupThemeListener()
	}

	private render() {
		const template = document.createElement("div")
		template.className = "song-visualiser-container"
		template.innerHTML = `
      <div class="song-visualiser-controls">
         <div class="song-visualiser-controls__group">
           <label class="song-visualiser-controls__group__label">Layout:</label>
           <select class="layout-mode-select">
             <option value="timeline">Timeline (pitch vs time)</option>
             <option value="stacked">Stacked (chronological)</option>
           </select>
         </div>
         <div class="song-visualiser-controls__group">
           <label class="song-visualiser-controls__group__label">Pixels/Second:</label>
           <input type="range" min="10" max="500" value="100" class="pixels-per-second-slider">
         </div>
         <div class="song-visualiser-controls__group">
           <label class="song-visualiser-controls__group__label">Note Height:</label>
           <input type="range" min="2" max="32" value="8" class="note-height-slider">
         </div>
         <div class="song-visualiser-controls__group">
           <label class="song-visualiser-controls__group__label">Bar Height:</label>
           <input type="range" min="1" max="20" value="1" class="bar-height-slider">
         </div>
         <button class="song-visualiser-btn song-visualiser-btn--primary load-from-opfs">
           Refresh recording
         </button>
         <button class="song-visualiser-btn clear-btn">
           Clear view
         </button>
         <button class="song-visualiser-btn export-btn">
           Export JSON
         </button>
       </div>

      <song-visualiser></song-visualiser>

      <div class="song-visualiser-info">
        <div class="song-visualiser-info__item">
          <div class="song-visualiser-info__label">Commands</div>
          <div class="song-visualiser-info__value command-count">0</div>
        </div>
        <div class="song-visualiser-info__item">
          <div class="song-visualiser-info__label">Note Bars</div>
          <div class="song-visualiser-info__value note-bar-count">0</div>
        </div>
        <div class="song-visualiser-info__item">
          <div class="song-visualiser-info__label">Duration</div>
          <div class="song-visualiser-info__value duration-value">0s</div>
        </div>
        <div class="song-visualiser-info__item">
          <div class="song-visualiser-info__label">Max Note</div>
          <div class="song-visualiser-info__value max-note-value">-</div>
        </div>
      </div>
      <p class="recording-status" role="status"></p>
      <details class="recorded-commands">
        <summary>Recorded MIDI commands</summary>
        <p>Refresh to inspect the saved recording. This view updates on request.</p>
        <div class="command-table" tabindex="0" role="region" aria-label="Recorded MIDI commands">
          <table>
            <thead><tr><th>Time (s)</th><th>Type</th><th>Channel</th><th>Number</th><th>Velocity</th><th>Value</th><th>Source</th><th>Chain</th><th>Data</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <nav aria-label="Command pages">
          <button type="button" class="commands-previous">Previous</button>
          <span class="commands-page" role="status"></span>
          <button type="button" class="commands-next">Next</button>
        </nav>
      </details>
    `

		this.attachShadow({ mode: "open" })
		const style = document.createElement("style")
		style.textContent = this.getStyles()
		this.shadowRoot?.appendChild(style)
		this.shadowRoot?.appendChild(template)

		this.setupElements()
		this.setupEventListeners()
		this.updateRefreshButton()
	}

	private setupElements() {
		const visualiserElement = this.shadowRoot?.querySelector(
			"song-visualiser"
		) as SongVisualiser
		if (visualiserElement) {
			this.visualiser = visualiserElement
		}
	}

	private setupEventListeners() {
		const layoutModeSelect = this.shadowRoot?.querySelector(
			".layout-mode-select"
		) as HTMLSelectElement
		const pixelsPerSecondSlider = this.shadowRoot?.querySelector(
			".pixels-per-second-slider"
		) as HTMLInputElement
		const noteHeightSlider = this.shadowRoot?.querySelector(
			".note-height-slider"
		) as HTMLInputElement
		const barHeightSlider = this.shadowRoot?.querySelector(
			".bar-height-slider"
		) as HTMLInputElement
		const loadFromOPFSBtn = this.shadowRoot?.querySelector(
			".load-from-opfs"
		) as HTMLButtonElement
		const clearBtn = this.shadowRoot?.querySelector(".clear-btn") as HTMLButtonElement
		const exportBtn = this.shadowRoot?.querySelector(".export-btn") as HTMLButtonElement

		if (layoutModeSelect) {
			layoutModeSelect.addEventListener("change", (e) => {
				const value = (e.target as HTMLSelectElement).value as "timeline" | "stacked"
				this.visualiser?.setOptions({ layoutMode: value })
			})
		}

		if (pixelsPerSecondSlider) {
			pixelsPerSecondSlider.addEventListener("input", (e) => {
				const value = parseInt((e.target as HTMLInputElement).value, 10)
				this.visualiser?.setOptions({ pixelsPerSecond: value })
			})
		}

		if (noteHeightSlider) {
			noteHeightSlider.addEventListener("input", (e) => {
				const value = parseInt((e.target as HTMLInputElement).value, 10)
				this.visualiser?.setOptions({ noteHeight: value })
			})
		}

		if (barHeightSlider) {
			barHeightSlider.addEventListener("input", (e) => {
				const value = parseInt((e.target as HTMLInputElement).value, 10)
				this.visualiser?.setOptions({ barHeight: value })
			})
		}

		if (loadFromOPFSBtn) {
			loadFromOPFSBtn.addEventListener(EVENT_CLICK, () => {
				void this.refresh()
			})
		}

		if (clearBtn) {
			clearBtn.addEventListener("click", () => this.clear())
		}

		if (exportBtn) {
			exportBtn.addEventListener("click", () => this.exportJSON())
		}

		// Listen for note clicks
		this.visualiser?.addEventListener(EVENT_NOTE_CLICK, (e: any) => {
			this.dispatchEvent(new CustomEvent(EVENT_NOTE_CLICK, { detail: e.detail }))
		})
		this.shadowRoot
			?.querySelector(".recorded-commands")
			?.addEventListener(EVENT_TOGGLE, () => this.renderCommandPage())
		this.shadowRoot?.querySelector(".commands-previous")?.addEventListener(EVENT_CLICK, () => {
			this.commandPage--
			this.renderCommandPage()
		})
		this.shadowRoot?.querySelector(".commands-next")?.addEventListener(EVENT_CLICK, () => {
			this.commandPage++
			this.renderCommandPage()
		})
	}

	/**
	 * Load commands from OPFS storage
	 */
	refresh(): Promise<void> {
		if (this.refreshTask) {
			return this.refreshTask
		}
		if (!this.storage && !this.commandSource) {
			return Promise.resolve()
		}
		const generation = this.generation
		this.refreshTask = Promise.resolve()
			.then(async () => {
				const commands = this.storage
					? ((await this.storage.readAll()) as unknown as IAudioCommand[])
					: await this.commandSource!()
				if (generation === this.generation) {
					await this.loadCommands(commands)
				}
			})
			.then(() => {
				if (generation === this.generation) {
					this.setStatus("Recording refreshed.")
				}
			})
			.catch(() => {
				if (generation === this.generation) {
					this.setStatus("Unable to load the recording. Try refreshing again.")
				}
			})
			.finally(() => {
				this.refreshTask = null
				this.updateRefreshButton()
			})
		this.updateRefreshButton()
		return this.refreshTask
	}

	async showCommands(): Promise<void> {
		const details = this.shadowRoot?.querySelector<HTMLDetailsElement>(".recorded-commands")
		if (details) {
			details.open = true
		}
		await this.refresh()
		this.renderCommandPage()
	}

	private setStatus(message: string): void {
		const status = this.shadowRoot?.querySelector(".recording-status")
		if (status) {
			status.textContent = message
		}
	}

	private updateRefreshButton(): void {
		const button = this.shadowRoot?.querySelector<HTMLButtonElement>(".load-from-opfs")
		if (!button) {
			return
		}
		button.disabled = this.refreshTask !== null || (!this.storage && !this.commandSource)
		button.textContent = this.refreshTask ? "Loading…" : "Refresh recording"
	}

	private renderCommandPage(): void {
		const details = this.shadowRoot?.querySelector<HTMLDetailsElement>(".recorded-commands")
		const body = details?.querySelector("tbody")
		if (!details?.open || !body || !this.visualiser) {
			return
		}
		const count = this.visualiser.commandCount
		const pages = Math.max(1, Math.ceil(count / 100))
		this.commandPage = Math.max(0, Math.min(this.commandPage, pages - 1))
		const fragment = document.createDocumentFragment()
		for (const command of this.visualiser.getCommandPage(this.commandPage * 100, 100)) {
			const row = document.createElement("tr")
			const bytes = command.raw?.length
				? Array.from(command.raw)
						.map((byte) => byte.toString(16).padStart(2, "0"))
						.join(" ")
				: command.ump?.map((word) => word.toString(16).padStart(8, "0")).join(" ")
			for (const value of [
				command.startAt ?? command.time,
				command.type,
				command.channel,
				command.number,
				command.velocity,
				command.value,
				command.from,
				command.chainName ?? command.chainId,
				bytes
			]) {
				const cell = document.createElement("td")
				cell.textContent = value === undefined || value === null ? "—" : String(value)
				row.append(cell)
			}
			fragment.append(row)
		}
		body.replaceChildren(fragment)
		details.querySelector(".commands-page")!.textContent =
			`${count} commands · Page ${this.commandPage + 1} of ${pages}`
		details.querySelector<HTMLButtonElement>(".commands-previous")!.disabled =
			this.commandPage === 0
		details.querySelector<HTMLButtonElement>(".commands-next")!.disabled =
			this.commandPage + 1 >= pages
	}

	reset(): void {
		this.generation++
		this.commandPage = 0
		this.visualiser?.reset()
		this.updateInfo()
		this.renderCommandPage()
	}

	/**
	 * Clear all data
	 */
	private clear() {
		this.reset()
	}

	/**
	 * Export commands as JSON
	 */
	private exportJSON() {
		const json = this.visualiser?.exportAsJSON()
		if (json) {
			const blob = new Blob([json], { type: "application/json" })
			const url = URL.createObjectURL(blob)
			const a = document.createElement("a")
			a.href = url
			a.download = `song-${Date.now()}.json`
			a.click()
			URL.revokeObjectURL(url)
		}
	}

	/**
	 * Update info display
	 */
	private updateInfo() {
		const noteBars = this.visualiser?.getNoteBars() ?? []

		const commandCountEl = this.shadowRoot?.querySelector(".command-count")
		const noteBarCountEl = this.shadowRoot?.querySelector(".note-bar-count")
		const durationEl = this.shadowRoot?.querySelector(".duration-value")
		const maxNoteEl = this.shadowRoot?.querySelector(".max-note-value")

		if (commandCountEl) {
			commandCountEl.textContent = String(this.visualiser?.commandCount ?? 0)
		}
		if (noteBarCountEl) {
			noteBarCountEl.textContent = String(noteBars.length)
		}

		if (noteBars.length > 0) {
			let minTime = Infinity,
				maxTime = -Infinity,
				maxNote = 0
			for (const bar of noteBars) {
				minTime = Math.min(minTime, bar.startTime)
				maxTime = Math.max(maxTime, bar.endTime)
				maxNote = Math.max(maxNote, bar.noteNumber)
			}
			if (durationEl) {
				durationEl.textContent = `${(maxTime - minTime).toFixed(2)}s`
			}
			if (maxNoteEl) {
				maxNoteEl.textContent = String(maxNote)
			}
		} else {
			if (durationEl) {
				durationEl.textContent = "0s"
			}
			if (maxNoteEl) {
				maxNoteEl.textContent = "-"
			}
		}
	}

	/**
	 * Load audio commands to visualise
	 */
	async loadCommands(commands: IAudioCommand[]) {
		// Wait for visualiser to be initialized if not ready yet
		if (!this.visualiser) {
			await new Promise((resolve) => {
				const checkVisualiser = setInterval(() => {
					if (this.visualiser) {
						clearInterval(checkVisualiser)
						resolve(undefined)
					}
				}, 10)
			})
		}

		if (this.visualiser) {
			await this.visualiser.loadCommands(commands as IAudioCommand[])
			this.commandPage = 0
			this.updateInfo()
			this.renderCommandPage()
		}
	}

	/**
	 * Set OPFS storage instance
	 */
	setStorage(storage: OPFSStorage) {
		this.storage = storage
		this.updateRefreshButton()
	}

	setCommandSource(source: () => IAudioCommand[] | Promise<IAudioCommand[]>): void {
		this.commandSource = source
		this.updateRefreshButton()
	}

	/**
	 * Set visualiser options
	 */
	setOptions(options: any) {
		this.visualiser?.setOptions(options)
	}

	/**
	 * Get the visualiser instance
	 */
	getVisualiser(): SongVisualiser | null {
		return this.visualiser
	}

	private getStyles(): string {
		const bgSecondary = this.darkMode ? "#2d2d2d" : "#f5f5f5"
		const textPrimary = this.darkMode ? "#ffffff" : "#333333"
		const textSecondary = this.darkMode ? "#aaaaaa" : "#666666"
		const borderColor = this.darkMode ? "#444444" : "#dddddd"
		const inputBg = this.darkMode ? "#333333" : "#ffffff"
		const inputBorder = this.darkMode ? "#555555" : "#dddddd"
		const hoverBg = this.darkMode ? "#3d3d3d" : "#eeeeee"
		const labelColor = this.darkMode ? "#999999" : "#999999"

		return `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        color-scheme: ${this.darkMode ? "dark" : "light"};
      }

      .recording-status, .recorded-commands { padding: .5rem 1rem; margin: 0; }
      .recorded-commands summary { cursor: pointer; }
      .command-table { overflow: auto; max-height: 24rem; }
      table { border-collapse: collapse; width: 100%; font-size: .8rem; }
      th, td { padding: .4rem; border-bottom: 1px solid ${borderColor}; text-align: left; white-space: nowrap; }
      th { position: sticky; top: 0; background: ${bgSecondary}; }
      nav { display: flex; align-items: center; gap: 1rem; padding-top: .5rem; }

      .song-visualiser-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        gap: 0;
      }

      .song-visualiser-controls {
        display: flex;
        gap: 0.5rem;
        padding: 0.5rem;
        background: ${bgSecondary};
        border-bottom: 1px solid ${borderColor};
        flex-wrap: wrap;
        align-items: center;
      }

      .song-visualiser-controls__group {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .song-visualiser-controls__group__label {
        font-size: 0.875rem;
        color: ${textSecondary};
        white-space: nowrap;
      }

      input[type="range"],
      select {
        cursor: pointer;
      }

      input[type="range"] {
        width: 120px;
      }

      select {
        padding: 0.25rem 0.5rem;
        border: 1px solid ${inputBorder};
        border-radius: 4px;
        background: ${inputBg};
        font-size: 0.875rem;
        color: ${textPrimary};
      }

      .song-visualiser-btn {
        padding: 0.5rem 1rem;
        background: ${inputBg};
        border: 1px solid ${inputBorder};
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        color: ${textPrimary};
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .song-visualiser-btn:hover {
        background: ${hoverBg};
      }

      .song-visualiser-btn:active {
        transform: scale(0.98);
      }

      .song-visualiser-btn--primary {
        background: #007bff;
        color: white;
        border-color: #007bff;
      }

      .song-visualiser-btn--primary:hover {
        background: #0056b3;
      }

      .song-visualiser-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      song-visualiser {
        flex: 1;
        min-height: 300px;
      }

      .song-visualiser-info {
        padding: 1rem;
        background: ${bgSecondary};
        border-top: 1px solid ${borderColor};
        font-size: 0.875rem;
        color: ${textSecondary};
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
      }

      .song-visualiser-info__item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .song-visualiser-info__label {
        font-weight: 600;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: ${labelColor};
      }

      .song-visualiser-info__value {
        font-size: 1rem;
        color: ${textPrimary};
        font-family: monospace;
      }
    `
	}
}

// Register as custom element
if (!customElements.get("song-visualiser-ui")) {
	customElements.define("song-visualiser-ui", SongVisualiserUI)
}