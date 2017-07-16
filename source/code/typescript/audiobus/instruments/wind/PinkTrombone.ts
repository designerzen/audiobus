/*

https://dood.al/pinktrombone/

P I N K   T R O M B O N E

Bare-handed procedural speech synthesis

version 1.1, March 2017
by Neil Thapen
venuspatrol.nfshost.com


Bibliography

Julius O. Smith III, "Physical audio signal processing for virtual musical instruments and audio effects."
https://ccrma.stanford.edu/~jos/pasp/

Story, Brad H. "A parametric model of the vocal tract area function for vowel and consonant simulation."
The Journal of the Acoustical Society of America 117.5 (2005): 3231-3254.

Lu, Hui-Ling, and J. O. Smith. "Glottal source modeling for singing voice synthesis."
Proceedings of the 2000 International Computer Music Conference. 2000.

Mullen, Jack. Physical modelling of the vocal tract with the 2D digital waveguide mesh.
PhD thesis, University of York, 2006.


Copyright 2017 Neil Thapen

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.

*/
import Engine from '../../Engine';
import PerlinNoise from '../../synthesis/noise/PerlinNoise';
import WhiteNoise from '../../synthesis/noise/WhiteNoise';
import GaussianNoise from '../../synthesis/noise/GaussianNoise';
import Instrument from '../../instruments/Instrument';

export class Maths
{
  public static clamp (value:number, min:number, max:number):number
  {
      if (value<min) return min;
      else if (value>max) return max;
      else return value;
  }

  public static moveTowards(current:number, target:number, amountUp:number=0, amountDown:number=0):number
  {
      if (current<target) return Math.min(current+amountUp, target);
      else return Math.max(current-amountDown, target);
  }

  public static gaussian():number
  {
    let s:number = 0;
    for (let c=0; c<16; ++c) s+=Math.random();
    return (s-8)/4;
  }
}

// Mouth parts wrapped in a trombone
export default class PinkTrombone extends Instrument
{
  private sampleRate:number;
  private blockLength:number = 512;
  private blockTime:number = 1;
  private started:boolean = false;
  private soundOn:boolean = false;
  private scriptProcessor;//:AudioScriptProcessor;

  private glottis:Glottis;
  private tract:Tract;

  constructor( audioContext?:AudioContext)
  {
    super(audioContext);

    this.sampleRate = audioContext.sampleRate;
    this.blockTime = this.blockLength / this.sampleRate;

    // create our audio components...
    this.initialise();


  }

  protected initialise()
  {
    const whiteNoise:AudioBuffer = GaussianNoise.gaussian(2,this.sampleRate); // 2 seconds of noise
    const source = this.audioContext.createBufferSource();
    source.buffer = whiteNoise;
    source.loop = true;

    this.begin();
    const aspirateFilter = this.audioContext.createBiquadFilter();
    aspirateFilter.type = "bandpass";
    aspirateFilter.frequency.value = 500;
    aspirateFilter.Q.value = 0.5;

    source.connect(aspirateFilter);
    aspirateFilter.connect(this.scriptProcessor);

    const fricativeFilter = this.audioContext.createBiquadFilter();
    fricativeFilter.type = "bandpass";
    fricativeFilter.frequency.value = 1000;
    fricativeFilter.Q.value = 0.5;

    source.connect(fricativeFilter);
    fricativeFilter.connect(this.scriptProcessor);

    // mouth parts...
    this.glottis = new Glottis(this.sampleRate);
    //this.glottis.initialise();

    this.tract = new Tract(this.sampleRate,this.blockTime,this.glottis);
    //this.tract.initialise();

    source.start(0);
  }

	public begin()
	{
		const bufferSize:number = 4096;
    // NB. scriptProcessor may need a dummy input channel on iOS
		const looper = this.audioContext.createScriptProcessor(this.blockLength, 2, 1);
		looper.onaudioprocess = (event:any) => this.render(event);

		//this.input = looper;
		//looper.connect( this.outputGainNode );
		looper.connect( this.envelope.envelope );
    this.scriptProcessor = looper;
		// this.envelope.envelope.connect( looper );
		// this.envelope.envelope.connect( looper );
		//console.log("blah",looper,this.input,looper.onaudioprocess);
		console.error("PinkTrombone:BEGUN", this);
    this.started = true;
	}
  //
  // public mute()
  // {
  //   this.scriptProcessor.disconnect();
  // }
  //
  // public unmute()
  // {
  //   this.scriptProcessor.connect(this.audioContext.destination);
  // }

