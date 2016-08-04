/// <reference path="../Dependencies.ts"/>
/// <reference path="./MidiCommand.ts"/>
/// <reference path="./MidiTrack.ts"/>
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Midi File
==============
Abstract    - Load and decode a .midi file from a server
Description - Buffers a .midi file into memory, parse the commands
Use         - Load( file.midi, onComplete ) and wait for the callback
Methods     -
Forked from - https://github.com/gasman/jasmid/blob/master/stream.js#L2
References  - http://www.indiana.edu/~emusic/etext/MIDI/chapter3_MIDI3.shtml

Channel Voice
    Control the instrument's 16 voices (timbres, patches), plays notes, sends
    controller data, etc.

Channel Mode
    Define instrument's response to Voice messages, sent over instrument's
    'basic' channel

System Common
    Messages intended to all networked instruments and devices

System Real-Time
    Intended for all networked instruments and devices. Contain only status
    bytes and is used for syncronization of all devices. essentially a timing
    clock

System Exclusive
    Originally used for manufacturer-specific codes, such as editor/librarians,
    has been expanded to include MIDI Time Code, MIDI Sample Dump Standard and
    MIDI Machine Control

//////////////////////////////////////////////////////////////////////////////*/
module audiobus.io
{
    export class MidiChunk
    {
        public id:string;
        public length:number;
        public data:string;
    }

    export class MidiDecoder
    {
        private lastEventTypeByte:number;

        constructor()
        {
        }

        private readChunk(stream:MidiStream):MidiChunk
        {
            var chunk:MidiChunk = new MidiChunk();
    		chunk.id = stream.read(4);    // Each midi event message is 4 bytes big...
    		chunk.length = stream.readInt32();
            chunk.data = stream.read(chunk.length);
    		return chunk;
        }

        public decode( stream:MidiStream ):MidiTrack
        {
            var header:MidiHeader = this.decodeHeader( stream );
            var track:MidiTrack = new MidiTrack( header );
            return this.decodeTracks( track, stream );
        }

        private decodeHeader( stream:MidiStream ):MidiHeader
        {
            var headerChunk:MidiChunk = this.readChunk(stream);
            if (headerChunk.id !== 'MThd' || headerChunk.length !== 6)
            {
                throw "Bad .mid file - header not found";
            }

            var headerStream:MidiStream = new MidiStream(headerChunk.data);
            var formatType = headerStream.readInt16();
            var trackCount = headerStream.readInt16();
            var timeDivision = headerStream.readInt16();

                // console.error(stream, headerChunk, headerStream, formatType, trackCount, timeDivision);

            if (timeDivision & 0x8000)
            {
                throw "Expressing time division in SMTPE frames is not supported yet";
            }

            var header:MidiHeader = new MidiHeader();
            header.formatType = formatType;
            header.trackCount = trackCount;
            header.ticksPerBeat = timeDivision;
            // console.log(header);
            return header;
        }

        private decodeTracks( track:MidiTrack, stream:MidiStream ):MidiTrack
        {
            var tracks:Array<MidiCommand> = new Array();
            var quantity:number = track.header.trackCount;
            for (var i = 0; i < quantity; i++)
            {
                //tracks[i] = [];
                var trackChunk = this.readChunk(stream);
                if (trackChunk.id !== 'MTrk')
                {
                    throw "Unexpected chunk - expected MTrk, got "+ trackChunk.id;
                }
                var trackStream:MidiStream = new MidiStream(trackChunk.data);
                while (!trackStream.eof())
                {
                    var event:MidiCommand = this.readEvent(trackStream);
                    //tracks[i].push(event);
                    track.addEvent(i,event);
                    console.log(event);
                }
            }
            return track;
        }


        public readEvent(stream:MidiStream):MidiCommand
        {
    		var event:MidiCommand = new MidiCommand();
            var time:number = stream.readVarInt();
    		var eventTypeByte:number = stream.readInt8();

            event.deltaTime = time;

    		if ((eventTypeByte & 0xf0) === 0xf0)
            {
                return this.decodeSystemEvent( stream, event, eventTypeByte);

    		} else {

                return this.decodeChannelEvent( stream, event, eventTypeByte);
    		}
    	}

