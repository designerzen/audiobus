import { compressToBase64, decompressFromBase64 } from 'lz-string'
import { deviceId, deviceDefinition, defineDevice } from './device-definition'
import { restoreDevice, UnavailableDevice, type SavedDevice } from './workspace-devices'
import OutputManager from './output-manager'
import AbstractInput from './inputs/abstract-input'
import { INPUT_EVENT, PLAYBACK_TOGGLE, PLAYBACK_STOP, MIDI_STOP } from '../commands'

/**
 * Manager for managing multiple IOChain instances
 * Handles creation, persistence, and lifecycle of multiple IO chains
 */
import IOChain from "./IO-chain"
import IOChainFactory, { type IOChainPreset } from "./IO-chain-factory"

import type { ITimerControl as Timer } from "netronome"
import type { IAudioInput } from "./inputs/input-interface"
import type { IAudioOutput } from "./outputs/output-interface"
import type { IAudioCommand } from "audiobus/audio-command-interface"
import type AudioEvent from "audiobus/audio-event"

export const EVENT_CHAIN_ADDED = "chainAdded"
export const EVENT_CHAIN_REMOVED = "chainRemoved"
export const EVENT_CHAIN_ACTIVE_CHANGED = "chainActiveChanged"
export const EVENT_CHAINS_UPDATED = "chainsUpdated"

export interface IOChainManagerOptions {
	/**
	 * The timer instance for all chains
	 */
	timer: Timer

	/**
	 * The audio output mixer (GainNode) shared by all chains
	 */
	outputMixer: GainNode

	/**
	 * AudioContext for outputs that require it
	 */
	audioContext?: AudioContext

	/**
	 * Attempt to auto-connect hardware inputs
	 */
	autoConnect?: boolean
	externalDevices?: Record<string, object>
}

/**
 * Manages multiple IOChain instances with lifecycle and persistence
 */
export class IOChainManager extends EventTarget {
	#chains: Map<string, IOChain> = new Map()
	#activeChainId: string | null = null
	#options: IOChainManagerOptions
	#abortController: AbortController
	#chainIdCounter: number = 0
    #subscriptions = new Map<string, AbortController>()
    #devices = new Map<string, { device: any; direction: 'input' | 'output'; chains: Set<string> }>()
    #restoring = false
    restoreWarnings: string[] = []
    #transportQueue: Promise<void> = Promise.resolve()
    #transportRunning: boolean | undefined
    transportHandler?: (type: string) => void

