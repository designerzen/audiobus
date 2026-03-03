/**
 * Factory for creating IOChain instances
 * Handles creation with optional predefined configurations
 */
import IOChain from "./IO-chain"
import { createInputById, getAvailableInputFactories } from "./input-factory"
import { createOutputById, getAvailableOutputFactories } from "./output-factory"
import InputOnScreenKeyboard, { ONSCREEN_KEYBOARD_INPUT_ID } from "./inputs/input-onscreen-keyboard"
import OutputOnScreenKeyboard from "./outputs/output-onscreen-keyboard"
import PolySynth from "../instruments/polyphonic"
import * as INPUT_TYPES from "./inputs/input-types"
import * as OUTPUT_TYPES from "./outputs/output-types"

import type { ITimerControl as Timer } from "netronome"
import type { IAudioInput } from "./inputs/input-interface"
import type { IAudioOutput } from "./outputs/output-interface"

export interface IOChainFactoryOptions {
	/**
	 * The timer instance for scheduling
	 */
	timer: Timer

	/**
	 * The audio output mixer (GainNode)
	 */
	outputMixer: GainNode

	/**
	 * Additional custom input devices to include
	 */
	inputDevices?: IAudioInput[]

	/**
	 * Additional custom output devices to include
	 */
	outputDevices?: IAudioOutput[]

	/**
	 * Attempt to auto-connect hardware inputs (microphone, WebMIDI, etc.)
	 */
	autoConnect?: boolean

	/**
	 * AudioContext for outputs that require it
	 */
	audioContext?: AudioContext
}

export interface IOChainPreset {
	id: string
	name: string
	description: string
	inputs: string[]
	outputs: string[]
}

/**
 * Factory for creating IOChain instances with various configurations
 */
export class IOChainFactory {
	private static readonly DEFAULT_PRESETS: IOChainPreset[] = [
		{
			id: "minimal",
			name: "Minimal",
			description: "Only keyboard input and onscreen keyboard output",
			inputs: [INPUT_TYPES.KEYBOARD, INPUT_TYPES.ONSCREEN_KEYBOARD],
			outputs: [OUTPUT_TYPES.NOTATION]
		},
		{
			id: "standard",
			name: "Standard",
			description: "Keyboard and gamepad inputs with synthesizer and notation outputs",
			inputs: [INPUT_TYPES.KEYBOARD, INPUT_TYPES.GAMEPAD, INPUT_TYPES.ONSCREEN_KEYBOARD],
			outputs: [OUTPUT_TYPES.NOTATION, OUTPUT_TYPES.SPECTRUM_ANALYSER]
		},
		{
			id: "full",
			name: "Full",
			description: "All available inputs and outputs enabled",
			inputs: [
				INPUT_TYPES.KEYBOARD,
				INPUT_TYPES.GAMEPAD,
				INPUT_TYPES.WEBMIDI,
				INPUT_TYPES.BLE_MIDI,
				INPUT_TYPES.ONSCREEN_KEYBOARD
			],
			outputs: [
				OUTPUT_TYPES.NOTATION,
				OUTPUT_TYPES.SPECTRUM_ANALYSER,
				OUTPUT_TYPES.SPEECH_SYNTHESIS,
				OUTPUT_TYPES.WEBMIDI,
				OUTPUT_TYPES.BLE_MIDI
			]
		}
	]

	/**
	 * Get all available presets
	 */
	static getPresets(): IOChainPreset[] {
		return [...IOChainFactory.DEFAULT_PRESETS]
	}

	/**
	 * Get a preset by ID
	 */
	static getPreset(id: string): IOChainPreset | null {
		return IOChainFactory.DEFAULT_PRESETS.find(p => p.id === id) || null
	}

