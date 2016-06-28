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
    export class DualOscillator extends Instrument implements ISoundControl
    {
		private oscillatorA:OscillatorNode;
		private oscillatorB:OscillatorNode;

		public drift:number = 7;

		// create
		constructor( audioContext:AudioContext, outputTo:AudioNode, type:string=OscillatorTypes.SINE )
		{
			super( audioContext );
			this.create( type );
            this.connect( outputTo );
		}

		private create( type:string ):void
		{
			// Synthesize!
			this.oscillatorA = this.context.createOscillator();
			this.oscillatorA.type = type;
            this.oscillatorA.frequency.value = 440;

			this.oscillatorB = this.context.createOscillator();
			this.oscillatorB.type = type;
            this.oscillatorB.frequency.value = 440;

            this.envelope.attackTime = 0.5;
            this.envelope.decayTime = 0.2;
            this.envelope.sustainVolume = 0.9;
            this.envelope.holdTime = -1;
            this.envelope.hold = true;
            this.envelope.releaseTime = 0.7;

            this.oscillatorA.connect( this.gain );
            this.oscillatorB.connect( this.gain );
		}

		public start( frequency:number=-1 ):boolean
		{
			//
            if ( frequency > -1 )
            {
                this.oscillatorA.frequency.value = frequency;
                this.oscillatorB.frequency.value = frequency;
            }else{

            }

            // if this is initialising... we need to begin the oscillator!
            if  ( super.start() )
            {
                // this.context.currentTime
                this.oscillatorA.start( 0 );
                this.oscillatorB.start( this.drift );
                return true;
            }else{
                //this.oscillator.
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
            var time:number = this.context.currentTime + 0.005;
            //this.oscillator.frequency.cancelScheduledValues();
            this.oscillatorA.frequency.value = frequency;
            this.oscillatorB.frequency.value = frequency;
            //this.oscillator.frequency.setValueAtTime(frequency, time);
			//this.oscillator.frequency.linearRampToValueAtTime( frequency, time );
            return this.isPlaying;
        }

	}
}