  // this is where our sound is actually generated...
  public render(event:any):void
  {
    const inputArray1:Float32Array = event.inputBuffer.getChannelData(0);
    const inputArray2:Float32Array = event.inputBuffer.getChannelData(1);
    const outArray:Float32Array = event.outputBuffer.getChannelData(0);
    const length:number = outArray.length;

    for (let j = 0; j < length; ++j)
    {
      const lambda1:number = j/length;
      const lambda2:number = (j+0.5)/length;
      const glottalOutput = this.glottis.runStep(lambda1, inputArray1[j]);

      let vocalOutput:number = 0;

      //Tract runs at twice the sample rate
      this.tract.runStep(glottalOutput, inputArray2[j], lambda1);

      vocalOutput += this.tract.lipOutput + this.tract.noseOutput;

      this.tract.runStep(glottalOutput, inputArray2[j], lambda2);

      vocalOutput += this.tract.lipOutput + this.tract.noseOutput;

      outArray[j] = vocalOutput * 0.125;
    }

    // now control the other bits of the mouth
    this.glottis.finishBlock();
    this.tract.finishBlock();
  }
}


// var time = 0;
// var temp = {a:0, b:0};
// var noiseFreq = 500;
// var noiseQ = 0.7;

// Glottis part of the mouth...
// has a few public methods to process a buffer
// and a few ways to interface with the sound :)
export class Glottis
{
  public autoWobble:boolean = true;
  public alwaysVoice:boolean = true;

  private timeInWaveform:number = 0;
  private frequency:number;                 // added by zen
  private oldFrequency:number = 140;
  private newFrequency:number = 140;
  private UIFrequency:number = 140;         // stuff to control
  private smoothFrequency:number = 140;
  private oldTenseness:number = 0.6;
  private newTenseness:number = 0.6;
  private UITenseness:number = 0.6;
  private totalTime:number = 0;
  private vibratoAmount:number = 0.005;
  private vibratoFrequency:number = 6;
  private intensity:number = 0;
  private loudness:number = 1;
  private touch:number = 0;
  private semitones:number = 20;
  private marks:Array<number> = [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0];
  private baseNote:number = 87.3071; //F

  // FIXME:
  waveformLength:number;
  alpha:number;
  E0:number;
  epsilon:number;
  shift:number;
  Delta:number;
  Te:number;
  omega:number;
  Rd:number;

  public get isTouched ():boolean
  {
    return (this.touch != 0);
  }

  constructor( private sampleRate:number )
  {

  }

  // create bits...
  public initialise()
  {

  }

  public runStep(lambda:number, noiseSource:number):number
  {
    const timeStep:number = 1 / this.sampleRate;

    this.timeInWaveform += timeStep;
    this.totalTime += timeStep;

    if (this.timeInWaveform > this.waveformLength)
    {
      this.timeInWaveform -= this.waveformLength;
      this.setupWaveform(lambda);
    }
    let out:number = this.normalizedLFWaveform(this.timeInWaveform/this.waveformLength);
    let aspiration:number = this.intensity*(1-Math.sqrt(this.UITenseness))*this.getNoiseModulator()*noiseSource;
    aspiration *= 0.2 + 0.02 * PerlinNoise.simplex1(this.totalTime * 1.99);
    out += aspiration;
    return out;
  }

  public getNoiseModulator()
  {
    const voiced:number = 0.1+0.2*Math.max(0,Math.sin(Math.PI*2*this.timeInWaveform/this.waveformLength));
    //return 0.3;
    return this.UITenseness* this.intensity * voiced + (1-this.UITenseness* this.intensity ) * 0.3;
  }

