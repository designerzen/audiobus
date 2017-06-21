import Engine from '../Engine';
import MixerChannel from './MixerChannel';
import AudioComponent from '../AudioComponent';

export default class Mixer extends AudioComponent
{
  // a place to store the channels...
  private channels:Array<MixerChannel>;

  constructor( specifiedContext:AudioContext=undefined )
  {
		super(specifiedContext);
  }

  public solo():boolean
  {
      return true;
  }

  public addToChannel( channel:MixerChannel )
  {

  }
}
