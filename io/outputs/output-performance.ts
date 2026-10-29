import type { IAudioOutput } from './output-interface'
import { EVENT_CLICK, EVENT_VISIBILITY_CHANGE } from '../../event-constants'
import { PERFORMANCE_HISTORY_LIMIT, performanceWarnings, type ChainPerformanceMeasurement, type PerformanceSample, type TimerPerformanceMeasurement } from './performance-metrics'

const SVG_NS = 'http://www.w3.org/2000/svg'
const SAMPLE_INTERVAL_MS = 1000

/** A passive sink: chain timings include async waits; browser pressure is app-wide. */
export default class OutputPerformance implements IAudioOutput {
    static ID = 0
    readonly uuid = `Output-Performance-${OutputPerformance.ID++}`
    readonly name = 'Performance'
    readonly description = 'IOChain load and app-wide responsiveness with Netronome timing'
    readonly isHidden = false
    readonly requiresConnectionControl = false
    #running = true
    #history: PerformanceSample[] = []
    #container: HTMLElement | null = null
    #summary: HTMLElement | null = null
    #status: HTMLElement | null = null
    #graphs: HTMLElement | null = null
    #frame = 0
    #observer: PerformanceObserver | null = null
    #longTasksSupported = false
    #blocked: Array<{ start: number; end: number }> = []
    #started = performance.now()
    #previousFrame = this.#started
    #frames = 0
    #frameMax = 0
    #events = 0
    #transformMax = 0
    #outputMax = 0
    #queueMax = 0
    #timerAt = -Infinity
    #drift: number | null = null
    #lag: number | null = null
    #jitter: number | null = null
    #previousTimerError: number | null = null

