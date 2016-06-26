/// <reference path="Dependencies.ts" />
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Engine
==============
Abstract    - As no bus is useful without an engine
Description - Essential part of the AudioBus package that talks with hardware
                also ensures that only ever one engine is created
Use         - Static access
Methods     - Engine.create();

//////////////////////////////////////////////////////////////////////////////*/
module audiobus
{
	export class Engine
    {
        public static context:AudioContext;
		public static create( window ):AudioContext
		{
            if (Engine.context) { return Engine.context; };

			try {
				// Fix up for prefixing
				window.AudioContext = window.AudioContext || window.webkitAudioContext || window.msAudioContext || window.mozAudioContext;
                Engine.context = new AudioContext();
                return Engine.context;
			} catch(error) {
				return null;
			}
		}

    }
}