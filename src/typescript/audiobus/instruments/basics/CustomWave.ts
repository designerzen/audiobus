/// <reference path="../../Dependencies.ts"/>
/// <reference path="../../ISoundControl.ts" />
/// <reference path="Oscillator.ts" />
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Saw Tooth Wave
==============
Abstract    -
Description -
Use         -
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus.instruments.basics
{
    export class CustomWave extends Instrument implements ISoundControl
    {
        private customShape

		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo );
            this.create();
		}

        private makeDistortionCurve(amount:number=50):Float32Array
        {
            var
                n_samples:number = 44100,
                curve:Float32Array = new Float32Array(n_samples),
                deg:number = Math.PI / 180,
                x:number;

            for ( var i=0; i < n_samples; ++i )
            {
                x = i * 2 / n_samples - 1;
                curve[i] = ( 3 + amount ) * x * 20 * deg / ( Math.PI + amount * Math.abs(x) );
            }
            return curve;
        }

		private create( ):void
		{
            this.customShape = this.context.createWaveShaper();
            this.customShape.curve = this.makeDistortionCurve(400);
            this.customShape.connect( this.gain );
		}

        public start( frequency:number=-1 ):boolean
		{
			if ( frequency > -1 ) this.customShape.frequency.value = frequency;
			if  ( super.start() )
            {
                this.customShape.start( this.context.currentTime );
                return true;
            }else{
                return false;
            }
		}

        public note( frequency:number ):boolean
        {
            this.customShape.frequency.value = frequency;
            return this.isPlaying;
        }
	}
}