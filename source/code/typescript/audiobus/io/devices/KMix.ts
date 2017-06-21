
/*

// INPUT CHANNEL PARAMETERS : sent to channels 1 - 9
• Fader/Volume Level = CC 1
• Mute = CC 2
• EQ Bypass = CC 3
• EQ High Boost/Cut Level = CC 4
• EQ High Frequency = CC 5
• EQ Mid Boost/Cut Level = CC 6
• EQ Mid Frequency = CC 7
• EQ Mid Q = CC 8
• EQ Low Boost/Cut Level = CC 9
• EQ Low Frequency = CC 10
• Gate Bypass = CC 11
• Gate Threshold = CC 12
• Gate Attack Time = CC 13
• Gate Release Time = CC 14
• Gate Gain Reduction = CC 15
• Compressor Bypass = CC 16
• Compressor Threshold = CC 17
• Compressor Attack Time = CC 18
• Compressor Release Time = CC 19
• Compressor Ratio = CC 20
• Compressor Makeup Gain = CC 21
• Left/Right Panning (to Mains) = CC 22
• Aux 1 Send Level = CC 23
• Aux 1 Panning = CC 24
• Aux 2 Send Level = CC 25
• Aux 2 Panning = CC 26
• Aux 3 Send Level = CC 27
• Aux 3 Panning = CC 28
• Input Trim = CC 29

let input_channel_params = {
	"fader": 1,
	"mute": 2,
	"eq-bypass": 3,
	"eq-high-boost": 4,
	"eq-high-frequency": 5,
	"eq-mid-boost": 6,
	"eq-mid-frequency": 7,
	"eq-mid-q": 8,
	"eq-low-boost": 9,
	"eq-low-frequency": 10,
	"gate-bypass": 11,
	"gate-threshold": 12,
	"gate-attack-time": 13,
	"gate-release-time": 14,
	"gate-gain-reduction": 15,
	"compressor-bypass": 16,
	"compressor-threshold": 17,
	"compressor-attack-time": 18,
	"compressor-release-time": 19,
	"compressor-ratio": 20,
	"compressor-makeup-gain": 21,
	"pan-main": 22,
	"send-aux-1": 23,
	"pan-aux-1": 24,
	"send-aux-2": 25,
	"pan-aux-2": 26,
	"send-aux-3": 27,
	"pan-aux-3": 28,
	"trim": 29
}

// MAIN OUTPUT BUS PARAMETERS : sent to channel 9

• Fader/Volume Level = CC 1
• Mute = CC 2
• EQ Bypass = CC 3
• EQ High Boost/Cut Level = CC 4
• EQ High Frequency = CC 5
• EQ Mid Boost/Cut Level = CC 6
• EQ Mid Frequency = CC 7
• EQ Mid Q = CC 8
• EQ Low Boost/Cut Level = CC 9
• EQ Low Frequency = CC 10
• Gate Bypass = CC 11
• Gate Threshold = CC 12
• Gate Attack Time = CC 13
• Gate Release Time = CC 14
• Gate Gain Reduction = CC 15
• Compressor Bypass = CC 16
• Compressor Threshold = CC 17
• Compressor Attack Time = CC 18
• Compressor Release Time = CC 19
• Compressor Ratio = CC 20
• Compressor Makeup Gain = CC 21


let main_output_bus_params = {
	"fader": 1,
	"mute": 2,
	"eq-bypass": 3,
	"eq-high-boost": 4,
	"eq-high-frequency": 5,
	"eq-mid-boost": 6,
	"eq-mid-frequency": 7,
	"eq-mid-q": 8,
	"eq-low-boost": 9,
	"eq-low-frequency": 10,
	"gate-bypass": 11,
	"gate-threshold": 12,
	"gate-attack-time": 13,
	"gate-release-time": 14,
	"gate-gain-reduction": 15,
	"compressor-bypass": 16,
	"compressor-threshold": 17,
	"compressor-attack-time": 18,
	"compressor-release-time": 19,
	"compressor-ratio": 20,
	"compressor-makeup-gain": 21
}

// MISC. PARAMETERS (REVERB/SURROUND/AUXES) : sent to channel 10

• Reverb Channel Send Levels 1–8 = CCs 1–8
• Reverb PreDelay = CC 9
• Reverb Decay Time = CC 10
• Reverb Damping = CC 11
• Reverb Diffusion = CC 12
• Reverb Level = CC 13
• Reverb Bypass = CC 14
• Surround Panner 1 X-axis = CC 15
• Surround Panner 1 Y-axis = CC 16
• Surround Panner 2 X-axis = CC 17
• Surround Panner 2 Y-axis = CC 18
• Surround Panner 3 X-axis = CC 19
• Surround Panner 3 Y-axis = CC 20
• Surround Panner 4 X-axis = CC 21
• Surround Panner 4 Y-axis = CC 22
• Aux 1 Fader/Output Level = CC 23
• Aux 1 Mute = CC 24
• Aux 2 Fader/Output Level = CC 25
• Aux 2 Mute = CC 26
• Aux 3 Fader/Output Level = CC 27
• Aux 3 Mute = CC 28


let misc_params = {
	"reverb-send-1": 1,
	"reverb-send-2": 2,
	"reverb-send-3": 3,
	"reverb-send-4": 4,
	"reverb-send-5": 5,
	"reverb-send-6": 6,
	"reverb-send-7": 7,
	"reverb-send-8": 8,
	"reverb-predelay": 9,
	"reverb-decay-time": 10,
	"reverb-damping": 11,
	"reverb-diffusion": 12,
	"reverb-level": 13,
	"reverb-bypass": 14,
	"surround-panner-1-x": 15,
	"surround-panner-1-y": 16,
	"surround-panner-2-x": 17,
	"surround-panner-2-y": 18,
	"surround-panner-3-x": 19,
	"surround-panner-3-y": 20,
	"surround-panner-4-x": 21,
	"surround-panner-4-y": 22,
	"aux-1-out": 23,
	"aux-1-mute": 24,
	"aux-2-out": 25,
	"aux-2-mute": 26,
	"aux-3-out": 27,
	"aux-3-mute": 28
}

// CHANGING PRESETS WITH PROGRAM CHANGE MESSAGES sent to any channel on  K-Mix Audio Control port
// Program Change : 0xCx; [C0,1] set preset 1

export { input_channel_params, main_output_bus_params, misc_params };

*//*
MIDIOutputMap {size: 3} Iterator {}
Input port : [ type:'output' id: 'output-1' manufacturer: 'Microsoft Corporation' name: '2- Audio Control' version: '10.0']
Input port : [ type:'output' id: 'output-2' manufacturer: 'Microsoft Corporation' name: '2- Expander' version: '10.0']
Input port : [ type:'output' id: 'output-3' manufacturer: 'Microsoft Corporation' name: '2- Control Surface' version: '10.0']

MIDIInputMap {size: 3} Iterator {}
Input port : [ type:'input' id: 'input-0' manufacturer: 'Microsoft Corporation' name: '2- Audio Control' version: '10.0']
Input port : [ type:'input' id: 'input-1' manufacturer: 'Microsoft Corporation' name: '2- Expander' version: '10.0']
Input port : [ type:'input' id: 'input-2' manufacturer: 'Microsoft Corporation' name: '2- Control Surface' version: '10.0']
*/

