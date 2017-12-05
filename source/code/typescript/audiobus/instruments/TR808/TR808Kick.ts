/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Bass Drum
==============
Abstract    - Classic single oscillator 808 Kick
Description - Based on the schematic of the Roland TR808
Use         - trigger
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
import Instrument from '../Instrument';
import Envelope from '../../envelopes/Envelope';

export default class TR808Kick extends Instrument {
    private highFrequencySquare: OscillatorNode;
    private lowFrequencySquare: OscillatorNode;
    private filter: BiquadFilterNode;

    // create
    constructor(audioContext?: AudioContext) {
        super(audioContext);

        // Synthesize!
        //GENERATE COWBELL
        this.highFrequencySquare = audioContext.createOscillator();
        this.highFrequencySquare.type = "square";// OscillatorType["square"];//OscillatorTypes.SQUARE; // square wave
        this.highFrequencySquare.frequency.value = 800;

        this.lowFrequencySquare = audioContext.createOscillator();
        this.lowFrequencySquare.type = "square";//OscillatorTypes.SQUARE; // square wave
        this.lowFrequencySquare.frequency.value = 540;

        // let's strip out some of the lower frequencies
        this.filter = this.context.createBiquadFilter();
        this.filter.type = "bandpass";

        this.highFrequencySquare.connect(this.filter);
        this.lowFrequencySquare.connect(this.filter);

        this.input = this.filter;

        // Shape the output waveform
        this.envelope.gain = 8;
        this.envelope.attackTime = 0.002;
        this.envelope.decayTime = 0.05;
        this.envelope.holdTime = 0;
        this.envelope.hold = false;
        this.envelope.releaseTime = 0.3;
        this.envelope.sustainVolume = 0.8;
        this.envelope.decayType = Envelope.CURVE_TYPE_EXPONENTIAL;
    }

    public start(offsetA: number = 0.025, offsetB: number = 0.05, offsetC: number = 0.4): boolean {
        /*
              var t:number = this.context.currentTime;

              this.gain.gain.cancelScheduledValues( t );
              this.gain.gain.setValueAtTime(1, t);
              this.gain.gain.linearRampToValueAtTime( 1,  t + offsetA );
              this.gain.gain.exponentialRampToValueAtTime( 0.2, t + offsetB );
              this.gain.gain.linearRampToValueAtTime( 0.0,  t + offsetC );
        */

        if (super.start()) {
            this.highFrequencySquare.start(0);
            this.lowFrequencySquare.start(0);
            return true;
        } else {
            return false;
        }
    }
}
