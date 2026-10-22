# Rey de Reyes Songbook

Phone app for the Rey de Reyes band: songs with lyrics and chords, events with set lists, rehearsal mode.

- **Live page:** https://rtzib.github.io/rdr-band-songbook/
- **Data:** one Google Sheet in the church Drive, "RDRB - Tracker | Band Database" (tabs Songs, Albums, Artists, Genres, Themes, Members, Events, SetList). No lyrics are stored in this repo.
- **Old song Google Doc:** no longer used by the app. Keep it as a backup.
- `noindex` tag is set so Google doesn't list it. Anyone with the link can still open it.

## What's in here

| File | What it is |
|---|---|
| `index.html` | The whole app (one file, no install). |
| `apps-script/Code.gs` | The backend. In the "RDR Songbook" Apps Script project it's the file **Reader.gs**. Reads/writes the database sheet. No secrets. |
| `apps-script/FixLayout.gs` | Old one-time cleanup of the Google Doc (already run, 2026-10-16). Not needed anymore. |
| `manifest.webmanifest`, `icons/` | App name and icon for "Add to Home screen". |
| `sw.js` | Lets the app open without internet (always tries the internet first). |

## Who can do what

- **Everyone:** read songs, open events, rehearsal mode, change key/text size on their own phone, save songs (heart), share an event.
- **Leaders** (anyone with the band PIN, signed in once on their phone via Settings > Leader sign-in): add/edit/delete songs and events, copy events, manage albums, artists, genres, themes and band members (Leader tools).
- The PIN is stored in the script's settings, not here. To see it, run `setupBand` in the script. To change it: put it in `NEW_PIN`, run `changePin`, set `NEW_PIN` back to "". 20 wrong tries locks saving for an hour.

## Features

- **Look:** styled like the OnStage app: big page titles, round buttons, one card per song/event, tabs at the bottom (Home, Songs, Events, Settings).
- **Home:** team card (members), today and the next two weeks, saved songs, and Upcoming as simple cards (team, title, date). The Events tab has the next event in a big blue card (**Start** button, countdown). Leaders get a "Send reminder" card the day before and on the day.
- **Songs:** tap the title ("4 Songs ⌄") to switch All / Saved / Originals / Covers. Search by title or lyrics, filters (saved, theme, album, originals/covers, genre, has lyrics), key and bpm on each row.
- **Song page:** lyrics by part, `//` repeats as x2/x3 bars, chords. **Options** hides/shows key change, chords on/off, text size, metronome, keep screen on. **Listen** opens the practice link. Shows when it was last played at an event.
- **Events:** next event in a blue card, then Upcoming and Past Events; search and type filters. Event page: date, time, location (Google Maps), who's playing, notes, set list with a key and note per song. **Share** sends the event and set list (WhatsApp or the phone's share menu). Leaders: **Copy** (same set list, one week later), **Edit**, and **Cancel event** (with a reason; shows as Canceled everywhere, **Undo cancel** brings it back, **Tell the band** shares the news). Events filters can hide canceled ones.
- **Band Schedule** (tap the date card on Home): month calendar (Mon–Sun, arrows for other months, dots on days with events, red dot if canceled). Tap a day to see its events. Leaders get "Quick event on this date": New service / rehearsal / wedding / event opens the event form with that date, type and a usual time filled in.
- **Settings:** team members, Leader sign-in / Leader tools, invite the band (shares the app link), dark mode, chords on/off, lyrics text size, guide language, refresh songs, add to Home screen, quick guide, Help Center, About, leader sign out.
- **Rehearsal mode** (Start): full screen, screen stays on, swipe left/right or the big buttons to move between songs, plays each song in the key set for the event.
- **First-run guide** (English / Spanish): install the app, open the next event, swipe song by song. Help has it again.
- **Song editor:** title, album, type, artist, key, BPM, time, genre, themes, practice link, lyrics with part buttons and a live preview. "+ Add new..." in the album/artist/genre lists adds a new one.

## Genre vs theme

- **Genre** is the rhythm, one per song: Soca, Cumbia, Balada...
- **Theme** is the occasion, as many as fit: Wedding, Birthday, September Celebration. Tap them in the song editor. Add new ones there or in Leader tools.

## Writing lyrics (in the app's song editor)

1. Each part name on its own line: Intro, Verso I, Verso II, Pre-Coro, Coro, Puente, Instrumental, Outro (`Coro (x2)` is fine).
2. `//` around lines = sung twice, `///` = three times.
3. Chords on their own line (`[D] - [Bm] - [G] - [A]`) or above the words.

## Changing the backend

Paste `apps-script/Code.gs` into **Reader.gs** in the RDR Songbook script, save, then Deploy > Manage deployments > pencil > Version: **New version** > Deploy. The /exec link stays the same.
