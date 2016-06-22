/// <reference path="../Dependencies.ts" />
/// <reference path="DrumSet.ts" />
module audiobus.instruments
{
    export class DrumMachine extends DrumSet
    {
		// shared variables
		public bpm:number = 120;
		public tempo:number;

		// starts here...
		constructor( audioContext:AudioContext = null, outputTo:GainNode = null )
		{
			super(audioContext,outputTo);
		}
	}
}