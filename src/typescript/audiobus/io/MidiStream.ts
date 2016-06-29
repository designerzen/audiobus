/// <reference path="../Dependencies.ts"/>
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Midi File
==============
Abstract    - Load and decode a .midi file from a server
Description - Buffers a .midi file into memory, parse the commands
Use         - Load( file.midi, onComplete ) and wait for the callback
Methods     -
Forked from - https://github.com/gasman/jasmid/blob/master/stream.js#L2
//////////////////////////////////////////////////////////////////////////////*/
module audiobus.io
{
    export class MidiStream
    {
        private position:number = 0;
        private str:string;

        constructor(str:string)
        {
            this.str = str;
        }

        // Data management
    	public read(length:number):string
        {
    		var result:string = this.str.substr(this.position, length);
    		this.position += length;
    		return result;
    	}

    	// read a big-endian 32-bit integer
    	public readInt32():number
        {
    		var result = (
    			(this.str.charCodeAt(this.position) << 24)
    			+ (this.str.charCodeAt(this.position + 1) << 16)
    			+ (this.str.charCodeAt(this.position + 2) << 8)
    			+ this.str.charCodeAt(this.position + 3));
    		this.position += 4;
    		return result;
    	}

    	// Read a big-endian 16-bit integer
    	public readInt16():number
        {
    		var result = (
    			(this.str.charCodeAt(this.position) << 8)
    			+ this.str.charCodeAt(this.position + 1));
    		this.position += 2;
    		return result;
    	}

    	// read an 8-bit integer
    	public readInt8(signed:boolean=false):number
        {
    		var result = this.str.charCodeAt(this.position);
    		if (signed && result > 127)
            {
                result -= 256;
            }
    		this.position += 1;
    		return result;
    	}

    	public eof():boolean
        {
    		return this.position >= this.str.length;
    	}

    	/* read a MIDI-style variable-length integer
    		(big-endian value in groups of 7 bits,
    		with top bit set to signify that another byte follows)
    	*/
    	public readVarInt():number
        {
    		var result:number = 0;
    		while (true)
            {
    			var b:number = this.readInt8(false);
    			if (b & 0x80)
                {
    				result += (b & 0x7f);
    				result <<= 7;
    			} else {

    				return result + b; // b is the last byte
    			}
    		}
        }
    }
}