// This is an interface to the sequencer that offers helpful methods for song creation...
// You can add levels of automation here such as volume fading and effects :)
import Sequencer from './timing/Sequencer';
import AudioComponent from './AudioComponent';

export default class Conductor extends AudioComponent
{
	private sequences:Array<Sequencer>;

  constructor( audioContext:AudioContext=undefined )
	{
		super( audioContext );
	}

	public addSequence( sequencer:Sequencer ):Conductor
	{
		// for chaininability...
		return this;
	}
	public addSequences( sequences:Array<Sequencer> ):Conductor
	{
		// for chaininability...
		return this;
	}
}
