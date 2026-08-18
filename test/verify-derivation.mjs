/* Regression oracle: derived values must exactly match the old hand-typed
   TEAMS block from the v1-legacy single-file app. */
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';
import path from 'path';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
const dataJs = fs.readFileSync(repo + 'js/data.js', 'utf8');
const teams = JSON.parse(fs.readFileSync(repo + 'data/teams.json', 'utf8'));

// Run data.js in a sandbox with a stubbed fetch (we call deriveTeam directly)
const ctx = { console, fetch: () => Promise.reject(new Error('no fetch in test')) };
vm.createContext(ctx);
vm.runInContext(dataJs, ctx);
ctx.HUB_DATA = teams;

const EXPECTED = {
  u13: {
    record: { wins: 6, losses: 7, draws: 1 },
    league: { rank: 11, totalTeams: 18, points: 19, ppg: '1.36', goalDiff: '-2' },
    goals: { for: 23, against: 25 },
    matchCount: 14,
    remainingCount: 1,
    // oppRecord: old app hand-typed "1-11-0", which contradicts its own standings
    // row for Hubbard (mp 13, w1 d0 l12). Derived 1-12-0 is the correct value.
    nextMatch: { oppName: 'Sting G13 Hubbard', date: 'Tue Apr 14', time: '6:30 PM', oppRank: 17, oppTotalTeams: 18, oppRecord: '1-12-0' },
    firstMatch: { date: 'Aug 23', opp: 'Frisco Fusion 13G NPL NTX Blue', score: '3 - 1', res: 'W' },
    lastMatch:  { date: 'Mar 21', opp: 'Sting Attack G13 H Pantoja', score: '2 - 5', res: 'L' },
    // spot-check standings rows (gd/pts now computed)
    standingsSpot: [
      { rank: 1,  name: 'Coppell FC 13G Oland Red', gd: '+41', pts: 36 },
      { rank: 11, name: 'Sting McNeal 13G',         gd: '-2',  pts: 19 },
      { rank: 18, name: 'FC Dallas Youth 13G White', gd: '-45', pts: 3 },
    ],
    ourRowHighlighted: 'Sting McNeal 13G',
  },
  u12: {
    record: { wins: 7, losses: 4, draws: 3 },
    league: { rank: 4, totalTeams: 16, points: 24, ppg: '1.71', goalDiff: '+17' },
    goals: { for: 33, against: 16 },
    matchCount: 14,
    remainingCount: 2,
    nextMatch: { oppName: 'Dallas Surf 14G East Silver', date: 'Wed Apr 01', time: '6:30 PM', oppRank: 14, oppTotalTeams: 16, oppRecord: '3-8-2' },
    firstMatch: { date: 'Sep 07', opp: 'Dallas Surf 14G East Silver', score: '3 - 0', res: 'W' },
    lastMatch:  { date: 'Mar 29', opp: 'Sting G14 J Salazar', score: '4 - 0', res: 'W' },
    standingsSpot: [
      { rank: 1,  name: 'Juventus Premier FC 2014G Cantu', gd: '+31', pts: 35 },
      { rank: 4,  name: 'Sting Pre-ECNL G14 McNeal',       gd: '+17', pts: 24 },
      { rank: 6,  name: 'Atletico Dallas Pre ECNL G15 Blanton', gd: '0', pts: 22 },
      { rank: 16, name: 'FW All Stars FC 2014G',           gd: '-30', pts: 5 },
    ],
    ourRowHighlighted: 'Sting Pre-ECNL G14 McNeal',
  },
};

let pass = 0, fail = 0;
function check(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; }
  else { fail++; console.log(`  FAIL ${label}\n       got:  ${g}\n       want: ${w}`); }
}

for (const id of Object.keys(EXPECTED)) {
  const e = EXPECTED[id];
  const d = ctx.deriveTeam(id, teams.teams[id]);
  console.log(`\n[${id}] ${d.branding.name}`);

  check('record', d.record, e.record);
  check('goals', d.goals, e.goals);
  check('league', d.league, e.league);
  check('match count', d.matches.length, e.matchCount);
  check('remaining count', d.remainingSchedule.length, e.remainingCount);

  const fm = d.matches[0], lm = d.matches[d.matches.length - 1];
  check('first match', { date: fm.date, opp: fm.opp, score: fm.score, res: fm.res }, e.firstMatch);
  check('last match',  { date: lm.date, opp: lm.opp, score: lm.score, res: lm.res }, e.lastMatch);

  const nm = d.nextMatch;
  check('next match', {
    oppName: nm.oppName, date: nm.date, time: nm.time,
    oppRank: nm.oppRank, oppTotalTeams: nm.oppTotalTeams, oppRecord: nm.oppRecord
  }, e.nextMatch);

  for (const spot of e.standingsSpot) {
    const row = d.standings.find(r => r.rank === spot.rank);
    check(`standings #${spot.rank}`, { rank: row.rank, name: row.name, gd: row.gd, pts: row.pts }, spot);
  }

  const ours = d.standings.filter(r => r.isOurs);
  check('our row highlighted (exactly 1)', ours.length, 1);
  check('our row name', ours[0] && ours[0].name, e.ourRowHighlighted);

  // sanity: standings pts must be internally consistent with w/d/l
  const badPts = d.standings.filter(r => r.pts !== r.w * 3 + r.d * 1);
  check('all pts consistent w/ 3-1-0', badPts.length, 0);

  // highlight flag preserved
  check('highlight flag on one match', d.matches.filter(m => m.highlight).length, 1);
}

console.log(`\n${'='.repeat(50)}\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
