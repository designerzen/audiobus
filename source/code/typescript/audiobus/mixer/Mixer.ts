import Engine from '../Engine';
import MixerChannel from './MixerChannel';

export default class Mixer
{
  // a place to store the channels...
  private channels:Array<MixerChannel>;

	public get volume()
	{
		return 1;
	}

	public set volume( vol:Number )
	{

	}

  constructor( specifiedContext:AudioContext=undefined )
  {
		// tries to fetch the global context if not provided...
		const context:AudioContext = specifiedContext || Engine.fetch();
		// now wire in our global volume...
		const gain:GainNode = context.createGain();
  }

  public mute():boolean
  {
      return true;
  }

  public solo():boolean
  {
      return true;
  }

  public addToChannel( channel:MixerChannel )
  {

  }
}
