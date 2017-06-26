/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Bass Drum
==============
Abstract    - Basic Percussion Element
Description -
Use         - trigge
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
import Instrument from '../Instrument';
import Envelope from '../../envelopes/Envelope';

export default class Snare extends Instrument
{
	private noise:AudioBufferSourceNode;
	private noiseBuffer:AudioBuffer;
	private noiseData:Float32Array;

	// create
	constructor( audioContext?:AudioContext )
	{
		super( audioContext );

		//	GENERATE NOISE >>>
		this.noiseBuffer = audioContext.createBuffer(1, 22050, 22050);
		this.noiseData = this.noiseBuffer.getChannelData(0);

		for (let i = 0, l = this.noiseData.length; i < l ; ++i)
		{
      // 0 -> 1
			this.noiseData[i] = (Math.random() - 0.5) * 2;
		}
		this.noise = audioContext.createBufferSource();
		this.noise.loop = true;
		this.noise.buffer = this.noiseBuffer;

    this.envelope.attackTime = 0.025;
    this.envelope.decayTime = 0.050;
    this.envelope.releaseTime = 0.3;
    this.envelope.sustainVolume = 0.2;

    // Connect these bits and pieces together
    this.input = this.noise;
	}

	// trigger!
	public start( l:number=2050, attack:number=0.025, offsetB:number=0.050, offsetC:number=0.3):boolean
	{
          /*
		var t:number = this.context.currentTime;

          // ASDR
		this.gain.gain.cancelScheduledValues( t );
		this.gain.gain.setValueAtTime(1, t);
		this.gain.gain.linearRampToValueAtTime(1, t + attack);
		this.gain.gain.exponentialRampToValueAtTime(0.2, t + offsetB);
		this.gain.gain.linearRampToValueAtTime(0.0, t + offsetC);
          */
    if  ( super.start() )
    {
        // as you always want the snare to sound the same
        // we always start the noise from the same position
        this.noise.start(0);
        return true;
    }else{
        return false;
    }
	}
  /*
  public stop():boolean
  {
      this.envelope.stop();
      return super.stop();
  }
  */
}
