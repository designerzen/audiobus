import register303 from "../../instruments/303/processor.js"
import { load303Wavetable } from "../../instruments/303/wavetable"
import { loadCaptureWorklet } from "../../io/inputs/load-capture-worklet"
import registerTB303Processor from "./processor.js"
import { TB303_DESCRIPTOR, TB303_ID, TB303_PARAMETERS } from "./parameters"
import { createTB303Gui, destroyTB303Gui } from "./gui"

const modules = new WeakMap<AudioContext, Promise<void>>()
export async function createTB303Plugin(groupId: string, context: AudioContext) {
	const base = "https://cdn.jsdelivr.net/npm/@webaudiomodules/sdk@0.0.12/src/"
	const [{ default: WebAudioModule }, { default: WamNode }, wavetable] = await Promise.all([
		import(/* @vite-ignore */ `${base}WebAudioModule.js`),
		import(/* @vite-ignore */ `${base}WamNode.js`),
		load303Wavetable()
	])
	let loading = modules.get(context)
	if (!loading) {
		loading = (async () => {
			await WamNode.addModules(context, TB303_ID)
			await loadCaptureWorklet(
				context,
				TB303_ID,
				`(${registerTB303Processor.toString()})(${JSON.stringify(TB303_ID)}, ${JSON.stringify(TB303_PARAMETERS)}, (${register303.toString()}))`
			)
		})()
		modules.set(context, loading)
		loading.catch(() => modules.delete(context))
	}
	await loading
	class TB303Module extends WebAudioModule {
		constructor() {
			super(groupId, context)
			Object.assign(this._descriptor, TB303_DESCRIPTOR)
		}
		async createAudioNode() {
			const node = new WamNode(this, {
				numberOfInputs: 0,
				numberOfOutputs: 1,
				outputChannelCount: [2],
				processorOptions: { wavetable }
			})
			try {
				await node._initialize()
				return node
			} catch (error) {
				node.destroy()
				throw error
			}
		}
		async createGui() {
			return createTB303Gui(this.audioNode)
		}
		async destroyGui(gui: HTMLElement) {
			destroyTB303Gui(gui)
		}
	}
	return new TB303Module().initialize()
}