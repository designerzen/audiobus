/*

TB-3

MIDI codes from :
http://de-bug.de/musiktechnik/freeware-max-for-live-patches-fur-aira-tb-3-und-aira-tr-8/

74, Cutoff
71, Resonance
16, Accent
17, Effect
12, ENV
13, MOD
11, X
1,Y

tips :
  hold “PTN SELECT” *+ power on (under the hood mode)
  hold “DEPTH (scatter)” + turn “Scatter Wheel”
  you can choose of 6 color sets no. 2 is dimmed original
  hit “START/STOP” to save

MIDIOutputMap {size: 3} Iterator {}
Input port : [ type:'output' id: 'output-1' manufacturer: 'Microsoft Corporation' name: '2- Audio Control' version: '10.0']
Input port : [ type:'output' id: 'output-2' manufacturer: 'Microsoft Corporation' name: '2- Expander' version: '10.0']
Input port : [ type:'output' id: 'output-3' manufacturer: 'Microsoft Corporation' name: '2- Control Surface' version: '10.0']

MIDIInputMap {size: 3} Iterator {}
Input port : [ type:'input' id: 'input-0' manufacturer: 'Microsoft Corporation' name: '2- Audio Control' version: '10.0']
Input port : [ type:'input' id: 'input-1' manufacturer: 'Microsoft Corporation' name: '2- Expander' version: '10.0']
Input port : [ type:'input' id: 'input-2' manufacturer: 'Microsoft Corporation' name: '2- Control Surface' version: '10.0']
*/

import MidiCommandFactory from '../midi/MidiCommandFactory';
import MidiHardware from '../midi/MidiHardware';
import MidiHardwareDevice from '../midi/MidiHardwareDevice';
import MidiStream from '../midi/MidiStream';

import {MidiEventCodes,MidiSystemCodes,MidiMetaCodes} from '../midi/MidiCodes';

export default class TB3 extends MidiHardwareDevice
{
  // Input port : [ type:'input' id: '3' manufacturer: 'Microsoft Corporation' name: '3- TB-3' version: '6.1']
  public static PORT_TYPE_INPUT:string = "TB-3";
  public static PORT_TYPE_CONTROL:string = "TB-3 CTRL";
  public static NAME:string = "Roland TB-3";

  constructor()
  {
    super( TB3.NAME );

    this.addInput( TB3.PORT_TYPE_INPUT, {name:TB3.PORT_TYPE_INPUT} ).then((device)=>{
       console.error( this.name + ":All inputs connected :)");
     });
    this.addInput( TB3.PORT_TYPE_CONTROL, {name:TB3.PORT_TYPE_CONTROL} ).then((device)=>{
       console.error( this.name + ":All inputs connected :)");
     });

    this.addOutput( TB3.PORT_TYPE_INPUT, {name:TB3.PORT_TYPE_INPUT} ).then((device)=>{
       console.error( this.name + ":All outputs connected :)");
     });
    this.addOutput( TB3.PORT_TYPE_CONTROL, {name:TB3.PORT_TYPE_CONTROL} ).then((device)=>{
       console.error( this.name + ":All outputs connected :)");
     });
  }

private decodeTB3( data:Uint8Array )
{
  // MIDI Implementation for the TB3 only...
  // MidiEventCodes.SYSTEM_EXCLUSIVE
  let command = MidiCommandFactory.create(data);

  const commandByte:number = data[0];
  const type = commandByte & 0xf0; // channel agnostic message type. Thanks, Phil Burk.

  switch( commandByte )
  {
    case MidiEventCodes.SYSTEM_EXCLUSIVE:
      console.error("TB£ system exclsuive command...");
      break;
    default:
    //console.error("TB3 command", commandByte);
  }
}

  // now do stuff :)
  protected onMidiMessage( alias:string, device:WebMidi.MIDIInput, event:WebMidi.MIDIMessageEvent ):void
  {
    //new MidiStream( event.data );
    this.decodeTB3( event.data );

    switch( alias )
    {
      case TB3.PORT_TYPE_INPUT:
      case TB3.PORT_TYPE_CONTROL:
          //console.error("TB3 - onMidiMessage",arguments);

          break;
      default:
        //console.error("TB3 - onMidiMessage unknown source",event.data);
    }
    //console.log(alias + ':', 'cmd:0x'+event.data[0].toString(16), event.timeStamp,event.data );
    super.onMidiMessage( alias, device, event );
  }

}
