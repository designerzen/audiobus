///<reference path="../definitions/waa.d.ts" />
module audiobus.inputs
{

	interface Navigator {
			getUserMedia(
				options: { video?: boolean; audio?: boolean; }, 
				success: (stream: any) => void, 
				error?: (error: string) => void
				) : void;
		}	
	
	export class Microphone
    {
		public context:AudioContext;
		public gain:GainNode;
			// this will need to be removed once getUserMedia is more accepted
		
		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			this.context = audioContext;
			this.gain = audioContext.createGain();
			this.gain.connect( outputTo );
		}
		private getUserMedia(options: { video?: boolean; audio?: boolean; }, 
				success: (stream: any) => void, 
				error?: (error: string) => void)
		{
			var n = <any>navigator;
			n.getUserMedia  = n.getUserMedia || n.webkitGetUserMedia || n.mozGetUserMedia || n.msGetUserMedia;
			return  n.getUserMedia({video: true, audio:true}, success, error);
		}
		
		public getMic()
		{
			//get mic in
			this.getUserMedia(
				{audio:true},
				this.onMicAvailable,
				this.onMicUnAvailable
			);	
		}
		
		// success callback when requesting audio input stream
		private onMicAvailable(stream):void
		{
			// Create an AudioNode from the stream.
			var mediaStreamSource:MediaStreamAudioSourceNode = this.context.createMediaStreamSource( stream );
			this.gain.connect(mediaStreamSource); 
		}
		
		private onMicUnAvailable( error ):void
		{
			console.log("The following error occured: " + error); 
		}
	}
}