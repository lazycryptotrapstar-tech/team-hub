/* ============================================================
   PUBLISH
   Commits the edited JSON straight to the repo via the GitHub
   Contents API; Cloudflare redeploys the site from that commit.

   The token is a fine-grained personal access token scoped to this
   one repository with Contents read/write — nothing else. It lives
   in this browser's localStorage and is only ever sent to
   api.github.com (see ghFetch, which hardcodes that host).
============================================================ */

const GH_API = 'https://api.github.com';
const TOKEN_KEY = 'hub_admin_token';
const REPO_KEY = 'hub_admin_repo';

const DEFAULT_REPO = { owner: 'lazycryptotrapstar-tech', repo: 'team-hub', branch: 'main' };

function getRepoConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(REPO_KEY) || '{}');
        return Object.assign({}, DEFAULT_REPO, saved);
    } catch (e) { return Object.assign({}, DEFAULT_REPO); }
}
function setRepoConfig(cfg) {
    localStorage.setItem(REPO_KEY, JSON.stringify(Object.assign(getRepoConfig(), cfg)));
}

function getToken()   { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t)  { localStorage.setItem(TOKEN_KEY, (t || '').trim()); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }
function hasToken()   { return !!getToken(); }

/* ---- UTF-8 safe base64 (the data has ·, —, emoji; btoa alone breaks) ---- */
function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
}
function fromBase64(b64) {
    const bin = atob((b64 || '').replace(/\s/g, ''));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

/* ---- GitHub API ---- */
function ghFetch(path, options) {
    const token = getToken();
    if (!token) return Promise.reject(new Error('No access token saved. Open Setup and add one.'));
    const opts = options || {};
    return fetch(GH_API + path, {
        method: opts.method || 'GET',
        headers: Object.assign({
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        }, opts.headers || {}),
        body: opts.body,
    }).then(async res => {
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) { /* non-JSON error body */ }
        if (!res.ok) {
            const err = new Error(githubErrorMessage(res.status, json));
            err.status = res.status;
            err.body = json;
            throw err;
        }
        return json;
    });
}

function githubErrorMessage(status, json) {
    const msg = (json && json.message) || 'request failed';
    if (status === 401) return 'GitHub rejected the token (401). It may be expired or mistyped.';
    if (status === 403) return 'GitHub denied access (403). Check the token has Contents: Read and write on this repo.';
    if (status === 404) return 'Not found (404). Check the repo name and that the token can see this repository.';
    if (status === 409) return 'The file changed on GitHub since it was loaded (409).';
    if (status === 422) return 'GitHub rejected the update (422): ' + msg;
    return 'GitHub error ' + status + ': ' + msg;
}

function ghGetFile(path) {
    const c = getRepoConfig();
    return ghFetch(`/repos/${c.owner}/${c.repo}/contents/${path}?ref=${encodeURIComponent(c.branch)}`)
        .then(json => ({ sha: json.sha, content: fromBase64(json.content), size: json.size }))
        .catch(err => {
            if (err.status === 404) return null; // file not there yet — first publish creates it
            throw err;
        });
}

function ghPutFile(path, contentStr, message, sha) {
    const c = getRepoConfig();
    const body = { message: message, content: toBase64(contentStr), branch: c.branch };
    if (sha) body.sha = sha;
    return ghFetch(`/repos/${c.owner}/${c.repo}/contents/${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

/* Publish a file. Always re-reads the current sha immediately before
   writing, so a stale editor session doesn't clobber a newer commit.
   If the file changed since this session loaded it, refuses and reports
   the conflict rather than overwriting — unless opts.force is set. */
async function publishFile(path, contentStr, message, opts) {
    opts = opts || {};
    const live = await ghGetFile(path);

    if (live && opts.baseContent != null && live.content !== opts.baseContent && !opts.force) {
        const err = new Error('This file changed on GitHub since you loaded it. Reload to merge, or publish again to overwrite.');
        err.code = 'CONFLICT';
        err.liveContent = live.content;
        throw err;
    }
    if (live && live.content === contentStr) {
        return { unchanged: true };
    }

    try {
        const res = await ghPutFile(path, contentStr, message, live ? live.sha : null);
        return { commit: res.commit, unchanged: false };
    } catch (err) {
        // Someone committed between our read and write — retry once with the fresh sha
        if (err.status === 409 || err.status === 422) {
            const fresh = await ghGetFile(path);
            const res = await ghPutFile(path, contentStr, message, fresh ? fresh.sha : null);
            return { commit: res.commit, unchanged: false, retried: true };
        }
        throw err;
    }
}

/* Verify a token works and can write here, before anything is published. */
async function verifyAccess() {
    const c = getRepoConfig();
    const repo = await ghFetch(`/repos/${c.owner}/${c.repo}`);
    const canWrite = repo.permissions && (repo.permissions.push || repo.permissions.admin);
    return {
        repo: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        canWrite: !!canWrite,
    };
}

/* ---- Export fallback (no token needed) ---- */
function downloadFile(filename, contentStr) {
    const blob = new Blob([contentStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
