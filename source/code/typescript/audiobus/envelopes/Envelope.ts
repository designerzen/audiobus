/*//////////////////////////////////////////////////////////////////////////////

Envelope
==============
Abstract    - ADSHR - Model the shape of the amplitude of your sounds
Description - Here you can create the distinct attack, decay, sustain release curves and times
Use         - Pass an input and connect the output
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
export default class Envelope
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
	private inputPort:AudioNode;

  // A pregnant pause before the note begins - inspired by the Prophet`08
  // Affords for a slightly less robotic sounds with very subtle random delays
  // Requires a number in milliseconds
    public delayTime:number         = 0;

  // how aggressive the intro fade is
  // Requires a number in milliseconds
  public attackTime:number        = 0.6;

  // peak output volume
  // This is a percentage between 0 -> 1
	// NB. set in constructor
  public amplitude:number;

  // how much to let off after the intro before...
  // Requires a number in milliseconds
  public decayTime:number         = 1000;

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

	// when did this envelope begin in audioContext time?
	public startTime:number         =-1;


  // default types of curves...
  public attackType:string        = Envelope.CURVE_TYPE_LINEAR;
  public decayType:string         = Envelope.CURVE_TYPE_LINEAR;
  public releaseType:string       = Envelope.CURVE_TYPE_LINEAR;

	public SILENCE:number = 0.00000001;//Number.MIN_VALUE*100000000000;

  // Returns the entire length in seconds of this envelope
  public get duration():number
  {
      return this.delayTime + this.attackTime + this.decayTime + this.releaseTime + (this.holdTime < 0 ? 0 : this.holdTime);
  }

	public get endsAt():number
	{
		// if it hasn't started, we can't tell when it ends!
		return this.startTime < 0 ? 0 : this.startTime + this.duration;
	}

  public get remaining():number
  {
		return this.endsAt - this.context.currentTime;
  }

	// Get the port where the data comes out from...
	public get output():GainNode
	{
		return this.envelope;
	}

	// Get the port where the data comes out from...
	public get hasStarted():boolean
	{
		return this.startTime > -1;
	}
	public get hasFinished():boolean
	{
		return this.hasStarted ? this.startTime + this.duration > this.context.currentTime : false;
	}


	// Get the port where the data comes out from...
	public set input( port:AudioNode )
	{
		if (port)
		{
			port.connect( this.envelope );

		}else if (this.inputPort){

			// disconnect existing...
			this.inputPort.disconnect( this.envelope );
		}

		this.inputPort = port;
	}

  constructor( audioContext:AudioContext, amplitude:number=1 )
  {
      // this contains our envelope
      this.context = audioContext;
      this.envelope = audioContext.createGain();
      this.envelope.gain.value = this.amplitude = amplitude;
  }

	// would be cool if this could return a promise :)
  private fade( curveType:string, volume:number, time:number, length:number=0 ):number
  {
		// add itself to the watching pool until the number is reached then disconnect...
		// Scheduler.waitUntil( time ).then();

      if ( length <= 0 )
      {
          // we may as well cut rather than fade...
          this.envelope.gain.setValueAtTime( volume, time );
          return time;
      }
      var position:number = time + length;
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
      //this.envelope.gain.setValueAtTime( volume, position );
      return position;
  }

  public start(startPosition:number=-1, clearExisting:boolean=true ):number
  {
      var time:number = startPosition > -1 ? startPosition : this.context.currentTime;
      var position:number = this.delayTime + time;
      var vol:number = this.gain * this.amplitude;

			this.startTime = time;

      // clear any future events we may have set up
      if (clearExisting)
      {
          this.envelope.gain.cancelScheduledValues( position );
      }
      //console.error(this);
      // first set the initial volume at now as 1...
      this.envelope.gain.setValueAtTime( 0, position );

      // Attack to full amplitude
      position = this.fade( this.attackType, vol, position, this.attackTime );

      // Decay to Sustain
      position = this.fade( this.decayType, this.gain *this.sustainVolume, position, this.decayTime );

			//const introDuration:number = position - this.startTime;

      // Sustain & Hold
      //this.envelope.gain.setValueAtTime(this.gain *this.sustainVolume, position);

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
          //return this.stop( position, true );
      }
  }

  public stop( startPosition:number=-1, clearExisting:boolean=true ):number
  {
      const time:number = startPosition > -1 ? startPosition : this.context.currentTime;


      if (clearExisting)
      {
          this.envelope.gain.cancelScheduledValues( time );
      }

      // Release
      // NB. An exception will be thrown if this value is less than or equal to 0,
      // or if the value at the time of the previous event is less than or equal to 0.
      // this.gain.gain.setValueAtTime(0.0000000000001, t);
      const position:number = this.fade( this.releaseType, this.SILENCE, time, this.releaseTime );

      // Silence once the fade had completed...
      this.envelope.gain.setValueAtTime( 0, position );

			// for now...
			setTimeout( ()=>{
				console.log( "Envelope stopped" );
			},this.releaseTime );

      return position;
  }
}
