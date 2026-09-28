const NOTENAMES = {
    sharp: [
        "C",  // 0
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B"
    ],

    flat: [
        "C",   // 0
        "Db",
        "D",
        "Eb",
        "E",
        "F",
        "Gb",
        "G",
        "Ab",
        "A",
        "Bb",
        "B"
    ]
};

const CHORD_TYPES = {
    major:        [0, 4, 7],
    minor:        [0, 3, 7],
    diminished:   [0, 3, 6],
    augmented:    [0, 4, 8],

    maj7:         [0, 4, 7, 11],
    dom7:         [0, 4, 7, 10],
    min7:         [0, 3, 7, 10],
    minMaj7:      [0, 3, 7, 11],
    halfdim7:     [0, 3, 6, 10],
    dim7:         [0, 3, 6, 9],

    augMaj7:      [0, 4, 8, 11],
    aug7:         [0, 4, 8, 10],

    sus2:         [0, 2, 7],
    sus4:         [0, 5, 7],

    add9:         [0, 4, 7, 14],
    madd9:        [0, 3, 7, 14],
    add11:        [0, 4, 7, 17],
    add6:         [0, 4, 7, 9],
    madd6:        [0, 3, 7, 9],

    "7b5":        [0, 4, 6, 10],
    "7sharp5":        [0, 4, 8, 10],
    "7b9":        [0, 4, 7, 10, 13],
    "7sharp9":        [0, 4, 7, 10, 15],
    "7b9b5":      [0, 4, 6, 10, 13],

    power5:       [0, 7],
    quartal:      [0, 5, 10],
    quintal:      [0, 7, 14]
};

const HARMONIC_RULES = [
    // 1) Dominante (+7): V
    {
        name: "dominant",
        step: +7,
        types: ["major", "dom7", "7b5", "7sharp5", "7b9", "7sharp9", "7b9b5"],
        weight: 1.0
    },

    // 2) Subdominante (+5): IV
    {
        name: "subdominant",
        step: +5,
        types: ["major", "maj7", "add6", "add9", "add11", "sus2", "sus4"],
        weight: 0.9
    },

    // 3) Tonikaparallele (+9 ≡ -3): vi
    {
        name: "tonicParallel",
        step: +9,
        types: ["minor", "min7", "madd6", "madd9", "minMaj7"],
        weight: 0.85
    },

    // 4) ii (+2): predominant
    {
        name: "predominant_ii",
        step: +2,
        types: ["minor", "min7", "halfdim7", "madd9"],
        weight: 0.75
    },

    // 5) iii (+4): schwache Predominante / Farbe
    {
        name: "predominant_iii",
        step: +4,
        types: ["minor", "min7", "madd9"],
        weight: 0.6
    },

    // 6) vii° (+11 ≡ -1): Leittonakkord
    {
        name: "leadingTone",
        step: +11,
        types: ["diminished", "halfdim7", "dim7"],
        weight: 0.7
    },

    // 7) Parallele Dominante (+2 von Dominante, also V/V etc.) – optional
    {
        name: "secondaryDominant",
        step: +2, // als V/V etc. interpretierbar im Kontext
        types: ["dom7", "7b5", "7sharp5", "7b9", "7sharp9", "7b9b5"],
        weight: 0.65,
        tag: "secondary"
    },

    // 8) Farb-/Static-Chords (Quartal/Quintal/Power) – „seitwärts“
    {
        name: "color_static",
        step: 0,
        types: ["power5", "quartal", "quintal", "sus2", "sus4", "add9", "madd9"],
        weight: 0.5
    },

    // 9) Chromatische/alterierte Dominante (+1 / -1) – sehr farbig
    {
        name: "chromatic_up",
        step: +1,
        types: ["dom7", "7b5", "7sharp5", "7b9", "7sharp9", "7b9b5"],
        weight: 0.4
    },
    {
        name: "chromatic_down",
        step: -1,
        types: ["dom7", "7b5", "7sharp5", "7b9", "7sharp9", "7b9b5"],
        weight: 0.4
    }
];

