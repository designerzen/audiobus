import registerTB303Processor from './processor.js'
import { TB303_DESCRIPTOR, TB303_ID, TB303_PARAMETERS } from './parameters'
import { createTB303Gui, destroyTB303Gui } from './gui'

const modules = new WeakMap<AudioContext, Promise<void>>()
export async function createTB303Plugin(groupId: string, context: AudioContext) {
    const base = 'https://cdn.jsdelivr.net/npm/@webaudiomodules/sdk@0.0.12/src/'
    const [{ default: WebAudioModule }, { default: WamNode }, { default: addFunctionModule }] = await Promise.all([
        import(/* @vite-ignore */ `${base}WebAudioModule.js`),
        import(/* @vite-ignore */ `${base}WamNode.js`),
        import(/* @vite-ignore */ `${base}addFunctionModule.js`),
    ])
    let loading = modules.get(context)
    if (!loading) {
        loading = (async () => {
            await WamNode.addModules(context, TB303_ID)
            await addFunctionModule(context.audioWorklet, registerTB303Processor, TB303_ID, TB303_PARAMETERS)
        })()
        modules.set(context, loading)
        loading.catch(() => modules.delete(context))
    }
    await loading
    class TB303Module extends WebAudioModule {
        constructor() { super(groupId, context); Object.assign(this._descriptor, TB303_DESCRIPTOR) }
        async createAudioNode() {
            const node = new WamNode(this, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] })
            try { await node._initialize(); return node }
            catch (error) { node.destroy(); throw error }
        }
        async createGui() { return createTB303Gui(this.audioNode) }
        async destroyGui(gui: HTMLElement) { destroyTB303Gui(gui) }
    }
    return new TB303Module().initialize()
}
