/**
 * Sting Hub — AI Proxy Worker
 * Proxies requests to Anthropic so the API key never touches the browser.
 *
 * Deploy to Cloudflare Workers, then add your key:
 *   wrangler secret put ANTHROPIC_API_KEY
 *
 * The worker accepts:  POST /ai  { system: "...", prompt: "..." }
 * It returns:          { text: "..." }  or  { error: "..." }
 */

const ALLOWED_ORIGINS = [
  'https://teamhub.simplegenius.io',
  'https://team-hub-apt.pages.dev',
];

function getAllowedOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

export default {
  async fetch(request, env) {
    const allowedOrigin = getAllowedOrigin(request);
    const CORS = {
      'Access-Control-Allow-Origin':  allowedOrigin || 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // ── CORS preflight ─────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── Route guard ────────────────────────────────────────────────
    const url = new URL(request.url);
    if (url.pathname !== '/ai' || request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers: CORS });
    }

    // ── Origin guard ───────────────────────────────────────────────
    if (!allowedOrigin) {
      return new Response('Forbidden', { status: 403, headers: CORS });
    }

    // ── Parse body ─────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, CORS);
    }

    const { system, prompt } = body;
    if (!system || !prompt) {
      return json({ error: 'Missing system or prompt field' }, 400, CORS);
    }

    // ── Call Anthropic ─────────────────────────────────────────────
    let anthropicRes;
    try {
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-5',
          max_tokens: 1024,
          thinking:   { type: 'disabled' },
          system:     system,
          messages:   [{ role: 'user', content: prompt }],
        }),
      });
    } catch (err) {
      return json({ error: 'Failed to reach Anthropic: ' + err.message }, 502, CORS);
    }

    // ── Parse and return ───────────────────────────────────────────
    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      const msg = data?.error?.message || 'Anthropic error ' + anthropicRes.status;
      return json({ error: msg }, anthropicRes.status, CORS);
    }

    const text = data?.content?.[0]?.text;
    if (!text) {
      return json({ error: 'Unexpected response shape from Anthropic' }, 502, CORS);
    }

    return json({ text }, 200, CORS);
  },
};

// ── Helper ─────────────────────────────────────────────────────────
function json(body, status = 200, cors = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
