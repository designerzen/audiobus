// @ts-nocheck
// import {
// 	CMD_START,CMD_STOP,CMD_UPDATE,
// 	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
// } from './timing'
import {
	CMD_START,CMD_STOP,CMD_UPDATE,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from './timing.events'

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
    
    // Loop
    timerID = setTimeout( ()=>{

        const expected = intervals * gap * 0.001
        const passed = elapsed()
        const difference = expected - passed

        currentTime = now()
        
        intervals++
        
        postMessage({ event:EVENT_TICK, time:passed, intervals })
        // console.log({expected,passed,difference,currentTime})

        // modify the interval to accomodate the drift
        const nextInterval = accurateTiming ? interval + difference : interval 

        // call itself with the new interval?
        loop(nextInterval)

    }, interval)
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


