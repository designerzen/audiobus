// import {
// 	CMD_START,CMD_STOP,CMD_UPDATE,
// 	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
// } from './timing.js'
import {
	CMD_INITIALISE,
	CMD_START,CMD_STOP,CMD_UPDATE,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from './timing.events.js'

let timerID = null
let isRunning = false
let startTime = -1
let currentTime = -1
let gap = -1
let intervals = 0
let accurateTiming = true

const now = () => performance.now()

const elapsed = () => ( now() - startTime) * 0.001

const loop = interval => {
    
    /// TODO:
}

const reset = () =>{
    intervals = 0
    startTime = now()
}

const start = (interval=250)=>{
    // stop if running
    if (isRunning)
    {
        clearInterval(timerID)
    }

    if (!isRunning)
    {
        startTime = now()
        isRunning = true

        postMessage({event:EVENT_STARTING, time:0})
    }
    gap = interval
    loop(gap)

    // INITIAL tick
    postMessage({ event:EVENT_TICK, time:elapsed(), intervals })
}

const stop = () => {
    clearInterval(timerID)
    timerID = null
    isRunning = false
    postMessage({ event:EVENT_STOPPING, time:elapsed(), intervals })
}

self.onmessage = e => {

    const data = e.data

    switch (data.command)
    {
		// TODO : Set this up with the provided audioContext
        case CMD_INITIALISE:
            accurateTiming = data.accurateTiming || false
            start(data.interval)
            break

        case CMD_START:
            accurateTiming = data.accurateTiming || false
            start(data.interval)
            break

        case CMD_STOP:
            stop()
            break

        case CMD_UPDATE:
            start(data.interval)
            break
    }
}
