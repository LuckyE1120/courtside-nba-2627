# Cloudflare Workers deployment

This branch packages the full dashboard and viewing diary for a `workers.dev` URL. GitHub Pages remains the existing static release until this deployment passes browser QA.

## Deployment status (2026-10-26)

- Wrangler OAuth succeeded, and D1 `courtside-nba-journal` was created and migrated.
- The Worker was uploaded with the `OPENAI_API_KEY` secret and a daily 01:00 UTC trigger. Cloudflare returned `https://courtside-nba-journal.luckye1120.workers.dev`.
- The Access AUD and team domain in the current deployed Worker are placeholders. Its application routes reject requests until real Access values are configured.
- The URL timed out in the current browser and `curl`; Cloudflare Dashboard also did not load in the in-app browser. The site has **not** passed public URL or end-to-end login/AI acceptance tests.

## Required Cloudflare resources

1. Authenticate Wrangler with the owner's Cloudflare account.
2. Create a D1 database named `courtside-nba-journal` and retain its database ID.
3. Enable Cloudflare Zero Trust and protect the `courtside-nba-journal` Worker with Access. Limit the policy to the owner's Cloudflare account. Retain the Access application AUD and team domain (`https://<team>.cloudflareaccess.com`).
4. Build, then run `node scripts/prepare-cloudflare-deploy.mjs <database-id> <access-aud> <team-domain>`.
5. Apply `drizzle/0000_freezing_starhawk.sql` to the remote D1 database using the prepared `dist/server/wrangler.json`.
6. Set `OPENAI_API_KEY` with `wrangler secret put`; never add it to tracked files or CLI arguments. Deploy with `wrangler deploy --config dist/server/wrangler.json`.

The Worker rejects all production requests until Access is configured, and verifies each Access JWT against Cloudflare's rotating public keys. It adds the verified user identity to the existing journal routes. A Worker Cron Trigger runs daily at 01:00 UTC (09:00 Beijing time), generating due weekly or monthly diaries for users who have saved records. The database and API key are bound only on the server.

After deployment, open the final URL in a browser, complete Access sign-in, save and refresh a test viewing record, generate a diary with a funded API project, and verify that an unauthenticated API request returns 401 or an Access login response.
