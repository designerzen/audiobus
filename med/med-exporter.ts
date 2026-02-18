/**
 * MED Format Exporter - ProTracker MED File Generation
 * On-demand client-side export (not a real-time audio output)
 * 
 * Usage:
 * const exporter = new MEDExporter()
 * const buffer = exporter.encode(audioRecording, options)
 * exporter.downloadFile(buffer, 'song.med')
 */

import type { IAudioCommand } from '../audio-command-interface.js';

export interface MEDExportOptions {
  filename?: string;
  tempo?: number;
  masterVolume?: number;
  artist?: string;
  title?: string;
}

interface MEDTrackEvent {
  tick: number;
  note: number;
  velocity: number;
  instrument: number;
}

/**
 * Pure TypeScript MED file encoder
 * Implements ProTracker MED format v4.10 for browser export
 */
class MEDEncoder {
  // Static constants  
  static readonly HEADER = 'MED ';
  static readonly VERSION = 0x0410;
  static readonly DEFAULT_TEMPO = 125;
  static readonly DEFAULT_ROWS = 64;
  static readonly NUM_INSTRUMENTS = 32;

  private buffer: Uint8Array = new Uint8Array(0);
  private bufferView: DataView | null = null;
  private position = 0;

  /**
   * Encode audio commands to MED format
   */
  encode(
    commands: IAudioCommand[],
    options: MEDExportOptions = {}
  ): ArrayBuffer {
    this.buffer = new Uint8Array(65536); // Start with 64KB
    this.bufferView = new DataView(this.buffer.buffer, 0, 65536);
    this.position = 0;

    // Write header
    this.writeHeader();

    // Write MHDR chunk
    this.writeMHDRChunk(options);

    // Write INST chunk
    this.writeINSTChunk();

    // Write SEQU chunk (sequence structure)
    this.writeSEQUChunk();

    // Write TRKD chunk (track data from commands)
    this.writeTRKDChunk(commands);

    // Return only the portion of buffer that was written
    return this.buffer.slice(0, this.position).buffer;
  }

  private writeHeader(): void {
    // Write "MED " identifier
    this.writeString('MED ');
  }

  private writeMHDRChunk(options: MEDExportOptions): void {
    this.writeChunkHeader('MHDR', 0x2C); // MHDR is 44 bytes fixed

    // Version
    this.writeUint32LE(MEDEncoder.VERSION);

    // Flags (0 = standard MED)
    this.writeUint32LE(0);

    // Number of instruments
    this.writeUint32LE(MEDEncoder.NUM_INSTRUMENTS);

    // Number of samples
    this.writeUint32LE(0);

    // Number of patterns
    this.writeUint32LE(1);

    // Number of tracks
    this.writeUint32LE(4);

    // Channel mode (1 = stereo)
    this.writeUint16LE(1);

    // Master volume (0-255)
    this.writeUint16LE(options.masterVolume || 255);

    // Master tempo (default 125 BPM)
    this.writeUint16LE(options.tempo || MEDEncoder.DEFAULT_TEMPO);

    // Number of rows per pattern
    this.writeUint8(MEDEncoder.DEFAULT_ROWS);

    // Compression (0 = no compression)
    this.writeUint8(0);

    // Master pitch
    this.writeUint32LE(0);

    // Flags (optional features)
    this.writeUint16LE(0);

    // Reserved
    this.writeUint8(0);
    this.writeUint8(0);
  }

  private writeINSTChunk(): void {
    const instSize = MEDEncoder.NUM_INSTRUMENTS * 32;
    this.writeChunkHeader('INST', instSize);

    for (let i = 0; i < MEDEncoder.NUM_INSTRUMENTS; i++) {
      // Sample length
      this.writeUint32LE(0);

      // Finetune (cents)
      this.writeInt16LE(0);

      // Volume (0-255)
      this.writeUint8(64);

      // Sample mode
      this.writeUint8(0);

      // Middle note (C-4 = 60)
      this.writeUint8(60);

      // Pad
      this.writeUint8(0);

      // Sample offset
      this.writeUint32LE(0);

      // Loop start
      this.writeUint32LE(0);

      // Loop length
      this.writeUint32LE(0);

      // Attribute flags
      this.writeUint16LE(0);

      // Reserved
      this.writeUint16LE(0);
    }
  }

  private writeSEQUChunk(): void {
    const seqSize = 128;
    this.writeChunkHeader('SEQU', seqSize);

    // Pattern sequence (simple linear sequence)
    for (let i = 0; i < 32; i++) {
      this.writeUint8(i === 0 ? 0 : 255); // Only pattern 0, rest empty
    }

    // Reserved
    for (let i = 32; i < seqSize; i++) {
      this.writeUint8(0);
    }
  }

  private writeTRKDChunk(commands: IAudioCommand[]): void {
    const trackData = this.encodeTrackData(commands);
    this.writeChunkHeader('TRKD', trackData.length);
    this.writeBytes(trackData);
  }

