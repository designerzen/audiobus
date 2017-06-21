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

export class Maths
{
  public static clamp (value:number, min:number, max:number):number
  {
      if (value<min) return min;
      else if (value>max) return max;
      else return value;
  }

  public static moveTowards(current:number, target:number, amount:number):number
  {
      if (current<target) return Math.min(current+amount, target);
      else return Math.max(current-amount, target);
  }

  public static moveTowards(current:number, target:number, amountUp:number=0, amountDown:number=0):number
  {
      if (current<target) return Math.min(current+amountUp, target);
      else return Math.max(current-amountDown, target);
  }

  public static gaussian():number
  {
      var s = 0;
      for (var c=0; c<16; c++) s+=Math.random();
      return (s-8)/4;
  }
}



/**********************************************************************************/
/**********************************************************************************/

/*
 * A speed-improved perlin and simplex noise algorithms for 2D.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 * Converted to Javascript by Joseph Gentle.
 *
 * Version 2012-03-09
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 *
 */

class PerlinNoiseGradients
{
  constructor(public x:number public y:number, public z:number)
  {

  }

  dot2(x:number, y:number) :number
  {
    return this.x*x + this.y*y;
  };

  dot3(x:number, y:number, z:number) :number
  {
    return this.x*x + this.y*y + this.z*z;
  };

}

export class PerlinNoise
{
  public static hasSeeded:boolean = false;
    public static grad3:Array<PerlinNoiseGradients> = [
      new PerlinNoiseGradients(1,1,0),new PerlinNoiseGradients(-1,1,0),new PerlinNoiseGradients(1,-1,0),new PerlinNoiseGradients(-1,-1,0),
      new PerlinNoiseGradients(1,0,1),new PerlinNoiseGradients(-1,0,1),new PerlinNoiseGradients(1,0,-1),new PerlinNoiseGradients(-1,0,-1),
      new PerlinNoiseGradients(0,1,1),new PerlinNoiseGradients(0,-1,1),new PerlinNoiseGradients(0,1,-1),new PerlinNoiseGradients(0,-1,-1)
     ];

    public static p:Array<number> = [
      151,160,137,91,90,15,
      131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
      190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
      88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
      77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
      102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
      135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
      5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
      223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
      129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
      251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
      49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
      138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
    ];

    // To remove the need for index wrapping, double the permutation table length
    var perm = new Array(512);
    var gradP = new Array(512);

    // This isn't a very good seeding function, but it works ok. It supports 2^16
    // different seed values. Write something better if you need more seeds.
    // seed(Date.now());
    public static seed ( needle:number ):void
    {
      if(needle > 0 && needle < 1)
      {
        // Scale the seed out
        needle *= 65536;
      }

      needle = Math.floor(needle);

      if(needle < 256)
      {
        needle |= seed << 8;
      }

      for(let i = 0; i < 256; i++)
      {
        let v;
        if (i & 1)
        {
          v = PerlinNoise.p[i] ^ (needle & 255);
        } else {
          v = PerlinNoise.p[i] ^ ((needle>>8) & 255);
        }

        perm[i] = perm[i + 256] = v;
        gradP[i] = gradP[i + 256] = PerlinNoise.grad3[v % 12];
      }
      PerlinNoise.hasSeeded = true;
    };




    // Skewing and unskewing factors for 2, 3, and 4 dimensions
    public static F2 = 0.5*(Math.sqrt(3)-1);
    public static G2 = (3-Math.sqrt(3))/6;

    // var F3 = 1/3;
    // var G3 = 1/6;

    /*
    for(var i=0; i<256; i++) {
      perm[i] = perm[i + 256] = p[i];
      gradP[i] = gradP[i + 256] = PerlinNoise.grad3[perm[i] % 12];
    }*/


