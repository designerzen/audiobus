/**
 * Web Worker for executing transformer operations
 * Runs transform methods off the main thread
 */

import { tranformerFactory } from './transformer-factory.ts'

/**
 * Handle messages from main thread
 */
self.onmessage = (event) => {
    const message = event.data
    
    try {
        if (!message.id) {
            console.error('[Worker] Message missing id:', message)
            return
        }

        switch (message.type) {
            case 'transform':
                handleTransform(message)
                break
            case 'init':
                handleInit(message)
                break
            case 'reset':
                handleReset(message)
                break
            default:
                console.warn('[Worker] Unknown message type:', message.type)
        }
    } catch (error) {
        console.error('[Worker] Error handling message:', error)
        self.postMessage({
            id: message.id,
            commands: [],
            error: error.message
        })
    }
}

// State
let transformerStates = new Map()
let transformerInstances = new Map()

/**
 * Initialize with transformer configurations
 */
function handleInit(message) {
    try {
        if (message.transformerStates) {
            // Clear previous states - full replacement
            transformerStates.clear()
            transformerInstances.clear()
            
            const states = JSON.parse(message.transformerStates)
            Object.entries(states).forEach(([id, state]) => {
                transformerStates.set(id, state)
            })
        }
    } catch (error) {
        console.error('[Worker] Error in handleInit:', error)
    }
}

/**
 * Process transform request
 */
function handleTransform(message) {
    try {
        if (!message.commands || !message.timerData) {
            throw new Error('Missing commands or timer data in transform message')
        }

        const commands = message.commands
        const timer = {
            bpm: message.timerData.bpm,
            now: message.timerData.now,
            startTime: message.timerData.startTime
        }

        let result = commands

        // Apply each transformer in sequence
        for (const [transformerId, state] of transformerStates) {
            const transformer = getOrCreateTransformer(transformerId, state)
            if (transformer && transformer.options?.enabled !== false) {
                result = transformer.transform(result, timer)
            }
        }

        self.postMessage({
            id: message.id,
            commands: result
        })
    } catch (error) {
        console.error('[Worker] Error in handleTransform:', error, {message})
        self.postMessage({
            id: message.id,
            commands: [],
            error: error.message
        })
    }
}

/**
 * Reset transformer state
 */
function handleReset(message) {
    try {
        transformerInstances.clear()
        console.log('[Worker] Reset complete')
    } catch (error) {
        console.error('[Worker] Error in handleReset:', error)
    }
}

/**
 * Get or create transformer instance
 */
function getOrCreateTransformer(transformerId, state) {
    if (!transformerInstances.has(transformerId)) {
        try {
            const config = typeof state === 'string' ? JSON.parse(state) : state
            if (!config.type) {
                console.warn(`[Worker] Transformer config missing type for ${transformerId}:`, config)
                return null
            }
            const transformer = tranformerFactory(config.type, config)
            transformerInstances.set(transformerId, transformer)
            return transformer
        } catch (error) {
            console.error(`[Worker] Failed to create transformer ${transformerId}:`, error)
            return null
        }
    }
    return transformerInstances.get(transformerId)
}

console.log('[Worker] TransformWorker loaded and ready')
