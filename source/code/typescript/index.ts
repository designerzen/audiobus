/*

Welcome to audioBUS v3 :D


*/

// Load in our audiobus library...

//import AudioBus from './audiobus/all';
import Engine from './audiobus/Engine';

// Volume related stuff
//import Mixer from './audiobus/mixer/Mixer';

// Hardware IO
// MIDI stuff
import MidiFile from './audiobus/io/midi/MidiFile';
import MidiTrack from './audiobus/io/midi/MidiTrack';
import MidiHardware from './audiobus/io/midi/MidiHardware';
import MidiHardwareDevice from './audiobus/io/midi/MidiHardwareDevice';
import MidiCommand from './audiobus/io/midi/MidiCommand';
import MidiCommandFactory from './audiobus/io/midi/MidiCommandFactory';

// Some actual physical peripherals...
import KMix from './audiobus/io/devices/KMix';
import TB3 from './audiobus/io/devices/TB3';

// Microphone
import Microphone from './audiobus/io/Microphone';

// Timing
import Timer from './audiobus/timing/Timer';
import Metronome from './audiobus/timing/Metronome';
import Netronome from './audiobus/timing/Netronome';
import Sequencer from './audiobus/sequencing/Sequencer';
import ICommand from './audiobus/ICommand';

// Sythesis
import Instrument from './audiobus/instruments/Instrument';
import Oscillator from './audiobus/instruments/primitives/Oscillator';
import OscillatorTypes from './audiobus/instruments/OscillatorTypes';
import Scales from './audiobus/scales/Scales';
import PitchDetect from './audiobus/analyse/PitchDetect';




// Our omnibus needs an engine
const engine:AudioContext = Engine.fetch();

if (!engine)
{
  // this is the end of sythesis my friend...
  // MIDI data will still work but no generative audio unfortunately
  // Upgrading your browser will fix this. Try Chromium or Firefox!
  throw Error("Browser does not support WebAudio. Try a newer browser.");
}

// If our app has more than one audio source, we are also going to need a mixer...

//const mixer:Mixer = new Mixer();
//Engine.connect( mixer.output );



// Make some sound! (engine here is optional but we provide it for future proofing)

//const instrument:Instrument = new Instrument( engine );   // generic instrument (makes no sound!)

const oscillator:Oscillator = new Oscillator(undefined);//OscillatorTypes.sine, engine ); //

// connect directly to engine...
Engine.connect( oscillator.output );
// now connect it to our mixer...
//mixer.input = oscillator.output;

// make some noise!
//const playing :boolean = oscillator.start( 440 );
//console.log(playing, oscillator);
// now we have our instances, we can set the noteOn or noteOff command just like
// in MIDI :D there are also other cool ways to interface with each instrument.

// oscillator.command( command );
// oscillator.noteOn( command );
// oscillator.noteOff( command );


// Connect some hardware...
//const mic:Microphone = new Microphone( engine );
// mic.fetch().then(
//   (stream)=>{
//     // we got mic!
//     // connect to speakers
//     //Engine.connect( mic.output );
//     //mixer.input = mic.output;
//   },
//   (error)=>{
//     console.error(error);
//   }
// );

// const pitchDetector:PitchDetect = new PitchDetect( engine );
// pitchDetector.connect();
// const pitch:number = pitchDetector.getPitch();

// const note:number = Scales.noteFromPitch(pitch);
// const noteName:string = Scales.noteNameFromPitch(pitch);
// const detune:number = Scales.centsOffFromPitch(pitch, Scales.noteNumberFromPitch(pitch));
// const flat:number = detune < 0;
// const sharp:number = detune >= 0;





// Start a rythmn
const netronome:Netronome = new Netronome();



console.log("Welcome to audioBUS Framework v3.0.0");



netronome.beat = ( scope:Timer, startTime:number, time:number ) => {
  let elapsed:number = time - startTime;
  // 24000 is the max limit!
  //const pitch:number = Scales.randomNote();
  console.log("audioBUS:Netronome>Beat #", startTime, time, elapsed);

};
//netronome.start( 90 );
//
//
// const metronome:Metronome = new Metronome();
// metronome.beat = (scope:Timer, startTime:number, time:number) => {
//   let elapsed:number = time - startTime;
//   console.log("audioBUS:Metronome>Beat",startTime, time, elapsed);
// };
// //metronome.start( 180 );


//
// Interface with MIDI or load a MIDI file
const midiFile:MidiFile = new MidiFile();
const midilocation:string = "assets/midi/funkytown.mid";


