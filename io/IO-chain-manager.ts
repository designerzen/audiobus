/**
 * Manager for managing multiple IOChain instances
 * Handles creation, persistence, and lifecycle of multiple IO chains
 */
import IOChain from "./IO-chain"
import IOChainFactory, { IOChainFactoryOptions, IOChainPreset } from "./IO-chain-factory"

import type { ITimerControl as Timer } from "netronome"
import type { IAudioInput } from "./inputs/input-interface"
import type { IAudioOutput } from "./outputs/output-interface"
import type { IAudioCommand } from "audiobus/audio-command-interface"
import type AudioEvent from "audiobus/audio-event"
import type State from "../../../app/harmoneasy/source/libs/state"

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
	}

	/**
	 * Generate a unique ID for a new chain
	 */
	private generateChainId(): string {
		return `chain-${++this.#chainIdCounter}`
	}

	public updateTime(now:number, divisionsElapsed:number, state:State){
		return this.chains.map(chain => {
		  	// Always process the queue, with or without quantisation
			const activeCommands: IAudioCommand[] = chain.updateTimeForCommandQueue(now, divisionsElapsed, state)
	
			// Act upon any command that has now been executed
			if (activeCommands && activeCommands.length > 0) {
				const events: AudioEvent[] = IOChain.convertAudioCommandsToAudioEvents(activeCommands, now)
				const triggers = chain.triggerAudioCommandsOnDevice(events)	// send to Outputs!
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
		const chainId = id || this.generateChainId()

		if (this.#chains.has(chainId)) {
			throw new Error(`Chain with ID "${chainId}" already exists`)
		}

		this.#chains.set(chainId, chain)

		// Set as active if it's the first chain
		if (!this.#activeChainId) {
			this.setActiveChain(chainId)
		}

		this.dispatchEvent(
			new CustomEvent(EVENT_CHAIN_ADDED, {
				detail: { chainId, chain }
			})
		)

		this.dispatchEvent(new CustomEvent(EVENT_CHAINS_UPDATED))

		return chainId
	}

	/**
	 * Remove a chain from the manager
	 * @param chainId ID of the chain to remove
	 */
	removeChain(chainId: string): boolean {
		const chain = this.#chains.get(chainId)
		if (!chain) return false

		chain.destroy()
		this.#chains.delete(chainId)

		// Update active chain if needed
		if (this.#activeChainId === chainId) {
			const remainingChains = Array.from(this.#chains.keys())
			this.#activeChainId = remainingChains.length > 0 ? remainingChains[0] : null
			if (this.#activeChainId) {
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

		this.dispatchEvent(new CustomEvent(EVENT_CHAINS_UPDATED))

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

		this.dispatchEvent(
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
				await this.createChainFromExportString(exportString)
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
		this.#chains.forEach(chain => chain.destroy())
		this.#chains.clear()
		this.#activeChainId = null
		this.#abortController.abort()
	}

	/**
	 * Distribute a command to all chains
	 */
	broadcastToAllChains(command: any): void {
		this.#chains.forEach(chain => {
			try {
				chain.addCommand(command)
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
