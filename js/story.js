/* ============================================================
   STORYLINES
   Two tiers: an offline template narrative that works for any team
   with games data, and an AI rewrite via the worker. The family app
   only ever reads — storylines are written and published from the
   admin editor, and arrive as team.story in data/teams.json.
============================================================ */

const WORKER_URL = 'https://sting-hub-ai.lazycryptotrapstar.workers.dev/ai';

function getStoryText(team) {
    return (team.story && team.story.text) || generateAutoNarrative(team);
}

function storyIsPublished(team) {
    return !!(team.story && team.story.text);
}

function generateAutoNarrative(team) {
    const r = team.record;
    const l = team.league;
    const nm = team.nextMatch;
    const streak = getStreak(team.matches);
    const form = getFormGuide(team.matches, 5);
    const recentWins = form.filter(x => x === 'W').length;
    const avail = team.remainingSchedule.length * team.pointsConfig.win;

    let opener = '';
    if (streak.type === 'W' && streak.count >= 3) {
        opener = `On the back of a ${streak.count}-match win streak, ${team.branding.name} is building serious momentum as the season enters its final stretch.`;
    } else if (streak.type === 'W' && streak.count === 2) {
        opener = `Back-to-back wins have ${team.branding.name} finding their rhythm at exactly the right moment in the season.`;
    } else if (streak.type === 'L' && streak.count >= 2) {
        opener = `Knocked down but not out — ${team.branding.name} absorbs a ${streak.count}-game skid and now faces a defining moment. The response to adversity separates teams. How they answer here will define this season.`;
    } else if (recentWins >= 3) {
        opener = `${team.branding.name} is finding their groove at the right time — ${recentWins} wins in the last 5 matches with the finish line in sight.`;
    } else {
        opener = `${r.wins} wins, ${r.losses} losses, ${r.draws} draw${r.draws === 1 ? '' : 's'} — ${team.branding.name} knows exactly what's at stake as the final games approach.`;
    }
    const rankContext = (l.rank && l.totalTeams && l.rank <= Math.ceil(l.totalTeams / 2))
        ? `Holding down the #${l.rank} spot — comfortably in the top half of a ${l.totalTeams}-team division —`
        : l.rank
        ? `Sitting at #${l.rank} of ${l.totalTeams} with games left to play and plenty of room to climb,`
        : `With the table still taking shape,`;
    const gd = parseInt(l.goalDiff, 10) || 0;
    const diffContext = gd > 0
        ? `A positive ${l.goalDiff} goal differential (${team.goals.for} scored, ${team.goals.against} conceded) shows this team competes hard on both ends of the pitch.`
        : gd < 0
        ? `The ${l.goalDiff} goal differential signals an area to tighten up — limiting chances against will be key in the final run.`
        : `An even goal differential reflects a closely fought season where every goal matters.`;
    let nextContext = '';
    if (nm) {
        nextContext = (l.rank && l.rank < nm.oppRank)
            ? `Next up: a favorable matchup against #${nm.oppRank} ${nm.oppName} — a chance to pile on points and push up the table.`
            : (l.rank && l.rank > nm.oppRank)
            ? `Next up is #${nm.oppRank} ${nm.oppName} — a true measuring stick. A result here would silence the doubters and signal that this group is ready to fight back.`
            : `A level matchup next — #${nm.oppRank} ${nm.oppName} is right there in the standings. Three points here could be the difference at season's end.`;
    } else {
        nextContext = `The regular season is in the books — ${l.points} points on the board and a body of work to be proud of.`;
    }
    return `${opener}\n\n${rankContext} the team is carrying ${l.points} points with ${avail} still to play for. ${diffContext}\n\n${nextContext}`;
}

async function callAI(systemPrompt, userPrompt) {
    const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: systemPrompt, prompt: userPrompt }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'AI request failed');
    return data.text;
}

/* The stat brief the AI writes from. Shared so the admin editor and any
   future caller describe a team the same way. */
function buildStoryPrompt(team) {
    const r = team.record, l = team.league, nm = team.nextMatch;
    const streak = getStreak(team.matches);
    const avail = team.remainingSchedule.length * team.pointsConfig.win;
    const streakLabel = streak.count
        ? streak.count + '-match ' + (streak.type === 'W' ? 'win' : streak.type === 'L' ? 'losing' : 'unbeaten') + ' streak'
        : 'no current streak';
    const sport = (team.branding.sport || 'soccer').toLowerCase();
    const system = 'You are a sports broadcast journalist writing dramatic weekly season recaps for youth ' +
        sport + ' teams. Write in an energetic narrative style like a Friday Night Lights broadcast recap. ' +
        'Under 200 words. Plain text only.';
    const prompt = 'Team: ' + team.branding.name + '. Division: ' + team.branding.league +
        '. Record: ' + r.wins + 'W-' + r.losses + 'L-' + r.draws + 'D' +
        '. Rank: #' + (l.rank || '?') + ' of ' + l.totalTeams +
        '. Points: ' + l.points + '. PPG: ' + l.ppg + '. Goal diff: ' + l.goalDiff +
        '. Goals: ' + team.goals.for + ' scored, ' + team.goals.against + ' conceded' +
        '. Streak: ' + streakLabel +
        '. Remaining: ' + team.remainingSchedule.length + ' games (' + avail + ' pts available). ' +
        (nm ? 'Next: #' + nm.oppRank + ' ' + nm.oppName + (nm.oppRecord ? ' (' + nm.oppRecord + ')' : '') + '. '
            : 'Regular season complete. ') +
        'Write a dramatic broadcast-style season story.';
    return { system, prompt };
}
