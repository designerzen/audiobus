// Would be nice to have an ENUM version of this at some point...
// Typescript hasn't allowed it up until now...
export class MidiMetaCodes
{
  public static SEQUENCE_NUMBER:number = 0x00;
  public static TEXT:number = 0x01;
  public static COPYRIGHT_NOTICE:number = 0x02;
  public static TRACK_NAME:number = 0x03;
  public static INSTRUMENT_NAME:number = 0x04;
  public static LYRICS:number = 0x05;
  public static MARKER:number = 0x06;
  public static CUE_POINT:number = 0x07;

  // unsure of these codes...
  // could be system exclusive

  public static MIDI_CHANNEL_PREFIX:number = 0x20;

  public static END_OF_TRACK:number = 0x2f;

  public static SET_TEMPO:number = 0x51;

  public static SMPTE_OFFSET:number = 0x54;

  public static TIME_SIGNATURE:number = 0x58;
  public static KEY_SIGNATURE:number = 0x59;

  public static SEQUENCER_SPECIFIC:number = 0x7f;
}




export class MidiEventCodes
{
  public static NOTE_OFF:number = 0x08;
  public static NOTE_ON:number = 0x09;
  public static NOTE_AFTER_TOUCH:number = 0x0a;
  public static CONTROLLER:number = 0x0b;

  // the same but refered to using different language
  public static PROGRAM_CHANGE:number = 0x0c;
  public static PATCH_CHANGE:number = 0x0c;

  public static CHANNEL_AFTER_TOUCH:number = 0x0d;
  public static PITCH_BEND:number = 0x0e;
  public static SYSTEM_EXCLUSIVE:number = 0x0f;
}

// send out codes!
// Use these along with the a control command to tell your MIDI device
// What to do!
// eg. to set the volume at a point in the track...
// send controller code + channel, cue point code, requested volume
// [MidiCommandCodes.CONTROLLER + channel, MidiCommandCodes.CUE_POINT, volume], now
export class MidiCommandCodes
{
  public static CUE_POINT:number = 0x70;
  public static NOTE_OFF:number = 0x80;
  public static NOTE_ON:number = 0x90;
  public static NOTE_AFTER_TOUCH:number = 0x0a;
  public static CONTROLLER:number = 0xB0;

  // the same but refered to using different language
  public static PROGRAM_CHANGE:number = 0xC0;
  public static PATCH_CHANGE:number = 0xC0;

  public static CHANNEL_AFTER_TOUCH:number = 0x0d;
  public static PITCH_BEND:number = 0xE0;
  public static SYSTEM_EXCLUSIVE:number = 0xF0;
  public static STOP_ALL:number = 0x7B;
}
// [MidiCommandCodes.CONTROLLER + channel, MidiCommandCodes.CUE_POINT, volume], now
export class MidiChannelMessages
{
  // 7
  public static CUE_POINT:number = 0x7;
  // 8
  public static NOTE_OFF:number = 0x8;
  // 9
  public static NOTE_ON:number = 0x9;
  // 10
  public static NOTE_AFTER_TOUCH:number = 0xa;
  // 11
  public static CONTROLLER:number = 0xB;
  // the same but refered to using different language
  public static PROGRAM_CHANGE:number = 0xc;
  // 12
  public static PATCH_CHANGE:number = 0xc;
  public static CHANNEL_MODE:number = 0xc;
  public static CONTROL_CHANGE:number = 0xc;
  // 13
  public static CHANNEL_AFTER_TOUCH:number = 0xd;
  // 14
  public static PITCH_BEND:number = 0xE;
}

/////////////////////////////////////////////////////////
// Correct as of WebMIDI 2 :)
/////////////////////////////////////////////////////////
export class MidiSystemCodes
{
  // 240 : 0xF1 	Begin system exclusive message
  public static SYSTEM_EXCLUSIVE:number = 0xf0;
  // 241 : 0xF1 	MIDI Time Code Quarter Frame (Sys Common)
  public static TIME_CODE_QUARTER_FRAME:number = 0xf1;
  // 242 : 0xF2 	Song Position Pointer (Sys Common)
  public static SONG_POSITION_POINTER:number = 0xf2;
  // 243 : 0xF3 	Song Select (Sys Common)
  public static SONG_SELECT:number = 0xf3;

  // ?
  // public static UNKNOWN_4:number = 0xf4;
  // public static UNKNOWN_5:number = 0xf5;

  // 246 : 0xF6 	Tune Request (Sys Common)
  public static TUNE_REQUEST:number = 0xf6;
  // 247 : 0xF7 end of system exclusive message
  // NB. this just ends a system exclusive message and is never actually received
  public static END_OF_MESSAGE:number = 0xf7;
  // 248 : 0xF8 	Timing Clock (Sys Realtime)
  public static TIMING_CLOCK:number = 0xf8;

  // ?
  //public static UNKNOWN_9:number = 0xf9;

  // 250 : 0xFA 	Start (Sys Realtime)
  public static START:number = 0xfa;
  // 251 : 0xFB 	Continue (Sys Realtime)
  public static CONTINUE:number = 0xfb;
  // 252 : 0xFC 	Stop (Sys Realtime)
  public static STOP:number = 0xfc;
  // ?
  public static SYSTEM_UNKNOWN_D:number = 0xfd;
  // 254 : 0xFE 	Active Sensing (Sys Realtime)
  public static ACTIVE_SENSING:number = 0xfe;
  // 255 : 0xFF 	System Reset (Sys Realtime) activate!
  public static SYSTEM_RESET:number = 0xff;
}
