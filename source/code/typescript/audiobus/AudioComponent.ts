// This is an Abstract Class that should be extended when you create an instrument
// Or any bit of code that should actually create noise or sound.
// It intelligently resolves audio contexts and offers nice interfaces for other
// classes to implement.

// Essentially, this is fundamental to the framework's building blocks

import Engine from './Engine';

export default class AudioComponent
{
	protected context:AudioContext;

	// these are shared...
	public gainNode:GainNode;
	public outputGainNode:GainNode;
	public inputGainNode:GainNode;

  protected amplitude:number = 1;           // overall default output volume

  public set volume( vol:number )
  {
    const t:number = this.context.currentTime;
    this.gainNode.gain.cancelScheduledValues( t );
    this.gainNode.gain.value = vol;
    this.amplitude = vol;
  }

  public get audioContext( ):AudioContext
  {
    return this.context;
  }

  public get volume( ):number
  {
    return this.gainNode.gain.value;
  }

	// Where is the output node connected to?
	public get output():GainNode
	{
		return this.outputGainNode;
	}

	// Set where this device outputs to
	public set output( outputTo:GainNode )
	{
		this.outputGainNode = outputTo;
		this.gainNode.connect( outputTo );
	}

  // if no context is specified we get the engine default...
	constructor( audioContext:AudioContext=undefined )
	{
    const resolvedContext = audioContext ? audioContext : Engine.fetch();
		this.context = resolvedContext;

		this.gainNode = resolvedContext.createGain();
    this.gainNode.gain.value = this.amplitude;
	}

}
