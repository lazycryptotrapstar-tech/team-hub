/* ============================================================
   STRATEGY TAB
   The 4-3-3 game model: formation board with phase views,
   a per-position guide ("what's MY job?"), and set-piece plays.
   Content ported from the v1 tactics board; teams can override
   with a `strategy` block in teams.json later.
============================================================ */

let strategyView = 'formation';    // formation | positions | setpieces
let strategyPhase = 'overview';    // overview | defense | midfield | attack
let strategyPosition = 9;          // shirt number selected in the position guide
let strategySetPiece = 'atk-corner';

const STRATEGY_433 = {
    formation: '4-3-3',

    /* [x, y] as % of the pitch, per phase. Attack runs up the screen. */
    players: [
        { id: 1,  type: 'gk',  pos: 'GK',  base: [50,92], defense: [50,85], midfield: [50,92], attack: [50,85] },
        { id: 2,  type: 'def', pos: 'RB',  base: [85,75], defense: [90,60], midfield: [85,60], attack: [90,30] },
        { id: 3,  type: 'def', pos: 'LB',  base: [15,75], defense: [10,60], midfield: [15,60], attack: [10,30] },
        { id: 4,  type: 'def', pos: 'RCB', base: [65,80], defense: [82,85], midfield: [65,75], attack: [75,55] },
        { id: 5,  type: 'def', pos: 'LCB', base: [35,80], defense: [18,85], midfield: [35,75], attack: [25,55] },
        { id: 6,  type: 'mid', pos: 'DM',  base: [50,65], defense: [50,75], midfield: [50,67], attack: [50,45] },
        { id: 8,  type: 'mid', pos: 'LCM', base: [30,50], defense: [35,55], midfield: [25,48], attack: [35,25] },
        { id: 10, type: 'mid', pos: 'RCM', base: [70,50], defense: [65,55], midfield: [75,48], attack: [65,25] },
        { id: 7,  type: 'att', pos: 'RW',  base: [85,30], defense: [85,40], midfield: [88,28], attack: [75,15] },
        { id: 11, type: 'att', pos: 'LW',  base: [15,30], defense: [15,40], midfield: [12,28], attack: [25,15] },
        { id: 9,  type: 'att', pos: 'ST',  base: [50,20], defense: [50,40], midfield: [50,20], attack: [50,10] },
    ],

    phases: [
        { id: 'overview', label: 'Full Team', title: '4-3-3 · Your Formation',
          highlight: 'all',
          items: [
            { role: 'GK·DEF', rc: 'def', t: 'Defend as a Unit',
              b: "Stay organized and connected. When we lose the ball, every player moves back together — defenders don't chase, they hold shape.",
              tip: 'Never leave a gap. Talk to each other constantly.' },
            { role: 'MID', rc: 'mid', t: 'You Control the Game',
              b: 'The midfield is the engine. Your job is to connect the defense to the attack — receive the ball, keep it moving, and never let the other team settle.',
              tip: 'Always be available. Show for the ball, then move again.' },
            { role: 'FWD', rc: 'att', t: 'Press and Finish',
              b: "Forwards lead the pressure when we don't have the ball, and run in behind when we do. Make defenders uncomfortable — don't just stand and wait.",
              tip: 'When you press, commit fully. Half-pressing is worse than no press.' },
          ] },
        { id: 'defense', label: 'Build-Out', title: 'Building Out from the Back',
          highlight: [1, 2, 3, 4, 5, 6],
          items: [
            { role: '#1·4·5', rc: 'def', t: 'GK + CBs: Spread Wide',
              b: 'When we have the ball at the back, the goalkeeper becomes a passing option and the two center backs split apart. This stretches the opposing forwards and creates space to pass through.',
              tip: '#1 — position yourself to receive. #4/#5 — spread to the edges, make it easy for the keeper.' },
            { role: '#2·3', rc: 'def', t: 'Fullbacks: Push Forward',
              b: 'Once the center backs have the ball, the fullbacks sprint up the sideline. This gives us width and makes the field feel wider for the opponent to defend.',
              tip: 'Time your run — push up when your CB has control, not before.' },
            { role: '#6', rc: 'mid', t: '#6: Be the Safety Net',
              b: 'When both fullbacks push up, the #6 drops back between the center backs. This protects against a quick counter-attack and keeps us from being caught short-handed.',
              tip: 'Read the play. If both #2 and #3 are high, you drop. Simple.' },
          ] },
        { id: 'midfield', label: 'Midfield', title: 'Midfield Movement',
          highlight: [6, 8, 10],
          items: [
            { role: '#6·8·10', rc: 'mid', t: 'Always Form a Triangle',
              b: 'The three midfielders should never stand in a straight line. One sits deep, one goes left, one goes right — this gives the ball carrier two passing options at all times and makes it almost impossible to defend.',
              tip: 'If two of you are side by side, one of you is in the wrong spot.' },
            { role: '#8·10', rc: 'mid', t: 'Get Between Their Lines',
              b: "The attacking midfielders (#8 and #10) should look for the gap between the opponent's defenders and midfielders. Receive the ball facing forward in that space — that's where you can turn and attack.",
              tip: "Face the opponent's goal when you receive. Don't take it with your back to play." },
            { role: '#6', rc: 'mid', t: '#6: Switch the Field',
              b: 'If the center of the field is blocked, the #6 receives and immediately switches the ball to the other side. This shifts the whole opponent team and creates space on the weak side.',
              tip: 'One or two touches max. Receive, look up, switch.' },
          ] },
        { id: 'attack', label: 'Attack', title: 'Attacking Together',
          highlight: [2, 3, 4, 5, 6, 7, 9, 11],
          items: [
            { role: '#7·9·11', rc: 'att', t: 'Press the Moment They Struggle',
              b: 'Watch for the trigger: a bad touch, a back pass to the keeper, a slow defender. The second you see it, all three forwards press at once — together. One person pressing alone never works.',
              tip: 'Make eye contact with each other. Press as a pack, not solo.' },
            { role: '#2·3', rc: 'def', t: 'Fullbacks Join the Attack',
              b: "When we have control in their half, the fullbacks push high along the sidelines. Now we have five players threatening their goal — that's too many for them to mark.",
              tip: "Hug the touchline. Don't cut inside — stay wide to create space for the wingers." },
            { role: '#4·5·6', rc: 'def', t: 'Hold the Line',
              b: 'With fullbacks forward, the center backs and #6 stay in a disciplined line near midfield. If we lose the ball, we need to be organized — not scrambling back from their end.',
              tip: 'Do NOT follow the attack forward. Your job is to protect the space behind.' },
          ] },
    ],

    /* Per-shirt guide: the same game model, answered from one player's
       point of view. This is what a kid (or parent) actually asks. */
    positions: {
        1:  { pos: 'GK',  name: 'Goalkeeper', summary: 'Last line, first attacker. You see the whole field — organize it.',
              jobs: { defense: 'When we build out, you are a passing option. Move to receive, keep your feet ready, and make the easy pass.',
                      midfield: 'Stay connected to your center backs. If the ball is in midfield, you sweep the space behind the defense.',
                      attack: 'Hold your line near the box. Read the danger before it happens and talk your defenders through it.' },
              key: 'Talk constantly. A loud keeper makes the whole defense better.' },
        2:  { pos: 'RB', name: 'Right Back', summary: 'Defender first, winger second — you cover the whole right side.',
              jobs: { defense: 'Once your CB has control, sprint up the sideline to give us width. Time it — go when we have the ball, not before.',
                      midfield: 'Stay wide and available. You are the safe outlet when the middle is crowded.',
                      attack: 'Push high, hug the touchline, and deliver early. If we lose it, sprint back — your first job never goes away.' },
              key: 'Time your runs. Up when we have it, back the second we lose it.' },
        3:  { pos: 'LB', name: 'Left Back', summary: 'Defender first, winger second — you cover the whole left side.',
              jobs: { defense: 'Once your CB has control, sprint up the sideline to give us width. Time it — go when we have the ball, not before.',
                      midfield: 'Stay wide and available. You are the safe outlet when the middle is crowded.',
                      attack: 'Push high, hug the touchline, and deliver early. If we lose it, sprint back — your first job never goes away.' },
              key: 'Time your runs. Up when we have it, back the second we lose it.' },
        4:  { pos: 'RCB', name: 'Right Center Back', summary: 'The anchor. Calm on the ball, ruthless off it.',
              jobs: { defense: 'Split wide when the keeper has it. Make the field big and give her an easy pass.',
                      midfield: 'Hold the middle with your partner. Step to win the ball only when you are sure — otherwise delay and steer.',
                      attack: 'Hold the line near midfield with #5 and #6. Do NOT follow the attack — you protect the space behind.' },
              key: "Don't chase — hold your shape and make the attacker's choice for them." },
        5:  { pos: 'LCB', name: 'Left Center Back', summary: 'The anchor. Calm on the ball, ruthless off it.',
              jobs: { defense: 'Split wide when the keeper has it. Make the field big and give her an easy pass.',
                      midfield: 'Hold the middle with your partner. Step to win the ball only when you are sure — otherwise delay and steer.',
                      attack: 'Hold the line near midfield with #4 and #6. Do NOT follow the attack — you protect the space behind.' },
              key: "Don't chase — hold your shape and make the attacker's choice for them." },
        6:  { pos: 'DM', name: 'Defensive Midfielder', summary: 'The safety net and the switch. Every attack flows through you.',
              jobs: { defense: 'If both fullbacks push up, you drop between the center backs. You are the insurance against the counter.',
                      midfield: 'Keep the triangle with #8 and #10. If the middle is blocked, receive and switch the field in one or two touches.',
                      attack: 'Stay just behind the attack with the CBs. Win the second ball and start the next wave.' },
              key: 'Read the play one pass early. Your position saves goals nobody sees.' },
        7:  { pos: 'RW', name: 'Right Winger', summary: 'Speed and width on the right. Stretch them until they snap.',
              jobs: { defense: 'Drop to help your fullback when their winger attacks. Never leave her 2-v-1.',
                      midfield: 'Stay wide and high — your width is what opens the middle for #8 and #10.',
                      attack: 'Press their left back the moment the trigger comes. With the ball: attack the defender, or arrive at the back post at full speed.' },
              key: 'Arrive late, arrive fast. Back-post goals are timing, not luck.' },
        8:  { pos: 'LCM', name: 'Center Midfielder', summary: 'The engine. You connect every line on the field.',
              jobs: { defense: 'Show for the ball to give the back line an exit. Then move again — a standing midfielder is a marked midfielder.',
                      midfield: 'Find the gap between their defenders and midfielders. Receive facing forward — that is where the game breaks open.',
                      attack: 'Push into the box late. The best chances fall to the midfielder nobody tracked.' },
              key: 'Face forward when you receive. Never take it with your back to play if you can help it.' },
        9:  { pos: 'ST', name: 'Striker', summary: 'First defender, last finisher. You set the tone for the press.',
              jobs: { defense: 'You are the first line of defense. Steer their build-up to one side so everyone knows where the ball is going.',
                      midfield: 'Stay on the last shoulder. Stretch their line so the midfield has room to play.',
                      attack: 'Watch the trigger — a bad touch, a back pass — and press as a pack with #7 and #11. With the ball: run in behind, finish early.' },
              key: 'Press together or not at all. One player pressing alone never works.' },
        10: { pos: 'RCM', name: 'Attacking Midfielder', summary: 'The creator. Find the pass nobody else sees.',
              jobs: { defense: 'Show for the ball to give the back line an exit. Keep the triangle alive.',
                      midfield: 'Live between their lines. Receive half-turned, play forward first — sideways is the backup plan.',
                      attack: 'Slide the final pass, or arrive at the edge of the box for the cutback. Shoot when they back off.' },
              key: 'Think one touch ahead. Know your next pass before the ball arrives.' },
        11: { pos: 'LW', name: 'Left Winger', summary: 'Speed and width on the left. Stretch them until they snap.',
              jobs: { defense: 'Drop to help your fullback when their winger attacks. Never leave her 2-v-1.',
                      midfield: 'Stay wide and high — your width is what opens the middle for #8 and #10.',
                      attack: 'Press their right back the moment the trigger comes. With the ball: attack the defender, or arrive at the back post at full speed.' },
              key: 'Arrive late, arrive fast. Back-post goals are timing, not luck.' },
    },
};

