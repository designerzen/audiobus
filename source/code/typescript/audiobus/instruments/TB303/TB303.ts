/*
License

First of all, if you use this software and make a hit song, buy me some coffee!

Copyright (C) 2014 Emil Loer

This program is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software Foundation,
either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program.
If not, see http://www.gnu.org/licenses/.
*/

import TB303Config from './TB303Config';
import TB303WaveTable from './TB303WaveTable';
import Scales from '../../scales/Scales';
import AudioComponent from '../../AudioComponent';
import Instrument from '../Instrument';
import {
	tau, sinh,
	coeff_integrator, coeff_highpass, coeff_allpass, coeff_biquad_lowpass12db, coeff_biquad_notch
} from '../../maths/AcceleratedMaths';

// to prevent floating points going into mega decimal place mode that frags memory
// we add a tiny little number to all outputs...
// rounding performance improver
const anti_denormal: number = 1.0e-20;
const bufferSize = 4096;

// 303 class
export default class TB303 extends Instrument
{
  protected running = true;
  protected justPlayed = false;

  // sound settings
  protected tuningValue = 0; // semitones
  protected waveform = 0; // 0 for saw, 1 for square
  protected cutOffValue = 240; // Hz
  protected resonanceValue = 1; // 0..1
  protected envmod = 0; // 0..1
  protected decayValue = 1; // ms
  protected thresholdValue = 100;
  protected accentValue = 0; // 0..1
  protected dist_shape = 0; // 0..1
  protected dist_threshold = 1; // 0.1..1
  protected delay_feedback = 0;	// 0-1 : 0.5
  protected delay_send = 0;
  protected delay_length = 20000;	// 20000

  // filter states
  protected onepole:Array<Array<number>> = []; // [x1,y1,b0,b1,a1] nested in [highpass1,feedbackhighpass,allpass,highpass2]
  protected biquad:Array<Array<number>> = []; // [x1,x2,y1,y2,b0,b1,b2,a1,a2] nested in [declicker,notch]
  protected tbfilter = [0,0,0,0,0]; // [y0,y1,y2,y3,y4]
  protected resonance_skewed=0;
  protected tbf_b0=0;/*tbf_a1=0,tbf_y0=0,tbf_y1=0,tbf_y2=0,tbf_y3=0,tbf_y4=0,*/
  protected tbf_k=0;
  protected tbf_g=1.0;

  // synth state
  protected samplepos=1000000;
  protected pos=-1;
  protected slidestep=0;
  protected table=0;
  protected oscpos=0;
  protected oscdelta=0;
  protected ampenv=0;
  protected filterenv=0;
  protected slide=0;
  protected filtermult=0;
  protected ampmult = 0;
  protected accentgain = 0;
  protected envscaler = 0;
  protected envoffset = 0;
  protected dist_gain = 1/this.dist_threshold;
  protected delaybuffer:Float32Array;
  protected delaypos = 0;
  protected sampleRate:number;
  protected wavetable:Float32Array;				// cache the waves!

// min: 0, max: 1
	public set accent ( value:number )
  {
		this.accentValue = value;
	}
	public get accent ():number
  {
		return this.accentValue;
	}
	public set shape ( value:number )
  {
		this.dist_shape = value;
	}
	public get shape ():number
  {
		return this.dist_shape;
	}
// min: -12, max: 12
	public set tuning ( value:number )
  {
		this.tuningValue = value;
	}
	public get tuning ():number
  {
		return this.tuningValue;
	}

	// increase it to add pizazz
	// min 200,	max: 20000
	public set cutOff ( value:number )
  {
		this.cutOffValue = value;
		this.envelopeModulation = this.envmod;
	}
	public get cutOff ():number
  {
		return this.cutOffValue;
	}

	// min: 0.0, max: 1.0
	// only really affects if the cutoff is high too
	public set resonance ( value:number )
  {
		this.resonanceValue = value;
		this.resonance_skewed = (1-Math.exp(-3*value))/(1-Math.exp(-3));
	}
	public get resonance ():number
  {
		return this.resonanceValue;
	}

