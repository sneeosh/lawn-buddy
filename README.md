# Lawn Buddy

A lawn-care assistant for US and Canadian homeowners. Take photos, describe your patch, and get specific, time-sensitive guidance tailored to climate zone and season — plus a 6-month plan generated in the background and seasonal/weather alerts via email.

Live: <https://lawnbuddy.kennyatx.com>

## Stack

- **Cloudflare Workers** (Hono) — single Worker serves both the API and the static SPA
- **D1** — relational store for users, lawns, photos metadata, chat messages, notifications, rate-limit counters
- **R2** — photo blobs (onboarding + chat uploads)
- **AI Gateway → Workers AI** — vision-capable Llama 3.2 11B via the OpenAI-compat `/chat/completions` endpoint
- **Email Routing** — outbound seasonal/weather notifications
- **Cron** — daily 13:00 UTC sweep: weather-aware alerts, scheduled-notification promotion, history pruning

Frontend is a vanilla SPA in `public/` — no build step. Editorial "field almanac" design (Fraunces + Bricolage Grotesque + JetBrains Mono).

## Architecture

```
Browser ──┐
          ▼
   Cloudflare Worker (src/index.ts)
          │
   Hono routes (src/routes/)
          │
          ├─ requireUser middleware  (email + device-id check)
          ├─ rateLimit middleware    (D1-backed, two scopes)
          │
          ├─ /api/users/me           → claim email-as-account
          ├─ /api/lawns              → CRUD; POST also fires generatePlan() in background
          ├─ /api/lawns/:id/messages → chat (LLM with rolling 90-day history)
          ├─ /api/lawns/:id/assessment → first-pass + reassessment after intake edit
          ├─ /api/lawns/:id/photos   → R2 blob upload + thumbnails
          ├─ /api/lawns/:id/notifications → { upcoming, recent }
          ├─ /api/zones, /api/estimate-size
          └─ /api/admin/stats         → engagement totals + signups
                                        (gated by Cloudflare Access, not requireUser)

   Daily cron (src/lib/cron.ts):
          1. Weather forecast per zone
          2. LLM produces alerts (seasonal + weather-driven)
          3. Promote any scheduled notifications whose date has passed
          4. Prune messages > 90d, rate-limit rows > 7d
```

### Key design choices

- **No password auth.** Email is the account; `device_id` (UUID stored in `localStorage`) blocks impersonation of an existing email. New emails auto-claim. The `/admin` analytics page is separately gated by a Cloudflare Access self-hosted app — the Worker just trusts the `Cf-Access-Authenticated-User-Email` header that Access injects, and `workers_dev = false` keeps the only path through Access.
- **Photo discipline at upload.** iPhone photos can be 5–12 MB HEIC, which the vision model can't decode. The SPA re-encodes every image through a canvas to JPEG (max 2048 px, q 0.85, with quality/dimension fallback) before upload, so the server never sees HEIC and never has to handle multi-megabyte uploads.
- **History sanitization.** Disclaimers appended by the platform are stripped from assistant messages before they're fed back to the LLM as context. Otherwise the model copies the pattern and emits its own duplicate disclaimer.
- **Date awareness.** `buildSystemPrompt` injects today's date so the LLM doesn't guess the month.
- **Photo discipline.** System prompt explicitly forbids referencing photos that aren't attached. The initial-assessment prompt is built dynamically from the actual onboarding photo count.
- **Background plan generation.** Lawn creation kicks off a 4–8-entry 6-month plan via `c.executionCtx.waitUntil()`. The user gets the lawn back instantly; the plan lands within ~5–10s and shows in **Coming up** on the Notifications tab.
- **Idempotent disclaimer + dedup keys.** `maybeAppendDisclaimer` short-circuits if the marker is already present. Plan items dedup against existing `dedup_key` so the daily cron's LLM-personalized version can later supersede a planned one safely.

## Prerequisites

- Node.js 18+
- A Cloudflare account
- A Cloudflare API token with the scopes you need (Workers/D1/R2/Workers AI/AI Gateway). For first-time setup, `npx wrangler login` (OAuth) covers Workers + D1 + R2.