/* The pitch SVG uses a viewBox that matches the board's 3:4 aspect, so
   it scales uniformly. (preserveAspectRatio="none" hard-froze Chrome's
   compositor on the real board — never reintroduce it here.)
   Player/overlay x coordinates live in 0-100 "percent of pitch width"
   space and are mapped onto the 75-unit-wide viewBox with sx(). */
const PITCH_W = 75;
function sx(x) { return (x * PITCH_W / 100).toFixed(1); }

/* Phase overlays: movement arrows in pitch-percent coordinates.
   HARD RULE for every SVG on this board: no <marker> elements, no
   var(--*) paints, no preserveAspectRatio="none" — each of those froze
   Chrome's compositor on real hardware. Literal colors only. */
function teamAccent() {
    return (typeof TEAM_CONFIG !== 'undefined' && TEAM_CONFIG && TEAM_CONFIG.branding &&
            TEAM_CONFIG.branding.secondaryColor) || '#F5C842';
}
function ovColors() {
    return { a: teamAccent(), w: 'rgba(255,255,255,.75)' };
}

function ovHead(tip, dirFrom, color) {
    // small triangle pointing from dirFrom toward tip, in viewBox units
    const tx = tip[0] * PITCH_W / 100, ty = tip[1];
    const fx = dirFrom[0] * PITCH_W / 100, fy = dirFrom[1];
    let dx = tx - fx, dy = ty - fy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const bx = tx - dx * 2.4, by = ty - dy * 2.4;      // head base center
    const px = -dy * 1.4, py = dx * 1.4;                // perpendicular
    const pts = [
        tx.toFixed(1) + ',' + ty.toFixed(1),
        (bx + px).toFixed(1) + ',' + (by + py).toFixed(1),
        (bx - px).toFixed(1) + ',' + (by - py).toFixed(1),
    ].join(' ');
    return `<polygon points="${pts}" fill="${ovColors()[color]}"/>`;
}
function ovQ(p0, cp, p1, color) {
    return `<path d="M ${sx(p0[0])} ${p0[1]} Q ${sx(cp[0])} ${cp[1]} ${sx(p1[0])} ${p1[1]}"` +
        ` fill="none" stroke="${ovColors()[color]}" stroke-width=".55" stroke-dasharray="2 1.4"/>` +
        ovHead(p1, cp, color);
}
function ovL(p0, p1, color) {
    return `<path d="M ${sx(p0[0])} ${p0[1]} L ${sx(p1[0])} ${p1[1]}"` +
        ` fill="none" stroke="${ovColors()[color]}" stroke-width=".55" stroke-dasharray="2 1.4"/>` +
        ovHead(p1, p0, color);
}
/* Accent fill at low alpha without var(): 8-digit hex on a 6-digit accent */
function accentSoftFill() {
    const a = teamAccent();
    return /^#[0-9a-f]{6}$/i.test(a) ? a + '2b' : 'rgba(245,200,66,.17)';
}
function strategyOverlays(phaseId) {
    if (phaseId === 'defense') return (
        ovQ([12,80],[12,60],[12,35],'a') +
        ovQ([88,80],[88,60],[88,35],'a') +
        ovL([31,85],[18,85],'w') +
        ovL([69,85],[82,85],'w'));
    if (phaseId === 'midfield') return (
        `<polygon points="${sx(50)},67 ${sx(25)},48 ${sx(75)},48" fill="${accentSoftFill()}" stroke="${teamAccent()}" stroke-width=".45" stroke-dasharray="2 1.4"/>` +
        ovQ([25,48],[30,35],[38,22],'a') +
        ovQ([75,48],[70,35],[62,22],'a'));
    if (phaseId === 'attack') return (
        ovQ([12,28],[20,15],[35,12],'w') +
        ovQ([88,28],[80,15],[65,12],'w') +
        ovQ([50,28],[50,15],[50,8],'w') +
        ovL([25,48],[25,35],'a') +
        ovL([75,48],[75,35],'a'));
    return '';
}

