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

	public fetch():Promise<MediaStreamAudioSourceNode>
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
					const success:boolean = this.determineMicAvailability(streamSource);
					if (success)
					{
						this.onMicAvailable();
						resolve(this.stream);
					}else{
						this.onMicUnAvailable(null);
						reject("User may have cancelled permissions...");
					}

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
	private determineMicAvailability(streamSource:MediaStream):boolean
	{
		// Create an AudioNode from the stream.
		this.source = streamSource;
		
		try{
			this.stream = this.context.createMediaStreamSource( streamSource );
			//this.input = this.stream;
			this.outputGainNode.connect(this.stream);
			
		}catch(error){
			this.state = "disconnected";
			return false;
		}
		return true;
	}
	
	// success callback when requesting audio input stream
	private onMicAvailable():void
	{
		this.state = "connected";
	}

	private onMicUnAvailable( error:MediaStreamError ):void
	{
		console.log("The following error occured: " + error);
		this.state = "disconnected";
	}
}