    // 2D simplex noise
    public simplex2 (xin:number, yin:number):number
    {
      let n0:number, n1:number, n2:number; // Noise contributions from the three corners
      // Skew the input space to determine which simplex cell we're in
      let s:number = (xin+yin)*PerlinNoise.F2; // Hairy factor for 2D
      let i:number = Math.floor(xin+s);
      let j:number = Math.floor(yin+s);
      let t:number = (i+j)*PerlinNoise.G2;
      let x0:number = xin-i+t; // The x,y distances from the cell origin, unskewed.
      let y0:number = yin-j+t;

      // For the 2D case, the simplex shape is an equilateral triangle.
      // Determine which simplex we are in.
      let i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords

      if(x0>y0)
      {
        // lower triangle, XY order: (0,0)->(1,0)->(1,1)
        i1=1; j1=0;
      } else {
        // upper triangle, YX order: (0,0)->(0,1)->(1,1)
        i1=0; j1=1;
      }

      // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
      // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
      // c = (3-sqrt(3))/6
      var x1:number = x0 - i1 + PerlinNoise.G2; // Offsets for middle corner in (x,y) unskewed coords
      var y1:number = y0 - j1 + PerlinNoise.G2;

      // TODO: Optimise!
      var x2:number = x0 - 1 + 2 * PerlinNoise.G2; // Offsets for last corner in (x,y) unskewed coords
      var y2:number = y0 - 1 + 2 * PerlinNoise.G2;

      // Work out the hashed gradient indices of the three simplex corners
      i &= 255;
      j &= 255;

      var gi0 = gradP[i+perm[j]];
      var gi1 = gradP[i+i1+perm[j+j1]];
      var gi2 = gradP[i+1+perm[j+1]];

      // Calculate the contribution from the three corners
      var t0:number = 0.5 - x0*x0-y0*y0;
      if(t0<0)
      {
        n0 = 0;
      } else {
        t0 *= t0;
        n0 = t0 * t0 * gi0.dot2(x0, y0);  // (x,y) of grad3 used for 2D gradient
      }

      var t1:number = 0.5 - x1*x1-y1*y1;
      if(t1<0)
      {
        n1 = 0;
      } else {
        t1 *= t1;
        n1 = t1 * t1 * gi1.dot2(x1, y1);
      }

      var t2:number = 0.5 - x2*x2-y2*y2;
      if(t2<0)
      {
        n2 = 0;
      } else {
        t2 *= t2;
        n2 = t2 * t2 * gi2.dot2(x2, y2);
      }
      // Add contributions from each corner to get the final noise value.
      // The result is scaled to return values in the interval [-1,1].
      return 70 * (n0 + n1 + n2);
    };

    public static simplex1 (x):number
    {
      return PerlinNoise.simplex2(x*1.2, -x*0.7);
    };
}

// Mouth part
export class Glottis
{

}

// Mouth part
export class Tract
{

};

export default class PinkTrombone extends Instrument
{
  blockLength = 512;
  blockTime = 1;
  started = false;
  soundOn = false;

  constructor()
  {
    super();
    sampleRate = this.audioContext.sampleRate;

    this.blockTime = this.blockLength/sampleRate;
  }
}



var sampleRate;
var time = 0;
var temp = {a:0, b:0};
var alwaysVoice = true;
var autoWobble = true;
var noiseFreq = 500;
var noiseQ = 0.7;

var AudioSystem =
{
    blockLength : 512,
    blockTime : 1,
    started : false,
    soundOn : false,

    init : function ()
    {
        window.AudioContext = window.AudioContext||window.webkitAudioContext;
        this.audioContext = new window.AudioContext();
        sampleRate = this.audioContext.sampleRate;

        this.blockTime = this.blockLength/sampleRate;
    },

    startSound : function()
    {
        //scriptProcessor may need a dummy input channel on iOS
        this.scriptProcessor = this.audioContext.createScriptProcessor(this.blockLength, 2, 1);
        this.scriptProcessor.connect(this.audioContext.destination);
        this.scriptProcessor.onaudioprocess = AudioSystem.doScriptProcessor;

        var whiteNoise = this.createWhiteNoiseNode(2*sampleRate); // 2 seconds of noise

        var aspirateFilter = this.audioContext.createBiquadFilter();
        aspirateFilter.type = "bandpass";
        aspirateFilter.frequency.value = 500;
        aspirateFilter.Q.value = 0.5;
        whiteNoise.connect(aspirateFilter);
        aspirateFilter.connect(this.scriptProcessor);

        var fricativeFilter = this.audioContext.createBiquadFilter();
        fricativeFilter.type = "bandpass";
        fricativeFilter.frequency.value = 1000;
        fricativeFilter.Q.value = 0.5;
        whiteNoise.connect(fricativeFilter);
        fricativeFilter.connect(this.scriptProcessor);

        whiteNoise.start(0);
    },

    createWhiteNoiseNode : function(frameCount)
    {
        var myArrayBuffer = this.audioContext.createBuffer(1, frameCount, sampleRate);

        var nowBuffering = myArrayBuffer.getChannelData(0);
        for (var i = 0; i < frameCount; i++)
        {
            nowBuffering[i] = Math.random();// gaussian();
        }

        var source = this.audioContext.createBufferSource();
        source.buffer = myArrayBuffer;
        source.loop = true;

        return source;
    },


    doScriptProcessor : function(event)
    {
        var inputArray1 = event.inputBuffer.getChannelData(0);
        var inputArray2 = event.inputBuffer.getChannelData(1);
        var outArray = event.outputBuffer.getChannelData(0);
        for (var j = 0, N = outArray.length; j < N; j++)
        {
            var lambda1 = j/N;
            var lambda2 = (j+0.5)/N;
            var glottalOutput = Glottis.runStep(lambda1, inputArray1[j]);

            var vocalOutput = 0;
            //Tract runs at twice the sample rate
            Tract.runStep(glottalOutput, inputArray2[j], lambda1);
            vocalOutput += Tract.lipOutput + Tract.noseOutput;
            Tract.runStep(glottalOutput, inputArray2[j], lambda2);
            vocalOutput += Tract.lipOutput + Tract.noseOutput;
            outArray[j] = vocalOutput * 0.125;
        }
        Glottis.finishBlock();
        Tract.finishBlock();
    },

    mute : function()
    {
        this.scriptProcessor.disconnect();
    },

    unmute : function()
    {
        this.scriptProcessor.connect(this.audioContext.destination);
    }

}


