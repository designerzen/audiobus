import { describe, it, expect, beforeEach } from 'vitest'
import { TransformerQuantise } from '../transformer-quantise.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'
import AudioCommand from '../../audio-command.ts'
import * as Commands from '../../../commands'

const mockTimer = {
    BPM: 120,
    now: 0,
    isRunning: true
} as any

describe('TransformerQuantise', () => {
    let transformer: TransformerQuantise

    beforeEach(() => {
        transformer = new TransformerQuantise({ step: 4 })
    })

    it('should have correct name', () => {
        expect(transformer.name).toBe('Quantiser')
    })

    it('should pass through commands unchanged', () => {
        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60),
            createAudioCommand(Commands.NOTE_ON, 64),
            createAudioCommand(Commands.NOTE_OFF, 60)
        ]

        const result = transformer.transform(commands, mockTimer)

        // Quantise transformer passes through - timing quantisation handled elsewhere
        expect(result).toEqual(commands)
    })

    it('should preserve command properties', () => {
        const command = createAudioCommand(Commands.NOTE_ON, 72, 100, 0.5)
        const result = transformer.transform([command], mockTimer)

        expect(result[0].number).toBe(72)
        expect(result[0].velocity).toBe(100)
        expect(result[0].startAt).toBe(0.5)
    })

    it('should handle empty command array', () => {
        const result = transformer.transform([], mockTimer)
        expect(result).toEqual([])
    })

    it('should support different step values', () => {
        const steps = [1, 2, 3, 4, 6, 8, 12, 16]
        
        for (const step of steps) {
            const t = new TransformerQuantise({ step })
            expect(t.options.step).toBe(step)
        }
    })

    it('should have default step value', () => {
        const t = new TransformerQuantise()
        expect(t.options.step).toBe(4)
    })

    it('should allow config update', () => {
        transformer.setConfig('step', 8)
        expect(transformer.options.step).toBe(8)
    })

    it('should provide fields configuration', () => {
        const fields = transformer.fields
        
        expect(fields.length).toBeGreaterThan(0)
        const stepField = fields.find(f => f.name === 'step')
        expect(stepField).toBeDefined()
        expect(stepField?.values).toContain(4)
        expect(stepField?.values).toContain(16)
    })

    it('should handle multiple commands with different types', () => {
        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60),
            createAudioCommand(Commands.NOTE_ON, 64),
            createAudioCommand(Commands.NOTE_OFF, 60),
            createAudioCommand(Commands.NOTE_OFF, 64)
        ]

        const result = transformer.transform(commands, mockTimer)

        expect(result.length).toBe(4)
        expect(result[0].type).toBe(Commands.NOTE_ON)
        expect(result[2].type).toBe(Commands.NOTE_OFF)
    })
})

function createAudioCommand(
    type: string,
    noteNumber: number,
    velocity: number = 100,
    startAt: number = 0
): IAudioCommand {
    const cmd = new AudioCommand()
    cmd.type = type
    cmd.subtype = type
    cmd.number = noteNumber
    cmd.velocity = velocity
    cmd.startAt = startAt
    cmd.time = 0
    cmd.id = Math.random()
    cmd.endAt = startAt + 1
    cmd.value = 0
    cmd.pitchBend = 0
    cmd.timeCode = 0
    cmd.text = ''
    cmd.raw = new Uint8Array()
    return cmd
}




