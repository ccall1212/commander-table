# Commander Table relay: setup (Cloudflare, no local tools needed)

The relay is a tiny Cloudflare Worker (`worker.js`) plus one Durable Object per game room. It passes
messages between players and temporarily stores room recovery data and public spectator snapshots.
You do NOT need Node or npm. Cloudflare
builds and deploys it from the GitHub repo (Workers Builds), which also applies the Durable Object
migration in `wrangler.jsonc`.

## Steps

1. Go to https://dash.cloudflare.com -> **Workers & Pages** -> **Create** -> **Import a repository**.
   Connect GitHub when asked. When GitHub shows the "Cloudflare Workers & Pages" app authorization,
   choose **Only select repositories** and pick just `ccall1212/commander-table`. Then select that
   repo in Cloudflare.
2. On the setup form:
   - **Project name:** exactly `commander-table-relay` (must match `name` in `wrangler.jsonc`).
   - **Production branch:** `feature/relay-netcode` for now. After that branch is merged, switch it
     to `main` (project -> Settings -> Builds).
   - **Root directory / path:** `relay`
   - **Build command:** leave empty.
   - **Deploy command:** `npx wrangler deploy` (the default).
3. Click **Save and Deploy**. The create form has no branch picker, so this first build runs on `main`
   and fails with "root directory not found" until the relay is merged. Open the worker -> **Settings** ->
   **Build** -> production branch -> `feature/relay-netcode`, save, and build again. Wait for green.
4. Copy the worker URL, e.g. `https://commander-table-relay.<your-subdomain>.workers.dev`. It is
   public, not a secret. Give it to Claude; it goes in `js/net-config.js`.
5. Sanity check: open `<url>/health` in a browser. You should see `{"ok":true,"v":2}`.

## What it costs

Nothing on the Workers Free plan. Per Cloudflare's pricing page as of Oct 2026 (check
https://developers.cloudflare.com/durable-objects/platform/pricing/): Durable Objects with SQLite
storage are included on the Free plan, with limits of 100,000 requests/day, incoming WebSocket
messages counted at 20:1 (100 messages = 5 requests), and 13,000 GB-s/day of duration. Idle rooms
hibernate and cost nothing. A 4-player game is a few hundred "requests" per hour.

If you ever hit the free limit, the relay refuses new work until 00:00 UTC, and the game falls back
to direct PeerJS connections between players.

The optional site-admin dashboard uses one Worker secret, `ADMIN_PASSPHRASE`. It must be configured privately in Cloudflare, not placed in GitHub, `wrangler.jsonc`, a source file, a URL, or a room message. The dashboard rejects every admin request while that secret is absent. See [Admin dashboard](../docs/ADMIN.md).

## Updating

Push to the production branch. Cloudflare rebuilds and redeploys automatically. To change which
websites may connect, edit the `ALLOWED_ORIGINS` list at the top of `relay/worker.js`.

## Troubleshooting

- **Build error about a name mismatch:** the Cloudflare project name must be exactly
  `commander-table-relay`, matching `name` in `relay/wrangler.jsonc`. Fix whichever one is wrong.
- **"Durable Objects not available" / free-plan error:** make sure `wrangler.jsonc` migrates with
  `new_sqlite_classes` (it does). The Free plan only allows SQLite-backed Durable Objects.
- **403 when connecting:** the page's Origin is not in `ALLOWED_ORIGINS` in `worker.js`
  (allowed: `https://ccall1212.github.io`, `http://localhost:*`, `http://127.0.0.1:*`, and
  `null` for file:// pages).
- **Build can't find the config:** check that **Root directory** is `relay`.

## Testing

Open `relay/test/relay-test.html` in a browser, paste your worker URL (`wss://...`), and click Run.
It is a scripted check of registration, takeover, links, and cleanup.