/* The pitch: markings + overlay arrows in one SVG, player dots as
   absolutely-positioned divs so phase changes animate in CSS. */
function strategyPitch(phase) {
    const S = STRATEGY_433;
    const W = PITCH_W;
    const dots = S.players.map(p => {
        const posArr = p[phase.id === 'overview' ? 'base' : phase.id] || p.base;
        const hl = phase.highlight === 'all' || (phase.highlight || []).includes(p.id);
        return `<button class="sp-dot sp-${p.type}${hl ? '' : ' sp-dim'}"` +
            ` style="left:${posArr[0]}%;top:${posArr[1]}%;"` +
            ` onclick="strategyPickPosition(${p.id})" title="#${p.id} ${S.positions[p.id].name}">` +
            `<span class="sp-num">${p.id}</span><span class="sp-pos">${p.pos}</span></button>`;
    }).join('');

    return `<div class="pitch-wrap">
        <svg class="pitch-svg" viewBox="0 0 ${W} 100" aria-hidden="true">
            <rect x="1" y="1" width="${W - 2}" height="98" fill="none" stroke="rgba(255,255,255,.5)" stroke-width=".5"/>
            <line x1="1" y1="50" x2="${W - 1}" y2="50" stroke="rgba(255,255,255,.35)" stroke-width=".35"/>
            <circle cx="${W / 2}" cy="50" r="9" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".35"/>
            <rect x="${sx(28)}" y="1" width="${sx(44)}" height="14" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".35"/>
            <rect x="${sx(28)}" y="85" width="${sx(44)}" height="14" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".35"/>
            <rect x="${sx(40)}" y="1" width="${sx(20)}" height="5.5" fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".3"/>
            <rect x="${sx(40)}" y="93.5" width="${sx(20)}" height="5.5" fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".3"/>
            <g class="pitch-ov">${strategyOverlays(phase.id)}</g>
        </svg>
        ${dots}
    </div>`;
}

