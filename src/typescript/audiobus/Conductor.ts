/// <reference path="Dependencies.ts" />
module audiobus
{
	export class Conductor
    {
        public static context:AudioContext;
		public static create( window ):AudioContext
		{
            if (Conductor.context) return Conductor.context;

			try {
				// Fix up for prefixing
				window.AudioContext = window.AudioContext || window.webkitAudioContext || window.msAudioContext || window.mozAudioContext;
                Conductor.context = new AudioContext();
                return Conductor.context;
			} catch(error) {
				return null;
			}
		}

        public static masterVolume():GainNode
        {
            var volume:GainNode = Conductor.context.createGain();
            volume.connect( Conductor.context.destination );
            return volume;
        }

    }
}