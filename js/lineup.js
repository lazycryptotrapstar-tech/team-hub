/* ============================================================
   LINEUP & SUBSTITUTIONS
   The same formation board, used to run a game: assign players to
   positions, plan the rotation by minute, then run the clock against
   that plan and log what actually happened.

   COACH-ONLY, THIS DEVICE ONLY. Everything here lives in localStorage,
   one key per team per competition. Nothing is published, nothing
   reaches teams.json, and no family opening the hub sees any of it —
   the site has no accounts, so "private" has to mean "never leaves the
   browser". That matters more than usual here: this is a roster of
   children.

   Two lanes, per Dee (2026-09-09):
     PLAN — before kickoff: starting XI, periods, and substitutions by
            minute and position.
     LIVE — during the game: a running clock that says when a planned
            sub is due, and a per-player minutes tally so equal playing
            time is a number instead of a feeling.

   Players are keyed by a generated id, NOT by shirt number. Dee's real
   GCL roster has two girls on #2 and two on #8, so a number is not a
   key — keying by it silently dropped players on import and would have
   subbed the wrong child on.

   SVG rules from the tactics board apply to every dot drawn here: no
   <marker>, no var(--*) paints, no preserveAspectRatio="none", and no
   CSS transitions on left/top. See the README.
============================================================ */

const LINEUP_KEY_PREFIX = 'th_lineup_v2_';

/* view state (not persisted — these are where you are, not what you set) */
let lineupMode = 'plan';        // plan | live
let lineupModeChosen = false;   // has the coach picked a lane this session?
let lineupPicking = null;       // slot id whose player chooser is open
let lineupShowRoster = false;
let lineupEditingPositions = null;   // roster id whose position chips are open
let lineupTicker = null;

let LU = null;                  // the persisted state for the current squad
let lineupSquad = null;         // competition id whose squad is loaded

/* One hub team can play two leagues with two different squads — the McNeal
   team's GCL and N1 rosters share only five players. So the store is keyed
   per competition: separate roster, starting XI, rotation plan and game.
   A game belongs to one competition, so this is how a coach thinks of it. */
function lineupComps() {
    return (typeof TEAM_CONFIG !== 'undefined' && TEAM_CONFIG && TEAM_CONFIG.comps) || [];
}

function defaultSquad() {
    const comps = lineupComps();
    if (!comps.length) return 'default';
    // the competition of the next game, so the right squad is already loaded
    const next = (TEAM_CONFIG.remainingSchedule || [])[0];
    const nextCompId = next && next.game && next.game.competition;
    if (nextCompId && comps.some(c => c.id === nextCompId)) return nextCompId;
    return comps[0].id;
}

function activeSquad() {
    const comps = lineupComps();
    if (lineupSquad && (!comps.length || comps.some(c => c.id === lineupSquad))) return lineupSquad;
    lineupSquad = defaultSquad();
    return lineupSquad;
}

function switchLineupSquad(id) {
    lineupSquad = id;
    lineupPicking = null;
    lineupModeChosen = false;
    stopLineupTicker();
    renderLineup(document.getElementById('main-content'));
}

function lineupKey() {
    const team = (typeof currentTeamId !== 'undefined' && currentTeamId) ? currentTeamId : 'team';
    return LINEUP_KEY_PREFIX + team + '_' + activeSquad();
}

function blankLineup() {
    return {
        roster: [],                       // [{id:'p1', num:'7', name, positions:['RB']}]
        seq: 0,                           // id counter
        periods: { count: 2, minutes: 30 },
        starters: {},                     // slotId -> player id
        plan: [],                         // [{id, at, slot, on}]  on = player id
        live: null,
        history: [],                      // finished games, for season totals
    };
}

function loadLineup() {
    let raw = null;
    try { raw = localStorage.getItem(lineupKey()); } catch (e) { /* private mode */ }
    try { LU = raw ? JSON.parse(raw) : blankLineup(); } catch (e) { LU = blankLineup(); }
    const b = blankLineup();
    Object.keys(b).forEach(k => { if (LU[k] === undefined) LU[k] = b[k]; });
    if (!Array.isArray(LU.roster)) LU.roster = [];
    if (!Array.isArray(LU.plan)) LU.plan = [];
    if (!Array.isArray(LU.history)) LU.history = [];
    // positions arrived after the first rosters were imported; persist the
    // migration rather than redoing it in memory on every single render
    let migrated = false;
    LU.roster.forEach(pl => {
        if (!Array.isArray(pl.positions)) { pl.positions = pl.pos ? [pl.pos] : []; migrated = true; }
    });
    if (migrated) saveLineup();
    if (LU.live) catchUpClock();
    return LU;
}

function saveLineup() {
    try { localStorage.setItem(lineupKey(), JSON.stringify(LU)); } catch (e) { /* quota / private mode */ }
}

/* ---- helpers ---- */

function luEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function luNewId() { LU.seq = (LU.seq || 0) + 1; return 'p' + LU.seq; }

function luSlots() { return STRATEGY_433.players; }
function luSlot(id) { return STRATEGY_433.players.find(p => p.id === id); }

function rosterPlayer(id) {
    return LU.roster.find(p => p.id === id) || null;
}

/* the label a player wears: "#8" unless two of them share it */
function numLabel(p) {
    if (!p) return '';
    return p.num || '–';
}

function sharesNumber(p) {
    return !!p.num && LU.roster.filter(x => x.num === p.num).length > 1;
}

/* ---- positions ----
   TeamSnap carries at most one position per player ("#18 - GK"), but a
   coach knows Ava covers RB and CM. Positions are what make the picker
   useful: tap RB and the girls who actually play there come first. */
function allPositions() { return luSlots().map(p => p.pos); }

function playsPosition(player, posCode) {
    return !!player && Array.isArray(player.positions) && player.positions.indexOf(posCode) !== -1;
}

