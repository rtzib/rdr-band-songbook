# Rey de Reyes Songbook

Phone-friendly songbook for the Rey de Reyes band. It reads the band's song Google Doc every time it's opened, so fixing a song in the doc fixes it for everyone.

- **Song doc:** https://docs.google.com/document/d/1h71apax-e4iVCXoxrhq3wtUltAUcRPk51wqIVKMSCT0/edit
- **Planned live page:** https://rtzib.github.io/rdr-band-songbook/ (once GitHub Pages is on)
- No lyrics are stored in this repo. They're read live from the doc, and each phone keeps its last copy so it still works with bad internet.
- `noindex` tag is set so Google doesn't list it. Anyone with the link can still open it.

## What's in here

| File | What it is |
|---|---|
| `index.html` | The whole app (one file, no install). Screens are in English (songs stay in whatever language they're written in). |
| `apps-script/Code.gs` | The backend ("Reader.gs" in the RDR Songbook script): reads the doc, reads/writes events in the Google Sheet. No secrets. |
| `apps-script/FixLayout.gs` | One-time cleanup of the songs already in the doc. Run `previewFixes`, then `applyFixes` (saves a backup copy first). |
| `manifest.webmanifest`, `icons/` | App name and icon for "Add to Home screen". |
| `sw.js` | Lets the app open without internet (always tries the internet first). |

## One-time setup

1. Go to script.google.com > **New project**, name it `RDR Songbook`.
2. Paste `apps-script/Code.gs` over everything in Code.gs and save.
3. Pick the `test` function and click **Run**. Allow access (it only reads the doc).
4. **Deploy > New deployment > Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy.
5. Copy the link that ends in `/exec` and paste it into `SCRIPT_URL` at the top of `index.html`.
6. Commit and publish in GitHub Desktop (repo must be public for free GitHub Pages).
7. On github.com: Settings > Pages > Branch `main`, folder `/ (root)` > Save.

After changing `Code.gs`: Deploy > Manage deployments > pencil > Version: **New version** > Deploy. The link stays the same.

## What the app does

- **Home:** next event (big card), the next two weeks (dots on days with events; tap an empty day to plan one), saved songs, upcoming events.
- **Songs:** search by title or lyrics, filters (album tab, Originals/Covers, rhythm, saved, has lyrics), key + bpm on each row, a heart to save songs (saved per phone).
- **Song page:** structure strip, lyrics by section, `//` repeats as x2/x3 bars, transpose, chords on/off, metronome, screen stays on, text size.
- **Events:** upcoming and past, search, type filters (Service, Rehearsal, Wedding, Campaign, Youth, Funeral, Birthday, Other).
- **Event page:** date/time, notes, set list with a note per song. "Start set list" goes song by song with Previous / Next song and that song's note on top.
- **Add / edit an event:** name, type, date, time, notes, songs (search to add, move up/down, note per song). Saving or deleting needs the **band PIN** (remembered on the phone after the first correct try). Songs not in the doc can still be added by name.
- Dark mode by default (light/dark toggle at the top). Help (?) has the doc-writing rules, a "what's missing in the doc" list, and the doc's own playlists.

## Where things are saved

- **Lyrics:** the band song Google Doc (album tabs under RDR Songs, covers in Other Artists).
- **Events and set lists:** Google Sheet "RDRB - Tracker | Band Events" in the church Drive (tabs Events and SetList). You can look at it or fix things there, but keep the column order.
- **Band PIN:** saved in the script's settings (not in this repo). To see it, run `setupBand` again in the RDR Songbook script. To change it, put the new PIN in `NEW_PIN`, run `changePin`, then set `NEW_PIN` back to "". After 20 wrong PIN tries the script locks saving for an hour.

## How the doc must be written (so the app can read it)

1. Song name on its own line.
2. Right under it, the 2-column table, same 5 rows every time: `Type` (Original / Cover), `Artist` (Rey de Reyes or the covered band), `Key` (`G`, `Am`), `Tempo/Time Signature` (`120 BPM - 4/4`), `Genre`. Nothing else inside the table.
3. Section names on their own line: Intro, Verso, Pre-Coro, Coro, Puente, Instrumental, Outro, Final (numbers and `(x2)` are fine).
4. Chords on their own line (`[D] - [Bm] - [G] - [A]`) or above the words.
5. A horizontal line between songs.
6. Event set lists are made in the app (Events), not in the doc.

Full fix list for the current doc: `Ryan's Information Hierarchy/Church & Music/Rey de Reyes Band/RDRB - How To - Song Doc Layout Fixes.html`.
