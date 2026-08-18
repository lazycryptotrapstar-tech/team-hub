/* ============================================================
   TEAM HUB — FAMILY APP
   Four pillars-era tabs: Story · Standings · Schedule · Tournament
============================================================ */

let currentTeamId = null, TEAM_CONFIG = null;
let currentTab = 'schedule';
let standingsView = 'table';   // table | stats
let tournView = 'bracket';     // bracket | map
let tournMapDay = 'All';

/* ============================================================
   THEME + NAV
============================================================ */
/* The team's own colour becomes the accent the whole page is lit by:
   fills, glows, tint washes and the ambient background all derive from it. */
function applyTheme() {
    const b = TEAM_CONFIG.branding;
    const accent = b.secondaryColor || '#F5C842';
    const rgb = hexToRgb(accent);
    // Set the team's colour, not --accent itself: the stylesheet maps
    // --accent onto this, which lets print swap in an ink-safe accent.
    const root = document.documentElement.style;
    root.setProperty('--team-accent', accent);
    root.setProperty('--team-accent-soft', `rgba(${rgb},.08)`);
    root.setProperty('--team-accent-line', `rgba(${rgb},.38)`);
    root.setProperty('--primary', b.primaryColor || '#00234b');
    document.title = b.name + ' – Team Hub';
}

function hexToRgb(hex) {
    const h = String(hex).replace('#', '').trim();
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16);
    if (isNaN(n) || full.length !== 6) return '245,200,66';
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
}

/* ============================================================
   IDENTITY
   No logo files: the product mark and each team's crest are drawn
   from the team's own name and colour, so any team that joins gets
   an identity without anyone designing one.
============================================================ */

/* What goes on the crest. An age/gender code ("13G", "U12") is what
   actually tells two sibling teams apart, so it wins over initials —
   otherwise "Sting McNeal 13G" and "Sting McNeal 14G" both read "SM". */
function teamInitials(name) {
    const raw = String(name || '');
    const code = raw.match(/\b(?:U-?)?(\d{1,2})\s?([GB])\b/i) || raw.match(/\bU-?(\d{1,2})\b/i);
    if (code) return (code[1] + (code[2] || '')).toUpperCase();
    const words = raw.split(/[\s·\-—]+/)
        .filter(w => w && !/^\d/.test(w) && !/^(fc|sc|cf|the|of)$/i.test(w));
    const letters = words.map(w => w[0]).filter(c => /[a-z]/i.test(c));
    return (letters.slice(0, 2).join('') || 'TH').toUpperCase();
}

/* The product mark: three ascending bars — standings, form, a season
   climbing. Geometric, sport-agnostic, and it takes the team's colour. */
function productMark(size) {
    const s = size || 30;
    return `<svg class="mark" width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--accent)" opacity=".14"/>
        <rect x="7"  y="17" width="4.5" height="8"  rx="2" fill="var(--accent)" opacity=".55"/>
        <rect x="13.75" y="12" width="4.5" height="13" rx="2" fill="var(--accent)" opacity=".8"/>
        <rect x="20.5" y="6"  width="4.5" height="19" rx="2" fill="var(--accent)"/>
    </svg>`;
}

/* A team's crest: its initials set in the display face on an accent tile */
function teamCrest(team, size) {
    const s = size || 46;
    const initials = teamInitials(team.branding.name);
    const fs = initials.length > 2 ? 12 : 15;
    return `<svg class="crest" width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="11" fill="var(--crest-ink,var(--accent))" opacity=".16"/>
        <rect x=".75" y=".75" width="38.5" height="38.5" rx="10.5" fill="none" stroke="var(--crest-ink,var(--accent))" stroke-opacity=".45"/>
        <text x="20" y="20" text-anchor="middle" dominant-baseline="central"
              font-family="'Space Grotesk',sans-serif" font-size="${fs}" font-weight="700"
              letter-spacing="-.5" fill="var(--crest-ink,var(--accent))">${initials}</text>
    </svg>`;
}

/* Last five results as pips — replaces the row of stars with something
   that actually says how the season is going. */
function formPips(matches) {
    const last5 = matches.slice(-5);
    if (!last5.length) return '';
    return '<div class="form-pips">' + last5.map(m =>
        `<span class="form-pip pip-${m.res}" title="${m.date} vs ${m.opp}: ${m.score}"></span>`
    ).join('') + '<span class="form-pips-label">Last 5</span></div>';
}

function renderSiteBrand() {
    const el = document.getElementById('siteBrand');
    if (!el) return;
    el.innerHTML = productMark(30) +
        '<span class="site-wordmark">Team <span>Hub</span></span>';
}

