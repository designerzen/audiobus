/*

AudioBus : Example

================================================================================

// insert date...

*/
// Load in our parts of the audiobus library...
import Engine from 'audiobus/Engine';   // * Required
import ICommand from 'audiobus/ICommand';   // * Required
import MidiFile from 'audiobus/io/midi/MidiFile';
import MidiTrack from 'audiobus/io/midi/MidiTrack';
import MidiHardware from 'audiobus/io/midi/MidiHardware';
import MidiHardwareDevice from 'audiobus/io/midi/MidiHardwareDevice';
import MidiCommand from 'audiobus/io/midi/MidiCommand';
import MidiCommandFactory from 'audiobus/io/midi/MidiCommandFactory';
import {MidiInstrumentCodes} from 'audiobus/io/midi/MidiGeneralInstuments';

import TB303 from 'audiobus/instruments/TB303/TB303';
import TB303Config from 'audiobus/instruments/TB303/TB303Config';

import Scales from 'audiobus/scales/Scales';

// // select a midi file
// // Check for the various File API support.
// if (window.File && window.FileReader && window.FileList && window.Blob) {
//   // Great success! All the File APIs are supported.
// } else {
//   alert('The File APIs are not fully supported in this browser.');
// }

// Firstly fetch the DOM elements relevent to this example...
const progressBar = document.getElementById('progress_bar');
const fileSelector = document.getElementById('files');
const fileList = document.getElementById('list');
const dropZone = document.getElementById('drop_zone');
const cancelButton = document.getElementById('cancel');
const midiCommandList = document.getElementById('midi');

const engine:AudioContext = Engine.fetch();

const tb303Settings:TB303Config = new TB303Config();
const tb303:TB303 = new TB303( engine );

Engine.connect( tb303.output );

let reader:FileReader;


const playCommand = function( command:ICommand, forceToChannel:number=-1, transpose:number=2 ):ICommand
{
  const channel:number = forceToChannel > -1 ? forceToChannel : command.channel;

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
      const slide:boolean = true; //Math.random() >= 0.5;//false;
      const gate:boolean = false;
      const length:number= 100; // ms

      // create
      // set up instrument with our shared settings...
      //tb303.config = tb303Settings;
      console.log( tb303Settings );

      // instrument.shape = tb303Settings.shape;              // 0 -> 1
      // instrument.resonance = tb303Settings.resonance;              // 0 -> 1
      // instrument.accent = tb303Settings.accent;              // 0 -> 1
      // instrument.threshold = tb303Settings.threshold;              // 0 -> 1  : softness
      // instrument.cutOff = tb303Settings.cutOff;                // 200 -> 20000
      // instrument.envelopeModulation = tb303Settings.envelopeModulation;    // 0 -> 1
      // instrument.tuning = tb303Settings.tuning;                // -12 -> 12
      //
      tb303 && tb303.start( note, length,accent, slide, gate );
      break;

    case"noteOff":
       tb303 && tb303.stop();
      break;
  }
  return command;
}


const playNote = function( channel:number, noteNumber:number )
{
  console.log("Playing note",channel,noteNumber);
}

const displayTrack = function( track:MidiTrack )
{
  // loopp through tracks
  const heaeder:string = track.fileName;
  const commands:Array<ICommand> = track.tracks;
    // public trackName:string = "";
    // public meta:string = "";
    // public copyrightNotice:string = "";
    // public lyrics:string = "";
    // public bpm:number = 120;  // default from MIDI spec
    // public timeSignature:Array<number> = [4,4];  // default from MIDI spec


  var output:Array<string> = [];
  for (let i = 0, f; f = commands[i]; i++)
  {
    //track.getCommandsAtPosition();
    const frequency:number = Scales.frequencyFromNoteNumber(f.noteNumber);
    const noteName:string = Scales.noteNameFromPitch(frequency);
    switch ( f.subtype )
    {
      case "noteOn":
        const elementString:string = '<li class="note note-'+f.noteNumber+ ' channel-'+f.channel+ ' type-'+f.subtype+'" data-note="'+i+'">';
        // elementString += '</li>';
        // create element and add click handler...
        output.push(elementString ,f.channel+'',' <strong>',  f.type,'</strong> - ', f.subtype ,  ' #',noteName, ' / '+f.noteNumber, ' @', f.deltaTime , '</li>');
        break;
    }

  }
  midiCommandList.innerHTML = '<ul class="midi-file">' + output.join('') + '</ul>';

  // now create click handlers to these links...
  const lists = document.querySelector(".midi-file");
  const notes = lists.getElementsByTagName('li');
  for (let i = 0; i < notes.length; i++)
  {
    var note = notes[i];
    //note.onclick = (e)=>{
    note.onmouseover = (scope:HTMLElement, e:MouseEvent )=>{
      const element:HTMLElement = e.target;
      const note = element.getAttribute('data-note');
      const command =  commands[note];

      // now find any command with matching timecodes....

      // extract data from position...
      //const p;
      console.log(note+ " NOTE >>> ",element, command);
      // now make some sound!
      if (command){
        playCommand(command);
      }
      return 0;
    };
  }
}

