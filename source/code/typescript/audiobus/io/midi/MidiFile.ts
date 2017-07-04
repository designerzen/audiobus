import MidiTrack from './MidiTrack';
import MidiStream from './MidiStream';
import MidiFileDecoder from './MidiFileDecoder';

/*//////////////////////////////////////////////////////////////////////////////

Midi File
==============
Abstract    - Load a .midi file from a local server or string
Description - Buffers a .midi file into memory, parses the commands
Use         - Load( file.midi, onComplete ) and wait for the callback
Methods     -
References -
  http://cs.fit.edu/~ryan/cse4051/projects/midi/midi.html

  https://www.cs.cmu.edu/~music/cmsip/readings/Standard-MIDI-file-format-updated.pdf

//////////////////////////////////////////////////////////////////////////////*/
export default class MidiFile
{
  constructor()
  {

  }

  // PUBLIC :
  // file can either be a file name as a string
  // or it can be a base64 encoded midi file
  public load( file:string ):Promise<MidiTrack>
  {
    // return new Promise<MidiTrack>((resolve, reject) => { resolve(this.track);  });
      if (file.indexOf('base64,') !== -1)
      {
  		    return this.loadBase64( file );
  	} else {
          return this.loadFile( file );
      }
  }

  // PUBLIC :
  public loadDataString( file:string ):Promise<MidiTrack>
  {
    const data:string = this.convertResponse( file );
    const stream:MidiStream = new MidiStream( data );
    const decoder:MidiFileDecoder = new MidiFileDecoder();
    const track = decoder.decode(stream);

    return new Promise<MidiTrack>((resolve, reject) => {
      resolve(track);
    });
  }

  // PUBLIC :
  private loadBase64( file:string ):Promise<MidiTrack>
  {
    const data = window.atob(file.split(',')[1]);
    const stream:MidiStream = new MidiStream( data );
    const decoder:MidiFileDecoder = new MidiFileDecoder();
    const track = decoder.decode(stream);

    return new Promise<MidiTrack>((resolve, reject) => {
      resolve(track);
    });
  }

  // PUBLIC :
  private loadFile( file:string ):Promise<MidiTrack>
  {
      return new Promise<MidiTrack>((resolve, reject) => {

        const fetch:XMLHttpRequest = new XMLHttpRequest();
        fetch.open('GET', file, true);
        fetch.overrideMimeType('text/plain; charset=x-user-defined');
        fetch.onreadystatechange = (e:ProgressEvent) =>
        {
          /*
          0: request not initialized
          1: server connection established
          2: request received
          3: processing request
          4: request finished and response is ready
          */
          if (fetch.readyState === 4)
          {
            if (fetch.status === 200)
            {
              const data:string = this.convertResponse( fetch.responseText || '' );
              const stream:MidiStream = new MidiStream( data );
              const decoder:MidiFileDecoder = new MidiFileDecoder();
              const track = decoder.decode(stream,file);

              resolve(track);

            } else {

              reject && reject('Unable to load MIDI file');
            }
          }
        };
        fetch.send();
      });

  }

  private convertResponse( data:string):string
  {
      var chars:Array<string> = [];
      var quantity:number = data.length;
      var scc = String.fromCharCode;
      for (var i:number = 0; i < quantity; ++i)
      {
          chars[i] = scc(data.charCodeAt(i) & 255);
      }
      return chars.join('');
  }
}
