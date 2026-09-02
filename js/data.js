/* ============================================================
   DATA LAYER
   Loads data/teams.json (+ venues later), derives every stat the
   UI shows from the games list + standings. games[] is the single
   source of truth — nothing here is hand-synced.
============================================================ */

let HUB_DATA = null;   // raw parsed teams.json
let TEAMS = {};        // teamId -> derived view model (shape the renderers consume)

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function parseISODate(iso, time) {
    // iso: "2026-04-14", time: "18:30" (optional). Local time, no TZ surprises.
    const [y, m, d] = iso.split('-').map(Number);
    let h = 0, min = 0;
    if (time) { const t = time.split(':'); h = parseInt(t[0], 10); min = parseInt(t[1], 10) || 0; }
    return new Date(y, m - 1, d, h, min, 0);
}

function fmtDateShort(iso) {          // "2026-03-21" -> "Mar 21"
    const dt = parseISODate(iso);
    return MONTH_SHORT[dt.getMonth()] + ' ' + String(dt.getDate()).padStart(2, '0');
}

function fmtDateWithDay(iso) {        // "2026-04-14" -> "Tue Apr 14"
    const dt = parseISODate(iso);
    return DAY_SHORT[dt.getDay()] + ' ' + MONTH_SHORT[dt.getMonth()] + ' ' + String(dt.getDate()).padStart(2, '0');
}

function fmtTime12(time) {            // "18:30" -> "6:30 PM"
    if (!time) return '';
    const [hStr, mStr] = time.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + mStr + ' ' + ampm;
}

function gameResult(g) {              // 'W' | 'L' | 'D' from our perspective
    if (!g.score) return null;
    if (g.score.us > g.score.them) return 'W';
    if (g.score.us < g.score.them) return 'L';
    return 'D';
}

function standingsRow(team, name) {
    for (const c of competitionDefs(team)) {
        const hit = (c.standings && c.standings.rows || []).find(r => r.name === name);
        if (hit) return hit;
    }
    return null;
}

/* A team can play in several leagues at once (GCL + N1). New data lists
   them under competitions[]; a single standings block still works. */
function competitionDefs(team) {
    if (team.competitions && team.competitions.length) return team.competitions;
    if (team.standings) return [{
        id: 'league',
        label: team.branding.league || 'League',
        shortLabel: 'League',
        standings: team.standings
    }];
    return [];
}

function rowGD(r) { return (r.gf || 0) - (r.ga || 0); }
function rowPts(r, pc) { return (r.w || 0) * pc.win + (r.d || 0) * pc.draw + (r.l || 0) * pc.loss; }
function fmtSigned(n) { return n > 0 ? '+' + n : String(n); }

/* Build the view model the renderers consume. Keeps the legacy
   TEAM_CONFIG shape so every screen derives from games[]. */
