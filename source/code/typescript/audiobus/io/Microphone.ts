import AudioComponent from '../AudioComponent';

export default class Microphone extends AudioComponent
{
	public source:MediaStream;
	public stream:MediaStreamAudioSourceNode;

	public state:string = "Disconnected";

	constructor( audioContext:AudioContext=undefined )
	{
		super(audioContext);
	}

	public getMic():Promise<MediaStreamAudioSourceNode>
	{
		return new Promise<MediaStreamAudioSourceNode>((resolve, reject) => {

			//get mic in
			navigator.getUserMedia(
				{
					audio:true
				},
				// MediaStreamAudioSourceNode
				(streamSource:MediaStream)=>{

					// Success
					this.onMicAvailable(streamSource);
					resolve(this.stream);

				},
				// MediaStreamError
				(error)=>{

					// Failure
					this.onMicUnAvailable(error);
					reject(error);

				}

			);
		});

	}

	// success callback when requesting audio input stream
	private onMicAvailable(streamSource:MediaStream):void
	{
		// Create an AudioNode from the stream.
		this.source = streamSource;
		this.state = "connected";
		this.stream = this.context.createMediaStreamSource( streamSource );
		this.gainNode.connect(this.stream);
	}

	private onMicUnAvailable( error:MediaStreamError ):void
	{
		console.log("The following error occured: " + error);
		this.state = "disconnected";
	}
}
