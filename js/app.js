(function () {
  'use strict';

  const F = window.Figured;
  const $ = (sel) => document.querySelector(sel);
  const SETTINGS_KEY = 'figured-settings-v1';
  const STATS_KEY = 'figured-stats-v1';

  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
  };

  // ---------- notation in text ----------

  // A figure with two numbers is stacked. A figure with one number is raised.
  function figHtml(figure) {
    if (figure.length === 2) return `<span class="figs"><span>${figure[0]}</span><span>${figure[1]}</span></span>`;
    return figure.length ? `<sup>${figure[0]}</sup>` : '';
  }

  function rnHtml(rn) {
    const sym = rn.symbol === 'M' ? '<sup class="q">M</sup>' : rn.symbol;
    return `<span class="rnum">${rn.numeral}${sym}${figHtml(rn.figure)}</span>`;
  }

  // ---------- settings ----------

  // All pages on the same origin share saved data. On GitHub Pages, this includes all project sites of the account.
  // Validate the data before use.
  const DRILLS = ['chords', 'keys'];
  const KEY_MODES = ['both', 'major', 'minor'];
  const MAX_ACC = [3, 5, 7];
  const CLEFS = ['both', 'treble', 'bass'];
  const TYPES = ['triad', 'seventh'];
  const INVERSIONS = [0, 1, 2, 3];
  const LABELS = ['rn', 'fb', 'pop'];

  function list(value, allowed, fallback) {
    const out = Array.isArray(value) ? [...new Set(value.filter((v) => allowed.includes(v)))] : [];
    return out.length ? out : fallback.slice();
  }

  function loadSettings() {
    const s = store.get(SETTINGS_KEY, {});
    return {
      drill: DRILLS.includes(s.drill) ? s.drill : 'chords',
      keyMode: KEY_MODES.includes(s.keyMode) ? s.keyMode : 'both',
      maxAcc: MAX_ACC.includes(Number(s.maxAcc)) ? Number(s.maxAcc) : 7,
      clef: CLEFS.includes(s.clef) ? s.clef : 'both',
      types: list(s.types, TYPES, TYPES),
      inversions: list(Array.isArray(s.inversions) ? s.inversions.map(Number) : null, INVERSIONS, INVERSIONS),
      labels: list(s.labels, LABELS, ['rn', 'fb']),
      structure: s.structure !== false,
    };
  }

  const settings = loadSettings();
  const saveSettings = () => store.set(SETTINGS_KEY, settings);

  // ---------- progress ----------

  const STAT_GROUPS = [
    { name: 'Key signatures', rows: [['key-major', 'Major keys'], ['key-minor', 'Minor keys']] },
    { name: 'Chord quality', rows: F.QUALITIES.map((q) => ['q-' + q.id, q.name]) },
    { name: 'Inversion', rows: F.INVERSION_NAMES.map((n, i) => ['inv-' + i, n]) },
    { name: 'Structure', rows: [['st-close', 'Close'], ['st-open', 'Open']] },
  ];
  const STAT_IDS = STAT_GROUPS.flatMap((g) => g.rows.map((r) => r[0]));

  function loadStats() {
    const saved = store.get(STATS_KEY, {});
    const out = {};
    STAT_IDS.forEach((id) => {
      const s = saved[id] || {};
      const seen = Math.floor(Number(s.seen));
      const correct = Math.floor(Number(s.correct));
      if (seen > 0 && seen < 1e9) out[id] = { seen, correct: correct >= 0 ? Math.min(correct, seen) : 0 };
    });
    return out;
  }

  let topicStats = loadStats();
  const session = { correct: 0, total: 0, streak: 0 };

  // ---------- option chips ----------

  // Chips are <button> elements. aria-pressed shows the selection to keyboard and screen-reader users.
  function setChip(chip, on) {
    chip.classList.toggle('selected', on);
    chip.setAttribute('aria-pressed', String(on));
  }
  function selectChips(row, values) {
    row.querySelectorAll('.chip, .mode-tab').forEach((c) => setChip(c, values.includes(c.dataset.value)));
  }

  // One chip selected in the row.
  function initSingle(id, get, set) {
    const row = $(id);
    selectChips(row, [String(get())]);
    row.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip, .mode-tab');
      if (!chip || chip.classList.contains('selected')) return;
      selectChips(row, [chip.dataset.value]);
      set(chip.dataset.value);
      saveSettings();
      onOptionsChange();
    });
  }

  // Any number of chips selected in the row, but at least one.
  function initMulti(id, key, parse) {
    const row = $(id);
    selectChips(row, settings[key].map(String));
    row.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const value = parse(chip.dataset.value);
      const on = settings[key].includes(value);
      if (on && settings[key].length === 1) return;
      settings[key] = on ? settings[key].filter((v) => v !== value) : settings[key].concat(value);
      setChip(chip, !on);
      saveSettings();
      onOptionsChange();
    });
  }

  initSingle('#drill', () => settings.drill, (v) => { settings.drill = v; });
  initSingle('#key-mode', () => settings.keyMode, (v) => { settings.keyMode = v; });
  initSingle('#max-acc', () => settings.maxAcc, (v) => { settings.maxAcc = Number(v); });
  initSingle('#clef', () => settings.clef, (v) => { settings.clef = v; });
  initMulti('#types', 'types', String);
  initMulti('#inversions', 'inversions', Number);
  initMulti('#labels', 'labels', String);
  setChip($('#structure .chip'), settings.structure);
  $('#structure .chip').addEventListener('click', (e) => {
    settings.structure = !settings.structure;
    setChip(e.currentTarget, settings.structure);
    saveSettings();
    onOptionsChange();
  });

  function showDrillOptions() {
    document.querySelectorAll('[data-for]').forEach((el) => { el.hidden = el.dataset.for !== settings.drill; });
    // Third inversion exists only for seventh chords.
    $('#inversions [data-value="3"]').classList.toggle('off', !settings.types.includes('seventh'));
  }

  function onOptionsChange() {
    showDrillOptions();
    newQuestion();
  }

  // ---------- questions ----------

  let q = null;        // current question
  let last = null;     // previous question, to avoid a repeat
  let answer = {};     // selected chip value by field
  let checked = false;

  const has = (label) => settings.labels.includes(label);

  const ACC_CHIPS = [-2, -1, 0, 1, 2].map((a) => ({ value: String(a), html: a ? F.accidentalSymbol(a) : '♮' }));
  const LETTER_CHIPS = F.LETTERS.map((l, i) => ({ value: String(i), html: l }));

  // Answer sections for the question. Each row is one field. A row with `def` starts with that value.
  function sectionsFor(question) {
    if (question.kind === 'key') {
      return [{
        label: `Which ${question.key.mode} key?`,
        rows: [{
          field: 'key',
          chips: F.keysInRange(question.key.mode, settings.maxAcc).map((k) => ({ value: String(k.sig), html: k.name })),
        }],
      }];
    }
    const out = [];
    const types = settings.types;
    if (has('rn')) {
      out.push({ label: 'Scale degree', rows: [{ field: 'degree', chips: F.NUMERALS.map((n, i) => ({ value: String(i), html: n })) }] });
    }
    if (has('rn') || has('pop')) {
      out.push({
        label: 'Quality',
        rows: [{
          field: 'quality',
          chips: F.QUALITIES.filter((x) => types.includes(x.seventh ? 'seventh' : 'triad')).map((x) => ({ value: x.id, html: x.name })),
        }],
      });
    }
    if (has('fb')) {
      out.push({
        label: 'Figured bass',
        rows: [{
          field: 'figure',
          chips: F.FIGURES.filter((f) => types.includes(f.seventh ? 'seventh' : 'triad') && settings.inversions.includes(f.inv))
            .map((f) => ({ value: f.id, html: figHtml(f.full) })),
        }],
      });
    }
    if (has('pop')) {
      out.push({ label: 'Chord symbol: root', rows: [{ field: 'rootL', chips: LETTER_CHIPS }, { field: 'rootA', chips: ACC_CHIPS, def: '0' }] });
      out.push({
        label: 'Chord symbol: bass (slash)',
        rows: [{ field: 'bassL', chips: [{ value: 'none', html: 'No slash' }].concat(LETTER_CHIPS) }, { field: 'bassA', chips: ACC_CHIPS, def: '0' }],
      });
    }
    if (settings.structure) {
      out.push({ label: 'Structure', rows: [{ field: 'structure', chips: [{ value: 'close', html: 'Close' }, { value: 'open', html: 'Open' }] }] });
    }
    return out;
  }

  const sameQuestion = (a, b) => a && b && a.kind === b.kind && a.key.sig === b.key.sig && a.key.mode === b.key.mode &&
    (a.kind === 'key' || (a.chord.degree === b.chord.degree && a.chord.seventh === b.chord.seventh && a.inversion === b.inversion));

  function newQuestion() {
    stopAudio();
    checked = false;
    answer = {};
    let next = null;
    for (let i = 0; i < 10 && (!next || sameQuestion(next, last)); i++) {
      next = settings.drill === 'keys'
        ? F.generateKeyQuestion(settings)
        : F.generateChordQuestion(settings);
    }
    q = next;
    last = q;
    renderQuestion();
  }

  function renderQuestion() {
    const card = $('#question');
    card.classList.remove('correct', 'revealed');
    $('#feedback').className = 'feedback';
    $('#feedback').innerHTML = '';
    if (!q) {
      $('#prompt').textContent = 'Third inversion is only for seventh chords. Add seventh chords or another inversion.';
      $('#staff').innerHTML = '';
      $('#answers').innerHTML = '';
      $('#preview').innerHTML = '';
      ['#check', '#reveal', '#play', '#arpeggio'].forEach((s) => { $(s).hidden = true; });
      return;
    }
    ['#check', '#reveal', '#play'].forEach((s) => { $(s).hidden = false; });
    $('#arpeggio').hidden = q.kind === 'key';
    $('#check').textContent = 'Check';
    $('#reveal').hidden = false;

    if (q.kind === 'key') {
      $('#prompt').innerHTML = `Name the <b>${q.key.mode}</b> key`;
      $('#play').textContent = '▶ Tonic';
      $('#play').disabled = true; // The tonic chord shows the answer. Enable it after the check.
      Staff.renderKey($('#staff'), q.key.sig, q.clef);
    } else {
      $('#prompt').innerHTML = `Key: <b>${F.keyName(q.key)}</b>`;
      $('#play').textContent = '▶ Play';
      $('#play').disabled = false;
      Staff.renderChord($('#staff'), q);
    }

    const box = $('#answers');
    box.innerHTML = '';
    sectionsFor(q).forEach((sec) => {
      const el = document.createElement('div');
      el.className = 'answer-section';
      el.innerHTML = `<div class="group-label">${sec.label}</div>`;
      sec.rows.forEach((row) => {
        if (row.def !== undefined) answer[row.field] = row.def;
        const r = document.createElement('div');
        r.className = 'chip-row' + (row.chips === ACC_CHIPS ? ' acc-row' : '');
        r.dataset.field = row.field;
        r.innerHTML = row.chips.map((c) =>
          `<button type="button" class="chip" data-value="${c.value}">${c.html}</button>`).join('');
        selectChips(r, [answer[row.field]]);
        el.appendChild(r);
      });
      box.appendChild(el);
    });
    updatePreview();
  }

  $('#answers').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip || checked) return;
    const row = chip.closest('.chip-row');
    answer[row.dataset.field] = chip.dataset.value;
    selectChips(row, [chip.dataset.value]);
    if (!$('#feedback').classList.contains('good')) { $('#feedback').className = 'feedback'; $('#feedback').innerHTML = ''; }
    updatePreview();
  });

  const pickedNote = (l, a) => ({ letter: Number(answer[l]), alter: Number(answer[a]) });

  // Show the current answer in the same format as the correct answer.
  function updatePreview() {
    const parts = [];
    if (q && q.kind === 'chord') {
      if (has('rn') && answer.degree && answer.quality) {
        const fig = has('fb') && answer.figure ? answer.figure : null;
        parts.push(rnHtml(F.romanNumeral(Number(answer.degree), answer.quality, fig)));
      } else if (has('fb') && answer.figure) {
        parts.push(figHtml(F.figureById(answer.figure).full));
      }
      if (has('pop') && answer.rootL && answer.quality && answer.bassL) {
        const bass = answer.bassL === 'none' ? null : pickedNote('bassL', 'bassA');
        parts.push(`<span class="pop">${F.chordSymbol(pickedNote('rootL', 'rootA'), answer.quality, bass)}</span>`);
      }
      if (answer.structure) parts.push(answer.structure === 'close' ? 'Close' : 'Open');
    }
    $('#preview').innerHTML = parts.length ? `Your answer: ${parts.join(' · ')}` : '';
  }

  // ---------- checking ----------

  function missing() {
    return [...document.querySelectorAll('#answers .chip-row')]
      .some((row) => answer[row.dataset.field] === undefined && !(row.dataset.field === 'bassA' && answer.bassL === 'none'));
  }

  function keyParts() {
    return [{ label: 'Key', ok: Number(answer.key) === q.key.sig, html: F.keyName(q.key) }];
  }

  function chordParts() {
    const c = q.chord;
    const inv = q.inversion;
    const fig = F.figureId(c, inv);
    const parts = [];
    if (has('rn')) {
      parts.push({
        label: 'Roman numeral',
        ok: Number(answer.degree) === c.degree && answer.quality === c.quality,
        html: rnHtml(F.romanNumeral(c.degree, c.quality, fig)),
      });
    }
    if (has('fb')) {
      parts.push({
        label: 'Figured bass',
        ok: answer.figure === fig,
        html: `${figHtml(F.figureById(fig).full)} ${F.INVERSION_NAMES[inv].toLowerCase()}`,
      });
    }
    if (has('pop')) {
      const same = (n, l, a) => n.letter === Number(answer[l]) && n.alter === Number(answer[a]);
      const bassOk = inv === 0 ? answer.bassL === 'none' : answer.bassL !== 'none' && same(c.tones[inv], 'bassL', 'bassA');
      parts.push({
        label: 'Chord symbol',
        ok: same(c.tones[0], 'rootL', 'rootA') && answer.quality === c.quality && bassOk,
        html: `<span class="pop">${F.popSymbol(c, inv)}</span>`,
      });
    }
    if (settings.structure) {
      parts.push({ label: 'Structure', ok: answer.structure === q.structure, html: q.structure === 'close' ? 'Close' : 'Open' });
    }
    return parts;
  }

  function keyExplanation(key) {
    const rel = F.relativeKey(key);
    const sig = key.sig;
    let tip;
    if (key.mode === 'minor') {
      tip = `The major key with this signature is ${F.keyName(rel)}. Go down a minor third to ${key.name}.`;
    } else if (sig === 0) {
      tip = 'No sharps or flats is C major.';
    } else if (sig > 0) {
      tip = `The last sharp, ${F.noteName(F.signatureNotes(sig)[sig - 1])}, is the leading tone. A half step up is ${key.name}.`;
    } else if (sig === -1) {
      tip = 'One flat is F major.';
    } else {
      tip = `The second-to-last flat, ${F.noteName(F.signatureNotes(sig)[-sig - 2])}, is the major key.`;
    }
    return `${F.signatureText(sig)}. ${tip} Relative ${rel.mode}: ${F.keyName(rel)}.`;
  }

  function chordExplanation() {
    const [s, , t, b] = q.notes;
    const tones = q.chord.tones.map(F.noteName).join(' – ');
    const span = s.midi - t.midi;
    const structure = q.structure === 'close'
      ? `Soprano and tenor are less than an octave apart (${span} half steps), so the structure is close.`
      : `Soprano and tenor are an octave or more apart (${span} half steps), so the structure is open.`;
    return `Chord tones: ${tones}. ${F.qualityById(q.chord.quality).name}. ` +
      `The bass, ${F.noteName(b)}, is the ${['root', 'third', 'fifth', 'seventh'][q.inversion]}. ` +
      (settings.structure ? structure : '');
  }

  // Only the first answer counts for the score.
  function score(correct) {
    const ids = q.kind === 'key' ? ['key-' + q.key.mode]
      : ['q-' + q.chord.quality, 'inv-' + q.inversion].concat(settings.structure ? ['st-' + q.structure] : []);
    ids.forEach((id) => {
      const s = topicStats[id] || { seen: 0, correct: 0 };
      s.seen++;
      if (correct) s.correct++;
      topicStats[id] = s;
    });
    store.set(STATS_KEY, topicStats);
    session.total++;
    if (correct) { session.correct++; session.streak++; } else session.streak = 0;
    renderStats();
  }

  // The correct chip value for each answer field.
  function correctValues() {
    if (q.kind === 'key') return { key: String(q.key.sig) };
    const c = q.chord;
    const root = c.tones[0];
    const bass = c.tones[q.inversion];
    return {
      degree: String(c.degree),
      quality: c.quality,
      figure: F.figureId(c, q.inversion),
      rootL: String(root.letter),
      rootA: String(root.alter),
      bassL: q.inversion ? String(bass.letter) : 'none',
      bassA: q.inversion ? String(bass.alter) : null,
      structure: q.structure,
    };
  }

  // Mark the correct chip in each row, and the user's chip if it is wrong.
  function markChips() {
    const want = correctValues();
    document.querySelectorAll('#answers .chip-row').forEach((row) => {
      const field = row.dataset.field;
      if (want[field] == null) return; // Not graded: the bass accidental of a root-position chord.
      row.querySelectorAll('.chip').forEach((chip) => {
        const right = chip.dataset.value === want[field];
        chip.classList.toggle('right', right);
        chip.classList.toggle('wrong', !right && chip.dataset.value === answer[field]);
      });
    });
  }

  function finish(parts, correct, revealed) {
    checked = true;
    score(correct);
    markChips();
    const card = $('#question');
    card.classList.add(correct ? 'correct' : 'revealed');
    const fb = $('#feedback');
    fb.className = 'feedback ' + (correct ? 'good' : 'bad');
    const head = correct ? '✓ Correct' : revealed ? 'Answer' : '✗ Not quite';
    fb.innerHTML = `<strong>${head}</strong><ul class="parts">` +
      parts.map((p) => `<li>${revealed ? '' : p.ok ? '✓ ' : '✗ '}${p.label}: ${p.html}</li>`).join('') +
      `</ul><span class="why">${q.kind === 'key' ? keyExplanation(q.key) : chordExplanation()}</span>`;
    $('#check').textContent = 'Next →';
    $('#reveal').hidden = true;
    $('#play').disabled = false;
  }

  function check() {
    if (!q) return;
    if (checked) { newQuestion(); return; }
    if (missing()) {
      const fb = $('#feedback');
      fb.className = 'feedback bad';
      fb.textContent = 'Answer every part first.';
      return;
    }
    const parts = q.kind === 'key' ? keyParts() : chordParts();
    finish(parts, parts.every((p) => p.ok), false);
  }

  function reveal() {
    if (!q || checked) return;
    finish(q.kind === 'key' ? keyParts() : chordParts(), false, true);
  }

  function renderStats() {
    $('#st-correct').textContent = session.correct;
    $('#st-total').textContent = session.total;
    $('#st-acc').textContent = session.total ? `${Math.round(100 * session.correct / session.total)}%` : '---';
    $('#st-streak').textContent = session.streak;
    $('#topic-stats').innerHTML = STAT_GROUPS.map((g) =>
      `<tr class="cat-row"><th colspan="3">${g.name}</th></tr>` + g.rows.map(([id, name]) => {
        const s = topicStats[id];
        const pct = s && s.seen ? Math.round(100 * s.correct / s.seen) : null;
        return `<tr><td>${name}</td>` +
          `<td>${s ? `${s.correct} / ${s.seen}` : '<span class="muted">---</span>'}</td>` +
          `<td>${pct === null ? '' : `<div class="meter" title="${pct}%"><i style="width:${pct}%"></i></div>`}</td></tr>`;
      }).join('')).join('');
  }

  // ---------- audio ----------

  const loaderEl = $('#audio-loader');

  function showLoading() {
    loaderEl.textContent = 'Loading piano samples… (first time only)';
    loaderEl.classList.remove('hidden');
  }
  function showLoadError() {
    loaderEl.textContent = '⚠ Could not load piano samples. Check your internet connection and reload.';
    loaderEl.classList.remove('hidden');
  }

  // The samples download when the page loads.
  // The browser starts the AudioContext only after a user gesture. Play calls ensureReady() to start it.
  function preloadAudio() {
    showLoading();
    Piano.preload().then(() => loaderEl.classList.add('hidden'), showLoadError);
  }

  async function ensureAudio() {
    if (!Piano.isLoaded()) showLoading();
    try {
      await Piano.ensureReady();
      loaderEl.classList.add('hidden');
      return true;
    } catch (e) {
      showLoadError();
      return false;
    }
  }

  function stopAudio() {
    if (window.Piano) Piano.stopAll();
  }

  async function play(arpeggio) {
    const question = q;
    if (!question || !(await ensureAudio())) return;
    // Stop if a new question started while the samples loaded.
    if (question !== q) return;
    const midis = q.kind === 'key' ? F.tonicTriadMidis(q.key) : q.notes.map((n) => n.midi).reverse();
    if (arpeggio || q.kind === 'key') {
      Piano.playChords(midis.map((m) => [m]).concat([midis]), { duration: 0.5 });
    } else {
      Piano.playChords([midis], { duration: 1.6 });
    }
  }

  // ---------- events ----------

  $('#play').addEventListener('click', () => play(false));
  $('#arpeggio').addEventListener('click', () => play(true));
  $('#check').addEventListener('click', check);
  $('#reveal').addEventListener('click', reveal);
  // Enter checks the answer, then goes to the next question. A focused button handles its own Enter.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.closest('button, summary, a')) return;
    e.preventDefault();
    check();
  });
  $('#reset-stats').addEventListener('click', () => {
    if (!confirm('Reset your progress for every topic?')) return;
    topicStats = {};
    store.set(STATS_KEY, topicStats);
    renderStats();
  });

  // Register the service worker for offline use.
  // The Content-Security-Policy blocks inline scripts, so this code is in app.js.
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .catch(() => { /* offline or unsupported: the app still works online */ });
    });
  }

  showDrillOptions();
  renderStats();
  newQuestion();
  preloadAudio();
  registerServiceWorker();
})();