function deriveTeam(teamId, team) {
    const pc = team.pointsConfig || { win: 3, draw: 1, loss: 0, drawsAllowed: true };
    const played = team.games.filter(g => g.status === 'played')
        .slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const upcoming = team.games.filter(g => g.status === 'scheduled')
        .slice().sort((a, b) => a.date < b.date ? -1 : 1);

    const compShort = {};
    competitionDefs(team).forEach(c => { compShort[c.id] = c.shortLabel || c.label || c.id; });

    // Legacy match shape for tables/timeline
    const matches = played.map(g => ({
        date: fmtDateShort(g.date),
        rank: String(g.oppRank != null ? g.oppRank : ''),
        opp: g.opponent,
        score: g.score.us + ' - ' + g.score.them,
        res: gameResult(g),
        highlight: !!g.highlight,
        comp: compShort[g.competition] || '',
        ha: g.homeAway || ''
    }));

    const record = {
        wins: matches.filter(m => m.res === 'W').length,
        losses: matches.filter(m => m.res === 'L').length,
        draws: matches.filter(m => m.res === 'D').length
    };
    const goals = {
        for: played.reduce((s, g) => s + g.score.us, 0),
        against: played.reduce((s, g) => s + g.score.them, 0)
    };

    // One derived block per competition: display rows + our league status.
    // gd/pts are computed, never hand-typed.
    const comps = competitionDefs(team).map(c => {
        const rows = (c.standings && c.standings.rows) || [];
        const compOurName = (c.standings && c.standings.ourRowName) || team.branding.name;
        const ourRow = rows.find(r => r.name === compOurName) || null;
        let league = null;
        if (ourRow) {
            const pts = rowPts(ourRow, pc);
            league = {
                rank: ourRow.rank, totalTeams: rows.length, points: pts,
                ppg: ourRow.mp ? (pts / ourRow.mp).toFixed(2) : '0.00',
                goalDiff: fmtSigned(rowGD(ourRow)),
                record: ourRow.w + '-' + ourRow.l + '-' + ourRow.d
            };
        }
        return {
            id: c.id,
            label: c.label || c.id,
            shortLabel: c.shortLabel || c.label || c.id,
            season: c.season || '',
            bracket: (c.standings && c.standings.bracket) || '',
            updatedAt: (c.standings && c.standings.updatedAt) || '',
            ourName: compOurName,
            league,
            rows: rows.map(r => ({
                rank: r.rank, name: r.name, mp: r.mp, w: r.w, d: r.d, l: r.l,
                gf: r.gf, ga: r.ga, gd: fmtSigned(rowGD(r)), pts: rowPts(r, pc),
                isOurs: r.name === compOurName
            }))
        };
    });

    // Primary competition fills the legacy top-level league/standings slots
    const primary = comps.find(c => c.rows.length) || comps[0] || null;
    const ourName = primary ? primary.ourName : team.branding.name;
    const totalTeams = primary ? primary.rows.length : 0;
    let league;
    if (primary && primary.league) {
        league = { ...primary.league };
    } else {
        const pts = record.wins * pc.win + record.draws * pc.draw + record.losses * pc.loss;
        const mp = matches.length;
        league = {
            rank: null, totalTeams: totalTeams, points: pts,
            ppg: mp ? (pts / mp).toFixed(2) : '0.00',
            goalDiff: fmtSigned(goals.for - goals.against)
        };
    }
    delete league.record;

    const standings = primary ? primary.rows : [];

    // Remaining schedule (legacy shape) + next match card
    const remainingSchedule = upcoming.map(g => ({
        date: fmtDateWithDay(g.date),
        rank: String(g.oppRank != null ? g.oppRank : ''),
        opp: g.opponent,
        time: fmtTime12(g.time),
        loc: g.locText || '',
        comp: compShort[g.competition] || '',
        ha: g.homeAway || '',
        game: g
    }));

    let nextMatch = null;
    const nextGame = upcoming[0];
    if (nextGame) {
        const oppRow = standingsRow(team, nextGame.opponent);
        const olm = nextGame.oppLastMatch;
        nextMatch = {
            oppName: nextGame.opponent,
            date: fmtDateWithDay(nextGame.date),
            time: fmtTime12(nextGame.time),
            oppRank: nextGame.oppRank != null ? nextGame.oppRank : (oppRow ? oppRow.rank : ''),
            oppTotalTeams: totalTeams,
            oppRecord: oppRow ? (oppRow.w + '-' + oppRow.l + '-' + oppRow.d) : '',
            lastMatch: olm ? {
                date: fmtDateShort(olm.date), rank: olm.rank, opp: olm.opp,
                score: olm.score, res: olm.res
            } : null
        };
    }

    return {
        id: teamId,
        branding: team.branding,
        pointsConfig: pc,
        lastUpdate: team.lastUpdate || (HUB_DATA && HUB_DATA.updatedAt) || '',
        games: team.games,
        matches: matches,
        record: record,
        goals: goals,
        league: league,
        standings: standings,
        comps: comps,
        remainingSchedule: remainingSchedule,
        nextMatch: nextMatch,
        tournaments: team.tournaments || null,
        story: team.story || null
    };
}

/* ============================================================
   FORM / STREAK / MOMENTUM (shared derivations)
============================================================ */
function getFormGuide(matches, n) {
    return matches.slice(-n).map(m => m.res);
}

function getStreak(matches) {
    if (!matches.length) return { type: null, count: 0 };
    const last = matches[matches.length - 1].res;
    let count = 0;
    for (let i = matches.length - 1; i >= 0; i--) {
        if (matches[i].res === last) count++;
        else break;
    }
    return { type: last, count };
}

function computeMomentum(matches) {
    const last5 = matches.slice(-5);
    const score = last5.reduce((sum, m) => sum + (m.res === 'W' ? 3 : m.res === 'D' ? 1 : 0), 0);
    const max = last5.length * 3;
    const pct = max > 0 ? Math.round((score / max) * 100) : 0;
    let label, color, sublabel;
    if (pct >= 87)      { label = 'ON FIRE 🔥';   color = '#f97316'; sublabel = 'Dominant last 5 matches'; }
    else if (pct >= 60) { label = 'BUILDING ↑';        color = '#16a34a'; sublabel = 'Strong recent form'; }
    else if (pct >= 33) { label = 'STEADY';                 color = '#ca8a04'; sublabel = 'Mixed results lately'; }
    else                { label = 'NEEDS A SPARK';          color = '#dc2626'; sublabel = 'Tough run of results'; }
    return { pct, score, max, label, color, sublabel };
}

/* ============================================================
   LOAD
============================================================ */
function loadHubData() {
    return fetch('data/teams.json', { cache: 'no-store' })
        .then(res => {
            if (!res.ok) throw new Error('teams.json ' + res.status);
            return res.json();
        })
        .then(json => {
            HUB_DATA = json;
            TEAMS = {};
            Object.keys(json.teams).forEach(id => { TEAMS[id] = deriveTeam(id, json.teams[id]); });
            return TEAMS;
        });
}
