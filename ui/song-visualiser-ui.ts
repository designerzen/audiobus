/**
 * Song Visualiser UI Wrapper
 * 
 * Provides controls and integration for the SongVisualiser component
 */

import SongVisualiser from "./song-visualiser.js"
import type AudioCommand from "../audio-command.ts"
import type OPFSStorage from "../storage/opfs-storage.ts"

export class SongVisualiserUI extends HTMLElement {
  private visualiser: SongVisualiser | null = null
  private storage: OPFSStorage | null = null
  private isLoading: boolean = false
  private darkMode: boolean = false
  private themeMediaQuery: MediaQueryList | null = null

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
    this.render()
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
           Load from OPFS
         </button>
         <button class="song-visualiser-btn clear-btn">
           Clear
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
    `

    this.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    style.textContent = this.getStyles()
    this.shadowRoot?.appendChild(style)
    this.shadowRoot?.appendChild(template)

    this.setupElements()
    this.setupEventListeners()
  }

  private setupElements() {
    const visualiserElement = this.shadowRoot?.querySelector("song-visualiser") as SongVisualiser
    if (visualiserElement) {
      this.visualiser = visualiserElement
    }
  }

  private setupEventListeners() {
    const layoutModeSelect = this.shadowRoot?.querySelector(".layout-mode-select") as HTMLSelectElement
    const pixelsPerSecondSlider = this.shadowRoot?.querySelector(".pixels-per-second-slider") as HTMLInputElement
    const noteHeightSlider = this.shadowRoot?.querySelector(".note-height-slider") as HTMLInputElement
    const barHeightSlider = this.shadowRoot?.querySelector(".bar-height-slider") as HTMLInputElement
    const loadFromOPFSBtn = this.shadowRoot?.querySelector(".load-from-opfs") as HTMLButtonElement
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
      loadFromOPFSBtn.addEventListener("click", () => this.loadFromOPFS())
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => this.clear())
    }

    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportJSON())
    }

    // Listen for note clicks
    this.visualiser?.addEventListener("noteClick", (e: any) => {
      console.log("Note clicked:", e.detail)
      this.dispatchEvent(new CustomEvent("noteClick", { detail: e.detail }))
    })
  }

  /**
   * Load commands from OPFS storage
   */
  private async loadFromOPFS() {
    if (!this.storage || !this.visualiser) return

    const btn = this.shadowRoot?.querySelector(".load-from-opfs") as HTMLButtonElement
    if (btn) {
      btn.disabled = true
      btn.textContent = "Loading..."
    }

    try {
      const success = await this.visualiser.loadFromOPFS(this.storage)
      if (success) {
        this.updateInfo()
      }
    } finally {
      if (btn) {
        btn.disabled = false
        btn.textContent = "Load from OPFS"
      }
    }
  }

  /**
   * Clear all data
   */
  private clear() {
    if (confirm("Clear all data?")) {
      this.visualiser?.clear()
      this.updateInfo()
    }
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
    const commands = this.visualiser?.getCommands() ?? []
    const noteBars = this.visualiser?.getNoteBars() ?? []

    const commandCountEl = this.shadowRoot?.querySelector(".command-count")
    const noteBarCountEl = this.shadowRoot?.querySelector(".note-bar-count")
    const durationEl = this.shadowRoot?.querySelector(".duration-value")
    const maxNoteEl = this.shadowRoot?.querySelector(".max-note-value")

    if (commandCountEl) commandCountEl.textContent = String(commands.length)
    if (noteBarCountEl) noteBarCountEl.textContent = String(noteBars.length)

    if (noteBars.length > 0) {
      const maxTime = Math.max(...noteBars.map((b) => b.endTime))
      if (durationEl) durationEl.textContent = `${(maxTime / 1000).toFixed(2)}s`

      const maxNote = Math.max(...noteBars.map((b) => b.noteNumber))
      if (maxNoteEl) maxNoteEl.textContent = String(maxNote)
    } else {
      if (durationEl) durationEl.textContent = "0s"
      if (maxNoteEl) maxNoteEl.textContent = "-"
    }
  }

  /**
   * Load audio commands to visualise
   */
  async loadCommands(commands: AudioCommand[]) {
    // Wait for visualiser to be initialized if not ready yet
    if (!this.visualiser) {
      await new Promise(resolve => {
        const checkVisualiser = setInterval(() => {
          if (this.visualiser) {
            clearInterval(checkVisualiser)
            resolve(undefined)
          }
        }, 10)
      })
    }
    
    if (this.visualiser) {
      await this.visualiser.loadCommands(commands)
      this.updateInfo()
    }
  }

  /**
   * Set OPFS storage instance
   */
  setStorage(storage: OPFSStorage) {
    this.storage = storage
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
    const bgPrimary = this.darkMode ? "#1e1e1e" : "#ffffff"
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


