import OutputWAM2 from './output-wam2'
import { initializeHost } from '../../wam/host'
import { createTB303Plugin } from '../../wam/tb303'
import { TB303_DESCRIPTOR, TB303_URL } from '../../wam/tb303/parameters'

export default class OutputTB303 extends OutputWAM2 {
    protected label = 'TB-303'
    protected acceptsPluginUrl = false
    protected showPluginBrowser = false
    readonly requiresConnectionControl = false
    readonly configurationAffectsNoteRouting = false
    constructor(context: AudioContext, destination?: AudioNode) {
        super(context, TB303_URL, 'TB-303', destination)
    }
    get name() { return 'TB-303' }
    get description() { return TB303_DESCRIPTOR.description }
    async connect(): Promise<void> {
        if (this.context.state === 'suspended') await this.context.resume()
        await super.connect()
    }
    async createGui(): Promise<HTMLElement> { await this.connect(); return super.createGui() }
    protected async availablePlugins() { return [TB303_DESCRIPTOR] }
    protected async createPlugin() { return createTB303Plugin(await initializeHost(this.context), this.context) }
}
