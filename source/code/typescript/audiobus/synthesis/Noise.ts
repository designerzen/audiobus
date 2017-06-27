// Thank you very much!
// https://noisehack.com/generate-noise-web-audio-api/
// TODO : Cache the streams...
export default class Noise
{
  constructor()
  {
    throw Error("Noise must be accessed via Noise.pink()");
  }

  protected static generate( length:number=1, shape:Function=Noise.white, sampleRate:number=44100, offline:boolean=false ):AudioBuffer
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
  public static white( length:number=2, sampleRate:number=44100 ):AudioBuffer
  {
    return Noise.generate( length, Noise.generateWhite );
  }

  // defaults to 2 seconds
  public static pink( length:number=2, sampleRate:number=44100 ):AudioBuffer
  {
    return Noise.generate( length, Noise.generatePink );
  }

  // Brownian noise decreases in power by 12dB/octave, and sounds like a waterfall
  // defaults to 2 seconds
  public static brown( length:number=2, sampleRate:number=44100 ):AudioBuffer
  {
    return Noise.generate( length, Noise.generateBrown );
  }

  // Whereas white noise has equal power across the frequency spectrum, pink noise
  // sounds like it has equal power across the frequency spectrum.
  // Our ears process frequencies logarithmically, and pink noise takes this into account.
  // In terms of ambient noise, I find that pink noise sounds much nicer than white noise,
  // which is too harsh in the upper frequencies.
  // To generate pink noise, we’ll approximate the effects of a -3dB/octave filter
  // using Paul Kellet’s refined method
  public static generatePink( output:Float32Array, size:number ):Float32Array
  {
    // if we want this noise to rolll... mmake instance of ...
    let b0 = 0.0;
    let b1 = 0.0;
    let b2 = 0.0;
    let b3 = 0.0;
    let b4 = 0.0;
    let b5 = 0.0;
    let b6 = 0.0;

    for (let i = 0; i < size; i++)
    {
        var white = Math.random() * 2 - 1;

        // make it pink with a filter
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;

        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11; // (roughly) compensate for gain
        b6 = white * 0.115926;
      }
      return output;
  }

  //	GENERATE WHITE NOISE
  // always lazily instantiated unless requested in config...
  public static generateWhite( output:Float32Array, size:number ):Float32Array
  {
    for (let i = 0; i < size; i++)
    {
      output[i] = Math.random() * 2 - 1;
    }
    return output;
  }

  public static generateBrown( output:Float32Array, size:number ):Float32Array
  {
    let lastOut = 0.0;
    for (let i = 0; i < size; i++)
    {
      var white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // (roughly) compensate for gain
    }
    return output;
  }

}