const KEY_SCALES = {
  "C":     ["major", ["C","Dm","Em","F","G","Am","Bdim"]],
  "G":     ["major", ["G","Am","Bm","C","D","Em","F#dim"]],
  "D":     ["major", ["D","Em","F#m","G","A","Bm","C#dim"]],
  "A":     ["major", ["A","Bm","C#m","D","E","F#m","G#dim"]],
  "E":     ["major", ["E","F#m","G#m","A","B","C#m","D#dim"]],
  "B":     ["major", ["B","C#m","D#m","E","F#","G#m","A#dim"]],
  "F#":    ["major", ["F#","G#m","A#m","B","C#","D#m","E#dim"]],
  "C#":    ["major", ["C#","D#m","E#m","F#","G#","A#m","B#dim"]],

  "F":     ["major", ["F","Gm","Am","Bb","C","Dm","Edim"]],
  "Bb":    ["major", ["Bb","Cm","Dm","Eb","F","Gm","Adim"]],
  "Eb":    ["major", ["Eb","Fm","Gm","Ab","Bb","Cm","Ddim"]],
  "Ab":    ["major", ["Ab","Bbm","Cm","Db","Eb","Fm","Gdim"]],

  // Molltonarten (natürliches Moll)
  "Am":    ["minor", ["Am","Bdim","C","Dm","Em","F","G"]],
  "Em":    ["minor", ["Em","F#dim","G","Am","Bm","C","D"]],
  "Bm":    ["minor", ["Bm","C#dim","D","Em","F#m","G","A"]],
  "F#m":   ["minor", ["F#m","G#dim","A","Bm","C#m","D","E"]],
  "C#m":   ["minor", ["C#m","D#dim","E","F#m","G#m","A","B"]],
  "G#m":   ["minor", ["G#m","A#dim","B","C#m","D#m","E","F#"]],
  "D#m":   ["minor", ["D#m","E#dim","F#","G#m","A#m","B","C#"]],
  "A#m":   ["minor", ["A#m","B#dim","C#","D#m","E#m","F#","G#"]],

  "Dm":    ["minor", ["Dm","Edim","F","Gm","Am","Bb","C"]],
  "Gm":    ["minor", ["Gm","Adim","Bb","Cm","Dm","Eb","F"]],
  "Cm":    ["minor", ["Cm","Ddim","Eb","Fm","Gm","Ab","Bb"]],
  "Fm":    ["minor", ["Fm","Gdim","Ab","Bbm","Cm","Db","Eb"]],
};

function noteName(pc, useFlats = false) {
    return useFlats ? NOTENAMES.flat[pc] : NOTENAMES.sharp[pc];
}

function normalizeNotes(midiNotes) {
  return midiNotes.map(n => ({
    midi: n,
    pc: n % 12,
    octaveOffset: n - (n % 12)
  }));
}

function getPitchClassSet(notes) {
  return [...new Set(notes.map(n => n.pc))].sort((a,b) => a - b);
}

function intervalsFromRoot(pcSet) {
  const root = pcSet[0];
  return pcSet.map(pc => (pc - root + 12) % 12).sort((a,b)=>a-b);
}

function detectChordType(pcSet) {
  const intervals = intervalsFromRoot(pcSet);

  for (const [type, structure] of Object.entries(CHORD_TYPES)) {
    if (structure.length !== intervals.length) continue;

    if (structure.every(i => intervals.includes(i))) {
      return type;
    }
  }

  return null;
}

function detectRoot(pcSet) {
  for (let i = 0; i < pcSet.length; i++) {
    const rotated = pcSet.slice(i).concat(pcSet.slice(0, i));
    const type = detectChordType(rotated);
    if (type) {
      return { rootPc: rotated[0], type };
    }
  }
  return null;
}

function detectChord(midiNotes) {
  if (midiNotes.length === 0) return null;

  const notes = normalizeNotes(midiNotes);
  const pcSet = getPitchClassSet(notes);

  if (pcSet.length < 2) return null; // Einzelton = kein Akkord

  const result = detectRoot(pcSet);
  if (!result) return null;

  // Oktavlage des Spielers übernehmen
  const playedRootMidi = notes.find(n => n.pc === result.rootPc)?.midi;
  const octaveOffset = playedRootMidi - result.rootPc;

  result.type=result.type.replace("#","sharp"); // für CSS-Klassen

  return {
    rootPc: result.rootPc,
    type: result.type,
    octaveOffset,
    label: noteName(result.rootPc) + result.type
  };
}

