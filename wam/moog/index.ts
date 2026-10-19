import registerMoogProcessor from './processor.js'
import { MOOG_DESCRIPTOR, MOOG_ID, MOOG_PARAMETERS } from './parameters'
import { createMoogGui, destroyMoogGui } from './gui'

const modules = new WeakMap<AudioContext, Promise<void>>()
export async function createMoogPlugin(groupId: string, context: AudioContext) {
    const base = 'https://cdn.jsdelivr.net/npm/@webaudiomodules/sdk@0.0.12/src/'
    const [{ default: WebAudioModule }, { default: WamNode }, { default: addFunctionModule }] = await Promise.all([
        import(/* @vite-ignore */ `${base}WebAudioModule.js`),
        import(/* @vite-ignore */ `${base}WamNode.js`),
        import(/* @vite-ignore */ `${base}addFunctionModule.js`),
    ])
    let loading = modules.get(context)
    if (!loading) {
        loading = (async () => {
            await WamNode.addModules(context, MOOG_ID)
            await addFunctionModule(context.audioWorklet, registerMoogProcessor, MOOG_ID, MOOG_PARAMETERS)
        })()
        modules.set(context, loading)
        loading.catch(() => modules.delete(context))
    }
    await loading
    class MoogModule extends WebAudioModule {
        constructor() {
            super(groupId, context)
            Object.assign(this._descriptor, MOOG_DESCRIPTOR)
        }
        async createAudioNode() {
            const node = new WamNode(this, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] })
            try { await node._initialize(); return node }
            catch (error) { node.destroy(); throw error }
        }
        async createGui() { return createMoogGui(this.audioNode) }
        async destroyGui(gui: HTMLElement) { destroyMoogGui(gui) }
    }
    return new MoogModule().initialize()
}