	// high is better...
	// min: 0.0, max: 1.0,
	public set envelopeModulation ( value:number )
  {
		const c0:number = 3.138152786059267e+2;
		const c1:number = 2.394411986817546e+3;
		const c:number = Math.log(this.cutOffValue/c0)/Math.log(c1/c0);

		const slo:number = 3.773996325111173*value+0.736965594166206;
		const shi:number = 4.194548788411135*value+0.864344900642434;

		this.envmod = value;
		this.envscaler = (1.0-c)*slo+c*shi;
		this.envoffset = 0.048292930943553*c+0.294391201442418;
	};

	public get envelopeModulation():number
	{
		return this.envmod;
	}
	//
	// // min: 100, max: 2000
	// public set decay ( value :number )
  // {
	// 	// TODO: this destroys threshold value
	// 	this.decayValue = value;
	// }
	// public get decay ( ):number
  // {
	// 	return this.decayValue;
	// }

	// min: 0.0, max: 1.0
	public set threshold ( value :number )
  {
		// TODO: this destroys threshold value
		this.thresholdValue = value;
		this.dist_threshold = 1-0.9*value;
		this.dist_gain = 1/this.dist_threshold;
	}

	public get threshold():number
	{
		return this.thresholdValue;
	}

	public get hasFinished():boolean
	{
		return this.ampenv === 0;
	}

	public set config( settings:TB303Config )
	{
		this.shape = settings.shape;              // 0 -> 1
		this.resonance = settings.resonance;              // 0 -> 1
		this.accent = settings.accent;              // 0 -> 1
		this.threshold = settings.threshold;              // 0 -> 1  : softness
		this.cutOff = settings.cutOff;                // 200 -> 20000
		this.envelopeModulation = settings.envelopeModulation;    // 0 -> 1
		this.tuning = settings.tuning;                // -12 -> 12
	}

  constructor( audioContext:AudioContext, sampleRate:number=444100 )
  {
		super( audioContext );

		// set up ADSR ( this happends once...)
		this.envelope.gain = 1;
		this.envelope.attackTime = 0.02;
		this.envelope.decayTime = 0.2;
		this.envelope.holdTime = 0;
		this.envelope.hold = true;
		this.envelope.releaseTime = 0.7;
		this.envelope.sustainVolume = 0.9;
		this.sampleRate = sampleRate;

		console.error("TB303:Constructed");
		// load wavetable if it don't exist....
		TB303WaveTable.fetch().then( (wavetable:Float32Array) =>{

			console.error("TB303:Loaded",this.sampleRate);
			this.wavetable = wavetable;

			this.delaybuffer = new Float32Array(2*sampleRate);
			this.reset();
			this.begin();
		});

  }

	public begin()
	{
		const looper = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

		looper.onaudioprocess = (e) => {

			const output = e.outputBuffer.getChannelData(0);
			for (var i = 0; i < bufferSize; ++i)
			{
				output[i] = this.render();
			}

		}
		//this.input = looper;
		//looper.connect( this.outputGainNode );
		looper.connect( this.envelope.envelope );
		// this.envelope.envelope.connect( looper );
		// this.envelope.envelope.connect( looper );
		//console.log("blah",looper,this.input,looper.onaudioprocess);
		console.error("TB303:BEGUN", this);
	}

	// reset/initialize everything
	public reset () :void
  {
    const sampleRate:number = this.sampleRate;

		this.onepole = [
			coeff_highpass(44.486,sampleRate),
			coeff_highpass(150.0,sampleRate),
			coeff_allpass(14.008,sampleRate),
			coeff_highpass(24.167,sampleRate)
		];

		this.biquad = [
			coeff_biquad_lowpass12db(200.0,Math.sqrt(0.5),sampleRate),
			coeff_biquad_notch(7.5164,4.7,sampleRate)
		];

		this.tbfilter = [0,0,0,0,0]; // [y0,y1,y2,y3,y4]

		this.threshold = this.dist_threshold;
		this.resonance = this.resonanceValue;
		this.envelopeModulation = this.envmod;

		this.samplepos=1000000;
		this.pos=-1;
		this.oscpos = 0;
	}

