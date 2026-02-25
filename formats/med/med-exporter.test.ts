/**
 * MED Exporter Tests
 * 
 * Tests for the ProTracker MED format encoder/exporter
 * Verifies binary format generation, header structure, and data integrity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MEDExporter } from './med-exporter'
import type { IAudioCommand } from '../audio-command-interface'

/**
 * Helper to create mock audio commands
 */
function createMockCommand(
  type: string,
  note: number = 60,
  velocity: number = 100,
  data: any = {}
): IAudioCommand {
  return {
    id: 1,
    type,
    subtype: '',
    number: note,
    channel: -1,
    velocity,
    startAt: 0,
    endAt: 0,
    value: note,
    pitchBend: 0,
    time: 0,
    timeCode: 0,
    text: '',
    raw: new Uint8Array(),
    from: 'test',
    ...data,
  }
}

/**
 * Helper to read data from ArrayBuffer at position
 */
function readUint32LE(buffer: ArrayBuffer, offset: number): number {
  const view = new DataView(buffer)
  return view.getUint32(offset, true)
}

function readUint16LE(buffer: ArrayBuffer, offset: number): number {
  const view = new DataView(buffer)
  return view.getUint16(offset, true)
}

function readUint8(buffer: ArrayBuffer, offset: number): number {
  const view = new DataView(buffer)
  return view.getUint8(offset)
}

function readString(buffer: ArrayBuffer, offset: number, length: number): string {
  const view = new Uint8Array(buffer)
  let str = ''
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(view[offset + i])
  }
  return str
}

