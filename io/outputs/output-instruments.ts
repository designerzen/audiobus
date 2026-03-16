import type { IAudioOutput } from "./output-interface.ts";
import {
	InstrumentFactory,
	getAvailableInstruments,
	type InstrumentMetadata,
} from "../../instruments/instrument-factory.ts";

export default class InstrumentsOutput extends EventTarget implements IAudioOutput {
	static ID: number = 0;

	#uuid: string = "Output-Instruments-" + InstrumentsOutput.ID++;
	#audioContext: BaseAudioContext | AudioContext;
	#currentInstrument: IAudioOutput | null = null;
	#currentInstrumentId: string | null = null;
	#container: HTMLElement | null = null;
	#externalData: Record<string, any> = {};
	#instrumentOptions: Record<string, any> = {};

	get uuid(): string {
		return this.#uuid;
	}

	get name(): string {
		return "Instruments";
	}

	get description(): string {
		return "Wrapper output that manages a single instrument instance with dynamic switching";
	}

	get isConnected(): boolean {
		return this.#currentInstrument?.isConnected ?? false;
	}

	get isHidden(): boolean {
		return false;
	}

	constructor(
		audioContext: BaseAudioContext | AudioContext,
		externalData: Record<string, any> = {},
		instrumentOptions: Record<string, any> = {},
	) {
		super();
		this.#audioContext = audioContext;
		this.#externalData = externalData;
		this.#instrumentOptions = instrumentOptions;
	}

	hasMidiOutput(): boolean {
		return this.#currentInstrument?.hasMidiOutput?.() ?? false;
	}

	hasAudioOutput(): boolean {
		return this.#currentInstrument?.hasAudioOutput?.() ?? false;
	}

	hasAutomationOutput(): boolean {
		return this.#currentInstrument?.hasAutomationOutput?.() ?? false;
	}

	hasMpeOutput(): boolean {
		return this.#currentInstrument?.hasMpeOutput?.() ?? false;
	}

	hasOscOutput(): boolean {
		return this.#currentInstrument?.hasOscOutput?.() ?? false;
	}

	hasSysexOutput(): boolean {
		return this.#currentInstrument?.hasSysexOutput?.() ?? false;
	}

	/**
	 * Create GUI with instrument selector
	 */
	async createGui(): Promise<HTMLElement> {
		this.#container = document.createElement("div");
		this.#container.id = this.#uuid;
		this.#container.style.display = "flex";
		this.#container.style.flexDirection = "column";
		this.#container.style.gap = "12px";
		this.#container.style.padding = "12px";
		this.#container.style.borderRadius = "4px";
		this.#container.style.backgroundColor = "#f9f9f9";
		this.#container.style.border = "1px solid #ddd";

		// Label
		const label = document.createElement("label");
		label.style.fontWeight = "bold";
		label.style.fontSize = "14px";
		label.style.color = "#333";
		label.textContent = "Instrument:";
		this.#container.appendChild(label);

		// Select dropdown
		const select = document.createElement("select");
		select.style.padding = "8px";
		select.style.borderRadius = "4px";
		select.style.border = "1px solid #ccc";
		select.style.fontSize = "14px";
		select.style.fontFamily = "inherit";
		select.style.backgroundColor = "#fff";
		select.style.cursor = "pointer";

		// Add placeholder option
		const placeholderOption = document.createElement("option");
		placeholderOption.value = "";
		placeholderOption.textContent = "Select an instrument...";
		placeholderOption.disabled = true;
		select.appendChild(placeholderOption);

		// Add instrument options
		const instruments = getAvailableInstruments();
		instruments.forEach((instrument) => {
			const option = document.createElement("option");
			option.value = instrument.id;
			option.textContent = instrument.name;
			select.appendChild(option);
		});

		// Set current selection if instrument is loaded
		if (this.#currentInstrumentId) {
			select.value = this.#currentInstrumentId;
		} else {
			select.value = "";
		}

		// Handle selection change
		select.addEventListener("change", async (event) => {
			const instrumentId = (event.target as HTMLSelectElement).value;
			if (instrumentId) {
				await this.#switchInstrument(instrumentId);
			}
		});

		this.#container.appendChild(select);

		// Status display
		const statusDiv = document.createElement("div");
		statusDiv.style.fontSize = "12px";
		statusDiv.style.color = "#666";
		statusDiv.style.minHeight = "20px";

		const updateStatus = () => {
			if (this.#currentInstrument) {
				statusDiv.textContent = `Active: ${this.#currentInstrument.name}`;
				statusDiv.style.color = "#28a745";
			} else {
				statusDiv.textContent = "No instrument loaded";
				statusDiv.style.color = "#999";
			}
		};

		updateStatus();
		this.#container.appendChild(statusDiv);

		// Listen for instrument changes to update status
		this.addEventListener("instrumentchanged", () => {
			updateStatus();
		});

		return this.#container;
	}

