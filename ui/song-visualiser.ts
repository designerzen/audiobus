/**
 * SongVisualiser - Display an array of AudioCommands as a timeline
 *
 * Each bar represents a note with:
 * - Height representing note pitch
 * - Width representing note duration (from noteOn to noteOff)
 * - Horizontal position representing time in the timeline
 *
 * Uses a Worker for rendering to keep main thread responsive
 */

import SONG_VISUALISER_WORKER from "./song-visualiser-worker.ts?worker";
import { NOTE_ON, NOTE_OFF } from "../commands.ts";
import NoteModel from "../note-model.ts";

import type { IAudioCommand } from "../audio-command-interface.ts";
import type { IAudioOutput } from "../io/outputs/output-interface.ts";
import type OPFSStorage from "../storage/opfs-storage.ts";

interface NoteBarData {
    startTime: number;
    endTime: number;
    noteNumber: number;
    velocity: number;
    colour?: string;
    source?: "live" | "recorded";
}

type LayoutMode = "stacked" | "timeline";

interface VisualisationOptions {
    pixelsPerSecond?: number;
    noteHeight?: number;
    barHeight?: number;
    startNote?: number;
    endNote?: number;
    showLabels?: boolean;
    darkMode?: boolean;
    layoutMode?: LayoutMode;
}

export default class SongVisualiser extends HTMLElement implements IAudioOutput {
    private canvas: HTMLCanvasElement | null = null;
    private offscreenCanvas: OffscreenCanvas | null = null;
    private commands: IAudioCommand[] = [];
    private noteBars: NoteBarData[] = [];
    private liveNotes: Map<number, { startTime: number; velocity: number; colour: string }> = new Map();
    private worker: Worker | null = null;
    private options: Required<VisualisationOptions>;
    private baseTime: number = 0;
    private themeMediaQuery: MediaQueryList | null = null;

    static ID = 0;
    #uuid = `song-visualiser-${SongVisualiser.ID++}`;

    constructor() {
        super();
        this.baseTime = Date.now();
        this.options = {
            pixelsPerSecond: 100,
            noteHeight: 8,
            barHeight: 1,
            startNote: 0,
            endNote: 127,
            showLabels: true,
            darkMode: false,
            layoutMode: "timeline",
        };
    }

    // IAudioOutput required properties
    get uuid(): string {
        return this.#uuid;
    }

    get name(): string {
        return "Song Visualiser";
    }

    get description(): string {
        return "Visualizes audio commands as a timeline";
    }

    get isConnected(): boolean {
        return this.worker !== null;
    }

    get isHidden(): boolean {
        return false;
    }

    // IAudioOutput required methods
    noteOn(noteNumber: number, velocity: number = 1): void {
        const startTime = (Date.now() - this.baseTime) / 1000;
        const noteModel = new NoteModel(noteNumber);
        this.liveNotes.set(noteNumber, {
            startTime,
            velocity,
            colour: noteModel.colour,
        });

        if (this.worker) {
            this.worker.postMessage({
                type: "noteOn",
                data: { note: noteNumber, velocity },
            });
        }
    }

    noteOff(noteNumber: number): void {
        const liveNote = this.liveNotes.get(noteNumber);
        if (liveNote) {
            const endTime = (Date.now() - this.baseTime) / 1000;
            this.noteBars.push({
                startTime: liveNote.startTime,
                endTime,
                noteNumber,
                velocity: liveNote.velocity,
                colour: liveNote.colour,
                source: "live",
            });
            this.liveNotes.delete(noteNumber);
            this.sendCommandsToWorker();
        }

        if (this.worker) {
            this.worker.postMessage({
                type: "noteOff",
                data: { note: noteNumber },
            });
        }
    }

    allNotesOff(): void {
        const endTime = (Date.now() - this.baseTime) / 1000;
        for (const [noteNumber, liveNote] of this.liveNotes.entries()) {
            this.noteBars.push({
                startTime: liveNote.startTime,
                endTime,
                noteNumber,
                velocity: liveNote.velocity,
                colour: liveNote.colour,
                source: "live",
            });
        }
        this.liveNotes.clear();
        this.sendCommandsToWorker();

        if (this.worker) {
            this.worker.postMessage({ type: "allNotesOff" });
        }
    }

    connectedCallback() {
        this.detectAndApplyTheme();
        this.render();
        this.initWorker();
        this.setupThemeListener();
    }

