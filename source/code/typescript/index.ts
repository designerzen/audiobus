/*

Welcome to audioBUS v3 :D


*/

// firstly import any styles relevent to this component...
//import Styles from '../../assets/styles/style.less';
// import Index from '../../markup/index.pug';

// Load in our audiobus library...
//import AudioBus from './audiobus/all';
import Engine from './audiobus/Engine';

// Volume related stuff
import Mixer from './audiobus/mixer/Mixer';

// MIDI stuff
import MidiFile from './audiobus/io/midi/MidiFile';
import MidiTrack from './audiobus/io/midi/MidiTrack';
import MidiHardware from './audiobus/io/midi/MidiHardware';
import MidiCommand from './audiobus/io/midi/MidiCommand';

import Microphone from './audiobus/io/Microphone';

//
import Timer from './audiobus/timing/Timer';
import Metronome from './audiobus/timing/Metronome';
import Netronome from './audiobus/timing/Netronome';
import Sequencer from './audiobus/sequencing/Sequencer';

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



// Make some sound! (engine here is optional but we provide it for future proofing)

const instrument:Instrument = new Instrument( engine );   // generic instrument (makes no sound!)

const oscillator:Oscillator = new Oscillator( );//OscillatorTypes.sine, engine ); //

// now we have our instances, we can set the noteOn or noteOff command just like
// in MIDI :D there are also other cool ways to interface with each instrument.

// oscillator.command( command );
// oscillator.noteOn( command );
// oscillator.noteOff( command );


// Connect some hardware...
const mic:Microphone = new Microphone( engine );

// const pitchDetector:PitchDetect = new PitchDetect();
// pitchDetector.connect();
// const pitch:number = pitchDetector.getPitch();

// const note:number = Scales.noteFromPitch(pitch);
// const noteName:string = Scales.noteNameFromPitch(pitch);
// const detune:number = Scales.centsOffFromPitch(pitch, Scales.noteNumberFromPitch(pitch));
// const flat:number = detune < 0;
// const sharp:number = detune >= 0;




const mixer:Mixer = new Mixer();


// Start a rythmn
const metronome:Metronome = new Metronome();
const netronome:Netronome = new Netronome();



console.log("Welcome to audioBUS Framework v3.0.0");



netronome.beat = ( scope:Timer, startTime:number, time:number ) => {
  let elapsed:number = time - startTime;
  console.log("audioBUS:Netronome>Beat",startTime, time, elapsed);
};
//netronome.start( 90 );


metronome.beat = (scope:Timer, startTime:number, time:number) => {
  let elapsed:number = time - startTime;
  console.log("audioBUS:Metronome>Beat",startTime, time, elapsed);
};
//metronome.start( 180 );



// Interface with MIDI or load a MIDI file
const midiFile:MidiFile = new MidiFile();
const midilocation:string = "assets/midi/chopin-polishdance.mid";
const midiHardware:MidiHardware = new MidiHardware();

midiHardware.connect().then(
  (success) =>{
    console.log("Midi hardware located :)", success );
  },
  (error) =>{
    console.error(error);
  }
);

midiFile.load( midilocation ).then( (track:MidiTrack)=>{

  console.log("Midi file loaded :)", track );

  // do something with the midi file like send it to the sequencer
  const sequencer:Sequencer = new Sequencer();
  // now convert this midiTrack into a sequence
  // sequencer.add();
  sequencer.addTracks( track.tracks );
  //sequencer.start();


  // const timer:Timer = new Timer();
  // timer.ms = (scope:Timer, startTime:number, time:number) =>{
  //   let elapsed:number = ( time - startTime) >> 0;  // stupid floating points...
  //   //console.log("audioBUS:Timer>ms",startTime, time);
  //   //console.log("audioBUS:Timer>ms elapsed",elapsed);
  // };
  // timer.start();

});



// now we can start the engine :)

// at any time...
//mixer.mute();
//mixer.volume = 1;
//mixer.solo();
