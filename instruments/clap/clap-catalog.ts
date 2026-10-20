import type { CLAPPatch } from './clap-types'

export const CLAP_PATCHES: CLAPPatch[] = [
    {
        "id": "uk.co.signalsmith-audio.plugins.example-synth",
        "name": "C++ Example Synth",
        "author": "Signalsmith Audio",
        "description": "Play a polyphonic stereo synthesizer with controls for the sound envelope and note behaviour.",
        "url": "/webclap/plugins/example-plugins.wclap.tar.gz",
        "factory": "uk.co.signalsmith-audio.plugins.example-synth",
        "features": [
            "instrument",
            "stereo"
        ],
        "category": "Synthesizers",
        "title": "C++ Example Synth — Signalsmith Audio WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "Signalsmith Audio",
            "sourceUrl": "https://github.com/WebCLAP/examples/tree/main/signalsmith-clap-cpp",
            "license": "BSL-1.0",
            "licenseUrls": [
                "/webclap/plugins/signalsmith-clap-cpp-LICENSE.txt"
            ]
        }
    },
    {
        "id": "org.rust-audio.clack.polysynth",
        "name": "Clack PolySynth Example",
        "author": "Clack",
        "description": "Play a polyphonic synthesizer built with Clack, with a mono audio output and host parameter controls.",
        "url": "/webclap/plugins/clack_plugin_polysynth.wasm",
        "factory": "org.rust-audio.clack.polysynth",
        "features": [
            "synthesizer",
            "mono",
            "instrument"
        ],
        "category": "Synthesizers",
        "title": "Clack PolySynth Example — Clack WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "Clack",
            "sourceUrl": "https://github.com/WebCLAP/examples/tree/main/clack",
            "license": "MIT OR Apache-2.0",
            "licenseUrls": [
                "/webclap/plugins/clack-LICENSE-MIT.txt",
                "/webclap/plugins/clack-LICENSE-APACHE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.organ",
        "name": "Organ",
        "author": "Plinken",
        "description": "Play a Hammond-style tonewheel organ with nine drawbars, eight voices and adjustable stereo spread.",
        "url": "/webclap/plugins/com.plinken.organ.wclap.tar.gz",
        "factory": "com.plinken.organ",
        "features": [
            "instrument",
            "synthesizer",
            "stereo"
        ],
        "category": "Keys",
        "title": "Organ — Plinken WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/organ",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.piano",
        "name": "Piano",
        "author": "Plinken",
        "description": "Play an eight-voice additive piano with stretched tuning, pitch-dependent decay and stereo spread.",
        "url": "/webclap/plugins/com.plinken.piano.wclap.tar.gz",
        "factory": "com.plinken.piano",
        "features": [
            "instrument",
            "synthesizer",
            "stereo"
        ],
        "category": "Keys",
        "title": "Piano — Plinken WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/piano",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.pulze",
        "name": "Pulze",
        "author": "Plinken",
        "description": "Build a drum kit by loading samples into pads, then play them with MIDI notes or the pad interface. Starts with empty pads.",
        "url": "/webclap/plugins/com.plinken.pulze.wclap.tar.gz",
        "factory": "com.plinken.pulze",
        "features": [
            "instrument",
            "drum-machine"
        ],
        "category": "Drums",
        "title": "Pulze — Plinken WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/pulze",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.synome",
        "name": "Synome",
        "author": "Plinken",
        "description": "Shape polyphonic leads, basses and chords with two oscillators, a ladder filter, envelopes, an LFO and built-in effects.",
        "url": "/webclap/plugins/com.plinken.synome.wclap.tar.gz",
        "factory": "com.plinken.synome",
        "features": [
            "instrument",
            "synthesizer"
        ],
        "category": "Synthesizers",
        "title": "Synome — Plinken WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/synome",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.example.clap.plugins.synth",
        "name": "Synth (AssemblyScript)",
        "author": "as-clap",
        "description": "Play a simple sine-wave synthesizer written in AssemblyScript, with host parameter controls.",
        "url": "/webclap/plugins/example.wclap.wasm",
        "factory": "com.example.clap.plugins.synth",
        "features": [
            "instrument"
        ],
        "category": "Synthesizers",
        "title": "Synth (AssemblyScript) — as-clap WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "as-clap",
            "sourceUrl": "https://github.com/WebCLAP/as-clap",
            "license": "BSL-1.0",
            "licenseUrls": [
                "/webclap/plugins/signalsmith-clap-cpp-LICENSE.txt"
            ]
        }
    },
    {
        "id": "uk.co.signalsmith.basics.analyser",
        "name": "[Basics] Analyser",
        "author": "Signalsmith Audio",
        "description": "Inspect the audio mix with the Signalsmith Basics analyser. Use it to examine sound while audio passes through.",
        "url": "/webclap/plugins/basics.wclap.tar.gz",
        "factory": "uk.co.signalsmith.basics.analyser",
        "features": [
            "analyzer"
        ],
        "category": "Analysis",
        "title": "[Basics] Analyser — Signalsmith Audio WebCLAP",
        "type": "visual",
        "subtype": "visualiser",
        "attribution": {
            "author": "Signalsmith Audio",
            "sourceUrl": "https://github.com/WebCLAP/examples/tree/main/signalsmith-basics",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plugins/signalsmith-basics-LICENSE.txt"
            ]
        }
    },
    {
        "id": "uk.co.signalsmith.basics.chorus",
        "name": "[Basics] Chorus",
        "author": "Signalsmith Audio",
        "description": "Thicken the audio mix with the Signalsmith Basics chorus and its modulation controls.",
        "url": "/webclap/plugins/basics.wclap.tar.gz",
        "factory": "uk.co.signalsmith.basics.chorus",
        "features": [
            "audio-effect",
            "chorus"
        ],
        "category": "Modulation",
        "title": "[Basics] Chorus — Signalsmith Audio WebCLAP",
        "type": "audio",
        "subtype": "modulation",
        "attribution": {
            "author": "Signalsmith Audio",
            "sourceUrl": "https://github.com/WebCLAP/examples/tree/main/signalsmith-basics",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plugins/signalsmith-basics-LICENSE.txt"
            ]
        }
    },
    {
        "id": "uk.co.signalsmith.basics.crunch",
        "name": "[Basics] Crunch",
        "author": "Signalsmith Audio",
        "description": "Add distortion and crunch to the audio mix with Signalsmith Basics.",
        "url": "/webclap/plugins/basics.wclap.tar.gz",
        "factory": "uk.co.signalsmith.basics.crunch",
        "features": [
            "audio-effect",
            "distortion"
        ],
        "category": "Distortion",
        "title": "[Basics] Crunch — Signalsmith Audio WebCLAP",
        "type": "audio",
        "subtype": "distortion",
        "attribution": {
            "author": "Signalsmith Audio",
            "sourceUrl": "https://github.com/WebCLAP/examples/tree/main/signalsmith-basics",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plugins/signalsmith-basics-LICENSE.txt"
            ]
        }
    },
    {
        "id": "uk.co.signalsmith.basics.freq-shifter",
        "name": "[Basics] Frequency Shifter",
        "author": "Signalsmith Audio",
        "description": "Shift audio frequencies to create metallic, inharmonic and other modulation effects.",
        "url": "/webclap/plugins/basics.wclap.tar.gz",
        "factory": "uk.co.signalsmith.basics.freq-shifter",
        "features": [
            "audio-effect",
            "frequency-shifter"
        ],
        "category": "Modulation",
        "title": "[Basics] Frequency Shifter — Signalsmith Audio WebCLAP",
        "type": "audio",
        "subtype": "modulation",
        "attribution": {
            "author": "Signalsmith Audio",
            "sourceUrl": "https://github.com/WebCLAP/examples/tree/main/signalsmith-basics",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plugins/signalsmith-basics-LICENSE.txt"
            ]
        }
    },
    {
        "id": "uk.co.signalsmith.basics.limiter",
        "name": "[Basics] Limiter",
        "author": "Signalsmith Audio",
        "description": "Control peaks in the audio mix with the Signalsmith Basics limiter.",
        "url": "/webclap/plugins/basics.wclap.tar.gz",
        "factory": "uk.co.signalsmith.basics.limiter",
        "features": [
            "audio-effect",
            "limiter"
        ],
        "category": "Dynamics",
        "title": "[Basics] Limiter — Signalsmith Audio WebCLAP",
        "type": "audio",
        "subtype": "dynamics",
        "attribution": {
            "author": "Signalsmith Audio",
            "sourceUrl": "https://github.com/WebCLAP/examples/tree/main/signalsmith-basics",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plugins/signalsmith-basics-LICENSE.txt"
            ]
        }
    },
    {
        "id": "uk.co.signalsmith.basics.reverb",
        "name": "[Basics] Reverb",
        "author": "Signalsmith Audio",
        "description": "Add space and reverberation to the audio mix with Signalsmith Basics.",
        "url": "/webclap/plugins/basics.wclap.tar.gz",
        "factory": "uk.co.signalsmith.basics.reverb",
        "features": [
            "audio-effect",
            "reverb"
        ],
        "category": "Reverb",
        "title": "[Basics] Reverb — Signalsmith Audio WebCLAP",
        "type": "audio",
        "subtype": "reverb",
        "attribution": {
            "author": "Signalsmith Audio",
            "sourceUrl": "https://github.com/WebCLAP/examples/tree/main/signalsmith-basics",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plugins/signalsmith-basics-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.auto-pan",
        "name": "Auto-Pan",
        "author": "Plinken",
        "description": "Move the stereo mix between left and right with a sine-wave LFO. Adjust speed and wet/dry mix.",
        "url": "/webclap/plugins/com.plinken.auto-pan.wclap.tar.gz",
        "factory": "com.plinken.auto-pan",
        "features": [
            "audio-effect",
            "utility"
        ],
        "category": "Modulation",
        "title": "Auto-Pan — Plinken WebCLAP",
        "type": "audio",
        "subtype": "modulation",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/auto-pan",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.brick-limiter",
        "name": "Brick Limiter",
        "author": "Plinken",
        "description": "Limit peaks on the mix with a lookahead brickwall limiter. Adds 2 ms of latency; intended for buses and mastering.",
        "url": "/webclap/plugins/com.plinken.brick-limiter.wclap.tar.gz",
        "factory": "com.plinken.brick-limiter",
        "features": [
            "audio-effect",
            "limiter",
            "mastering"
        ],
        "category": "Dynamics",
        "title": "Brick Limiter — Plinken WebCLAP",
        "type": "audio",
        "subtype": "dynamics",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/brick-limiter",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "uk.co.signalsmith-audio.plugins.example-audio-plugin",
        "name": "C++ Example Audio Plugin (Chorus)",
        "author": "Signalsmith Audio",
        "description": "Add stereo chorus to the audio mix using the Signalsmith C++ example plugin and its native interface.",
        "url": "/webclap/plugins/example-plugins.wclap.tar.gz",
        "factory": "uk.co.signalsmith-audio.plugins.example-audio-plugin",
        "features": [
            "audio-effect",
            "stereo"
        ],
        "category": "Modulation",
        "title": "C++ Example Audio Plugin (Chorus) — Signalsmith Audio WebCLAP",
        "type": "audio",
        "subtype": "modulation",
        "attribution": {
            "author": "Signalsmith Audio",
            "sourceUrl": "https://github.com/WebCLAP/examples/tree/main/signalsmith-clap-cpp",
            "license": "BSL-1.0",
            "licenseUrls": [
                "/webclap/plugins/signalsmith-clap-cpp-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.chorus",
        "name": "Chorus",
        "author": "Plinken",
        "description": "Create a wider, thicker mix with an LFO-modulated stereo chorus, up to three voices and adjustable spread.",
        "url": "/webclap/plugins/com.plinken.chorus.wclap.tar.gz",
        "factory": "com.plinken.chorus",
        "features": [
            "audio-effect",
            "chorus",
            "modulation"
        ],
        "category": "Modulation",
        "title": "Chorus — Plinken WebCLAP",
        "type": "audio",
        "subtype": "modulation",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/chorus",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "org.rust-audio.clack.gain",
        "name": "Clack Gain Example",
        "author": "Clack",
        "description": "Adjust the audio mix level with the Clack gain effect and host parameter controls.",
        "url": "/webclap/plugins/clack_plugin_gain.wasm",
        "factory": "org.rust-audio.clack.gain",
        "features": [
            "audio-effect",
            "stereo"
        ],
        "category": "Utility",
        "title": "Clack Gain Example — Clack WebCLAP",
        "type": "audio",
        "subtype": "utility",
        "attribution": {
            "author": "Clack",
            "sourceUrl": "https://github.com/WebCLAP/examples/tree/main/clack",
            "license": "MIT OR Apache-2.0",
            "licenseUrls": [
                "/webclap/plugins/clack-LICENSE-MIT.txt",
                "/webclap/plugins/clack-LICENSE-APACHE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.compressor",
        "name": "Compressor",
        "author": "Plinken",
        "description": "Shape mix dynamics with a feed-forward stereo compressor, soft knee, peak detector and gain-reduction metering.",
        "url": "/webclap/plugins/com.plinken.compressor.wclap.tar.gz",
        "factory": "com.plinken.compressor",
        "features": [
            "audio-effect",
            "compressor",
            "dynamics"
        ],
        "category": "Dynamics",
        "title": "Compressor — Plinken WebCLAP",
        "type": "audio",
        "subtype": "dynamics",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/compressor",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.delay",
        "name": "Delay",
        "author": "Plinken",
        "description": "Add stereo echoes with feedback, tone roll-off, wet/dry mix and optional ping-pong cross-feed.",
        "url": "/webclap/plugins/com.plinken.delay.wclap.tar.gz",
        "factory": "com.plinken.delay",
        "features": [
            "audio-effect",
            "delay",
            "echo"
        ],
        "category": "Delay",
        "title": "Delay — Plinken WebCLAP",
        "type": "audio",
        "subtype": "delay",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/delay",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.esscape",
        "name": "Esscape",
        "author": "Plinken",
        "description": "Reduce vocal sibilance with a program-adaptive split-band de-esser. Optional lookahead adds 2 ms latency; place before compression.",
        "url": "/webclap/plugins/com.plinken.esscape.wclap.tar.gz",
        "factory": "com.plinken.esscape",
        "features": [
            "audio-effect",
            "de-esser",
            "dynamics"
        ],
        "category": "Dynamics",
        "title": "Esscape — Plinken WebCLAP",
        "type": "audio",
        "subtype": "dynamics",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/esscape",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.example.clap.plugins.gain",
        "name": "Gain (AssemblyScript)",
        "author": "as-clap",
        "description": "Adjust the audio mix level with a simple AssemblyScript gain plugin and host parameter controls.",
        "url": "/webclap/plugins/example.wclap.wasm",
        "factory": "com.example.clap.plugins.gain",
        "features": [
            "audio-effect"
        ],
        "category": "Utility",
        "title": "Gain (AssemblyScript) — as-clap WebCLAP",
        "type": "audio",
        "subtype": "utility",
        "attribution": {
            "author": "as-clap",
            "sourceUrl": "https://github.com/WebCLAP/as-clap",
            "license": "BSL-1.0",
            "licenseUrls": [
                "/webclap/plugins/signalsmith-clap-cpp-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.eq",
        "name": "Parametric EQ",
        "author": "Plinken",
        "description": "Shape the mix with four bands of stereo EQ: low shelf, two parametric peaks and high shelf.",
        "url": "/webclap/plugins/com.plinken.eq.wclap.tar.gz",
        "factory": "com.plinken.eq",
        "features": [
            "audio-effect",
            "equalizer",
            "eq"
        ],
        "category": "EQ",
        "title": "Parametric EQ — Plinken WebCLAP",
        "type": "audio",
        "subtype": "equalizer",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/eq",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.reverb",
        "name": "Reverb",
        "author": "Plinken",
        "description": "Add algorithmic stereo reverb with adjustable decay, damping, pre-delay, width and wet/dry mix.",
        "url": "/webclap/plugins/com.plinken.reverb.wclap.tar.gz",
        "factory": "com.plinken.reverb",
        "features": [
            "audio-effect",
            "reverb"
        ],
        "category": "Reverb",
        "title": "Reverb — Plinken WebCLAP",
        "type": "audio",
        "subtype": "reverb",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/reverb",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.saturator",
        "name": "Saturation",
        "author": "Plinken",
        "description": "Colour the mix with tanh, tube or wave-folding saturation, plus tone and dry/wet controls.",
        "url": "/webclap/plugins/com.plinken.saturator.wclap.tar.gz",
        "factory": "com.plinken.saturator",
        "features": [
            "audio-effect",
            "distortion",
            "saturation"
        ],
        "category": "Distortion",
        "title": "Saturation — Plinken WebCLAP",
        "type": "audio",
        "subtype": "distortion",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/saturator",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.spectrum",
        "name": "Spectrum",
        "author": "Plinken",
        "description": "Watch a live FFT spectrum of the audio mix. Audio passes through unchanged while the interface displays frequency levels.",
        "url": "/webclap/plugins/com.plinken.spectrum.wclap.tar.gz",
        "factory": "com.plinken.spectrum",
        "features": [
            "audio-effect",
            "analyzer",
            "utility"
        ],
        "category": "Analysis",
        "title": "Spectrum — Plinken WebCLAP",
        "type": "visual",
        "subtype": "visualiser",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/spectrum",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.plinken.vocal-limiter",
        "name": "Vocal Limiter",
        "author": "Plinken",
        "description": "Control vocal and tracking peaks with a zero-latency feedback limiter and peak/gain-reduction meters.",
        "url": "/webclap/plugins/com.plinken.vocal-limiter.wclap.tar.gz",
        "factory": "com.plinken.vocal-limiter",
        "features": [
            "audio-effect",
            "limiter",
            "vocal"
        ],
        "category": "Dynamics",
        "title": "Vocal Limiter — Plinken WebCLAP",
        "type": "audio",
        "subtype": "dynamics",
        "attribution": {
            "author": "Plinken",
            "sourceUrl": "https://github.com/plinken-org/plinken-wclap/tree/main/plugins/com.plinken/vocal-limiter",
            "license": "MIT",
            "licenseUrls": [
                "/webclap/plinken-wclap-LICENSE.txt"
            ]
        }
    },
    {
        "id": "org.surge-synth-team.OB-Xf",
        "name": "OB-Xf",
        "author": "Surge Synth Team",
        "description": "Virtual analog synthesizer inspired by the Oberheim OB-X, continuing OB-Xd.",
        "url": "/webclap/plugins/open-webclap-obxf.wclap.tar.gz",
        "factory": "org.surge-synth-team.OB-Xf",
        "features": [
            "instrument",
            "synthesizer",
            "stereo"
        ],
        "category": "Synthesizers",
        "title": "OB-Xf — Surge Synth Team WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "Surge Synth Team",
            "sourceUrl": "https://github.com/andremichelle/open-webclap/tree/main/ports/obxf",
            "license": "AGPL-3.0 (JUCE bundle)",
            "licenseUrls": [
                "/webclap/plugins/open-webclap-obxf-LICENSE.txt"
            ]
        }
    },
    {
        "id": "org.baconpaul.six-sines",
        "name": "Six Sines",
        "author": "BaconPaul",
        "description": "Phase-modulation synthesizer with six sine operators and a modulation matrix.",
        "url": "/webclap/plugins/open-webclap-six-sines.wclap.tar.gz",
        "factory": "org.baconpaul.six-sines",
        "features": [
            "instrument",
            "synthesizer",
            "stereo"
        ],
        "category": "Synthesizers",
        "title": "Six Sines — BaconPaul WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "BaconPaul",
            "sourceUrl": "https://github.com/andremichelle/open-webclap/tree/main/ports/six-sines",
            "license": "AGPL-3.0 (JUCE bundle)",
            "licenseUrls": [
                "/webclap/plugins/open-webclap-six-sines-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.tilr.ripplerx",
        "name": "RipplerX",
        "author": "TiagoLr",
        "description": "Physically modeled percussion with mallet and noise exciters feeding coupled resonators.",
        "url": "/webclap/plugins/open-webclap-ripplerx.wclap.tar.gz",
        "factory": "com.tilr.ripplerx",
        "features": [
            "instrument",
            "synthesizer",
            "stereo"
        ],
        "category": "Drums",
        "title": "RipplerX — TiagoLr WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "TiagoLr",
            "sourceUrl": "https://github.com/andremichelle/open-webclap/tree/main/ports/ripplerx",
            "license": "AGPL-3.0 (JUCE bundle)",
            "licenseUrls": [
                "/webclap/plugins/open-webclap-ripplerx-LICENSE.txt"
            ]
        }
    },
    {
        "id": "com.thewavewarden.odin2",
        "name": "Odin 2",
        "author": "TheWaveWarden",
        "description": "Polyphonic semi-modular synthesizer with three oscillators, two filters, a modulation matrix and effects.",
        "url": "/webclap/plugins/open-webclap-odin2.wclap.tar.gz",
        "factory": "com.thewavewarden.odin2",
        "features": [
            "instrument",
            "synthesizer",
            "stereo"
        ],
        "category": "Synthesizers",
        "title": "Odin 2 — TheWaveWarden WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "TheWaveWarden",
            "sourceUrl": "https://github.com/andremichelle/open-webclap/tree/main/ports/odin2",
            "license": "AGPL-3.0 (JUCE bundle)",
            "licenseUrls": [
                "/webclap/plugins/open-webclap-odin2-LICENSE.txt"
            ]
        }
    },
    {
        "id": "org.surge-synth-team.surge-xt",
        "name": "Surge XT",
        "author": "Surge Synth Team",
        "description": "Hybrid synthesizer with a wide selection of oscillators, filters, effects and modulation.",
        "url": "/webclap/plugins/open-webclap-surge-xt.wclap.tar.gz",
        "factory": "org.surge-synth-team.surge-xt",
        "features": [
            "instrument",
            "synthesizer",
            "stereo"
        ],
        "category": "Synthesizers",
        "title": "Surge XT — Surge Synth Team WebCLAP",
        "type": "engine",
        "subtype": "instrument",
        "attribution": {
            "author": "Surge Synth Team",
            "sourceUrl": "https://github.com/andremichelle/open-webclap/tree/main/ports/surge-xt",
            "license": "AGPL-3.0 (JUCE bundle)",
            "licenseUrls": [
                "/webclap/plugins/open-webclap-surge-xt-LICENSE.txt"
            ]
        }
    },
    {
        "id": "de.polarity-music.polarity-sc-dark",
        "name": "Polarity SC Dark",
        "author": "Polarity",
        "description": "Spectral compressor with upward and downward compression for the audio mix.",
        "url": "/webclap/plugins/open-webclap-sc-dark.wclap.tar.gz",
        "factory": "de.polarity-music.polarity-sc-dark",
        "features": [
            "audio-effect",
            "compressor",
            "stereo"
        ],
        "category": "Dynamics",
        "title": "Polarity SC Dark — Polarity WebCLAP",
        "type": "audio",
        "subtype": "dynamics",
        "attribution": {
            "author": "Polarity",
            "sourceUrl": "https://github.com/andremichelle/open-webclap/tree/main/ports/sc-dark",
            "license": "GPL-3.0-or-later",
            "licenseUrls": [
                "/webclap/plugins/open-webclap-sc-dark-LICENSE.txt"
            ]
        }
    }
]