function onChordDetected(chord) {
  if (!chord) return;

  // Velocity merken (wie bisher)
  if (!lastPlayedChord) {
    currentVelocity = chord.velocity || 100;
    console.log("Set initial velocity to", currentVelocity);
  }

  // History aktualisieren
  addChordToHistory(chord);

  // UI aktualisieren
  renderCurrentChord(chord);
  renderNextChordsGrouped(chord);
  renderProbableKeys();

  lastPlayedChord = chord;
}

function renderCurrentChord(chord) {
  currentChordSection.innerHTML = "";

  const link = document.createElement("a");
  link.href = "#";
  link.textContent = displayChordType(chord.label);
  link.className = "current-chord type_" + chord.type;

  // Klick auf aktuellen Akkord = nichts tun
  link.addEventListener("click", (e) => e.preventDefault());

  currentChordSection.appendChild(link);
}

function renderNextChordsGrouped(currentChord) {

  const next = getNextChords(currentChord);
  const keyScores = computeKeyScores();
  const topKey = keyScores[0]?.key;
  // Diatonische Akkorde der aktuellen Tonart immer anzeigen
  const diatonicNames = KEY_SCALES[topKey]?.[1] || [];
  const diatonicChords = diatonicNames.map(name => parseChordName(name));

  const groups = {
    diatonic: [],
    functional: [],
    relative: [],
    chromatic: []
  };

  next.forEach(ch => {
    const name = chordToName(ch);

    // 1. Diatonisch?
    if (KEY_SCALES[topKey]?.[1].includes(name)) {
      groups.diatonic.push(ch);
      ch.group = "diatonic";
      return;
    }

    // 2. Funktional? (Sekundärdominanten)
    if (isSecondaryDominant(ch, topKey)) {
      groups.functional.push(ch);
      ch.group = "functional";
      return;
    }

    // 3. Verwandte Tonarten?
    if (belongsToRelativeKey(ch, topKey)) {
      groups.relative.push(ch);
      ch.group = "relative";
      return;
    }

    // 4. Chromatisch
    groups.chromatic.push(ch);
    ch.group = "chromatic";
  });
  groups.diatonic = diatonicChords;


  // HTML erzeugen
  nextChordsSection.innerHTML = "";
  const ul = document.createElement("ul");

  addGroupToList(ul, "Diatonic in " + topKey, groups.diatonic, topKey);
  addGroupToList(ul, "Functional chords", groups.functional, topKey);
  addGroupToList(ul, "Related keys", groups.relative, topKey);
  addGroupToList(ul, "Chromatic / altered", groups.chromatic, topKey);

  nextChordsSection.appendChild(ul);
}

// Hilfsfunktion, um eine Gruppe von Akkorden in die Liste einzufügen
function isSecondaryDominant(chord, key) {
  const root = chord.rootPc;
  const target = (root + 7) % 12; // Dominant führt zur Quinte

  const keyRoot = noteNameToPc(key.replace("m",""));

  return target === keyRoot;
}

// Hilfsfunktion, um eine Gruppe von Akkorden in die Liste einzufügen
function belongsToRelativeKey(chord, key) {
  const relatives = getRelativeKeys(key);
  const name = chordToName(chord);

  return relatives.some(relKey => KEY_SCALES[relKey]?.[1].includes(name));
}

// Hilfsfunktion, um eine Gruppe von Akkorden in die Liste einzufügen
function getRelativeKeys(key) {
  const major = key.endsWith("m") ? relativeMajor(key) : key;
  const minor = key.endsWith("m") ? key : relativeMinor(key);

  return [
    major,
    minor,
    dominantKey(major),
    subdominantKey(major)
  ];
}

