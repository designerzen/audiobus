/*//////////////////////////////////////////////////////////////////////////////

Scales
==============
Abstract    - All of the frequencies from the main scales
Description - You can use this class to create harmonius sounding frequencies
Use         - Select from the scales and types
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
export default class Scales
{
	public static NOTES = [
	  "C",
	  "C#",
	  "D",
	  "D#",
	  "E",
	  "F",
	  "F#",
	  "G",
	  "G#",
	  "A",
	  "A#",
	  "B"
	];

	constructor(  )
  {
		throw Error("Scales is a static class, ie. don't call new Scales()");
  }

	public static noteFromPitch(frequency:number):number
	{
		const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
		return Math.round(noteNum) + 69;
	}

	public static frequencyFromNoteNumber(note:number):number
	{
		return 440 * Math.pow(2, (note - 69) / 12);
	}

	public static centsOffFromPitch(frequency:number, note:number):number
	{
		return Math.floor(
			1200 * Math.log(
				frequency / Scales.frequencyFromNoteNumber(note)
			) / Math.log(2)
		);
	}
	
	public static noteNameFromPitch(frequency):string
	{
		const noteNumber:number = Scales.noteFromPitch(frequency) % 12;
		return Scales.NOTES[ noteNumber ];
	}

	public static frequencyFromNote(note:number):number
	{
		return 440 * Math.pow(2, (note - 69) / 12);
	}
}
