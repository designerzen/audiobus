import { moodExamples } from "./sion-mood-examples.mjs";

/**
 * Original short scores, ordered from simple building blocks to arrangements.
 * @param {string} category
 * @param {string} name
 * @param {string} description
 * @param {string} mml
 */
const score = (category, name, description, mml) => ({ category, name, description, mml });

export const examples = [
    ...moodExamples,
    score(
        "Getting started",
        "Major scale",
        "Eight notes ascending through C major. Try changing t120 or o5.",
        "t120 o5 l8 cdefgab<c",
    ),
    score(
        "Getting started",
        "Two-part melody",
        "Two independent lines separated by a semicolon.",
        "t120 o5 l8 c e g >c <g e c4;\nt120 o3 l4 c g c g;",
    ),
    score(
        "Getting started",
        "Square-wave arpeggio",
        "A repeating chip-style pattern using instrument mode %1.",
        "%1 t140 o4 l16 [cegb>cegb<]4;",
    ),
    score(
        "Getting started",
        "Notes and rests",
        "Rests create breathing space. Compare r8 with r4.",
        "t120 o5 l8 c r e r g4 r4 g r e r c2;",
    ),
    score(
        "Getting started",
        "Length ladder",
        "Hear whole, half, quarter, eighth and sixteenth notes.",
        "t150 o5 c1 d2 e4 f8 g16 a16 b8 <c4;",
    ),
    score(
        "Getting started",
        "Octave staircase",
        "The angle brackets move the melody between octaves.",
        "t132 o3 l8 ceg<c >ceg<c >ceg<c;",
    ),

    score(
        "Scales and modes",
        "Natural minor",
        "A minor rises and falls without accidentals.",
        "t140 o4 l16 abcdefg<a gfedcba> a4;",
    ),
    score(
        "Scales and modes",
        "Minor pentatonic",
        "Five notes that work well for improvising over A minor.",
        "t120 o4 l8 acde g<ac>d e4 c4 a2;",
    ),
    score(
        "Scales and modes",
        "Blues staircase",
        "A flattened fifth adds tension to the minor pentatonic scale.",
        "t126 o4 l8 acdd+ e g <a g e d+ d c a4;",
    ),
    score(
        "Scales and modes",
        "Chromatic climb",
        "All twelve pitch classes, using + for sharps.",
        "t150 o4 l16 cc+dd+eff+gg+aa+b<c4;",
    ),
    score(
        "Scales and modes",
        "Whole-tone dream",
        "Equal whole steps create an unsettled, floating sound.",
        "t100 o4 l8 c d e f+ g+ a+ <c >a+ g+ f+ e d c2;",
    ),
    score(
        "Scales and modes",
        "Dorian steps",
        "D Dorian pairs a minor third with a bright major sixth.",
        "t132 o4 l8 defgab<c d c>b a g f e d4;",
    ),

    score(
        "Rhythm lab",
        "Dotted bounce",
        "Dotted eighth notes alternate with short sixteenths.",
        "t116 o5 [c8.e16 g8.e16 d8.f16 a8.f16]2 c2;",
    ),
    score(
        "Rhythm lab",
        "Offbeat answers",
        "The melody answers the pulse after an eighth-note rest.",
        "t124 o5 l8 [r c r e r g r e]2 c4;\nt124 o3 l4 [c r g r]2 c4;",
    ),
    score(
        "Rhythm lab",
        "Three against two",
        "Three evenly spaced notes sit over two beats in 6/8.",
        "t120 o5 l8 [c e g c e g]4 c4;\nt120 o3 l8 [c r r g r r]4 c4;",
    ),
    score(
        "Rhythm lab",
        "Waltz clock",
        "A low note and two upper notes outline a three-beat pulse.",
        "t156 o3 l4 [c >e g <f >a <c g >b <d c >e g]2 c2;",
    ),
    score(
        "Rhythm lab",
        "Five-step loop",
        "A five-eighth-note phrase shifts against a steady quarter-note pulse.",
        "t138 o5 l8 [c e g d f]4 c2;\nt138 o3 l4 [c g]5 c2;",
    ),
    score(
        "Rhythm lab",
        "Seven-step loop",
        "A seven-note pattern gives the repeated phrase an uneven gait.",
        "t144 o5 l8 [c d e g e d b]4 c2;",
    ),

    score(
        "Arpeggios",
        "Major chord carousel",
        "Broken C, F, G and C chords make a compact progression.",
        "t132 o4 l16 [ceg>c<ge f a >c f c<a g b >d g d<b ceg>c<ge]2 c4;",
    ),
    score(
        "Arpeggios",
        "Minor lanterns",
        "Minor chord tones repeat over a gently moving root.",
        "t112 o4 l16 [ace>c<eca dfa>d<afd egb>e<bge ace>c<eca]2 a4;",
    ),
    score(
        "Arpeggios",
        "Suspended orbit",
        "Replacing the third with the fourth leaves the harmony open.",
        "t120 o4 l16 [cfg>c<gfcg]4 c2;",
    ),
    score(
        "Arpeggios",
        "Seventh-chord shimmer",
        "A major seventh adds a close, bright edge to the pattern.",
        "t126 o4 l16 [cegb>cegb<]3 c2;",
    ),
    score(
        "Arpeggios",
        "Wide-open fifths",
        "Open fifths leap between low and high registers.",
        "t120 o3 l8 [cg<c>g dg<d>g ea<e>a fc<f>c]2 c2;",
    ),
    score(
        "Arpeggios",
        "Descending glass",
        "A high arpeggio cascades down through three registers.",
        "t144 o6 l16 [c>gec >gec >gec <ceg <ceg <ceg]2 c2;",
    ),

    score(
        "Bass patterns",
        "Walking roots",
        "Quarter-note bass connects chord roots with passing tones.",
        "%1 t132 o2 l4 c e g a f a <c>a g b <d>b c e g c;",
    ),
    score(
        "Bass patterns",
        "Octave engine",
        "Alternating octaves turn a single note into a driving bass part.",
        "%1 t140 o2 l8 [a<a>a<a> f<f>f<f> c<c>c<c> g<g>g<g>]2 a4;",
    ),
    score(
        "Bass patterns",
        "Syncopated subline",
        "Short notes and rests create a broken bass groove.",
        "%1 t110 o2 l16 [a r a8 r e g8 a8 r8 c8 e8]2 a4;",
    ),
    score(
        "Bass patterns",
        "Fifth-and-flat-seven",
        "A root, fifth and flat seventh make a compact rock pattern.",
        "%1 t126 o2 l8 [a a e a g a e g]4 a4;",
    ),
    score(
        "Bass patterns",
        "Chromatic turnaround",
        "Semitone approaches pull the bass towards the next root.",
        "%1 t136 o2 l8 c e g a a+ b <c> b a g f+ f e d+ d c+ c2;",
    ),
    score(
        "Bass patterns",
        "Bass and lead",
        "A high square-wave phrase rides above alternating bass octaves.",
        "%1 t128 o5 l8 [a c e r g e c r]2 a2;\n%1 t128 o2 l8 [a<a>a<a> f<f>f<f>]2 a2;",
    ),

    score(
        "Melody sketches",
        "Morning window",
        "A simple major melody with space between its phrases.",
        "t108 o5 l8 c e g4 e8 d c4 r4 d8 f a4 g8 e c2;",
    ),
    score(
        "Melody sketches",
        "Paper boats",
        "A lilting melody moves between neighbouring notes.",
        "t120 o5 l8 e g a g e d c4 d8 e g e d4 c2;",
    ),
    score(
        "Melody sketches",
        "Lantern walk",
        "A minor melody resolves a long descending phrase.",
        "t104 o4 l8 a <c e d c>b a4 r8 e a b <c d e4 d8 c>b a2;",
    ),
    score(
        "Melody sketches",
        "Question and answer",
        "A rising question is answered by a descending variation.",
        "t116 o5 l8 c d e g a4 r4 a8 g e d c4 r4 e8 f g b <c2;",
    ),
    score(
        "Melody sketches",
        "Small celebration",
        "Repeated notes and short upward leaps give this tune a fanfare shape.",
        "t144 o5 l8 c c g4 e8 e <c4 >b8 a g e d4 c2;",
    ),
    score(
        "Melody sketches",
        "After the rain",
        "A slow melody uses a sharp fourth for a brighter colour.",
        "t96 o5 l8 c e f+ g b4 a8 g e4 d8 e c2;",
    ),

    score(
        "Counterpoint",
        "Two-note conversation",
        "Two parts take turns answering each other.",
        "t120 o5 l8 c e g4 r2 d8 f a4 r2 c2;\nt120 o4 l8 r2 c e g4 r2 d f a4 c2;",
    ),
    score(
        "Counterpoint",
        "Parallel thirds",
        "Two melodies move together at a mostly third-sized distance.",
        "t120 o5 l8 e f g a g f e d e4 c2;\nt120 o5 l8 c d e f e d c >b <c4 >a2;",
    ),
    score(
        "Counterpoint",
        "Contrary motion",
        "The upper line climbs while the lower line descends.",
        "t120 o5 l8 c d e f g a b <c2;\nt120 o5 l8 c>b a g f e d c2;",
    ),
    score(
        "Counterpoint",
        "Delayed echo",
        "The second voice repeats the first one beat later.",
        "t132 o5 l8 c e g e d f a f e g <c>g c2 r4;\nt132 o4 l8 r4 c e g e d f a f e g <c>g c2;",
    ),
    score(
        "Counterpoint",
        "Round the garden",
        "Three overlapping entries build a small round.",
        "t120 o5 l8 c d e c e f g4 g a g f e c2 r1;\nt120 o4 l8 r2 c d e c e f g4 g a g f e c2 r2;\nt120 o3 l8 r1 c d e c e f g4 g a g f e c2;",
    ),
    score(
        "Counterpoint",
        "Pedal-point study",
        "A repeated C supports a melody that wanders above it.",
        "t112 o5 l8 e g a b <c>b a g f a g f e2;\nt112 o3 l8 [c r c r]7;",
    ),

    score(
        "Chiptune",
        "Pocket title screen",
        "A square-wave lead and bass suggest a small game opening.",
        "%1 t144 o5 l8 [c e g <c>b g e d]2 c2;\n%1 t144 o2 l8 [c g <c>g f <c f>c]2 c2;",
    ),
    score(
        "Chiptune",
        "Crystal cave",
        "Fast, high notes sparkle above a slower bass line.",
        "%1 t126 o6 l16 [a e c e g d>b<d]4 a2;\n%1 t126 o2 l4 [a e f c]2 a2;",
    ),
    score(
        "Chiptune",
        "Pixel sprint",
        "Sixteenth-note bursts give a short lead line forward motion.",
        "%1 t168 o5 l16 [cdeg eged cdeg <c>bag]2 c4;",
    ),
    score(
        "Chiptune",
        "Extra life",
        "A quick rising arpeggio ends with a held high note.",
        "%1 t180 o4 l16 ceg<c e g <c4;",
    ),
    score(
        "Chiptune",
        "Level complete",
        "A compact two-voice cadence with a rising final flourish.",
        "%1 t150 o5 l16 ceg<c> g8 e8 d16fgb <c4;\n%1 t150 o3 l8 c g e c g4 c4;",
    ),
    score(
        "Chiptune",
        "Night drive",
        "A repeated low pulse supports a high minor melody.",
        "%1 t132 o5 l8 [a e <c>b a g e4]2 a2;\n%1 t132 o2 l16 [a r a r e r a r f r f r c r f r]2 a2;",
    ),

    score(
        "Slow and spacious",
        "Quiet water",
        "Long notes and rests leave room for the tone to fade.",
        "t72 o5 l4 c2 r4 e2 r4 g2 r4 e2 c1;",
    ),
    score(
        "Slow and spacious",
        "Open horizon",
        "Two sustained lines form open intervals.",
        "t80 o5 l2 g a g e c1;\nt80 o3 l2 c f c g c1;",
    ),
    score(
        "Slow and spacious",
        "Slow pendulum",
        "A repeated pair of notes gradually changes its upper voice.",
        "t76 o4 l4 [c g c a c b <c>g]2 c1;",
    ),
    score(
        "Slow and spacious",
        "Distant signals",
        "Separated high notes answer a lower sustained tone.",
        "t88 o6 l8 e r4 g8 r2 d8 r4 e8 r2 c2;\nt88 o3 c1 g1 c2;",
    ),
    score(
        "Slow and spacious",
        "Minor mist",
        "A slow A-minor line floats above changing bass notes.",
        "t84 o5 l4 a2 e4 c4 b2 g2 a1;\nt84 o3 l2 a f g e a1;",
    ),
    score(
        "Slow and spacious",
        "Held breath",
        "Dotted notes stretch a melody across the pulse.",
        "t90 o5 c2. e4 g2. a4 g2 e2 c1;",
    ),

    score(
        "Mini arrangements",
        "Three-part sunrise",
        "Melody, broken chords and bass form a short major arrangement.",
        "t120 o5 l8 e g a g e d c4 f8 a g e d4 c2;\nt120 o4 l8 [c e g e f a <c>a>]2;\nt120 o2 l2 c f g c;",
    ),
    score(
        "Mini arrangements",
        "Minor courtyard",
        "Three voices outline an A-minor progression.",
        "t112 o5 l8 a <c e d c>b a4 f8 a g e a2;\nt112 o4 l8 [a c e c f a <c>a>]2;\nt112 o2 l2 a f e a;",
    ),
    score(
        "Mini arrangements",
        "Music-box sketch",
        "A high melody sits over a rolling lower accompaniment.",
        "t132 o6 l8 e g <c>g a f d4 e8 g a g e4 c2;\nt132 o4 l8 [c g <e>g f <c a>c]2;",
    ),
    score(
        "Mini arrangements",
        "Tiny procession",
        "A march-like lead moves over a steady two-part foundation.",
        "%1 t128 o5 l8 c c e4 g8 g e4 f8 f d4 c2;\nt128 o4 l4 [e g f a]2;\n%1 t128 o2 l4 [c g f c]2;",
    ),
    score(
        "Mini arrangements",
        "Evening bicycle",
        "A repeating accompaniment carries a relaxed melody.",
        "t108 o5 l8 g e d c e4 g4 a8 g e d c2;\nt108 o4 l16 [cege cege fac<a>fac<a>]2;\nt108 o2 l2 c f c g;",
    ),
    score(
        "Mini arrangements",
        "Closing credits",
        "Three parts end on a long C-major resolution.",
        "t100 o5 l8 e g a g f e d4 e8 f g b <c1;\nt100 o4 l4 c e f a g b <c1;\nt100 o2 l2 c f g <c1;",
    ),
];