import OutputWAM2 from "./output-wam2"
import OutputYoshimi from "./output-yoshimi"
import type { WAM2PluginDescriptor } from "../../wam/registry"

const DX7_BASE = "https://cdn.jsdelivr.net/gh/webaudiomodules/webdx7@master/dist/"
export const LEGACY_WAM_PLUGINS: WAM2PluginDescriptor[] = [
	{
		identifier: "wam.yoshimi",
		name: "Yoshimi",
		vendor: "Yoshimi / Jari Kleimola",
		description: "Polyphonic synthesizer with over 700 presets",
		keywords: ["synth"],
		category: ["Instrument"],
		path: "legacy:yoshimi"
	},
	{
		identifier: "wam.dx7",
		name: "webDX7",
		vendor: "Jari Kleimola",
		description: "Six operator FM synthesizer",
		keywords: ["synth", "FM"],
		category: ["Instrument"],
		path: "legacy:dx7"
	}
]
const dx7Worklets = new WeakMap<AudioContext, Promise<void>>()

export default class OutputWAM extends OutputWAM2 {
	protected label = "WAM"
	protected acceptsPluginUrl = false
	constructor(context: AudioContext, pluginUrl = "", name = "WAM", destination?: AudioNode) {
		super(context, pluginUrl, name, destination)
	}
	protected async availablePlugins() {
		return LEGACY_WAM_PLUGINS
	}
	protected async createPlugin(url: string): Promise<any> {
		if (url === "legacy:yoshimi") {
			const synth = new OutputYoshimi(this.context, undefined, null)
			await synth.connect()
			const output = synth.output
			return {
				descriptor: { name: synth.name },
				audioNode: {
					connect: (target: AudioNode) => output.connect(target),
					disconnect: () => output.disconnect(),
					scheduleEvents: (...events: any[]) =>
						events.forEach((event) => synth.processMidi(event.data.bytes)),
					destroy: () => synth.disconnect()
				},
				createGui: () => synth.createGui(),
				destroyGui: () => synth.destroyGui()
			}
		}
		if (url !== "legacy:dx7") {
			throw new Error("Unknown legacy WAM instrument")
		}
		let loading = dx7Worklets.get(this.context)
		if (!loading) {
			loading = (async () => {
				for (const path of [
					"dx7/wasm/dx7.wasm.js",
					"dx7/wasm/dx7.js",
					"wamsdk/wam-processor.js",
					"dx7/dx7-awp.js"
				]) {
					await this.context.audioWorklet.addModule(DX7_BASE + path)
				}
			})()
			dx7Worklets.set(this.context, loading)
			loading.catch(() => dx7Worklets.delete(this.context))
		}
		await loading
		const node = new AudioWorkletNode(this.context, "DX7", {
			numberOfInputs: 0,
			numberOfOutputs: 1,
			outputChannelCount: [1],
			processorOptions: { desc: "" }
		})
		// The legacy engine starts silent. Supply a packed DX7 voice with a sine carrier.
		const patch = new Uint8Array(128)
		for (let operator = 0; operator < 6; operator++) {
			patch.set([99, 99, 99, 60, 99, 99, 99, 0], operator * 17)
			patch[operator * 17 + 12] = 7 << 3
			patch[operator * 17 + 15] = 2
		}
		patch[14] = 99
		patch[110] = 31
		patch[117] = 24
		patch.set(new TextEncoder().encode("HARMONSINE"), 118)
		node.port.postMessage({ type: "patch", data: patch })
		return {
			descriptor: { name: "webDX7" },
			audioNode: {
				connect: (target: AudioNode) => node.connect(target),
				disconnect: () => node.disconnect(),
				scheduleEvents: (...events: any[]) =>
					events.forEach((event) =>
						node.port.postMessage({ type: "midi", data: event.data.bytes })
					),
				destroy: () => node.port.close()
			}
		}
	}
}