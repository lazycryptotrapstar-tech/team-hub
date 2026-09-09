/* Playing-time accounting. The point of the lineup feature is that
   "did everyone get a fair run?" is a number, so the arithmetic behind it
   is worth pinning down: totals accumulate across games, the game in
   progress counts, and the under/over flag matches the even share.

   Invented names — never put a real roster in this repo. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
const src = fs.readFileSync(repo + 'js/lineup.js', 'utf8');

function lift(startMarker, endMarker) {
    const a = src.indexOf(startMarker), b = src.indexOf(endMarker);
    if (a === -1 || b === -1) {
        console.error(`FAIL: could not lift ${startMarker} .. ${endMarker} from js/lineup.js`);
        process.exit(1);
    }
    return src.slice(a, b);
}

// timeStatus lives with the fair-share helpers; seasonTotals with the history
const code =
    lift('function timeStatus(', 'function playerStatus(') +
    lift('function seasonTotals(', '/* ---- roster ----') +
    '\nreturn { timeStatus, seasonTotals, setLU: v => { LU = v; } };';
const api = new Function('let LU;\n' + code)();

let fail = 0;
const check = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); fail++; } };
const mins = s => Math.round(s / 60);

/* ---- timeStatus: the tolerance is a minute or 15%, whichever is larger ---- */
check(api.timeStatus(600, 600) === 'even', 'exactly the share is even');
check(api.timeStatus(0, 0) === 'even', 'no fair share yet reads even');
check(api.timeStatus(600, 1200) === 'under', 'half the share is under');
check(api.timeStatus(1800, 1200) === 'over', 'well above the share is over');
// 1200s share -> tolerance is 180s, so 1100 is still "about right"
check(api.timeStatus(1100, 1200) === 'even', 'inside the tolerance is even, not under');
check(api.timeStatus(1000, 1200) === 'under', 'outside the tolerance flips to under');

/* ---- seasonTotals across two games plus one in progress ---- */
const roster = [
    { id: 'p1', num: '1', name: 'Ada Keeper' },
    { id: 'p2', num: '2', name: 'Bea Back' },
    { id: 'p3', num: '3', name: 'Cara Sub' },
];
api.setLU({
    roster,
    history: [
        // game one: Ada and Bea played 30', Cara did not play
        { id: 'g1', seconds: { p1: 1800, p2: 1800 } },
        // game two: Ada 30', Cara 30', Bea did not play
        { id: 'g2', seconds: { p1: 1800, p3: 1800 } },
    ],
    live: null,
});

let t = api.seasonTotals();
const byId = Object.fromEntries(t.rows.map(r => [r.player.id, r]));
check(t.gamesCounted === 2, `two filed games counted, got ${t.gamesCounted}`);
check(mins(byId.p1.sec) === 60 && byId.p1.games === 2, 'Ada: 60 minutes over 2 games');
check(mins(byId.p2.sec) === 30 && byId.p2.games === 1, 'Bea: 30 minutes over 1 game');
check(mins(byId.p3.sec) === 30 && byId.p3.games === 1, 'Cara: 30 minutes over 1 game');
check(mins(t.total) === 120, `total playing time is 120 minutes, got ${mins(t.total)}`);
check(mins(t.fair) === 40, `even share is 40 minutes across 3 players, got ${mins(t.fair)}`);
check(byId.p1.status === 'over', 'Ada is above her share');
check(byId.p2.status === 'under' && byId.p3.status === 'under', 'the other two are below theirs');

/* a game still being played has to count, or a coach checking at half time
   is told the wrong thing */
api.setLU({
    roster,
    history: [{ id: 'g1', seconds: { p1: 1800, p2: 1800 } }],
    live: { archived: false, seconds: { p2: 600, p3: 600 } },
});
t = api.seasonTotals();
const live = Object.fromEntries(t.rows.map(r => [r.player.id, r]));
check(t.gamesCounted === 2, `one filed game plus the one in progress = 2, got ${t.gamesCounted}`);
check(mins(live.p2.sec) === 40 && live.p2.games === 2, 'Bea: 30 filed + 10 live = 40 over 2');
check(mins(live.p3.sec) === 10 && live.p3.games === 1, 'Cara: 10 live minutes only');

/* an archived live game must not be double-counted with its history row */
api.setLU({
    roster,
    history: [{ id: 'g1', seconds: { p1: 1800 } }],
    live: { archived: true, seconds: { p1: 1800 } },
});
t = api.seasonTotals();
check(mins(t.rows.find(r => r.player.id === 'p1').sec) === 30,
    'an already-filed game is not counted twice');

/* a player removed from the squad must not resurrect through old games */
api.setLU({
    roster: [{ id: 'p1', num: '1', name: 'Ada Keeper' }],
    history: [{ id: 'g1', seconds: { p1: 1800, pGone: 1800 } }],
    live: null,
});
t = api.seasonTotals();
check(t.rows.length === 1, 'a departed player does not reappear in the totals');
check(mins(t.total) === 30, 'and their minutes do not inflate the even share');

console.log(fail ? `\n${fail} check(s) failed` : 'OK: playing-time totals accumulate correctly across games');
process.exit(fail ? 1 : 0);
