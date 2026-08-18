/* Publishing is the one path that writes to the repo, so its behaviour is
   pinned here against a fake GitHub: encoding, conflict detection, the
   retry when someone commits underneath you, and the refusal to publish
   when the file moved on. No network, no token. */
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';
import path from 'path';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
const publishJs = fs.readFileSync(repo + 'js/admin/publish.js', 'utf8');

let pass = 0, fail = 0;
const check = (label, got, want) => {
    const g = JSON.stringify(got), w = JSON.stringify(want);
    if (g === w) pass++;
    else { fail++; console.log(`  FAIL ${label}\n       got:  ${g}\n       want: ${w}`); }
};

/* ---- fake browser + fake GitHub ---- */
function makeCtx(server) {
    const store = {};
    const calls = [];
    const ctx = {
        console,
        localStorage: {
            getItem: k => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: k => { delete store[k]; },
        },
        btoa: s => Buffer.from(s, 'binary').toString('base64'),
        atob: s => Buffer.from(s, 'base64').toString('binary'),
        TextEncoder, TextDecoder,
        fetch: (url, opts) => {
            calls.push({ url, method: (opts && opts.method) || 'GET', body: opts && opts.body, headers: opts && opts.headers });
            return Promise.resolve(server(url, opts || {}));
        },
    };
    vm.createContext(ctx);
    vm.runInContext(publishJs, ctx);
    ctx.__calls = calls;
    ctx.__store = store;
    return ctx;
}
const reply = (status, obj) => ({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(obj == null ? '' : JSON.stringify(obj)),
});
const b64 = s => Buffer.from(s, 'utf8').toString('base64');

/* ---- 1. UTF-8 base64 round-trip (the data is full of ·, —, emoji) ---- */
console.log('\n[encoding]');
{
    const ctx = makeCtx(() => reply(200, {}));
    const tricky = 'Sting · McNeal — "quotes" 🏆 Apr 10–12 · café';
    check('round-trips exactly', ctx.fromBase64(ctx.toBase64(tricky)), tricky);
    check('plain ascii unaffected', ctx.fromBase64(ctx.toBase64('hello')), 'hello');
    // Naive btoa/atob mangles anything outside Latin-1 (browsers throw outright).
    // This is the whole reason the TextEncoder-based helper exists.
    let naiveBroken = false;
    try { naiveBroken = ctx.atob(ctx.btoa(tricky)) !== tricky; } catch (e) { naiveBroken = true; }
    check('naive btoa would have broken it', naiveBroken, true);
    const big = 'x·'.repeat(60000);
    check('large payload survives chunking', ctx.fromBase64(ctx.toBase64(big)) === big, true);
}

/* ---- 2. Token handling ---- */
console.log('\n[token]');
{
    const ctx = makeCtx(() => reply(200, {}));
    check('starts with no token', ctx.hasToken(), false);
    ctx.setToken('  ghp_test  ');
    check('trims on save', ctx.getToken(), 'ghp_test');
    check('reports present', ctx.hasToken(), true);
    ctx.clearToken();
    check('forgets on demand', ctx.hasToken(), false);
}

/* ---- 3. Refuses to act without a token ---- */
console.log('\n[no token]');
{
    const ctx = makeCtx(() => reply(200, {}));
    let msg = '';
    await ctx.ghGetFile('data/teams.json').catch(e => { msg = e.message; });
    check('explains what to do', /no access token/i.test(msg), true);
    check('made no network call', ctx.__calls.length, 0);
}

/* ---- 4. Happy path: read sha, write new content ---- */
console.log('\n[publish]');
{
    const LIVE = '{"a":1}\n', NEXT = '{"a":2}\n';
    const ctx = makeCtx((url, opts) => {
        if (opts.method === 'PUT') return reply(200, { commit: { sha: 'newsha', html_url: 'https://github.com/x' } });
        return reply(200, { sha: 'sha-1', content: b64(LIVE), size: LIVE.length });
    });
    ctx.setToken('t');
    const res = await ctx.publishFile('data/teams.json', NEXT, 'msg', { baseContent: LIVE });
    check('reports a commit', !!res.commit, true);
    const put = ctx.__calls.find(c => c.method === 'PUT');
    const body = JSON.parse(put.body);
    check('sent the new content', Buffer.from(body.content, 'base64').toString('utf8'), NEXT);
    check('passed the sha it read', body.sha, 'sha-1');
    check('targeted the configured branch', body.branch, 'main');
    check('only ever talks to github', ctx.__calls.every(c => c.url.startsWith('https://api.github.com')), true);
    check('sends the token as a bearer', /^Bearer /.test(put.headers.Authorization), true);
}

