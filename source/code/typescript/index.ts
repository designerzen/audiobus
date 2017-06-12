/*

Welcome to audioBUS v3 :D


*/

// firstly import any styles relevent to this component...
//import Styles from '../../assets/styles/style.less';
// import Index from '../../markup/index.pug';

// Load in our audiobus library...
//import AudioBus from './audiobus/all';
import Engine from './audiobus/Engine';
import Mixer from './audiobus/mixer/Mixer';
import MidiFile from './audiobus/io/midi/MidiFile';

//const engine:AudioContext = Engine.fetch();
const mixer:Mixer = new Mixer();

const midiFile:MidiFile = new MidiFile();
const midilocation:string = "assets/midi/chopin-polishdance.mid";

console.log("Welcome to audioBUS Framework v3.0.0");
midiFile.load( midilocation ).then((track)=>{
  // do something with the midi file like send it to the sequencer
  console.log("Midi file loaded :)", track);
});

// now we can start the engine :)

// at any time...
//mixer.mute();
//mixer.volume = 1;
//mixer.solo();