/* Favicon follows the team, so a bookmarked hub is recognisable in a tab */
function applyFavicon() {
    const accent = TEAM_CONFIG.branding.secondaryColor || '#F5C842';
    const initials = teamInitials(TEAM_CONFIG.branding.name);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
        `<rect width="32" height="32" rx="8" fill="#0A0F14"/>` +
        `<text x="16" y="17" text-anchor="middle" dominant-baseline="central" ` +
        `font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="${accent}">${initials}</text></svg>`;
    const href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    document.querySelectorAll('link[rel~="icon"]').forEach(l => l.setAttribute('href', href));
}

const TAB_ICONS = {
    schedule:   '<path d="M3 9h18M7 3v3m10-3v3M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
    standings:  '<path d="M5 20v-8m7 8V4m7 16v-5"/>',
    story:      '<path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2zm9-2h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5z"/>',
    tournament: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3M12 14v4m-3 3h6"/>',
};

/* Line icons drawn inline — no icon library, no build step */
function tabIcon(id) {
    return '<svg class="bnav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        (TAB_ICONS[id] || '') + '</svg>';
}

function getTabs() {
    return [
        { id: 'schedule',   label: 'Schedule' },
        { id: 'standings',  label: 'Standings' },
        { id: 'story',      label: 'Story' },
        { id: 'tournament', label: 'Tournament' },
    ];
}

/* One band that says who this is and how the season is going. It used to
   be split across a status strip and a header on every tab, which meant
   the name, record and next game were each on screen three times. */
function renderTeamBar() {
    const el = document.getElementById('teamBar');
    if (!el) return;
    const b = TEAM_CONFIG.branding, l = TEAM_CONFIG.league, r = TEAM_CONFIG.record;
    const streak = getStreak(TEAM_CONFIG.matches);
    const streakLabel = streak.count >= 2
        ? streak.count + '-game ' + (streak.type === 'W' ? 'win streak' : streak.type === 'L' ? 'losing run' : 'unbeaten')
        : null;

    el.innerHTML =
        `<div class="tb-identity">
            ${teamCrest(TEAM_CONFIG, 44)}
            <div class="tb-id-text">
                <h1 class="tb-name">${b.name}</h1>
                <div class="tb-sub">${b.league} <span>·</span> ${b.season}</div>
            </div>
        </div>
        <div class="tb-stats">
            <div class="tb-stat">
                <span class="tb-k">Record</span>
                <span class="tb-v">${r.wins}<i>–</i>${r.losses}<i>–</i>${r.draws}</span>
            </div>
            ${l.rank ? `<div class="tb-stat">
                <span class="tb-k">Position</span>
                <span class="tb-v">#${l.rank}<em>of ${l.totalTeams}</em></span>
            </div>` : ''}
            <div class="tb-stat">
                <span class="tb-k">Points</span>
                <span class="tb-v">${l.points}</span>
            </div>
            <div class="tb-stat tb-form">
                <span class="tb-k">Form${streakLabel ? ' · ' + streakLabel : ''}</span>
                ${formPips(TEAM_CONFIG.matches)}
            </div>
        </div>`;
}

function renderPageFooter() {
    const el = document.getElementById('pageFooter');
    if (!el) return;
    const b = TEAM_CONFIG.branding;
    el.innerHTML =
        `<span class="pf-motto">${b.motto}</span>` +
        `<span class="pf-dot">·</span>` +
        `<a class="pf-site" href="https://${b.website}" target="_blank" rel="noopener">${b.website}</a>` +
        `<span class="pf-updated">Updated ${TEAM_CONFIG.lastUpdate}</span>`;
}

/* Past a handful of teams a row of pills stops being a switcher and starts
   being a wall, so a club running twenty teams gets a picker instead. */
const PILL_LIMIT = 6;

function renderTeamSwitcher() {
    const c = document.getElementById('team-switcher');
    const ids = Object.keys(TEAMS);
    if (ids.length < 2) { c.innerHTML = ''; return; }

    if (ids.length <= PILL_LIMIT) {
        c.className = 'no-print switcher-pills';
        c.innerHTML = ids.map(id =>
            `<button onclick="switchTeam('${id}')" class="team-switcher-btn ${id === currentTeamId ? 'active' : ''}"` +
            ` aria-pressed="${id === currentTeamId}">` +
            teamCrest(TEAMS[id], 22) + TEAMS[id].branding.name + '</button>'
        ).join('');
        return;
    }

    // Grouped by league so a big club's list stays navigable
    const groups = {};
    ids.forEach(id => {
        const key = TEAMS[id].branding.league || 'Other';
        (groups[key] = groups[key] || []).push(id);
    });
    c.className = 'no-print switcher-select';
    c.innerHTML =
        teamCrest(TEAMS[currentTeamId], 26) +
        `<select onchange="switchTeam(this.value)" aria-label="Choose a team">` +
        Object.keys(groups).sort().map(league =>
            `<optgroup label="${league}">` +
            groups[league].map(id =>
                `<option value="${id}"${id === currentTeamId ? ' selected' : ''}>${TEAMS[id].branding.name}</option>`
            ).join('') + '</optgroup>'
        ).join('') +
        '</select>' +
        `<span class="switcher-count">${ids.length} teams</span>`;
}

