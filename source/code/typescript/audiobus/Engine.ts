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
// declare var webkitAudioContext: {
//     new (): AudioContext;
// }
// declare var webkitOfflineAudioContext: {
//     new (numberOfChannels: number, length: number, sampleRate: number): OfflineAudioContext;
// }

interface AudioContextConstructor {
    new(): AudioContext;
}
interface OfflineAudioContextConstructor {
    new(numberOfChannels: number, length: number, sampleRate: number): OfflineAudioContext;
}

interface Window {
    AudioContext: AudioContextConstructor;
    OfflineAudioContext: OfflineAudioContextConstructor;
}

//
// interface AudioContext {
//     createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode;
// }
//
// interface AudioContext {
//     suspend(): Promise<void>;
//     resume(): Promise<void>;
//     close(): Promise<void>;
//     createMediaStreamDestination(): MediaStreamAudioDestinationNode;
// }
//
// interface MediaStreamAudioSourceNode extends AudioNode {
//
// }
//
// interface MediaStreamAudioDestinationNode extends AudioNode {
//     stream: MediaStream;
// }
//
//
//
//
// interface AudioBuffer {
//     copyFromChannel(destination: Float32Array, channelNumber: number, startInChannel?: number): void;
//     copyToChannel(source: Float32Array, channelNumber: number, startInChannel?: number): void;
// }
//
// interface AudioNode {
//     disconnect(destination: AudioNode): void;
// }

export default class Engine
{
  public static VERSION:string = "3.0.0";

  public static context:AudioContext;

  constructor()
  {
    throw Error("Engine should not be created with new()");
  }

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

  // public onEnded ( callback:Function ):void
  // {
  //   if (Engine.context instanceof (window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
  //   Engine.context.suspend().then(function() {
  //     callback();
  //     Engine.context.resume();
  //   });
  //   } else if (Engine.context instanceof (window.AudioContext || window.webkitAudioContext)) {
  //     triggerNode.onended = callback;
  //   }
  // }

	public static fetch():AudioContext
	{
	  if (Engine.context)
		{
			return Engine.context;
		}

		try {

			// Fix up for prefixing
			//window.AudioContext = window.AudioContext ;//|| window.webkitAudioContext || window.msAudioContext || window.mozAudioContext;
      Engine.context = new AudioContext();
      return Engine.context;

		} catch(error) {

			return null;
		}
	}

}