var Glottis =
{
    timeInWaveform : 0,
    oldFrequency : 140,
    newFrequency : 140,
    UIFrequency : 140,
    smoothFrequency : 140,
    oldTenseness : 0.6,
    newTenseness : 0.6,
    UITenseness : 0.6,
    totalTime : 0,
    vibratoAmount : 0.005,
    vibratoFrequency : 6,
    intensity : 0,
    loudness : 1,
    touch : 0,
    semitones : 20,
    marks : [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
    baseNote : 87.3071, //F

    Glottis.isTouched = (this.touch != 0);
    },

    runStep : function(lambda, noiseSource)
    {
        var timeStep = 1.0 / sampleRate;
        this.timeInWaveform += timeStep;
        this.totalTime += timeStep;
        if (this.timeInWaveform>this.waveformLength)
        {
            this.timeInWaveform -= this.waveformLength;
            this.setupWaveform(lambda);
        }
        var out = this.normalizedLFWaveform(this.timeInWaveform/this.waveformLength);
        var aspiration = this.intensity*(1-Math.sqrt(this.UITenseness))*this.getNoiseModulator()*noiseSource;
        aspiration *= 0.2 + 0.02 * PerlinNoise.simplex1(this.totalTime * 1.99);
        out += aspiration;
        return out;
    },

    getNoiseModulator : function()
    {
        var voiced = 0.1+0.2*Math.max(0,Math.sin(Math.PI*2*this.timeInWaveform/this.waveformLength));
        //return 0.3;
        return this.UITenseness* this.intensity * voiced + (1-this.UITenseness* this.intensity ) * 0.3;
    },

    finishBlock : function()
    {
        var vibrato = 0;
        vibrato += this.vibratoAmount * Math.sin(2*Math.PI * this.totalTime *this.vibratoFrequency);
        vibrato += 0.02 * PerlinNoise.simplex1(this.totalTime * 4.07);
        vibrato += 0.04 * PerlinNoise.simplex1(this.totalTime * 2.15);
        if (autoWobble)
        {
            vibrato += 0.2 * PerlinNoise.simplex1(this.totalTime * 0.98);
            vibrato += 0.4 * PerlinNoise.simplex1(this.totalTime * 0.5);
        }
        if (this.UIFrequency>this.smoothFrequency)
            this.smoothFrequency = Math.min(this.smoothFrequency * 1.1, this.UIFrequency);
        if (this.UIFrequency<this.smoothFrequency)
            this.smoothFrequency = Math.max(this.smoothFrequency / 1.1, this.UIFrequency);
        this.oldFrequency = this.newFrequency;
        this.newFrequency = this.smoothFrequency * (1+vibrato);
        this.oldTenseness = this.newTenseness;
        this.newTenseness = this.UITenseness
            + 0.1*PerlinNoise.simplex1(this.totalTime*0.46)+0.05*PerlinNoise.simplex1(this.totalTime*0.36);
        if (!this.isTouched && alwaysVoice) this.newTenseness += (3-this.UITenseness)*(1-this.intensity);

        if (this.isTouched || alwaysVoice) this.intensity += 0.13;
        else this.intensity -= 0.05;
        this.intensity = Maths.clamp(this.intensity, 0, 1);
    },

    setupWaveform : function(lambda)
    {
        this.frequency = this.oldFrequency*(1-lambda) + this.newFrequency*lambda;
        var tenseness = this.oldTenseness*(1-lambda) + this.newTenseness*lambda;
        this.Rd = 3*(1-tenseness);
        this.waveformLength = 1.0/this.frequency;

        var Rd = this.Rd;
        if (Rd<0.5) Rd = 0.5;
        if (Rd>2.7) Rd = 2.7;
        var output;
        // normalized to time = 1, Ee = 1
        var Ra = -0.01 + 0.048*Rd;
        var Rk = 0.224 + 0.118*Rd;
        var Rg = (Rk/4)*(0.5+1.2*Rk)/(0.11*Rd-Ra*(0.5+1.2*Rk));

        var Ta = Ra;
        var Tp = 1 / (2*Rg);
        var Te = Tp + Tp*Rk; //

        var epsilon = 1/Ta;
        var shift = Math.exp(-epsilon * (1-Te));
        var Delta = 1 - shift; //divide by this to scale RHS

        var RHSIntegral = (1/epsilon)*(shift - 1) + (1-Te)*shift;
        RHSIntegral = RHSIntegral/Delta;

        var totalLowerIntegral = - (Te-Tp)/2 + RHSIntegral;
        var totalUpperIntegral = -totalLowerIntegral;

        var omega = Math.PI/Tp;
        var s = Math.sin(omega*Te);
        // need E0*e^(alpha*Te)*s = -1 (to meet the return at -1)
        // and E0*e^(alpha*Tp/2) * Tp*2/pi = totalUpperIntegral
        //             (our approximation of the integral up to Tp)
        // writing x for e^alpha,
        // have E0*x^Te*s = -1 and E0 * x^(Tp/2) * Tp*2/pi = totalUpperIntegral
        // dividing the second by the first,
        // letting y = x^(Tp/2 - Te),
        // y * Tp*2 / (pi*s) = -totalUpperIntegral;
        var y = -Math.PI*s*totalUpperIntegral / (Tp*2);
        var z = Math.log(y);
        var alpha = z/(Tp/2 - Te);
        var E0 = -1 / (s*Math.exp(alpha*Te));
        this.alpha = alpha;
        this.E0 = E0;
        this.epsilon = epsilon;
        this.shift = shift;
        this.Delta = Delta;
        this.Te=Te;
        this.omega = omega;
    },


    normalizedLFWaveform: function(t)
    {
        if (t>this.Te) output = (-Math.exp(-this.epsilon * (t-this.Te)) + this.shift)/this.Delta;
        else output = this.E0 * Math.exp(this.alpha*t) * Math.sin(this.omega * t);

        return output * this.intensity * this.loudness;
    }
}


