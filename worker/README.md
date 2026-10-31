# sting-hub-ai worker

Source of the Cloudflare Worker that `js/story.js` calls at
`https://sting-hub-ai.lazycryptotrapstar.workers.dev/ai`. It proxies one
Anthropic Messages call so the API key never reaches the browser.

## Where this came from

- Pulled from Cloudflare on 2026-09-23 through the Cloudflare connector
  (`workers_get_worker_code`), worker `sting-hub-ai`, script id
  `aadddef857774874951c1aafc734e08e`, account `lazycryptotrapstar`
  (the `*.workers.dev` subdomain).
- The deployed worker was last modified on Cloudflare 2026-03-31. It is a
  single module, `worker.js`; there was no source in this repo before this pull.
- The connector returns code and script id only. It does not return the
  compatibility date, bindings, or routes, so `wrangler.toml` here is
  minimal (name, entry point, a compatibility date chosen as the worker's
  creation date). Confirm against the Cloudflare dashboard before the first
  deploy from this folder.

## What changed in this copy

The deployed worker calls a retired model id, `claude-sonnet-4-20250514`.
This copy calls `claude-sonnet-5` and adds `thinking: { type: 'disabled' }`
next to it. The second line is required, not optional: Claude Sonnet 5 runs
adaptive thinking when `thinking` is omitted, which puts a `thinking` block
at `content[0]` and makes the worker's `content[0].text` read come back
empty. Disabling thinking keeps the Sonnet 4 behaviour (no thinking, the
text block first, all 1024 `max_tokens` for the story). Everything else is
byte-identical to the deployed code.

## Deploy (Dee's step)

From this folder, with `wrangler` logged in to the `lazycryptotrapstar`
account:

```
cd worker
wrangler deploy
```

The `ANTHROPIC_API_KEY` secret already exists on the deployed worker and
survives a redeploy. Set it again only if the deploy reports it missing:

```
wrangler secret put ANTHROPIC_API_KEY
```

After deploying, open the Story tab on teamhub.simplegenius.io and run an
AI storyline to confirm the proxy answers.
