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
import {MidiInstrumentCodes} from './audiobus/io/midi/MidiGeneralInstuments';

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
import Command from './audiobus/Command';
import ICommand from './audiobus/ICommand';

import NoteMatrix from './audiobus/NoteMatrix';
import VoiceFactory from './audiobus/VoiceFactory';

// Sythesis
import Instrument from './audiobus/instruments/Instrument';
import Oscillator from './audiobus/instruments/primitives/Oscillator';
import OscillatorTypes from './audiobus/instruments/OscillatorTypes';
import BassDrum from './audiobus/instruments/beats/BassDrum';
import PinkTrombone from './audiobus/instruments/wind/PinkTrombone';

import TB303WaveTable from './audiobus/instruments/TB303/TB303WaveTable';
import TB303 from './audiobus/instruments/TB303/TB303';
import TB303Config from './audiobus/instruments/TB303/TB303Config';

import Scales from './audiobus/scales/Scales';
import PitchDetect from './audiobus/analyse/PitchDetect';

// Visualisations...
import SpectrumAnalyzer from './audiobus/visualisation/SpectrumAnalyzer';
import Visualiser from './audiobus/visualisation/ExampleVisualiser';

// input methods...
// PC Keyboard...
import Keyboard from './audiobus/io/Keyboard';
import {KeyEvent} from './audiobus/io/Keyboard';

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
Engine.connect( mixer.output );


// audioContext:AudioContext, source:GainNode, type
const vis:Visualiser = new Visualiser( engine, mixer.output, SpectrumAnalyzer.TYPE_FREQUENCY, 1024 );
// append to document!
document.body.appendChild( vis.canvas );
vis.start();
vis.canvas.onmousedown =(e)=>{
  vis.next();
  console.error("vis canvas next!");
}

