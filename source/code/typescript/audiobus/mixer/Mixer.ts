import Engine from '../Engine';
import MixerChannel from './MixerChannel';
import AudioComponent from '../AudioComponent';

export default class Mixer extends AudioComponent
{
  // a place to store the channels...
  private channels:Array<MixerChannel>;
  private panner:StereoPannerNode;

  public get pan():number
  {
    return this.panner.pan.value;
  }

  public set pan( value:number )
  {
    this.panner.pan.value = value;
  }

  constructor( specifiedContext?:AudioContext )
  {
		super(specifiedContext);

    // create the stereo pan...
    // if you want to pan a sound...
    //this.panner = this.audioContext.createStereoPanner();

    // connect the gain to the panner...
    //this.input = this.panner;
  }

  public connect( port:AudioNode )
  {
    //this.panner.connect( port );
    this.outputGainNode.connect( port );
  }

  // you can use silence to as a channel in the mux
  public silence():AudioBufferSourceNode
  {
    return this.audioContext.createBufferSource();
  }
  // for taking multiple nodes and muxing them down to stereo
  public mux( leftChannel:AudioNode, rightChannel:AudioNode ):ChannelMergerNode
  {
    const mergerNode:ChannelMergerNode = this.audioContext.createChannelMerger(2); //create mergerNode with 2 inputs
    leftChannel.connect(mergerNode, 0, 0);
    rightChannel.connect(mergerNode, 0, 1);
    return mergerNode;
  }
  public toStereo( mono:AudioNode ):ChannelMergerNode
  {
    const mergerNode:ChannelMergerNode = this.audioContext.createChannelMerger(2); //create mergerNode with 2 inputs
    mono.connect(mergerNode, 0, 0);
    mono.connect(mergerNode, 0, 1);
    return mergerNode;
  }

  public solo():boolean
  {
      return true;
  }

  public addToChannel( channel:MixerChannel )
  {

  }
}