  // end the process
  public finishBlock():void
  {
    let vibrato:number = 0;
    vibrato += this.vibratoAmount * Math.sin(2*Math.PI * this.totalTime *this.vibratoFrequency);
    vibrato += 0.02 * PerlinNoise.simplex1(this.totalTime * 4.07);
    vibrato += 0.04 * PerlinNoise.simplex1(this.totalTime * 2.15);

    if (this.autoWobble)
    {
      vibrato += 0.2 * PerlinNoise.simplex1(this.totalTime * 0.98);
      vibrato += 0.4 * PerlinNoise.simplex1(this.totalTime * 0.5);
    }

    if (this.UIFrequency>this.smoothFrequency)
    {
      this.smoothFrequency = Math.min(this.smoothFrequency * 1.1, this.UIFrequency);
    }

    if (this.UIFrequency<this.smoothFrequency)
    {
      this.smoothFrequency = Math.max(this.smoothFrequency / 1.1, this.UIFrequency);
    }
    this.oldFrequency = this.newFrequency;
    this.newFrequency = this.smoothFrequency * (1+vibrato);
    this.oldTenseness = this.newTenseness;
    this.newTenseness = this.UITenseness + 0.1*PerlinNoise.simplex1(this.totalTime*0.46) +0.05 * PerlinNoise.simplex1(this.totalTime*0.36);

    if (!this.isTouched && this.alwaysVoice)
    {
      this.newTenseness += (3-this.UITenseness)*(1-this.intensity);
    }

    if (this.isTouched || this.alwaysVoice)
    {
      this.intensity += 0.13;
    } else {
      this.intensity -= 0.05;
    }
    this.intensity = Maths.clamp(this.intensity, 0, 1);
  }

  public setupWaveform(lambda:number):void
  {
    const tenseness:number = this.oldTenseness*(1-lambda) + this.newTenseness*lambda;
    this.frequency = this.oldFrequency*(1-lambda) + this.newFrequency*lambda;

    this.Rd = 3*(1-tenseness);
    this.waveformLength = 1.0/this.frequency;

    let Rd:number = this.Rd;
    if (Rd<0.5)
    {
      Rd = 0.5;
    }
    if (Rd>2.7)
    {
      Rd = 2.7;
    }

    // normalized to time = 1, Ee = 1
    const Ra = -0.01 + 0.048*Rd;
    const Rk = 0.224 + 0.118*Rd;
    const Rg = (Rk/4)*(0.5+1.2*Rk)/(0.11*Rd-Ra*(0.5+1.2*Rk));

    const Ta = Ra;
    const Tp = 1 / (2*Rg);
    const Te = Tp + Tp*Rk; //

    const epsilon = 1/Ta;
    const shift = Math.exp(-epsilon * (1-Te));
    const Delta = 1 - shift; //divide by this to scale RHS

    let RHSIntegral = (1/epsilon)*(shift - 1) + (1-Te)*shift;
    RHSIntegral = RHSIntegral/Delta;

    const totalLowerIntegral = - (Te-Tp)/2 + RHSIntegral;
    const totalUpperIntegral = -totalLowerIntegral;

    const omega:number = Math.PI/Tp;
    const s = Math.sin(omega*Te);
    // need E0*e^(alpha*Te)*s = -1 (to meet the return at -1)
    // and E0*e^(alpha*Tp/2) * Tp*2/pi = totalUpperIntegral
    //             (our approximation of the integral up to Tp)
    // writing x for e^alpha,
    // have E0*x^Te*s = -1 and E0 * x^(Tp/2) * Tp*2/pi = totalUpperIntegral
    // dividing the second by the first,
    // letting y = x^(Tp/2 - Te),
    // y * Tp*2 / (pi*s) = -totalUpperIntegral;
    const y = -Math.PI*s*totalUpperIntegral / (Tp*2);
    const z = Math.log(y);
    const alpha = z/(Tp/2 - Te);
    const E0 = -1 / (s*Math.exp(alpha*Te));

    // now cache these for rendering later
    this.alpha = alpha;
    this.E0 = E0;
    this.epsilon = epsilon;
    this.shift = shift;
    this.Delta = Delta;
    this.Te=Te;
    this.omega = omega;
  }

  private normalizedLFWaveform(t:number):number
  {
    let output:number;
    if (t>this.Te)
    {
      output = (-Math.exp(-this.epsilon * (t-this.Te)) + this.shift)/this.Delta;
    }else {
      output = this.E0 * Math.exp(this.alpha*t) * Math.sin(this.omega * t);
    }
    return output * this.intensity * this.loudness;
  }
}