//const pink = new PinkTrombone( engine );

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
const tb3:TB3 = new TB3();
tb3.onMidi = ( alias:string, device:WebMidi.MIDIInput, event:WebMidi.MIDIMessageEvent ) => {
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

// Our Emulated 303...
let tb303Settings:TB303Config = new TB303Config();
let tb303:TB303 = new TB303( engine );
//Engine.connect( tb303.output );
//
// let tb303b:TB303 = new TB303( engine );
// Engine.connect( tb303b.output );
//
// let tb303c:TB303 = new TB303( engine );
// Engine.connect( tb303c.output );

// first load in our wave table =D
//TB303WaveTable.generate( sampleRate ).then((waves:Float32Array)=>{
//TB303WaveTable.fetch( "assets/images/wavetable.png" ).then((waves:Float32Array)=>{
// TB303WaveTable.fetch().then((waves:Float32Array)=>{
//
//     // begin!
//     tb303 = new TB303( engine );
//     // const bufferSize = 4096;
//     // const looper = engine.createScriptProcessor(bufferSize, 1, 1);
//     // looper.onaudioprocess = (e) => {
//     //   const output = e.outputBuffer.getChannelData(0);
//     //   for (var i = 0; i < bufferSize; ++i)
//     //   {
//     //     output[i] = tb303.render();
//     //   }
//     //   console.log("gah");
//     // }
//     // Engine.connect( looper );
//
//     //tb303.begin();
//     Engine.connect( tb303.output );
//
//
//
// });



//


// as you can set up your device to be on whatever midi channel you want...
// here we bind one to another!
const channels:Array<number> = [0];
const forceToChannel:number = 1; // my TB3 is expecting commands to channel 1
const sequencer:Sequencer = new Sequencer();
let sequencerIndex:number = 0;



let voiceFactory = new VoiceFactory( engine, 16 );

const playCommand = function( command:ICommand, forceToChannel:number=-1, wasPlaying:boolean=false, transpose:number=1 ):ICommand
{
  let instrument;
  const channel:number = forceToChannel > -1 ? forceToChannel : command.channel;
  //tb3.command( command, channel );

  // Get the port where the data comes out from...
  //let voice:Instrument = voiceFactory.fetchInstrument( Oscillator, Oscillator.NAME );
  // //console.log( voice, {hasStarted:oscillator.hasStarted,	hasFinished:oscillator.hasFinished} );
  //
  //
  // // connect if unconnected...
  //Engine.connect( voice.output );
  // mixer.connect( voice.output );
  const note:number = command.noteNumber + transpose*12;

  switch ( command.subtype )
  {
    case "noteOn":
     //const pitch:number = note - downFlag*12 + upFlag*12 + this.tuning;
     //const freq:number = Math.pow(2.0,(pitch-69)/12);

      const frequency:number = Scales.frequencyFromNoteNumber(note);
      const name:string = Scales.noteNameFromPitch(frequency);
      //kick.start( pitch-100, pitch );
      //oscillator.start( pitch );
      //voice.start( pitch );
      // notes!
      const accent:boolean = false; //Math.random() >= 0.5;//false;
      const slide:boolean = wasPlaying; //Math.random() >= 0.5;//false;
      const gate:boolean = false;
      const length:number= 100; // ms

      // create
      instrument = voiceFactory.noteOn( note, channel, TB303 );
      // set up instrument with our shared settings...
      instrument.config = tb303Settings;
      console.log( tb303Settings );

      // instrument.shape = tb303Settings.shape;              // 0 -> 1
      // instrument.resonance = tb303Settings.resonance;              // 0 -> 1
      // instrument.accent = tb303Settings.accent;              // 0 -> 1
      // instrument.threshold = tb303Settings.threshold;              // 0 -> 1  : softness
      // instrument.cutOff = tb303Settings.cutOff;                // 200 -> 20000
      // instrument.envelopeModulation = tb303Settings.envelopeModulation;    // 0 -> 1
      // instrument.tuning = tb303Settings.tuning;                // -12 -> 12
      //
      instrument && instrument.start( note, length,accent, slide, gate );
      mixer.connect( instrument.output );
      //Engine.connect( instrument.output );

      //tb303 && tb303.start( note, length,accent, slide, gate );
      // console.error("Playing note "+name+ " -> " +frequency+"Hz -> "+note);

      //tb3.command( command, channel );
      break;

    case"noteOff":
      //oscillator.stop();
      //kick.stop();
      //voice.stop();
      //tb303 && tb303.stop();
       instrument = voiceFactory.noteOff( note, channel, TB303 );
       instrument && instrument.stop();
      break;
  }
  return command;
}

//mergerNode = mixer.mux( oscillator.output, oscillator.output );
//mergerNode.connect( this.audioContext.destination );

// onKeyDown(){
//
//}

const playNextCommand = function( forceNoteOn:boolean=false ):Array<ICommand>
{
  let nextCommand:ICommand;
  let satisfied:boolean = false;  // only satisfied if a note on is available ;)
  // This should go in a loop somewhere...
  const nextCommands = sequencer.getCommandsAtIndex(sequencerIndex);
  // check to see if we have commands...
  if (nextCommands.length > 0)
  {
    // we have commands! execute them!
    nextCommands.forEach( (command:ICommand) => {
      // this could be a chord...
      // check their type to see if they are note on or note off etc...
      console.log(sequencerIndex+". nextCommand", command.subtype );

      // let us play the 303 :P
      let wasPlayingBefore = false;
      switch ( command.subtype )
      {
        case Command.COMMAND_NOTE_ON:
          // you can check to see if the status has changed...
          //const wasPlayingBefore:boolean = notes.noteOn( command.noteNumber );
          // loop
          satisfied = true;
          nextCommand = playCommand( command, command.channel, wasPlayingBefore );

          // if (!wasPlayingBefore)
          // {
          //   satisfied = true;
              // spawn new instrument and start playing here...
          // }
          break;

      case Command.COMMAND_NOTE_OFF:

      //  let's ignore note offs...
        //const wasStoppedBefore:boolean = notes.noteOff( command.noteNumber );
        //playCommand( command, forceToChannel, !wasPlayingBefore );

        // if you don't want note offs to be a seperate command...
        // flip this to false
          satisfied = forceNoteOn;
          // exit!
          break;

        case Command.COMMAND_PROGRAM_CHANGE:
          console.log("Patch Change", MidiInstrumentCodes[command.programNumber]);//
          break;

        default:
          console.log("Next Command");// MidiInstrumentCodes[command.programNumber]
      }



    })
    sequencerIndex += nextCommands.length;
    //
    // if we have a lot of note ons and note offs we should matrix them together...
    //console.log(sequencerIndex+". nextCommands",nextCommands);
    if (!satisfied)
    {
      // do it all again!
      // at least until there are no more commands...
      return playNextCommand();
    }
    return nextCommands;
  }
  // now loop and find the corresponding note off...
}



//
// Interface with MIDI or load a MIDI file
const midiFile:MidiFile = new MidiFile();
//const midilocation:string = "assets/midi/nyan-cat.mid";
//const midilocation:string = "assets/midi/banjos.mid";
//const midilocation:string = "assets/midi/funktown.mid";
const midilocation:string = "assets/midi/missionimpossible.mid";
//const midilocation:string = "assets/midi/midi-sans-frontieres.mid";
//const midilocation:string = "assets/midi/chopin-polishdance.mid";


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

        playCommand( command, channel, false )
      });
      // tb3.command( command, forceToChannel );
    };
    sequencer.start( 0.6 );



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





