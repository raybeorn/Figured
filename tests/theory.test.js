// Checks the key spelling, the chord spelling, and the SATB voicings for every key, chord, and inversion.
// Run with: node tests/theory.test.js
const F = require('../js/theory.js');

let failures = 0;
const fail = (msg) => { failures++; console.log('FAIL', msg); };
const mod = (n, m) => ((n % m) + m) % m;

// Key names around the circle of fifths.
const MAJOR = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'];
const MINOR = ['A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'A♯'];
for (let sig = -7; sig <= 7; sig++) {
  const maj = F.makeKey('major', sig).name;
  const min = F.makeKey('minor', sig).name;
  if (maj !== MAJOR[sig + 7]) fail(`major key for sig ${sig}: ${maj}`);
  if (min !== MINOR[sig + 7]) fail(`minor key for sig ${sig}: ${min}`);
}

// Diatonic qualities by scale degree.
const QUAL = {
  major: { triad: ['M', 'm', 'm', 'M', 'M', 'm', 'd'], seventh: ['M7', 'm7', 'm7', 'M7', 'D7', 'm7', 'h7'] },
  minor: { triad: ['m', 'd', 'M', 'm', 'M', 'M', 'd'], seventh: ['m7', 'h7', 'M7', 'm7', 'D7', 'M7', 'd7'] },
};

let close = 0;
let open = 0;
for (const mode of ['major', 'minor']) {
  for (let sig = -7; sig <= 7; sig++) {
    const key = F.makeKey(mode, sig);
    for (const seventh of [false, true]) {
      for (let deg = 0; deg < 7; deg++) {
        const chord = F.buildChord(key, deg, seventh);
        const want = QUAL[mode][seventh ? 'seventh' : 'triad'][deg];
        if (chord.quality !== want) fail(`${F.keyName(key)} degree ${deg + 1} ${seventh ? '7th' : 'triad'}: ${chord.quality}`);
        chord.tones.forEach((t, i) => {
          if (t.letter !== (key.letter + deg + 2 * i) % 7) fail(`${F.keyName(key)} letters of degree ${deg + 1}`);
          if (Math.abs(t.alter) > 2) fail(`${F.keyName(key)} accidental ${t.alter}`);
        });
        for (let inv = 0; inv < (seventh ? 4 : 3); inv++) {
          const vs = F.voicings(key, chord, inv);
          if (!vs.length) fail(`no voicing: ${F.keyName(key)} ${F.popSymbol(chord, inv)}`);
          if (vs.some((v) => v.structure === 'close')) close++;
          if (vs.some((v) => v.structure === 'open')) open++;
          vs.forEach((v) => {
            const [s, a, t, b] = v.midis;
            if (mod(b, 12) !== chord.tones[inv].pc) fail('bass is not the inversion tone');
            if (!(b < t && t < a && a < s)) fail('voices out of order');
            if (s - a > 12 || a - t > 12) fail('upper voices more than an octave apart');
            if (new Set(v.midis.map((m) => mod(m, 12))).size !== chord.tones.length) fail('incomplete chord');
            if (v.structure === 'close' && s - t >= 12) fail('close structure spans an octave');
            if (v.structure === 'open' && s - t < 12) fail('open structure under an octave');
          });
        }
      }
    }
  }
}

// Generated questions: notes spell the chord and sound at the right pitch.
const NAT_PC = [0, 2, 4, 5, 7, 9, 11];
const opts = { keyMode: 'both', maxAcc: 7, types: ['triad', 'seventh'], inversions: [0, 1, 2, 3] };
const seen = { close: 0, open: 0 };
for (let i = 0; i < 3000; i++) {
  const q = F.generateChordQuestion(opts);
  seen[q.structure]++;
  q.notes.forEach((n) => {
    if ((n.oct + 1) * 12 + NAT_PC[n.letter] + n.alter !== n.midi) fail(`spelling of MIDI ${n.midi}`);
    if (!Number.isInteger(n.oct)) fail('octave is not an integer');
  });
}
if (seen.close < 900 || seen.open < 900) fail(`close/open balance: ${JSON.stringify(seen)}`);
if (F.generateChordQuestion({ ...opts, types: ['triad'], inversions: [3] }) !== null) fail('third-inversion triad');

// Roman numeral and chord-symbol labels.
const C = F.makeKey('major', 0);
const checks = [
  [F.romanText(F.romanNumeral(1, 'm7', 's1')), 'ii6/5'],
  [F.romanText(F.romanNumeral(6, 'h7', 's0')), 'viiø7'],
  [F.romanText(F.romanNumeral(0, 'M', 't2')), 'I6/4'],
  [F.romanText(F.romanNumeral(0, 'M7', null)), 'IM7'],
  [F.popSymbol(F.buildChord(C, 1, true), 1), 'Dm7/F'],
  [F.popSymbol(F.buildChord(C, 4, true), 3), 'G7/F'],
  [F.popSymbol(F.buildChord(F.makeKey('minor', 7), 4, false), 1), 'E♯/G×'],
];
checks.forEach(([got, want]) => { if (got !== want) fail(`label ${got}, expected ${want}`); });

console.log(`Chords with a close voicing: ${close}, with an open voicing: ${open} (of ${2 * 15 * 7 * 7})`);
console.log(failures ? `${failures} failure(s)` : 'All tests passed');
process.exit(failures ? 1 : 0);