/* ---- SET PIECES (corner plays, ported from v1) ---- */

function spFieldFrame() {
    return '<rect width="300" height="185" fill="#1c5c33"/>' +
        '<rect x="0" y="14" width="300" height="20" fill="rgba(0,0,0,0.06)"/>' +
        '<rect x="0" y="54" width="300" height="20" fill="rgba(0,0,0,0.06)"/>' +
        '<rect x="0" y="94" width="300" height="20" fill="rgba(0,0,0,0.06)"/>' +
        '<rect x="0" y="134" width="300" height="20" fill="rgba(0,0,0,0.06)"/>' +
        '<line x1="0" y1="14" x2="300" y2="14" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>' +
        '<rect x="50" y="14" width="200" height="100" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>' +
        '<rect x="100" y="14" width="100" height="38" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>' +
        '<rect x="118" y="5" width="64" height="12" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.6)" stroke-width="1.8"/>' +
        '<circle cx="150" cy="80" r="2.5" fill="rgba(255,255,255,0.4)"/>' +
        '<path d="M 300 14 A 22 22 0 0 0 278 36" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>' +
        '<line x1="0" y1="175" x2="300" y2="175" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4 4"/>' +
        '<text x="8" y="11" class="sp-svg-lbl">GOAL LINE</text>';
}

