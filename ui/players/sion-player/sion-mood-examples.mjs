/**
 * Original mood sketches. These are musical interpretations, not fixed rules
 * about how a listener will feel. Each mood has three different phrases.
 * @param {string} mood
 * @param {string} emoji
 * @param {string} character
 * @param {Array<[string, string]>} tunes
 */
const mood = (mood, emoji, character, tunes) =>
    tunes.map(([name, mml]) => ({
        category: `${emoji} ${mood}`,
        name: `${emoji} ${name}`,
        description: `${mood}: ${character}`,
        mml,
    }));

export const moodExamples = [
    ...mood(
        "Joy",
        "😄",
        "Bright major thirds, rising phrases and a bouncy pulse aim for an openly happy sound.",
        [
            [
                "Very happy sunshine",
                "t152 o5 l8 c e g <c4 >g8 a g e4 d8 e c2;\nt152 o3 l4 c g f g c2;",
            ],
            ["Dancing in the kitchen", "t144 o5 c8.e16 g8.e16 f8.a16 g4 e8.g16 <c4 >g8 e c2;"],
            [
                "A pocket full of smiles",
                "t160 o5 l8 [e g a g e c d e]2 c2;\nt160 o3 l4 [c g f g]2 c2;",
            ],
        ],
    ),
    ...mood(
        "Excitement",
        "🤩",
        "Fast runs, high notes and repeated upward leaps build a sense of eager energy.",
        [
            ["Best news ever", "%1 t180 o5 l16 ceg<c>eg<c e8 d8 c4;"],
            [
                "Countdown to the weekend",
                "%1 t172 o5 l16 [cdeg egae g a b <c>]2 <c4;\n%1 t172 o2 l8 [c g c g]4 c4;",
            ],
            ["Sparks in the air", "t192 o6 l16 [cege dfaf egbg]2 <c4;"],
        ],
    ),
    ...mood(
        "Playfulness",
        "😜",
        "Unexpected rests, short replies and register jumps make these phrases feel like little games.",
        [
            ["Hide and seek", "t140 o5 l16 c r e8 r g c r >g8 <e r c4;"],
            ["Hopscotch", "%1 t148 o4 l8 c <e>g <d>f <c>e g r c4;"],
            ["The wonky toy parade", "t136 o5 c8.e16 r8 g16 e16 f8 d16 r16 c4 g8 <c8 >c4;"],
        ],
    ),
    ...mood("Love", "🥰", "Gentle major harmony and flowing lines suggest warmth and affection.", [
        ["A handwritten note", "t92 o5 l8 e g a g e4 d8 e c2;\nt92 o3 l4 c e f g c2;"],
        ["Two hearts talking", "t96 o5 l4 e g a2 g4 e c2;\nt96 o4 l4 c e f2 e4 c >g2;"],
        ["Under the same stars", "t84 o5 g4. e8 c4 d4 e2 c2;\nt84 o3 l2 c f g c;"],
    ]),
    ...mood(
        "Tenderness",
        "🤗",
        "Quiet dynamics, small intervals and unhurried endings aim for a delicate, caring character.",
        [
            ["Handle with care", "t82 v5 o5 l8 e f e d c4 r4 d8 e c2;"],
            ["A small kindness", "t88 v5 o4 l4 g <c d2 c4 >g a2 g2;"],
            ["Holding hands", "t80 v4 o5 l4 e d c2 d4 e c2;\nt80 v3 o4 l2 c g c1;"],
        ],
    ),
    ...mood(
        "Gratitude",
        "🙏",
        "Settled major cadences and gently rising answers aim for a generous, thankful feeling.",
        [
            ["Thank you for being here", "t100 o5 l4 c e g2 a4 g e d c2;\nt100 o3 l2 c f g c c2;"],
            ["An unexpected gift", "t108 o5 l8 c e f a g4 e8 d c2;"],
            ["Full heart", "t94 o5 e2 g4 a4 g2 e4 d4 c1;\nt94 o3 l2 c f g c c1;"],
        ],
    ),
    ...mood(
        "Trust",
        "🤝",
        "Steady pulses, consonant intervals and predictable returns suggest stability and reassurance.",
        [
            ["You can count on me", "t104 o5 l4 c e g e c e g2 c2;\nt104 o3 l4 [c g]4 c2;"],
            ["A reliable rhythm", "t112 o4 l8 [c g e g]4 c2;"],
            ["Safe harbour", "t90 o5 l2 g e d c;\nt90 o3 l2 c c g c;"],
        ],
    ),
    ...mood(
        "Calm",
        "😌",
        "Slow movement, open fifths and pauses leave plenty of space around the notes.",
        [
            ["Still lake", "t72 v5 o5 c2 g2 e2 r2 c1;\nt72 v3 o3 c1 g1 c1;"],
            ["Breathing out", "t76 v5 o4 l4 c g <c2 >g4 e c1;"],
            ["Clouds drifting", "t68 v4 o5 l2 c d g e c1;"],
        ],
    ),
    ...mood(
        "Contentment",
        "😊",
        "Comfortable mid-register melodies and easy major resolutions suggest quiet satisfaction.",
        [
            ["Nothing else needed", "t96 o4 l8 c e g e d4 c4 e8 g e d c2;"],
            ["Sunday cup of tea", "t90 o4 l4 g <c e2 d4 c >g2;"],
            ["Home at last", "t100 o5 l4 e g e c d e c2;\nt100 o3 l2 c f g c;"],
        ],
    ),
    ...mood(
        "Hope",
        "🌅",
        "Minor openings brighten into major thirds and upward-reaching resolutions.",
        [
            ["A little light returns", "t104 o4 l8 a c e4 d8 c >b4 <c8 e g4 <c2;"],
            [
                "Tomorrow looks brighter",
                "t112 o5 l4 c d d+2 e4 g a4 b4 <c2;\nt112 o3 l2 c g f g c2;",
            ],
            ["First green shoot", "t108 o4 l8 a b <c d e4 g8 a g4 e4 <c2;"],
        ],
    ),
    ...mood(
        "Anticipation",
        "👀",
        "Repeated questions and rising fragments delay the final resolution.",
        [
            ["Almost time", "t128 o5 l8 [g r a r b r]3 <c2;"],
            ["Waiting at the door", "t120 o4 l16 [g a b r g a b r]3 <c4;\nt120 o3 l8 [g r]12 c4;"],
            ["The curtain rises", "t136 o4 l8 c d e r e f g r g a b r <c2;"],
        ],
    ),
    ...mood(
        "Curiosity",
        "🧐",
        "Whole tones, suspended notes and wandering questions explore without settling straight away.",
        [
            ["What is behind that door", "t112 o5 l8 c d f+ r e g+ d4 f+8 e c2;"],
            ["Following a firefly", "t126 o5 l16 c e r f+ g r d e r a g e c4;"],
            ["An interesting little puzzle", "t116 o4 l8 c f g r d g a r e a b r <c4;"],
        ],
    ),
    ...mood(
        "Surprise",
        "😲",
        "Sudden rests and large register jumps interrupt otherwise simple phrases.",
        [
            ["Oh hello", "t132 o4 l8 c e g r2 o7 c16 r8. o4 c4;"],
            ["The jack in the box", "%1 t144 o4 l16 [c r d r]2 r4 o7 g8 o4 c4;"],
            ["A twist in the tale", "t128 o5 l8 c d e g r4 o3 f+8 r8 o6 c4;"],
        ],
    ),
    ...mood(
        "Awe",
        "🤯",
        "Wide registers and spacious rising harmony aim for a sense of scale and wonder.",
        [
            ["Looking up at the sky", "t84 o4 l8 c g <c e g2 <c2;\nt84 o2 c1 f1 c1;"],
            ["Mountains beyond mountains", "t92 o4 l4 c f+ g <c2 e2 g1;\nt92 o2 l1 c g c;"],
            ["A thousand stars", "t104 v6 o6 l16 [cegb]3 <c2;\nt104 v4 o3 l2 c g c1;"],
        ],
    ),
    ...mood(
        "Pride",
        "😎",
        "Firm major arpeggios and clear cadences give these phrases a confident posture.",
        [
            ["Look what I made", "t128 o4 l8 c e g4 <c8>b a4 g8 e c2;\nt128 o2 l4 c g f g c2;"],
            ["Standing tall", "%1 t136 o5 c4 c8 e8 g4 <c4 >b8 g8 <c2;"],
            ["Earned my place", "t124 o5 l4 g e c d e g <c2;\nt124 o3 l2 c f g c;"],
        ],
    ),
    ...mood(
        "Determination",
        "💪",
        "Persistent low pulses and short rising motifs keep pushing towards a firm ending.",
        [
            ["One more try", "%1 t140 o3 l8 [a a e a c a e a]3 a4;"],
            [
                "Keep climbing",
                "%1 t148 o4 l16 [a b <c d> a b <c e>]2 <a4;\n%1 t148 o2 l8 [a r a e]4 a4;",
            ],
            ["Step by steady step", "t132 o4 l4 a b <c d e f g a2;\nt132 o2 l8 [a e]8 a2;"],
        ],
    ),
    ...mood(
        "Courage",
        "🦁",
        "A minor beginning opens into larger, brighter leaps, with a steady supporting pulse.",
        [
            ["Through the doorway", "t124 o4 l8 a c e4 f8 e d4 e8 g a2;\nt124 o2 l4 a e f g a2;"],
            ["A brave little heart", "%1 t136 o4 a8.e16 a4 <c8 d8 e4 d8 c8 a2;"],
            ["Into the light", "t128 o4 l4 a c e2 f4 g <c2;\nt128 o2 l2 a f g <c;"],
        ],
    ),
    ...mood("Relief", "😮‍💨", "Close, tense notes relax into slower, consonant endings.", [
        ["The storm has passed", "t96 o5 l8 b c b a g4 e4 d2 c1;"],
        ["Finally an answer", "t104 o4 l16 [b <c>b r]2 <c4 e4 g2 c1;"],
        ["Safe on the other side", "t88 o5 f+8 g8 f+8 e8 d4 e4 c1;\nt88 o3 g2 g2 c1;"],
    ]),
    ...mood(
        "Nostalgia",
        "🥹",
        "Lilting major phrases with gentle downward turns suggest looking back fondly.",
        [
            ["An old photograph", "t92 o5 e4. g8 a4 g4 e2 d4 c4;\nt92 o3 l2 c f g c;"],
            ["The street we grew up on", "t104 o5 l8 g e d c e4 g4 a8 g e d c2;"],
            ["A tune half remembered", "t88 o4 l8 g <c e4 d8 c >a4 g8 <c2;"],
        ],
    ),
    ...mood(
        "Longing",
        "🥺",
        "Reaching leaps and unresolved pauses suggest wanting something just out of reach.",
        [
            ["Across the distance", "t84 o4 l4 a <e2 d4 c2 >b2 a2;"],
            ["Wish you were here", "t90 o5 l8 e a g4 e8 d c4 >b8 <e2 r4;\nt90 o3 a1 e1;"],
            ["A light in your window", "t94 o4 l4 a <c e2 d4 c >b2 a2;"],
        ],
    ),
    ...mood(
        "Bittersweet",
        "🥲",
        "Major and minor thirds share the same phrase, mixing brightness with a downward pull.",
        [
            ["Happy tears", "t100 o5 l8 c e g4 a8 g e4 d+8 d c2;"],
            ["The last summer evening", "t96 o5 l4 e g a2 g8 f e d+ c2;\nt96 o3 l2 c f f g c2;"],
            ["A beautiful goodbye", "t88 o5 l8 g e d c d+4 f4 e2 c1;"],
        ],
    ),
    ...mood(
        "Sadness",
        "😢",
        "Minor harmony, slower movement and falling lines give these melodies a subdued character.",
        [
            ["Rain on the window", "t78 v6 o5 l4 e d c2 >b4 a g2 a1;\nt78 v4 o3 l2 a f e a a1;"],
            ["An empty afternoon", "t84 o4 l8 a <c e4 d8 c >b4 a8 g a2;"],
            ["Words left unsaid", "t80 o5 l4 e2 d4 c4 >b2 a1;"],
        ],
    ),
    ...mood(
        "Grief",
        "😭",
        "Low, sparse minor phrases and long silences aim for a heavier sense of loss.",
        [
            ["An empty chair", "t64 v5 o3 a2 r2 e2 f2 e1 a1;"],
            ["What remains", "t68 v5 o4 e2 d2 c2 >b2 a1 r2;\nt68 v3 o2 a1 e1 a1;"],
            ["Remembering your voice", "t70 v4 o4 l4 a2 <c2 >b4 a4 e2 a1;"],
        ],
    ),
    ...mood(
        "Loneliness",
        "😔",
        "Isolated notes and unanswered rests leave the melody without a companion voice.",
        [
            ["One lit window", "t82 v5 o5 e4 r2 d4 c2 r2 >a1;"],
            ["An unanswered call", "t88 o5 l8 e a e4 r2 e8 a e4 r2 d2;"],
            ["Last train home", "t92 o4 l4 a e2 r4 g e2 r4 a1;"],
        ],
    ),
    ...mood(
        "Anxiety",
        "😰",
        "Uneven rests, close semitones and recurring fragments create a restless, unsettled pulse.",
        [
            ["Thoughts going round", "%1 t148 v6 o5 l16 [b<c>b r b<c> a r]4 b4;"],
            ["Checking the clock", "t156 o4 l16 [a r a+ a r e r a+]3 a4;"],
            ["Too many possibilities", "%1 t144 o5 l16 c c+ r d+ d r f e r g f+ r c4;"],
        ],
    ),
    ...mood(
        "Fear",
        "😨",
        "Low pulses, tritones and sudden high fragments aim for suspense and unease.",
        [
            ["Footsteps behind you", "%1 t108 o2 l8 [c r c r f+ r c r]3 c4;"],
            ["Something in the dark", "t96 o3 c4 r4 f+8 r8 c4 r2 o6 c+16 r8. c4;"],
            ["The shadow moves", "%1 t120 o3 l16 [c c+ r r f+ g r r]4 c2;"],
        ],
    ),
    ...mood(
        "Anger",
        "😠",
        "Low square-wave attacks, hard repetitions and chromatic clashes give these riffs a forceful edge.",
        [
            ["Seeing red", "%1 t168 o2 l16 [c c c+ c r f+ c r]4 c4;"],
            [
                "Enough is enough",
                "%1 t160 o3 l8 [a a a+ a e r a4]3 a4;\n%1 t160 o2 l4 [a a e a]3 a4;",
            ],
            ["A slammed door", "%1 t176 o3 c16 c16 f+8 c16 c16 c+8 r4 c16 f+16 c4;"],
        ],
    ),
    ...mood(
        "Frustration",
        "😤",
        "Interrupted patterns and repeated near-resolutions suggest getting stuck just before the goal.",
        [
            ["Not quite there", "%1 t136 o4 l16 [a b <c>b a r r e]3 a4;"],
            ["Back to square one", "t144 o5 l8 [c d e f+ r e d r]3 c4;"],
            ["The stubborn knot", "%1 t132 o3 l16 [e f e r e f+ e r]3 e2;"],
        ],
    ),
    ...mood(
        "Disgust",
        "🤢",
        "Chromatic slips and low tritone figures aim for an awkward, sour character.",
        [
            ["Something tastes wrong", "%1 t104 o3 l8 c f+ f e d+ d c+ c2;"],
            ["A sour little wobble", "t112 o4 l16 [e f e d+ e r c+ r]3 c4;"],
            ["No thank you", "%1 t108 o3 c8 f+8 r4 f8 e8 d+8 c+8 c2;"],
        ],
    ),
    ...mood(
        "Jealousy",
        "😒",
        "Insistent minor figures and close neighbouring notes circle without finding much rest.",
        [
            ["Looking over your shoulder", "t118 o4 l8 [a <c>b c>a e a b]3 a2;"],
            ["The green-eyed whisper", "%1 t124 o4 l16 [a a+ a e g a e r]3 a4;"],
            ["Why not me", "t110 o5 l8 e f e d+ e4 c8 >b a2;\nt110 o3 l4 a e a e a2;"],
        ],
    ),
    ...mood(
        "Guilt",
        "😞",
        "Hesitant minor phrases repeatedly turn downwards, leaving space before their final notes.",
        [
            ["I should have said something", "t80 o4 l8 a <c>b a g4 r4 e8 f e2 a2;"],
            ["An unfinished apology", "t86 o5 e4 d8 c8 >b4 r4 a2 e2;"],
            ["Making amends", "t90 o4 l4 a g e2 f4 e d2 c2 a2;"],
        ],
    ),
    ...mood(
        "Embarrassment",
        "😳",
        "Short interrupted phrases, little chromatic slips and an abrupt retreat suggest a sheepish blush.",
        [
            ["Oops that was me", "t128 o5 l16 c e g r f+ g r e d+ e r c4;"],
            ["Tripping over my words", "t120 o5 l8 c d r e16 f16 r8 d c+ c4;"],
            ["A bashful little wave", "t112 o5 e8 g8 r4 f8 e16 d16 c8 r8 >g4;"],
        ],
    ),
];