/**
 * Example usage of InstrumentsOutput
 *
 * This demonstrates how to create and use the InstrumentsOutput wrapper,
 * which manages dynamic instrument switching with a single active instrument at a time.
 */

import InstrumentsOutput from "./output-instruments.ts";
import { INSTRUMENT_TYPE_TONE_SYNTH } from "../../instruments/instrument-factory.ts";

// Example 1: Basic setup with Web Audio API context
async function basicExample() {
	const audioContext = new AudioContext();

	// Create the instruments output
	const instrumentsOutput = new InstrumentsOutput(audioContext);

	// Create GUI and add to DOM
	const gui = await instrumentsOutput.createGui();
	document.body.appendChild(gui);

	// Listen for instrument changes
	instrumentsOutput.addEventListener("instrumentchanged", (event: any) => {
		console.log(`Switched to: ${event.detail.instrument.name}`);
	});

	// Play a note (will work once an instrument is selected)
	setTimeout(() => {
		instrumentsOutput.noteOn(60, 100); // C4, velocity 100
		setTimeout(() => {
			instrumentsOutput.noteOff(60);
		}, 500);
	}, 1000);
}

// Example 2: Pre-load a specific instrument
async function preloadInstrumentExample() {
	const audioContext = new AudioContext();

	// Create the instruments output
	const instrumentsOutput = new InstrumentsOutput(audioContext);

	// Programmatically load an instrument
	await (instrumentsOutput as any)._InstrumentsOutput__switchInstrument(
		INSTRUMENT_TYPE_TONE_SYNTH
	);

	// Now play notes immediately
	instrumentsOutput.noteOn(64, 80); // E4
	setTimeout(() => instrumentsOutput.noteOff(64), 1000);
}

// Example 3: Handle switching with external data (e.g., for Sampler instrument)
async function withExternalDataExample() {
	const audioContext = new AudioContext();

	// Provide external data for instruments that need it
	const externalData = {
		sampleUrls: {
			C4: "path/to/c4.wav",
			D4: "path/to/d4.wav",
			// ... more samples
		},
	};

	const instrumentsOutput = new InstrumentsOutput(
		audioContext,
		externalData,
		{ /* instrument options */ }
	);

	const gui = await instrumentsOutput.createGui();
	document.body.appendChild(gui);

	// When user selects the Sampler instrument, it will have access to sampleUrls
}

// Example 4: Using with output manager
async function outputManagerExample() {
	const audioContext = new AudioContext();
	const instrumentsOutput = new InstrumentsOutput(audioContext);

	// Get current instrument information
	const currentInstrument = instrumentsOutput.getCurrentInstrument();
	const currentInstrumentId = instrumentsOutput.getCurrentInstrumentId();

	console.log("Current instrument:", currentInstrument?.name);
	console.log("Current instrument ID:", currentInstrumentId);

	// Check capabilities
	console.log("Has audio output:", instrumentsOutput.hasAudioOutput());
	console.log("Has MIDI output:", instrumentsOutput.hasMidiOutput());
}

// Example 5: Cleanup
async function cleanupExample() {
	const audioContext = new AudioContext();
	const instrumentsOutput = new InstrumentsOutput(audioContext);

	const gui = await instrumentsOutput.createGui();
	document.body.appendChild(gui);

	// Later, clean up
	await instrumentsOutput.destroyGui();
	await instrumentsOutput.disconnect();
}

export { basicExample, preloadInstrumentExample, withExternalDataExample, outputManagerExample, cleanupExample };
