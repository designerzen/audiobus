/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Envelope
==============
Abstract    - ADSHR - Model the shape of the amplitude of your sounds
Description - Here you can create the distinct attck, decay, sustain release curves and times
Use         - Pass an input and connect the output
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus.envelopes
{
    export class Envelope
    {
		public context:AudioContext;
		public envelope:GainNode;

        public static CURVE_TYPE_LINEAR:string = "linearRampToValueAtTime";
        public static CURVE_TYPE_EXPONENTIAL:string = "exponentialRampToValueAtTime";
        public static CURVE_TYPE_LINEAR_EXPONENTIAL:string = "exponentialRampToValueAtTime+linearRampToValueAtTime";
        public static CURVE_TYPE_EXPONENTIAL_LINEAR:string = "linearRampToValueAtTime+exponentialRampToValueAtTime";

        /*
        DADSHR :
        Delay | Attack | Decay | Sustain | Release
        +----------------------------------------+
        |               XXX                      |
        |              XX XX                     |
        |             XX   XX                    |
        |            XX     XXX                  |
        |           XX        XXXXXXXXXXX        |
        |          XX                   XX       |
        |         XX                     XXX     |  Amplitude
        |        XX                        XX    |
        |       XX                          XX   |
        |      XX                            X   |
        |     XX                             XX  |
        |    XX                               XX |
        |   XX                                 XX|
        |XXX                                    XX
        XX---------------------------------------X
        Start                    |HOLD| Stop
        */

        // A pregnant pause before the note begins - inspired by the Prophet`08
        // Affords for a slightly less robotic sounds with very subtle random delays
        // Requires a number in milliseconds
        public delayTime:number         = 0;

        // how aggressive the intro fade is
        // Requires a number in milliseconds
        public attackTime:number        = 0.6;

        // peak output volume
        // This is a percentage between 0 -> 1
        public amplitude:number         = 1;

        // how much to let off after the intro before...
        // Requires a number in milliseconds
        public decayTime:number         = 1;

        // how loud is the afternote
        // This is a percentage between 0 -> 1
        public sustainVolume:number     = 0.9;

        // how long to hold the note for
        // -1 means until the stop is pressed
        // 0 means immediately without any sustain
        // 0+ means hold for that length then release
        public holdTime:number          = 0;        // -1
        public hold:boolean             = true;

        // how long does the fade out last
        // Requires a number in milliseconds
        public releaseTime:number       = 1.2;

        // A factor that can be sed to overdrive or refine the overall volume
        public gain:number              = 1;


        // default types of curves...
        public attackType:string        = Envelope.CURVE_TYPE_LINEAR;
        public decayType:string         = Envelope.CURVE_TYPE_LINEAR;
        public releaseType:string       = Envelope.CURVE_TYPE_LINEAR;

		public SILENCE:number = 0.00000001;//Number.MIN_VALUE*100000000000;

        constructor( audioContext:AudioContext, outputTo:AudioNode=null, source:AudioNode=null )
        {
            // this contains our envelope
            this.context = audioContext;
            this.envelope = audioContext.createGain();
            this.envelope.gain.value = this.amplitude;
            if (outputTo || source)
            {
                this.connect( outputTo, source );
            }
        }

        // Where do we take the source sound from, and where to route it to?
        // Output to should preferably be a GAIN Node
        public connect( outputTo:AudioNode, source:AudioNode ):void
        {
            // If we have an input from a different source
            if (source)
            {
                source.connect( this.envelope );
            }
            // If we have somewhere to route these to...
            if ( outputTo )
            {
                this.envelope.connect(outputTo);
            }
        }

        private fade( curveType:string, volume:number, time:number, duration:number=0 ):number
        {
            if ( duration <= 0 )
            {
                // we may as well cut rather than fade...
                this.envelope.gain.setValueAtTime( volume, time );
                return time;
            }
            var position:number = time + duration;
            var offset:number;
            switch (curveType)
            {
                case Envelope.CURVE_TYPE_LINEAR_EXPONENTIAL:
                    offset = position * 0.5;
                    this.envelope.gain.exponentialRampToValueAtTime( volume, offset );
                    this.envelope.gain.linearRampToValueAtTime( volume, offset );
                    break;

                case Envelope.CURVE_TYPE_EXPONENTIAL_LINEAR:
                    offset = position * 0.5;
                    this.envelope.gain.exponentialRampToValueAtTime( volume, offset );
                    this.envelope.gain.linearRampToValueAtTime( volume, offset );
                    break;

                case Envelope.CURVE_TYPE_EXPONENTIAL:
                    this.envelope.gain.exponentialRampToValueAtTime( volume, position );
                    break;

                default:
                    this.envelope.gain.linearRampToValueAtTime( volume, position );
            }
            return position;
        }

        public start(startPosition:number=-1, clearExisting:boolean=true ):number
        {
            var time:number = startPosition > -1 ? startPosition : this.context.currentTime;
            var position:number = this.delayTime + time;

            // clear any future events we may have set up
            if (clearExisting)
            {
                this.envelope.gain.cancelScheduledValues( position );
            }
            //console.error(this);
            // first set the initial volume at now as 1...
            // this.envelope.gain.setValueAtTime( 1, position );

            // Attack to full amplitude
            position = this.fade( this.attackType, this.gain * this.amplitude, position, this.attackTime );

            // Decay to Sustain
            position = this.fade( this.decayType, this.gain *this.sustainVolume, position, this.decayTime );

            // Sustain & Hold
            this.envelope.gain.setValueAtTime(this.gain *this.sustainVolume, position);

            // == HOLDING ==
            // now if holding is occurring, let's hold for that specified
            // period of time then fade everything out again...
            if ( this.hold || this.holdTime < 0 )
            {
                // we want to hold indefinitely
                return position;

            }else{

                // we want to do some holding!
                position += this.holdTime;
                // now fade out...
                return this.stop( position, false );

            }
        }

        public stop( startPosition:number=-1, clearExisting:boolean=true ):number
        {
            var time:number = startPosition > -1 ? startPosition : this.context.currentTime;
            var position:number = time;

            if (clearExisting)
            {
                this.envelope.gain.cancelScheduledValues( position );
            }

            // Release
            // NB. An exception will be thrown if this value is less than or equal to 0,
            // or if the value at the time of the previous event is less than or equal to 0.
            // this.gain.gain.setValueAtTime(0.0000000000001, t);
            position = this.fade( this.releaseType, this.SILENCE, position, this.releaseTime );

            // Silence
            this.envelope.gain.setValueAtTime( 0, position );
            return position;
        }
	}
}