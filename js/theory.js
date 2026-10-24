/*
 * Figured theory engine.
 * It spells key signatures and the diatonic triads and seventh chords of major and minor keys.
 * Minor keys use harmonic minor for V, V7, vii°, and vii°7, and natural minor for the other chords.
 * It voices each chord for four parts (SATB) in close or open structure.
 * It sets window.Figured in a browser and module.exports in Node (for the tests).
 */
(function (global) {
  'use strict';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NAT_PC = [0, 2, 4, 5, 7, 9, 11];
  const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
  const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  // MIDI ranges [low, high] for S, A, T, B.
  const RANGES = [[60, 79], [55, 74], [48, 67], [40, 60]];
  // Letter indexes in the order of the sharps (F C G D A E B) and the flats (B E A D G C F).
  const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6];
  const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];

  // `rn` is the quality sign in a Roman numeral. `pop` is the suffix in a chord symbol.
  // Do not change an `id`: saved progress uses it.
  const QUALITIES = [
    { id: 'M', name: 'Major', seventh: false, upper: true, rn: '', pop: '' },
    { id: 'm', name: 'Minor', seventh: false, upper: false, rn: '', pop: 'm' },
    { id: 'd', name: 'Diminished', seventh: false, upper: false, rn: '°', pop: 'dim' },
    { id: 'D7', name: 'Dominant 7th', seventh: true, upper: true, rn: '', pop: '7' },
    { id: 'M7', name: 'Major 7th', seventh: true, upper: true, rn: 'M', pop: 'maj7' },
    { id: 'm7', name: 'Minor 7th', seventh: true, upper: false, rn: '', pop: 'm7' },
    { id: 'h7', name: 'Half-diminished 7th', seventh: true, upper: false, rn: 'ø', pop: 'm7♭5' },
    { id: 'd7', name: 'Diminished 7th', seventh: true, upper: false, rn: '°', pop: 'dim7' },
  ];
  // Semitones above the root of the third, fifth, and seventh.
  const INTERVAL_QUALITY = {
    '4,7': 'M', '3,7': 'm', '3,6': 'd',
    '4,7,10': 'D7', '4,7,11': 'M7', '3,7,10': 'm7', '3,6,10': 'h7', '3,6,9': 'd7',
  };
  const qualityById = (id) => QUALITIES.find((q) => q.id === id);

  // `full` is the complete figure for the answer chips. `rn` is the figure in a Roman numeral.
  const FIGURES = [
    { id: 't0', seventh: false, inv: 0, full: ['5', '3'], rn: [] },
    { id: 't1', seventh: false, inv: 1, full: ['6'], rn: ['6'] },
    { id: 't2', seventh: false, inv: 2, full: ['6', '4'], rn: ['6', '4'] },
    { id: 's0', seventh: true, inv: 0, full: ['7'], rn: ['7'] },
    { id: 's1', seventh: true, inv: 1, full: ['6', '5'], rn: ['6', '5'] },
    { id: 's2', seventh: true, inv: 2, full: ['4', '3'], rn: ['4', '3'] },
    { id: 's3', seventh: true, inv: 3, full: ['4', '2'], rn: ['4', '2'] },
  ];
  const figureById = (id) => FIGURES.find((f) => f.id === id);
  const INVERSION_NAMES = ['Root position', 'First inversion', 'Second inversion', 'Third inversion'];

  // ---------- helpers ----------

  const mod = (n, m) => ((n % m) + m) % m;
  const pick = (arr, rnd) => arr[Math.floor((rnd || Math.random)() * arr.length)];

  function accidentalSymbol(alter) {
    return { '-2': '♭♭', '-1': '♭', '0': '', '1': '♯', '2': '×' }[alter];
  }

  function noteName(n) {
    return LETTERS[n.letter] + accidentalSymbol(n.alter);
  }

  function spell(letter, pc) {
    let alter = mod(pc - NAT_PC[letter], 12);
    if (alter > 6) alter -= 12;
    return { letter, alter, pc };
  }

  // ---------- keys ----------

  // `sig` is the number of sharps (positive) or flats (negative).
  // Each sharp moves the major tonic up a fifth (4 letters, 7 semitones). The minor tonic is a minor third below.
  function makeKey(mode, sig) {
    const minor = mode === 'minor';
    const t = spell(mod(sig * 4 + (minor ? 5 : 0), 7), mod(sig * 7 + (minor ? 9 : 0), 12));
    return { mode, sig, letter: t.letter, alter: t.alter, tonicPC: t.pc, name: noteName(t) };
  }

  function keyName(key) {
    return `${key.name} ${key.mode}`;
  }

  function relativeKey(key) {
    return makeKey(key.mode === 'major' ? 'minor' : 'major', key.sig);
  }

  function signatureNotes(sig) {
    return (sig > 0 ? SHARP_ORDER : FLAT_ORDER).slice(0, Math.abs(sig))
      .map((letter) => ({ letter, alter: Math.sign(sig) }));
  }

  function signatureText(sig) {
    if (sig === 0) return 'no sharps or flats';
    const n = Math.abs(sig);
    const kind = sig > 0 ? 'sharp' : 'flat';
    return `${n} ${kind}${n > 1 ? 's' : ''} (${signatureNotes(sig).map(noteName).join(', ')})`;
  }

  function modesFor(keyMode) {
    return keyMode === 'both' ? ['major', 'minor'] : [keyMode];
  }

  function keysInRange(mode, maxAcc) {
    const out = [];
    for (let sig = -maxAcc; sig <= maxAcc; sig++) out.push(makeKey(mode, sig));
    return out;
  }

  // ---------- chords ----------

  function buildChord(key, degree, seventh) {
    const raise = key.mode === 'minor' && (degree === 4 || degree === 6);
    const tones = [0, 2, 4, 6].slice(0, seventh ? 4 : 3).map((step) => {
      const d = (degree + step) % 7;
      const pc = key.tonicPC + SCALE[key.mode][d] + (raise && d === 6 ? 1 : 0);
      return spell((key.letter + d) % 7, mod(pc, 12));
    });
    const iv = tones.slice(1).map((t) => mod(t.pc - tones[0].pc, 12));
    return { degree, seventh, tones, quality: INTERVAL_QUALITY[iv.join(',')] };
  }

  function figureId(chord, inversion) {
    return (chord.seventh ? 's' : 't') + inversion;
  }

  // Roman numeral parts. With no figure, a seventh chord shows 7 and a triad shows no figure.
  function romanNumeral(degree, qualityId, figId) {
    const q = qualityById(qualityId);
    return {
      numeral: q.upper ? NUMERALS[degree] : NUMERALS[degree].toLowerCase(),
      symbol: q.rn,
      figure: figId ? figureById(figId).rn : (q.seventh ? ['7'] : []),
    };
  }

  function romanText(rn) {
    return rn.numeral + rn.symbol + rn.figure.join('/');
  }

  function chordSymbol(root, qualityId, bass) {
    return noteName(root) + qualityById(qualityId).pop + (bass ? '/' + noteName(bass) : '');
  }

  function popSymbol(chord, inversion) {
    return chordSymbol(chord.tones[0], chord.quality, inversion ? chord.tones[inversion] : null);
  }

  // Chord tones (indexes) that a triad can double.
  // Root position doubles the root. Second inversion doubles the bass.
  // First inversion can double any tone except the leading tone. Diminished triads double the third.
  function doublings(key, chord, inversion) {
    if (chord.quality === 'd') return [1];
    if (inversion === 0) return [0];
    if (inversion === 2) return [2];
    const leading = mod(key.tonicPC - 1, 12);
    return [0, 1, 2].filter((i) => chord.tones[i].pc !== leading);
  }

  // All SATB voicings of a chord in the ranges.
  // Close structure: less than an octave between soprano and tenor. Open structure: an octave or more.
  // If the preferred doublings give no voicing, the chord can double any tone except the leading tone.
  function voicings(key, chord, inversion) {
    const out = voicingsWith(chord, inversion, chord.seventh ? [] : doublings(key, chord, inversion));
    if (out.length || chord.seventh) return out;
    const leading = mod(key.tonicPC - 1, 12);
    return voicingsWith(chord, inversion, [0, 1, 2].filter((i) => chord.tones[i].pc !== leading));
  }

  function voicingsWith(chord, inversion, doubled) {
    const pcs = chord.tones.map((t) => t.pc);
    const needs = chord.seventh ? [pcs.map(() => 1)]
      : doubled.map((d) => pcs.map((_, i) => (i === d ? 2 : 1)));
    const inRange = ([lo, hi], ok) => {
      const out = [];
      for (let m = lo; m <= hi; m++) if (ok(mod(m, 12))) out.push(m);
      return out;
    };
    const chordTone = (pc) => pcs.includes(pc);
    const out = [];
    inRange(RANGES[3], (pc) => pc === pcs[inversion]).forEach((b) => {
      inRange(RANGES[2], chordTone).forEach((t) => {
        if (t <= b || t - b > 19) return;
        inRange(RANGES[1], chordTone).forEach((a) => {
          if (a <= t || a - t > 12) return;
          inRange(RANGES[0], chordTone).forEach((s) => {
            if (s <= a || s - a > 12) return;
            const count = pcs.map(() => 0);
            [s, a, t, b].forEach((m) => count[pcs.indexOf(mod(m, 12))]++);
            if (!needs.some((need) => need.every((c, i) => c === count[i]))) return;
            out.push({ midis: [s, a, t, b], structure: s - t < 12 ? 'close' : 'open' });
          });
        });
      });
    });
    return out;
  }

  // Spell a MIDI note as one of the chord tones, with its octave.
  function spellMidi(chord, midi) {
    const t = chord.tones.find((x) => x.pc === mod(midi, 12));
    return { letter: t.letter, alter: t.alter, oct: (midi - t.alter - NAT_PC[t.letter]) / 12 - 1, midi };
  }

  // ---------- questions ----------

  // opts: { keyMode, maxAcc, clef: 'treble' | 'bass' | 'both' }
  function generateKeyQuestion(opts, rnd) {
    rnd = rnd || Math.random;
    const mode = pick(modesFor(opts.keyMode), rnd);
    const sig = Math.floor(rnd() * (2 * opts.maxAcc + 1)) - opts.maxAcc;
    const clef = opts.clef === 'both' ? pick(['treble', 'bass'], rnd) : opts.clef;
    return { kind: 'key', key: makeKey(mode, sig), clef };
  }

  // Chord type and inversion pairs that the options allow.
  function chordCombos(types, inversions) {
    const out = [];
    types.forEach((type) => {
      const seventh = type === 'seventh';
      inversions.forEach((inv) => { if (inv < (seventh ? 4 : 3)) out.push({ seventh, inv }); });
    });
    return out;
  }

  // opts: { keyMode, maxAcc, types: ['triad', 'seventh'], inversions: [0..3] }
  // Returns null if the options allow no chord.
  function generateChordQuestion(opts, rnd) {
    rnd = rnd || Math.random;
    const combos = chordCombos(opts.types, opts.inversions);
    if (!combos.length) return null;
    const key = makeKey(pick(modesFor(opts.keyMode), rnd),
      Math.floor(rnd() * (2 * opts.maxAcc + 1)) - opts.maxAcc);
    const { seventh, inv } = pick(combos, rnd);
    const chord = buildChord(key, Math.floor(rnd() * 7), seventh);
    const all = voicings(key, chord, inv);
    // Pick close or open first, so that both occur equally often. Some chords have only one of the two.
    const wanted = pick(['close', 'open'], rnd);
    const some = all.filter((v) => v.structure === wanted);
    const v = pick(some.length ? some : all, rnd);
    return {
      kind: 'chord',
      key,
      chord,
      inversion: inv,
      structure: v.structure,
      notes: v.midis.map((m) => spellMidi(chord, m)), // S, A, T, B
    };
  }

  // Tonic triad for playback: bass, then a close root-position triad near middle C.
  function tonicTriadMidis(key) {
    const third = key.mode === 'major' ? 4 : 3;
    const root = 55 + mod(key.tonicPC - 7, 12);
    return [root - 12, root, root + third, root + 7];
  }

  const api = {
    LETTERS, NUMERALS, QUALITIES, FIGURES, INVERSION_NAMES, RANGES,
    qualityById, figureById, accidentalSymbol, noteName,
    makeKey, keyName, relativeKey, signatureNotes, signatureText, keysInRange,
    buildChord, figureId, romanNumeral, romanText, chordSymbol, popSymbol, voicings,
    chordCombos, generateKeyQuestion, generateChordQuestion, tonicTriadMidis,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Figured = api;
})(typeof window !== 'undefined' ? window : this);
