/**
 * MED File Export Adapter
 * Converts AudioEvent recording to ProTracker MED format
 */

import { MEDExporter } from '../med/med-exporter.ts';
import type RecorderAudioEvent from '../audio-event-recorder.ts';
import type AudioEvent from '../audio-event.ts';
import type Timer from '../timing/timer.ts';
import { NOTE_OFF, NOTE_ON } from '../commands';

/**
 * Trigger MED file download in browser
 */
export const saveMEDToLocalFileSystem = (buffer: ArrayBuffer, fileName: string) => {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.med`;
  
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Convert AudioEvent recording to MED format
 * @param recording - Recorded audio events
 * @param timer - Timer with BPM info
 * @returns MED file buffer
 */
export const createMEDFileFromAudioEventRecording = async (
  recording: RecorderAudioEvent,
  timer: Timer
): Promise<ArrayBuffer> => {
  const BPM = timer.BPM;
  const data: AudioEvent[] = recording.exportData();

  // Convert AudioEvent to IAudioCommand format
  const commands = data
    .filter((event) => event.type === NOTE_ON)
    .map((event) => ({
      type: 'NOTE_ON' as const,
      data: {
        note: event.noteNumber,
        velocity: 100,
      },
    }));

  // Export using MEDExporter
  const exporter = new MEDExporter();
  const buffer = exporter.encode(commands, {
    filename: recording.name,
    tempo: BPM,
    title: recording.name,
  });

  return buffer;
};

/**
 * Synchronous wrapper for event handler
 */
export const createAndDownloadMEDFile = async (
  recording: RecorderAudioEvent,
  timer: Timer
): Promise<void> => {
  const buffer = await createMEDFileFromAudioEventRecording(recording, timer);
  saveMEDToLocalFileSystem(buffer, recording.name);
};

