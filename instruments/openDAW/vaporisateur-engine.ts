import { AnimationFrame } from "@opendaw/lib-dom"
import { ClassicWaveform } from "@opendaw/lib-dsp"
import { InstrumentFactories } from "@opendaw/studio-adapters"
import { AudioWorklets, GlobalSampleLoaderManager, GlobalSoundfontLoaderManager, Project } from "@opendaw/studio-core"
import type { VaporisateurOptions } from "./opendaw-vaporisateur.ts"

export interface VaporisateurEngine {
	output: AudioNode
	noteOn(note: number, velocity: number): void
	noteOff(note: number): void
	panic(): void
	dispose(): void
}

const worklets = new WeakMap<BaseAudioContext, Promise<AudioWorklets>>()
let engineCount = 0

export async function createVaporisateurEngine(context: BaseAudioContext, options: VaporisateurOptions): Promise<VaporisateurEngine> {
	if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
		throw new Error("Vaporisateur needs shared memory. Reload the page after enabling cross-origin isolation.")
	}
	if (!(context instanceof AudioContext) || !context.audioWorklet) {
		throw new Error("Vaporisateur requires a live AudioContext with AudioWorklet support.")
	}
	let loading = worklets.get(context)
	if (!loading) {
		AudioWorklets.install(`${import.meta.env.BASE_URL}opendaw/processors.js`)
		loading = AudioWorklets.createFor(context)
		worklets.set(context, loading)
		loading.catch(() => worklets.delete(context))
	}
	const audioWorklets = await loading
	// This synth has no sampled assets. Fail explicitly if the project ever requests one.
	const unavailable = async (): Promise<never> => { throw new Error("Vaporisateur does not use sampled assets") }
	const project = Project.new({
		audioContext: context, audioWorklets,
		sampleManager: new GlobalSampleLoaderManager({ fetch: unavailable }),
		soundfontManager: new GlobalSoundfontLoaderManager({ fetch: unavailable }),
		get sampleService(): never { throw new Error("Sample import is unavailable in Vaporisateur") },
		get soundfontService(): never { throw new Error("Soundfont import is unavailable in Vaporisateur") }
	})
	let engine: ReturnType<typeof project.startAudioWorklet> | undefined
	let counted = false
	let disposed = false
	const dispose = () => {
		if (disposed) return
		disposed = true
		engine?.disconnect()
		project.terminate()
		if (counted && --engineCount === 0) AnimationFrame.stop()
		counted = false
	}
	try {
		const { audioUnitBox } = project.editing.modify(() => {
			const product = project.api.createInstrument(InstrumentFactories.Vaporisateur)
			const box = product.instrumentBox
			box.attack.setValue(options.attack ?? 0.005)
			box.decay.setValue(options.decay ?? 0.1)
			box.sustain.setValue(options.sustain ?? 0.5)
			box.release.setValue(options.release ?? 0.5)
			box.cutoff.setValue(options.filterCutOff ?? 8000)
			box.resonance.setValue(options.filterResonance ?? 0.1)
			box.glideTime.setValue(options.slideDuration ?? 0)
			const waveforms = { sine: ClassicWaveform.sine, triangle: ClassicWaveform.triangle, sawtooth: ClassicWaveform.saw, square: ClassicWaveform.square }
			box.oscillators.fields()[0].waveform.setValue(waveforms[options.oscillator?.type ?? "sawtooth"])
			return product
		}).unwrap("Could not create Vaporisateur")
		engine = project.startAudioWorklet()
		// Project.startAudioWorklet connects to the destination; Harmoneasy owns routing.
		engine.disconnect()
		if (engineCount++ === 0) AnimationFrame.start(window)
		counted = true
		await new Promise<void>((resolve, reject) => {
			const node = engine!
			const failed = () => finish(new Error("Vaporisateur audio processor failed to start"))
			const timeout = setTimeout(() => finish(new Error("Vaporisateur audio processor startup timed out")), 15000)
			const finish = (error?: unknown) => {
				clearTimeout(timeout)
				node.removeEventListener("processorerror", failed)
				if (error) reject(error)
				else resolve()
			}
			node.addEventListener("processorerror", failed)
			node.isReady().then(() => finish(), finish)
		})
		engine.wake()
		const uuid = audioUnitBox.address.uuid
		return {
			output: engine,
			noteOn: (pitch, velocity) => engine!.noteSignal({ type: "note-on", uuid, pitch, velocity }),
			noteOff: pitch => engine!.noteSignal({ type: "note-off", uuid, pitch }),
			panic: () => engine!.panic(),
			dispose
		}
	} catch (error) { dispose(); throw error }
}
