/*

As of July 2014, oscillator type must be specified as Web IDL value.

The type property of the OscillatorNode interface specifies what shape of
waveform the oscillator will output. There are several common waveforms
available, as well as an option to specify a custom waveform shape.

The shape of the waveform will affect the tone that is produced.

sine
    A sine wave. This is the default value.

square
    A square wave with a duty cycle of 0.5; that is, the signal is "high" for half of each period.

sawtooth
    A sawtooth wave.

triangle
    A triangle wave.

custom
    A custom waveform.

    NB. You never set type to custom manually;
        instead, use the setPeriodicWave()
        method to provide the data representing the waveform.
        Doing so automatically sets the type to custom :)

*/

export default class OscillatorTypes
{
  public static SINE:string = "sine";
  public static SQUARE:string = "square";
  public static SAWTOOTH:string = "sawtooth";
  public static TRIANGLE:string = "triangle";
  public static CUSTOM:string = "custom";
}


// enum OscillatorTypes {
//   SINE = 'sine',
//   SQUARE = 'square',
//   SAWTOOTH = 'sawtooth',
//   TRIANGLE = 'triangle',
//   CUSTOM = 'custom'
// }

//export default OscillatorTypes;
