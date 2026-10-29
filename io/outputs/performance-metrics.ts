/** Wall-clock duration includes worker/async waiting; it is not CPU usage. */
export interface ChainPerformanceMeasurement {
    phase: 'transform' | 'output' | 'queue'
    durationMs: number
    events: number
    queueDepth: number
}

/** Netronome callback values are seconds; converted to milliseconds by the monitor. */
export interface TimerPerformanceMeasurement {
    drift: number
    lag: number
    timePassed: number
    expected: number
}

export interface PerformanceSample {
    timestamp: number
    fps: number
    frameMs: number
    eventsPerSecond: number
    transformMs: number
    outputMs: number
    queueDepth: number
    blockedPercent: number | null
    timerDriftMs: number | null
    timerLagMs: number | null
    timerJitterMs: number | null
    warnings: string[]
}

export const PERFORMANCE_HISTORY_LIMIT = 120

export function performanceWarnings(sample: Omit<PerformanceSample, 'warnings'>): string[] {
    const warnings: string[] = []
    if (sample.frameMs > 50) warnings.push('Frame stall > 50 ms')
    if (sample.fps < 30) warnings.push('FPS < 30')
    if ((sample.blockedPercent ?? 0) > 20) warnings.push('Main thread blocked > 20%')
    if (sample.transformMs > 16.7) warnings.push('Transform delay > 16.7 ms')
    if (sample.outputMs > 16.7) warnings.push('Output delay > 16.7 ms')
    if ((sample.timerLagMs ?? 0) > 10) warnings.push('Netronome lag > 10 ms')
    if ((sample.timerJitterMs ?? 0) > 10) warnings.push('Netronome jitter > 10 ms')
    return warnings
}
