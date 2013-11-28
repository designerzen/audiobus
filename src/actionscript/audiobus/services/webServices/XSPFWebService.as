package audiobus.services.webServices 
{
	import audiobus.controllers.load.AbstractWebService;
	import audiobus.models.media.AudioModel;
	import audiobus.models.media.MediaModel;
	import flash.net.URLLoaderDataFormat;
	
	public class XSPFWebService extends AbstractWebService implements IWebService
	{
		private var audioModels:Vector.<AudioModel>
		public function get models():Vector.<AudioModel>
		{
			return audioModels;
		}
		
		override public function get data():* 
		{
			return audioModels;
		}
		
		public function XSPFWebService( $ignoreWhitespaac:Boolean = true, $ignoreComments:Boolean=true ) 
		{
			XML.ignoreWhitespace = $ignoreWhitespaac;
			XML.ignoreComments = $ignoreComments;
			super();
		}
	
		public function loadService( $url:String, $crossDomain:Boolean = false, $timeOut:Number = AbstractWebService.DEFAULT_LOAD_TIMEOUT ):void 
		{
			super.load( $url, $crossDomain, $timeOut, URLLoaderDataFormat.BINARY );
		}
		
		override protected function onDataReady():void 
		{
			audioModels = parseFile( XML(super.data) );
			super.onDataReady();
		}
		
		// Take the XSPF Data file in XML format and convert it into an vector
		public function parseFile( $xspf:XML ):Vector.<AudioModel>
		{
			var output:Vector.<AudioModel> = new Vector.<AudioModel>();
			var model:AudioModel;
			
			// now loop through the XML nodes and create a model for each
			for each ( var node:XML in $xspf.children() )
			{	
				// fetch *ALL* tracklists (not just the first one!)
                if ( node.localName().toLowerCase() == 'tracklist' )
				{
					// now search for all tracks in the tracklist
					var trackList:XMLList = node.children();
					for each( var track:XML in trackList )
					{
						model = parseItem( track );
						output.push( model );
					}
					
				}
				// Loop for more track lists!
			}
			// and return data values
			return output;
		};
		/*
		<track>
			<location><![CDATA[../assets/BM202.mp3]]></location>
			<creator>FM3</creator>
			<album>Buddha Machine II</album>
			<title>202</title>
			<duration>271066</duration>
		</track>
		*/
		// Now navigate through the item node and extrapolate the media
		// Data held within, converting it into an MediaModel directly
		public function parseItem( $node:XML ):AudioModel
		{
			var model:AudioModel = new AudioModel();
			for each ( var branch:XML in $node.children() ) 
			{
				// If we are
				if ( !branch.localName() ) break;
				// As we cannot guarantee that the formatting is perfect
				switch( branch.localName().toLowerCase() )
				{
					case 'album':
						
						break;
					case 'annotation':
						model.description = branch.text().toString();
						break;
					case 'creator':
						model.author = branch.text().toString();
						break;
					case 'duration':
						model.duration = Number( branch.text() );
						break;					
					case 'image':
						//itm['image'] = branch.text().toString();
						break;
					case 'info':
						//itm['link'] = branch.text().toString();
						break;
					case 'meta':
						//itm[i.@rel] = branch.text().toString();
						break;					
					case 'location':
						model.url = branch.text().toString();
						break;
					case 'title':
						model.title = branch.text().toString();
						break;

				}
			}
			
			trace( model );
			return model;
		}
	};

}