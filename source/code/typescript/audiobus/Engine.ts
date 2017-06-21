/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Engine
==============
Abstract    - As no bus is useful without an engine

Description - Essential part of the AudioBus package that talks with hardware
                also ensures that only ever one engine is created

Use         - Static access

Methods     - Engine.fetch() returns an AudioContext

// Set gain node to explicit 2-channels (stereo).
gain.channelCount = 2;
gain.channelCountMode = "explicit";
gain.channelInterpretation = "speakers";

// Set "hardware output" to 4-channels for DJ-app with two stereo output busses.
context.destination.channelCount = 4;
context.destination.channelCountMode = "explicit";
context.destination.channelInterpretation = "discrete";

// Set "hardware output" to 8-channels for custom multi-channel speaker array
// with custom matrix mixing.
context.destination.channelCount = 8;
context.destination.channelCountMode = "explicit";
context.destination.channelInterpretation = "discrete";

// Set "hardware output" to 5.1 to play an HTMLAudioElement.
context.destination.channelCount = 6;
context.destination.channelCountMode = "explicit";
context.destination.channelInterpretation = "speakers";

// Explicitly down-mix to mono.
gain.channelCount = 1;
gain.channelCountMode = "explicit";
gain.channelInterpretation = "speakers";

//////////////////////////////////////////////////////////////////////////////*/
export default class Engine
{
  public static VERSION:string = "3.0.0";

  public static context:AudioContext;

  public static get channelCount():number
  {
    return Engine.context ? Engine.context.destination.channelCount : -1;
  }

  public static set channelCount( channels:number )
  {
    if (Engine.context)
    {
       Engine.context.destination.channelCount = channels;
     }
  }

  public static get sampleRate():number
  {
    return Engine.context ? Engine.context.sampleRate : -1;
  }

  public static get output():AudioDestinationNode
  {
    return Engine.context ? Engine.context.destination : null;
  }
  
  public static connect( source:AudioNode ):void
  {
    source.connect( Engine.output );
  }

	public static fetch():AudioContext
	{
	  if (Engine.context)
		{
			return Engine.context;
		};

		try {

			// Fix up for prefixing
			window.AudioContext = window.AudioContext ;//|| window.webkitAudioContext || window.msAudioContext || window.mozAudioContext;
      Engine.context = new AudioContext();
      return Engine.context;

		} catch(error) {

			return null;
		}
	}

}
