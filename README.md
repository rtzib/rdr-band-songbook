# Rey de Reyes Songbook

Phone app for the Rey de Reyes band: songs with lyrics and chords, events with set lists, rehearsal mode.

- **Live page:** https://rtzib.github.io/rdr-band-songbook/
- **Data:** one Google Sheet in the church Drive, "RDRB - Tracker | Band Database" (tabs Songs, Albums, Artists, Genres, Themes, EventTypes, Members, Events, SetList). No lyrics are stored in this repo.
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
- **Leaders** (anyone with the band PIN, signed in once on their phone via Settings > Leader sign-in): add/edit/delete songs and events, copy events, manage albums, artists, genres, themes, event types and band members (Leader tools).
- The PIN is stored in the script's settings, not here. To see it, run `setupBand` in the script. To change it: put it in `NEW_PIN`, run `changePin`, set `NEW_PIN` back to "". 20 wrong tries locks saving for an hour.

## Features

- **Look:** styled like the OnStage app: big page titles, round buttons, one card per song/event, tabs at the bottom (Home, Songs, Events, Settings).
- **Home:** team card (members), today and the next two weeks, saved songs, and Upcoming as simple cards (team, title, date). The Events tab has the next event in a big blue card (**Start** button, countdown). Leaders get a "Send reminder" card the day before and on the day.
- **Songs:** tap the title ("4 Songs ⌄") to switch All / Saved / Originals / Covers. Search by title or lyrics, filters (saved, theme, album, originals/covers, genre, has lyrics), key and bpm on each row.
- **Song page:** lyrics by part, `//` repeats as x2/x3 bars, chords. **Options** hides/shows key change, chords on/off, text size, metronome, keep screen on. **Listen** opens the practice link. Shows when it was last played at an event.
- **Events:** next event in a blue card, then Upcoming and Past Events; search and type filters.
- **Event page:** blue card with time and date, name, location (opens Google Maps), **See Setlist** and **Start Event**, notes. Share at the top. Leaders: Edit details, Copy to next week, Cancel event (with a reason; **Undo cancel**, **Tell the band**).
- **Create / Edit Event:** name, type, location, date, time, notes, and a big **Save Event** button. No set list here: save the event first, then add songs on its Setlist page.
- **Setlist page** (See Setlist): everyone sees the songs in order with key and bpm and can open each one. Leaders tap **Add Songs** to search and add, move songs up/down, add a note per song, remove, then tap the blue save button.
- **Band Schedule** (tap the date card on Home): month calendar (Mon–Sun, dots on days with events, red dot if canceled). Swipe left/right on the calendar or use the arrows to change month; the box with today's date jumps back to today. Tap a day to see its events. Leaders get a floating **+** button (bottom right) that opens Create Event on the picked date.
- **Settings:** team members, Leader sign-in / Leader tools, invite the band (shares the app link), dark mode, chords on/off, lyrics text size, guide language, refresh songs, add to Home screen, quick guide, Help Center, About, leader sign out.
- **Event types:** leaders add, rename and delete them in Leader tools. Renaming updates every event using it; deleting one that events use asks first and leaves those events with no type.
- **Rehearsal / event mode** (Start Event): full screen, screen stays on, swipe left/right or the big buttons to move between songs, plays each song in the key set for the event. The top bar says Rehearsal for Rehearsal-type events and Live for everything else.
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
