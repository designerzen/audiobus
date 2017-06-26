/*

<li class="drum" id="kick"></li>
<li class="drum" id="conga"></li>
<li class="drum" id="snare"></li>
<li class="drum" id="hihat"></li>

*/
import Instrument from 'audiobus/instruments/Instrument';
import BassDrum from 'audiobus/instruments/beats/BassDrum';
import Conga from 'audiobus/instruments/beats/Conga';
import CowBell from 'audiobus/instruments/beats/CowBell';

import HiHat from 'audiobus/instruments/beats/HiHat';
import Snare from 'audiobus/instruments/beats/Snare';
import Tom from 'audiobus/instruments/beats/Tom';

import Engine from 'audiobus/Engine';

// Our omnibus needs an engine
const context:AudioContext = Engine.fetch();

if (!context)
{
  // this is the end of sythesis my friend...
  // MIDI data will still work but no generative audio unfortunately
  // Upgrading your browser will fix this. Try Chromium or Firefox!
  throw Error("Browser does not support WebAudio. Try a newer browser.");
}

// instruments...
const kick:BassDrum = new BassDrum(context);
const hat:HiHat = new HiHat(context);
const snare:Snare = new Snare(context);
const conga:Conga = new Conga(context);
const cowbell:CowBell = new CowBell(context);
const tom:Tom = new Tom(context);

// user interface elements...
const elementKick = document.getElementById("kick");
const elementConga = document.getElementById("conga");
const elementSnare = document.getElementById("snare");
const elementHat = document.getElementById("hihat");

// connect our drums to either a mixer or the engine directly
Engine.connect( kick.output );
Engine.connect( hat.output );
Engine.connect( snare.output );
Engine.connect( conga.output );
Engine.connect( cowbell.output );
Engine.connect( tom.output );

// const pitch:number = Scales.frequencyFromNoteNumber(command.noteNumber);
// kick.start( pitch-100, pitch );

// // and watch for user presses...
// elementKick.onclick = (event)=>{
//   let x:number = event.pageX - elementKick.offsetLeft ;
//   let y:number = event.pageY - elementKick.offsetTop;
//   console.log("Kick clicked",x,y,event);
// }
//
// elementConga.onclick = (event)=>{
//   let x:number = event.pageX - elementConga.offsetLeft ;
//   let y:number = event.pageY - elementConga.offsetTop;
//   console.log("Conga clicked",x,y,event);
// }
// elementSnare.onclick = (event)=>{
//   let x:number = event.pageX - elementSnare.offsetLeft ;
//   let y:number = event.pageY - elementSnare.offsetTop;
//   console.log("Snare clicked",x,y,event);
// }
// elementHat.onclick = (event)=>{
//   let x:number = event.pageX - elementHat.offsetLeft ;
//   let y:number = event.pageY - elementHat.offsetTop;
//   console.log("Hat clicked",x,y,event);
// }

let documentWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

let documentHeight = window.innerHeight || document.documentElement.clientHeight|| document.body.clientHeight;

// or via a method...
const onButtonDown = function( element, instrument:Instrument )
{
  element.onclick = (event)=>{
    let x:number = event.pageX - element.offsetLeft ;
    let y:number = event.pageY - element.offsetTop;
    let percentageX:number = x/documentWidth;
    let percentageY:number = y/documentHeight;

    console.log(element.id,"clicked",100*percentageX>>0,100*percentageY>>0);
    // start relevant instrument...
    instrument.start();
  }
}

onButtonDown(elementKick, kick );
onButtonDown(elementConga, conga );
onButtonDown(elementSnare, snare );
onButtonDown(elementHat, hat );
