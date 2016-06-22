/// <reference path="../../Dependencies.ts"/>
/// <reference path="../../ISoundControl.ts" />
/// <reference path="Oscillator.ts" />
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Sine Wave
==============
Abstract    -
Description -
Use         -
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus.instruments.basics
{
    export class SineWave extends Oscillator implements ISoundControl
    {
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo, OscillatorTypes.SINE );
		}
	}
}