function renderNavBars() {
    const tabs = getTabs();
    document.getElementById('desktopTabNav').innerHTML = tabs.map(t =>
        `<button onclick="switchTab('${t.id}')" id="tab_${t.id}" class="tab-btn ${currentTab === t.id ? 'tab-active' : ''}">${t.label}</button>`
    ).join('');
    document.getElementById('bottomNavInner').innerHTML = tabs.map(t =>
        `<button onclick="switchTab('${t.id}')" id="bnav_${t.id}" class="bnav-btn ${currentTab === t.id ? 'active' : ''}">${tabIcon(t.id)}${t.label}</button>`
    ).join('');
}

function switchTeam(id) {
    tournView = 'bracket'; tournMapDay = 'All';
    currentTeamId = id; TEAM_CONFIG = TEAMS[id];
    applyTheme(); applyFavicon(); renderSiteBrand();
    renderTeamSwitcher(); renderTeamBar(); renderPageFooter(); renderNavBars(); render();
}

function switchTab(tab) {
    currentTab = tab;
    const card = document.getElementById('main-content');
    card.classList.add('switching');
    setTimeout(() => { render(); card.classList.remove('switching'); }, 120);
}



/* ============================================================
   STANDINGS TAB  (League Table / Team Stats)
============================================================ */
function switchStandingsView(v) {
    standingsView = v;
    renderStandingsTab(document.getElementById('main-content'));
}

function standingsSubnav() {
    return `<div class="stats-subnav">
        <button class="stats-subnav-btn ${standingsView==='table'?'active':''}" onclick="switchStandingsView('table')">League Table</button>
        <button class="stats-subnav-btn ${standingsView==='stats'?'active':''}" onclick="switchStandingsView('stats')">Team Stats</button>
    </div>`;
}

function renderStandingsTab(container) {
    if (standingsView === 'stats') { renderStatsReport(container); return; }
    renderLeagueTable(container);
}

function renderLeagueTable(container) {
    const drawsOn = TEAM_CONFIG.pointsConfig.drawsAllowed !== false;
    const rows = TEAM_CONFIG.standings.map(t => {
        const gdNum = parseInt(t.gd, 10);
        const gdClass = gdNum > 0 ? 'gd-pos' : (gdNum < 0 ? 'gd-neg' : '');
        return `<tr class="${t.isOurs ? 'current-team' : ''}">
            <td class="st-rank">${t.rank}</td>
            <td class="st-name${t.isOurs ? ' st-name-us' : ''}">${t.name}</td>
            <td class="st-num">${t.mp}</td>
            <td class="st-num st-w">${t.w}</td>
            ${drawsOn ? `<td class="st-num st-d">${t.d}</td>` : ''}
            <td class="st-num st-l">${t.l}</td>
            <td class="st-num">${t.gf}</td>
            <td class="st-num">${t.ga}</td>
            <td class="st-num ${gdClass}">${t.gd}</td>
            <td class="st-pts">${t.pts}</td>
        </tr>`;
    }).join('');

    const emptyMsg = '<div style="text-align:center;padding:48px 24px;color:var(--text3);font-size:14px;">No standings imported yet.</div>';

    container.innerHTML = `${standingsSubnav()}
    <div class="content-area">
        <div class="st-card">
            ${TEAM_CONFIG.standings.length === 0 ? emptyMsg : `<div class="st-scroll">
                <table class="st-table">
                    <thead><tr>
                        <th class="st-th-rank">#</th>
                        <th class="st-th-name">Club</th>
                        <th title="Matches Played">MP</th>
                        <th title="Wins">W</th>
                        ${drawsOn ? '<th title="Draws">D</th>' : ''}
                        <th title="Losses">L</th>
                        <th title="Goals For">GF</th>
                        <th title="Goals Against">GA</th>
                        <th title="Goal Difference">GD</th>
                        <th title="Points">Pts</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`}
        </div>
    </div>`;
}

