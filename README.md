# Team Hub

Youth-sports team hub — live at [teamhub.simplegenius.io](https://teamhub.simplegenius.io).

Focused on three pillars:

1. **Field maps** — interactive venue maps for games and tournaments
2. **Standings & records** — league tables and season records
3. **AI storylines** — season narratives generated from a team's own stats

## Layout

```
index.html          family app shell
css/styles.css      all styles
js/data.js          loads data/teams.json, derives every stat
js/venue.js         venue map rendering
js/story.js         narrative engine + AI enhancement
js/app.js           tab renderers (Schedule / Standings / Story / Tournament)
data/teams.json     all team data — the single source of truth
test/               regression checks
```

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
node test/verify-derivation.mjs   # every stat matches the pre-rewrite values
node test/verify-venues.mjs       # venue geometry + field resolution
node test/verify-css.mjs          # nothing on screen lost its styling
node test/verify-publish.mjs      # encoding, conflicts, retries (no network)
```
