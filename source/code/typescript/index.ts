/*

Welcome to audioBUS v3 :D


*/

// Load in our audiobus library...

//import AudioBus from './audiobus/all';
import Engine from './audiobus/Engine';

// Volume related stuff
import Mixer from './audiobus/mixer/Mixer';

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

import NoteMatrix from './audiobus/NoteMatrix';
import VoiceFactory from './audiobus/VoiceFactory';

// Sythesis
import Instrument from './audiobus/instruments/Instrument';
import Oscillator from './audiobus/instruments/primitives/Oscillator';
import OscillatorTypes from './audiobus/instruments/OscillatorTypes';
import BassDrum from './audiobus/instruments/beats/BassDrum';

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

const mixer:Mixer = new Mixer( engine );
//Engine.connect( mixer.output );




// Make some sound! (engine here is optional but we provide it for future proofing)

//const instrument:Instrument = new Instrument( engine );   // generic instrument (makes no sound!)
//const oscillator:Oscillator = new Oscillator(engine);//OscillatorTypes.sine, engine ); //
//const kick:BassDrum = new BassDrum(engine);

// now connect it to our mixer...
//mixer.input = oscillator.output;

// connect directly to engine...
//Engine.connect( kick.output );
//Engine.connect( oscillator.output );
// or pipe through the mixer...
//mixer.connect( oscillator.output );
//mixer.connect( kick.output );


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


// Some MIDI Hardware to play with...
const tb303:TB3 = new TB3();
tb303.onMidi = ( alias:string, device:WebMidi.MIDIInput, event:WebMidi.MIDIMessageEvent ) => {
   //console.error("huzzah for a midi message has been received!", alias, device, event )
   // convert this event into a command!
   let command:MidiCommand = MidiCommandFactory.fromMidiEvent(event);
   // you can test to see if it is a tempo or volume event...

   // now play something!
   if (command.noteNumber > 0)
   {
     console.error(device.name ,"midi message has been received!",  alias, command );
   }
};

// as you can set up your device to be on whatever midi channel you want...
// here we bind one to another!
const channels:Array<number> = [0];
const forceToChannel:number = 1; // my TB3 is expecting commands to channel 1
const sequencer:Sequencer = new Sequencer();


let sequencerIndex:number = 0;
let notes:NoteMatrix = new NoteMatrix();


let voiceFactory = new VoiceFactory();

const playCommand = function( command:ICommand, channel?:number )
{
  tb303.command( command, channel );

  // Get the port where the data comes out from...
  let voice:Instrument = voiceFactory.fetchInstrument( Oscillator, Oscillator.NAME );
  // //console.log( voice, {hasStarted:oscillator.hasStarted,	hasFinished:oscillator.hasFinished} );
  //
  //
  // // connect if unconnected...
  //Engine.connect( voice.output );
  // mixer.connect( voice.output );

  switch ( command.subtype )
  {
    case "noteOn":
      const pitch:number = Scales.frequencyFromNoteNumber(command.noteNumber);
      //kick.start( pitch-100, pitch );
      //oscillator.start( pitch );
      voice.start( pitch );
      break;

    case"noteOff":
      //oscillator.stop();
      //kick.stop();
      voice.stop();
      break;
  }
}

//mergerNode = mixer.mux( oscillator.output, oscillator.output );
//mergerNode.connect( this.audioContext.destination );


const playNextCommand = function()
{
  let satisfied:boolean = false;  // only satisfied if a note on is available ;)
  // This should go in a loop somewhere...
  const nextCommands = sequencer.getCommandsAtIndex(sequencerIndex);
  // check to see if we have commands...
  if (nextCommands.length > 0)
  {
    // we have commands! execute them!
    nextCommands.forEach( (command:ICommand) => {

      // check their type to see if they are note on or note off etc...
      console.log(sequencerIndex+". nextCommand", command.subtype );

      switch ( command.subtype )
      {
        case "noteOn":
          // you can check to see if the status has changed...
          const wasPlayingBefore:boolean = notes.noteOn( command.noteNumber );
          // loop
          satisfied = true;
          // if (!wasPlayingBefore)
          // {
          //   satisfied = true;
              // spawn new instrument and start playing here...
          // }
          break;

      case"noteOff":

        const wasStoppedBefore:boolean = notes.noteOff( command.noteNumber );
        // exit!
        break;
      }

      playCommand( command, forceToChannel );

    })
    sequencerIndex += nextCommands.length;
    //
    // if we have a lot of note ons and note offs we should matrix them together...
    //console.log(sequencerIndex+". nextCommands",nextCommands);
    if (!satisfied)
    {
      // do it all again!
      // at least until there are no more commands...
      playNextCommand();
    }
  }
  // now loop and find the corresponding note off...
}



//
// Interface with MIDI or load a MIDI file
const midiFile:MidiFile = new MidiFile();
const midilocation:string = "assets/midi/funktown.mid";


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

    // now convert this midiTrack into a sequence
    // sequencer.add();
    sequencer.addTracks( track.tracks );
    sequencer.onEvent = (scope:Sequencer, command:ICommand, elapsed:number) => {
      //console.log("audioBUS:MIDI>ms elapsed", command);

      //const pitch:number = Scales.frequencyFromNoteNumber(command.noteNumber);
      //oscillator.start( pitch );

      // now send this out to the midi device & channel(s) specified! :)
      channels.forEach( (channel:number)=>{
        tb303.command( command, channel );
      });
      // tb303.command( command, forceToChannel );
    };
    //sequencer.start();



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

window.onkeydown = function(event){
  //console.log("keydown",event);
  playNextCommand();
}

window.onfocus = function() {
  // pause timer...
  console.error("Tab focussed");
  sequencer.resume();
}

window.onblur = function() {
  // resume timer
  console.error("Tab lost focus");
  sequencer.pause();
}
