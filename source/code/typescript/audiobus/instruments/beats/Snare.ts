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
import Noise from '../../synthesis/Noise';

const PI_OVER_180 = Math.PI / 180;

export default class Snare extends Instrument
{
	private noise:AudioBufferSourceNode;
	private oscillator:OscillatorNode;
	public compressor:DynamicsCompressorNode;
	public noiseHiPassFilter:BiquadFilterNode;

	private distortionCrve(amount:number=50)
	{
	  const n_samples = 44100
	  const curve = new Float32Array(n_samples);
	  const deg = PI_OVER_180;
	  let  x;

	  for ( let i=0; i < n_samples; ++i )
		{
	    x = i * 2 / n_samples - 1;
	    curve[i] = ( 3 + amount ) * x * 20 * deg / ( Math.PI + amount * Math.abs(x) );
	  }
	  return curve;
	}

	// create
	constructor( audioContext?:AudioContext )
	{
		super( audioContext );

		const masterHighBump = audioContext.createBiquadFilter();
    masterHighBump.frequency.value = 4000;
    masterHighBump.gain.value = 6;
    masterHighBump.type = "peaking";

		const masterLowBump = audioContext.createBiquadFilter();
    masterLowBump.frequency.value = 200;
    masterLowBump.gain.value = 12;
    masterLowBump.type = "peaking";


		// a tasty high pass filter to take off some of the lower frequencies of the noise...
		const noiseHiPassFilter = this.context.createBiquadFilter();
		noiseHiPassFilter.type = 'highpass';
		noiseHiPassFilter.gain.value = 12;
		noiseHiPassFilter.frequency.value = 1000;	// 1200
		this.noiseHiPassFilter = noiseHiPassFilter

		const compressor = audioContext.createDynamicsCompressor();
		compressor.threshold.value = -15;
		compressor.knee.value = 33;
		compressor.ratio.value = 5;
		//compressor.reduction = -10;
		compressor.attack.value = 0.005;
		compressor.release.value = 0.15;

		this.compressor= compressor;

		compressor.connect(noiseHiPassFilter);
		noiseHiPassFilter.connect(masterHighBump);
		masterHighBump.connect(masterLowBump);
		//masterLowBump.connect(osc);
		//masterLowBump.connect(noiseHiPassFilter);

		this.input = masterLowBump;
		console.error( 'this.input ',this.input , masterHighBump);
		// now connect the input and save a reference...


		    // const oscsHighpass = audioContext.createBiquadFilter();
		    // oscsHighpass.type = "highpass";
		    // oscsHighpass.frequency.value = 400;
		    // oscsHighpass.connect(masterBus);

		//this.input = this.noise;
		// const envelope:Envelope = this.envelope;
    // envelope.attackTime = 0.025;
    // envelope.decayTime = 0.050;
    // envelope.releaseTime = 0.3;
    // envelope.sustainVolume = 0.2;
		const envelope = this.envelope;
		envelope.gain = 8;
		envelope.amplitude = 0.6;
		envelope.attackTime = 0.002;
		envelope.decayTime = 0.005;
		envelope.holdTime = 0.1;
		envelope.hold = false;
		envelope.releaseTime = 0.1;
		envelope.sustainVolume = 0.5;
		envelope.decayType = Envelope.CURVE_TYPE_EXPONENTIAL;
	}

	public createNoise():void
	{
		const osc = this.audioContext.createOscillator();
    osc.frequency.value = 100;	// low freq!
		osc.type = 'triangle';
		this.oscillator = osc;
		this.oscillator.connect( this.compressor );

		this.noise = this.audioContext.createBufferSource();
		this.noise.buffer = Noise.white( 1, this.audioContext.sampleRate );
		this.noise.loop = true;
		console.error( 'this.input ',this.noiseHiPassFilter );
		// Connect these bits and pieces together
		this.noise.connect( this.noiseHiPassFilter );
	}

	public destroyNoise():void
	{
		this.oscillator.stop();
		this.oscillator.disconnect( this.compressor );
		this.oscillator = null;

		this.noise.stop();
		//this.input = null;
		this.noise.disconnect( this.noiseHiPassFilter );
		this.noise = null;
	}

	// trigger!
	public start( startFrequency:number=10,endFrequency:number=200 ):boolean
	{
		const wasPlaying:boolean = super.start();
		const time:number = this.audioContext.currentTime;

    if  ( wasPlaying )
    {
        // as you always want the snare to sound the same
        // we always start the noise from the same position
				this.destroyNoise();

    }else{

    }
		this.createNoise();
		this.noise.start(0);
		// ramp!
		this.oscillator.frequency.cancelScheduledValues(time);
		this.oscillator.frequency.setValueAtTime(100, time);
		this.oscillator.frequency.exponentialRampToValueAtTime( endFrequency, time+length );
		this.oscillator.start(time)

		return wasPlaying;
	}

  public stop():boolean
  {
      this.destroyNoise();
      return super.stop();
  }

}
