// Control Change
export const BANK_SELECT                      = 0x00
export const MODULATION_WHEEL                 = 0x01
export const BREATH_CONTROLLER                = 0x02
export const FOOT_CONTROLLER                  = 0x04
export const PORTAMENTO_TIME                  = 0x05
export const DATA_ENTRY_MSB                   = 0x06
export const CHANNEL_VOLUME                   = 0x07
export const BALANCE                          = 0x08
export const PAN                              = 0x0a
export const EXPRESSION_CONTROLLER            = 0x0b
export const EFFECT_CONTROL_1                 = 0x0c
export const EFFECT_CONTROL_2                 = 0x0d
export const GENERAL_PURPOSE_CONTROLLER_1     = 0x10
export const GENERAL_PURPOSE_CONTROLLER_2     = 0x11
export const GENERAL_PURPOSE_CONTROLLER_3     = 0x12
export const GENERAL_PURPOSE_CONTROLLER_4     = 0x13
export const BANK_SELECT_LSB                  = 0x20
export const MODULATION_WHEEL_LSB             = 0x21
export const BREATH_CONTROLLER_LSB            = 0x22
export const FOOT_CONTROLLER_LSB              = 0x24
export const PORTAMENTO_TIME_LSB              = 0x25
export const DATA_ENTRY_LSB                   = 0x26
export const CHANNEL_VOLUME_LSB               = 0x27
export const BALANCE_LSB                      = 0x28
export const PAN_LSB                          = 0x2a
export const EXPRESSION_CONTROLLER_LSB        = 0x2b
export const EFFECT_CONTROL_1_LSB             = 0x2c
export const EFFECT_CONTROL_2_LSB             = 0x2d
export const GENERAL_PURPOSE_CONTROLLER_1_LSB = 0x30
export const GENERAL_PURPOSE_CONTROLLER_2_LSB = 0x31
export const GENERAL_PURPOSE_CONTROLLER_3_LSB = 0x32
export const GENERAL_PURPOSE_CONTROLLER_4_LSB = 0x33
export const PORTAMENTO_ON_OFF                = 0x41
export const SOSTENUTO_ON_OFF                 = 0x42
export const SOFT_PEDAL_ON_OFF                = 0x43
export const LEGATO_FOOTSWITCH                = 0x44
export const HOLD                             = 0x45
export const SOUND_CONTROLLER_1               = 0x46
export const SOUND_CONTROLLER_2               = 0x47
export const SOUND_CONTROLLER_3               = 0x48
export const SOUND_CONTROLLER_4               = 0x49
export const SOUND_CONTROLLER_5               = 0x4a
export const SOUND_CONTROLLER_6               = 0x4b
export const SOUND_CONTROLLER_7               = 0x4c
export const SOUND_CONTROLLER_8               = 0x4d
export const SOUND_CONTROLLER_9               = 0x4e
export const SOUND_CONTROLLER_10              = 0x4f
export const GENERAL_PURPOSE_CONTROLLER_5     = 0x50
export const GENERAL_PURPOSE_CONTROLLER_6     = 0x51
export const GENERAL_PURPOSE_CONTROLLER_7     = 0x52
export const GENERAL_PURPOSE_CONTROLLER_8     = 0x53
export const PORTAMENTO_CONTROL               = 0x54
export const HIGH_RESOLUTION_VELOCITY_PREFIX  = 0x58


export const NOTE_OFF              = 0x80
export const NOTE_ON               = 0x90
export const POLYPHONIC_AFTERTOUCH = 0xa0
export const CONTROL_CHANGE        = 0xb0
export const PROGRAM_CHANGE        = 0xc0
export const CHANNEL_AFTERTOUCH    = 0xd0
export const PITCH_WHEEL           = 0xe0

/*
 * Note Off event.
 * This message is sent when a note is released (ended).
 */
