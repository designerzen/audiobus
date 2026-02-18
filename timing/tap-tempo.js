
/**
 * TODO: Implement lienar regression like nayuki
 * https://www.nayuki.io/page/tap-to-measure-tempo-javascript
 * Converts a series of method calls into a tempo estimate.
 * @param {Boolean} autoReset Start a new estimation session if timeout reached
 * @param {Number} timeOut Time frame before ignoring the event and starting a fresh estimation session
 * @param {Number} minimumTaps Requires at least x taps before estimate set
 * @returns {Number} New Period
 */
let beatTimes = []
const TAP_TIMEOUT = 10000
const MINIMUM_TEMPOS = 2
export const tapTempoQuick = (autoReset=true, timeOut=TAP_TIMEOUT, minimumTaps = MINIMUM_TEMPOS) => {
    
    const currentTime = performance ? performance.now() : Date.now()

    if ( autoReset && beatTimes.length > 0 && currentTime - beatTimes[beatTimes.length-1] > timeOut )
    {
        beatTimes = []
    }

    beatTimes.push(currentTime)

    const quantity = beatTimes.length
    const x = quantity - 1
    const y = beatTimes[x] - beatTimes[0]
    // const time = (y / 1000).toFixed(3)
   
    if (quantity >= minimumTaps) 
    {
        // const tempo = 60000 * x / y
        const period = y / x
        return period
    }
    return -1
}

export const tapTempo = (autoReset=true, timeOut=TAP_TIMEOUT, minimumTaps = MINIMUM_TEMPOS) => {

	let beatTimes = []
	let xSum  = 0
	let xxSum = 0
	let ySum  = 0
	let yySum = 0
	let xySum = 0

	let periodPrev = NaN
	let aPrev = NaN
	let bPrev = NaN

	return () => {

		let period = -1

		const now = Date.now()
		const previous = beatTimes[ beatTimes.length-1 ]
		const deviation = now - previous

		if (deviation > timeOut)
		{
			// the delay between taps has exceeded our 
			// expectations so we reset
			beatTimes = []
			periodPrev = NaN
			aPrev = NaN
			bPrev = NaN
			xSum  = 0
			xxSum = 0
			ySum  = 0
			yySum = 0
			xySum = 0
		}

		// Add beat
		beatTimes.push(now)

		const samples = beatTimes.length
		
		// Coordinates for linear regression
		const x = samples - 1
		const timeInMillSeconds = beatTimes[samples - 1] - beatTimes[0]
		const timeInSeconds = timeInMillSeconds / 1000
		// setText("simple-time", + " s")
		
		// Regression cumulative variables
		xSum  += x
		xxSum += x * x
		ySum  += timeInMillSeconds
		yySum += timeInMillSeconds * timeInMillSeconds
		xySum += x * timeInMillSeconds
		
		const tempo = 60000 * x / timeInMillSeconds

		const alter = (samples < 8 || tempo < 190)
		
		const bar = alter ?  Math.floor(x / 4) :  Math.floor(x / 8)
		const beat = alter ?  x % 4 : Math.floor(x / 2) % 4 + "." + x % 2 * 5

		if (samples >= 2) 
		{
			// Period and tempo, simple
			period = timeInMillSeconds / x
			
			// Advanced
			const xx = samples * xxSum - xSum * xSum
			// const yy = beatsPer * yySum - ySum * ySum
			// const xy = beatsPer * xySum - xSum * ySum
			const slope = (samples * xySum - xSum * ySum) / xx  
			const intercept = (ySum * xxSum - xSum * xySum) / xx 

			// Deviations from prediction
			if (samples >= minimumTaps) 
			{
				const simpleLastDev = periodPrev * x - timeInMillSeconds;
				const advancedLastDev = aPrev * x + bPrev - timeInMillSeconds;

				// setText("simple-last-dev"  , Math.abs(simpleLastDev).toFixed(1) + " ms " + (simpleLastDev < 0 ? "late" : "early"));
				// setText("advanced-std-dev" , Math.sqrt(((yy - xy * xy / xx) / beatsPer) / (beatsPer - 2)).toFixed(2) + " ms");
				// setText("advanced-last-dev", Math.abs(advancedLastDev).toFixed(1) + " ms " + (advancedLastDev < 0 ? "late" : "early"));
			}

			// setText("simple-tempo", tempo.toFixed(2) + " BPM");
			// setText("advanced-tempo", (60000 / a).toFixed(3) + " BPM");
	
			// setText("simple-period", period.toFixed(2) + " ms");
			
			// setText("advanced-period", a.toFixed(3) + " ms");
			// setText("advanced-offset", b.toFixed(2).replace(/-/, "\u2212") + " ms");
			// setText("advanced-correlation", (xy * xy / (xx * yy)).toFixed(9));
			
			periodPrev = period
			aPrev = slope
			bPrev = intercept
		}

		const accuratePeriod = aPrev||period
		const bpm = 60000 / accuratePeriod

		return {
			available:samples>1,
			bar,
			period,
			accuratePeriod,
			beat,
			samples,
			timeInSeconds,
			tempo,
			bpm,
			// now, previous, 
			deviation
		}
	}

}