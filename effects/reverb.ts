
/**
 * Create a reverb impulse response buffer
 */
export const createReverbImpulseResponse = (audioContext:AudioContext, duration:number, decay:number):AudioBuffer => {
     const rate = audioContext.sampleRate
     const length = rate * duration
     const impulse = audioContext.createBuffer(2, length, rate)
     const left = impulse.getChannelData(0)
     const right = impulse.getChannelData(1)
     
     for (let i = 0; i < length; i++) {
         left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
         right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
     }
     return impulse
}
