type CanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
export interface SpectrumStyle {
	bars?: number
	gap?: number
	minBin?: number
	maxBin?: number
	logarithmic?: boolean
	peaks?: Float32Array
	peakColour?: string
	headroom?: number
	barColour?: (index: number, count: number) => string
}

/** Draws signal geometry only; callers own canvas sizing, styles, clearing and animation. */
export function drawWaveform(ctx: CanvasContext, data: Uint8Array, width: number, height: number) {
	if (!data.length) {
		return
	}
	ctx.beginPath()
	data.forEach((value, index) => {
		const x = (index / Math.max(1, data.length - 1)) * width
		const y = (value / 255) * height
		if (!index) {
			ctx.moveTo(x, y)
		} else {
			ctx.lineTo(x, y)
		}
	})
	ctx.stroke()
}

export function drawSpectrum(
	ctx: CanvasContext,
	data: Uint8Array,
	width: number,
	height: number,
	style: SpectrumStyle = {}
) {
	const min = Math.max(0, style.minBin ?? 0)
	const max = Math.min(data.length, style.maxBin ?? data.length)
	const count = Math.min(style.bars ?? 64, max - min)
	if (count <= 0) {
		return
	}
	const step = width / count
	const bin = (index: number) =>
		style.logarithmic
			? Math.max(1, min) * (max / Math.max(1, min)) ** (index / count)
			: min + (index * (max - min)) / count
	const fill = ctx.fillStyle
	for (let index = 0; index < count; index++) {
		const start = Math.floor(bin(index))
		const end = Math.min(
			max,
			Math.max(
				start + 1,
				style.logarithmic ? Math.ceil(bin(index + 1)) : Math.floor(bin(index + 1))
			)
		)
		let peak = 0
		for (let i = start; i < end; i++) {
			peak = Math.max(peak, data[i] / 255)
		}
		const extent = height - (style.headroom ?? 0)
		const barWidth = Math.max(1, step - (style.gap ?? 2))
		ctx.fillStyle = style.barColour?.(index, count) ?? fill
		ctx.fillRect(index * step, height - peak * extent, barWidth, peak * extent)
		if (style.peaks) {
			style.peaks[index] = Math.max(peak, style.peaks[index] - 0.012)
			ctx.fillStyle = style.peakColour ?? "#e0e7ff"
			ctx.fillRect(index * step, height - style.peaks[index] * extent - 2, barWidth, 2)
		}
	}
	ctx.fillStyle = fill
}