export const NOTE_OFF_CH1  = 0x80
export const NOTE_OFF_CH2  = 0x81
export const NOTE_OFF_CH3  = 0x82
export const NOTE_OFF_CH4  = 0x83
export const NOTE_OFF_CH5  = 0x84
export const NOTE_OFF_CH6  = 0x85
export const NOTE_OFF_CH7  = 0x86
export const NOTE_OFF_CH8  = 0x87
export const NOTE_OFF_CH9  = 0x88
export const NOTE_OFF_CH10 = 0x89
export const NOTE_OFF_CH11 = 0x8a
export const NOTE_OFF_CH12 = 0x8b
export const NOTE_OFF_CH13 = 0x8c
export const NOTE_OFF_CH14 = 0x8d
export const NOTE_OFF_CH15 = 0x8e
export const NOTE_OFF_CH16 = 0x8f

/*
 * Note On event.
 * This message is sent when a note is depressed (start).
 */
export const NOTE_ON_CH1  = 0x90
export const NOTE_ON_CH2  = 0x91
export const NOTE_ON_CH3  = 0x92
export const NOTE_ON_CH4  = 0x93
export const NOTE_ON_CH5  = 0x94
export const NOTE_ON_CH6  = 0x95
export const NOTE_ON_CH7  = 0x96
export const NOTE_ON_CH8  = 0x97
export const NOTE_ON_CH9  = 0x98
export const NOTE_ON_CH10 = 0x99
export const NOTE_ON_CH11 = 0x9a
export const NOTE_ON_CH12 = 0x9b
export const NOTE_ON_CH13 = 0x9c
export const NOTE_ON_CH14 = 0x9d
export const NOTE_ON_CH15 = 0x9e
export const NOTE_ON_CH16 = 0x9f

/*
 * Polyphonic Key Pressure (Aftertouch).
 * This message is most often sent by pressing down on the key after it
 * "bottoms out".
 */
export const POLYPHONIC_AFTERTOUCH_CH1  = 0xa0
export const POLYPHONIC_AFTERTOUCH_CH2  = 0xa1
export const POLYPHONIC_AFTERTOUCH_CH3  = 0xa2
export const POLYPHONIC_AFTERTOUCH_CH4  = 0xa3
export const POLYPHONIC_AFTERTOUCH_CH5  = 0xa4
export const POLYPHONIC_AFTERTOUCH_CH6  = 0xa5
export const POLYPHONIC_AFTERTOUCH_CH7  = 0xa6
export const POLYPHONIC_AFTERTOUCH_CH8  = 0xa7
export const POLYPHONIC_AFTERTOUCH_CH9  = 0xa8
export const POLYPHONIC_AFTERTOUCH_CH10 = 0xa9
export const POLYPHONIC_AFTERTOUCH_CH11 = 0xaa
export const POLYPHONIC_AFTERTOUCH_CH12 = 0xab
export const POLYPHONIC_AFTERTOUCH_CH13 = 0xac
export const POLYPHONIC_AFTERTOUCH_CH14 = 0xad
export const POLYPHONIC_AFTERTOUCH_CH15 = 0xae
export const POLYPHONIC_AFTERTOUCH_CH16 = 0xaf

/*
 * Control Change.
 * This message is sent when a controller value changes. Controllers include
 * devices such as pedals and levers. Controller numbers 120-127 are
 * reserved as "Channel Mode Messages".
 */
export const CONTROL_CHANGE_CH1  = 0xb0
export const CONTROL_CHANGE_CH2  = 0xb1
export const CONTROL_CHANGE_CH3  = 0xb2
export const CONTROL_CHANGE_CH4  = 0xb3
export const CONTROL_CHANGE_CH5  = 0xb4
export const CONTROL_CHANGE_CH6  = 0xb5
export const CONTROL_CHANGE_CH7  = 0xb6
export const CONTROL_CHANGE_CH8  = 0xb7
export const CONTROL_CHANGE_CH9  = 0xb8
export const CONTROL_CHANGE_CH10 = 0xb9
export const CONTROL_CHANGE_CH11 = 0xba
export const CONTROL_CHANGE_CH12 = 0xbb
export const CONTROL_CHANGE_CH13 = 0xbc
export const CONTROL_CHANGE_CH14 = 0xbd
export const CONTROL_CHANGE_CH15 = 0xbe
export const CONTROL_CHANGE_CH16 = 0xbf