    get isConnected(): boolean { return this.#running }
    /** Copies prevent callers from mutating the recording. Shared nodes aggregate attached chains. */
    get samples(): PerformanceSample[] { return this.#history.map(sample => ({ ...sample, warnings: [...sample.warnings] })) }

    constructor(_options?: Record<string, unknown>) {
        if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
            try {
                this.#observer = new PerformanceObserver(list => {
                    if (document.hidden || !this.#running) return
                    for (const entry of list.getEntries()) this.#blocked.push({ start: entry.startTime, end: entry.startTime + entry.duration })
                })
                this.#observer.observe({ entryTypes: ['longtask'] })
                this.#longTasksSupported = true
            } catch { this.#observer?.disconnect(); this.#observer = null }
        }
        document.addEventListener(EVENT_VISIBILITY_CHANGE, this.#onVisibility)
        this.#frame = requestAnimationFrame(this.#animate)
    }

    noteOn(): void {}
    noteOff(): void {}
    allNotesOff(): void {}
    hasAudioOutput(): boolean { return false }
    hasMidiOutput(): boolean { return false }

    recordChainPerformance(measurement: Readonly<ChainPerformanceMeasurement>): void {
        if (!this.#running || document.hidden) return
        if (!Number.isFinite(measurement.durationMs) || measurement.durationMs < 0) return
        if (measurement.phase === 'output') {
            this.#events += measurement.events
            this.#outputMax = Math.max(this.#outputMax, measurement.durationMs)
        } else if (measurement.phase === 'transform') this.#transformMax = Math.max(this.#transformMax, measurement.durationMs)
        this.#queueMax = Math.max(this.#queueMax, measurement.queueDepth)
    }

    recordTimerPerformance(measurement: Readonly<TimerPerformanceMeasurement>): void {
        if (!this.#running || document.hidden) return
        const { drift, lag, timePassed, expected } = measurement
        if (![drift, lag, timePassed, expected].every(Number.isFinite)) return
        const error = (timePassed - expected) * 1000
        this.#drift = Math.max(this.#drift ?? 0, Math.abs(drift * 1000))
        this.#lag = Math.max(this.#lag ?? 0, Math.max(0, lag * 1000))
        if (this.#previousTimerError !== null) this.#jitter = Math.max(this.#jitter ?? 0, Math.abs(error - this.#previousTimerError))
        this.#previousTimerError = error
        this.#timerAt = performance.now()
    }

    #resetWindow(now: number): void {
        this.#started = now
        this.#previousFrame = now
        this.#frames = this.#frameMax = this.#events = this.#transformMax = this.#outputMax = this.#queueMax = 0
        this.#drift = this.#lag = this.#jitter = null
    }

    #onVisibility = (): void => {
        // Background tabs throttle rAF: omit these gaps rather than report false lag.
        this.#resetWindow(performance.now())
        this.#previousTimerError = null
        this.#blocked = []
    }

    #animate = (now: number): void => {
        if (!this.#running) return
        if (!document.hidden) {
            this.#frames++
            this.#frameMax = Math.max(this.#frameMax, now - this.#previousFrame)
            this.#previousFrame = now
            if (now - this.#started >= SAMPLE_INTERVAL_MS) this.#sample(now)
        }
        this.#frame = requestAnimationFrame(this.#animate)
    }

    #sample(now: number): void {
        const elapsed = now - this.#started
        let blockedMs = 0
        // Long-task notifications can arrive after the previous sampling frame.
        for (const entry of this.#blocked) blockedMs += entry.end <= this.#started
            ? entry.end - entry.start
            : Math.max(0, Math.min(now, entry.end) - Math.max(this.#started, entry.start))
        this.#blocked = this.#blocked.filter(entry => entry.end > now)
        const timerFresh = now - this.#timerAt < 2000
        if (!timerFresh) this.#previousTimerError = null
        const values: Omit<PerformanceSample, 'warnings'> = {
            timestamp: now, fps: this.#frames * 1000 / elapsed, frameMs: this.#frameMax,
            eventsPerSecond: this.#events * 1000 / elapsed,
            transformMs: this.#transformMax, outputMs: this.#outputMax, queueDepth: this.#queueMax,
            blockedPercent: this.#longTasksSupported ? Math.min(100, blockedMs * 100 / elapsed) : null,
            timerDriftMs: timerFresh ? this.#drift : null,
            timerLagMs: timerFresh ? this.#lag : null,
            timerJitterMs: timerFresh ? this.#jitter : null,
        }
        this.#history.push({ ...values, warnings: performanceWarnings(values) })
        if (this.#history.length > PERFORMANCE_HISTORY_LIMIT) this.#history.shift()
        this.#resetWindow(now)
        this.#render()
    }

    clear(): void {
        this.#history = []
        this.#blocked = []
        this.#previousTimerError = null
        this.#resetWindow(performance.now())
        this.#render()
    }

    async createGui(): Promise<HTMLElement> {
        if (this.#container) return this.#container
        const container = document.createElement('section')
        container.setAttribute('aria-label', 'Performance monitor')
        container.style.cssText = 'width:340px;max-width:100%;padding:12px;box-sizing:border-box;background:#101827;color:#e2e8f0;border-radius:8px;font:12px/1.5 monospace;'
        this.#status = document.createElement('strong')
        this.#summary = document.createElement('div')
        this.#summary.style.whiteSpace = 'pre-line'
        this.#graphs = document.createElement('div')
        const help = document.createElement('p')
        help.textContent = 'Last 120 samples, ~1 s each. FPS / blocking are app-wide CPU pressure indicators. Blocking counts tasks ≥50 ms, not CPU %. Chain delays include worker and output waits; shared monitors aggregate chains. Timing values are peak magnitudes; jitter is the change in tick timing error. Red markers show lag; hover for causes. Hidden-tab time is omitted.'
        help.style.cssText = 'font:11px/1.5 sans-serif;color:#cbd5e1;'
        const clear = document.createElement('button')
        clear.type = 'button'
        clear.textContent = 'Clear recording'
        clear.addEventListener(EVENT_CLICK, () => this.clear())
        container.append(this.#status, this.#summary, this.#graphs, help, clear)
        this.#container = container
        this.#render()
        return container
    }

    #render(): void {
        if (!this.#summary || !this.#status || !this.#graphs) return
        const sample = this.#history.at(-1)
        this.#status.textContent = sample ? (sample.warnings.length ? `Lag: ${sample.warnings.join(' · ')}` : 'Performance steady') : 'Waiting for samples…'
        this.#status.style.color = sample?.warnings.length ? '#fca5a5' : '#86efac'
        const format = (value: number | null | undefined, unit = ' ms') => value == null ? 'N/A' : `${value.toFixed(1)}${unit}`
        this.#summary.textContent = sample
            ? `FPS ${format(sample.fps, '')} · Events/s ${format(sample.eventsPerSecond, '')}\nPeak frame ${format(sample.frameMs)} · Blocked ${format(sample.blockedPercent, '%')}\nTransform ${format(sample.transformMs)} · Output ${format(sample.outputMs)}\nPeak queue ${sample.queueDepth} · Netronome drift ${format(sample.timerDriftMs)}\nClock lag ${format(sample.timerLagMs)} · Jitter ${format(sample.timerJitterMs)}`
            : 'Recording while this device is attached. Netronome metrics require a running transport.'
        this.#graphs.replaceChildren(
            this.#graph('App FPS', [{ key: 'fps', label: 'FPS', color: '#86efac' }], 60),
            this.#graph('Chain events / second', [{ key: 'eventsPerSecond', label: 'Events/s', color: '#67e8f9' }], 10),
            this.#graph('Peak chain delay (ms)', [{ key: 'transformMs', label: 'Transform', color: '#c4b5fd' }, { key: 'outputMs', label: 'Output', color: '#fcd34d' }], 20),
            this.#graph('Main thread blocked (%)', [{ key: 'blockedPercent', label: 'Blocked', color: '#fb923c' }], 100),
            this.#graph('Netronome peaks (ms)', [{ key: 'timerDriftMs', label: 'Drift', color: '#67e8f9' }, { key: 'timerLagMs', label: 'Lag', color: '#fcd34d' }, { key: 'timerJitterMs', label: 'Jitter', color: '#c4b5fd' }], 10),
        )
    }

    #graph(label: string, series: Array<{ key: keyof Omit<PerformanceSample, 'warnings'>; label: string; color: string }>, minimum: number): HTMLElement {
        const figure = document.createElement('figure')
        figure.style.cssText = 'margin:8px 0;'
        const caption = document.createElement('figcaption')
        caption.textContent = label
        const svg = document.createElementNS(SVG_NS, 'svg')
        svg.setAttribute('viewBox', '0 0 312 64')
        svg.setAttribute('role', 'img')
        svg.setAttribute('aria-label', `${label}. Red markers indicate lag. Time runs left to right.`)
        svg.style.cssText = 'display:block;width:100%;background:#1e293b;border-radius:4px;'
        const max = Math.max(minimum, ...this.#history.flatMap(sample => series.map(metric => sample[metric.key] ?? 0)))
        const x = (index: number) => 30 + index * 278 / (PERFORMANCE_HISTORY_LIMIT - 1)
        const y = (value: number) => 58 - value / max * 48
        for (const [index, sample] of this.#history.entries()) {
            if (!sample.warnings.length) continue
            const marker = document.createElementNS(SVG_NS, 'path')
            marker.setAttribute('d', `M${x(index)},5 V59`)
            marker.setAttribute('stroke', '#f87171')
            marker.setAttribute('stroke-opacity', '0.5')
            const title = document.createElementNS(SVG_NS, 'title')
            title.textContent = `${((sample.timestamp - this.#history[0].timestamp) / 1000).toFixed(1)} s: ${sample.warnings.join('; ')}`
            marker.append(title)
            svg.append(marker)
        }
        for (const metric of series) {
            let path = ''
            let connected = false
            this.#history.forEach((sample, index) => {
                const value = sample[metric.key]
                if (value === null) { connected = false; return }
                path += `${connected ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)} `
                connected = true
            })
            const line = document.createElementNS(SVG_NS, 'path')
            line.setAttribute('d', path)
            line.setAttribute('fill', 'none')
            line.setAttribute('stroke', metric.color)
            line.setAttribute('stroke-width', '1.5')
            svg.append(line)
            const legend = document.createElement('span')
            legend.style.cssText = `color:${metric.color};margin-right:10px;font-size:10px;`
            legend.textContent = metric.label
            caption.append(' ', legend)
        }
        const scale = document.createElementNS(SVG_NS, 'text')
        scale.setAttribute('x', '2')
        scale.setAttribute('y', '12')
        scale.setAttribute('fill', '#cbd5e1')
        scale.setAttribute('font-size', '9')
        scale.textContent = max.toFixed(0)
        svg.append(scale)
        figure.append(caption, svg)
        return figure
    }

    async destroyGui(): Promise<void> {
        this.#container?.remove()
        this.#container = this.#summary = this.#status = this.#graphs = null
    }

    destroy(): void {
        this.#running = false
        cancelAnimationFrame(this.#frame)
        document.removeEventListener(EVENT_VISIBILITY_CHANGE, this.#onVisibility)
        this.#observer?.disconnect()
        this.#observer = null
        this.#blocked = []
        void this.destroyGui()
    }
}