	public start(noteNumber:number=16, length:number=1000, accent:boolean = false, slide:boolean = true, gate:boolean = false):boolean
	{
		console.log("TB303:START#"+noteNumber+" for "+length+"ms ", {accent, slide, gate} );
		this.play(noteNumber, length, accent, slide, gate );
		return this.running;
	}

	public stop( time?:number):boolean
	{
		console.log("TB303:STOP#" );
		this.ampenv = 0.0;
		return true;
	}

	public play( noteNumber:number=16, length:number=1000, accent:boolean = false, slide:boolean = true, gate:boolean = false)
	{
		if (this.running)
		{
			// Calculate target pitches from command...
			const frequency:number = Scales.frequencyFromNoteNumber(noteNumber+ this.tuningValue);
			const accentFlag:number = accent ? 1 : 0;
			const slideFlag:number = slide ? 1 : 0;
			const gateFlag:number = gate ? 0 : 1;

			this.decayValue = length

			//console.log("TB303 play freq", frequency );

			// Decay multiplier
			this.ampmult = Math.exp(-1.0/(0.001*this.decayValue*this.sampleRate));

			if (accent)
			{
				// if accent
				this.filtermult = Math.exp(-1.0/(0.001*200*this.sampleRate));
				this.accentgain = this.accentValue;
			} else {
				this.filtermult = this.ampmult;
				this.accentgain = 0.0;
			}

			// if we are gated that means we have silent output...
			this.ampenv = (1/this.ampmult) * gateFlag;

			// VCO parameters
			if (slide)
			{
				// if slide
				// TODO: set up leaky integrator for slide motion
				this.slide = (this.oscdelta-(frequency*4096 / this.sampleRate)) / 64;
				//console.log( "this.slide", this.slide, this.oscdelta, frequency, this.sampleRate );

				this.slidestep = 0;
			} else {
				this.filterenv = 1 / this.filtermult;
				this.oscpos = 0;
				this.slide = 0;
				this.slidestep = 64;
				this.oscdelta = frequency*4096 / this.sampleRate;
				//console.log( "this.oscdelta", this.oscdelta);
				this.table = this.waveform*524288+( noteNumber<<12 );
			}
			this.justPlayed = true;

		} else {
			// as we aren't playing anything, may as well output silence :)
			this.ampenv = 0.0;
		}

		// try this...
		this.samplepos=0;//this.samplepos=1000000;
	}

