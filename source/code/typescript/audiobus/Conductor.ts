// This is an interface to the sequencer that offers helpful methods for song creation...
// You can add levels of automation here such as volume fading and effects :)

//import Sequencer from './timing/Sequencer';
import AudioComponent from './AudioComponent';
import Instrument from './instruments/Instrument';

export default class Conductor extends AudioComponent
{
	//private sequences:Array<Sequencer>;

  constructor( audioContext?:AudioContext )
	{
		super( audioContext );
	}
	//
	// public addSequence( sequencer:Sequencer ):Conductor
	// {
	// 	// for chaininability...
	// 	return this;
	// }
	// public addSequences( sequences:Array<Sequencer> ):Conductor
	// {
	// 	// for chaininability...
	// 	return this;
	// }


	public static instruments:Array<Instrument> = [];
	// cache...
	public static addInstrument( instrument:Instrument )
	{
		Conductor.instruments.push( instrument );
	}
	public static update()
	{
		//const t:number = this.audioContext.currentTime;
		// loop through all instruments and update them...
		Conductor.instruments.forEach( (instrument)=>{
			instrument.update( 23 );
		});
	}


}
