
import Envelope from './Envelope';
import Engine from '../Engine';

export default class LinearEnvelope extends Envelope
{
  constructor( audioContext:AudioContext, amplitude:number=1  )
  {
    super( audioContext || Engine.fetch(), amplitude );

    // A pregnant pause before the note begins - inspired by the Prophet`08
    // Affords for a slightly less robotic sounds with very subtle random delays
    // Requires a number in milliseconds
    this.delayTime         = 0;

    // how aggressive the intro fade is
    // Requires a number in milliseconds
    this.attackTime        = 0.6;

    // peak output volume
    // This is a percentage between 0 -> 1
    this.amplitude         = 1;

    // how much to let off after the intro before...
    // Requires a number in milliseconds
    this.decayTime         = 1000;

    // how loud is the afternote
    // This is a percentage between 0 -> 1
    this.sustainVolume     = 0.9;

    // how long to hold the note for
    // -1 means until the stop is pressed
    // 0 means immediately without any sustain
    // 0+ means hold for that length then release
    this.holdTime          = 0;        // -1
    this.hold             = true;

    // how long does the fade out last
    // Requires a number in milliseconds
    this.releaseTime       = 1.2;

    // A factor that can be sed to overdrive or refine the overall volume
    this.gain              = 1;


    // default types of curves...
    this.attackType        = Envelope.CURVE_TYPE_LINEAR;
    this.decayType         = Envelope.CURVE_TYPE_LINEAR;
    this.releaseType       = Envelope.CURVE_TYPE_LINEAR;
  }
}