/* ---- 5. No-op when GitHub already matches ---- */
{
    const SAME = '{"a":1}\n';
    const ctx = makeCtx(() => reply(200, { sha: 's', content: b64(SAME) }));
    ctx.setToken('t');
    const res = await ctx.publishFile('data/teams.json', SAME, 'msg', { baseContent: SAME });
    check('skips an identical write', res.unchanged, true);
    check('never issued a PUT', ctx.__calls.some(c => c.method === 'PUT'), false);
}

/* ---- 6. Conflict: file moved on since this session loaded it ---- */
console.log('\n[conflict]');
{
    const LOADED = '{"a":1}\n', THEIRS = '{"a":99}\n', MINE = '{"a":2}\n';
    const ctx = makeCtx((url, opts) => {
        if (opts.method === 'PUT') return reply(200, { commit: { sha: 'x' } });
        return reply(200, { sha: 's2', content: b64(THEIRS) });
    });
    ctx.setToken('t');
    let err = null;
    await ctx.publishFile('data/teams.json', MINE, 'msg', { baseContent: LOADED }).catch(e => { err = e; });
    check('refuses to clobber', err && err.code, 'CONFLICT');
    check('did not write', ctx.__calls.some(c => c.method === 'PUT'), false);
    check('hands back their version', err.liveContent, THEIRS);

    // ...and goes through when the user chooses to overwrite
    const ctx2 = makeCtx((url, opts) => {
        if (opts.method === 'PUT') return reply(200, { commit: { sha: 'y' } });
        return reply(200, { sha: 's2', content: b64(THEIRS) });
    });
    ctx2.setToken('t');
    const forced = await ctx2.publishFile('data/teams.json', MINE, 'msg', { force: true });
    check('force publishes', !!forced.commit, true);
}

/* ---- 7. Race: someone commits between our read and our write ---- */
{
    let puts = 0;
    const ctx = makeCtx((url, opts) => {
        if (opts.method === 'PUT') {
            puts++;
            if (puts === 1) return reply(409, { message: 'is at abc but expected def' });
            return reply(200, { commit: { sha: 'retried' } });
        }
        return reply(200, { sha: 'sha-' + puts, content: b64('{"a":1}\n') });
    });
    ctx.setToken('t');
    const res = await ctx.publishFile('data/teams.json', '{"a":2}\n', 'msg', {});
    check('retries once with a fresh sha', res.retried, true);
    check('succeeds on the retry', !!res.commit, true);
}

/* ---- 8. First publish of a file that does not exist yet ---- */
{
    const ctx = makeCtx((url, opts) => {
        if (opts.method === 'PUT') return reply(201, { commit: { sha: 'created' } });
        return reply(404, { message: 'Not Found' });
    });
    ctx.setToken('t');
    const res = await ctx.publishFile('data/new.json', '{}\n', 'create', {});
    const put = ctx.__calls.find(c => c.method === 'PUT');
    check('creates without a sha', JSON.parse(put.body).sha, undefined);
    check('reports the commit', !!res.commit, true);
}

/* ---- 9. Errors are explained in plain language ---- */
console.log('\n[errors]');
{
    for (const [status, expect] of [[401, /token/i], [403, /Contents/], [404, /repo name/i]]) {
        const ctx = makeCtx(() => reply(status, { message: 'nope' }));
        ctx.setToken('t');
        let msg = '';
        await ctx.verifyAccess().catch(e => { msg = e.message; });
        check(`${status} is actionable`, expect.test(msg), true);
    }
}

console.log(`\n${'='.repeat(50)}\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