function togglePlayerPosition(playerId, posCode) {
    const pl = rosterPlayer(playerId);
    if (!pl) return;
    if (!Array.isArray(pl.positions)) pl.positions = [];
    const i = pl.positions.indexOf(posCode);
    if (i === -1) pl.positions.push(posCode); else pl.positions.splice(i, 1);
    // keep them in board order so the chips always read the same way
    const order = allPositions();
    pl.positions.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

function toggleEditPositions(playerId) {
    lineupEditingPositions = lineupEditingPositions === playerId ? null : playerId;
    renderLineup(document.getElementById('main-content'));
}

/* ---- playing time, and who is short of it ----
   Fair share is the pitch time available divided by the squad: eleven
   players on for T seconds is 11*T of playing time to hand out. A player
   sitting more than a tolerance below that is the one to bring on. */
function fairShareSeconds() {
    const squad = LU.roster.length;
    if (!squad || !LU.live) return 0;
    const onCount = Object.keys(LU.live.onField || {}).length || 11;
    return (liveElapsedMs() / 1000) * onCount / squad;
}

/* 'under' = owed time, 'over' = has had plenty, 'even' = about right.
   The tolerance is a whole minute or 15%, whichever is larger, so the
   indicator does not flicker in the opening minutes. */
function timeStatus(sec, fair) {
    if (!fair) return 'even';
    const tol = Math.max(60, fair * 0.15);
    if (sec < fair - tol) return 'under';
    if (sec > fair + tol) return 'over';
    return 'even';
}

function playerStatus(id) { return timeStatus(playedSeconds(id), fairShareSeconds()); }

/* least-played first — the order a coach picking the next sub wants */
function byNeed(a, b) { return playedSeconds(a.id) - playedSeconds(b.id); }

/* "Ava Martin" -> "Ava M."  — a dot is 40px wide; a full name never fits */
function shortName(name) {
    const parts = String(name || '').trim().split(/\s+/);
    if (parts.length < 2) return parts[0] || '';
    return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
}

function currentAssignment() {
    if (lineupMode === 'live' && LU.live) return LU.live.onField || {};
    return LU.starters || {};
}

function assignedIds() {
    return Object.values(currentAssignment()).filter(Boolean);
}

function benchPlayers() {
    const on = assignedIds();
    return LU.roster.filter(p => on.indexOf(p.id) === -1);
}

function matchLengthMin() { return LU.periods.count * LU.periods.minutes; }

function periodLabel(n) {
    const c = LU.periods.count;
    if (c === 2) return n === 1 ? '1st Half' : '2nd Half';
    const ord = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'][n] || (n + 'th');
    return ord + ' Quarter';
}

/* ---- the clock ----
   elapsedMs is total match time, accumulated across periods. It only
   advances while status is 'running', and half-time never accrues.
   lastTick lets a reload credit the seconds that passed while the tab
   was closed, so the minutes tally stays true to the actual game. */

function liveElapsedMs() {
    const L = LU.live;
    if (!L) return 0;
    return L.elapsedMs + (L.status === 'running' && L.runningSince ? Date.now() - L.runningSince : 0);
}

function liveMinute() { return Math.floor(liveElapsedMs() / 60000); }

function fmtClock(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

function fmtMins(sec) { return Math.round(sec / 60) + "'"; }

/* Credit elapsed wall-clock to whoever was on the pitch for it. Called on
   every tick and once on load, so closing the tab mid-game costs nothing.

   This MUST persist what it credits. Every interaction re-renders, and
   every render calls loadLineup(), which re-reads localStorage — so a
   credit left only in memory is discarded by the next tap, and the
   minutes tally silently under-counts. Fair playing time is the reason
   this feature exists; it cannot be approximate. */
function catchUpClock() {
    const L = LU.live;
    if (!L) return;
    if (!L.seconds) L.seconds = {};
    const now = Date.now();
    if (L.status !== 'running' || !L.lastTick) { L.lastTick = now; return; }
    const delta = Math.max(0, Math.floor((now - L.lastTick) / 1000));
    if (delta > 0) {
        Object.values(L.onField || {}).forEach(id => {
            if (!id) return;
            L.seconds[id] = (L.seconds[id] || 0) + delta;
        });
        L.lastTick = L.lastTick + delta * 1000;
        saveLineup();
    }
}

function playedSeconds(id) {
    return (LU.live && LU.live.seconds && LU.live.seconds[id]) || 0;
}

/* ---- plan lane ---- */

function lineupTapSlot(slotId) {
    lineupPicking = lineupPicking === slotId ? null : slotId;
    renderLineup(document.getElementById('main-content'));
}

function lineupAssign(slotId, playerId) {
    if (lineupMode === 'live' && LU.live) {
        applyLiveSub(slotId, playerId, null);
        return;
    }
    // a player can only hold one position — clear them from any other slot
    Object.keys(LU.starters).forEach(k => {
        if (LU.starters[k] === playerId) delete LU.starters[k];
    });
    if (!playerId) delete LU.starters[slotId];
    else LU.starters[slotId] = playerId;
    lineupPicking = null;
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

function lineupAddPlannedSub() {
    const at = parseInt(document.getElementById('luPlanAt').value, 10);
    const slot = parseInt(document.getElementById('luPlanSlot').value, 10);
    const on = document.getElementById('luPlanOn').value;
    if (!(at >= 0) || !slot || !on) return;
    LU.plan.push({ id: 'sub' + Date.now(), at: at, slot: slot, on: on });
    LU.plan.sort((a, b) => a.at - b.at);
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

function lineupRemovePlan(id) {
    LU.plan = LU.plan.filter(p => p.id !== id);
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

function lineupSetPeriods(count, minutes) {
    LU.periods = { count: parseInt(count, 10) || 2, minutes: parseInt(minutes, 10) || 30 };
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

/* Who the plan says is in this slot at minute `at` — the starter, unless an
   earlier planned sub already changed it. Lets the plan list say who goes
   off without the coach having to track it in their head. */
function plannedOccupant(slotId, at) {
    let who = LU.starters[slotId];
    LU.plan.filter(p => p.slot === slotId && p.at < at)
        .sort((a, b) => a.at - b.at)
        .forEach(p => { who = p.on; });
    return who;
}

/* ---- live lane ---- */

/* the next unplayed fixture in this competition, so a finished game files
   itself under the right opponent instead of "a game on Saturday" */
function nextFixture() {
    const sched = (typeof TEAM_CONFIG !== 'undefined' && TEAM_CONFIG && TEAM_CONFIG.remainingSchedule) || [];
    const squad = activeSquad();
    /* skip fixtures already filed: the league sync only drops a game off the
       schedule once it posts the result, so two games played before the next
       sync would otherwise both be labelled with the same opponent */
    const used = (LU.history || []).map(g => g.gameId).filter(Boolean);
    const mine = sched.filter(x => x.game && x.game.competition === squad);
    const pool = mine.length ? mine : sched;
    const m = pool.find(x => used.indexOf(x.game && x.game.id) === -1) || pool[0];
    return m ? { opp: m.opp, date: m.date, ha: m.ha, gameId: m.game && m.game.id } : null;
}

function startLive() {
    if (!Object.keys(LU.starters).length) return;
    const fx = nextFixture();
    LU.live = {
        status: 'paused',
        period: 1,
        fixture: fx,
        startedOn: new Date().toISOString().slice(0, 10),
        elapsedMs: 0,
        runningSince: null,
        lastTick: Date.now(),
        onField: Object.assign({}, LU.starters),
        seconds: {},
        applied: [],
        log: [],
    };
    lineupMode = 'live';
    lineupModeChosen = true;
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

function toggleClock() {
    const L = LU.live;
    if (!L || L.status === 'done') return;
    catchUpClock();
    if (L.status === 'running') {
        L.elapsedMs = liveElapsedMs();
        L.status = 'paused';
        L.runningSince = null;
    } else {
        L.status = 'running';
        L.runningSince = Date.now();
        L.lastTick = Date.now();
    }
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

function endPeriod() {
    const L = LU.live;
    if (!L) return;
    catchUpClock();
    L.elapsedMs = liveElapsedMs();
    L.status = 'paused';
    L.runningSince = null;
    if (L.period >= LU.periods.count) {
        L.status = 'done';
        archiveGame();
    } else {
        // half-time must not accrue: jump the clock to the period boundary
        L.period += 1;
        L.elapsedMs = Math.max(L.elapsedMs, (L.period - 1) * LU.periods.minutes * 60000);
    }
    L.lastTick = Date.now();
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

function applyLiveSub(slotId, playerId, planId) {
    const L = LU.live;
    if (!L) return;
    catchUpClock();
    const off = L.onField[slotId];
    if (off === playerId) { lineupPicking = null; renderLineup(document.getElementById('main-content')); return; }
    // one player, one position
    Object.keys(L.onField).forEach(k => {
        if (L.onField[k] === playerId) delete L.onField[k];
    });
    if (!playerId) delete L.onField[slotId];
    else L.onField[slotId] = playerId;
    L.log.unshift({
        minute: liveMinute(), slot: slotId,
        on: playerId || null,
        off: off || null,
        planned: !!planId,
    });
    if (planId && L.applied.indexOf(planId) === -1) L.applied.push(planId);
    lineupPicking = null;
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

/* File a played game into the season record. Called when the game ends and
   again if it is cleared without ending — a coach who just closes the app
   at full time should not lose the minutes. `archived` guards the double. */
function archiveGame() {
    const L = LU.live;
    if (!L || L.archived) return false;
    catchUpClock();
    const played = Object.values(L.seconds || {}).reduce((a, b) => a + b, 0);
    if (played < 60) return false;              // nothing worth recording
    LU.history.unshift({
        id: 'g' + Date.now(),
        date: L.startedOn || new Date().toISOString().slice(0, 10),
        opp: (L.fixture && L.fixture.opp) || '',
        ha: (L.fixture && L.fixture.ha) || '',
        gameId: (L.fixture && L.fixture.gameId) || null,
        elapsedMs: liveElapsedMs(),
        periods: Object.assign({}, LU.periods),
        seconds: Object.assign({}, L.seconds),
        subs: (L.log || []).length,
    });
    L.archived = true;
    saveLineup();
    return true;
}

function dismissPlanned(planId) {
    const L = LU.live;
    if (!L) return;
    if (L.applied.indexOf(planId) === -1) L.applied.push(planId);
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

/* planned subs whose minute has arrived and that have not been handled */
function dueSubs() {
    const L = LU.live;
    if (!L) return [];
    const m = liveMinute();
    return LU.plan.filter(p => p.at <= m && L.applied.indexOf(p.id) === -1);
}

function resetLive() {
    archiveGame();          // keep the minutes even if "End game" was never pressed
    LU.live = null;
    lineupMode = 'plan';
    lineupModeChosen = true;
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

function deleteHistoryGame(id) {
    LU.history = LU.history.filter(g => g.id !== id);
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

/* ---- season totals ----
   Accumulated across every filed game, plus the one in progress, because a
   coach checking "who is short?" at half time means including today. */
function seasonTotals() {
    const rows = LU.roster.map(pl => ({ player: pl, sec: 0, games: 0 }));
    const byId = {};
    rows.forEach(r => { byId[r.player.id] = r; });

    LU.history.forEach(g => {
        Object.keys(g.seconds || {}).forEach(id => {
            const r = byId[id];
            if (!r) return;                      // player has left the squad
            r.sec += g.seconds[id];
            if (g.seconds[id] > 0) r.games += 1;
        });
    });
    const liveSecs = (LU.live && !LU.live.archived && LU.live.seconds) || null;
    if (liveSecs) {
        Object.keys(liveSecs).forEach(id => {
            const r = byId[id];
            if (!r) return;
            r.sec += liveSecs[id];
            if (liveSecs[id] > 0) r.games += 1;
        });
    }
    const total = rows.reduce((a, r) => a + r.sec, 0);
    const fair = rows.length ? total / rows.length : 0;
    rows.forEach(r => { r.status = timeStatus(r.sec, fair); });
    return { rows: rows, total: total, fair: fair, gamesCounted: LU.history.length + (liveSecs ? 1 : 0) };
}

/* ---- roster ---- */

function lineupAddPlayer() {
    const numEl = document.getElementById('luRosterNum');
    const nameEl = document.getElementById('luRosterName');
    const num = (numEl.value || '').trim().replace('#', '');
    const name = (nameEl.value || '').trim();
    if (!name) return;
    LU.roster.push({ id: luNewId(), num: num, name: name, positions: [] });
    sortRoster();
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

function sortRoster() {
    LU.roster.sort((a, b) => (parseInt(a.num, 10) || 999) - (parseInt(b.num, 10) || 999)
        || String(a.name).localeCompare(String(b.name)));
}

function lineupRemovePlayer(id) {
    LU.roster = LU.roster.filter(p => p.id !== id);
    Object.keys(LU.starters).forEach(k => { if (LU.starters[k] === id) delete LU.starters[k]; });
    LU.plan = LU.plan.filter(p => p.on !== id);
    if (LU.live) {
        Object.keys(LU.live.onField).forEach(k => { if (LU.live.onField[k] === id) delete LU.live.onField[k]; });
    }
    saveLineup();
    renderLineup(document.getElementById('main-content'));
}

/* Paste a roster rather than typing eleven names on a phone.

   Two shapes, because the real source is a TeamSnap roster page and
   select-all-copy on it does NOT give you tidy lines. It gives a block per
   player: the player's name, then a pile of parent names, emails and phone
   numbers, then the shirt number on its own line as "#28" or "#18 - GK".
   So: if a line is nothing but a number, read the text in blocks ending at
   each one; otherwise fall back to one player per line.

   Only the name and the number are ever kept. The roster page is full of
   parents' emails and phone numbers and none of that belongs in here. */

const ROSTER_NOISE = /^(roster|add|clear|export|name|contact info|#\s*\/\s*position|manager|edit|delete|invite to join|team manager|team owner|edit my profile|total players.*|total non-players.*)$/i;

function looksLikeContact(line) {
    return /@/.test(line)                                   // email
        || /\d{3}[^a-z]*\d{3}[^a-z]*\d{4}/i.test(line)      // phone, any punctuation
        || /^\+?\d[\d\s().-]{6,}$/.test(line);
}

function cleanName(s) {
    return String(s).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s*[-–]\s*(Mom|Dad)\s*$/i, '').trim();
}

function parseRoster(text) {
    const raw = String(text || '');
    // everything after the Non-Players heading is coaches and managers
    const body = raw.split(/^\s*non-?players\s*$/im)[0];
    const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    /* A block-mode number sits alone on its line ("#28", "#18 - GK").
       "#9 Nora Diaz" is a whole player on one line and must NOT trigger it,
       or the parser eats the preceding lines as that player's block. */
    const NUM_ONLY = /^#\s*(\d{1,3})\s*(?:[-–]\s*([A-Za-z/]+)\s*)?$/;
    const blockMode = lines.some(l => NUM_ONLY.test(l));
    const out = [];

    if (blockMode) {
        let block = [];
        lines.forEach(line => {
            const m = line.match(NUM_ONLY);
            if (!m) { block.push(line); return; }
            // the first line of the block that is a name is the player
            const name = block.find(l => !ROSTER_NOISE.test(l) && !looksLikeContact(l) && /[a-z]/i.test(l));
            if (name) out.push({ num: m[1], name: cleanName(name), pos: m[2] || '' });
            block = [];
        });
    } else {
        lines.forEach(line => {
            if (ROSTER_NOISE.test(line) || looksLikeContact(line)) return;
            const cells = line.split(/\t+|\s{2,}/).map(c => c.trim()).filter(Boolean);
            let num = '', name = '';
            if (cells.length > 1) {
                const i = cells.findIndex(c => /^#?\d{1,3}$/.test(c));
                if (i !== -1) {
                    num = cells[i].replace('#', '');
                    name = cells.filter((c, j) => j !== i && /[a-z]/i.test(c))[0] || '';
                } else {
                    name = cells.find(c => /[a-z]/i.test(c)) || '';
                }
            } else {
                const lead = line.match(/^#?(\d{1,3})[\s.)-]+(.+)$/);
                const trail = line.match(/^(.+?)[\s,]+#?(\d{1,3})$/);
                if (lead) { num = lead[1]; name = lead[2]; }
                else if (trail) { name = trail[1]; num = trail[2]; }
                else { name = line; }
            }
            if (name && /[a-z]/i.test(name)) out.push({ num: num, name: cleanName(name), pos: '' });
        });
    }
    return out.filter(p => p.name);
}

function lineupImportRoster() {
    const box = document.getElementById('luRosterPaste');
    const note = document.getElementById('luImportNote');
    const parsed = parseRoster(box.value);
    if (!parsed.length) {
        if (note) note.textContent = 'Nothing recognisable in there — one player per line, or paste the whole roster page.';
        return;
    }
    /* Match on name, not number: two girls share #2 on the real roster, so
       a number cannot identify anyone. Re-importing updates rather than
       duplicating. */
    let added = 0, updated = 0;
    parsed.forEach(p => {
        const existing = LU.roster.find(x => x.name.toLowerCase() === p.name.toLowerCase());
        if (existing) {
            existing.num = p.num || existing.num;
            // TeamSnap's single position seeds the list without wiping edits
            if (p.pos && !playsPosition(existing, p.pos)) existing.positions.push(p.pos);
            updated++;
        } else {
            LU.roster.push({ id: luNewId(), num: p.num, name: p.name, positions: p.pos ? [p.pos] : [] });
            added++;
        }
    });
    sortRoster();
    saveLineup();
    // the panel would otherwise collapse on the re-render, taking the
    // confirmation and any duplicate-number warning with it
    lineupShowRoster = true;
    renderLineup(document.getElementById('main-content'));
    const n2 = document.getElementById('luImportNote');
    if (n2) n2.textContent = added + ' added' + (updated ? ', ' + updated + ' updated' : '') + '.';
}

/* Fill whatever is still empty: for each open position, the player who
   can play there and has had the least time. It is a starting point a
   coach then argues with, not a selection policy. */
function lineupFillEmpty() {
    const assign = currentAssignment();
    const taken = Object.values(assign).filter(Boolean);
    const free = LU.roster.filter(pl => taken.indexOf(pl.id) === -1).sort(byNeed);
    let placed = 0;
    luSlots().forEach(slot => {
        if (assign[slot.id]) return;
        let i = free.findIndex(pl => playsPosition(pl, slot.pos));
        if (i === -1) i = free.findIndex(pl => !pl.positions || !pl.positions.length);
        if (i === -1) return;                  // nobody left who fits
        const pick = free.splice(i, 1)[0];
        if (lineupMode === 'live' && LU.live) LU.live.onField[slot.id] = pick.id;
        else LU.starters[slot.id] = pick.id;
        placed++;
    });
    if (placed) { saveLineup(); renderLineup(document.getElementById('main-content')); }
}

function toggleRosterPanel() {
    lineupShowRoster = !lineupShowRoster;
    renderLineup(document.getElementById('main-content'));
}

function switchLineupMode(m) {
    lineupMode = m;
    lineupModeChosen = true;
    lineupPicking = null;
    renderLineup(document.getElementById('main-content'));
}

/* ---- board ---- */

function lineupPitch() {
    const assign = currentAssignment();
    const dots = luSlots().map(p => {
        const pl = rosterPlayer(assign[p.id]);
        const label = pl ? luEsc(shortName(pl.name)) : p.pos;
        const big = pl ? luEsc(numLabel(pl)) : p.pos.slice(0, 2);
        const picking = lineupPicking === p.id;
        /* the time indicator: a ring on the dot of anyone who has had well
           more or well less than their share, so "who comes off" is visible
           on the board itself rather than only in the list below */
        const st = (pl && LU.live) ? playerStatus(pl.id) : 'even';
        const mins = (pl && LU.live) ? ' · ' + fmtMins(playedSeconds(pl.id)) : '';
        const title = pl
            ? p.pos + ' — #' + luEsc(numLabel(pl)) + ' ' + luEsc(pl.name) + mins +
              (st === 'over' ? ' (had plenty)' : st === 'under' ? ' (owed time)' : '')
            : p.pos + ' — nobody assigned';
        return `<button class="sp-dot lu-dot sp-${p.type}${pl ? '' : ' lu-empty'}${picking ? ' lu-picking' : ''}` +
            `${pl && LU.live ? ' lu-t-' + st : ''}"` +
            ` data-slot="${p.id}" style="left:${p.base[0]}%;top:${p.base[1]}%;"` +
            ` onclick="lineupTapSlot(${p.id})" title="${title}" aria-label="${title}">` +
            `<span class="sp-num">${big}</span><span class="sp-pos">${label}</span></button>`;
    }).join('');
    return `<div class="pitch-wrap">${pitchSurfaceSVG(null)}${dots}</div>`;
}

/* the chooser that opens under the board when you tap a position */
function lineupPicker() {
    if (lineupPicking == null) return '';
    const slot = luSlot(lineupPicking);
    if (!slot) return '';
    const assign = currentAssignment();
    const here = assign[lineupPicking];
    /* Order the chooser the way the decision is actually made: players who
       cover this position first, and within that the ones owed time. */
    const ordered = LU.roster.slice().sort((a, b) => {
        const ea = playsPosition(a, slot.pos) ? 0 : 1;
        const eb = playsPosition(b, slot.pos) ? 0 : 1;
        if (ea !== eb) return ea - eb;
        if (LU.live) return byNeed(a, b);
        return 0;
    });
    const anyEligible = ordered.some(p => playsPosition(p, slot.pos));
    const options = ordered.map(p => {
        const elsewhere = Object.keys(assign).some(k => +k !== lineupPicking && assign[k] === p.id);
        const isHere = here === p.id;
        const fits = playsPosition(p, slot.pos);
        const mins = LU.live ? ` <em class="lu-t-${playerStatus(p.id)}">${fmtMins(playedSeconds(p.id))}</em>` : '';
        return `<button class="lu-pick${isHere ? ' active' : ''}${elsewhere ? ' lu-pick-busy' : ''}` +
            `${anyEligible && !fits ? ' lu-pick-off' : ''}"` +
            ` onclick="lineupAssign(${lineupPicking},'${p.id}')">` +
            `<b>${luEsc(numLabel(p))}</b><span>${luEsc(p.name)}</span>${mins}` +
            (elsewhere ? '<i>on</i>' : '') + '</button>';
    }).join('');
    return `<div class="lu-picker">
        <div class="lu-picker-head">
            <span>Who plays <b>${slot.pos}</b>?</span>
            <button class="lu-x" onclick="lineupTapSlot(${lineupPicking})" aria-label="Close">✕</button>
        </div>
        <div class="lu-pick-grid">${options || '<span class="lu-none">No players yet — add the roster below.</span>'}</div>
        ${here ? `<button class="lu-clear" onclick="lineupAssign(${lineupPicking},'')">Leave ${slot.pos} empty</button>` : ''}
    </div>`;
}

function lineupBench() {
    if (!LU.roster.length) return '';
    // least-played first, so the girl who should go on next is leftmost
    const bench = benchPlayers().slice().sort(LU.live ? byNeed : (a, b) => 0);
    const chips = bench.map(p => {
        const st = LU.live ? playerStatus(p.id) : 'even';
        return `<span class="lu-bench-chip${LU.live ? ' lu-t-' + st : ''}">` +
            `<b>${luEsc(numLabel(p))}</b>${luEsc(p.name)}` +
            (LU.live ? `<em>${fmtMins(playedSeconds(p.id))}</em>` : '') + '</span>';
    }).join('');
    const owed = LU.live ? bench.filter(p => playerStatus(p.id) === 'under').length : 0;
    return `<div class="lu-bench">
        <div class="lu-bench-label">Bench · ${bench.length}${owed ? ' · ' + owed + ' owed time' : ''}</div>
        <div class="lu-bench-row">${chips || '<span class="lu-none">Everyone is on the pitch.</span>'}</div>
    </div>`;
}

/* ---- minutes ----
   The reason this feature exists: at the end of a game a coach should be
   able to answer "did everyone get a fair run?" with a number. */
function lineupMinutes() {
    if (!LU.live || !LU.roster.length) return '';
    const onField = Object.values(LU.live.onField || {});
    const fair = fairShareSeconds();
    const total = Math.max(1, liveElapsedMs() / 1000);
    const fairPct = Math.min(100, (fair / total) * 100);
    // least played at the top: the question is who still needs time
    const rows = LU.roster.slice().sort(byNeed).map(p => {
        const sec = playedSeconds(p.id);
        const pct = Math.min(100, (sec / total) * 100);
        const on = onField.indexOf(p.id) !== -1;
        const st = timeStatus(sec, fair);
        /* the "on" flag is its own column: inside the name span it got
           eaten by the ellipsis on longer names */
        return `<div class="lu-min-row${on ? ' on' : ''} lu-t-${st}">
            <span class="lu-min-num">${luEsc(numLabel(p))}</span>
            <span class="lu-min-name">${luEsc(p.name)}</span>
            <span class="lu-min-flag">${on ? 'on' : ''}</span>
            <span class="lu-min-bar"><span style="width:${pct.toFixed(0)}%"></span>
                <i style="left:${fairPct.toFixed(0)}%"></i></span>
            <span class="lu-min-val">${fmtMins(sec)}</span>
        </div>`;
    }).join('');
    return `<div class="lu-block">
        <div class="lu-block-head">Minutes this game <span>fair share ${fmtMins(fair)}</span></div>
        <div class="lu-mins">${rows}</div>
        <div class="lu-legend">
            <span class="lu-t-under">owed time</span>
            <span class="lu-t-even">about right</span>
            <span class="lu-t-over">had plenty</span>
            <span class="lu-legend-tick">the tick is an even share</span>
        </div>
    </div>`;
}

/* ---- plan lane render ---- */

function lineupPlanPanel() {
    const slotOpts = luSlots().map(p => `<option value="${p.id}">${p.pos} (#${p.id})</option>`).join('');
    const playerOpts = LU.roster.map(p =>
        `<option value="${p.id}">#${luEsc(numLabel(p))} ${luEsc(p.name)}</option>`).join('');

    const rows = LU.plan.map(p => {
        const slot = luSlot(p.slot);
        const on = rosterPlayer(p.on);
        const off = rosterPlayer(plannedOccupant(p.slot, p.at));
        return `<div class="lu-plan-row">
            <span class="lu-plan-at">${p.at}'</span>
            <span class="lu-plan-pos">${slot ? slot.pos : '?'}</span>
            <span class="lu-plan-swap">
                <b>${on ? '#' + luEsc(numLabel(on)) + ' ' + luEsc(on.name) : 'someone'}</b>
                ${off ? '<i>for #' + luEsc(numLabel(off)) + ' ' + luEsc(off.name) + '</i>' : '<i>on</i>'}
            </span>
            <button class="lu-x" onclick="lineupRemovePlan('${p.id}')" aria-label="Remove this sub">✕</button>
        </div>`;
    }).join('');

    const maxMin = matchLengthMin();
    return `<div class="lu-block">
        <div class="lu-block-head">Rotation plan
            <span>${LU.plan.length} sub${LU.plan.length === 1 ? '' : 's'} · ${LU.periods.count}×${LU.periods.minutes}′</span>
        </div>
        <div class="lu-plan-list">${rows || '<span class="lu-none">No subs planned yet.</span>'}</div>
        <div class="lu-plan-add">
            <label>Minute<input id="luPlanAt" type="number" min="0" max="${maxMin}" step="1" value="${Math.round(maxMin / 4)}" inputmode="numeric"></label>
            <label>Position<select id="luPlanSlot">${slotOpts}</select></label>
            <label>Brings on<select id="luPlanOn">${playerOpts || '<option value="">add the roster first</option>'}</select></label>
            <button class="lu-add" onclick="lineupAddPlannedSub()">Add sub</button>
        </div>
        <div class="lu-periods">
            <span>Game length</span>
            <select onchange="lineupSetPeriods(this.value,document.getElementById('luPerMin').value)">
                <option value="2"${LU.periods.count === 2 ? ' selected' : ''}>2 periods</option>
                <option value="4"${LU.periods.count === 4 ? ' selected' : ''}>4 periods</option>
            </select>
            <select id="luPerMin" onchange="lineupSetPeriods(LU.periods.count,this.value)">
                ${[10, 12, 15, 20, 25, 30, 35, 40, 45].map(m =>
                    `<option value="${m}"${LU.periods.minutes === m ? ' selected' : ''}>${m} min each</option>`).join('')}
            </select>
        </div>
    </div>`;
}

/* ---- live lane render ---- */

function lineupClockBar() {
    const L = LU.live;
    const running = L.status === 'running';
    const done = L.status === 'done';
    return `<div class="lu-clock">
        <div class="lu-clock-left">
            <div class="lu-clock-period">${done ? 'Full time' : periodLabel(L.period)}</div>
            <div class="lu-clock-time">${fmtClock(liveElapsedMs())}</div>
        </div>
        <div class="lu-clock-btns">
            ${done ? '' : `<button class="lu-btn lu-btn-go${running ? ' running' : ''}" onclick="toggleClock()">${running ? '❚❚ Pause' : '▶ Start'}</button>`}
            ${done ? '' : `<button class="lu-btn" onclick="endPeriod()">${L.period >= LU.periods.count ? 'End game' : 'End period'}</button>`}
        </div>
    </div>`;
}

function lineupDueBanner() {
    const due = dueSubs();
    if (!due.length) return '';
    return due.map(p => {
        const slot = luSlot(p.slot);
        const on = rosterPlayer(p.on);
        const off = rosterPlayer(LU.live.onField[p.slot]);
        return `<div class="lu-due">
            <div class="lu-due-text">
                <span class="lu-due-flag">Sub due · ${p.at}'</span>
                <b>#${luEsc(on ? numLabel(on) : '?')} ${luEsc(on ? on.name : '')}</b> on at <b>${slot ? slot.pos : '?'}</b>
                ${off ? 'for #' + luEsc(numLabel(off)) + ' ' + luEsc(off.name) : ''}
            </div>
            <div class="lu-due-btns">
                <button class="lu-btn lu-btn-go" onclick="applyLiveSub(${p.slot},'${p.on}','${p.id}')">Make sub</button>
                <button class="lu-btn" onclick="dismissPlanned('${p.id}')">Skip</button>
            </div>
        </div>`;
    }).join('');
}

function lineupLog() {
    const L = LU.live;
    if (!L || !L.log.length) return '';
    const rows = L.log.map(e => {
        const slot = luSlot(e.slot);
        const on = rosterPlayer(e.on);
        const off = rosterPlayer(e.off);
        return `<div class="lu-log-row">
            <span class="lu-log-min">${e.minute}'</span>
            <span class="lu-log-pos">${slot ? slot.pos : '?'}</span>
            <span class="lu-log-txt">${on ? '#' + luEsc(numLabel(on)) + ' ' + luEsc(on.name) : 'empty'}
                ${off ? '<i>for #' + luEsc(numLabel(off)) + ' ' + luEsc(off.name) + '</i>' : ''}</span>
            ${e.planned ? '<span class="lu-log-tag">planned</span>' : ''}
        </div>`;
    }).join('');
    return `<div class="lu-block">
        <div class="lu-block-head">Subs made <span>${L.log.length}</span></div>
        <div class="lu-log">${rows}</div>
    </div>`;
}

/* ---- season page ----
   The accumulating answer to "who has actually played this season?".
   Every filed game plus the one in progress, per player. */
function lineupSeason() {
    const t = seasonTotals();
    if (!LU.roster.length) {
        return `<div class="lu-block"><div class="lu-block-head">Playing time</div>
            <span class="lu-none">Add the roster first — totals build up as games are played.</span></div>`;
    }
    if (!t.gamesCounted) {
        return `<div class="lu-block"><div class="lu-block-head">Playing time</div>
            <p class="lu-season-note">No games recorded yet. A game is filed here when you press
            <b>End game</b>, or when you clear one that has time on it.</p></div>`;
    }

    const max = Math.max(1, ...t.rows.map(r => r.sec));
    const fairPct = Math.min(100, (t.fair / max) * 100);
    const rows = t.rows.slice().sort((a, b) => a.sec - b.sec).map(r => `
        <div class="lu-season-row lu-t-${r.status}">
            <span class="lu-min-num">${luEsc(numLabel(r.player))}</span>
            <span class="lu-season-name">${luEsc(r.player.name)}</span>
            <span class="lu-season-games">${r.games}<i>g</i></span>
            <span class="lu-min-bar"><span style="width:${((r.sec / max) * 100).toFixed(0)}%"></span>
                <i style="left:${fairPct.toFixed(0)}%"></i></span>
            <span class="lu-season-tot">${fmtMins(r.sec)}</span>
        </div>`).join('');

    const games = LU.history.map(g => {
        const played = Object.keys(g.seconds || {}).filter(k => g.seconds[k] > 0).length;
        return `<div class="lu-game-row">
            <span class="lu-game-date">${luEsc(g.date)}</span>
            <span class="lu-game-opp">${g.ha === 'away' ? '@ ' : g.opp ? 'vs ' : ''}${luEsc(g.opp || 'Game')}</span>
            <span class="lu-game-meta">${Math.round(g.elapsedMs / 60000)}′ · ${played} played · ${g.subs} sub${g.subs === 1 ? '' : 's'}</span>
            <button class="lu-x" onclick="deleteHistoryGame('${g.id}')" aria-label="Remove this game">✕</button>
        </div>`;
    }).join('');

    const live = LU.live && !LU.live.archived;
    const shortest = t.rows.slice().sort((a, b) => a.sec - b.sec).filter(r => r.status === 'under');

    return `<div class="lu-block">
        <div class="lu-block-head">Playing time
            <span>${t.gamesCounted} game${t.gamesCounted === 1 ? '' : 's'} · even share ${fmtMins(t.fair)}</span>
        </div>
        ${live ? '<div class="lu-season-note">Includes the game in progress.</div>' : ''}
        ${shortest.length ? `<div class="lu-owed">Owed time: ${shortest.slice(0, 4)
            .map(r => '<b>#' + luEsc(numLabel(r.player)) + ' ' + luEsc(r.player.name.split(' ')[0]) + '</b>').join(', ')}</div>` : ''}
        <div class="lu-season">${rows}</div>
        <div class="lu-legend">
            <span class="lu-t-under">below share</span>
            <span class="lu-t-even">about right</span>
            <span class="lu-t-over">above share</span>
            <span class="lu-legend-tick">the tick is an even share</span>
        </div>
    </div>
    ${games ? `<div class="lu-block">
        <div class="lu-block-head">Games recorded <span>${LU.history.length}</span></div>
        <div class="lu-games">${games}</div>
    </div>` : ''}`;
}

/* ---- roster panel ---- */

function lineupRosterPanel() {
    const clashes = LU.roster.filter(sharesNumber);
    const clashNums = [...new Set(clashes.map(p => p.num))];
    const positions = allPositions();
    const rows = LU.roster.map(p => {
        const open = lineupEditingPositions === p.id;
        const mine = (p.positions || []);
        return `<div class="lu-roster-row${open ? ' open' : ''}">
            <span class="lu-roster-num${sharesNumber(p) ? ' clash' : ''}">${luEsc(numLabel(p))}</span>
            <span class="lu-roster-name">${luEsc(p.name)}</span>
            <button class="lu-pos-btn${mine.length ? '' : ' empty'}" onclick="toggleEditPositions('${p.id}')"
                aria-label="Positions for ${luEsc(p.name)}" aria-expanded="${open}">${
                mine.length ? mine.map(x => luEsc(x)).join(' ') : 'set positions'}</button>
            <button class="lu-x" onclick="lineupRemovePlayer('${p.id}')" aria-label="Remove ${luEsc(p.name)}">✕</button>
        </div>` + (open ? `<div class="lu-pos-grid">${positions.map(code =>
            `<button class="lu-pos-chip${playsPosition(p, code) ? ' on' : ''}"
                onclick="togglePlayerPosition('${p.id}','${code}')">${code}</button>`).join('')}</div>` : '');
    }).join('');
    return `<div class="lu-block">
        <div class="lu-block-head">Roster <span>${LU.roster.length} player${LU.roster.length === 1 ? '' : 's'}</span></div>
        ${clashNums.length ? `<div class="lu-warn">Two players share ${clashNums.map(n => '#' + luEsc(n)).join(' and ')}.
            They work fine here — each is tracked separately — but on the board and in the log they read the same.
            Worth giving one of them a different number in TeamSnap.</div>` : ''}
        <div class="lu-roster">${rows || '<span class="lu-none">No players yet.</span>'}</div>
        <div class="lu-roster-add">
            <input id="luRosterNum" type="text" inputmode="numeric" maxlength="3" placeholder="#" aria-label="Shirt number">
            <input id="luRosterName" type="text" placeholder="Player name" aria-label="Player name">
            <button class="lu-add" onclick="lineupAddPlayer()">Add</button>
        </div>
        <details class="lu-import">
            <summary>Paste a roster instead</summary>
            <p>Open the team's roster page in TeamSnap, select all, copy, and paste it here — parent names, emails
               and phone numbers are all discarded, only the player and the shirt number are kept.
               <code>7 Ava Martin</code> per line works too. Pasting again updates rather than duplicates.</p>
            <textarea id="luRosterPaste" rows="5" placeholder="Paste the roster page, or: 7 Ava Martin"></textarea>
            <button class="lu-add" onclick="lineupImportRoster()">Import</button>
            <span id="luImportNote" class="lu-none"></span>
        </details>
    </div>`;
}

/* ---- the view ---- */

function renderLineup(container) {
    if (!container) return;
    loadLineup();
    stopLineupTicker();

    /* A phone locks, a tab gets reopened, the app reloads mid-game. Landing
       on the planning lane while a clock is running hides the one screen the
       coach needs, so an unfinished game opens itself. */
    if (!lineupModeChosen && LU.live && LU.live.status !== 'done') lineupMode = 'live';

    const hasRoster = LU.roster.length > 0;
    const live = LU.live;
    const modeStrip = `<div class="phase-bar lu-modes">
        <button class="phase-btn ${lineupMode === 'plan' ? 'active' : ''}" onclick="switchLineupMode('plan')">Plan</button>
        <button class="phase-btn ${lineupMode === 'live' ? 'active' : ''} ${live ? '' : 'lu-off'}" onclick="switchLineupMode('live')">${live ? 'Live' : 'Live (not started)'}</button>
        <button class="phase-btn ${lineupMode === 'season' ? 'active' : ''}" onclick="switchLineupMode('season')">Playing time</button>
    </div>`;

    let right = '';
    if (lineupMode === 'season') {
        right = lineupSeason();
    } else if (lineupMode === 'live' && live) {
        right = lineupDueBanner() + lineupBench() + lineupMinutes() + lineupLog() +
            `<button class="lu-reset" onclick="resetLive()">Clear this game</button>`;
    } else if (lineupMode === 'live' && !live) {
        const ready = Object.keys(LU.starters).length;
        right = `<div class="lu-block lu-start">
            <div class="lu-block-head">Not kicked off yet</div>
            <p>${ready} of 11 positions filled. Start the clock and the plan below turns into prompts as each sub falls due.</p>
            <button class="lu-btn lu-btn-go" onclick="startLive()"${ready ? '' : ' disabled'}>Kick off</button>
        </div>` + lineupPlanPanel();
    } else {
        const empties = luSlots().filter(sl => !LU.starters[sl.id]).length;
        right = (empties && LU.roster.length
                ? `<button class="lu-fill" onclick="lineupFillEmpty()">Fill the ${empties} empty spot${empties === 1 ? '' : 's'} by position</button>`
                : '') +
            lineupBench() + lineupPlanPanel() +
            (live ? '' : `<button class="lu-reset lu-reset-go" onclick="startLive()">Kick off with this XI</button>`);
    }

    /* Two leagues, two squads, two rosters — say which one is loaded */
    const comps = lineupComps();
    const squadStrip = comps.length > 1 ? `<div class="lu-squads">
        <span class="lu-squads-label">Squad</span>
        ${comps.map(c => `<button class="lu-squad${c.id === activeSquad() ? ' active' : ''}"` +
            ` onclick="switchLineupSquad('${c.id}')" title="${luEsc(c.label || c.id)}">` +
            `${luEsc(c.shortLabel || c.id)}</button>`).join('')}
    </div>` : '';

    container.innerHTML = strategySubnav() +
        `<div class="content-area">
            <div class="section-title strategy-head">
                <span class="strategy-title-text">Lineup &amp; subs</span>
                <span class="lu-private">On this phone only</span>
            </div>
            ${squadStrip}
            ${modeStrip}
            ${lineupMode === 'live' && live ? lineupClockBar() : ''}
            ${hasRoster ? '' : `<div class="lu-empty-note">Add your players below, then tap a position on the pitch to put someone in it.</div>`}
            <div class="strategy-grid${lineupMode === 'season' ? ' lu-wide' : ''}">
                ${lineupMode === 'season' ? '' : `<div class="strategy-board">
                    ${lineupPitch()}
                    <div class="pitch-hint">${lineupMode === 'live' && live ? 'Tap a position to sub' : 'Tap a position to fill it'}</div>
                </div>`}
                <div class="strategy-notes">
                    ${lineupMode === 'season' ? '' : lineupPicker()}
                    ${right}
                    <button class="lu-roster-toggle" onclick="toggleRosterPanel()">${lineupShowRoster ? 'Hide roster' : 'Edit roster'}</button>
                    ${lineupShowRoster || !hasRoster ? lineupRosterPanel() : ''}
                </div>
            </div>
        </div>`;

    if (typeof keepActiveVisible === 'function') keepActiveVisible();
    if (live && live.status === 'running') startLineupTicker();
}

/* One interval, only while the clock runs, and only while this view is on
   screen. app.js calls stopLineupTicker() on every tab switch. */
function startLineupTicker() {
    stopLineupTicker();
    lineupTicker = setInterval(() => {
        if (!LU || !LU.live || LU.live.status !== 'running') { stopLineupTicker(); return; }
        catchUpClock();
        const t = document.querySelector('.lu-clock-time');
        if (!t) { stopLineupTicker(); return; }       // view is gone
        t.textContent = fmtClock(liveElapsedMs());
        // a sub falling due is the one thing that must interrupt the coach
        if (dueSubs().length && !document.querySelector('.lu-due')) {
            renderLineup(document.getElementById('main-content'));
        }
    }, 1000);
}

function stopLineupTicker() {
    if (lineupTicker) { clearInterval(lineupTicker); lineupTicker = null; }
}
