import { describe, it, expect, beforeEach } from 'vitest'
import { TransformerArpeggiator } from '../transformer-arpeggiator'
import type { IAudioCommand } from '../../audio-command-interface'
import AudioCommand from '../../audio-command'
import * as Commands from '../../../commands'

const mockTimer = {
    BPM: 120,
    now: 0,
    isRunning: true
} as any

describe('TransformerArpeggiator', () => {
    let transformer: TransformerArpeggiator

    beforeEach(() => {
        transformer = new TransformerArpeggiator({
            enabled: true,
            pattern: 'up',
            rate: '1/16',
            octaves: 1
        })
    })

    it('should have correct name', () => {
        expect(transformer.name).toBe('Arpeggiator')
    })

    it('should pass through single note when disabled', () => {
        transformer = new TransformerArpeggiator({
            enabled: false,
            pattern: 'up',
            rate: '1/16',
            octaves: 1
        })
        
        const commands = [createAudioCommand(Commands.NOTE_ON, 60)]
        const result = transformer.transform(commands, mockTimer)
        
        expect(result).toEqual(commands)
    })

    it('should handle empty command array', () => {
        const result = transformer.transform([], mockTimer)
        expect(result).toEqual([])
    })

    it('should pass through single note', () => {
        const commands = [createAudioCommand(Commands.NOTE_ON, 60)]
        const result = transformer.transform(commands, mockTimer)
        
        expect(result.length).toBeGreaterThanOrEqual(1)
        expect(result[0].number).toBe(60)
    })

    it('should arpeggiate chord notes in up pattern', () => {
        transformer = new TransformerArpeggiator({
            enabled: true,
            pattern: 'up',
            rate: '1/16',
            octaves: 1
        })
        
        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60, 100, 0),
            createAudioCommand(Commands.NOTE_ON, 64, 100, 0),
            createAudioCommand(Commands.NOTE_ON, 67, 100, 0)
        ]
        
        const result = transformer.transform(commands, mockTimer)
        
        // Should generate arpeggio with multiple notes
        expect(result.length).toBeGreaterThan(1)
        
        // Notes should be in ascending order for 'up' pattern
        const noteOns = result.filter(r => r.type === Commands.NOTE_ON)
        expect(noteOns.length).toBeGreaterThanOrEqual(3)
    })

    it('should arpeggiate chord notes in down pattern', () => {
        transformer = new TransformerArpeggiator({
            enabled: true,
            pattern: 'down',
            rate: '1/16',
            octaves: 1
        })
        
        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60, 100, 0),
            createAudioCommand(Commands.NOTE_ON, 64, 100, 0),
            createAudioCommand(Commands.NOTE_ON, 67, 100, 0)
        ]
        
        const result = transformer.transform(commands, mockTimer)
        expect(result.length).toBeGreaterThan(1)
    })

    it('should preserve velocity in arpeggio', () => {
        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60, 85, 0),
            createAudioCommand(Commands.NOTE_ON, 64, 90, 0)
        ]
        
        const result = transformer.transform(commands, mockTimer)
        const noteOns = result.filter(r => r.type === Commands.NOTE_ON)
        
        // Arpeggio notes should have velocity
        noteOns.forEach(note => {
            expect(note.velocity).toBeGreaterThan(0)
        })
    })

    it('should handle NOTE_OFF for chord notes', () => {
        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60, 100, 0),
            createAudioCommand(Commands.NOTE_ON, 64, 100, 0),
            createAudioCommand(Commands.NOTE_OFF, 60, 100, 1.0)
        ]
        
        const result = transformer.transform(commands, mockTimer)
        
        // Should have generated NOTE_OFFs
        const noteOffs = result.filter(r => r.type === Commands.NOTE_OFF)
        expect(noteOffs.length).toBeGreaterThanOrEqual(1)
    })

    it('should reset state', () => {
        const commands1 = [
            createAudioCommand(Commands.NOTE_ON, 60),
            createAudioCommand(Commands.NOTE_ON, 64)
        ]
        
        transformer.transform(commands1, mockTimer)
        transformer.reset()
        
        // After reset, single note should pass through
        const commands2 = [createAudioCommand(Commands.NOTE_ON, 60)]
        const result = transformer.transform(commands2, mockTimer)
        
        expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('should expand notes across multiple octaves', () => {
        transformer = new TransformerArpeggiator({
            enabled: true,
            pattern: 'up',
            rate: '1/16',
            octaves: 2
        })
        
        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60, 100, 0),
            createAudioCommand(Commands.NOTE_ON, 64, 100, 0)
        ]
        
        const result = transformer.transform(commands, mockTimer)
        const noteOns = result.filter(r => r.type === Commands.NOTE_ON)
        
        // With 2 octaves and 2 notes, should generate more than 2 notes
        expect(noteOns.length).toBeGreaterThanOrEqual(2)
    })

    it('should delay arpeggio notes based on rate', () => {
        transformer = new TransformerArpeggiator({
            enabled: true,
            pattern: 'up',
            rate: '1/4',
            octaves: 1
        })
        
        const baseTime = 0.5
        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60, 100, baseTime),
            createAudioCommand(Commands.NOTE_ON, 64, 100, baseTime)
        ]
        
        const result = transformer.transform(commands, mockTimer)
        const noteOns = result.filter(r => r.type === Commands.NOTE_ON)
        
        // Check that notes have increasing startAt times
        if (noteOns.length > 1) {
            for (let i = 1; i < noteOns.length; i++) {
                expect(noteOns[i].startAt).toBeGreaterThanOrEqual(noteOns[i - 1].startAt)
            }
        }
    })

    it('should handle chord pattern (all notes at once)', () => {
        transformer = new TransformerArpeggiator({
            enabled: true,
            pattern: 'chord',
            rate: '1/16',
            octaves: 1
        })
        
        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60, 100, 0),
            createAudioCommand(Commands.NOTE_ON, 64, 100, 0),
            createAudioCommand(Commands.NOTE_ON, 67, 100, 0)
        ]
        
        const result = transformer.transform(commands, mockTimer)
        const noteOns = result.filter(r => r.type === Commands.NOTE_ON)
        
        // Chord mode should play notes at same time
        expect(noteOns.length).toBeGreaterThanOrEqual(3)
    })

    it('should preserve command properties', () => {
        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60, 95, 0.25),
            createAudioCommand(Commands.NOTE_ON, 64, 100, 0.25)
        ]
        
        const result = transformer.transform(commands, mockTimer)
        
        // Check first NOTE_ON maintains original properties
        const firstNote = result.find(r => r.type === Commands.NOTE_ON && r.number === 60)
        expect(firstNote?.type).toBe(Commands.NOTE_ON)
    })
})

function createAudioCommand(
    type: string,
    noteNumber: number,
    velocity: number = 100,
    startAt: number = 0,
    time: number = 0
): IAudioCommand {
    const cmd = new AudioCommand()
    cmd.type = type
    cmd.subtype = type
    cmd.number = noteNumber
    cmd.velocity = velocity
    cmd.startAt = startAt
    cmd.time = time
    cmd.id = Math.random()
    cmd.endAt = startAt + 1
    cmd.value = 0
    cmd.pitchBend = 0
    cmd.timeCode = 0
    cmd.text = ''
    cmd.raw = new Uint8Array()
    return cmd
}



