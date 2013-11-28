/*/////////////////////////////////////////////////////////////////////////

This is a super simple system for listening to buttons being 
pressed and released... 

Set the instantitor up using either onKeyDown = true / false

This alters behaviour to either send the event when pressed in
or when released!

/////////////////////////////////////////////////////////////////////////*/
package audiobus.controllers.input.keyboard 
{
	import flash.display.DisplayObject;
	import flash.display.Stage;
	import flash.events.KeyboardEvent;
	import flash.utils.Dictionary;

	public class KeyboardHandler 
	{
		protected const keysPressed:Dictionary = new Dictionary();		// permanent key press dictionary
		//protected const library:Dictionary = new Dictionary();			// permanent dictionary
		protected const shortcuts:Array = new Array();					// permanent array
			
		// Merge these back into the DO somehow
		private var sendEventWhenReleased:Boolean = true;
		
		private var lastPressedCode:uint = 0;
		
		private var target:DisplayObject;
		
		// If you want keys to be hit in a specific sequence, enable this : 
		private var orderSpecific:Boolean = true;
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Return an Array of *ALL* keys currently being pressed as keycodes
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function get keysHeld():Array
		{
			var held:Array = [];
			for each ( var keyCode:int in keysPressed ) 
			{
				//trace( "Key held : " + keyCode );
				held[ held.length ] = keyCode;
			}
			// For cheat codes aand any app where we need to press more than one key...
			if ( orderSpecific || (held.length>=3) ) return held.sort( Array.NUMERIC );
			return held;
		}
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Construct
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function KeyboardHandler( $target:DisplayObject, $orderSpecific:Boolean=false, $onKeyDown:Boolean=true )
		{
			orderSpecific = $orderSpecific;
			addTarget( $target, $onKeyDown );
		};

		//////////////////////////////////////////////////////////////////////////////////////////////////
		// ASSIGN a Display Object to use as the FOCUS item
		// This can be stage or any child clip that exists. Only the object with focus will dispatch these
		// Events unless you set the operating mode to Global
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function addTarget( $displayObject:DisplayObject, $onKeyDown:Boolean=true ):void
		{
			// Make suret that we have not already added this DO to our library
			if ( target == $displayObject ) return void;
			// Alter behaviour, either on key down trigger or key up triggered
			sendEventWhenReleased = !$onKeyDown;
			// Save a pointer
			target = $displayObject;
			// Start monitoring events
			target.addEventListener( KeyboardEvent.KEY_DOWN, onKeyPress );
			target.addEventListener( KeyboardEvent.KEY_UP, onKeyRelease );
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Un-Register a Display Object's Key Listeners
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function removeTarget( $displayObject:DisplayObject ):void
		{
			// Make sure that we have actually added this DO to our library in the first place
			if ( target != $displayObject ) 
			{
				throw ArgumentError( "The Display Object : "+$displayObject+" is not registered to receive Keyboard Events" );
				return void;
			}
			
			// Start monitoring events
			target.removeEventListener( KeyboardEvent.KEY_DOWN, onKeyPress );
			target.removeEventListener( KeyboardEvent.KEY_UP, onKeyRelease );
			// Destroy reference
			target = null;
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Bind a key to a method
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function addKeyCombo( $callback:Function, $keys:*, ...$args:Array ): void
		{
			shortcuts.push( new Hotkey( $callback, $keys, orderSpecific, $args ) );
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Key Event : Key Pressed DOWN
		//////////////////////////////////////////////////////////////////////////////////////////////////
		protected function onKeyPress( $event:KeyboardEvent ): void
		{
			//if (lastPressedCode == $event.keyCode ) return void;
			
			// Check to see if we are getting the correct keyboard flow
			// if ($event.currentTarget != target) return void;
			
			// Useful for holding down extra stuff
			//if ($event.commandKey) 	keysPressed[ 'cmd' ] = 5;
			//if ($event.controlKey)	keysPressed[ 'cmd' ] = 5;
			//if ($event.altKey) 		keysPressed[ 'cmd' ] = 5;
			//if ($event.shiftKey)		keysPressed[ 'cmd' ] = 5;

			// 
			lastPressedCode = $event.keyCode;
			keysPressed[ $event.keyCode ] = $event.keyCode;
			
			//trace( "Key Pressed : " + $event.keyCode+", Keys Held Down : "+this.keysHeld );
			
			// 
			if (!sendEventWhenReleased) check();
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Key Event : Key Released
		//////////////////////////////////////////////////////////////////////////////////////////////////
		protected function onKeyRelease( $event:KeyboardEvent ): void
		{
			// now be sure to remove this key from the library :)
			delete( keysPressed[ $event.keyCode ] );
			
			//trace( "Key Released : "+$event.keyCode + " Keys still held : "+this.keysHeld );
			
			if (sendEventWhenReleased) check();
			
			lastPressedCode = 0;
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Now check our collections to see what we have going on and if any of our currenly assigned
		// hotkeys match our currently held keys
		//////////////////////////////////////////////////////////////////////////////////////////////////
		protected function check(): void
		{
			var keysCurrentlyHeld:String = String( this.keysHeld );
			// NO keys currently are being held down
			if ( keysCurrentlyHeld.length == 0 ) return void;
			for each( var shortcut:Hotkey in shortcuts )
			{
				//trace( "Key Check : "+  shortcut.keys + " == " + keysCurrentlyHeld + " : " + ( shortcut.keyList == keysCurrentlyHeld ));
				if ( shortcut.enabled ) if ( shortcut.keyList == keysCurrentlyHeld )
				{
					// hotkey discovered!
					//trace("Hotkey MATCHED! : " + shortcut );
					shortcut.execute();
				}
			}
		};
		//
	}

}

/*/////////////////////////////////////////////////////////////////////////

This is a HotKey subset class that encapsulates each key combo and callback

/////////////////////////////////////////////////////////////////////////*/
internal class Hotkey
{
	public var enabled:Boolean;
	public var callback:Function;
	public var keyList:String;
	public var keys:Array;
	public var args:Array;
	
	private var sequence:Boolean;
	
	private const sanitiser:RegExp = /(\,|\|)+/g;
	
	public function Hotkey( $callback:Function, $keys:*, $sequenceImportant:Boolean, $args:Array )
	{
		callback = $callback;
		args = $args;
		enabled = true;
		sequence = $sequenceImportant;
		creatKeyMap( String($keys) );
	};
	
	// Bind a specific set of Keys to this object
	private function creatKeyMap( $keys:String ):void
	{
		// split at commas "," , add signs "+" and pipes "|"
		$keys = $keys.replace( sanitiser, "+" );
		
		// convert string into array
		keys = $keys.split('+');
		
		//trace( "Homogenised 	: "+$keys+",	 Split 	: "+keys );
		
		// Sanitise these key requests into keyCodes where applicable
		for (var k:int = 0; k < keys.length ; ++k)
		{
			// convert typed strings such as "d" into key codes
			if ( isNaN( keys[k] ) ) 
			{
				var keyCode:int;
				var keyString:String = String(keys[k]);
				
				// first check to see if it is one of our special cases :
				switch( keyString.toLowerCase() )
				{
					case "alt":
						keyCode = 18;
						break;
					case "control":
						keyCode = 17;
						break;
					case "shift":
						keyCode = 16;
						break;
					/*
					case "command":
						keyCode = 15;
						break;
					*/

					// Directions
					case "left":
						keyCode = 37;
						break;					
					case "up":
						keyCode = 38;
						break;					
					case "right":
						keyCode = 39;
						break;					
					case "down":
						keyCode = 40;
						break;
						
					default :
						// 32 is the offset to receive similar keycodes to charcodes :)
						keyCode = keyString.charCodeAt( 0 )-32;
				}
				
				//trace( "Keycode = " +keyCode+" from string = "+keys[k] );
				keys[k] = keyCode;
			}
		}
		
		// No VALID keys found to register :(
		if ( keys.length == 0 ) throw new ArgumentError("Invalid HotKey combination :(");
		
		// Else sort numerically
		if (!sequence) keyList = String( keys.sort( Array.NUMERIC ) );
		else keyList = String( keys );
		
		//trace( "Registered Key Codes : "+keys+" Chars : "+keyString );
	};
	
	// Callback function with arguments specified in constructor
	public function execute():void
	{
		callback.apply( null, args );
	};
	
	// Polite Debug
	public function toString():String
	{
		return "[HotKey comprised of " + keys.length + " keys, with values " + keys + "]";
	}
}