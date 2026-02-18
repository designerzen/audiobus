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

import SONG_VISUALISER_WORKER from "./song-visualiser-worker.ts?url";
import { NOTE_ON, NOTE_OFF } from "../commands.ts";
import NoteModel from "../note-model.ts";

import type AudioCommand from "../audio-command.ts";
import type OPFSStorage from "../storage/opfs-storage.ts";
import type { IAudioCommand } from "../audio-command-interface.ts";
import type RecorderAudioEvent from "../audio-event-recorder.ts";
import type { IAudioOutput } from "../io/outputs/output-interface.ts";

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
    private recorder: RecorderAudioEvent | null = null;
    private worker: Worker | null = null;
    private options: Required<VisualisationOptions>;
    private baseTime: number = 0;

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

    connectedCallback() {
        this.detectAndApplyTheme();
        this.render();
        this.initWorker();
        this.setupThemeListener();
    }

    disconnectedCallback() {
        if (this.worker) {
            this.worker.terminate();
        }
        if (this.themeMediaQuery) {
            this.themeMediaQuery.removeEventListener("change", this.themeChangeHandler);
        }
    }

    private themeMediaQuery: MediaQueryList | null = null;
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
        console.log("[SongVisualiser] Theme detected:", {
            attribute: themeAttr,
            darkMode: this.options.darkMode,
            systemPreference: window.matchMedia("(prefers-color-scheme: dark)").matches,
        });
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
            // Create worker from inline code to avoid MIME type issues on static servers
            this.worker = new Worker(new URL(SONG_VISUALISER_WORKER, import.meta.url), {
                type: "module",
            });

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
        this.commands = commands;
        this.processCommands();
        this.sendCommandsToWorker();
    }

    /**
     * Link a Recorder instance to visualize recorded data
     */
    linkRecorder(recorder: RecorderAudioEvent) {
        this.recorder = recorder;
    }

    /**
     * Load recorded data from Recorder
     */
    async loadRecordedData() {
        if (!this.recorder) return;

        const recordedCommands = this.recorder.exportData();
        this.processRecordedCommands(recordedCommands);
        this.sendCommandsToWorker();
    }

    /**
     * Load commands from OPFS storage
     */
    async loadFromOPFS(storage: OPFSStorage) {
        try {
            const commands = await storage.readAll();
            this.loadCommands(commands);
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
        const notesMap = new Map<number, AudioCommand>();
        this.noteBars = [];

        let noteOnCount = 0;
        let noteOffCount = 0;

        for (const command of this.commands) {
            if (command.subtype === NOTE_ON && command.noteNumber != null) {
                notesMap.set(command.noteNumber, command);
                noteOnCount++;
            } else if (command.subtype === NOTE_OFF && command.noteNumber != null) {
                const noteOnCommand = notesMap.get(command.noteNumber);
                if (noteOnCommand) {
                    this.noteBars.push({
                        startTime: noteOnCommand.startAt || noteOnCommand.time || 0,
                        endTime: command.startAt || command.time || 0,
                        noteNumber: command.noteNumber,
                        velocity: command.velocity || 1,
                        colour: (command as any).colour,
                    });
                    notesMap.delete(command.noteNumber);
                }
                noteOffCount++;
            }
        }

        // FIXME: This is a BAD idea...
        // Sort by start time
        this.noteBars.sort((a, b) => a.startTime - b.startTime);
    }

    /**
     * Send processed commands to worker
     */
    private sendCommandsToWorker() {
        if (!this.worker || !this.canvas) return;

        this.worker.postMessage({
            type: "loadCommands",
            data: { commands: this.noteBars },
        });

        // Calculate required height based on layout mode
        let requiredHeight: number;
        const rect = this.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const PADDING = 4;

        if (this.options.layoutMode === "timeline") {
            // Timeline mode: height based on note range, width for time
            const noteRange = this.options.endNote - this.options.startNote;
            requiredHeight = noteRange * this.options.noteHeight + 40; // Add padding
        } else {
            // Stacked mode: height based on number of bars and configurable bar height
            const barHeight = this.options.barHeight || 1;
            requiredHeight = this.noteBars.length * (barHeight + PADDING);
        }

        const displayWidth = Math.ceil(rect.width * dpr);
        const displayHeight = Math.ceil(requiredHeight * dpr);

        // Update canvas CSS size
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${requiredHeight}px`;

        this.worker.postMessage({
            type: "resize",
            data: {
                displayWidth,
                displayHeight,
            },
        });
    }

    /**
     * Process recorded commands into note bars with source tracking
     */
    private processRecordedCommands(recordedCommands: IAudioCommand[]) {
        const notesMap = new Map<number, IAudioCommand>();

        for (const command of recordedCommands) {
            if (command.subtype === NOTE_ON && command.noteNumber != null) {
                notesMap.set(command.noteNumber, command);
            } else if (command.subtype === NOTE_OFF && command.noteNumber != null) {
                const noteOnCommand = notesMap.get(command.noteNumber);
                if (noteOnCommand) {
                    const noteModel = new NoteModel(command.noteNumber);
                    this.noteBars.push({
                        startTime: noteOnCommand.startAt || noteOnCommand.time || 0,
                        endTime: command.startAt || command.time || 0,
                        noteNumber: command.noteNumber,
                        velocity: command.velocity || 1,
                        colour: (command as any).colour || noteModel.colour,
                        source: "recorded",
                    });
                    notesMap.delete(command.noteNumber);
                }
            }
        }

        this.noteBars.sort((a, b) => a.startTime - b.startTime);
    }

    /**
     * Send a noteOn message to the worker (live data)
     */
    noteOn(noteNumber: number, velocity: number = 1, colour?: string) {
        if (!this.worker) return;

        // Get colour from NoteModel if not provided
        const noteColour = colour || new NoteModel(noteNumber).colour;

        // Track live note
        const startTime = Date.now() - this.baseTime;
        this.liveNotes.set(noteNumber, {
            startTime,
            velocity,
            colour: noteColour,
        });

        this.worker.postMessage({
            type: "noteOn",
            data: { note: noteNumber, velocity, colour: noteColour },
        });
    }

    /**
     * Send a noteOff message to the worker (live data)
     */
    noteOff(noteNumber: number) {
        if (!this.worker) return;

        const liveNote = this.liveNotes.get(noteNumber);
        if (liveNote) {
            const endTime = Date.now() - this.baseTime;
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

        this.worker.postMessage({
            type: "noteOff",
            data: { note: noteNumber },
        });
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
    getCommands(): AudioCommand[] {
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
        // Load recorded data and append to current live notes
        if (this.recorder) {
            const recordedCommands = this.recorder.exportData();
            this.processRecordedCommands(recordedCommands);
        }

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

