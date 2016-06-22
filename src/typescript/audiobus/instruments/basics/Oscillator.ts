/// <reference path="../../Dependencies.ts"/>
/// <reference path="../../ISoundControl.ts" />
/// <reference path="../Instrument.ts" />
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Oscillator
==============
Abstract    - The base for audio generation, an oscillating wave
Description -
Use         - Set the type and use raw or layer multiple waves together
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus.instruments.basics
{
    export class Oscillator extends Instrument implements ISoundControl
    {
		public osc:OscillatorNode;

		// create
		constructor( audioContext:AudioContext, outputTo:GainNode, type:string=OscillatorTypes.SINE )
		{
			super( audioContext, outputTo );
			this.create( type );
		}

		private create( type:string=OscillatorTypes.SINE ):void
		{
			// Synthesize!
			this.osc = this.context.createOscillator();
			this.osc.type = type; // sine wave
			this.osc.connect( this.gain );
            this.osc.frequency.value = 440;
		}

		public start( frequency:number=-1 ):boolean
		{
			//console.log("Sine commencing at f:"+frequency );
            if ( frequency > -1 ) this.osc.frequency.value = frequency;

            // if this is initialising... we need to begin the oscillator!
            if  ( super.start() )
            {
                this.osc.start( this.context.currentTime );
                return true;
            }else{
                return false;
            }
		}

        public stop():boolean
        {
            //this.osc.stop();
            return super.stop();
        }

        public note( frequency:number ):boolean
        {
            this.osc.frequency.value = frequency;
            //this.osc.frequency.setValueAtTime(1200, t);
			//this.osc.frequency.linearRampToValueAtTime(800, t + 0.005);

            return this.isPlaying;
        }

	}
}