import type { ComponentUi } from "control-surface/types"
import type { IAudioCommand } from "../../audio-command-interface.ts"
import type { AudioClockTick } from "../../timing/audio-clock-tick.ts"
import type {
	ChainPerformanceMeasurement,
	TimerPerformanceMeasurement
} from "./performance-metrics.ts"

export interface IAudioOutput extends ComponentUi {
	get uuid(): string
	get name(): string
	get description(): string
	get isConnected(): boolean
	get isHidden(): boolean

	// TODO: implement pitchBend etc
	noteOn(noteNumber: number, velocity: number): unknown
	noteOff(noteNumber: number): void
	allNotesOff(): void

	// Full MIDI commands retain channel, controller, pressure, and system data.
	sendCommand?(command: IAudioCommand): void | Promise<void>
	getNoteKey?(command: IAudioCommand): string
	/** Set false when control changes preserve the identity of held notes. */
	readonly configurationAffectsNoteRouting?: boolean
	onClockTick?(tick: Readonly<AudioClockTick>): void
	stopClock?(): void
	setHarmony?(state: import("../harmony").HarmonicState): void
	recordChainPerformance?(measurement: Readonly<ChainPerformanceMeasurement>): void
	recordTimerPerformance?(measurement: Readonly<TimerPerformanceMeasurement>): void

	// optional
	readonly requiresConnectionControl?: boolean
	readonly output?: AudioNode | import("webmidi").Output
	connect?(): unknown
	disconnect?(): Promise<void | Function> | Function
	createGui?(): Promise<HTMLElement>
	destroyGui?(): Promise<void>

	hasMidiOutput?(): boolean
	hasAudioOutput?(): boolean
	hasAutomationOutput?(): boolean
	hasMpeOutput?(): boolean
	hasOscOutput?(): boolean
	hasSysexOutput?(): boolean
}