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
	public outputGainNode:GainNode;
	public inputAudioNode:AudioNode;

  protected amplitude:number = 1;           // overall default output volume

	protected muted:boolean = false;
	protected mutedVolume:number = 0;

	public name:string = "AudioComponent";

	public get isSource():boolean
	{
		return this.outputGainNode.numberOfInputs === 0;
	}

  public set volume( vol:number )
  {
    const t:number = this.context.currentTime;
    this.outputGainNode.gain.cancelScheduledValues( t );
    this.outputGainNode.gain.value = vol;
    this.amplitude = vol;
  }

  public get audioContext( ):AudioContext
  {
    return this.context;
  }

  public get volume( ):number
  {
		if (this.muted)
		{
			return this.amplitude;
		}else{
			return this.outputGainNode.gain.value;
		}
  }

	// Get the port where the data comes out from...
	public get output():GainNode
	{
		return this.outputGainNode;
	}

	public get input():AudioNode
	{
		return this.inputAudioNode;
	}

	// // Set which port this device gets it's data from...
	public set input( port:AudioNode )
	{
		this.inputAudioNode = port;
		if (port)
		{
			this.outputGainNode.connect( port );
		}else{
			this.outputGainNode.disconnect( port );
		}

	}

  // if no context is specified we get the engine default...
	constructor( audioContext?:AudioContext )
	{
    const resolvedContext = audioContext ? audioContext : Engine.fetch();
		this.context = resolvedContext;

		this.outputGainNode = resolvedContext.createGain();
    this.outputGainNode.gain.value = this.amplitude;


		// ready to go!
  	this.create();
	}

  public mute():void
  {
		if (this.muted)
		{
			return;
		}
		this.mutedVolume = this.volume;
		this.muted = true;
  }

  public unmute():void
  {
		if (!this.muted)
		{
			return;
		}
		this.muted = false;
		this.volume = this.mutedVolume;
  }

	public create():void
	{

	}

	// Free up memory...
	public destroy():void
	{
		this.outputGainNode.disconnect();
    this.outputGainNode = null;
	}
	public toString():string
	{
		return "AudioComponent" + name+" input "+this.input+" output "+this.output;
	}
}