// Hilfsfunktion, um eine Gruppe von Akkorden in die Liste einzufügen
function addGroupToList(parentUl, title, chords, key) {
  if (chords.length === 0) return;

  const li = document.createElement("li");
  li.textContent = title;

  const ul = document.createElement("ul");

  chords.forEach(ch => {
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = chordToName(ch);

    const prob = Math.round(ch.weight * 100);

    ch.type = ch.type.replace("#","sharp");

    link.className = [
      "chordlink",
      `prob_${prob}`,
      `group_${ch.group}`,
      `type_${ch.type}`,
      `key_${key.replace("#","sharp").replace("b","flat")}`
    ].join(" ");

    link.addEventListener("click", e => {
      e.preventDefault();
      if (!handlePassingChord(ch)) {
          playChord(ch);
      }

    });

    const subLi = document.createElement("li");
    subLi.appendChild(link);
    ul.appendChild(subLi);
  });

  li.appendChild(ul);
  parentUl.appendChild(li);
}


function getNextChords(chord) {
  return HARMONIC_RULES.flatMap(rule => {
    const newRoot = (chord.rootPc + rule.step + 12) % 12;

    return rule.types.map(type => {
      const label = noteName(newRoot) + type;

      return {
        rootPc: newRoot,
        type,
        weight: rule.weight,
        label
      };
    });
  });
}

function chordMidiNotes(rootPc, type, octaveOffset) {
  return CHORD_TYPES[type].map(interval => {
    const pc = (rootPc + interval) % 12;
    return pc + octaveOffset;
  });
}

function addChordToHistory(chord) {
  // 1. Kurze History aktualisieren
  chordHistory.push(chord);
  if (chordHistory.length > MAX_HISTORY) {
    chordHistory.shift();
  }

  // 2. Vollständige History (DOM)
  const link = document.createElement("a");
  link.href = "#";
  link.textContent = displayChordType(chord.label);
  link.className = "full-history-chord type_" + chord.type;

  link.addEventListener("click", (e) => {
    e.preventDefault();
    playChord(chord);
  });

  fullHistorySection.appendChild(link);

  // 3. UI aktualisieren
  renderChordHistory();
}


function renderChordHistory() {
  chordHistorySection.innerHTML = "";

  chordHistory.forEach((chord, index) => {
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = displayChordType(chord.label);
    link.className = "history-chord type_" + chord.type;

    // Klick auf einen History-Akkord
    link.addEventListener("click", (e) => {
      e.preventDefault();
      playChord(chord, index);
    });

    chordHistorySection.appendChild(link);
  });
}

function playChord(chord) {

  // lesen wir mal den bassnoten-modus...
  const bassMode = document.querySelector('input[name="bass"]:checked').value;

  addChordToHistory(chord);

  if (!midiOutput) return;

  // 1. Vorherigen Akkord ausschalten
  if (lastPlayedChord && lastPlayedChord.midiNotes) {
    lastPlayedChord.midiNotes.forEach(n => {
      midiOutput.send([0x80, n, 0]);
      // internen synth ausschalten
      supersawNoteOff(n);
    });
  }

  // 2. Neue MIDI-Noten erzeugen

  const normalizedType = normalizeChordType(chord.type);

  let base = generateBaseVoicing(chord.rootPc, normalizedType);

  if (initialVoicingCenter !== null) {
      base = adjustVoicingToCenter(base, initialVoicingCenter);
  }

  const midiNotes = base;

  if (initialVoicingCenter === null) {
    const avg = midiNotes.reduce((a, n) => a + n, 0) / midiNotes.length;
    initialVoicingCenter = avg;
  }

  // Bassnote hinzufügen, wenn gewünscht
  let bassNote = null;

  if (bassMode === "Root") {
      bassNote = chord.rootPc;
  }

  if (bassMode === "Key") {
      bassNote = currentKeyRootPc;
  }

  if (bassNote !== null) {
    const center = Math.round(initialUserCenter ?? 60);
    const target = center + bassOctaveOffset;

    const pc = bassNote % 12;

    const base = target - (target % 12) + pc;
    const candidates = [base - 12, base, base + 12];

    bassNote = candidates.reduce((best, n) =>
        Math.abs(n - target) < Math.abs(best - target) ? n : best
    );

    if (bassNote < 24) bassNote = 24; // Sicherheit
  }


  if (bassNote !== null) {
    console.log(bassNote);
    midiNotes.unshift(bassNote); // Bass ganz unten
  }


  // 3. Velocity variieren
  midiNotes.forEach(n => {
      let vel = Math.max(
        1,
        Math.min(127, currentVelocity + (Math.random() * 20 - 10))
      );

      // Bassnote bekommt extra Velocity
      if (bassNote !== null && n === bassNote) {
          vel = Math.min(127, vel + bassVelocityBoost);
      }

      midiOutput.send([0x90, n, vel]);
      // internen synth nutzen
      supersawNoteOn(n, vel);
  });


  // 4. UI aktualisieren
  renderCurrentChord(chord);
  renderNextChordsGrouped(chord);
  renderProbableKeys();

  // 5. Speichern
  chord.midiNotes = midiNotes;
  lastPlayedChord = chord;
}

