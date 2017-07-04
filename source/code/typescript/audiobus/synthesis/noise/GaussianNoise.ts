// Thank you very much!
// https://noisehack.com/generate-noise-web-audio-api/
// TODO : Cache the streams...
export default class GaussianNoise
{
  constructor()
  {
    throw Error("Noise must be accessed via Noise.pink()");
  }

  protected static generate( length:number=1, shape:Function=GaussianNoise.gaussian, sampleRate:number=44100, offline:boolean=false ):AudioBuffer
  {
    // const sampleRate = audioContext.sampleRate;
    // const bufferSize = 2 * audioContext.sampleRate;
    // const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    // return noiseBuffer.getChannelData(0);
    const samples = length * sampleRate;  // seconds of samples...
    // offline
    //const context = offline ? new OfflineAudioContext(1, samples, sampleRate) : new AudioContext(1, samples, sampleRate);
    const context = new OfflineAudioContext(1, samples, sampleRate) ;
    const noiseBuffer:AudioBuffer = context.createBuffer(1, samples, sampleRate); // THIS IS RETURNED!
    const noiseData:Float32Array = noiseBuffer.getChannelData(0);
    // noiseData.length
    // modify output...
    shape( noiseData, samples );
    return noiseBuffer;
  }

  // defaults to 2 seconds
  public static gaussian( length:number=2, sampleRate:number=44100 ):AudioBuffer
  {
    return GaussianNoise.generate( length, GaussianNoise.generateGaussian );
  }

  //	GENERATE WHITE NOISE
  // always lazily instantiated unless requested in config...
  public static generateGaussian( output:Float32Array, size:number ):Float32Array
  {
    for (let i = 0; i < size; i++)
    {
      output[i] = Math.random();
    }
    return output;
  }


}
