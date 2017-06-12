package audiobus.services.media 
{
	import audiobus.models.media.AudioModel;
	import flash.net.NetConnection;
	
	public final class RTMP extends AbstractStream 
	{
		
		public function RTMP($audioModel:AudioModel) 
		{
			super($audioModel);
			
		}
		
	}

}