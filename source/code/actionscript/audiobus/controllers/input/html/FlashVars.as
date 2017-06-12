package audiobus.controllers.input.html 
{
	import flash.display.LoaderInfo;
	import flash.display.Stage;
	public class FlashVars 
	{
		private var flashVars:Object;
		
		//////////////////////////////////////////////////////////////////////////////////
		// Get a specific variable with the name X
		//////////////////////////////////////////////////////////////////////////////////
		public function fetchVar( $name:String, $defaultValue:* ):String
		{
			return ( flashVars[ $name ] ) ? flashVars[ $name ] : String($defaultValue);
		}
		
		//////////////////////////////////////////////////////////////////////////////////
		// Instantiate and parse internal variables...
		//////////////////////////////////////////////////////////////////////////////////
		public function FlashVars( $stage:Stage ) 
		{
			parse( $stage );
		}
		
		private function parse( $stage:Stage ):void
		{
			var varName:String;
			var paramObj:Object = LoaderInfo( $stage.loaderInfo ).parameters;
			flashVars = new Object();
			for (varName in paramObj) flashVars[varName] = paramObj[varName];
		}
		
		// Get a specific variable with the name X
		public function fetchBoolean( $name:String, $defaultValue:Boolean ):Boolean
		{
			var output:String = flashVars[ $name ];// .toLowerCase();
			if ( output == null ) return $defaultValue;
			if ( output.toLowerCase() == "true" ) return true;
			if ( output.toLowerCase() == "false" ) return false;
			return false;
		}
	}

}