export class Tract
{
  private n = 44;
  private bladeStart = 10;
  private tipStart = 32;
  private lipStart = 39;
  private R:Float64Array; //component going right
  private L:Float64Array; //component going left
  private reflection:Float64Array;
  private newReflection:Float64Array; // added by zen
  private junctionOutputR:Float64Array;
  private junctionOutputL:Float64Array;
  private maxAmplitude:Float64Array;
  private diameter:Float64Array;
  private restDiameter:Float64Array;
  private targetDiameter:Float64Array;
  private newDiameter:Float64Array;
  private A:Float64Array;
  private glottalReflection = 0.75;
  private lipReflection = -0.85;
  private lastObstruction = -1;
  private fade = 1.0; //0.9999;
  private movementSpeed = 15; //cm per second
  private transients:Array<ITransient> = [];
  public lipOutput = 0;
  public noseOutput = 0;
  private velumTarget = 0.01;

  // FIXME:
  noseLength:number;
  noseStart:number;
  noseR:Float64Array;
  noseL:Float64Array;
  noseJunctionOutputR:Float64Array;
  noseJunctionOutputL:Float64Array;
  noseReflection:Float64Array;
  noseDiameter:Float64Array;
  noseA:Float64Array;
  noseMaxAmplitude:Float64Array;

  newReflectionLeft:number;
  newReflectionRight:number;
  newReflectionNose:number;

  reflectionLeft:number;
  reflectionRight:number;
  reflectionNose:number;

  constructor( private sampleRate:number, private blockTime:number, private glottis:Glottis )
  {

  }
  // create bits
  public initialise()
  {
    this.bladeStart = Math.floor(this.bladeStart*this.n/44);
    this.tipStart = Math.floor(this.tipStart*this.n/44);
    this.lipStart = Math.floor(this.lipStart*this.n/44);

    // set up!
    this.diameter = new Float64Array(this.n);
    this.restDiameter = new Float64Array(this.n);
    this.targetDiameter = new Float64Array(this.n);
    this.newDiameter = new Float64Array(this.n);

    for (var i=0; i<this.n; ++i)
    {
      var diameter = 0;
      if (i<7*this.n/44-0.5)
      {
        diameter = 0.6;
      }else if (i<12*this.n/44){
         diameter = 1.1;
      } else {
        diameter = 1.5;
      }
      this.diameter[i] = this.restDiameter[i] = this.targetDiameter[i] = this.newDiameter[i] = diameter;
    }

    this.R = new Float64Array(this.n);
    this.L = new Float64Array(this.n);
    this.reflection = new Float64Array(this.n+1);
    this.newReflection = new Float64Array(this.n+1);
    this.junctionOutputR = new Float64Array(this.n+1);
    this.junctionOutputL = new Float64Array(this.n+1);
    this.A = new Float64Array(this.n);
    this.maxAmplitude = new Float64Array(this.n);

    // nose part
    this.noseLength = Math.floor(28*this.n/44)
    this.noseStart = this.n-this.noseLength + 1;
    this.noseR = new Float64Array(this.noseLength);
    this.noseL = new Float64Array(this.noseLength);
    this.noseJunctionOutputR = new Float64Array(this.noseLength+1);
    this.noseJunctionOutputL = new Float64Array(this.noseLength+1);
    this.noseReflection = new Float64Array(this.noseLength+1);
    this.noseDiameter = new Float64Array(this.noseLength);
    this.noseA = new Float64Array(this.noseLength);
    this.noseMaxAmplitude = new Float64Array(this.noseLength);

    for (var i=0; i<this.noseLength; ++i)
    {
      let diameter:number;
      var d = 2*(i/this.noseLength);

      if (d<1)
      {
        diameter = 0.4+1.6*d;
      } else {
        diameter = 0.5+1.5*(2-d);
      }
      diameter = Math.min(diameter, 1.9);
      this.noseDiameter[i] = diameter;
    }

    this.newReflectionLeft = this.newReflectionRight = this.newReflectionNose = 0;
    this.calculateReflections();
    this.calculateNoseReflections();
    this.noseDiameter[0] = this.velumTarget;
  }

