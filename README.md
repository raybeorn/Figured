# Figured

Figured is a web app for practice in naming chords and key signatures.

The app has two drills:

- **Chords:** The app shows a four-part (SATB) chord on a grand staff in a key. Name the chord with Roman numerals, figured bass, chord symbols, or all three. You can also name the structure (open or close).
- **Key signatures:** The app shows a key signature on a treble or bass staff. Select the major or minor key.

Select **Check** or press Enter. The app marks each part of your answer, shows the correct answer, and gives an explanation. Then select **Next**.

The app runs in the browser. It has no build step and no server code. You can host it on GitHub Pages.

## Features

- All 15 major keys and 15 minor keys, or only keys with up to 3 or 5 sharps or flats
- Major keys, minor keys, or both
- Key signatures on the treble staff, the bass staff, or both
- Diatonic triads (major, minor, diminished) and seventh chords (dominant 7th, major 7th, minor 7th, half-diminished 7th, diminished 7th)
- Root position and first, second, and third inversions
- Answers as Roman numerals (ii⁶₅), figured bass (⁶₅), or chord symbols (Dm7/F)
- Open or close structure questions, which you can turn on or off
- Piano playback of the chord (block or arpeggio), and of the tonic chord after a key-signature answer
- Score for each topic, saved in the browser (localStorage)
- Installation on a phone home screen
- Offline use after the first visit

## Theory conventions

- **Minor keys:** V, V7, vii°, and vii°7 use the raised leading tone (harmonic minor). The other chords use natural minor, so III is major.
- **Spelling:** A chord-symbol root or bass must have the correct spelling. In E♭ major, the V chord is B♭, not A♯.
- **Close structure:** less than an octave between the soprano and the tenor. **Open structure:** an octave or more.
- **Doubling:** Root-position triads double the root. First-inversion triads double any tone except the leading tone. Second-inversion triads double the bass. Diminished triads double the third. Seventh chords are complete, with no doubling.
- Some chords cannot be in close structure without a doubled leading tone (for example, V⁶). These chords are always in open structure.

## Run the app on your computer

You need Node.js. The browser does not load the piano samples from a `file://` page. You must use a local web server.

In the app folder, run this command:

```bash
node server.js
```

Open <http://localhost:8125> in a browser.

The server accepts connections only from your computer. It does not serve hidden files, such as `.git`. To connect from a phone on the same network, start the server with `HOST=0.0.0.0 node server.js`.

The first visit needs an internet connection. On the first visit, the app downloads the piano samples and the two CDN scripts. After the first visit, the app works offline. Refer to [Offline use](#offline-use).

## Put the app on GitHub Pages

1. Make a GitHub repository and push the contents of this folder to it.
2. In the repository, go to **Settings > Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**. Select `main` and `/ (root)`, then select **Save**.
4. The site is at `https://<your-username>.github.io/<repo-name>/`.

## Install the app on a phone

The app is an installable web app (PWA).

- **iPhone or iPad (Safari):** Open the site. Tap **Share**, then tap **Add to Home Screen**.
- **Android (Chrome):** Open the site. Tap the menu, then tap **Install app** or **Add to Home screen**.

The app then opens full screen from its icon. It works offline after the first visit.

## Offline use

The app registers a service worker, `sw.js`. On the first online visit, the service worker saves the app files, the two CDN scripts, and the piano samples in the browser cache.

- App files use network first. An online visit loads the latest code. An offline visit uses the cache.
- The CDN scripts and the samples use cache first.
- Each external file must match its integrity hash before the service worker saves it.

To refresh the cached app files and CDN scripts, increase `CACHE_VERSION` in `sw.js`. If you add an app file, also add it to `APP_FILES` in `sw.js`.

Cache names start with `figured-`. Saved data uses the keys `figured-settings-v1` and `figured-stats-v1`. On GitHub Pages, all project sites of an account share one origin. These prefixes prevent conflicts with other apps on the same origin.

## Build

- Plain HTML, CSS, and JavaScript. There is no build step.
- Piano sound: Tone.js 15.1.22 with the Salamander Grand Piano samples.
- Music notation: VexFlow 5.0.0.

Each file from another site has a pinned SHA-384 hash (Subresource Integrity). The browser blocks a file if its bytes do not match the hash. If you change a script version, make a new hash with this command:

```bash
curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A
```

Add the prefix `sha384-` to the output. Then update `index.html` and `CDN_SCRIPTS` in `sw.js`.

## Tests

You need Node.js. The test checks the key names, the chord qualities, the spelling, and the SATB voicings for each key, chord, and inversion.

```bash
node tests/theory.test.js
```

## Credits

- Tone.js. MIT License. Copyright Yotam Mann and the Tone.js contributors.
- VexFlow. MIT License. Copyright Mohit Muthanna Cheppudira and the VexFlow contributors.
- Salamander Grand Piano V3. Creative Commons Attribution 3.0 (CC-BY 3.0). Created by Alexander Holm.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page layout and theory reference |
| `styles.css` | Styles |
| `js/theory.js` | Key and chord spelling, voicings, and question generator |
| `js/staff.js` | Key-signature and grand-staff notation with VexFlow |
| `js/samples.js` | Piano sample list with integrity hashes |
| `js/audio.js` | Piano playback with Tone.js |
| `js/app.js` | User interface, scores, and settings |
| `icon.svg` | Logo and browser icon: a bass clef (F clef) with the figures 6 and 5 in place of its dots |
| `manifest.json`, `icon-*.png`, `apple-touch-icon*.png` | Phone installation and icons |
| `sw.js` | Service worker for offline use |
| `server.js` | Static file server for local use |
| `tests/theory.test.js` | Theory engine test |