	/**
	 * Destroy GUI container
	 */
	async destroyGui(): Promise<void> {
		if (this.#container && this.#container.parentElement) {
			this.#container.parentElement.removeChild(this.#container);
		}
		this.#container = null;
	}

	/**
	 * Switch to a different instrument
	 */
	async #switchInstrument(instrumentId: string): Promise<void> {
		try {
			// Destroy existing instrument if any
			if (this.#currentInstrument) {
				await this.#destroyInstrument();
			}

			// Create new instrument
			this.#currentInstrument = await InstrumentFactory.createInstrument(
				instrumentId,
				this.#audioContext,
				this.#externalData,
				this.#instrumentOptions,
			);

			this.#currentInstrumentId = instrumentId;

			// Connect the instrument if it has a connect method
			if (this.#currentInstrument.connect) {
				await this.#currentInstrument.connect();
			}

			// Dispatch change event
			this.dispatchEvent(
				new CustomEvent("instrumentchanged", {
					detail: { instrumentId, instrument: this.#currentInstrument },
				}),
			);

			console.info(this.#uuid, `Switched to instrument: ${this.#currentInstrument.name}`);
		} catch (error) {
			console.error(this.#uuid, "Failed to switch instrument:", error);
			throw error;
		}
	}

	/**
	 * Destroy the current instrument
	 */
	async #destroyInstrument(): Promise<void> {
		if (!this.#currentInstrument) return;

		try {
			// Call noteOff for all possible notes to ensure cleanup
			this.allNotesOff();

			// Disconnect if available
			if (this.#currentInstrument.disconnect) {
				await this.#currentInstrument.disconnect();
			}

			// Destroy GUI if available
			if (this.#currentInstrument.destroyGui) {
				await this.#currentInstrument.destroyGui();
			}

			console.info(this.#uuid, `Destroyed instrument: ${this.#currentInstrument.name}`);
		} catch (error) {
			console.error(this.#uuid, "Error destroying instrument:", error);
		}
	}

	/**
	 * Get the currently loaded instrument
	 */
	getCurrentInstrument(): IAudioOutput | null {
		return this.#currentInstrument;
	}

	/**
	 * Get the ID of the currently loaded instrument
	 */
	getCurrentInstrumentId(): string | null {
		return this.#currentInstrumentId;
	}

	// IAudioOutput methods delegate to current instrument
	noteOn(note: number, velocity: number): void | Promise<void> {
		if (!this.#currentInstrument) {
			console.warn(this.#uuid, "No instrument loaded, ignoring noteOn");
			return;
		}
		return this.#currentInstrument.noteOn(note, velocity);
	}

	noteOff(note: number): void {
		if (!this.#currentInstrument) {
			return;
		}
		this.#currentInstrument.noteOff(note);
	}

	allNotesOff(): void {
		if (!this.#currentInstrument) {
			return;
		}
		this.#currentInstrument.allNotesOff();
	}

	/**
	 * Connect the output
	 */
	async connect(): Promise<void | Function> {
		if (this.#currentInstrument?.connect) {
			return await this.#currentInstrument.connect();
		}
	}

	/**
	 * Disconnect the output
	 */
	async disconnect(): Promise<void | Function> {
		if (this.#currentInstrument?.disconnect) {
			return await this.#currentInstrument.disconnect();
		}
		await this.#destroyInstrument();
	}
}