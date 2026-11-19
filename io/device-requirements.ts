import { browserAI } from "./browser-ai"
import { hasNativeMidiAddon } from "./native-midi-addon"

/**
 * Something an input, output, transformer or instrument needs from the browser or host.
 * Pickers list a device whose requirements are missing as disabled, with these labels as the reason.
 */
export interface DeviceRequirement {
	/** What is needed, written to finish "Needs …" */
	label: string
	isMet: () => boolean
	/** Leave the device out of pickers entirely instead of showing it disabled */
	hideWhenMissing?: boolean
}

const browser = () => (typeof navigator === "undefined" ? undefined : (navigator as any))
const scope = globalThis as any

export const DEVICE_REQUIREMENTS = {
	page: {
		label: "a browser page",
		isMet: () => typeof document !== "undefined"
	},
	webComponents: {
		label: "custom elements support",
		isMet: () => typeof customElements !== "undefined"
	},
	webAudio: {
		label: "Web Audio",
		isMet: () =>
			[scope, scope.window].some(
				(host) =>
					typeof host?.AudioContext !== "undefined" ||
					typeof host?.webkitAudioContext !== "undefined"
			)
	},
	audioWorklet: {
		label: "audio worklets",
		isMet: () =>
			typeof scope.AudioWorkletNode !== "undefined" ||
			typeof scope.AudioWorklet !== "undefined"
	},
	webAssembly: {
		label: "WebAssembly",
		isMet: () => typeof WebAssembly !== "undefined"
	},
	workers: {
		label: "web workers",
		isMet: () => typeof Worker !== "undefined"
	},
	offscreenCanvas: {
		label: "offscreen canvas",
		isMet: () =>
			typeof scope.OffscreenCanvas !== "undefined" &&
			typeof scope.createImageBitmap === "function"
	},
	webgl2: {
		label: "WebGL 2",
		isMet: () => typeof scope.WebGL2RenderingContext !== "undefined"
	},
	animationFrames: {
		label: "animation frames",
		isMet: () => typeof scope.requestAnimationFrame === "function"
	},
	mediaDevices: {
		label: "microphone or camera access (HTTPS)",
		isMet: () => Boolean(browser()?.mediaDevices?.getUserMedia)
	},
	webMidi: {
		label: "Web MIDI (Chrome, Edge, Firefox or Opera)",
		isMet: () => Boolean(browser()?.requestMIDIAccess)
	},
	bluetooth: {
		label: "Web Bluetooth (Chrome or Edge)",
		isMet: () => Boolean(browser()?.bluetooth?.requestDevice)
	},
	gamepads: {
		label: "the Gamepad API",
		isMet: () => Boolean(browser()?.getGamepads)
	},
	vibration: {
		label: "vibration or a gamepad",
		isMet: () => Boolean(browser()?.vibrate || browser()?.getGamepads)
	},
	webSocket: {
		label: "WebSockets",
		isMet: () => typeof WebSocket !== "undefined"
	},
	speechRecognition: {
		label: "speech recognition (Chrome, Edge or Safari)",
		isMet: () => Boolean(scope.SpeechRecognition || scope.webkitSpeechRecognition)
	},
	speech: {
		label: "speech synthesis or Web Audio with workers",
		isMet: () =>
			Boolean(scope.speechSynthesis) ||
			(typeof Worker !== "undefined" && typeof scope.AudioContext !== "undefined")
	},
	browserAI: {
		label: "built-in browser AI (the Prompt API in Chrome)",
		isMet: () => Boolean(browserAI())
	},
	nativeMidiAddon: {
		label: "the native MIDI addon from a desktop app",
		isMet: hasNativeMidiAddon
	},
	desktopMidi: {
		label: "the Electron desktop app",
		isMet: () => Boolean(scope.window?.electronAPI?.midi2)
	},
	scsynth: {
		label: "the SuperCollider engine (scsynth) loaded",
		isMet: () => Boolean(scope.window?.scsynth)
	},
	development: {
		label: "a development build",
		isMet: () => Boolean(import.meta.env?.DEV),
		hideWhenMissing: true
	}
} satisfies Record<string, DeviceRequirement>

export type DeviceRequirementId = keyof typeof DEVICE_REQUIREMENTS

export interface RequiresDevices {
	requires?: readonly DeviceRequirementId[]
	isAvailable?: () => boolean
}

export function missingRequirements(
	requires: readonly DeviceRequirementId[] = []
): DeviceRequirement[] {
	return requires
		.map((id) => DEVICE_REQUIREMENTS[id] as DeviceRequirement)
		.filter((requirement) => !requirement.isMet())
}

/** Factory fields for a device that only works when every requirement is met */
export function requiring(...requires: DeviceRequirementId[]) {
	return { requires, isAvailable: () => !missingRequirements(requires).length }
}

export interface DeviceAvailability {
	available: boolean
	/** Labels of what is missing, empty when available */
	missing: string[]
	hidden: boolean
}

/** Whether a factory or definition can be used here, and if not, why */
export function deviceAvailability(device: RequiresDevices): DeviceAvailability {
	const missing = missingRequirements(device.requires)
	const available = device.isAvailable ? device.isAvailable() : !missing.length
	return {
		available,
		missing: available
			? []
			: missing.length
				? missing.map((requirement) => requirement.label)
				: ["features this browser does not have"],
		hidden: !available && missing.some((requirement) => requirement.hideWhenMissing)
	}
}

export const describeMissing = (missing: string[]) =>
	missing.length
		? `Needs ${new Intl.ListFormat("en", { type: "conjunction" }).format(missing)}`
		: ""