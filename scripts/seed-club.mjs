/* Seed the club's teams into data/teams.json from a GotSport club page.

   A club hub needs every team in the club, and typing nineteen GotSport ids
   by hand is exactly the kind of job nobody does twice. This reads the club's
   page inside a league event and writes an entry per team; the daily league
   sync then fills in games and standings.

   Usage:
     node scripts/seed-club.mjs                 # dry run, prints what it would add
     node scripts/seed-club.mjs --write         # writes data/teams.json

   Teams already in the file are LEFT ALONE — they carry real synced games,
   standings, stories and archives that must not be overwritten by a stub.
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
const FILE = repo + 'data/teams.json';
const WRITE = process.argv.includes('--write');

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const club = data.club;
if (!club || !club.source) {
    console.error('data/teams.json has no club.source block — add { provider, eventId, clubId } first.');
    process.exit(1);
}
const { eventId, clubId } = club.source;
const url = `https://system.gotsport.com/org_event/events/${eventId}/clubs/${clubId}`;

/* "Sting Soccer Club G2013/14 McNeal" -> "G2013/14 McNeal".
   In a club hub the club's own name is on every screen already; repeating it
   nineteen times in a list is nineteen ways to not read the list. */
function shortName(full, clubName) {
    let s = full.replace(clubName, '').trim();
    s = s.replace(/^Soccer Club\s*/i, '').trim();
    return s || full;
}

/* age group for grouping the directory: G2013/14 -> "2013/14 Girls" */
function ageGroup(name) {
    const m = name.match(/\b([GB])\s?(\d{4})\/(\d{2})\b/);
    if (!m) return 'Other';
    return `${m[2]}/${m[3]} ${m[1] === 'G' ? 'Girls' : 'Boys'}`;
}

function slugify(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
}

const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (team-hub club seed)' } });
if (!res.ok) { console.error('GotSport returned ' + res.status + ' for ' + url); process.exit(1); }
const html = await res.text();

const found = {};
for (const m of html.matchAll(/[?&]team=(\d+)[^>]*>\s*([^<]{3,90}?)\s*</g)) {
    if (!found[m[1]]) found[m[1]] = m[2].trim();
}
const teams = Object.entries(found).map(([teamId, name]) => ({ teamId: +teamId, name }));
if (!teams.length) { console.error('No teams found on ' + url); process.exit(1); }

console.log(`${teams.length} teams on the club page for event ${eventId}\n`);

// which GotSport team ids are already represented in the file?
const known = new Set();
for (const t of Object.values(data.teams)) {
    for (const c of (t.competitions || [])) {
        if (c.source && c.source.teamId) known.add(c.source.teamId);
    }
}

const added = [];
for (const t of teams) {
    if (known.has(t.teamId)) { console.log(`  keep   ${t.name}  (already in the file)`); continue; }
    const short = shortName(t.name, club.name);
    let key = slugify(short);
    while (data.teams[key]) key += '-x';

    data.teams[key] = {
        branding: {
            name: short,
            league: club.defaultLeague || '',
            season: club.season || '',
            motto: club.motto || '',
            website: club.website || '',
            primaryColor: club.primaryColor,
            secondaryColor: club.secondaryColor,
            sport: 'Soccer',
            ageGroup: ageGroup(t.name),
            terms: { match: 'Match', goalsFor: 'Goals', goalsAgainst: 'GA' },
        },
        pointsConfig: { win: 3, draw: 1, loss: 0, drawsAllowed: true },
        games: [],
        competitions: [{
            id: club.defaultCompetitionId || 'gcl',
            label: club.defaultLeague || '',
            shortLabel: (club.defaultLeague || '').split(' ')[0] || 'League',
            season: club.season || '',
            source: { provider: 'gotsport', eventId, teamId: t.teamId,
                      url: `https://system.gotsport.com/org_event/events/${eventId}/schedules?team=${t.teamId}` },
        }],
    };
    added.push({ key, name: short, ageGroup: ageGroup(t.name), teamId: t.teamId });
    console.log(`  ADD    ${short.padEnd(34)} ${ageGroup(t.name).padEnd(14)} ${key}`);
}

console.log(`\n${added.length} to add, ${teams.length - added.length} already present.`);

if (!WRITE) { console.log('\nDry run. Re-run with --write to apply.'); process.exit(0); }

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
console.log(`\nWrote ${FILE} — now ${Object.keys(data.teams).length} teams.`);
console.log('Next: node scripts/pull-league.mjs   (fills games and standings)');
