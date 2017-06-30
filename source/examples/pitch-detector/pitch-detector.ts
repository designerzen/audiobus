/*

Welcome to audioBUS v3 :D


*/

// Load in our audiobus library...

//import AudioBus from './audiobus/all';
import Engine from '../../code/typescript/audiobus/Engine';

// Microphone
import Microphone from '../../code/typescript/audiobus/io/Microphone';

// Timing
// import Timer from '../../code/typescript/audiobus/timing/Timer';
// import Metronome from '../../code/typescript/audiobus/timing/Metronome';
// import Netronome from '../../code/typescript/audiobus/timing/Netronome';

import Scales from '../../code/typescript/audiobus/scales/Scales';
import PitchDetect from '../../code/typescript/audiobus/analyse/PitchDetect';

// Our omnibus needs an engine
const engine:AudioContext = Engine.fetch();

if (!engine)
{
  // this is the end of sythesis my friend...
  // MIDI data will still work but no generative audio unfortunately
  // Upgrading your browser will fix this. Try Chromium or Firefox!
  throw Error("Browser does not support WebAudio. Try a newer browser.");
}


// Connect some hardware...
const pitchDetector:PitchDetect = new PitchDetect( engine );
const mic:Microphone = new Microphone( engine );
mic.fetch().then(
  (source)=>{
    // we got mic!
    // connect to speakers
    //Engine.connect( mic.output );
    //mixer.input = mic.output;
    pitchDetector.connect( mic.stream );

  },
  (error)=>{
    console.error(error);
  }
);

const toString = function():string
{
  const pitch:number = pitchDetector.getPitch();
  const note:number = Scales.noteFromPitch(pitch);
  const noteName:string = Scales.noteNameFromPitch(pitch);
  // const detune:number = Scales.centsOffFromPitch(pitch, Scales.noteFromPitch(pitch));
  // const flat:number = detune < 0;
  // const sharp:number = detune >= 0;
  return "Pitch:"+pitch + " Note:"+note+" "+noteName;
}
//
// const pitch:number = pitchDetector.getPitch();
// const note:number = Scales.noteFromPitch(pitch);
// const noteName:string = Scales.noteNameFromPitch(pitch);
// const detune:number = Scales.centsOffFromPitch(pitch, Scales.noteFromPitch(pitch));
// const flat:number = detune < 0;
// const sharp:number = detune >= 0;

window.onkeydown = function(event){
  console.log( toString() );

}

window.onfocus = function() {
  // pause timer...
  console.error("Tab focussed");

}

window.onblur = function() {
  // resume timer
  console.error("Tab lost focus");

}
