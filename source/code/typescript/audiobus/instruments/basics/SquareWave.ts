/// <reference path="../../Dependencies.ts"/>
/// <reference path="../../ISoundControl.ts" />
/// <reference path="Oscillator.ts" />
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Square Wave
==============
Abstract    -
Description -
Use         -
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus.instruments.basics
{
    export class SquareWave extends Oscillator implements ISoundControl
    {
		constructor( audioContext:AudioContext, outputTo:AudioNode )
		{
			super( audioContext, outputTo, OscillatorTypes.SQUARE );
		}
	}
}