  // modify the shape of the wind
  public reshapeTract(deltaTime:number)
  {
    var amount = deltaTime * this.movementSpeed; ;
    var newLastObstruction = -1;

    for (let i=0; i<this.n; ++i)
    {
      var diameter = this.diameter[i];
      var targetDiameter = this.targetDiameter[i];
      if (diameter <= 0) newLastObstruction = i;
      var slowReturn;
      if (i<this.noseStart) slowReturn = 0.6;
      else if (i >= this.tipStart) slowReturn = 1.0;
      else slowReturn = 0.6+0.4*(i-this.noseStart)/(this.tipStart-this.noseStart);
      this.diameter[i] = Maths.moveTowards(diameter, targetDiameter, slowReturn*amount, 2*amount);
    }

    if (this.lastObstruction>-1 && newLastObstruction == -1 && this.noseA[0]<0.05)
    {
        this.addTransient(this.lastObstruction);
    }
    this.lastObstruction = newLastObstruction;

    amount = deltaTime * this.movementSpeed;
    this.noseDiameter[0] = Maths.moveTowards(this.noseDiameter[0], this.velumTarget, amount*0.25, amount*0.1);
    this.noseA[0] = this.noseDiameter[0]*this.noseDiameter[0];
  }

  public calculateReflections()
  {
    for (var i=0; i<this.n; i++)
    {
      this.A[i] = this.diameter[i]*this.diameter[i]; //ignoring PI etc.
    }

    for (var i=1; i<this.n; i++)
    {
      this.reflection[i] = this.newReflection[i];
      if (this.A[i] == 0) this.newReflection[i] = 0.999; //to prevent some bad behaviour if 0
      else this.newReflection[i] = (this.A[i-1]-this.A[i]) / (this.A[i-1]+this.A[i]);
    }

    //now at junction with nose
    this.reflectionLeft = this.newReflectionLeft;
    this.reflectionRight = this.newReflectionRight;
    this.reflectionNose = this.newReflectionNose;

    const sum = this.A[this.noseStart]+this.A[this.noseStart+1]+this.noseA[0];
    this.newReflectionLeft = (2*this.A[this.noseStart]-sum)/sum;
    this.newReflectionRight = (2*this.A[this.noseStart+1]-sum)/sum;
    this.newReflectionNose = (2*this.noseA[0]-sum)/sum;
  }

  private calculateNoseReflections()
  {
    for (let i=0; i<this.noseLength; i++)
    {
      this.noseA[i] = this.noseDiameter[i]*this.noseDiameter[i];
    }

    for (let i=1; i<this.noseLength; i++)
    {
      this.noseReflection[i] = (this.noseA[i-1]-this.noseA[i]) / (this.noseA[i-1]+this.noseA[i]);
    }
  }

  public runStep(glottalOutput:number, turbulenceNoise:number, lambda:number)
  {
    const updateAmplitudes:boolean = (Math.random()<0.1);

    //mouth
    this.processTransients();
    this.addTurbulenceNoise(turbulenceNoise);

    //this.glottalReflection = -0.8 + 1.6 * Glottis.newTenseness;
    this.junctionOutputR[0] = this.L[0] * this.glottalReflection + glottalOutput;
    this.junctionOutputL[this.n] = this.R[this.n-1] * this.lipReflection;

    for (let i=1; i<this.n; i++)
    {
      const r = this.reflection[i] * (1-lambda) + this.newReflection[i]*lambda;
      const w = r * (this.R[i-1] + this.L[i]);
      this.junctionOutputR[i] = this.R[i-1] - w;
      this.junctionOutputL[i] = this.L[i] + w;
    }

    //now at junction with nose
    var i = this.noseStart;
    var r = this.newReflectionLeft * (1-lambda) + this.reflectionLeft*lambda;
    this.junctionOutputL[i] = r*this.R[i-1]+(1+r)*(this.noseL[0]+this.L[i]);
    r = this.newReflectionRight * (1-lambda) + this.reflectionRight*lambda;
    this.junctionOutputR[i] = r*this.L[i]+(1+r)*(this.R[i-1]+this.noseL[0]);
    r = this.newReflectionNose * (1-lambda) + this.reflectionNose*lambda;
    this.noseJunctionOutputR[0] = r*this.noseL[0]+(1+r)*(this.L[i]+this.R[i-1]);

        for (var i=0; i<this.n; i++)
        {
            this.R[i] = this.junctionOutputR[i]*0.999;
            this.L[i] = this.junctionOutputL[i+1]*0.999;

            //this.R[i] = Maths.clamp(this.junctionOutputR[i] * this.fade, -1, 1);
            //this.L[i] = Maths.clamp(this.junctionOutputL[i+1] * this.fade, -1, 1);

            if (updateAmplitudes)
            {
                var amplitude = Math.abs(this.R[i]+this.L[i]);
                if (amplitude > this.maxAmplitude[i]) this.maxAmplitude[i] = amplitude;
                else this.maxAmplitude[i] *= 0.999;
            }
        }

        this.lipOutput = this.R[this.n-1];

        //nose
        this.noseJunctionOutputL[this.noseLength] = this.noseR[this.noseLength-1] * this.lipReflection;

        for (var i=1; i<this.noseLength; i++)
        {
            var w = this.noseReflection[i] * (this.noseR[i-1] + this.noseL[i]);
            this.noseJunctionOutputR[i] = this.noseR[i-1] - w;
            this.noseJunctionOutputL[i] = this.noseL[i] + w;
        }

        for (var i=0; i<this.noseLength; i++)
        {
            this.noseR[i] = this.noseJunctionOutputR[i] * this.fade;
            this.noseL[i] = this.noseJunctionOutputL[i+1] * this.fade;

            //this.noseR[i] = Maths.clamp(this.noseJunctionOutputR[i] * this.fade, -1, 1);
            //this.noseL[i] = Maths.clamp(this.noseJunctionOutputL[i+1] * this.fade, -1, 1);

            if (updateAmplitudes)
            {
                var amplitude = Math.abs(this.noseR[i]+this.noseL[i]);
                if (amplitude > this.noseMaxAmplitude[i]) this.noseMaxAmplitude[i] = amplitude;
                else this.noseMaxAmplitude[i] *= 0.999;
            }
        }

        this.noseOutput = this.noseR[this.noseLength-1];

    }