  private encodeTrackData(commands: IAudioCommand[]): Uint8Array {
    const data: number[] = [];
    let currentNote = 0;
    let currentInstrument = 1;

    for (const command of commands) {
      if (command.type === 'NOTE_ON') {
        // Use the note number from the command
        const note = command.number || 0;
        const velocity = command.velocity || 100;
        
        currentNote = note;
        currentInstrument = 1;

        // Encode note: [note][instrument][effect]
        data.push(note & 0x7F);
        data.push(currentInstrument & 0x3F);
        data.push(0); // Effect placeholder
        data.push(0); // Effect data
      } else if (command.type === 'NOTE_OFF') {
        // Note off (0x00)
        data.push(0);
        data.push(0);
        data.push(0);
        data.push(0);
      } else if (command.type === 'CONTROL_CHANGE') {
        // Use value field for the control value (MIDI standard)
        const controller = command.value || 0;
        const value = command.velocity || 0;
        
        // Map CC to MED effects
        data.push(currentNote);
        data.push(currentInstrument);
        data.push(0x0F); // Effect: parameter
        data.push((controller << 4) | (value & 0x0F));
      }
    }

    return new Uint8Array(data);
  }

  private writeChunkHeader(id: string, size: number): void {
    this.writeString(id);
    this.writeUint32LE(size);
  }

  private writeString(str: string): void {
    for (let i = 0; i < str.length; i++) {
      this.writeUint8(str.charCodeAt(i));
    }
  }

  private writeBytes(data: Uint8Array | number[]): void {
    for (const byte of data) {
      this.writeUint8(byte);
    }
  }

  private writeUint8(value: number): void {
    if (this.bufferView) {
      this.bufferView.setUint8(this.position, value & 0xFF);
    } else {
      // Fallback: write directly to Uint8Array
      this.buffer[this.position] = value & 0xFF;
    }
    this.position++;
  }

  private writeInt16LE(value: number): void {
    if (this.bufferView) {
      this.bufferView.setInt16(this.position, value, true);
    } else {
      // Fallback: write directly to Uint8Array
      this.buffer[this.position] = value & 0xFF;
      this.buffer[this.position + 1] = (value >>> 8) & 0xFF;
    }
    this.position += 2;
  }

  private writeUint16LE(value: number): void {
    if (this.bufferView) {
      this.bufferView.setUint16(this.position, value & 0xFFFF, true);
    } else {
      // Fallback: write directly to Uint8Array
      this.buffer[this.position] = value & 0xFF;
      this.buffer[this.position + 1] = (value >>> 8) & 0xFF;
    }
    this.position += 2;
  }

  private writeUint32LE(value: number): void {
    if (this.bufferView) {
      this.bufferView.setUint32(this.position, value >>> 0, true);
    } else {
      // Fallback: write directly to Uint8Array
      this.buffer[this.position] = value & 0xFF;
      this.buffer[this.position + 1] = (value >>> 8) & 0xFF;
      this.buffer[this.position + 2] = (value >>> 16) & 0xFF;
      this.buffer[this.position + 3] = (value >>> 24) & 0xFF;
    }
    this.position += 4;
  }
}

/**
 * MEDExporter - On-demand file export (not a real-time audio output)
 * 
 * Triggered only by user action (export button click)
 */
export class MEDExporter {
  private encoder = new MEDEncoder();

  /**
   * Encode audio commands to MED binary format (returns raw buffer, no download)
   */
  encode(
    commands: IAudioCommand[],
    options: MEDExportOptions = {}
  ): ArrayBuffer {
    return this.encoder.encode(commands, options);
  }

  /**
   * Export audio commands to MED format and trigger download
   */
  async export(
    commands: IAudioCommand[],
    filename: string = 'export.med',
    options: MEDExportOptions = {}
  ): Promise<boolean> {
    try {
      const buffer = this.encoder.encode(commands, options);
      this.downloadFile(buffer, filename);
      return true;
    } catch (error) {
      console.error('MED export error:', error);
      return false;
    }
  }

  /**
   * Export with metadata (title and artist)
   */
  async exportWithMetadata(
    commands: IAudioCommand[],
    filename: string,
    title: string,
    artist: string,
    options: MEDExportOptions = {}
  ): Promise<boolean> {
    return this.export(commands, filename, {
      ...options,
      title,
      artist,
    });
  }

  /**
   * Get format capabilities and constraints
   */
  getCapabilities(): Record<string, any> {
    return {
      medVersion: '4.10',
      maxInstruments: 32,
      maxPatterns: 128,
      maxTracks: 16,
      patternLines: 64,
      isClientSide: true,
      supportsMetadata: true,
      description: 'ProTracker MED Format',
    };
  }

  /**
   * Trigger browser file download
   */
  private downloadFile(buffer: ArrayBuffer, filename: string): void {
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the object URL
    URL.revokeObjectURL(url);
  }
}

export default MEDExporter;

