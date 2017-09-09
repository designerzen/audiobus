/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Hi Hat
==============
Abstract    - Classic 808 hi-hat
Description - Based on the schematic of the Roland TR808
Use         - trigger
Methods     -
Thanks to   -
https://web.archive.org/web/20160403115835/http://www.soundonsound.com/sos/allsynthsecrets.htm

//////////////////////////////////////////////////////////////////////////////*/
import Instrument from '../Instrument';
import Envelope from '../../envelopes/Envelope';

const fundamental = 40;
const ratios:[]string = [2, 3, 4.16, 5.43, 6.79, 8.21];


export default class TR808Hat extends Instrument {

    private oscillators: <OscillatorNode[] = [];

    private bandPassFilter: BiquadFilterNode;
    private highPassFilter: BiquadFilterNode;

    // create
    constructor(audioContext?: AudioContext) {
        super(audioContext);

        // Synthesize!
        // let's strip out some of the lower frequencies
        // Bandpass
        const bandpass: BiquadFilterNode = audioContext.createBiquadFilter();
        bandpass.type = "bandpass";
        bandpass.frequency.value = 10000;
        this.bandPassFilter = bandpass;

        // Highpass
        const highpass: BiquadFilterNode = audioContext.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 7000;
        this.highPassFilter = bandpass;

        // Create the oscillators
        ratios.forEach( (ratio) => {
            const osc: OscillatorNode = audioContext.createOscillator();
            osc.type = "square";
            // Frequency is the fundamental * this oscillator's ratio
            osc.frequency.value = fundamental * ratio;
            // connect our oscillators to our filter
            osc.connect(bandpass);
            this.oscillators.push( osc);
        });


        // connect our filters in series
        bandpass.connect(highpass);
        // and output
        this.input = highpass;

        // Shape the output waveform
        this.envelope.attackTime = 0.025;
        this.envelope.decayTime = 0.05;
        this.envelope.releaseTime = 0.4;
        this.envelope.sustainVolume = 0.2;
        this.envelope.decayType = Envelope.CURVE_TYPE_EXPONENTIAL;
    }

    public start(offsetA: number = 0.025, offsetB: number = 0.05, offsetC: number = 0.4): boolean {
        /*
        // Define the volume envelope
        gain.gain.setValueAtTime(0.00001, when);
        gain.gain.exponentialRampToValueAtTime(1, when + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.3, when + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.00001, when + 0.3);
        */

        if (super.start()) {

            // loop through array and start
            this.oscillators.forEach((osc: OscillatorNode) => {
                osc.start(0);
            });
            return true;
        } else {
            return false;
        }
    }
}
