/// <reference path="../../Dependencies.ts"/>
/// <reference path="../Instrument.ts" />
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Bass Drum
==============
Abstract    - Basic Percussion Element
Description -
Use         - trigge
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus.instruments.beats
{
    export class Drum extends Instrument
    {
		// create
		constructor( audioContext:AudioContext )
		{
			super( audioContext );

            this.envelope.attackTime = 0.01;
            this.envelope.decayTime = 0.1;
            this.envelope.holdTime = 0;
            this.envelope.hold = false;
            this.envelope.releaseTime = 0.7;
            this.envelope.sustainVolume = 0.95;
		}
	}
}