const loadMidiFile = function( location )
{
  const midiFile:MidiFile = new MidiFile();
  //midiFile.load( location ).then(
  midiFile.loadDataString( location ).then(
    (track:MidiTrack)=>{

      console.log("Midi file loaded :)", track );
      // display midi track...
      displayTrack(track);
    },
    (error:string) =>{
      console.error(error);
    }
  );
}

const loadFile = function( target )
{
  // Reset progress indicator on new file selection.
  progressBar.style.width = '0%';
  progressBar.textContent = '0%';

  reader = new FileReader();

  reader.onerror = (e:ErrorEvent)=>
  {
    switch(e.target.error.code)
    {
      case e.target.error.NOT_FOUND_ERR:
        alert('File Not Found!');
        break;

      case e.target.error.NOT_READABLE_ERR:
        alert('File is not readable');
        break;

      case e.target.error.ABORT_ERR:
        break; // noop

      default:
        alert('An error occurred reading this file.');
    }
  }

  reader.onprogress = (e)=>
  {
    if (e.lengthComputable)
    {
      const percentLoaded = Math.round((e.loaded / e.total) * 100);
      // Increase the progress bar length.
      if (percentLoaded < 100)
      {
        progressBar.style.width = percentLoaded + '%';
        progressBar.textContent = percentLoaded + '%';
      }
    }
  };

  reader.onabort = (e) => {
    alert('File read cancelled');
  };

  reader.onloadstart = (e)=>
  {
    progressBar.className = 'loading';
  };

  reader.onload = (e) =>
  {
    // Ensure that the progress bar displays 100% at the end.
    progressBar.style.width = '100%';
    progressBar.textContent = '100%';
    progressBar.className = "complete";
    //setTimeout("progressBar.className='';", 2000);
    loadMidiFile(e.currentTarget.result);
  };


  // FileReader includes four options for reading a file, asynchronously:
  //
  //   FileReader.readAsBinaryString(Blob|File) - The result property will contain the file/blob's data as a binary string. Every byte is represented by an integer in the range [0..255].
  //   FileReader.readAsText(Blob|File, opt_encoding) - The result property will contain the file/blob's data as a text string. By default the string is decoded as 'UTF-8'. Use the optional encoding parameter can specify a different format.
  //   FileReader.readAsDataURL(Blob|File) - The result property will contain the file/blob's data encoded as a data URL.
  //   FileReader.readAsArrayBuffer(Blob|File) - The result property will contain the file/blob's data as an ArrayBuffer object.
  // Read in the image file as a binary string.
  reader.readAsBinaryString( target );
  //reader.readAsText( target, '' );
  //
  // Read in the image file as a data URL.
  //reader.readAsDataURL( target );
  //console.log(target.name);
  progressBar.className = "active";
  dropZone.className = "hidden";
};


const abortRead = function():void
{
  reader.abort();
};



const displayList = function (files: FileList):string[]
{
  const output:string[] = [];
  for (let i:number = 0, f:File; f = files[i]; i++)
  {
    output.push('<li><strong>', encodeURI(f.name), '</strong> (', f.type || 'n/a', ') - ',
                f.size + ' bytes, last modified: ',
                f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a',
                '</li>');
  }
  fileList.innerHTML = '<ul>' + output.join('') + '</ul>';

  return output;
};

const handleDrop = function (evt: any): void
{
  evt.stopPropagation();
  evt.preventDefault();

  const files:FileList = evt.dataTransfer.files; // FileList object.

  // files is a FileList of File objects. List some properties.
  displayList(files);
  loadFile( files[0] );
};

const handleDragOver = function (evt: any): void
{
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
};

const handleFileSelect = function(evt:any):void
{
  const files:FileList = evt.target.files; // FileList object
  const output = [];
  displayList(files);
  loadFile( files[0] );
};

// watch for a user interacting with the selector
fileSelector.addEventListener('change', handleFileSelect, false);
dropZone.addEventListener('dragover', handleDragOver, false);
dropZone.addEventListener('drop', handleDrop, false);
cancelButton.addEventListener('click', abortRead, false);
