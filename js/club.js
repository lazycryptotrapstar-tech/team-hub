/* ============================================================
   CLUB LAYER
   Team Hub is a club hub: one club, every one of its teams, and a
   parent who picks theirs once.

   Sting run nineteen teams across four age groups. That is past the
   point where a row of switcher pills is a switcher — it is a wall — so
   the front door is a directory you can search, and the app remembers
   what you chose.

   A team with no schedule yet still appears. Leaving it out would say
   the team does not exist; showing it and saying "no schedule published
   yet" says the true thing.
============================================================ */

let CLUB = null;
let route = 'club';                 // club | team
const CLUB_TEAM_KEY = 'th_team';

function clubEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Does this team have anything to show yet? The league sync fills games
   in; until it does, the team is real but empty. */
function teamHasData(t) {
    return !!(t && ((t.games && t.games.length) || (t.matches && t.matches.length)));
}

function teamAgeGroup(t) {
    return (t.branding && t.branding.ageGroup) || 'Other';
}

/* age groups oldest first — the way a club lists them */
function ageGroupsInOrder() {
    const groups = {};
    Object.entries(TEAMS).forEach(([id, t]) => {
        const g = teamAgeGroup(t);
        (groups[g] = groups[g] || []).push({ id, team: t });
    });
    return Object.keys(groups).sort().map(g => ({
        label: g,
        teams: groups[g].sort((a, b) => a.team.branding.name.localeCompare(b.team.branding.name)),
    }));
}

/* ---- remembering a team ---- */

function rememberedTeam() {
    try {
        const id = localStorage.getItem(CLUB_TEAM_KEY);
        return id && TEAMS[id] ? id : null;
    } catch (e) { return null; }
}

function openTeam(id) {
    if (!TEAMS[id]) return;
    try { localStorage.setItem(CLUB_TEAM_KEY, id); } catch (e) {}
    currentTeamId = id;
    TEAM_CONFIG = TEAMS[id];
    route = 'team';
    currentTab = 'schedule';
    applyTheme();
    applyFavicon();
    renderShell();
}

function openClub() {
    route = 'club';
    try { localStorage.removeItem(CLUB_TEAM_KEY); } catch (e) {}
    renderShell();
}

/* Back to the directory without forgetting the team — the difference
   between "show me the club" and "I am not this team any more". */
function browseClub() {
    route = 'club';
    renderShell();
}

/* ---- the directory ---- */

let clubFilter = '';

function clubCrest(size) {
    const s = size || 56;
    const initials = teamInitials(CLUB.name);
    return `<svg class="crest" width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="11" fill="var(--accent)" opacity=".16"/>
        <rect x=".75" y=".75" width="38.5" height="38.5" rx="10.5" fill="none" stroke="var(--accent)" stroke-opacity=".45"/>
        <text x="20" y="20" text-anchor="middle" dominant-baseline="central"
              font-family="'Barlow Condensed',sans-serif" font-size="17" font-weight="700"
              letter-spacing="-.5" fill="var(--accent)">${initials}</text>
    </svg>`;
}

function teamCardRow(id, t) {
    const has = teamHasData(t);
    const r = t.record;
    const next = t.nextMatch;
    return `<button class="club-team" onclick="openTeam('${clubEsc(id)}')" data-name="${clubEsc(t.branding.name.toLowerCase())}">
        <span class="ct-name">${clubEsc(t.branding.name)}</span>
        ${has
            ? `<span class="ct-meta">
                 <span class="ct-rec">${r.wins}<i>–</i>${r.losses}<i>–</i>${r.draws}</span>
                 ${next ? `<span class="ct-next">${clubEsc(next.date)}</span>` : '<span class="ct-next">no game listed</span>'}
               </span>`
            : `<span class="ct-meta ct-empty">no schedule published yet</span>`}
        <span class="ct-go" aria-hidden="true">›</span>
    </button>`;
}

function renderClub() {
    const groups = ageGroupsInOrder();
    const total = Object.keys(TEAMS).length;
    const withData = Object.values(TEAMS).filter(teamHasData).length;

    const body = groups.map(g => `
        <div class="club-group" data-group="${clubEsc(g.label)}">
            <h2 class="club-group-head">${clubEsc(g.label)}<span>${g.teams.length}</span></h2>
            <div class="club-team-list">${g.teams.map(x => teamCardRow(x.id, x.team)).join('')}</div>
        </div>`).join('');

    return `<div class="club-view">
        <div class="club-hero">
            ${clubCrest(56)}
            <div class="club-hero-text">
                <h1>${clubEsc(CLUB.name)}</h1>
                <div class="club-sub">${clubEsc(CLUB.season || '')}${CLUB.defaultLeague ? ' · ' + clubEsc(CLUB.defaultLeague) : ''}</div>
            </div>
        </div>
        <input class="club-search" id="clubSearch" type="search" autocomplete="off"
               placeholder="Find your team" aria-label="Find your team"
               value="${clubEsc(clubFilter)}" oninput="filterClub(this.value)">
        <div id="clubGroups">${body}</div>
        <div class="club-foot">
            ${total} teams${withData < total ? ` · ${withData} with a published schedule` : ''}
        </div>
    </div>`;
}

/* filter in place — rebuilding the list on every keystroke loses focus */
function filterClub(q) {
    clubFilter = q;
    const needle = q.trim().toLowerCase();
    document.querySelectorAll('#clubGroups .club-group').forEach(group => {
        let shown = 0;
        group.querySelectorAll('.club-team').forEach(el => {
            const hit = !needle || el.dataset.name.indexOf(needle) !== -1;
            el.hidden = !hit;
            if (hit) shown++;
        });
        group.hidden = shown === 0;
    });
}
