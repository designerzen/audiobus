/// <reference path="Dependencies.ts" />
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Scales
==============
Abstract    - All of the frequencies from the main scales
Description - You can use this class to create harmonius sounding frequencies
Use         - Select from the scales and types
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus
{
	export class Scales
    {
		constructor(  )
        {

        }
		public static frequencyFromNote(note:number):number
		{
			return 440 * Math.pow(2, (note - 69) / 12);
		}
    }
}