/* staff.js: draws a key signature on one staff, or a four-part chord on a grand staff, with VexFlow. */

const Staff = (() => {
  // VexFlow key-signature names (the major key) by number of sharps (+) or flats (-).
  const VF_KEYS = {
    0: "C", 1: "G", 2: "D", 3: "A", 4: "E", 5: "B", 6: "F#", 7: "C#",
    "-1": "F", "-2": "Bb", "-3": "Eb", "-4": "Ab", "-5": "Db", "-6": "Gb", "-7": "Cb",
  };
  const ACC = { "-2": "bb", "-1": "b", 0: "", 1: "#", 2: "##" };
  const LETTERS = "cdefgab";

  const vexKey = (n) => `${LETTERS[n.letter]}${ACC[n.alter]}/${n.oct}`;

  // Make the SVG scale to the width of its box.
  function fit(container, W, H) {
    const svg = container.querySelector("svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    return svg;
  }

  function start(container, W, H) {
    const VF = window.VexFlow;
    container.innerHTML = "";
    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(W, H);
    return renderer.getContext();
  }

  function renderKey(container, sig, clef) {
    const VF = window.VexFlow;
    const W = 260;
    const H = 112;
    const ctx = start(container, W, H);
    new VF.Stave(20, 4, W - 40).addClef(clef).addKeySignature(VF_KEYS[sig]).setContext(ctx).draw();
    return fit(container, W, H);
  }

  // q.notes holds S, A, T, B. Soprano and alto are on the treble staff, tenor and bass on the bass staff.
  function renderChord(container, q) {
    const VF = window.VexFlow;
    const W = 260;
    const H = 232;
    const ctx = start(container, W, H);
    const keyName = VF_KEYS[q.key.sig];

    const tStave = new VF.Stave(14, 10, W - 24).addClef("treble").addKeySignature(keyName);
    const bStave = new VF.Stave(14, 120, W - 24).addClef("bass").addKeySignature(keyName);
    // Align the notes of the two staves.
    const startX = Math.max(tStave.getNoteStartX(), bStave.getNoteStartX());
    tStave.setNoteStartX(startX);
    bStave.setNoteStartX(startX);
    tStave.setContext(ctx).draw();
    bStave.setContext(ctx).draw();
    new VF.StaveConnector(tStave, bStave).setType("brace").setContext(ctx).draw();
    new VF.StaveConnector(tStave, bStave).setType("singleLeft").setContext(ctx).draw();
    new VF.StaveConnector(tStave, bStave).setType("singleRight").setContext(ctx).draw();

    const [s, a, t, b] = q.notes;
    const voice = (keys, clef) => {
      const v = new VF.Voice({ numBeats: 4, beatValue: 4 });
      v.addTickables([new VF.StaveNote({ keys: keys.map(vexKey), duration: "w", clef })]);
      return v;
    };
    const upper = voice([a, s], "treble");
    const lower = voice([b, t], "bass");
    VF.Accidental.applyAccidentals([upper], keyName);
    VF.Accidental.applyAccidentals([lower], keyName);
    new VF.Formatter().joinVoices([upper]).joinVoices([lower])
      .format([upper, lower], W - 24 - (startX - 14) - 20);
    upper.draw(ctx, tStave);
    lower.draw(ctx, bStave);
    return fit(container, W, H);
  }

  return { renderKey, renderChord };
})();