    get transportRunning(): boolean { return this.#transportRunning ?? this.#options.timer.isRunning }

    transport(request: 'start' | 'stop' | 'reset' | 'toggle'): Promise<void> {
        const operation = this.#transportQueue.then(async () => {
            const action = request === 'toggle' ? (this.transportRunning ? 'stop' : 'start') : request
            const timer = this.#options.timer as Timer & { resetTimer(): void }
            if (action === 'start') {
                if (this.transportRunning) return
                this.chains.forEach(chain => chain.clearNoteCommands())
                await timer.start()
                this.#transportRunning = true
            } else {
                await timer.stop()
                this.#transportRunning = false
                this.chains.forEach(chain => chain.clearNoteCommands())
                await Promise.all([...new Set(this.chains.flatMap(chain => chain.outputs))].map(output => OutputManager.settled(output)))
                if (action === 'reset') timer.resetTimer()
            }
            this.dispatchEvent(new Event('transportChanged'))
        })
        this.#transportQueue = operation.catch(() => {})
        return operation
    }

    handleTransportCommand(type: string): Promise<void> {
        return this.transport(type === PLAYBACK_TOGGLE
            ? 'toggle'
            : [PLAYBACK_STOP, MIDI_STOP].includes(type) ? 'stop' : 'start')
    }

    get entries(): Array<[string, IOChain]> { return [...this.#chains.entries()] }
    get devices() { return [...this.#devices].map(([id, value]) => ({ id, ...value })) }
    get deviceOptions() { return { now: () => (this.#options.timer as Timer & { now: number }).now, audioContext: this.audioContext, mixer: this.outputMixer } }

    private changed = () => {
        if (this.#restoring) return
        this.syncDevices()
        this.dispatchEvent(new Event(EVENT_CHAINS_UPDATED))
    }

    private syncDevices(): void {
        const next = new Map<string, { device: any; direction: 'input' | 'output'; chains: Set<string> }>()
        const retain = (device: any, direction: 'input' | 'output', chainId: string) => {
            const id = deviceId(device)
            if (!next.has(id)) next.set(id, { device, direction, chains: new Set() })
            next.get(id)!.chains.add(chainId)
        }
        this.#chains.forEach((chain, id) => {
            chain.inputs.forEach(input => retain(input, 'input', id))
            chain.outputs.forEach(output => retain(output, 'output', id))
        })
        // Keyboard display outputs depend on their input even when that input is
        // detached from a particular chain.
        next.forEach(entry => {
            let inputId: string | undefined
            try { inputId = deviceDefinition(entry.device).inputId } catch { return }
            if (inputId && !next.has(inputId) && this.#devices.has(inputId)) {
                next.set(inputId, { ...this.#devices.get(inputId)!, chains: new Set() })
            }
        })
        const removed = [...this.#devices].filter(([id, entry]) => next.get(id)?.device !== entry.device)
        this.#devices = next
        removed.forEach(([id, entry]) => { void this.disposeDevice(id, entry.device) })
    }

    private async disposeDevice(id: string, device: any): Promise<void> {
        if (Object.values(this.#options.externalDevices ?? {}).includes(device)) return
        await OutputManager.settled(device)
        if (this.#devices.get(id)?.device === device) return
        try {
            if (device.destroyGui) await device.destroyGui()
            if (device.disconnect) await device.disconnect()
            if (device.destroy && device.destroy !== AbstractInput.prototype.destroy) await device.destroy()
            else device.output?.disconnect?.()
        } catch (error) { console.warn('Device cleanup failed', error) }
    }

    createEmptyChain(): string {
        const chain = new IOChain(this.#options.timer)
        chain.setTransformers([])
        return this.addChain(chain)
    }

    addDevice(chain: IOChain, device: any, direction: 'input' | 'output'): void {
        if (!this.chains.includes(chain) || chain.isDestroyed) {
            void this.disposeDevice(deviceId(device), device)
            throw new Error('The target chain was deleted while the device was loading')
        }
        if (direction === 'input') chain.addInput(device)
        else chain.addOutput(device)
    }

    cloneChain(chainId: string): string {
        const source = this.#chains.get(chainId)
        if (!source) throw new Error(`Unknown chain: ${chainId}`)
        const clone = new IOChain(this.#options.timer)
        try {
            clone.importConfiguration(source.exportConfiguration())
            if (source.options.name) clone.setName(`${source.options.name} copy`)
            clone.addInputs(source.inputs)
            clone.addOutputs(source.outputs)
            return this.addChain(clone)
        } catch (error) { clone.destroy(); throw error }
    }

    attachDevice(chainId: string, id: string): void {
        const chain = this.getChain(chainId)
        const entry = this.#devices.get(id)
        if (!chain || !entry) throw new Error('Unknown chain or device')
        if (entry.direction === 'input') chain.addInput(entry.device)
        else chain.addOutput(entry.device)
    }

    exportWorkspace(): string {
        const devices: SavedDevice[] = this.devices.map(entry => ({
            id: entry.id, direction: entry.direction, definition: deviceDefinition(entry.device)
        }))
        return 'workspace:' + compressToBase64(JSON.stringify({
            version: 2, activeChainId: this.activeChainId, devices,
            chains: this.entries.map(([id, chain]) => ({ id, ...chain.exportConfiguration(),
                inputs: chain.inputs.map(deviceId), outputs: chain.outputs.map(deviceId) }))
        }))
    }

    async restoreWorkspace(encoded: string): Promise<void> {
        const staged = new Map<string, IOChain>()
        const devices = new Map<string, any>()
        const warnings: string[] = []
        try {
            if (!encoded.startsWith('workspace:')) {
                // Legacy saves contain transformers but no endpoint definitions.
                for (const item of encoded.split('|')) {
                    const data = JSON.parse(decompressFromBase64(item))
                    if (data?.version !== 1) throw new Error('Unsupported legacy workspace')
                    const chain = await IOChainFactory.createDefault({ ...this.#options,
                        outputDevices: Object.values(this.#options.externalDevices ?? {}).filter(device =>
                            typeof (device as IAudioOutput).noteOn === 'function') as IAudioOutput[] })
                    staged.set(this.generateChainId(), chain)
                    chain.transformerManager.importData(data.transformersConfig)
                }
            } else {
                const data = JSON.parse(decompressFromBase64(encoded.slice('workspace:'.length)))
                if (data?.version !== 2 || !Array.isArray(data.chains) || !Array.isArray(data.devices)) throw new Error('Invalid workspace')
                const ids = new Set<string>()
                for (const saved of data.devices) {
                    if (typeof saved.id !== 'string' || !saved.id || ids.has(saved.id) || !['input', 'output'].includes(saved.direction) ||
                        !['input', 'output', 'instrument', 'keyboard-input', 'keyboard-output', 'polyphonic', 'external'].includes(saved.definition?.factory)) throw new Error('Invalid device definition')
                    ids.add(saved.id)
                }
                const chainIds = new Set<string>()
                for (const config of data.chains) {
                    if (typeof config.id !== 'string' || !config.id || chainIds.has(config.id) || !Array.isArray(config.inputs) || !Array.isArray(config.outputs)) throw new Error('Invalid chain definition')
                    chainIds.add(config.id)
                    for (const direction of ['input', 'output'] as const) {
                        for (const id of config[direction + 's']) {
                            if (!data.devices.some((d: SavedDevice) => d.id === id && d.direction === direction)) throw new Error('Invalid device reference')
                        }
                    }
                    const chain = new IOChain(this.#options.timer)
                    staged.set(config.id, chain)
                    chain.importConfiguration(config)
                }
                if (data.activeChainId !== null && !chainIds.has(data.activeChainId)) throw new Error('Invalid active chain')
                // Restore dependent keyboard displays after their inputs.
                for (const saved of [...data.devices].sort((a, b) => Number(a.definition.factory === 'keyboard-output') - Number(b.definition.factory === 'keyboard-output'))) {
                    try {
                        devices.set(saved.id, await restoreDevice(saved, { ...this.#options, now: () => (this.#options.timer as Timer & { now: number }).now }, devices))
                    } catch (error) {
                        const reason = `Could not restore ${saved.definition.type ?? saved.definition.factory}: ${String(error)}`
                        warnings.push(reason)
                        devices.set(saved.id, defineDevice(new UnavailableDevice(saved.definition, reason), saved.definition, saved.id))
                    }
                }
                for (const config of data.chains) {
                    const chain = staged.get(config.id)!
                    chain.addInputs(config.inputs.map((id: string) => devices.get(id)))
                    chain.addOutputs(config.outputs.map((id: string) => devices.get(id)))
                }
            }
        } catch (error) {
            const orphaned = new Set([...devices.values(), ...[...staged.values()].flatMap(chain => [...chain.inputs, ...chain.outputs])])
            staged.forEach(chain => chain.destroy())
            orphaned.forEach(device => { void this.disposeDevice(deviceId(device), device) })
            throw error
        }
        this.#restoring = true
        this.#subscriptions.forEach(controller => controller.abort())
        this.#subscriptions.clear()
        this.#chains.forEach(chain => chain.destroy())
        this.#chains.clear()
        this.#activeChainId = null
        const previousDevices = [...this.#devices]
        // Retain dependency-only devices for syncDevices.
        this.#devices.clear()
        devices.forEach((device, id) => {
            if (!this.#devices.has(id)) this.#devices.set(id, { device, direction: 'input', chains: new Set() })
        })
        staged.forEach((chain, id) => this.addChain(chain, id))
        if (encoded.startsWith('workspace:')) {
            this.#activeChainId = JSON.parse(decompressFromBase64(encoded.slice(10))).activeChainId
        }
        this.restoreWarnings = warnings
        this.#restoring = false
        this.changed()
        previousDevices.forEach(([id, entry]) => {
            if (this.#devices.get(id)?.device !== entry.device) void this.disposeDevice(id, entry.device)
        })
        this.dispatchEvent(new CustomEvent(EVENT_CHAIN_ACTIVE_CHANGED, { detail: { chainId: this.activeChainId } }))
    }


	get chains(): IOChain[] {
		return Array.from(this.#chains.values())
	}

	get chainCount(): number {
		return this.#chains.size
	}

	get activeChain(): IOChain | null {
		if (!this.#activeChainId) return null
		return this.#chains.get(this.#activeChainId) || null
	}

	get activeChainId(): string | null {
		return this.#activeChainId
	}

	get outputMixer(): GainNode {
		return this.#options.outputMixer
	}

	get audioContext(): AudioContext | undefined {
		return this.#options.audioContext
	}

	constructor(options: IOChainManagerOptions) {
		super()
		this.#options = options
		this.#abortController = new AbortController()
        Object.entries(options.externalDevices ?? {}).forEach(([type, device]) => defineDevice(device, { factory: 'external', type }))
	}

	/**
	 * Generate a unique ID for a new chain
	 */
	private generateChainId(): string {
		let id: string
        do { id = `chain-${++this.#chainIdCounter}` } while (this.#chains.has(id))
        return id
	}

	public updateTime(now:number, divisionsElapsed:number, options={} ){
        if (this.#transportRunning === false) return []
		
		return this.entries.map(([chainId, chain]) => {
		  	// Always process the queue, with or without quantisation
			const activeCommands: IAudioCommand[] = chain.updateTimeForCommandQueue(now, divisionsElapsed, options)
	
			// Act upon any command that has now been executed
			if (activeCommands && activeCommands.length > 0) {
				const events: AudioEvent[] = IOChain.convertAudioCommandsToAudioEvents(activeCommands, now)
				for (const event of events) {
					event.chainId = chainId
					event.chainName = chain.options.name
				}
				void chain.triggerAudioCommandsOnDevice(activeCommands)	// send to Outputs!
				return events
			}
			return []
		}).flat()
	}

	/**
	 * Add an existing IOChain to the manager
	 * @param chain IOChain instance to add
	 * @param id Optional custom ID (auto-generated if not provided)
	 * @returns The ID assigned to the chain
	 */
	addChain(chain: IOChain, id?: string): string {
		if (chain.isDestroyed || this.chains.includes(chain)) throw new Error('Chain is deleted or already registered')
		const chainId = id || this.generateChainId()

		if (this.#chains.has(chainId)) {
			throw new Error(`Chain with ID "${chainId}" already exists`)
		}

        if (!chain.options.name) chain.setName(`Chain ${chainId.replace(/^chain-/, '')}`)
        chain.transportCommand = type => {
            if (this.transportHandler) this.transportHandler(type)
            else void this.handleTransportCommand(type).catch(error => console.error('Transport failed', error))
        }
		this.#chains.set(chainId, chain)
        if (!this.#restoring) this.syncDevices()
        const controller = new AbortController()
        this.#subscriptions.set(chainId, controller)
        for (const event of ['EVENT_INPUTS_UPDATED', 'outputsUpdated', 'EVENT_TRANSFORMERS_UPDATED', 'configurationChanged']) {
            chain.addEventListener(event, this.changed, { signal: controller.signal })
        }
        chain.addEventListener(INPUT_EVENT, (event: any) => {
            this.dispatchEvent(new CustomEvent(INPUT_EVENT, { detail: { chainId, chain, command: event.command } }))
        }, { signal: controller.signal })

		// Set as active if it's the first chain
		if (!this.#activeChainId) {
			this.setActiveChain(chainId)
		}

		if (!this.#restoring) this.dispatchEvent(
			new CustomEvent(EVENT_CHAIN_ADDED, {
				detail: { chainId, chain }
			})
		)

		this.changed()

		return chainId
	}

	/**
	 * Remove a chain from the manager
	 * @param chainId ID of the chain to remove
	 */
	removeChain(chainId: string): boolean {
		const chain = this.#chains.get(chainId)
		if (!chain) return false

		this.#subscriptions.get(chainId)?.abort()
		this.#subscriptions.delete(chainId)
		chain.destroy()
		this.#chains.delete(chainId)
        if (!this.#restoring) this.syncDevices()

		// Update active chain if needed
		if (this.#activeChainId === chainId) {
			const remainingChains = Array.from(this.#chains.keys())
			this.#activeChainId = remainingChains.length > 0 ? remainingChains[0] : null
			{
				this.dispatchEvent(
					new CustomEvent(EVENT_CHAIN_ACTIVE_CHANGED, {
						detail: { chainId: this.#activeChainId }
					})
				)
			}
		}

		this.dispatchEvent(
			new CustomEvent(EVENT_CHAIN_REMOVED, {
				detail: { chainId }
			})
		)

		this.changed()

		return true
	}

	/**
	 * Get a chain by ID
	 */
	getChain(chainId: string): IOChain | null {
		return this.#chains.get(chainId) || null
	}

	/**
	 * Set the active chain
	 */
	setActiveChain(chainId: string): boolean {
		if (!this.#chains.has(chainId)) {
			console.warn(`Chain with ID "${chainId}" not found`)
			return false
		}

		if (this.#activeChainId === chainId) {
			return true
		}

		this.#activeChainId = chainId

		if (!this.#restoring) this.dispatchEvent(
			new CustomEvent(EVENT_CHAIN_ACTIVE_CHANGED, {
				detail: { chainId }
			})
		)

		return true
	}

	/**
	 * Create and add a new default chain
	 */
	async createDefaultChain(customInputs?: IAudioInput[], customOutputs?: IAudioOutput[]): Promise<string> {
		const chain = await IOChainFactory.createDefault({
			timer: this.#options.timer,
			outputMixer: this.#options.outputMixer,
			audioContext: this.#options.audioContext,
			autoConnect: this.#options.autoConnect,
			inputDevices: customInputs,
			outputDevices: customOutputs
		})

		return this.addChain(chain)
	}

	/**
	 * Create and add a chain from a preset
	 */
	async createChainFromPreset(
		preset: IOChainPreset,
		customInputs?: IAudioInput[],
		customOutputs?: IAudioOutput[]
	): Promise<string> {
		const chain = await IOChainFactory.createFromPreset(preset, {
			timer: this.#options.timer,
			outputMixer: this.#options.outputMixer,
			audioContext: this.#options.audioContext,
			autoConnect: this.#options.autoConnect,
			inputDevices: customInputs,
			outputDevices: customOutputs
		})

		return this.addChain(chain)
	}

	/**
	 * Create and add a chain from an export string
	 */
	async createChainFromExportString(exportedString: string): Promise<string> {
		const chain = await IOChainFactory.createFromExportString(exportedString, {
			timer: this.#options.timer,
			outputMixer: this.#options.outputMixer,
			audioContext: this.#options.audioContext,
			autoConnect: this.#options.autoConnect
		})

		return this.addChain(chain)
	}

	/**
	 * Create and add a minimal chain
	 */
	async createMinimalChain(): Promise<string> {
		const chain = await IOChainFactory.createMinimal({
			timer: this.#options.timer,
			outputMixer: this.#options.outputMixer,
			audioContext: this.#options.audioContext,
			autoConnect: this.#options.autoConnect
		})

		return this.addChain(chain)
	}

	/**
	 * Export configuration for all chains
	 * Returns object mapping chain IDs to export strings
	 */
	exportAllChains(): Record<string, string> {
		const exports: Record<string, string> = {}

		this.#chains.forEach((chain, chainId) => {
			try {
				exports[chainId] = chain.exportString()
			} catch (error) {
				console.error(`Failed to export chain ${chainId}:`, error)
			}
		})

		return exports
	}

	/**
	 * Export configuration for a specific chain
	 */
	exportChain(chainId: string): string | null {
		const chain = this.#chains.get(chainId)
		if (!chain) return null

		try {
			return chain.exportString()
		} catch (error) {
			console.error(`Failed to export chain ${chainId}:`, error)
			return null
		}
	}

	/**
	 * Restore all chains from saved configurations
	 */
	async restoreAllChains(exports: Record<string, string>): Promise<void> {
		for (const [chainId, exportString] of Object.entries(exports)) {
			try {
				await this.restoreChain(exportString, chainId)
			} catch (error) {
				console.error(`Failed to restore chain ${chainId}:`, error)
			}
		}
	}

	/**
	 * Restore a single chain from export string with custom ID
	 */
	async restoreChain(exportString: string, chainId?: string): Promise<string> {
		const chain = await IOChainFactory.createFromExportString(exportString, {
			timer: this.#options.timer,
			outputMixer: this.#options.outputMixer,
			audioContext: this.#options.audioContext,
			autoConnect: this.#options.autoConnect
		})

		return this.addChain(chain, chainId)
	}

	/**
	 * Stop all chains and clear them
	 */
	destroy(): void {
		this.#subscriptions.forEach(controller => controller.abort())
		this.#subscriptions.clear()
		this.#chains.forEach(chain => chain.destroy())
		this.#chains.clear()
		this.syncDevices()
		this.#activeChainId = null
		this.#abortController.abort()
	}

	/**
	 * Distribute a command to all chains
	 */
	broadcastToAllChains(command: any): void {
		this.#chains.forEach(chain => {
			try {
				chain.addCommand(structuredClone(command))
			} catch (error) {
				console.error("Failed to broadcast command to chain:", error)
			}
		})
	}

	/**
	 * Get status information about all chains
	 */
	getStatus(): Array<{
		id: string
		isActive: boolean
		inputCount: number
		outputCount: number
		transformerCount: number
		commandQueueLength: number
	}> {
		return Array.from(this.#chains.entries()).map(([chainId, chain]) => ({
			id: chainId,
			isActive: chainId === this.#activeChainId,
			inputCount: chain.inputs.length,
			outputCount: chain.outputs.length,
			transformerCount: chain.transformerQuantity,
			commandQueueLength: 0 // Would need to expose queue length from IOChain
		}))
	}
}

export default IOChainManager