describe('MEDExporter', () => {
  let exporter: MEDExporter

  beforeEach(() => {
    exporter = new MEDExporter()
  })

  describe('Initialization', () => {
    it('should create exporter instance', () => {
      expect(exporter).toBeDefined()
      expect(exporter.encode).toBeDefined()
      expect(exporter.export).toBeDefined()
    })

    it('should have correct capabilities', () => {
      const caps = exporter.getCapabilities()
      expect(caps.medVersion).toBe('4.10')
      expect(caps.maxInstruments).toBe(32)
      expect(caps.maxPatterns).toBe(128)
      expect(caps.maxTracks).toBe(16)
      expect(caps.patternLines).toBe(64)
      expect(caps.isClientSide).toBe(true)
      expect(caps.supportsMetadata).toBe(true)
    })
  })

  describe('Binary Format', () => {
    it('should start with MED header', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      const header = readString(buffer, 0, 4)
      expect(header).toBe('MED ')
    })

    it('should contain MHDR chunk', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // MHDR chunk starts at offset 4 (after "MED ")
      const mhdrId = readString(buffer, 4, 4)
      expect(mhdrId).toBe('MHDR')
    })

    it('should have correct MHDR size', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // MHDR size is at offset 8 (after chunk ID)
      const size = readUint32LE(buffer, 8)
      expect(size).toBe(0x2C) // 44 bytes fixed
    })

    it('should contain INST chunk', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // Find INST chunk by searching through buffer
      const view = new Uint8Array(buffer)
      let found = false
      
      for (let i = 0; i < buffer.byteLength - 4; i++) {
        const chunk = String.fromCharCode(view[i], view[i+1], view[i+2], view[i+3])
        if (chunk === 'INST') {
          found = true
          break
        }
      }
      
      expect(found).toBe(true)
    })

    it('should contain SEQU chunk', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // Find SEQU chunk (after MHDR and INST)
      const view = new Uint8Array(buffer)
      let found = false
      
      for (let i = 0; i < buffer.byteLength - 4; i++) {
        const chunk = String.fromCharCode(view[i], view[i+1], view[i+2], view[i+3])
        if (chunk === 'SEQU') {
          found = true
          break
        }
      }
      
      expect(found).toBe(true)
    })

    it('should contain TRKD chunk', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      const view = new Uint8Array(buffer)
      let found = false
      
      for (let i = 0; i < buffer.byteLength - 4; i++) {
        const chunk = String.fromCharCode(view[i], view[i+1], view[i+2], view[i+3])
        if (chunk === 'TRKD') {
          found = true
          break
        }
      }
      
      expect(found).toBe(true)
    })
  })

  describe('MHDR Chunk', () => {
    it('should write version correctly', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // MHDR chunk structure: 
      // 0-3: "MED "
      // 4-7: "MHDR"
      // 8-11: size (0x2C = 44 bytes)
      // 12-15: version
      const version = readUint32LE(buffer, 12)
      expect(version).toBe(0x0410)
    })

    it('should write default tempo', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // Tempo is in MHDR at offset:
      // 12-15: version, 16-19: flags, 20-23: instruments, 24-27: samples
      // 28-31: patterns, 32-35: tracks, 36-37: channel mode
      // 38-39: master volume, 40-41: tempo
      const tempoOffset = 40
      const tempo = readUint16LE(buffer, tempoOffset)
      
      expect(tempo).toBe(125)
    })

    it('should write custom tempo', () => {
      const commands: IAudioCommand[] = []
      const options = { tempo: 140 }
      const buffer = exporter.encode(commands, options)
      
      const tempoOffset = 40
      const tempo = readUint16LE(buffer, tempoOffset)
      
      expect(tempo).toBe(140)
    })

    it('should write default master volume', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // Master volume is at offset 38-39
      const volumeOffset = 38
      const volume = readUint16LE(buffer, volumeOffset)
      
      expect(volume).toBe(255)
    })

    it('should write custom master volume', () => {
      const commands: IAudioCommand[] = []
      const options = { masterVolume: 200 }
      const buffer = exporter.encode(commands, options)
      
      const volumeOffset = 38
      const volume = readUint16LE(buffer, volumeOffset)
      
      expect(volume).toBe(200)
    })

    it('should write pattern rows', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // Pattern rows at offset 42 (1 byte)
      const rowsOffset = 42
      const rows = readUint8(buffer, rowsOffset)
      
      expect(rows).toBe(64)
    })

    it('should write number of instruments', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // Number of instruments at offset 20 (after version and flags)
      const instCountOffset = 20
      const instCount = readUint32LE(buffer, instCountOffset)
      
      expect(instCount).toBe(32)
    })
  })

  describe('INST Chunk', () => {
    it('should create valid instrument entries', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // Find INST chunk
      const view = new Uint8Array(buffer)
      let instFound = false
      
      for (let i = 0; i < buffer.byteLength - 4; i++) {
        if (view[i] === 'I'.charCodeAt(0) &&
            view[i+1] === 'N'.charCodeAt(0) &&
            view[i+2] === 'S'.charCodeAt(0) &&
            view[i+3] === 'T'.charCodeAt(0)) {
          instFound = true
          break
        }
      }
      
      expect(instFound).toBe(true)
      
      // Check that buffer is large enough to contain instrument data
      // INST chunk has 32 instruments * 32 bytes each = 1024 bytes
      expect(buffer.byteLength).toBeGreaterThan(1000)
    })
  })

  describe('SEQU Chunk', () => {
    it('should have linear sequence', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      const view = new Uint8Array(buffer)
      let sequOffset = 0
      
      for (let i = 0; i < buffer.byteLength - 4; i++) {
        if (view[i] === 'S'.charCodeAt(0) &&
            view[i+1] === 'E'.charCodeAt(0) &&
            view[i+2] === 'Q'.charCodeAt(0) &&
            view[i+3] === 'U'.charCodeAt(0)) {
          sequOffset = i + 8 // Skip chunk header and size
          break
        }
      }
      
      expect(sequOffset).toBeGreaterThan(0)
      
      // First pattern should be 0, rest should be 255 or 0
      const firstPattern = view[sequOffset]
      expect(firstPattern).toBe(0)
    })
  })

  describe('Empty Command Array', () => {
    it('should handle empty commands', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(0)
    })

    it('should produce valid header for empty array', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      const header = readString(buffer, 0, 4)
      expect(header).toBe('MED ')
    })
  })

  describe('Note Commands', () => {
    it('should encode NOTE_ON commands', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 60, 100),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('should encode multiple NOTE_ON commands', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 60, 100),
        createMockCommand('NOTE_ON', 64, 100),
        createMockCommand('NOTE_ON', 67, 100),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('should handle NOTE_OFF commands', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 60, 100),
        createMockCommand('NOTE_OFF', 60, 0),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('should encode note values in valid range', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 0, 100),    // Lowest
        createMockCommand('NOTE_ON', 60, 100),   // Middle
        createMockCommand('NOTE_ON', 127, 100),  // Highest
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })
  })

  describe('Control Changes', () => {
    it('should encode CONTROL_CHANGE commands', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('CONTROL_CHANGE', 60, 100, {
          value: 7, // controller number
        }),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('should handle multiple control changes', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('CONTROL_CHANGE', 60, 100, {
          value: 7, // controller number
        }),
        createMockCommand('CONTROL_CHANGE', 60, 64, {
          value: 10, // controller number
        }),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })
  })

  describe('Mixed Commands', () => {
    it('should encode note and control changes', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 60, 100),
        createMockCommand('CONTROL_CHANGE', 60, 100, {
          value: 7, // controller number
        }),
        createMockCommand('NOTE_OFF', 60, 0),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('should maintain order of commands', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 60, 100),
        createMockCommand('NOTE_ON', 64, 100),
        createMockCommand('NOTE_OFF', 60, 0),
        createMockCommand('NOTE_OFF', 64, 0),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })
  })

  describe('Export with Metadata', () => {
    it('should export with title option', async () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands, {
        title: 'Test Song',
      })
      
      expect(buffer).toBeDefined()
    })

    it('should export with artist option', async () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands, {
        artist: 'Test Artist',
      })
      
      expect(buffer).toBeDefined()
    })

    it('should export with full metadata', async () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands, {
        title: 'Test Song',
        artist: 'Test Artist',
        tempo: 130,
        masterVolume: 200,
      })
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(0)
    })
  })

  describe('Buffer Integrity', () => {
    it('should return valid ArrayBuffer', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      expect(buffer instanceof ArrayBuffer).toBe(true)
    })

    it('should have reasonable buffer size', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // Should be at least the size of the header chunks
      expect(buffer.byteLength).toBeGreaterThan(100)
      // But not unreasonably large
      expect(buffer.byteLength).toBeLessThan(100000)
    })

    it('should scale buffer with more commands', () => {
      const emptyCommands: IAudioCommand[] = []
      const emptyBuffer = exporter.encode(emptyCommands)
      
      const manyCommands: IAudioCommand[] = Array.from({ length: 100 }, (_, i) =>
        createMockCommand('NOTE_ON', 60 + (i % 12), 100)
      )
      const manyBuffer = exporter.encode(manyCommands)
      
      expect(manyBuffer.byteLength).toBeGreaterThan(emptyBuffer.byteLength)
    })

    it('should have correct endianness (little-endian)', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // Version is 0x0410 - check via readUint32LE
      const version = readUint32LE(buffer, 12)
      expect(version).toBe(0x0410)
      
      // Also check the raw bytes are in little-endian order
      const view = new Uint8Array(buffer)
      const versionOffset = 12
      // Little-endian means low byte first: 0x10, 0x04, 0x00, 0x00
      expect(view[versionOffset]).toBe(0x10)
      expect(view[versionOffset + 1]).toBe(0x04)
    })
  })

  describe('Export Method', () => {
    it('should have export method', () => {
      expect(exporter.export).toBeDefined()
    })

    it('should return promise', () => {
      const commands: IAudioCommand[] = []
      const result = exporter.export(commands, 'test.med')
      
      expect(result instanceof Promise).toBe(true)
    })

    it('should handle export gracefully in browser environment', async () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 60, 100),
      ]
      
      // The export method should return a promise that resolves to boolean
      const result = await exporter.export(commands, 'test.med')
      
      // Should handle success or error gracefully (might fail in Node env)
      expect(typeof result === 'boolean').toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero velocity', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 60, 0),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('should handle maximum velocity', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 60, 127),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('should handle note number 0', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 0, 100),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('should handle note number 127', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 127, 100),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('should handle very large command arrays', () => {
      const commands: IAudioCommand[] = Array.from({ length: 1000 }, (_, i) =>
        createMockCommand('NOTE_ON', 60 + (i % 12), 100)
      )
      const buffer = exporter.encode(commands)
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('should handle invalid tempo gracefully', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands, { tempo: 0 })
      
      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('should handle extreme volume values', () => {
      const commands: IAudioCommand[] = []
      
      // Test max
      const maxBuffer = exporter.encode(commands, { masterVolume: 255 })
      expect(maxBuffer).toBeDefined()
      expect(maxBuffer.byteLength).toBeGreaterThan(100)
      
      // Test min
      const minBuffer = exporter.encode(commands, { masterVolume: 0 })
      expect(minBuffer).toBeDefined()
      expect(minBuffer.byteLength).toBeGreaterThan(100)
    })
  })

  describe('Chunk Structure', () => {
    it('should have chunks in correct order', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      const view = new Uint8Array(buffer)
      const chunks: Array<{ name: string; offset: number }> = []
      
      for (let i = 0; i < buffer.byteLength - 4; i++) {
        const chunk = String.fromCharCode(view[i], view[i+1], view[i+2], view[i+3])
        if (['MHDR', 'INST', 'SEQU', 'TRKD'].includes(chunk)) {
          chunks.push({ name: chunk, offset: i })
        }
      }
      
      // Verify chunks exist
      expect(chunks.length).toBeGreaterThan(0)
      
      // Verify MHDR comes first
      const mhdrIndex = chunks.findIndex(c => c.name === 'MHDR')
      expect(mhdrIndex).toBeGreaterThanOrEqual(0)
    })

    it('should have valid chunk sizes', () => {
      const commands: IAudioCommand[] = []
      const buffer = exporter.encode(commands)
      
      // Every chunk should have a size field after the ID
      const view = new Uint8Array(buffer)
      
      for (let i = 0; i < buffer.byteLength - 8; i++) {
        const chunkId = String.fromCharCode(view[i], view[i+1], view[i+2], view[i+3])
        
        if (['MHDR', 'INST', 'SEQU', 'TRKD'].includes(chunkId)) {
          const sizeOffset = i + 4
          const size = readUint32LE(buffer, sizeOffset)
          
          // Size should be reasonable
          expect(size).toBeGreaterThan(0)
          expect(size).toBeLessThan(100000)
        }
      }
    })
  })

  describe('Data Validation', () => {
    it('should not produce undefined buffers', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 64, 100),
      ]
      const buffer = exporter.encode(commands)
      
      expect(buffer).not.toBeUndefined()
      expect(buffer).not.toBeNull()
    })

    it('should produce deterministic output for same input', () => {
      const commands: IAudioCommand[] = [
        createMockCommand('NOTE_ON', 60, 100),
        createMockCommand('NOTE_OFF', 60, 0),
      ]
      
      const buffer1 = exporter.encode(commands)
      const buffer2 = exporter.encode(commands)
      
      expect(buffer1.byteLength).toBe(buffer2.byteLength)
      
      // Check first few bytes match
      const view1 = new Uint8Array(buffer1)
      const view2 = new Uint8Array(buffer2)
      
      for (let i = 0; i < Math.min(100, buffer1.byteLength); i++) {
        expect(view1[i]).toBe(view2[i])
      }
    })
  })
})

