/// <reference path="../Dependencies.ts"/>
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Midi File
==============
Abstract    - Load a .midi file from a local server
Description - Buffers a .midi file into memory, parse the commands
Use         - Load( file.midi, onComplete ) and wait for the callback
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus.io
{
    export class MidiFile
    {
        public track:MidiTrack;

        constructor()
        {

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

        private loadBase64( file:string, completeCallback:Function ):void
        {
            var data = window.atob(file.split(',')[1]);
            var stream:MidiStream = new audiobus.io.MidiStream( data );
            var decoder:MidiDecoder = new audiobus.io.MidiDecoder();
            this.track = decoder.decode(stream);

            if (completeCallback) { completeCallback( this.track ); }
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
                        var data:string = this.convertResponse( fetch.responseText || '' );
                        var stream:MidiStream = new audiobus.io.MidiStream( data );
                        var decoder:MidiDecoder = new audiobus.io.MidiDecoder();
                        this.track = decoder.decode(stream);

                        if (completeCallback) { completeCallback( this.track ); }
                    } else {
                        onerror && onerror('Unable to load MIDI file');
                    }
                }
            };
            fetch.send();
        }

    }
}
