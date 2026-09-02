/* ============================================================
   LEAGUE PULL — GotSport connector
   Fetches each connected competition's team schedule page from
   GotSport, parses the standings bracket + fixtures, and updates
   data/teams.json. games[] stays the single source of truth —
   this script only writes what the league site publishes.

   Usage:
     node scripts/pull-league.mjs             # update teams.json, report
     node scripts/pull-league.mjs --push      # + git commit & push (deploys)
     node scripts/pull-league.mjs --dry-run   # fetch + parse, write nothing

   A competition is "connected" when it carries a source block:
     { "provider": "gotsport", "eventId": 55246, "teamId": 4180087 }
============================================================ */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEAMS_PATH = path.join(repo, 'data', 'teams.json');
const VENUES_PATH = path.join(repo, 'data', 'venues.json');

const PUSH = process.argv.includes('--push');
const DRY = process.argv.includes('--dry-run');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TeamHub league sync';
const MONTHS = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };

function log(msg) { console.log(msg); }
function fail(msg) { console.error('ERROR: ' + msg); process.exitCode = 1; }

function stripTags(s) {
    return s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ').trim();
}

function isoDate(us) {                 // "Aug 29, 2026" -> "2026-08-29"
    const m = us.match(/([A-Z][a-z]{2})[a-z]*\s+(\d{1,2}),\s*(\d{4})/);
    if (!m || !MONTHS[m[1]]) return null;
    return m[3] + '-' + String(MONTHS[m[1]]).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0');
}

function time24(us) {                  // "11:00AM CDT" -> "11:00"
    const m = us.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return String(h).padStart(2, '0') + ':' + m[2];
}

/* ---- parse one GotSport team schedule page ---- */

function parseStandings(html, ourTeamId) {
    // Bracket panels: heading + table with columns rank/Team/MP/W/L/D/GF/GA/GD/PTS/PPG.
    // A team page shows the team's own bracket; take the table containing our team link.
    const tables = [];
    const panelRe = /<div class='panel-title'>\s*([^<]+?)\s*<\/div>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/g;
    let pm;
    while ((pm = panelRe.exec(html))) tables.push({ bracket: pm[1].trim(), body: pm[2] });

    for (const t of tables) {
        if (ourTeamId && t.body.indexOf('team=' + ourTeamId) === -1) continue;
        const rows = [];
        const rowRe = /<tr>\s*<td>\s*(\d+)\s*<\/td>\s*<td>\s*<a href="[^"]*?team=(\d+)">([^<]+)<\/a>\s*<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>/g;
        let m;
        while ((m = rowRe.exec(t.body))) {
            rows.push({
                rank: +m[1], name: stripTags(m[3]),
                mp: +m[4], w: +m[5], l: +m[6], d: +m[7], gf: +m[8], ga: +m[9],
                _teamId: +m[2],
            });
        }
        if (rows.length) return { bracket: t.bracket, rows };
    }
    return null;
}

function parseMatches(html, ourTeamId) {
    // Desktop match rows: <tr class='fz-sm'> ... 7 cells.
    const matches = [];
    const rowRe = /<tr class='fz-sm'>([\s\S]*?)<\/tr>/g;
    let m;
    while ((m = rowRe.exec(html))) {
        const row = m[1];
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => c[1]);
        if (cells.length < 7) continue;

        const matchNo = stripTags(cells[0]);
        const when = stripTags(cells[1]);
        const homeLink = cells[2].match(/team=(\d+)">([^<]+)</);
        const awayLink = cells[4].match(/team=(\d+)">([^<]+)</);
        if (!homeLink || !awayLink) continue;
        const score = stripTags(cells[3]).match(/^(\d+)\s*-\s*(\d+)$/);
        const loc = stripTags(cells[5]);
        const division = stripTags(cells[6]);
        const statusLabel = (cells[1].match(/label[^>]*>([^<]+)</) || [])[1] || '';

        const weAreHome = +homeLink[1] === ourTeamId;
        matches.push({
            matchNo,
            date: isoDate(when),
            time: time24(when),
            home: stripTags(homeLink[2]), away: stripTags(awayLink[2]),
            weAreHome,
            opponent: weAreHome ? stripTags(awayLink[2]) : stripTags(homeLink[2]),
            score: score ? {
                us: +(weAreHome ? score[1] : score[2]),
                them: +(weAreHome ? score[2] : score[1]),
            } : null,
            loc, division, statusLabel,
        });
    }
    return matches;
}

/* ---- venue mapping via data/venues.json locationPatterns ---- */

function resolveVenueRef(venues, locText) {
    for (const v of venues) {
        for (const pat of (v.locationPatterns || [])) {
            const m = locText.match(new RegExp(pat, 'i'));
            if (m && m[1]) {
                const raw = m[1].toUpperCase();
                return { venueId: v.id, fieldId: /^\d+$/.test(raw) ? String(parseInt(raw, 10)) : raw };
            }
        }
    }
    return null;
}

/* ---- merge one competition's pull into the team ---- */

function mergeCompetition(team, comp, parsed, venues) {
    const changes = [];

    // Standings replace wholesale — the league table is the league's.
    if (parsed.standings) {
        const rows = parsed.standings.rows.map(({ _teamId, ...r }) => r);
        const ourRow = parsed.standings.rows.find(r => r._teamId === comp.source.teamId);
        const before = JSON.stringify(comp.standings && comp.standings.rows);
        comp.standings = {
            updatedAt: new Date().toISOString().slice(0, 10),
            source: 'gotsport',
            bracket: parsed.standings.bracket,
            ourRowName: ourRow ? ourRow.name : (comp.standings && comp.standings.ourRowName),
            rows,
        };
        if (JSON.stringify(rows) !== before) changes.push('standings (' + rows.length + ' rows)');
    }

    // Games: replace this competition's slice, preserving hand-added extras by id.
    const prevById = {};
    team.games.filter(g => g.competition === comp.id).forEach(g => { prevById[g.id] = g; });

    const rankByName = {};
    ((comp.standings && comp.standings.rows) || []).forEach(r => { rankByName[r.name] = r.rank; });

    const fresh = parsed.matches.map(pm => {
        const id = comp.id + '-' + pm.matchNo;
        const prev = prevById[id] || {};
        const ref = resolveVenueRef(venues, pm.loc);
        const g = {
            ...prev,
            id,
            date: pm.date,
            time: pm.time,
            opponent: pm.opponent,
            status: pm.score ? 'played' : 'scheduled',
            competition: comp.id,
            homeAway: pm.weAreHome ? 'home' : 'away',
            locText: pm.loc,
        };
        if (pm.score) g.score = pm.score; else delete g.score;
        if (rankByName[pm.opponent] != null) g.oppRank = rankByName[pm.opponent];
        if (ref) { g.venueId = ref.venueId; g.fieldId = ref.fieldId; }
        return g;
    });

    const keepOthers = team.games.filter(g => g.competition !== comp.id);
    const before = JSON.stringify(team.games.filter(g => g.competition === comp.id));
    if (JSON.stringify(fresh) !== before) {
        const played = fresh.filter(g => g.status === 'played').length;
        changes.push('games: ' + fresh.length + ' listed, ' + played + ' played');
    }
    team.games = keepOthers.concat(fresh).sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);

    return changes;
}