/*
 * Program Change.
 * This message sent when the patch number changes.
 */
export const PROGRAM_CHANGE_CH1  = 0xc0
export const PROGRAM_CHANGE_CH2  = 0xc1
export const PROGRAM_CHANGE_CH3  = 0xc2
export const PROGRAM_CHANGE_CH4  = 0xc3
export const PROGRAM_CHANGE_CH5  = 0xc4
export const PROGRAM_CHANGE_CH6  = 0xc5
export const PROGRAM_CHANGE_CH7  = 0xc6
export const PROGRAM_CHANGE_CH8  = 0xc7
export const PROGRAM_CHANGE_CH9  = 0xc8
export const PROGRAM_CHANGE_CH10 = 0xc9
export const PROGRAM_CHANGE_CH11 = 0xca
export const PROGRAM_CHANGE_CH12 = 0xcb
export const PROGRAM_CHANGE_CH13 = 0xcc
export const PROGRAM_CHANGE_CH14 = 0xcd
export const PROGRAM_CHANGE_CH15 = 0xce
export const PROGRAM_CHANGE_CH16 = 0xcf

/*
 * Channel Pressure (After-touch).
 * This message is most often sent by pressing down on the key after it
 * "bottoms out". This message is different from polyphonic after-touch. Use
 * this message to send the single greatest pressure value (of all the
 * current depressed keys).
 */
export const CHANNEL_AFTERTOUCH_CH1  = 0xd0
export const CHANNEL_AFTERTOUCH_CH2  = 0xd1
export const CHANNEL_AFTERTOUCH_CH3  = 0xd2
export const CHANNEL_AFTERTOUCH_CH4  = 0xd3
export const CHANNEL_AFTERTOUCH_CH5  = 0xd4
export const CHANNEL_AFTERTOUCH_CH6  = 0xd5
export const CHANNEL_AFTERTOUCH_CH7  = 0xd6
export const CHANNEL_AFTERTOUCH_CH8  = 0xd7
export const CHANNEL_AFTERTOUCH_CH9  = 0xd8
export const CHANNEL_AFTERTOUCH_CH10 = 0xd9
export const CHANNEL_AFTERTOUCH_CH11 = 0xda
export const CHANNEL_AFTERTOUCH_CH12 = 0xdb
export const CHANNEL_AFTERTOUCH_CH13 = 0xdc
export const CHANNEL_AFTERTOUCH_CH14 = 0xdd
export const CHANNEL_AFTERTOUCH_CH15 = 0xde
export const CHANNEL_AFTERTOUCH_CH16 = 0xdf

/*
 * Pitch Bend Change.
 * This message is sent to indicate a change in the pitch bender (wheel or
 * lever typically). The pitch bender is measured by a fourteen bit value.
 * Center (no pitch change) is 2000H.
 */
export const PITCH_WHEEL_CH1  = 0xe0
export const PITCH_WHEEL_CH2  = 0xe1
export const PITCH_WHEEL_CH3  = 0xe2
export const PITCH_WHEEL_CH4  = 0xe3
export const PITCH_WHEEL_CH5  = 0xe4
export const PITCH_WHEEL_CH6  = 0xe5
export const PITCH_WHEEL_CH7  = 0xe6
export const PITCH_WHEEL_CH8  = 0xe7
export const PITCH_WHEEL_CH9  = 0xe8
export const PITCH_WHEEL_CH10 = 0xe9
export const PITCH_WHEEL_CH11 = 0xea
export const PITCH_WHEEL_CH12 = 0xeb
export const PITCH_WHEEL_CH13 = 0xec
export const PITCH_WHEEL_CH14 = 0xed
export const PITCH_WHEEL_CH15 = 0xee
export const PITCH_WHEEL_CH16 = 0xef