	// renderer
	// needs to be called 4096 times a frame so try and keep it light!
	public render ( flush:boolean=false ):number
  	{
		if (this.justPlayed)
		{
			// so we have just played a note we don;t want to overwrite the amp env...
			this.justPlayed = false;
		}else{

		}
		this.samplepos++;
		// limit this to 64...

		// Envelopes
		this.ampenv = this.ampenv * this.ampmult + anti_denormal;
		this.filterenv = this.filterenv * this.filtermult + anti_denormal;

		// VCO
		const idx:number = Math.round(this.oscpos);	// index
		const r:number = this.oscpos-idx;

				// //console.error("TB303:render",sample);
				// if ( isNaN(idx ))
				// {
				// 	const delta = this.oscdelta;
				// 	console.error("TB303:render failed",{idx, delta });
				// }

		let sample:number = ((1-r)*this.wavetable[this.table+idx]+r * this.wavetable[this.table+((idx+1)&4095)] );

		this.oscpos+=this.oscdelta;

		//should this be while'd?
		if (this.oscpos>4096)
    {
			this.oscpos -= 4096;
		}

		// Modulators
		if ((this.samplepos&63)===0)
    {
			// Portamento
			if (this.slidestep++<64)
      {
				//console.log("Portamentoing",this.oscdelta, this.slide, this.oscdelta-this.slide);
				this.oscdelta-=this.slide;
			}

			// Cutoff modulation
			const tmp1:number = this.envscaler*(this.filterenv-this.envoffset);
			const tmp2:number= this.accentgain*this.filterenv;
			const effectivecutoff:number = Math.min(this.cutOffValue*Math.pow(2,tmp1+tmp2),20000);

			// Recalculate main filter coefficients
			// TODO: optimize into lookup table!
			const wc:number = ((tau)/this.sampleRate)*effectivecutoff;
			const r:number = this.resonance_skewed;
			const fx:number = wc * 0.11253953951963826; // (1.0/sqrt(2))/(2.0*PI)
			this.tbf_b0 = (0.00045522346 + 6.1922189 * fx) / (1 + 12.358354 * fx + 4.4156345 * (fx * fx));
			const k:number = fx*(fx*(fx*(fx*(fx*(fx+7198.6997)-5837.7917)-476.47308)+614.95611)+213.87126)+16.998792;
			this.tbf_g = (((k * 0.058823529411764705)-1.0)*r+1.0)*(1.0+r);
			this.tbf_k = k*r;
		}

		// High pass filter 1
		let flt = this.onepole[0];
		flt[1] = flt[2]*sample+flt[3]*flt[0]+flt[4]*flt[1]+anti_denormal; // +plus denormalization constant
		flt[0] = sample;
		sample = flt[1];

		// Main filter + feedback high pass
		const tbf = this.tbfilter;
		const tbfb0 = this.tbf_b0; // prefetch
		let fbhp = this.tbf_k*tbf[4];

		flt = this.onepole[1];
		flt[1] = flt[2]*fbhp+flt[3]*flt[0]+flt[4]*flt[1]+anti_denormal; // +plus denormalization constant
		flt[0] = fbhp;
		fbhp = flt[1];

		tbf[0] = sample - fbhp;
		tbf[1] += 2*tbfb0*(tbf[0]-  tbf[1]+tbf[2]);
		tbf[2] +=   tbfb0*(tbf[1]-2*tbf[2]+tbf[3]);
		tbf[3] +=   tbfb0*(tbf[2]-2*tbf[3]+tbf[4]);
		tbf[4] +=   tbfb0*(tbf[3]-2*tbf[4]);
		sample = 2*this.tbf_g*tbf[4];

		// All pass filter
		flt = this.onepole[2];
		flt[1] = flt[2]*sample+flt[3]*flt[0]+flt[4]*flt[1]+anti_denormal; // +plus denormalization constant
		flt[0] = sample;
		sample = flt[1];

		// High pass filter 2
		flt = this.onepole[3];
		flt[1] = flt[2]*sample+flt[3]*flt[0]+flt[4]*flt[1]+anti_denormal; // +plus denormalization constant
		flt[0] = sample;
		sample = flt[1];

		// Notch filter
		flt = this.biquad[1];
		let biquady:number = flt[4]*sample+flt[5]*flt[0]+flt[6]*flt[1]+flt[7]*flt[2]+flt[8]*flt[3]+anti_denormal; // plus denormalization constant
		flt[1] = flt[0];
		flt[0] = sample;
		flt[3] = flt[2];
		flt[2] = biquady;
		sample = biquady;

		// Calculate output gain with declicker filter
		let outputgain:number = ((this.accentgain*4.0+1.0)*this.ampenv);
		flt = this.biquad[0];
		biquady = flt[4]*outputgain+flt[5]*flt[0]+flt[6]*flt[1]+flt[7]*flt[2]+flt[8]*flt[3]+anti_denormal; // plus denormalization constant
		flt[1] = flt[0];
		flt[0] = outputgain;
		flt[3] = flt[2];
		flt[2] = biquady;
		outputgain = biquady;

		// Apply gain
		sample *= outputgain;

		// Foldback distortion
		if (sample>this.dist_threshold||sample<-this.dist_threshold)
    {
			//sample = Math.abs(Math.abs((sample-dist_threshold)%(dist_threshold*4.0))-dist_threshold*2.0)-dist_threshold;
			const clipped:number = (sample>0?1:-1)*this.dist_threshold;
			sample = (Math.abs(Math.abs((((1-this.dist_shape)*clipped+this.dist_shape*sample)-this.dist_threshold)%(this.dist_threshold*4))-this.dist_threshold*2)-this.dist_threshold);
		}
		sample *= this.dist_gain;

		// Delay
		const prev:number = this.delaybuffer[this.delaypos];
		this.delaybuffer[this.delaypos] = this.delay_send * sample + this.delay_feedback * prev + anti_denormal;
		this.delaypos++;
		if (this.delaypos>this.delay_length)
    {
			this.delaypos=0;
		}
		sample += prev;

		return sample;
	}

}