import MidiHardware from '../midi/MidiHardware';
import MidiHardwareDevice from '../midi/MidiHardwareDevice';

export default class KMix extends MidiHardwareDevice
{
  // Input port : [ type:'input' id: '3' manufacturer: 'Microsoft Corporation' name: '3- TB-3' version: '6.1']
  public static PORT_INPUT_EXPANDER:string = "2- Expander";
  public static PORT_INPUT_CONTROL_SURFACE:string = "2- Control Surface";
  public static PORT_INPUT_AUDIO_CONTROL:string = "2- Audio Control";
  public static NAME:string = "K-Mix";

  constructor()
  {
    super( KMix.NAME );

    this.addInput( "expander", {name:KMix.PORT_INPUT_EXPANDER} );
    this.addInput( "control", {name:KMix.PORT_INPUT_CONTROL_SURFACE} );
    this.addInput( "audio", {name:KMix.PORT_INPUT_AUDIO_CONTROL} );

    this.addOutput( "expander", {name:KMix.PORT_INPUT_EXPANDER} );
    this.addOutput( "control",{name:KMix.PORT_INPUT_CONTROL_SURFACE} );
    this.addOutput( "audio", {name:KMix.PORT_INPUT_AUDIO_CONTROL} );
    // .then((device)=>{
    //   console.error("All outputs connected :)");
    // });
  }

  // now do stuff :)
  protected onMidiMessage( alias:string, device:WebMidi.MIDIInput, event:WebMidi.MIDIMessageEvent ):void
  {

    switch( alias )
    {
      case "expander":
      case "control":
      case "audio":
          console.error("onMidiMessage",arguments);
          break;
      default:
        console.error("onMidiMessage unknown source",arguments);
    }
    super.onMidiMessage( alias, device, event );
  }

}
