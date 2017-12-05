
export const tau = 2 * Math.PI;
export const LOG_OF_TWO = Math.log(2);
// SUPER FAST! ///


// This only replaces the inbuilt Maths.sinh as it isn't available everywhere...
export const sinh = (x: number): number => {
    return (Math.exp(x) - Math.exp(-x)) * 0.5;
}

// shortcuts to maths functions to prevent .dot lookups and allow better uglification
// if we are going to town, may as well go all out!

// leaky integrator coefficient from decay time in ms
export const coeff_integrator = (decaytime: number, sampleRate: number)=> {
    return Math.exp(-1.0 / (sampleRate * 0.001 * decaytime));
}

// onepole filter coefficients
export const coeff_highpass = (cutoff: number, sampleRate: number): number[] =>{
    const x = Math.exp(-tau * cutoff * (1 / sampleRate));
    return [0, 0, 0.5 * (1 + x), -0.5 * (1 + x), x];
}

export const coeff_allpass = (cutoff: number, sampleRate: number): number[] =>{
    const t = Math.tan(Math.PI * cutoff * (1 / sampleRate));
    const x = (t - 1) / (1 + 1);
    return [0, 0, x, 1, -x];
}

// biquad filter coefficients
export const coeff_biquad_lowpass12db = (freq: number, gain: number, sampleRate: number): number[] => {
    const w = tau * freq / sampleRate;
    const s = Math.sin(w);
    const c = Math.cos(w);
    const q = gain;
    const alpha = s / (2 * q);
    const scale = 1 / (1 + alpha);
    const a1 = 2 * c * scale;
    const a2 = (alpha - 1) * scale;
    const b1 = (1 - c) * scale;
    const b0 = 0.5 * b1;
    const b2 = b0;
    return [0, 0, 0, 0, b0, b1, b2, a1, a2];
}

export const coeff_biquad_notch = function (freq: number, bandwidth: number, sampleRate: number): number[] {
    const w = tau * freq / sampleRate;
    const s = Math.sin(w);
    const c = Math.cos(w);
    const alpha = s * sinh(0.5 * LOG_OF_TWO * bandwidth * w / s);
    const scale = 1 / (1 + alpha);
    const a1 = 2 * c * scale;
    const a2 = (alpha - 1) * scale;
    const b0 = 1 * scale;
    const b1 = -2 * c * scale;
    const b2 = 1 * scale;
    return [0, 0, 0, 0, b0, b1, b2, a1, a2];
}

