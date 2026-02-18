// @ts-nocheck
import {
	CMD_START,CMD_STOP,CMD_UPDATE,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from './timing.events'

const GAP_BETWEEN_LOOPS = 0

let isRunning = false
let startTime = -1
let currentTime = -1
let nextInterval = -1
let gap = 0
let intervals = 0
let timerID = -1
let exit = false
let accurateTiming = true

const now = () => performance.now() || Date.now()

const elapsed = () => (now() - startTime) * 0.001

const reset = () => {
    intervals = 0
    startTime = now()
}

/**
 * drifting short loop
 * @returns 
 */
const loop = () => {

    if (exit)
    {
        exit = false
        return
    }

    currentTime = now()
  
    // if the currentTime is equal or greater to our rolling time + interval
    if (currentTime >= nextInterval)
    {
        // update our counter
        intervals++
		nextInterval += gap
        // callback
        postMessage({ event:EVENT_TICK, time:elapsed(), intervals })
    }

    timerID = setTimeout(loop, GAP_BETWEEN_LOOPS )
}

const start = (interval=250, accurateTiming=true )=>{

    gap = interval
   
	if (isRunning)
    {
        clearInterval(timerID)
    }

    if (!isRunning)
    {   
        startTime = now()
		// work out the next step from this step...
		nextInterval = startTime + interval
        isRunning = true
        postMessage({event:EVENT_STARTING, time:0, intervals})
    }else{
		// work out the next step from this step...
		nextInterval = now() + interval
	}
	
    loop()
	
    // INITIAL tick
    postMessage({event:EVENT_TICK, time:elapsed(), intervals})
}

const stop = () => {
    exit = true
    isRunning = false
    postMessage({ event:EVENT_STOPPING, time:elapsed(), intervals })
}

self.onmessage = e => {

    const data = e.data

    switch (data.command)
    {
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