    disconnectedCallback() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        if (this.themeMediaQuery) {
            this.themeMediaQuery.removeEventListener("change", this.themeChangeHandler);
        }
    }

    private themeChangeHandler = (e: MediaQueryListEvent) => {
        this.options.darkMode = e.matches;
        if (this.worker) {
            this.worker.postMessage({
                type: "setOptions",
                data: { options: this.options },
            });
        }
    };

    private detectAndApplyTheme() {
        // Check for explicit theme attribute
        const themeAttr = this.getAttribute("data-theme");
        if (themeAttr === "dark") {
            this.options.darkMode = true;
        } else if (themeAttr === "light") {
            this.options.darkMode = false;
        } else {
            // Auto-detect system preference
            this.options.darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
    }

    private setupThemeListener() {
        // Listen for system theme changes
        this.themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        this.themeMediaQuery.addEventListener("change", this.themeChangeHandler);
    }

    private render() {
        const container = document.createElement("div");
        container.style.cssText = `
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: ${this.options.darkMode ? "#1e1e1e" : "#ffffff"};
      overflow: auto;
    `;

        this.canvas = document.createElement("canvas");
        this.canvas.style.cssText = `
      flex: 1;
      cursor: crosshair;
      border-bottom: 1px solid ${this.options.darkMode ? "#444" : "#ddd"};
    `;

        container.appendChild(this.canvas);
        this.attachShadow({ mode: "open" });
        this.shadowRoot?.appendChild(container);

        this.canvas?.addEventListener("click", (e) => this.handleCanvasClick(e));
    }

    private initWorker() {
        try {
            // Create worker from ?worker import (which is already a Worker constructor)
            this.worker = new SONG_VISUALISER_WORKER();

            this.worker.onmessage = (event) => this.handleWorkerMessage(event);
            this.worker.onerror = (error) => {
                console.error("Song visualiser worker error:", error);
            };

            // Transfer canvas to worker
            this.transferCanvasToWorker();
        } catch (error) {
            console.error("Failed to initialize worker:", error);
        }
    }

    private transferCanvasToWorker() {
        if (!this.canvas || !this.worker) return;

        try {
            this.offscreenCanvas = this.canvas.transferControlToOffscreen();
            this.worker.postMessage(
                {
                    type: "init",
                    data: { canvas: this.offscreenCanvas },
                },
                [this.offscreenCanvas],
            );

            // Send initial theme options to worker
            this.worker.postMessage({
                type: "setOptions",
                data: { options: this.options },
            });

            // Notify worker of initial size
            const rect = this.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.worker.postMessage({
                type: "resize",
                data: {
                    displayWidth: Math.ceil(rect.width * dpr),
                    displayHeight: Math.ceil(rect.height * dpr),
                },
            });
        } catch (error) {
            console.error("Failed to transfer canvas:", error);
        }
    }

    private handleWorkerMessage(event: MessageEvent) {
        const { type, data } = event.data;

        if (type === "noteBarsData") {
            this.noteBars = data;
        }
    }

    /**
     * Set configuration options for visualisation
     */
    setOptions(options: Partial<VisualisationOptions>) {
        this.options = { ...this.options, ...options };
        if (this.worker) {
            this.worker.postMessage({
                type: "setOptions",
                data: { options: this.options },
            });
        }
    }

    /**
     * Load AudioCommand array and visualise it
     */
    async loadCommands(commands: IAudioCommand[]) {
        this.commands = [...commands];
        this.processCommands();
        this.sendCommandsToWorker();
    }

    /**
     * Load commands from OPFS storage
     */
    async loadFromOPFS(storage: OPFSStorage) {
        try {
            const commands = await storage.readAll();
            await this.loadCommands(commands as IAudioCommand[]);
            return true;
        } catch (error) {
            console.error("Failed to load commands from OPFS:", error);
            return false;
        }
    }

    /**
     * Process AudioCommand array into note bar data
     */
    private processCommands() {
        const notesMap = new Map<number, IAudioCommand>();
        this.noteBars = [];

        for (const command of this.commands) {
            // Check if command has noteNumber property
            const noteNumber = (command as any).noteNumber || command.number;

            if (command.subtype === NOTE_ON && noteNumber != null) {
                notesMap.set(noteNumber, command);
            } else if (command.subtype === NOTE_OFF && noteNumber != null) {
                const noteOnCommand = notesMap.get(noteNumber);
                if (noteOnCommand) {
                    const velocity = (command as any).velocity || command.number || 1;
                    this.noteBars.push({
                        startTime: noteOnCommand.startAt || noteOnCommand.time || 0,
                        endTime: command.startAt || command.time || 0,
                        noteNumber,
                        velocity,
                    });
                    notesMap.delete(noteNumber);
                }
            }
        }

        // Sort by start time
        this.noteBars.sort((a, b) => a.startTime - b.startTime);
    }

    /**
     * Send processed commands to worker
     */
    private sendCommandsToWorker() {
        if (!this.worker || !this.canvas) return;

        const rect = this.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.worker.postMessage({
            type: "setNoteBars",
            data: {
                noteBars: this.noteBars,
                displayWidth: Math.ceil(rect.width * dpr),
                displayHeight: Math.ceil(rect.height * dpr),
            },
        });

        // Auto-adjust canvas height based on note count
        const uniqueNotes = new Set(this.noteBars.map((bar) => bar.noteNumber));
        const minHeight = Math.max(100, uniqueNotes.size * (this.options.noteHeight || 8));

        if (this.canvas) {
            this.canvas.style.height = `${minHeight}px`;

            this.worker.postMessage({
                type: "resize",
                data: {
                    displayWidth: Math.ceil(rect.width * dpr),
                    displayHeight: Math.ceil(minHeight * dpr),
                },
            });
        }
    }

    /**
     * Process recorded commands
     */
    private processRecordedCommands(commands: IAudioCommand[]) {
        const notesMap = new Map<number, IAudioCommand>();

        for (const command of commands) {
            const noteNumber = (command as any).noteNumber || command.number;

            if (command.subtype === NOTE_ON && noteNumber != null) {
                notesMap.set(noteNumber, command);
            } else if (command.subtype === NOTE_OFF && noteNumber != null) {
                const noteOnCommand = notesMap.get(noteNumber);
                if (noteOnCommand) {
                    const velocity = (command as any).velocity || 1;
                    this.noteBars.push({
                        startTime: noteOnCommand.startAt || noteOnCommand.time || 0,
                        endTime: command.startAt || command.time || 0,
                        noteNumber,
                        velocity,
                        source: "recorded",
                    });
                    notesMap.delete(noteNumber);
                }
            }
        }
    }

    /**
     * Reset the visualiser and redraw
     */
    reset() {
        this.commands = [];
        this.noteBars = [];
        this.liveNotes.clear();
        this.baseTime = Date.now();

        if (this.worker) {
            this.worker.postMessage({ type: "clear" });
        }

        // Redraw the canvas with cleared state
        if (this.canvas && this.worker) {
            const rect = this.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            // Set canvas to minimum height
            this.canvas.style.width = `${rect.width}px`;
            this.canvas.style.height = "100px";

            this.worker.postMessage({
                type: "resize",
                data: {
                    displayWidth: Math.ceil(rect.width * dpr),
                    displayHeight: Math.ceil(100 * dpr),
                },
            });
        }
    }

    private handleCanvasClick(event: MouseEvent) {
        if (!this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Calculate click position as normalized coordinates
        const normalizedX = x / rect.width;
        const normalizedY = y / rect.height;

        // Find which note bar was clicked using stored note bar data
        const maxTime = Math.max(...this.noteBars.map((bar) => bar.endTime), 1);

        const clickedBar = this.noteBars.find((bar) => {
            // Normalize bar positions to match click coordinates
            const barStartX = bar.startTime / maxTime;
            const barEndX = (bar.endTime - bar.startTime || 0.1) / maxTime;

            const noteIndex = bar.noteNumber - this.options.startNote;
            const noteRange = this.options.endNote - this.options.startNote;
            const barStartY = noteIndex / noteRange;
            const barEndY = 1 / noteRange;

            // Check if click is within note bar bounds
            return (
                normalizedX >= barStartX &&
                normalizedX <= barStartX + barEndX &&
                normalizedY >= barStartY &&
                normalizedY <= barStartY + barEndY
            );
        });

        if (clickedBar) {
            this.dispatchEvent(
                new CustomEvent("noteClick", {
                    detail: clickedBar,
                    bubbles: true,
                }),
            );
        }
    }

    /**
     * Export current commands as JSON
     */
    exportAsJSON(): string {
        return JSON.stringify(this.commands, null, 2);
    }

    /**
     * Clear all commands
     */
    clear() {
        this.commands = [];
        this.noteBars = [];
        if (this.worker) {
            this.worker.postMessage({ type: "clear" });
        }
    }

    /**
     * Get current commands
     */
    getCommands(): IAudioCommand[] {
        return [...this.commands];
    }

    /**
     * Get note bars data
     */
    getNoteBars(): NoteBarData[] {
        return [...this.noteBars];
    }

    /**
     * Merge live and recorded data for visualization
     */
    async mergeAndDisplay() {
        // Merge data and redraw
        this.sendCommandsToWorker();
    }

    /**
     * Link recorded data from another source
     */
    mergeRecordedCommands(commands: IAudioCommand[]) {
        this.processRecordedCommands(commands);
        this.sendCommandsToWorker();
    }

    /**
     * Clear live notes while preserving recorded data
     */
    clearLiveNotes() {
        this.liveNotes.clear();
        // Filter out live data from display
        this.noteBars = this.noteBars.filter((bar) => bar.source !== "live");
        this.sendCommandsToWorker();
    }
}

// Register as custom element
if (!customElements.get("song-visualiser")) {
    customElements.define("song-visualiser", SongVisualiser);
}