	/**
	 * Create a default IOChain with standard configuration
	 * Includes keyboard, gamepad, onscreen keyboard inputs
	 * and synthesizer, notation, spectrum analyzer outputs
	 */
	static async createDefault(options: IOChainFactoryOptions): Promise<IOChain> {
		const chain = new IOChain(options.timer)

		const createOptions = {
			now: () => options.timer.now,
			audioContext: options.audioContext
		}

		// Inputs
		const inputKeyboard = await createInputById(INPUT_TYPES.KEYBOARD, createOptions)
		const inputGamePad = await createInputById(INPUT_TYPES.GAMEPAD, createOptions)
		const inputSVGKeyboard = new InputOnScreenKeyboard(createOptions)

		const inputs: IAudioInput[] = [inputKeyboard, inputGamePad, inputSVGKeyboard]

		// Add optional inputs
		if (options.inputDevices) {
			inputs.push(...options.inputDevices)
		}

		// Add special inputs if available
		try {
			if (navigator.mediaDevices?.getUserMedia && options.autoConnect) {
				const inputMicrophone = await createInputById(INPUT_TYPES.MICROPHONE_FORMANT, createOptions)
				inputs.push(inputMicrophone)
			}
		} catch (e) {
			console.debug("Microphone input not available", e)
		}

		try {
			if (navigator.bluetooth) {
				const inputBLE = await createInputById(INPUT_TYPES.BLE_MIDI, createOptions)
				inputs.push(inputBLE)
			}
		} catch (e) {
			console.debug("BLE MIDI input not available", e)
		}

		try {
			if ((navigator as any).requestMIDIAccess) {
				const inputWebMIDI = await createInputById(INPUT_TYPES.WEBMIDI, createOptions)
				inputs.push(inputWebMIDI)
			}
		} catch (e) {
			console.debug("WebMIDI input not available", e)
		}

		// Outputs
		const outputOnscreenKeyboard = new OutputOnScreenKeyboard(inputSVGKeyboard.keyboard)
		const outputs: IAudioOutput[] = [outputOnscreenKeyboard]

		// Add optional outputs
		if (options.outputDevices) {
			outputs.push(...options.outputDevices)
		}

		// Add synthesizer if audioContext available
		if (options.audioContext) {
			const musicalOutput = new PolySynth(options.audioContext)
			musicalOutput.output.connect(options.outputMixer)
			outputs.push(musicalOutput)
		}

		// Standard outputs
		try {
			const outputNotation = await createOutputById(OUTPUT_TYPES.NOTATION)
			outputs.push(outputNotation)
		} catch (e) {
			console.debug("Notation output not available", e)
		}

		try {
			const outputSpectrum = await createOutputById(OUTPUT_TYPES.SPECTRUM_ANALYSER, {
				mixer: options.outputMixer
			})
			outputs.push(outputSpectrum)
		} catch (e) {
			console.debug("Spectrum analyzer output not available", e)
		}

		// Add optional outputs
		try {
			if (typeof window !== "undefined" && window.speechSynthesis) {
				const outputSpeech = await createOutputById(OUTPUT_TYPES.SPEECH_SYNTHESIS)
				outputs.push(outputSpeech)
			}
		} catch (e) {
			console.debug("Speech synthesis output not available", e)
		}

		try {
			if (
				typeof navigator !== "undefined" &&
				(navigator?.vibrate || (navigator as any)?.webkitVibrate || (navigator as any)?.mozVibrate)
			) {
				const outputVibrator = await createOutputById(OUTPUT_TYPES.VIBRATOR)
				outputs.push(outputVibrator)
			}
		} catch (e) {
			console.debug("Vibrator output not available", e)
		}

		try {
			if ((navigator as any).requestMIDIAccess) {
				const outputWebMIDI = await createOutputById(OUTPUT_TYPES.WEBMIDI)
				outputs.push(outputWebMIDI)
			}
		} catch (e) {
			console.debug("WebMIDI output not available", e)
		}

		try {
			if (navigator.bluetooth) {
				const outputBLE = await createOutputById(OUTPUT_TYPES.BLE_MIDI)
				outputs.push(outputBLE)
			}
		} catch (e) {
			console.debug("BLE MIDI output not available", e)
		}

		if (import.meta.env.DEV) {
			try {
				const outputConsole = await createOutputById(OUTPUT_TYPES.CONSOLE)
				outputs.push(outputConsole)
			} catch (e) {
				console.debug("Console output not available", e)
			}
		}

		chain.addInputs(inputs)
		chain.addOutputs(outputs)

		return chain
	}

	/**
	 * Create an IOChain from a preset configuration
	 */
	static async createFromPreset(preset: IOChainPreset, options: IOChainFactoryOptions): Promise<IOChain> {
		const chain = new IOChain(options.timer)

		const createOptions = {
			now: () => options.timer.now,
			audioContext: options.audioContext
		}

		// Create inputs from preset
		const inputs: IAudioInput[] = []
		for (const inputId of preset.inputs) {
			try {
				const input = await createInputById(inputId, createOptions)
				inputs.push(input)
			} catch (e) {
				console.warn(`Failed to create input ${inputId}:`, e)
			}
		}

		// Add custom inputs
		if (options.inputDevices) {
			inputs.push(...options.inputDevices)
		}

		// Create outputs from preset
		const outputs: IAudioOutput[] = []
		for (const outputId of preset.outputs) {
			try {
				let output: IAudioOutput

				if (outputId === OUTPUT_TYPES.SPECTRUM_ANALYSER) {
					output = await createOutputById(outputId, { mixer: options.outputMixer })
				} else if (outputId === OUTPUT_TYPES.PINK_TROMBONE || outputId === OUTPUT_TYPES.WAM2) {
					output = await createOutputById(outputId, { audioContext: options.audioContext })
				} else {
					output = await createOutputById(outputId)
				}

				outputs.push(output)
			} catch (e) {
				console.warn(`Failed to create output ${outputId}:`, e)
			}
		}

		// Add custom outputs
		if (options.outputDevices) {
			outputs.push(...options.outputDevices)
		}

		chain.addInputs(inputs)
		chain.addOutputs(outputs)

		return chain
	}

	/**
	 * Create an IOChain from exported configuration string
	 * Restores all inputs and outputs from saved state
	 */
	static async createFromExportString(
		exportedString: string,
		options: IOChainFactoryOptions
	): Promise<IOChain> {
		const chain = new IOChain(options.timer)

		try {
			chain.importString(exportedString, {
				now: () => options.timer.now,
				audioContext: options.audioContext
			})
		} catch (error) {
			console.error("Failed to restore chain from exported string:", error)
			throw new Error(
				`Invalid chain export string: ${error instanceof Error ? error.message : String(error)}`
			)
		}

		return chain
	}

	/**
	 * Create a minimal IOChain with only keyboard input and notation output
	 */
	static async createMinimal(options: IOChainFactoryOptions): Promise<IOChain> {
		return IOChainFactory.createFromPreset(
			IOChainFactory.DEFAULT_PRESETS.find(p => p.id === "minimal")!,
			options
		)
	}
}

export default IOChainFactory
