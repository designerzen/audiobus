import OutputWAM2 from './output-wam2'
import { initializeHost } from '../../wam/host'
import { createMoogPlugin } from '../../wam/moog'
import { MOOG_DESCRIPTOR, MOOG_URL } from '../../wam/moog/parameters'

export default class OutputMoog extends OutputWAM2 {
    protected label = 'Moog'
    protected acceptsPluginUrl = false
    constructor(context: AudioContext, destination?: AudioNode) {
        super(context, MOOG_URL, 'Moog', destination)
    }
    get name() { return 'Moog' }
    get description() { return MOOG_DESCRIPTOR.description }
    async connect(): Promise<void> {
        if (this.context.state === 'suspended') await this.context.resume()
        await super.connect()
    }
    async createGui(): Promise<HTMLElement> {
        await this.connect()
        return super.createGui()
    }
    protected async availablePlugins() { return [MOOG_DESCRIPTOR] }
    protected async createPlugin() { return createMoogPlugin(await initializeHost(this.context), this.context) }
}