## First-time setup

```bash
npm install

# 1. D1 database
npx wrangler d1 create lawn-buddy-db
# → paste the returned database_id into wrangler.toml

# 2. R2 bucket
npx wrangler r2 bucket create lawn-buddy-photos

# 3. Apply migrations locally + remotely
npm run db:migrate:local
npm run db:migrate:remote

# 4. Local secrets (.dev.vars — gitignored)
echo 'LLM_PROVIDER_TOKEN=<cf_api_token_with_workers_ai_run_permission>' > .dev.vars
# Optional: CF_AI_GATEWAY_TOKEN=<...> if Authenticated Gateway is on

# 5. Production secrets
npx wrangler secret put LLM_PROVIDER_TOKEN
# Optional: npx wrangler secret put CF_AI_GATEWAY_TOKEN
```

### AI Gateway notes

- Set `CF_ACCOUNT_ID` and `CF_AI_GATEWAY_ID` in `wrangler.toml` `[vars]`.
- `LLM_MODEL` must be in `<provider>/<model>` form for the OpenAI-compat endpoint, e.g. `workers-ai/@cf/meta/llama-3.2-11b-vision-instruct`.
- Llama 3.2 requires a one-time license acceptance per account. Hit the **direct** Workers AI API with `{"prompt":"agree"}` once:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai/run/@cf/meta/llama-3.2-11b-vision-instruct" \
  -H "Authorization: Bearer $LLM_PROVIDER_TOKEN" \
  -H "content-type: application/json" \
  -d '{"prompt":"agree"}'
```

The compat endpoint will refuse to forward the agreement; it has to go through `client/v4`.

## Local development

```bash
npm run dev
# default port 8787; pass --port if it's taken
```

Worker code lives in `src/`; static SPA in `public/`. The `[assets]` binding in `wrangler.toml` serves `public/` for non-`/api/*` routes. `wrangler dev` reloads on file save.

## Deploy

```bash
npx wrangler deploy
```

The custom domain `lawnbuddy.kennyatx.com` is configured as a Workers Custom Domain (auto-provisioned proxied DNS). Change the host in `wrangler.toml` `routes` to point elsewhere.

## Rate limits

LLM-bearing endpoints (`POST /api/lawns`, `/assessment`, `/messages`, `/estimate-size`) are gated by `src/middleware/rate-limit.ts` with two scopes:

| Scope | Per minute | Per day |
|---|---|---|
| IP + email | 10 | 60 |
| IP alone | 30 | 200 |

Counters live in the `rate_limits` D1 table (`key`, `window_start`, `count`). The cron sweeps rows older than 7 days. 429 responses include `Retry-After`.

## Project layout

```
lawn-buddy/
├── src/
│   ├── index.ts              # Hono app, route mounting, scheduled handler
│   ├── types.ts              # Env + row types
│   ├── middleware/
│   │   ├── user.ts           # email + device-id gate
│   │   └── rate-limit.ts
│   ├── routes/
│   │   ├── users.ts
│   │   ├── lawns.ts          # CRUD + background plan kick-off
│   │   ├── photos.ts
│   │   ├── messages.ts       # chat
│   │   ├── assessment.ts     # initial + reassessment
│   │   ├── notifications.ts  # split into upcoming/recent
│   │   ├── estimate.ts       # photo → size estimate
│   │   └── zones.ts
│   └── lib/
│       ├── llm.ts            # AI Gateway call, prompts, disclaimers
│       ├── plan.ts           # background 6-month plan generation
│       ├── cron.ts           # daily sweep
│       ├── weather.ts        # zone → forecast lookup
│       ├── email.ts          # Cloudflare Email Routing
│       ├── zones.ts          # US/Canada climate-zone catalog
│       ├── prune.ts          # rolling history window
│       ├── validate.ts       # intake/soil-test validators
│       └── id.ts
├── public/                   # vanilla SPA (index.html, app.js, style.css)
├── migrations/               # D1 SQL migrations (numbered)
└── wrangler.toml
```

## License

MIT