function renderStatsReport(container) {
    const g = TEAM_CONFIG.goals;
    const totalGoals = g.for + g.against;
    const gfP = totalGoals ? ((g.for / totalGoals) * 100).toFixed(1) : 0;
    const gaP = totalGoals ? ((g.against / totalGoals) * 100).toFixed(1) : 0;
    const r = TEAM_CONFIG.record, l = TEAM_CONFIG.league, nm = TEAM_CONFIG.nextMatch;
    const terms = TEAM_CONFIG.branding.terms || {};
    const matchRows = TEAM_CONFIG.matches.map(m =>
        `<tr class="${m.highlight ? 'highlight-row' : ''}">
            <td class="date-cell">${m.date}</td>
            <td>${m.rank ? `<span class="opp-rank">#${m.rank}</span>` : ''}${m.opp}</td>
            <td class="score-cell center">${m.score}</td>
            <td class="center"><span class="res-badge res-${m.res}">${m.res}</span></td>
        </tr>`
    ).join('');


    container.innerHTML = `${standingsSubnav()}
    <div class="content-area stats-grid" style="display:grid;grid-template-columns:1fr 2fr;gap:28px;">
        <div style="display:flex;flex-direction:column;gap:20px;">
            <div>
                <div class="section-title">Season Record <span>${r.wins}-${r.losses}-${r.draws}</span></div>
                <div class="record-grid">
                    <div class="record-card wins"><div class="record-label wins">Wins</div><div class="record-num wins">${r.wins}</div></div>
                    <div class="record-card losses"><div class="record-label losses">Losses</div><div class="record-num losses">${r.losses}</div></div>
                    <div class="record-card draws"><div class="record-label draws">Draws</div><div class="record-num draws">${r.draws}</div></div>
                </div>
            </div>
            <div>
                <div class="section-title">League Status</div>
                <div class="rank-strip">
                    <div><div class="rank-label">League Rank</div><div class="rank-num">${l.rank || '—'} <span class="rank-sub">of ${l.totalTeams}</span></div></div>
                    <div style="text-align:right;"><div class="rank-label">Points</div><div class="rank-num">${l.points}</div></div>
                </div>
                <div class="stat-item"><span class="stat-label">PPG</span><span class="stat-val gold">${l.ppg}</span></div>
                <div class="stat-item"><span class="stat-label">Goal Diff</span><span class="stat-val gold">${l.goalDiff}</span></div>
            </div>
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;">
                <div class="section-title" style="margin-bottom:16px;">Scoring</div>
                <div class="progress-wrap">
                    <div class="progress-header"><span>${terms.goalsFor || 'Goals'} For</span><strong style="color:var(--green);font-size:14px;">${g.for}</strong></div>
                    <div class="progress-track"><div class="progress-fill" style="width:${gfP}%;background:#16a34a;"></div></div>
                </div>
                <div class="progress-wrap" style="margin-top:12px;">
                    <div class="progress-header"><span>${terms.goalsFor || 'Goals'} Against</span><strong style="color:var(--blue);font-size:14px;">${g.against}</strong></div>
                    <div class="progress-track"><div class="progress-fill" style="width:${gaP}%;background:#3b82f6;"></div></div>
                </div>
            </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:20px;">
            <div>
                <div class="section-title">${terms.match || 'Match'} History</div>
                <div class="match-table-wrap"><table class="match-table"><thead><tr><th>Date</th><th>Opponent</th><th class="center">Score</th><th class="center">Res</th></tr></thead><tbody>${matchRows}</tbody></table></div>
            </div>
            ${nextCard}
        </div>
    </div>`;
}

/* ============================================================
   STORY TAB  (AI storylines)
============================================================ */
function renderStory(container) {
    const l = TEAM_CONFIG.league;
    const avail = TEAM_CONFIG.remainingSchedule.length * TEAM_CONFIG.pointsConfig.win;
    const maxPts = l.points + avail;
    const momentum = computeMomentum(TEAM_CONFIG.matches);
    const played = TEAM_CONFIG.matches.length;
    const gpg  = played ? (TEAM_CONFIG.goals.for  / played).toFixed(2) : '0.00';
    const gapg = played ? (TEAM_CONFIG.goals.against / played).toFixed(2) : '0.00';
    const completedDots = TEAM_CONFIG.matches.map(m =>
        `<div class="tl-dot ${m.res}" title="${m.date} vs ${m.opp}: ${m.score}"></div>`
    ).join('');
    const futureDots = TEAM_CONFIG.remainingSchedule.map(m =>
        `<div class="tl-dot future" title="${m.date} vs ${m.opp}"></div>`
    ).join('');
    const narrative = getStoryText(TEAM_CONFIG);
    const byline = storyIsPublished(TEAM_CONFIG) && TEAM_CONFIG.story.source === 'ai'
        ? '<div class="story-byline">✦ Written by AI from this season\'s results</div>'
        : '';

    container.innerHTML = `<div class="content-area">
        <div class="story-grid">
            <div class="story-left-col">
                <div class="story-section-title">Season Timeline</div>
                <div class="story-timeline">${completedDots}${futureDots}</div>
                <div class="tl-legend">
                    <span><span class="tl-dot-pip" style="background:#16a34a;"></span>Win</span>
                    <span><span class="tl-dot-pip" style="background:#dc2626;"></span>Loss</span>
                    <span><span class="tl-dot-pip" style="background:#ca8a04;"></span>Draw</span>
                    <span><span class="tl-dot-pip" style="border:1.5px dashed var(--border2);"></span>Upcoming</span>
                </div>
                <div class="momentum-wrap">
                    <div class="momentum-header">
                        <span class="momentum-title">Momentum · Last 5</span>
                        <span class="momentum-label-val" style="color:${momentum.color};">${momentum.label}</span>
                    </div>
                    <div class="momentum-track">
                        <div class="momentum-fill" id="momentumFill" style="width:0%;background:${momentum.color};"></div>
                    </div>
                    <div class="momentum-sublabel">${momentum.sublabel} &nbsp;·&nbsp; ${momentum.score} / ${momentum.max} pts from last 5</div>
                </div>
                <div class="story-section-title">The Story So Far</div>
                <p class="story-narrative" id="storyNarrativeText">${narrative.replace(/\n\n/g, '</p><p class="story-narrative" style="margin-top:12px;">')}</p>
                ${byline}
            </div>
            <div class="story-right-col">
                <div class="story-section-title">By The Numbers</div>
                <div class="story-stat-cards">
                    <div class="story-stat-card">
                        <div class="story-stat-card-val">${played}</div>
                        <div class="story-stat-card-lbl">Played</div>
                    </div>
                    <div class="story-stat-card gold">
                        <div class="story-stat-card-val">${gpg}</div>
                        <div class="story-stat-card-lbl">GF / Game</div>
                    </div>
                    <div class="story-stat-card">
                        <div class="story-stat-card-val">${gapg}</div>
                        <div class="story-stat-card-lbl">GA / Game</div>
                    </div>
                    <div class="story-stat-card gold">
                        <div class="story-stat-card-val">${l.ppg}</div>
                        <div class="story-stat-card-lbl">PPG</div>
                    </div>
                </div>
                <div class="story-section-title" style="margin-top:20px;">Path Forward</div>
                <div class="story-path-card pts-card">
                    <div class="story-path-label">Current Points</div>
                    <div class="story-path-val">${l.points}</div>
                </div>
                <div class="story-path-card avail-card">
                    <div>
                        <div class="story-path-label" style="color:var(--amber);">Points Available</div>
                        <div class="story-path-sub">${TEAM_CONFIG.remainingSchedule.length} game${TEAM_CONFIG.remainingSchedule.length!==1?'s':''} remaining</div>
                    </div>
                    <div class="story-path-val" style="color:var(--amber);">+${avail}</div>
                </div>
                <div class="story-path-card max-card">
                    <div>
                        <div class="story-path-label" style="color:var(--green);">Max Potential</div>
                        <div class="story-path-sub" style="color:var(--green);">Win all remaining</div>
                    </div>
                    <div class="story-path-val" style="color:var(--green);">${maxPts}</div>
                </div>
            </div>
        </div>
    </div>`;
    setTimeout(() => { const f = document.getElementById('momentumFill'); if (f) f.style.width = momentum.pct + '%'; }, 200);
}

/* ============================================================
   SCHEDULE TAB  (games + venue map)
============================================================ */
/* Schedule reads top to bottom the way the question gets asked:
   where do I need to be next, then what else is coming, then how it
   has gone. The next game and its map are one block, not two that
   repeat each other. */
function renderSchedule(container) {
    const schedule = TEAM_CONFIG.remainingSchedule;
    const next = schedule[0];
    const later = schedule.slice(1);
    const results = TEAM_CONFIG.matches.slice().reverse();

    const mapGames = schedule.map(m => {
        const g = m.game || {};
        return { venueId: g.venueId, fieldId: g.fieldId, locText: m.loc,
                 date: m.date, time: m.time, opp: m.opp, rank: m.rank, isOurs: true };
    });
    const venue = detectVenue(mapGames);

    /* --- next game: the one thing most people opened this for --- */
    let nextBlock;
    if (!next) {
        nextBlock = '<div class="empty-state"><strong>Season complete.</strong>' +
            '<span>No more games on the schedule.</span></div>';
    } else {
        const parts = next.date.split(' ');
        const mapHTML = venue
            ? buildVenueSection(venue, mapGames, { title: null, showPanel: false })
            : buildUnknownVenueCard([next.loc]);
        nextBlock =
            '<div class="next-up">' +
                '<div class="next-up-head">' +
                    '<span class="next-up-flag">Next up</span>' +
                    '<span class="next-up-when">' + parts[0] + ' ' + parts.slice(1).join(' ') +
                        ' <i>·</i> ' + next.time + '</span>' +
                '</div>' +
                '<div class="next-up-opp">' +
                    (next.rank ? '<span class="next-up-rank">#' + next.rank + '</span>' : '') +
                    next.opp +
                '</div>' +
                (next.loc ? '<div class="next-up-where">' + next.loc + '</div>' : '') +
                mapHTML +
            '</div>';
    }

    /* --- the rest of the fixtures, compact --- */
    const laterBlock = later.length ? sectionTitle('Also coming up', later.length) +
        '<div class="fixture-list">' + later.map(m => {
            const parts = m.date.split(' ');
            return '<div class="fixture">' +
                '<span class="fx-date">' + parts[0] + ' ' + parts.slice(1).join(' ') + '</span>' +
                '<span class="fx-opp">' + (m.rank ? '<i>#' + m.rank + '</i> ' : '') + m.opp + '</span>' +
                '<span class="fx-meta">' + m.time + (m.loc ? ' · ' + m.loc : '') + '</span>' +
            '</div>';
        }).join('') + '</div>' : '';

    /* --- results, newest first: gives the tab substance late in a season --- */
    const resultsBlock = results.length ? sectionTitle('Results', results.length) +
        '<div class="fixture-list">' + results.map(m =>
            '<div class="fixture' + (m.highlight ? ' fx-featured' : '') + '">' +
                '<span class="fx-date">' + m.date + '</span>' +
                '<span class="fx-opp">' + (m.rank ? '<i>#' + m.rank + '</i> ' : '') + m.opp + '</span>' +
                '<span class="fx-score">' + m.score + '</span>' +
                '<span class="res-badge res-' + m.res + '">' + m.res + '</span>' +
            '</div>'
        ).join('') + '</div>' : '';

    container.innerHTML = '<div class="content-area">' + nextBlock + laterBlock + resultsBlock + '</div>';
}

function sectionTitle(label, count) {
    return '<div class="section-title">' + label +
        (count != null ? '<span>' + count + '</span>' : '') + '</div>';
}

/* ============================================================
   TOURNAMENT TAB  (bracket + venue map)
============================================================ */
function renderTournament(container) {
    const td = TEAM_CONFIG.tournaments;
    if (!td) { container.innerHTML = '<div class="content-area"><div class="empty-state">No tournament running right now.</div></div>'; return; }
    if (tournView==='map') { renderTournMap(container, td); return; }
    renderTournBracket(container, td);
}

function tournSubnav() {
    return `<div class="stats-subnav">
        <button class="stats-subnav-btn ${tournView==='bracket'||tournView===''?'active':''}" onclick="switchTournView('bracket')">Bracket</button>
        <button class="stats-subnav-btn ${tournView==='map'?'active':''}" onclick="switchTournView('map')">Venue Map</button>
    </div>`;
}

function switchTournView(v) { tournView = v; renderTournament(document.getElementById('main-content')); }

function renderTournBracket(container, td) {
    const hist = td.history || [];
    let tW=0, tL=0, tD=0;
    hist.forEach(t => { const p=(t.record||'').split('-'); tW+=parseInt(p[0])||0; tL+=parseInt(p[1])||0; tD+=parseInt(p[2])||0; });

    const histSummary = hist.length > 0
        ? `<span class="tourn-hist-summary">${hist.length} played &nbsp;&middot;&nbsp; ${tW}W ${tL}L ${tD}D</span>`
        : '';

    const histHTML = hist.length === 0
        ? '<div style="font-size:13px;color:var(--text3);padding:16px;text-align:center;">No tournament history recorded yet.</div>'
        : hist.map(t => {
            const bc = (t.result.includes('Champion')||t.result.includes('🏆')) ? 'champ' : (t.result.includes('Runner')||t.result.includes('🥈')) ? 'runner' : 'other';
            return `<div class="tourn-hist-row">
                <div class="tourn-hist-left">
                    <div class="tourn-hist-name">${t.name}</div>
                    <div class="tourn-hist-meta">${t.date}${t.notes?' · '+t.notes:''}</div>
                </div>
                <div class="tourn-hist-right">
                    <span class="tourn-badge ${bc}">${t.result}</span>
                    <span class="tourn-hist-rec">${t.record}</span>
                </div>
            </div>`;
        }).join('');

    let currentHTML = '';
    const ct = td.current;
    if (ct) {
        const grp = ct.group;
        const groupCards = (grp.matches||[]).map(m => {
            const isOurs = m.home === grp.ourTeam || m.away === grp.ourTeam;
            const sc = m.score ? `<span class="tc-score">${m.score}</span>` : '';
            return `<div class="tc-card${isOurs ? ' tc-card-ours' : ''}">
                <div class="tc-card-top">
                    <div class="tc-date-block">
                        <div class="tc-day">${m.date.split(' ')[0]}</div>
                        <div class="tc-dt">${m.date.split(' ').slice(1).join(' ')}</div>
                    </div>
                    <div class="tc-time-field">
                        <div class="tc-time">&#128336; ${m.time}</div>
                        <div class="tc-field">&#128205; ${m.field}</div>
                    </div>
                    ${sc}
                </div>
                <div class="tc-matchup">
                    <span class="tc-team${m.home===grp.ourTeam?' tc-us':''}">${m.home}</span>
                    <span class="tc-vs">vs</span>
                    <span class="tc-team${m.away===grp.ourTeam?' tc-us':''}">${m.away}</span>
                </div>
            </div>`;
        }).join('');

        const br = ct.bracket;
        const bracketHTML = br ? `
            <div class="tc-knockout">
                <div class="tc-ko-col">
                    <div class="tc-ko-label">Semifinals &amp; Consolation</div>
                    ${br.semis.map(s => `
                    <div class="tc-ko-card${s.slot==='Consolation'?' tc-consolation':''}">
                        <div class="tc-ko-top">
                            <span class="tc-ko-slot">${s.slot}</span>
                            <span class="tc-ko-time">${s.time}</span>
                        </div>
                        ${s.field ? `<div class="tc-ko-field">&#128205; ${s.field}</div>` : ''}
                        <div class="tc-ko-matchup">
                            <div class="tc-ko-team">${s.teamA}</div>
                            <div class="tc-vs" style="margin:4px 0;font-size:9px;">vs</div>
                            <div class="tc-ko-team">${s.teamB}</div>
                        </div>
                        ${s.score ? `<div class="tc-ko-result">${s.score}</div>` : ''}
                    </div>`).join('')}
                </div>
                <div class="tc-ko-connector">
                    <svg viewBox="0 0 50 140" preserveAspectRatio="none">
                        <path d="M0,35 H25 V105 H0" fill="none" stroke="rgba(255,204,0,0.35)" stroke-width="2"/>
                        <path d="M25,70 H50" fill="none" stroke="rgba(255,204,0,0.35)" stroke-width="2"/>
                    </svg>
                </div>
                <div class="tc-ko-col">
                    <div class="tc-ko-label">Final</div>
                    <div class="tc-ko-card tc-final">
                        <div class="tc-ko-top">
                            <span class="tc-ko-slot">&#127942; Final</span>
                            <span class="tc-ko-time">${br.final.time}</span>
                        </div>
                        ${br.final.field ? `<div class="tc-ko-field">&#128205; ${br.final.field}</div>` : ''}
                        <div class="tc-ko-matchup">
                            <div class="tc-ko-team">${br.final.teamA}</div>
                            <div class="tc-vs" style="margin:4px 0;font-size:9px;">vs</div>
                            <div class="tc-ko-team">${br.final.teamB}</div>
                        </div>
                        ${br.final.score ? `<div class="tc-ko-result">${br.final.score}</div>` : ''}
                    </div>
                </div>
            </div>` : '';

        currentHTML = `
            <div class="tourn-section">
                <div class="tourn-section-header">
                    <div>
                        <div class="tourn-section-title">${ct.name}</div>
                        <div class="tourn-section-meta">${ct.dates} &nbsp;·&nbsp; ${ct.location}</div>
                    </div>
                    <span class="tourn-format-badge">${ct.format}</span>
                </div>
                <div class="tourn-sub-label">&#128205; ${grp.name} — Group Stage</div>
                <div class="tc-group">${groupCards}</div>
                <div class="tourn-sub-label" style="margin-top:24px;">&#127942; Knockout Bracket</div>
                ${bracketHTML}
            </div>`;
    }

    container.innerHTML = tournSubnav() +
        '<div class="content-area">' +
        currentHTML +
        '<div class="tourn-hist-title-row">' +
            '<div class="tourn-sub-label" style="margin-top:24px;margin-bottom:0;">Tournament history</div>' +
            histSummary +
        '</div>' +
        '<div class="tourn-hist-list" style="margin-top:12px;">' + histHTML + '</div>' +
        '</div>';
}

/* Flatten a tournament into one game list the venue engine understands */
function tournamentGames(ct) {
    const games = [];
    if (!ct) return games;
    const ourTeam = ct.group && ct.group.ourTeam;
    (ct.group && ct.group.matches || []).forEach(function(m) {
        const isOurs = m.home === ourTeam || m.away === ourTeam;
        games.push({
            day: m.date, isOurs: isOurs, field: m.field, locText: m.field,
            venueId: m.venueId, fieldId: m.fieldId,
            date: m.date, time: m.time, home: m.home, away: m.away, score: m.score,
            label: isOurs ? 'Our Match · Group Stage' : 'Group Stage'
        });
    });
    const brItems = [...((ct.bracket && ct.bracket.semis) || [])];
    if (ct.bracket && ct.bracket.final) brItems.push(ct.bracket.final);
    brItems.forEach(function(s) {
        const parts = (s.time || '').split(' · ');
        games.push({
            day: parts[0], isOurs: false, field: s.field, locText: s.field,
            venueId: s.venueId, fieldId: s.fieldId,
            date: parts[0], time: parts[1] || s.time,
            home: s.teamA, away: s.teamB, score: s.score, label: s.slot
        });
    });
    return games;
}

function renderTournMap(container, td) {
    const ct = td ? td.current : null;
    const allGames = tournamentGames(ct);

    // Day filter chips
    const seen = {}, days = ['All'];
    allGames.forEach(function(g) { if (g.day && !seen[g.day]) { seen[g.day] = 1; days.push(g.day); } });
    if (days.indexOf(tournMapDay) === -1) tournMapDay = 'All';
    const activeDay = tournMapDay;
    const filtered = activeDay === 'All' ? allGames : allGames.filter(function(g) { return g.day === activeDay; });
    const dayBar = days.length > 1
        ? '<div class="map-day-bar">' + days.map(function(d) {
            return '<button class="map-day-btn' + (d === activeDay ? ' active' : '') + '" onclick="setMapDay(\'' + d + '\')">' + d + '</button>';
          }).join('') + '</div>'
        : '';

    // venueType is a legacy hint; detection falls back to matching game locations
    const venue = detectVenue(allGames, td && td.venueType);
    const mapHTML = venue
        ? buildVenueSection(venue, filtered, {
            title: null, dayBar: dayBar,
            panelHint: 'Tap any field to see' + (activeDay === 'All' ? ' all' : ' ' + activeDay) + ' games'
          })
        : buildUnknownVenueCard(allGames.map(function(g) { return g.field; }));

    container.innerHTML = tournSubnav() +
        '<div class="content-area">' +
        (ct ? '<div class="tourn-map-header"><div class="tourn-section-title" style="color:var(--text);font-size:15px;">' + ct.name + '</div>' +
            '<div style="font-size:12px;color:var(--text3);margin-bottom:10px;">' + ct.location + '</div></div>' : '') +
        '<div class="map-day-callout"><span class="map-day-callout-label">&#9733; Gold fields = your games</span><span class="map-day-callout-sub">' +
            (days.length > 1 ? "Select a day to see only that day's fields" : 'All tournament fields shown') + '</span></div>' +
        mapHTML +
        '</div>';
}

function setMapDay(day){tournMapDay=day;renderTournament(document.getElementById('main-content'));}

/* ============================================================
   ROUTER + BOOT
============================================================ */
function render() {
    renderNavBars();
    const c = document.getElementById('main-content');
    if      (currentTab === 'story')       renderStory(c);
    else if (currentTab === 'standings')   renderStandingsTab(c);
    else if (currentTab === 'schedule')    renderSchedule(c);
    else if (currentTab === 'tournament')  renderTournament(c);
    else renderSchedule(c);
}

// Legacy keys from the pre-refocus app (RSVP, streaks, badges, acks)
function purgeLegacyStorage() {
    ['hub_rsvp', 'hub_checkin', 'hub_seen_badges'].forEach(k => localStorage.removeItem(k));
    Object.keys(localStorage).forEach(k => { if (k.indexOf('hub_ack_') === 0) localStorage.removeItem(k); });
}

function boot() {
    purgeLegacyStorage();
    Promise.all([loadHubData(), loadVenues()]).then(() => {
        const ids = Object.keys(TEAMS);
        if (!ids.length) throw new Error('No teams in data/teams.json');
        currentTeamId = ids[0];
        TEAM_CONFIG = TEAMS[currentTeamId];
        applyTheme();
        applyFavicon();
        renderSiteBrand();
        renderTeamSwitcher();
        renderTeamBar();
        renderPageFooter();
        render();
    }).catch(err => {
        document.getElementById('main-content').innerHTML =
            '<div style="padding:40px;text-align:center;color:var(--red);">' +
            '<strong>Could not load team data.</strong><br><span style="font-size:13px;color:var(--text3);">' +
            err.message + '</span><br><span style="font-size:12px;color:var(--text3);margin-top:8px;display:inline-block;">' +
            'If you opened this file directly, run a local server instead (npx serve).</span></div>';
        console.error(err);
    });
}

boot();
