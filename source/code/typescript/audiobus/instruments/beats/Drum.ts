/*//////////////////////////////////////////////////////////////////////////////

Bass Drum
==============
Abstract    - Basic Percussion Element
Description -
Use         - trigge
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
import Instrument from '../Instrument';

export default class Drum extends Instrument
{
		// create
		constructor( audioContext?:AudioContext )
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