//
midiFile.load( midilocation ).then(
  (track:MidiTrack)=>{

    console.log("Midi file loaded :)", track );

    // Now connect the sequence to our MIDI hardware!
    const midiHardware:MidiHardware = new MidiHardware();
    midiHardware.establish().then((midi)=>{

       console.log("MidiHardware is now available..." );

       const outputs = midi.getOutputs();
       // so we want to connect to the output from the MIDI device
       // in order to be able to read MIDI data as it comes in...

       const inputs = midi.getInputs();
       // and we are also going to want to connect to some input...


      console.error( midiHardware.getInputs() );
      console.error( midiHardware.getOutputs() );

    });

    const midiDevice:KMix = new KMix();
    midiDevice.onMidi = ( alias:string, device:WebMidi.MIDIInput, event:WebMidi.MIDIMessageEvent ) => {
       console.error("huzzah for a midi message has been received!", alias, device, event )
    };

    const tb303:TB3 = new TB3();
    tb303.onMidi = ( alias:string, device:WebMidi.MIDIInput, event:WebMidi.MIDIMessageEvent ) => {
       //console.error("huzzah for a midi message has been received!", alias, device, event )
       // convert this event into a command!
       let command:MidiCommand = MidiCommandFactory.fromMidiEvent(event);
       // now play something!
       //console.error(device.name ,"midi message has been received!",  alias, command )
    };

    //const midiDevice:MidiHardwareDevice = new MidiHardwareDevice();
    //
    // midiDevice.addInput( "expander", {name:'2- Expander'} );
    // midiDevice.addInput( "control", {name:'2- Control Surface'} );
    // midiDevice.addInput( "audio", {name:'2- Audio Control'} );
    //
    // midiDevice.addOutput( "expander", {name:'2- Expander'} );
    // midiDevice.addOutput( "control",{name:'2- Control Surface'} );
    // midiDevice.addOutput( "audio", {name:'2- Audio Control'} ).then((device)=>{
    //   console.error("All outputs connected :)");
    // });
    //
    // midiDevice.onMidi = ( alias:string, device:WebMidi.MIDIInput, event:WebMidi.MIDIMessageEvent ) => {
    //   console.error("huzzah for a midi message has been received!", alias, device, event )
    // };

    // now we can do fun stuff like listen to midi events...

    // or send commands to the device if it contains inputs!



    // {id, manufacturer, name, version}
    // midiHardware.getInputDevice( {name:'2- Expander'} ).then(
    //   // success!
    //   (device:WebMidi.MIDIInput)=>{
    //     device.onmidimessage = (event:WebMidi.MIDIMessageEvent)=>{
    //       const command:MidiCommand = MidiCommandFactory.create( event.data);
    //       console.log("Midi message received...",device, event, command);
    //
    //     }
    //     console.log("Midi input device located",device);
    //   },
    //   // failure
    //   (error)=>{
    //     console.error("Midi input device not found");
    //   }
    // );
    // //
    // midiHardware.getInputDevice( {name:'2- Control Surface'} ).then(
    //   // success!
    //   (device:WebMidi.MIDIInput)=>{
    //     device.onmidimessage = (event:WebMidi.MIDIMessageEvent)=>{
    //       const command:MidiCommand = MidiCommandFactory.create( event.data);
    //       console.log("Midi message received...",device, event, command);
    //
    //     }
    //     console.log("Midi input device located",device);
    //   },
    //   // failure
    //   (error)=>{
    //     console.error("Midi input device not found");
    //   }
    // );
    //
    // midiHardware.getInputDevice( {name:'2- Control Surface'} ).then(
    //   // success!
    //   (device:WebMidi.MIDIInput)=>{
    //     device.onmidimessage = (event:WebMidi.MIDIMessageEvent)=>{
    //       const command:MidiCommand = MidiCommandFactory.create( event.data);
    //       console.log("Midi message received...",device, event, command);
    //
    //     }
    //     console.log("Midi input device located",device);
    //   },
    //   // failure
    //   (error)=>{
    //     console.error("Midi input device not found");
    //   }
    // );
    //
    // // Get devices to output to
    // midiHardware.getOutputDevice( {name:'2- Audio Control'} ).then(
    //   // success!
    //   (device:WebMidi.MIDIOutput)=>{
    //     console.error("Midi output device located",device);
    //     // send it some data!
    //   },
    //   // failure
    //   (error)=>{
    //     console.error("Midi output device not found");
    //   }
    // );


       // now we have midi access, check for available harwarde..
     //});
    // midiHardware.connect().then(
    //   (success) =>{
    //     console.log("Midi hardware located :)", success );
    //     // pass in some notes!
    //   },
    //   (error) =>{
    //     console.error(error);
    //   }
    // );

    // do something with the midi file like send it to the sequencer

    // as you can set up your device to be on whatever midi channel you want...
    // here we bind one to another!
    const channels:Array<number> = [0];
    const forceToChannel:number = 1; // my TB3 is expecting commands to channel 1
    const sequencer:Sequencer = new Sequencer();
    // now convert this midiTrack into a sequence
    // sequencer.add();
    sequencer.addTracks( track.tracks );
    sequencer.onEvent = (scope:Sequencer, event:ICommand, elapsed:number) => {
      //console.log("audioBUS:MIDI>ms elapsed", event);

      //const pitch:number = Scales.frequencyFromNoteNumber(event.noteNumber);
      //oscillator.start( pitch );

      // now send this out to the midi device & channel(s) specified! :)
      channels.forEach( (channel:number)=>{
        tb303.command( event, channel );
      });
      // tb303.command( event, forceToChannel-1 );
    };
    sequencer.start();



    // oscillator.start( pitch );

    // const timer:Timer = new Timer();
    // timer.ms = (scope:Timer, startTime:number, time:number) =>{
    //   let elapsed:number = ( time - startTime) >> 0;  // stupid floating points...
    //   //console.log("audioBUS:Timer>ms",startTime, time);
    //   //console.log("audioBUS:Timer>ms elapsed",elapsed);
    // };
    // timer.start();

  },
  (error:string) =>{
    console.error(error);
  }
);



// now we can start the engine :)

// at any time...
//mixer.mute();
//mixer.volume = 1;
//mixer.solo();
