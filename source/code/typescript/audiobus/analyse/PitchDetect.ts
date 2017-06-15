/*

Originally written by Chris Wilson, updated by zen

The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// import Scales from '../scales/Scales';
//
// var noteNumber = Scales.noteNumberFromPitch(pitch);
// var note = Scales.noteFromPitch(pitch);
// var detune = Scales.centsOffFromPitch(pitch, Scales.noteNumberFromPitch(pitch));
// flat: detune < 0,
// sharp: detune >= 0

import Engine from '../Engine';

class PitchDetection
{

  public static calculateRMS(audioBuffer:Float32Array):number
  {
    const bufLength = audioBuffer.length;

    let rms = 0, i;

    for (i = 0; i < bufLength; i++)
    {
      rms += audioBuffer[i] * audioBuffer[i];
    }

    return Math.sqrt(rms / bufLength);
  }

  // Autocorrelate...
  public static autoCorrelate (audioBuffer:Float32Array, sampleRate:number):number
  {
    const SIZE:number = audioBuffer.length;
    const MAX_SAMPLES:number = Math.floor(SIZE / 2);
    const MIN_SAMPLES:number = 0;

    let bestOffset:number = -1;
    let bestCorrelation:number = 0;
    let rms:number = PitchDetection.calculateRMS(audioBuffer);
    let foundGoodCorrelation:boolean = false;
    let correlations = new Array(MAX_SAMPLES);
    let i:number;
    let lastCorrelation:number;
    let offset:number;
    let correlation:number;

    // not enough signal
    if (rms < 0.01)
    {
      return -1;
    }

    lastCorrelation = 1;

    for (offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++)
    {
      correlation = 0;

      for (i = 0; i < MAX_SAMPLES; ++i)
      {
        correlation += Math.abs((audioBuffer[i]) - (audioBuffer[i + offset]));
      }

      correlation = 1 - (correlation / MAX_SAMPLES);

      // store it, for the tweaking we need to do below.
      correlations[offset] = correlation;

      if ((correlation > 0.9) && (correlation > lastCorrelation))
      {
        foundGoodCorrelation = true;

        if (correlation > bestCorrelation)
        {
          bestCorrelation = correlation;
          bestOffset = offset;
        }

      } else if (foundGoodCorrelation) {

        // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
        // Now we need to tweak the offset - by interpolating between the values to the left and right of the
        // best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
        // we need to do a curve fit on correlations[] around bestOffset in order to better determine precise
        // (anti-aliased) offset.

        // we know bestOffset >=1,
        // since foundGoodCorrelation cannot go to true until the second pass (offset=1), and
        // we can't drop into this clause until the following pass (else if).
        const shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) / correlations[bestOffset];
        return sampleRate / (bestOffset + (8 * shift));
      }

      lastCorrelation = correlation;
    }

    if (bestCorrelation > 0.01)
    {
      return sampleRate / bestOffset;
    }

    return -1;
  };

}


// create output class...
export default class PitchDetect
{
  public static BUFFER_LENGTH = 1024;

  private stream:MediaStream;
  private audioContext:AudioContext;
  private audioBuffer:Float32Array;
  private mediaStreamSource:MediaStreamAudioSourceNode;
  private analyser:AnalyserNode;

  constructor()
  {

  }

  public connect(stream:MediaStream)
  {
    // if (stream.active.ended)
    //  {
    //   return console.warn('Can not use PitchDetect on an ended stream');
    // }

    this.stream = stream;
    this.audioContext = Engine.fetch();
    this.audioBuffer = new Float32Array(PitchDetect.BUFFER_LENGTH);

    this.enumerateStream();
  }

  private enumerateStream():void
  {
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.mediaStreamSource.connect(this.analyser);
  }

  public getPitch():number
  {
    this.analyser.getFloatTimeDomainData(this.audioBuffer);
    return PitchDetection.autoCorrelate(this.audioBuffer, this.audioContext.sampleRate);
  }
}
