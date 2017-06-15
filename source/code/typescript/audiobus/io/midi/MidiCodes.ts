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

export class MidiSystemCodes
{
  //0xF1 	Begin system exclusive message
  public static SYSTEM_EXCLUSIVE:number = 0xf0;
  //0xF1 	MIDI Time Code Quarter Frame (Sys Common)
  public static TIME_CODE_QUARTER_FRAME:number = 0xf1;
  //0xF2 	Song Position Pointer (Sys Common)
  public static SONG_POSITION_POINTER:number = 0xf2;
  //0xF3 	Song Select (Sys Common)
  public static SONG_SELECT:number = 0xf3;
  // ?
  public static UNKNOWN_4:number = 0xf4;
  public static UNKNOWN_5:number = 0xf5;
  //0xF6 	Tune Request (Sys Common)
  public static TUNE_REQUEST:number = 0xf6;
  //0xF7 	end of system exclusive message 	0
  public static END_OF_MESSAGE:number = 0xf7;
  // 0xF8 	Timing Clock (Sys Realtime)
  public static TIMING_CLOCK:number = 0xf8;
  // ?
  public static UNKNOWN_9:number = 0xf9;
  //0xFA 	Start (Sys Realtime)
  public static START:number = 0xfa;
  //0xFB 	Continue (Sys Realtime)
  public static CONTINUE:number = 0xfb;
  //0xFC 	Stop (Sys Realtime)
  public static STOP:number = 0xfc;
  // ?
  public static SYSTEM_UNKNOWN_D:number = 0xfd;
  //0xFE 	Active Sensing (Sys Realtime)
  public static ACTIVE_SENSING:number = 0xfe;
  //0xFF 	System Reset (Sys Realtime) activate!
  public static SYSTEM_RESET:number = 0xff;
}