        private decodeSystemEvent( stream:MidiStream, event:MidiCommand, eventTypeByte:number ):MidiCommand
        {
            // system / meta event
            if (eventTypeByte === 0xff)
            {
                // meta event
                event.type =  MidiCommand.TYPE_META;
                var subtypeByte:number = stream.readInt8();
                var length:number = stream.readVarInt();

                switch(subtypeByte)
                {
                    case 0x00:
                        event.subtype = 'sequenceNumber';
                        if (length !== 2) { throw "Expected length for sequenceNumber event is 2, got " + length;}
                        event.sequenceNumber = stream.readInt16();
                        return event;

                    case 0x01:
                        event.subtype = 'text';
                        event.text = stream.read(length);
                        return event;

                    case 0x02:
                        event.subtype = 'copyrightNotice';
                        event.text = stream.read(length);
                        return event;

                    case 0x03:
                        event.subtype = 'trackName';
                        event.text = stream.read(length);
                        return event;

                    case 0x04:
                        event.subtype = 'instrumentName';
                        event.text = stream.read(length);
                        return event;

                    case 0x05:
                        event.subtype = 'lyrics';
                        event.text = stream.read(length);
                        return event;

                    case 0x06:
                        event.subtype = 'marker';
                        event.text = stream.read(length);
                        return event;

                    case 0x07:
                        event.subtype = 'cuePoint';
                        event.text = stream.read(length);
                        return event;

                    case 0x20:
                        event.subtype = 'midiChannelPrefix';
                        if (length !== 1){ throw "Expected length for midiChannelPrefix event is 1, got " + length;}
                        event.channel = stream.readInt8();
                        return event;

                    case 0x2f:
                        event.subtype = 'endOfTrack';
                        if (length !== 0) { throw "Expected length for endOfTrack event is 0, got " + length;}
                        return event;

                    case 0x51:
                        event.subtype = 'setTempo';
                        if (length !== 3) { throw "Expected length for setTempo event is 3, got " + length;}
                        event.microsecondsPerBeat = (
                            (stream.readInt8() << 16)
                            + (stream.readInt8() << 8)
                            + stream.readInt8()
                        );
                        return event;

                    case 0x54:
                        event.subtype = 'smpteOffset';
                        if (length !== 5) { throw "Expected length for smpteOffset event is 5, got " + length;}
                        var hourByte:number = stream.readInt8();

                        // magic
                        event.frameRate = {
                            0x00: 24, 0x20: 25, 0x40: 29, 0x60: 30
                        }[hourByte & 0x60];
                        console.error( event.frameRate );

                        event.hour = hourByte & 0x1f;
                        event.min = stream.readInt8();
                        event.sec = stream.readInt8();
                        event.frame = stream.readInt8();
                        event.subframe = stream.readInt8();
                        return event;

                    case 0x58:
                        event.subtype = 'timeSignature';
                        if (length !== 4){ throw "Expected length for timeSignature event is 4, got " + length;}
                        event.numerator = stream.readInt8();
                        event.denominator = Math.pow(2, stream.readInt8());
                        event.metronome = stream.readInt8();
                        event.thirtyseconds = stream.readInt8();
                        return event;

                    case 0x59:
                        event.subtype = 'keySignature';
                        if (length !== 2){ throw "Expected length for keySignature event is 2, got " + length;}
                        event.key = stream.readInt8(true);
                        event.scale = stream.readInt8();
                        return event;

                    case 0x7f:
                        event.subtype = 'sequencerSpecific';
                        event.data = stream.read(length);
                        return event;

                    default:
                        // console.log("Unrecognised meta event subtype: " + subtypeByte);
                        event.subtype = 'unknown';
                        event.data = stream.read(length);
                        return event;
                }

            } else if (eventTypeByte === 0xf0) {

                event.type = MidiCommand.TYPE_SYSTEM_EXCLUSIVE;
                var length = stream.readVarInt();
                event.data = stream.read(length);
                return event;

            } else if (eventTypeByte === 0xf7) {

                event.type = MidiCommand.TYPE_DIVIDED_SYSTEM_EXCLUSIVE;
                var length = stream.readVarInt();
                event.data = stream.read(length);
                return event;

            } else {

                throw "Unrecognised MIDI event type byte: " + eventTypeByte;
            }
        }

        // Channel Voice
        // Control the instrument's 16 voices (timbres, patches),
        // plays notes, sends controller data, etc.
        private decodeChannelEvent(stream:MidiStream, event:MidiCommand, eventTypeByte:number ):MidiCommand
        {
            var param1:number;

            if ((eventTypeByte & 0x80) === 0)
            {
                /* running status - reuse lastEventTypeByte as the event type.
                    eventTypeByte is actually the first parameter
                */
                param1 = eventTypeByte;
                eventTypeByte = this.lastEventTypeByte;
            } else {
                param1 = stream.readInt8();
                this.lastEventTypeByte = eventTypeByte;
            }

            var eventType = eventTypeByte >> 4;
            event.channel = eventTypeByte & 0x0f;
            event.type = MidiCommand.TYPE_CHANNEL;

            switch (eventType)
            {
                case 0x08:
                    event.subtype = MidiCommand.COMMAND_NOTE_OFF;//'noteOff';
                    event.noteNumber = param1;
                    event.velocity = stream.readInt8();
                    return event;

                case 0x09:
                    event.noteNumber = param1;
                    event.velocity = stream.readInt8();
                    if (event.velocity === 0)
                    {
                        event.subtype =  MidiCommand.COMMAND_NOTE_OFF;
                    } else {
                        event.subtype = MidiCommand.COMMAND_NOTE_ON;//'noteOn';
                    }
                    return event;

                case 0x0a:
                    event.subtype = MidiCommand.COMMAND_NOTE_AFTER_TOUCH;//'noteAftertouch';
                    event.noteNumber = param1;
                    event.amount = stream.readInt8();
                    return event;

                case 0x0b:
                    event.subtype = MidiCommand.COMMAND_CONTROLLER;//'controller';
                    event.controllerType = param1;
                    event.value = stream.readInt8();
                    return event;

                case 0x0c:
                    event.subtype = MidiCommand.COMMAND_PROGRAM_CHANGE;//'programChange';
                    event.programNumber = param1;
                    return event;

                case 0x0d:
                    event.subtype = MidiCommand.COMMAND_CHANNEL_AFTER_TOUCH;//'channelAftertouch';
                    event.amount = param1;
                    return event;

                case 0x0e:
                    event.subtype = MidiCommand.COMMAND_PITCH_BEND;//'pitchBend';
                    event.value = param1 + (stream.readInt8() << 7);
                    return event;

                default:
                    throw "Unrecognised MIDI event type: " + eventType;
                    /*
                    console.log("Unrecognised MIDI event type: " + eventType);
                    stream.readInt8();
                    event.subtype = 'unknown';
                    return event;
                    */
            }
        }

    }
}