window.onfocus = function() {
  // pause timer...
  console.error("Tab focussed");
  sequencer.resume();
// }
//
// window.onblur = function() {
//   // resume timer
//   console.error("Tab lost focus");
//   sequencer.pause();
// }
//
// let keyDown:boolean =false;
//
// window.onkeydown = function(event){
//   //console.log("keydown",event);
//   if (keyDown)
//   {
//     return;
//   }
//   keyDown = true;
//   playNextCommand(false);
//
//
//     //location.href = "data:application/octet-stream," + encodeURIComponent(waves.toString());
//     //
//     // const tb303:TB303 = new TB303( waves, sampleRate );
//     // const bufferSize = 4096;
//     // const looper = engine.createScriptProcessor(bufferSize, 1, 1);
//     // looper.onaudioprocess = function(e)
//     // {
//     //     const output = e.outputBuffer.getChannelData(0);
//     //     for (var i = 0; i < bufferSize; ++i)
//     //     {
//     //       output[i] = tb303.render();
//     //     }
//     // }
//     // Engine.connect( looper );
//
//
// }
// window.onkeyup = function(event){
//   //console.log("keydown",event);
//   playNextCommand(true);
//   keyDown = false;

    //location.href = "data:application/octet-stream," + encodeURIComponent(waves.toString());
    //
    // const tb303:TB303 = new TB303( waves, sampleRate );
    // const bufferSize = 4096;
    // const looper = engine.createScriptProcessor(bufferSize, 1, 1);
    // looper.onaudioprocess = function(e)
    // {
    //     const output = e.outputBuffer.getChannelData(0);
    //     for (var i = 0; i < bufferSize; ++i)
    //     {
    //       output[i] = tb303.render();
    //     }
    // }
    // Engine.connect( looper );


}

// USER INTERACTION
const polyphonicData:object = {};
const keyboard:Keyboard = new Keyboard();
// now set up our event handler...

// for this exmple we want to watch for *all* keypressed...
// and use the command's noteOn to trigger start and the key up
// to turn note off for that specific note.
// se we fetch the key and tie in the keycode to a command...

keyboard.onKeyDown = (keyEvent:KeyEvent)=>{
  // chords?
  const commands:Array<ICommand> = playNextCommand();
  // store our command tied in to this key code...
  console.error(commands);
  polyphonicData[ keyEvent.keyCode ] = commands;

  //commands.forEach((command)=>{
    //check our matrix to see if this note is playing...
    //polyphonicData[ keyEvent.keyCode ] = command;
    //polyphonicData[ channel+'-'+noteNumber ] = command;
  //})
};

keyboard.onKeyUp = (keyEvent:KeyEvent)=>{

  //const command:ICommand = polyphonicData[ channel+'-'+noteNumber ];
  const commands:Array<ICommand> = polyphonicData[ keyEvent.keyCode ];
  commands.forEach((command)=>{
    // on key up, get the corresponding command and trigger note off...
    const noteOffClone:ICommand = command.clone();
    // change it to a note off...
    noteOffClone.subtype = Command.COMMAND_NOTE_OFF;
    console.error(noteOffClone);

    playCommand( noteOffClone );
  });
  //check our matrix to see if this note is playing...
  //polyphonicData[ channel+'-'+noteNumber ] = command;
  //polyphonicData[ event.keyCode ] = command;
};

// and watch for keypresses...
keyboard.enable();




let documentWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
let documentHeight = window.innerHeight || document.documentElement.clientHeight|| document.body.clientHeight;
let mouseDown:boolean = false;
window.onmousedown = ()=>{
  mouseDown = true;
}
window.onmouseup = ()=>{
  mouseDown = false;
}
window.onmousemove = function(event:MouseEvent){
  // get coords...
  if (mouseDown)
  {
    let x:number = event.pageX ;//- element.offsetLeft ;
    let y:number = event.pageY ;//- element.offsetTop;
    let percentageX:number = x/documentWidth;
    let percentageY:number = y/documentHeight;

    if (tb303)
    {
      tb303.resonance = percentageY;              // 0 -> 1
      tb303.accent = percentageX;              // 0 -> 1
      tb303.cutOff = percentageX * 20000;                // 200 -> 20000

    }
    // we should do something with the paramters...
    //tb303.shape = percentageX;              // 0 -> 1
    // tb303.resonance = percentageY;              // 0 -> 1
    // tb303.accent = percentageX;              // 0 -> 1
    //tb303.decay = percentageY*2000;                  // 100 -> 2000
    //tb303.threshold = percentageY;              // 0 -> 1  : softness
    //tb303.cutOff = percentageX * 20000;                // 200 -> 20000
    //tb303.envelopeModulation = percentageY;    // 0 -> 1
    // tb303.tuning = 0;                // -12 -> 12


    tb303Settings.shape = percentageX;              // 0 -> 1
    tb303Settings.resonance = percentageY;              // 0 -> 1
    // tb303Settings.accent = percentageX;              // 0 -> 1
    // tb303Settings.threshold = percentageY;              // 0 -> 1  : softness
    // tb303Settings.cutOff = percentageX * 20000;                // 200 -> 20000
    // tb303Settings.envelopeModulation = percentageY;    // 0 -> 1
    // tb303Settings.tuning = 0;                // -12 -> 12

    voiceFactory.voices.forEach( (voice)=>{
      const tb:TB303 = <TB303>voice;
      tb.config = tb303Settings;
    });
  }
}
