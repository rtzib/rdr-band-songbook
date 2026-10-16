# Rey de Reyes Songbook

Phone-friendly songbook for the Rey de Reyes band. It reads the band's song Google Doc every time it's opened, so fixing a song in the doc fixes it for everyone.

- **Song doc:** https://docs.google.com/document/d/1h71apax-e4iVCXoxrhq3wtUltAUcRPk51wqIVKMSCT0/edit
- **Planned live page:** https://rtzib.github.io/rdr-cancionero/ (once GitHub Pages is on)
- No lyrics are stored in this repo. They're read live from the doc, and each phone keeps its last copy so it still works with bad internet.
- `noindex` tag is set so Google doesn't list it. Anyone with the link can still open it.

## What's in here

| File | What it is |
|---|---|
| `index.html` | The whole app (one file, no install). Screens are in English (songs stay in whatever language they're written in). |
| `apps-script/Code.gs` | Small Google script that reads the doc and hands it to the app. Read-only, no secrets. |
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

- Song list grouped by doc tab, search by title or lyrics, filters (tab, Originals/Covers, rhythm, only songs with lyrics).
- Song page: key, BPM, time, rhythm; colored song structure strip (tap to jump); lyrics by section.
- `//` and `///` repeats shown as a blue bar with x2 / x3. `(x2)` on a section shows as a badge.
- A section listed again with no lyrics shows the lyrics from its first time ("Same as before").
- Chords: transpose up/down (saved per phone, per song), show/hide chords.
- Metronome at the song's BPM (accent on beat 1), "screen stays on", text size, light/dark.
- **Set Lists**: any doc tab with no songs (set lists, event playlists). Song names link to the song.
- **Help**: how to use it, how to write songs in the doc, and a "what's missing" list (no lyrics, no key, no tempo, no rhythm, no chords).

## How the doc must be written (so the app can read it)

1. Song name on its own line.
2. Right under it, the 2-column table, same 5 rows every time: `Type` (Original / Cover), `Artist` (Rey de Reyes or the covered band), `Key` (`G`, `Am`), `Tempo/Time Signature` (`120 BPM - 4/4`), `Genre`. Nothing else inside the table.
3. Section names on their own line: Intro, Verso, Pre-Coro, Coro, Puente, Instrumental, Outro, Final (numbers and `(x2)` are fine).
4. Chords on their own line (`[D] - [Bm] - [G] - [A]`) or above the words.
5. A horizontal line between songs.
6. Set lists go at the end under a heading called `Set Lists`.

Full fix list for the current doc: `Ryan's Information Hierarchy/Church & Music/Rey de Reyes Band/RDRB - How To - Song Doc Layout Fixes.html`.
