/// <reference path="../Dependencies.ts"/>
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Midi File
==============
Abstract    - Load and decode a .midi file from a server
Description - Buffers a .midi file into memory, parse the commands
Use         - Load( file.midi, onComplete ) and wait for the callback
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus.io
{
    export class MidiFile
    {
        public id:string = undefined;

        public onmidiconnected:Function = function(message:MidiMessage){};
        public onmididisconnected:Function = function(message:MidiMessage){};
        public onmidimessage:Function = function(message:MidiMessage){};

        constructor(  )
        {
        }

        private loadBase64( file:string, completeCallback:Function ):void
        {
            var data = window.atob(file.split(',')[1]);
            //midi.currentData = data;
            //midi.loadMidiFile(onsuccess, onprogress, onerror);
        }

        private loadFile( file:string, completeCallback:Function ):void
        {
            var fetch:XMLHttpRequest = new XMLHttpRequest();
            fetch.open('GET', file, true);
            fetch.overrideMimeType('text/plain; charset=x-user-defined');
            fetch.onreadystatechange = (e:ProgressEvent) => {
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
                        var t:string = fetch.responseText || '';
                        var ff = [];
                        var mx:number = t.length;
                        var scc = String.fromCharCode;
                        for (var z = 0; z < mx; z++)
                        {
                            ff[z] = scc(t.charCodeAt(z) & 255);
                        }
                        ///
                        var data:string = ff.join('');


                        var stream = new audiobus.io.MidiStream( data );
                        var decoder = new audiobus.io.MidiDecoder( stream );


                        //console.log( ff );
                        //midi.currentData = data;
                        //midi.loadMidiFile(onsuccess, onprogress, onerror);
                        if (completeCallback) { completeCallback( ff ); }
                    } else {
                        onerror && onerror('Unable to load MIDI file');
                    }
                }
            };
            fetch.send();
        }

        // file can either be a file name as a string
        // or it can be a base64 encoded midi file
        public load( file:string, completeCallback:Function ):void
        {
            if (file.indexOf('base64,') !== -1)
            {
        		this.loadBase64( file, completeCallback );
        	} else {
                this.loadFile( file, completeCallback );
            }
        }

    }
}