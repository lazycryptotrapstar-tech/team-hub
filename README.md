# Team Hub

Youth-sports team hub — live at [teamhub.simplegenius.io](https://teamhub.simplegenius.io).

Built so a parent or player landing on it can answer three questions fast:

1. **Where is the next game?** — schedule with venue field maps and directions
2. **How are we doing?** — live standings and stats, synced from the league site
3. **What's my job out there?** — the strategy page: formation, per-position guide, set pieces

Plus AI storylines and tournament brackets, and a coach-only lineup and
substitution board.

## Layout

```
index.html            family app shell
css/styles.css        all styles
js/data.js            loads data/teams.json, derives every stat
js/venue.js           venue map rendering
js/story.js           narrative engine + AI enhancement
js/strategy.js        strategy tab: formation board, position guide, set pieces
js/lineup.js          lineup & subs: the same board, used to run a game
js/app.js             tab renderers (Schedule / Standings / Strategy / Story / Tournament)
scripts/pull-league.mjs  league sync: pulls schedule + standings from GotSport
data/teams.json       all team data — the single source of truth
test/                 regression checks
```

## Cache busting

Cloudflare serves js/css with a 4-hour browser cache; the HTML
revalidates on every load. Asset URLs in index.html carry a `?v=`
stamp — **bump it whenever js or css changes**, or phones keep running
the old code for hours. Data is immune (`fetch(..., cache: no-store)`),
so the league sync needs no bump.

## League sync

A team plays in one or more competitions (`competitions[]` in teams.json).
A competition with a `source` block (`provider: "gotsport"`, `eventId`,
`teamId`) is **connected**: `node scripts/pull-league.mjs` fetches its
GotSport team page and rewrites that competition's games and standings —
venues resolve to their maps via `data/venues.json` location patterns,
opponent ranks come from the live table. `--push` commits and pushes
(which deploys). A scheduled task on Dee's machine runs this daily.
The admin editor's league-table screen is for teams *without* a
connected competition; connected tables would just be overwritten by
the next sync.

## Lineup & subs (coach-only)

The fourth view on the Strategy tab runs a game on the same formation
board. Three lanes:

- **Plan** — the starting XI, the period shape (2x30, 4x15, whatever the
  age group plays), and substitutions written as *minute + position +
  who comes on*. The plan works out who goes off for you, following the
  earlier subs in that position. **Fill by position** puts the
  least-played eligible player into every empty spot as a starting point.
- **Live** — a match clock. When a planned sub's minute arrives the app
  raises it as a prompt: make it, or skip it. Every player accrues
  minutes while they are on the pitch.
- **Playing time** — the accumulating season record: total minutes and
  games per player across every filed game plus the one in progress,
  least-played first, with the games themselves listed underneath.

### Positions and the time indicator

Each player carries the positions they cover (TeamSnap's single position
seeds the list). Tapping a spot on the board then offers the players who
cover it first, and among those the ones owed time.

**Fair share** is the pitch time available divided by the squad: eleven
players on for T seconds is 11*T of playing time to hand out. A player
more than a minute — or 15%, whichever is larger — below that reads
*owed time*, above it reads *had plenty*. One vocabulary carries it
everywhere: a ring on the board dot, the bench chip border, the bar
colour in both lists, and a tick on every bar marking an even share.
Colour is never the only signal; the minutes are always written beside
it.

A game is filed into the season record when you press **End game**, and
also if you clear a game that has time on it — a coach who just closes
the app at full time should not lose the minutes. `archived` guards
against the same game being counted twice.

**None of this is published.** It lives in `localStorage` under
`th_lineup_v2_<teamId>_<competitionId>` and never touches
`data/teams.json`. The site has no accounts, so private has to mean
*never leaves the browser*. That matters more than usual here: it is a
roster of children. **Never commit a real roster to this repo** — the
test fixtures use invented names for that reason.

**One store per competition.** A hub team can play two leagues with two
different squads: the McNeal team's GCL and N1 rosters share only five
players. Each competition gets its own roster, starting XI, rotation plan
and game, and the squad switcher picks between them — defaulting to the
competition of the next fixture.

**Players are keyed by a generated id, never by shirt number.** The real
GCL roster has two girls on #2 and two on #8. Keying by number silently
dropped players on import and would have subbed the wrong child on. The
roster panel flags a shared number; the board tells them apart by the
name under the dot.

Three more rules the code depends on:

- **`catchUpClock()` must persist what it credits.** Every interaction
  re-renders, and every render calls `loadLineup()`, which re-reads
  localStorage. A minutes credit left only in memory is thrown away by
  the next tap.
- **The clock is derived from timestamps, not counted by the ticker.**
  `runningSince` and `lastTick` mean a locked phone, a closed tab or a
  reload all resume with the right time, and half-time never accrues.
- **A shirt-number line in a paste must be a number and nothing else.**
  `#28` alone on a line starts a block; `#9 Nora Diaz` is one whole
  player. Confusing the two makes the parser eat preceding lines as that
  player's contact block.

### Importing a roster

Open the team's roster page in TeamSnap, select all, copy, paste into the
box. `parseRoster` reads the page's block shape — name, then a pile of
parent names, emails and phone numbers, then the shirt number on its own
line — and keeps **only** the player's name and number. Everything after
the Non-Players heading is dropped, so coaches and managers never land in
the roster. `7 Ava Martin` per line works too. Re-importing matches on
name and updates rather than duplicating.

`node test/verify-roster-parse.mjs` covers both paste shapes, the
contact-stripping, and the shared-number case.

## Phones (learned the hard way)

The hub is read at a field, on a phone, one-handed. Rules that came out
of measuring it at 390px and 320px:

- **The strategy board is `position:sticky` on phones**, so the coaching
  cards scroll underneath it. At full height the board filled the screen
  and pushed every card below the fold — tapping "Play the pattern" lit
  up an explanation nobody could see. This is why `.main-card` uses
  `overflow:clip` and **not** `overflow:hidden`: `hidden` makes it a
  scroll container and silently kills sticky inside it.
- `highlightCard()` scrolls to an **absolute** target computed from the
  board's height, not a delta. Before the board sticks, its bottom is
  below the fold, so every "is the card hidden?" test reads false.
- **Button rows scroll, they don't wrap.** Four phase buttons wrapped 3+1
  and orphaned "Attack"; the view switcher did the same once it gained a
  fourth item. Both are now nowrap scroll strips bleeding to the card edge.
- **44px minimum on anything tappable.** These were 29-37px.
- **Fixture rows become three stacked bands sharing one left edge.** The
  desktop five-column row squeezed a club name into 81px over three
  lines while the meta line restarted at the card edge — three different
  left edges in one row.
- **Standings truncate the club name to one line** (`table-layout:fixed`
  plus sized numeric columns). Wrapping names gave rows of 55-90px with
  the numbers floating mid-row, and the table overflowed the card by 8px
  at 320px. The full name stays in the cell's `title`.
- **`minmax(0,1fr)`, never bare `1fr`,** for grid tracks holding names: a
  plain `1fr` floors at min-content and overflows.

## SVG rules for the strategy board (learned the hard way)

Chrome's compositor hard-froze rendering the tactics board. Inside any
SVG that gets re-rendered: no `<marker>` elements, no `var(--*)` paints,
no `preserveAspectRatio="none"`, and no CSS transitions on `left`/`top`
of the player dots (phase moves animate via the Web Animations API).

## Editing data

All team data lives in `data/teams.json`. `games[]` is the source of truth:
season record, goals, points, form, streaks, next match, and the season
timeline are all **derived** from it — never hand-typed.

After editing, run the regression check:

```
node test/verify-derivation.mjs
```

## Local development

`fetch()` cannot read local JSON over `file://`, so use a static server:

```
npx serve .
```

Deploys happen automatically on push to `main` (Cloudflare).

## Adding a venue

Venues are data, not code. Add an entry to `data/venues.json`:

- `canvas` — the drawing area (`w`, `h`, `bg`)
- `fields[]` — each field's `id`, `x`, `y`, `w`, `h` (and optional `size`, `aliases`)
- `zones[]` — `road`, `parking`, `area`, `landmark`, `medical` boxes
- `markers[]` — arrows (e.g. parking lot → fields)
- `locationPatterns[]` — regexes that pull a field id out of a location
  string, so "UT Dallas #07" lights up field 7
- `emptyState` — how fields with no games look: `inactive` (normal) or
  `empty` (dimmed, good for tournament maps)

Games point at a venue with `venueId` + `fieldId`; free-text `locText`
still works through `locationPatterns`. A game at a venue with no map
falls back to an address card with a directions link.

Then check the geometry and resolution rules:

```
node test/verify-venues.mjs
node test/verify-css.mjs
```

## Updating the site (admin editor)

`admin.html` edits `data/teams.json` in the browser and can publish it
straight to this repo — Cloudflare then rebuilds the site.

- **Games** — the source of truth. Record, goals, form, the timeline and
  the season story all come from here.
- **Standings** — the league's own table. GD and points are computed;
  mark which row is your team with the **Us** button.
- **Tournament** — current bracket and the history underneath it.
- **Team Info** — names, colours, and how the sport scores (win/draw/loss
  points; turn off draws for win-or-lose sports).
- **Storyline** — write it yourself, build one from the results, or have
  AI write it. Whatever is saved here is what families read.

Edits are held in the browser until you publish, so a closed tab loses
nothing. **Publish** validates first and refuses on real errors.

### Publishing setup

Publishing needs a GitHub [fine-grained token](https://github.com/settings/personal-access-tokens/new)
scoped to **only this repository** with **Contents: Read and write** —
nothing else. Paste it into Setup. It is stored in that browser and is
only ever sent to `api.github.com`.

Prefer running the admin page **locally** (`npx serve`, then
<http://localhost:3000/admin.html>) rather than on the live domain, so the
token never lives in a browser profile for a public site. No token? Use
**Download** and commit `data/teams.json` yourself — same result.

If someone else publishes while you have the editor open, publishing
stops and asks rather than overwriting their work.

## Tests

```
node test/verify-derivation.mjs    # every stat matches the pre-rewrite values
node test/verify-venues.mjs        # venue geometry + field resolution
node test/verify-css.mjs           # nothing on screen lost its styling
node test/verify-publish.mjs       # encoding, conflicts, retries (no network)
node test/verify-roster-parse.mjs  # roster paste: both shapes, no contacts kept
node test/verify-playing-time.mjs  # minutes accumulate correctly across games
```

## Importing

The **Import** tab takes a league table or a run of fixtures pasted
straight off the league site, or a CSV. It works out which of the two it
is, parses it, and puts every row in a list to check — tick, edit or
untick each one before it joins the draft. Nothing reaches the site
until you publish.

Formats it understands:

- **Dates** — `2026-03-21`, `3/21/26`, `3/21`, `Mar 21`, `Sat Mar 21`.
  A date with no year is placed in the right season automatically, so an
  August fixture lands in the autumn rather than next spring.
- **Times** — `6:30 PM` or `18:30`.
- **Scores** — `2 - 5` or `2-5`. A leading `W` or `L` is used to check
  which side is which, so an opponent-first table still records
  correctly.
- **Grounds** — any venue in `data/venues.json` is recognised with its
  field (`UT Dallas #07`, `Railroad Park #12`, `ALC Field 3`) and the
  game is linked to that venue's map automatically.

Games already on the schedule are flagged as duplicates and unticked;
league rows that already exist are marked as replacing the current row.
