/**
 * Visualiser interface
 * All visualisers must implement the update method
 */
export interface IVisualiser {
  update(spectrum: Uint8Array, time: number, bufferLength: number): void
}