function spDot(x, y, num, fill, ink, label, labelFill) {
    return `<circle cx="${x}" cy="${y}" r="9" fill="${fill}" stroke="${ink}" stroke-width="2"/>` +
        `<text x="${x}" y="${y + 3.5}" text-anchor="middle" class="sp-svg-num" fill="${ink}">${num}</text>` +
        (label ? `<text x="${x}" y="${y + 17}" text-anchor="middle" class="sp-svg-tag" fill="${labelFill || 'rgba(255,255,255,.75)'}">${label}</text>` : '');
}

/* Explicit arrowhead in the 300x185 set-piece space (no SVG markers —
   see the compositor-freeze note above). */
function spHead(tip, from, fill) {
    let dx = tip[0] - from[0], dy = tip[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const bx = tip[0] - dx * 7, by = tip[1] - dy * 7;
    const px = -dy * 4, py = dx * 4;
    return `<polygon points="${tip[0]},${tip[1]} ${(bx + px).toFixed(1)},${(by + py).toFixed(1)} ${(bx - px).toFixed(1)},${(by - py).toFixed(1)}" fill="${fill}"/>`;
}

const STRATEGY_SET_PIECES = [
    {
        id: 'atk-corner', label: 'Attacking Corner', badge: 'attack',
        desc: 'Three options run at the same time. Read which runner beats their marker and deliver the ball early.',
        tips: [
            { role: '#9',  c: '#e5484d', text: 'Near Post — sprint hard to the near post. Flick it on or let it run through to the back post runners.' },
            { role: '#7',  c: 'var(--accent)', text: 'Back Post — arrive late at full speed. Time the run so you reach the far post at the moment the ball arrives.' },
            { role: '#10', c: '#5EA8F2', text: 'Short Corner — stay close to the kicker. If no run is on, offer a short pass to reset the angle.' },
            { role: '#6',  c: '#3CDB7A', text: 'Edge of Box — hold back for a clearance or second ball. Also tracks any counter-attack.' },
        ],
        svg() {
            return '<svg viewBox="0 0 300 185" xmlns="http://www.w3.org/2000/svg" class="sp-svg">' +
                spFieldFrame() +
                spDot(292, 20, 11, 'white', '#10233d') +
                `<circle cx="291" cy="15" r="3.5" fill="${teamAccent()}" opacity="0.9"/>` +
                '<path d="M 282 18 Q 230 10 148 22" fill="none" stroke="#e5484d" stroke-width="2" stroke-dasharray="5 3"/>' +
                spHead([148, 22], [230, 10], '#e5484d') +
                spDot(138, 24, 9, '#e5484d', 'white', 'Near Post', 'rgba(229,72,77,.95)') +
                `<path d="M 282 20 Q 250 45 198 58" fill="none" stroke="${teamAccent()}" stroke-width="2" stroke-dasharray="5 3"/>` +
                spHead([198, 58], [250, 45], teamAccent()) +
                spDot(190, 62, 7, teamAccent(), '#10233d', 'Back Post', 'rgba(255,255,255,.8)') +
                '<path d="M 283 24 Q 270 40 260 52" fill="none" stroke="#5EA8F2" stroke-width="2" stroke-dasharray="3 3"/>' +
                spHead([260, 52], [270, 40], '#5EA8F2') +
                spDot(255, 57, 10, '#5EA8F2', 'white', 'Short', 'rgba(94,168,242,.95)') +
                spDot(150, 108, 6, '#3CDB7A', '#10233d', 'Edge', 'rgba(60,219,122,.9)') +
                '</svg>';
        }
    },
    {
        id: 'def-corner', label: 'Defending a Corner', badge: 'defense',
        desc: 'Zonal marking — own a zone, not a player. Stay goal-side of attackers, watch the ball, and attack it when it enters your zone.',
        tips: [
            { role: '#1',     c: 'var(--accent)', text: 'GK owns the 6-yard box. Call "KEEPER!" loudly and claim anything you can reach. You command the box.' },
            { role: '#4·5',   c: 'white',   text: 'Near Post and Back Post — one CB on each post. Do not leave your post until the ball is fully cleared.' },
            { role: '#2·3·6', c: '#93c5fd', text: 'Zone Markers — spread across the area. Step toward the ball if it enters your zone. Stay between attacker and goal.' },
            { role: '#7·11',  c: '#fbbf24', text: 'Counter Runners — stay near halfway. The second we clear, sprint — turn defense into attack immediately.' },
        ],
        svg() {
            return '<svg viewBox="0 0 300 185" xmlns="http://www.w3.org/2000/svg" class="sp-svg">' +
                spFieldFrame() +
                '<circle cx="292" cy="20" r="8" fill="rgba(229,72,77,0.85)" stroke="white" stroke-width="1.5"/>' +
                '<text x="292" y="24" text-anchor="middle" class="sp-svg-tag" fill="white">OPP</text>' +
                '<circle cx="291" cy="15" r="3.5" fill="rgba(255,120,120,0.8)"/>' +
                '<rect x="52" y="16" width="66" height="96" fill="rgba(147,197,253,0.08)" rx="2"/>' +
                '<rect x="118" y="16" width="66" height="96" fill="rgba(147,197,253,0.05)" rx="2"/>' +
                '<rect x="184" y="16" width="64" height="96" fill="rgba(147,197,253,0.08)" rx="2"/>' +
                spDot(150, 27, 1, teamAccent(), '#10233d', 'GK', 'rgba(255,255,255,.8)') +
                spDot(119, 17, 4, 'white', '#10233d', 'Near Post', 'rgba(255,255,255,.7)') +
                spDot(181, 17, 5, 'white', '#10233d', 'Back Post', 'rgba(255,255,255,.7)') +
                spDot(75, 68, 2, '#93c5fd', '#10233d') +
                spDot(150, 72, 6, '#93c5fd', '#10233d') +
                spDot(225, 68, 3, '#93c5fd', '#10233d') +
                '<text x="150" y="92" text-anchor="middle" class="sp-svg-tag" fill="rgba(147,197,253,0.8)">Zone Markers</text>' +
                spDot(60, 162, 11, '#fbbf24', '#10233d') +
                spDot(240, 162, 7, '#fbbf24', '#10233d') +
                '<text x="150" y="147" text-anchor="middle" class="sp-svg-tag" fill="rgba(251,191,36,0.8)">Counter runners — ready to spring</text>' +
                '</svg>';
        }
    },
];

/* ---- renderers ---- */

function strategySubnav() {
    const views = [
        { id: 'formation', label: 'Formation' },
        { id: 'positions', label: 'Your Position' },
        { id: 'setpieces', label: 'Set Pieces' },
    ];
    return '<div class="stats-subnav">' + views.map(v =>
        `<button class="stats-subnav-btn ${strategyView === v.id ? 'active' : ''}"` +
        ` onclick="switchStrategyView('${v.id}')">${v.label}</button>`).join('') + '</div>';
}

function switchStrategyView(v) { strategyView = v; renderStrategy(document.getElementById('main-content')); }

/* Phase changes move the existing dots (CSS-transitioned) instead of
   rebuilding the board — that's what animates the shape change, and it
   avoids tearing the SVG down mid-frame (Chrome's compositor froze on
   rapid SVG rebuilds). Falls back to a full render if the board is gone. */
function switchStrategyPhase(p) {
    strategyPhase = p;
    const S = STRATEGY_433;
    const phase = S.phases.find(x => x.id === p) || S.phases[0];
    const wrap = document.querySelector('.strategy-board .pitch-wrap');
    if (!wrap || strategyView !== 'formation') {
        renderStrategy(document.getElementById('main-content'));
        return;
    }

    const dots = wrap.querySelectorAll('.sp-dot');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    S.players.forEach((pl, i) => {
        const d = dots[i];
        if (!d) return;
        const pos = pl[phase.id === 'overview' ? 'base' : phase.id] || pl.base;
        // FLIP: measure, move, then animate the delta away with a
        // transient transform (no lingering CSS transitions on left/top).
        const first = d.getBoundingClientRect();
        d.style.left = pos[0] + '%';
        d.style.top = pos[1] + '%';
        if (!reduce && d.animate) {
            const last = d.getBoundingClientRect();
            const dx = first.left - last.left, dy = first.top - last.top;
            if (dx || dy) d.animate([
                { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))` },
                { transform: 'translate(-50%, -50%)' }
            ], { duration: 550, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
        const hl = phase.highlight === 'all' || (phase.highlight || []).includes(pl.id);
        d.classList.toggle('sp-dim', !hl);
    });
    const ov = wrap.querySelector('.pitch-ov');
    if (ov) ov.innerHTML = strategyOverlays(phase.id);

    document.querySelectorAll('.phase-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.phase === phase.id);
    });
    const title = document.querySelector('.strategy-head .section-title');
    if (title) title.textContent = phase.title;
    const notes = document.querySelector('.strategy-notes');
    if (notes) notes.innerHTML = strategyPhaseItems(phase);
}
function strategyPickPosition(n) {
    strategyPosition = n; strategyView = 'positions';
    renderStrategy(document.getElementById('main-content'));
}
function strategyPickSetPiece(id) { strategySetPiece = id; renderStrategy(document.getElementById('main-content')); }

function strategyPhaseItems(phase) {
    return phase.items.map(i =>
        `<div class="tactic-item">
            <div class="tactic-role ${i.rc}">${i.role}</div>
            <div class="tactic-item-body">
                <div class="tactic-heading">${i.t}</div>
                <div class="tactic-body">${i.b}</div>
                <div class="tactic-tip"><span>Key</span>${i.tip}</div>
            </div>
        </div>`).join('');
}

function renderStrategyFormation(container) {
    const S = STRATEGY_433;
    const phase = S.phases.find(p => p.id === strategyPhase) || S.phases[0];

    const phaseBar = '<div class="phase-bar">' + S.phases.map(p =>
        `<button class="phase-btn ${p.id === phase.id ? 'active' : ''}" data-phase="${p.id}"` +
        ` onclick="switchStrategyPhase('${p.id}')">${p.label}</button>`).join('') + '</div>';

    const items = strategyPhaseItems(phase);

    container.innerHTML = strategySubnav() +
        `<div class="content-area">
            <div class="strategy-head">
                <div class="section-title" style="margin:0;">${phase.title}</div>
                <span class="strategy-formation-chip">${S.formation}</span>
            </div>
            ${phaseBar}
            <div class="strategy-grid">
                <div class="strategy-board">${strategyPitch(phase)}
                    <div class="pitch-hint">Tap a player to see her position guide</div>
                </div>
                <div class="strategy-notes">${items}</div>
            </div>
        </div>`;
}

function renderStrategyPositions(container) {
    const S = STRATEGY_433;
    const p = S.positions[strategyPosition] || S.positions[9];
    const player = S.players.find(x => x.id === strategyPosition) || {};

    const picker = '<div class="pos-picker">' + S.players
        .slice().sort((a, b) => a.id - b.id)
        .map(x => `<button class="pos-chip sp-${x.type} ${x.id === strategyPosition ? 'active' : ''}"` +
            ` onclick="strategyPickPosition(${x.id})"><b>${x.id}</b>${x.pos}</button>`).join('') + '</div>';

    const PHASE_LABELS = { defense: 'When we build out', midfield: 'In midfield', attack: 'In the attack' };
    const jobs = Object.entries(p.jobs).map(([ph, text]) =>
        `<div class="pos-job">
            <div class="pos-job-phase">${PHASE_LABELS[ph] || ph}</div>
            <div class="pos-job-text">${text}</div>
        </div>`).join('');

    // Mini pitch with just this player lit, in base shape
    const miniPhase = { id: 'overview', highlight: [strategyPosition] };

    container.innerHTML = strategySubnav() +
        `<div class="content-area">
            <div class="section-title">Find your position <span>What's my job?</span></div>
            ${picker}
            <div class="strategy-grid">
                <div class="strategy-board">${strategyPitch(miniPhase)}</div>
                <div class="strategy-notes">
                    <div class="pos-card-head">
                        <span class="pos-card-num sp-${player.type || 'mid'}">${strategyPosition}</span>
                        <div>
                            <div class="pos-card-name">${p.name}</div>
                            <div class="pos-card-sum">${p.summary}</div>
                        </div>
                    </div>
                    ${jobs}
                    <div class="tactic-tip" style="margin-top:14px;"><span>Key</span>${p.key}</div>
                </div>
            </div>
        </div>`;
}

function renderStrategySetPieces(container) {
    const play = STRATEGY_SET_PIECES.find(p => p.id === strategySetPiece) || STRATEGY_SET_PIECES[0];

    const picker = '<div class="phase-bar">' + STRATEGY_SET_PIECES.map(p =>
        `<button class="phase-btn ${p.id === play.id ? 'active' : ''}"` +
        ` onclick="strategyPickSetPiece('${p.id}')">${p.label}</button>`).join('') + '</div>';

    const tips = play.tips.map(t =>
        `<div class="tactic-item">
            <div class="tactic-role" style="color:${t.c === 'white' ? 'var(--text)' : t.c};border-color:${t.c === 'white' ? 'var(--border2)' : t.c};">${t.role}</div>
            <div class="tactic-item-body"><div class="tactic-body">${t.text}</div></div>
        </div>`).join('');

    container.innerHTML = strategySubnav() +
        `<div class="content-area">
            <div class="strategy-head">
                <div class="section-title" style="margin:0;">${play.label}</div>
            </div>
            ${picker}
            <div class="strategy-grid">
                <div class="strategy-board sp-board">${play.svg()}</div>
                <div class="strategy-notes">
                    <p class="sp-desc">${play.desc}</p>
                    ${tips}
                </div>
            </div>
        </div>`;
}

function renderStrategy(container) {
    if (strategyView === 'positions') return renderStrategyPositions(container);
    if (strategyView === 'setpieces') return renderStrategySetPieces(container);
    renderStrategyFormation(container);
}