/* ---- main ---- */

async function pull() {
    const data = JSON.parse(fs.readFileSync(TEAMS_PATH, 'utf8'));
    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf8')).venues || [];
    let touched = false;

    for (const [teamId, team] of Object.entries(data.teams)) {
        for (const comp of (team.competitions || [])) {
            const src = comp.source;
            if (!src || src.provider !== 'gotsport' || !src.eventId || !src.teamId) continue;

            const url = 'https://system.gotsport.com/org_event/events/' + src.eventId +
                        '/schedules?team=' + src.teamId;
            log('\n[' + teamId + ' · ' + comp.id + '] ' + url);

            let html;
            try {
                const res = await fetch(url, { headers: { 'User-Agent': UA } });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                html = await res.text();
            } catch (e) {
                fail(comp.id + ': fetch failed — ' + e.message + ' (keeping existing data)');
                continue;
            }
            if (html.indexOf('team=' + src.teamId) === -1) {
                fail(comp.id + ': page did not mention team ' + src.teamId + ' (keeping existing data)');
                continue;
            }

            const parsed = {
                standings: parseStandings(html, src.teamId),
                matches: parseMatches(html, src.teamId),
            };
            log('  parsed: ' + (parsed.standings ? parsed.standings.rows.length : 0) + ' standings rows, ' +
                parsed.matches.length + ' matches');

            // Nothing published yet (N1 before schedule drop) — leave the comp alone.
            if (!parsed.standings && !parsed.matches.length) {
                log('  nothing published yet — no change');
                continue;
            }

            const changes = mergeCompetition(team, comp, parsed, venues);
            if (changes.length) {
                touched = true;
                log('  CHANGED: ' + changes.join(' · '));
            } else {
                log('  no change');
            }
        }
    }

    if (!touched) { log('\nAll competitions up to date.'); return; }

    data.updatedAt = new Date().toISOString().slice(0, 10);
    const stamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    for (const team of Object.values(data.teams)) {
        if ((team.competitions || []).some(c => c.source && c.source.provider)) team.lastUpdate = stamp;
    }

    if (DRY) { log('\n--dry-run: not writing.'); return; }

    fs.writeFileSync(TEAMS_PATH, JSON.stringify(data, null, 2) + '\n');
    log('\nWrote data/teams.json');

    // Guard: derivation must still hold together before this goes anywhere.
    try {
        execSync('node test/verify-derivation.mjs', { cwd: repo, stdio: 'pipe' });
        log('verify-derivation: PASS');
    } catch (e) {
        fail('verify-derivation failed after merge — NOT pushing.\n' + (e.stdout || ''));
        return;
    }

    if (PUSH) {
        try {
            execSync('git add data/teams.json', { cwd: repo });
            const diff = execSync('git diff --cached --stat', { cwd: repo }).toString().trim();
            if (!diff) { log('Nothing staged — skipping push.'); return; }
            execSync('git commit -m "League sync: schedule and standings from GotSport"', { cwd: repo });
            execSync('git push', { cwd: repo, stdio: 'pipe' });
            log('Committed and pushed.');
        } catch (e) {
            fail('git push failed: ' + e.message);
        }
    }
}

pull();
