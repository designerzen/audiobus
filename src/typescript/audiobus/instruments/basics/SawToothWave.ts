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
    export class SawToothWave extends Oscillator implements ISoundControl
    {
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo, OscillatorTypes.SAWTOOTH );
		}
	}
}