  public finishBlock()
  {
    this.reshapeTract(this.blockTime);
    this.calculateReflections();
  }

  public addTransient(position:number)
  {
    const trans:ITransient = new Transient( position, 0, 0.2, 0.3, 200 );
    this.transients.push(trans);
  }

  //
  public processTransients()
  {
    let trans;
    for (let i = 0; i < this.transients.length; i++)
    {
        trans = this.transients[i];
        const amplitude = trans.strength * Math.pow(2, -trans.exponent * trans.timeAlive);
        this.R[trans.position] += amplitude/2;
        this.L[trans.position] += amplitude/2;
        trans.timeAlive += 1.0/(this.sampleRate*2);
    }

    for (let i=this.transients.length-1; i>=0; i--)
    {
      trans = this.transients[i];
      if (trans.timeAlive > trans.lifeTime)
      {
          this.transients.splice(i,1);
      }
    }
  }

  // do something here...
  // the touches here represent ways to alter the sound...
  // we can have up to this.n amount of modifiers
  public addTurbulenceNoise(turbulenceNoise:number)
  {
    const touchesWithMouse = [];
    for (let j=0; j<touchesWithMouse.length; j++)
    {
      const touch = touchesWithMouse[j];
      if (touch.index<2 || touch.index>this.n){ continue;}
      if (touch.diameter<=0) {continue;}
      if (touch.fricative_intensity == 0){ continue;}
      const intensity = touch.fricative_intensity;
      this.addTurbulenceNoiseAtIndex(0.66*turbulenceNoise*intensity, touch.index, touch.diameter);
    }
  }

  public addTurbulenceNoiseAtIndex(turbulenceNoise:number, index:number, diameter:number)
  {
    const i:number = Math.floor(index);
    const delta:number = index - i;
    turbulenceNoise *= this.glottis.getNoiseModulator();
    var thinness0 = Maths.clamp(8*(0.7-diameter),0,1);
    var openness = Maths.clamp(30*(diameter-0.3), 0, 1);
    var noise0 = turbulenceNoise*(1-delta)*thinness0*openness;
    var noise1 = turbulenceNoise*delta*thinness0*openness;
    this.R[i+1] += noise0/2;
    this.L[i+1] += noise0/2;
    this.R[i+2] += noise1/2;
    this.L[i+2] += noise1/2;
  }
}


interface ITransient
{
  position:number;
  timeAlive:number;
  lifeTime:number;
  strength:number;
  exponent:number;
}


export class Transient
{
  constructor(
    public position:number,
    public timeAlive:number,
    public lifeTime:number,
    public strength:number,
    public exponent:number
  ){}
}