// Funktion zum Umwandeln eines Akkords in einen lesbaren Namen
function chordToName(chord) {
  const root = noteName(chord.rootPc);
  const type = chord.type;

  if (type === "major") return root;
  if (type === "minor") return root + "m";
  if (type === "diminished") return root + "dim";

  // später erweitern
  return root + displayChordType(type);
}

// Funktion zur Berechnung der wahrscheinlichsten Tonart basierend auf der Akkordhistorie
function computeKeyScores() {
    const scores = [];

    for (const key in KEY_SCALES) {
        const [mode, chords] = KEY_SCALES[key];

        let score = 0;

        // normale Bewertung
        chordHistory.forEach(ch => {
            const name = chordToName(ch);
            if (chords.includes(name)) {
                score++;
            }
        });

        // forced key bekommt Bonus, aber ersetzt nicht die Liste
        if (currentForcedKey === key) {
            score = Math.max(score, 9); // oder score += 2; je nach Geschmack
        }

        scores.push({ key, mode, score });
    }

    // sortieren: forced key zuerst, dann nach score
    scores.sort((a, b) => b.score - a.score);

    return scores;
}


// Funktion zum Rendern der wahrscheinlichsten Tonarten in der UI
function renderProbableKeys() {
  const scores = computeKeyScores();

  probableKeySection.innerHTML = "";

  const ul = document.createElement("ul");

  var count=0;

  scores.forEach(entry => {
    if (entry.score === 0) return; // nur sinnvolle Tonarten anzeigen

    const li = document.createElement("li");
    li.innerHTML = `${entry.key}<sup>${entry.score}</sup>`;
    li.className = `key_score_${entry.score} key_score_${entry.mode}`;
    li.addEventListener("click", e => { e.preventDefault(); setCurrentKey(entry.key); });
    ul.appendChild(li);
    if(count==0)    {
      currentKeyRootPc=noteNameToPc(entry.key.replace("m",""));
    }
    count++;
  });

  probableKeySection.appendChild(ul);
}

// Funktion zum Setzen der aktuellen Tonart (z.B. durch Klick auf die UI)
function setCurrentKey(key) {
  currentForcedKey = key;

  // UI neu berechnen
  renderProbableKeys();
  renderNextChordsGrouped(lastPlayedChord);
}


function noteNameToPc(name) {
  // Normalisieren
  name = name.trim();

  // Großbuchstaben für Stammtöne
  name = name.charAt(0).toUpperCase() + name.slice(1);

  // Enharmonische Tabelle
  const map = {
    "C": 0,  "B#": 0,
    "C#": 1, "Db": 1,
    "D": 2,
    "D#": 3, "Eb": 3,
    "E": 4,  "Fb": 4,
    "E#": 5, "F": 5,
    "F#": 6, "Gb": 6,
    "G": 7,
    "G#": 8, "Ab": 8,
    "A": 9,
    "A#": 10, "Bb": 10,
    "B": 11, "Cb": 11
  };

  return map[name] ?? null;
}