var Tract =
{
    n : 44,
    bladeStart : 10,
    tipStart : 32,
    lipStart : 39,
    R : [], //component going right
    L : [], //component going left
    reflection : [],
    junctionOutputR : [],
    junctionOutputL : [],
    maxAmplitude : [],
    diameter : [],
    restDiameter : [],
    targetDiameter : [],
    newDiameter : [],
    A : [],
    glottalReflection : 0.75,
    lipReflection : -0.85,
    lastObstruction : -1,
    fade : 1.0, //0.9999,
    movementSpeed : 15, //cm per second
    transients : [],
    lipOutput : 0,
    noseOutput : 0,
    velumTarget : 0.01,

    init : function()
    {
        this.bladeStart = Math.floor(this.bladeStart*this.n/44);
        this.tipStart = Math.floor(this.tipStart*this.n/44);
        this.lipStart = Math.floor(this.lipStart*this.n/44);
        this.diameter = new Float64Array(this.n);
        this.restDiameter = new Float64Array(this.n);
        this.targetDiameter = new Float64Array(this.n);
        this.newDiameter = new Float64Array(this.n);
        for (var i=0; i<this.n; i++)
        {
            var diameter = 0;
            if (i<7*this.n/44-0.5) diameter = 0.6;
            else if (i<12*this.n/44) diameter = 1.1;
            else diameter = 1.5;
            this.diameter[i] = this.restDiameter[i] = this.targetDiameter[i] = this.newDiameter[i] = diameter;
        }
        this.R = new Float64Array(this.n);
        this.L = new Float64Array(this.n);
        this.reflection = new Float64Array(this.n+1);
        this.newReflection = new Float64Array(this.n+1);
        this.junctionOutputR = new Float64Array(this.n+1);
        this.junctionOutputL = new Float64Array(this.n+1);
        this.A =new Float64Array(this.n);
        this.maxAmplitude = new Float64Array(this.n);

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
        for (var i=0; i<this.noseLength; i++)
        {
            var diameter;
            var d = 2*(i/this.noseLength);
            if (d<1) diameter = 0.4+1.6*d;
            else diameter = 0.5+1.5*(2-d);
            diameter = Math.min(diameter, 1.9);
            this.noseDiameter[i] = diameter;
        }
        this.newReflectionLeft = this.newReflectionRight = this.newReflectionNose = 0;
        this.calculateReflections();
        this.calculateNoseReflections();
        this.noseDiameter[0] = this.velumTarget;
    },

    reshapeTract : function(deltaTime)
    {
        var amount = deltaTime * this.movementSpeed; ;
        var newLastObstruction = -1;
        for (var i=0; i<this.n; i++)
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
        this.noseDiameter[0] = Maths.moveTowards(this.noseDiameter[0], this.velumTarget,
                amount*0.25, amount*0.1);
        this.noseA[0] = this.noseDiameter[0]*this.noseDiameter[0];
    },

    calculateReflections : function()
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
        var sum = this.A[this.noseStart]+this.A[this.noseStart+1]+this.noseA[0];
        this.newReflectionLeft = (2*this.A[this.noseStart]-sum)/sum;
        this.newReflectionRight = (2*this.A[this.noseStart+1]-sum)/sum;
        this.newReflectionNose = (2*this.noseA[0]-sum)/sum;
    },

    calculateNoseReflections : function()
    {
        for (var i=0; i<this.noseLength; i++)
        {
            this.noseA[i] = this.noseDiameter[i]*this.noseDiameter[i];
        }
        for (var i=1; i<this.noseLength; i++)
        {
            this.noseReflection[i] = (this.noseA[i-1]-this.noseA[i]) / (this.noseA[i-1]+this.noseA[i]);
        }
    },

    runStep : function(glottalOutput, turbulenceNoise, lambda)
    {
        var updateAmplitudes = (Math.random()<0.1);

        //mouth
        this.processTransients();
        this.addTurbulenceNoise(turbulenceNoise);

        //this.glottalReflection = -0.8 + 1.6 * Glottis.newTenseness;
        this.junctionOutputR[0] = this.L[0] * this.glottalReflection + glottalOutput;
        this.junctionOutputL[this.n] = this.R[this.n-1] * this.lipReflection;

        for (var i=1; i<this.n; i++)
        {
            var r = this.reflection[i] * (1-lambda) + this.newReflection[i]*lambda;
            var w = r * (this.R[i-1] + this.L[i]);
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

    },

    finishBlock : function()
    {
        this.reshapeTract(AudioSystem.blockTime);
        this.calculateReflections();
    },

    addTransient : function(position)
    {
        var trans = {}
        trans.position = position;
        trans.timeAlive = 0;
        trans.lifeTime = 0.2;
        trans.strength = 0.3;
        trans.exponent = 200;
        this.transients.push(trans);
    },

    processTransients : function()
    {
      const trans;
        for (let i = 0; i < this.transients.length; i++)
        {
            trans = this.transients[i];
            const amplitude = trans.strength * Math.pow(2, -trans.exponent * trans.timeAlive);
            this.R[trans.position] += amplitude/2;
            this.L[trans.position] += amplitude/2;
            trans.timeAlive += 1.0/(sampleRate*2);
        }
        for (let i=this.transients.length-1; i>=0; i--)
        {
            trans = this.transients[i];
            if (trans.timeAlive > trans.lifeTime)
            {
                this.transients.splice(i,1);
            }
        }
    },

    addTurbulenceNoise : function(turbulenceNoise)
    {
        for (var j=0; j<UI.touchesWithMouse.length; j++)
        {
            var touch = UI.touchesWithMouse[j];
            if (touch.index<2 || touch.index>Tract.n) continue;
            if (touch.diameter<=0) continue;
            var intensity = touch.fricative_intensity;
            if (intensity == 0) continue;
            this.addTurbulenceNoiseAtIndex(0.66*turbulenceNoise*intensity, touch.index, touch.diameter);
        }
    },

    addTurbulenceNoiseAtIndex : function(turbulenceNoise, index, diameter)
    {
        var i = Math.floor(index);
        var delta = index - i;
        turbulenceNoise *= Glottis.getNoiseModulator();
        var thinness0 = Maths.clamp(8*(0.7-diameter),0,1);
        var openness = Maths.clamp(30*(diameter-0.3), 0, 1);
        var noise0 = turbulenceNoise*(1-delta)*thinness0*openness;
        var noise1 = turbulenceNoise*delta*thinness0*openness;
        this.R[i+1] += noise0/2;
        this.L[i+1] += noise0/2;
        this.R[i+2] += noise1/2;
        this.L[i+2] += noise1/2;
    }
};

AudioSystem.init();
Glottis.init();
Tract.init();