// Funktionen für verwandte Tonarten
function relativeMinor(majorKey) {
  const root = majorKey.replace("m", "");
  const pc = noteNameToPc(root);
  if (pc === null) return null;

  const relPc = (pc + 9) % 12; // -3 Halbtöne
  return noteName(relPc) + "m";
}
function relativeMajor(minorKey) {
  const root = minorKey.replace("m", "");
  const pc = noteNameToPc(root);
  if (pc === null) return null;

  const relPc = (pc + 3) % 12; // +3 Halbtöne
  return noteName(relPc);
}
function dominantKey(majorKey) {
  const root = majorKey.replace("m", "");
  const pc = noteNameToPc(root);
  if (pc === null) return null;

  const domPc = (pc + 7) % 12;
  return noteName(domPc);
}
function subdominantKey(majorKey) {
  const root = majorKey.replace("m", "");
  const pc = noteNameToPc(root);
  if (pc === null) return null;

  const subPc = (pc + 5) % 12;
  return noteName(subPc);
}

function parseChordName(name) {
  // "Dm" → rootPc + type
  const match = name.match(/^([A-G][b#]?)(m|dim)?$/);
  if (!match) return null;

  const [, rootName, typeSuffix] = match;

  const type =
    typeSuffix === "m" ? "minor" :
    typeSuffix === "dim" ? "diminished" :
    "major";

  return {
    rootPc: noteNameToPc(rootName),
    type,
    label: name,
    octaveOffset: 60 // default
  };
}

function generateBaseVoicing(rootPc, type) {
    const intervals = CHORD_TYPES[type];
    if (!intervals) return [60 + rootPc];

    const center = initialUserCenter ?? 60;

    const pcs = intervals.map(i => (rootPc + i) % 12);

    const notes = pcs.map(pc => snapToNearestOctave(pc, center));

    return notes;
}


function snapToNearestOctave(targetPc, referenceMidi) {
    // Kandidaten: gleiche PC in Oktaven um die Referenz herum
    const base = referenceMidi - (referenceMidi % 12) + targetPc;

    const candidates = [
        base - 12,
        base,
        base + 12
    ];

    // Wähle den Kandidaten, der am nächsten zur Referenz liegt
    return candidates.reduce((best, n) =>
        Math.abs(n - referenceMidi) < Math.abs(best - referenceMidi) ? n : best
    );
}


function adjustVoicingToCenter(notes, center) {
    let adjusted = notes.slice();

    // Solange der Mittelwert zu hoch ist → eine Oktave runter
    while (average(adjusted) > center + 6) {
        adjusted = adjusted.map(n => n - 12);
    }

    // Solange der Mittelwert zu niedrig ist → eine Oktave hoch
    while (average(adjusted) < center - 6) {
        adjusted = adjusted.map(n => n + 12);
    }

    return adjusted;
}

function average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function normalizeChordType(type) {
  return type
    .replace(/#/g, "sharp")
    .replace(/b/g, "b"); // falls du später flats anders behandeln willst
}

function displayChordType(type) {
  return type
    .replace(/sharp/g, "#")
    .replace(/b/g, "b");
}

function buildPassingChord(targetChord) {
    const root = targetChord.rootPc;
    const type = targetChord.type;

    let passingRoot = root;
    let passingType = "dom7";

    if (type.includes("major") || type.includes("minor")) {
        passingRoot = (root + 11) % 12;
    } else if (type.includes("dom7")) {
        passingRoot = (root + 6) % 12;
    } else if (type.includes("dim")) {
        passingRoot = (root + 1) % 12;
    }

    const label = noteName(passingRoot) + passingType;

    return {
        rootPc: passingRoot,
        type: passingType,
        label,
        midiNotes: null,
        octaveOffset: 60
    };
}

function handlePassingChord(chord) {

    // PC ist aus → nichts tun
    if (!passingChordMode) return false;

    // PC ist an und wartet auf den ersten Klick → Passing Chord spielen
    if (passingChordArmed) {
        const passing = buildPassingChord(chord);
        playChord(passing);

        // One‑Shot verbraucht → PC aus
        passingChordArmed = false;
        passingChordMode = false;

        const btn = document.getElementById("passingchord");
        btn.style.background = "";
        btn.style.color = "";

        return true; // sagt dem Caller: "echten Akkord NICHT spielen"
    }

    return false; // echten Akkord spielen
}
