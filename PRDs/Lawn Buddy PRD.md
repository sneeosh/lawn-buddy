# Lawn Buddy — Product Requirements Document

**Status:** Finalized for v1
**Owner:** Kenny Johnson
**Last updated:** 2026-04-25

---

## 1. Background & Problem

Young homeowners lack a trustworthy, personalized guide for lawn care. The status quo is fragmented: r/lawncare threads, regional sites like bermudabible.com, $$$ landscapers, and product packaging that's mostly marketing. There's no single tool that takes a homeowner's actual lawn (region, grass type, current condition, photos) and gives ongoing, season-aware guidance.

## 2. Goals

- Give the user (1) a credible initial assessment of their lawn and (2) ongoing, contextual guidance throughout the year.
- Replace ad-hoc Reddit/Google research with a single conversational interface.
- Trigger timely, region-appropriate care alerts the user would otherwise miss.

## 3. Non-Goals (v1)

- Monetization, paid tiers, marketplace, or product affiliate links.
- Native mobile apps (iOS/Android).
- Authentication, password management, or multi-device session sync.
- Expert-reviewed or curated knowledge base — advice comes from the LLM.
- Computer-vision models trained for weed/disease classification — vision is handled by the multimodal LLM.
- Public sharing, social, or community features.

## 4. Target User

Primary: the author (Kenny). Secondary (post-v1): young homeowners, US-based, who want to take care of their lawn themselves and are willing to follow structured guidance.

## 5. MVP Scope (v1)

All three pillars ship together:

1. **Onboarding assessment** — structured intake + photo upload → LLM-generated initial report (likely grass species, seed vs. sod recommendation, condition baseline).
2. **Ongoing chat** — per-lawn conversational interface with photo attachment for check-ins.
3. **Seasonal & weather alerts** — calendar + weather-driven recommendations delivered via email and shown in-app.

## 6. User Stories

- As a homeowner, I can add a lawn by entering a name, climate zone (via state/region picker), and basic structured details.
- As a homeowner, I can upload photos and free-text notes during onboarding to get an initial assessment.
- As a homeowner, I can optionally enter soil test results to refine recommendations.
- As a homeowner, I can chat with the assistant about a specific lawn, attaching photos for context.
- As a homeowner, I receive timely alerts (email + in-app) when seasonal action is due for my zone, factoring in current weather.
- As a homeowner, I can manage multiple lawns (e.g., front, back, rental property) with separate histories.
- As a homeowner, I see a clear "not professional advice" disclaimer before chemical/pesticide recommendations.

## 7. Functional Requirements

### 7.1 Identity
- No auth in v1. **Email address is the user identifier.** First-time users enter email to create their account; returning users enter the same email to load their lawns.
- Email is also the notification channel.
- Server stores users keyed by email; no password, no verification step in v1.

### 7.2 Lawn Management
- A user can create, rename, and delete multiple lawns.
- Each lawn has: name, climate zone, structured intake fields, optional soil test, photo history, chat history.

### 7.3 Climate Zone Picker
- Dropdown UI that lets the user pick by **state → region within state** (e.g., "Georgia → North Georgia / Atlanta Metro / Coastal").
- Each region maps internally to a USDA hardiness zone (or zone range).
- User never has to know their zone number directly.

### 7.4 Onboarding Intake (Structured)
Required:
- Lawn size (sq ft, with rough estimator helper)
- Sun exposure: full / partial / shade
- Irrigation: none / hose-and-sprinkler / in-ground / drip
- Mowing frequency: weekly / bi-weekly / monthly / irregular
- Current issues (multi-select): bare spots, weeds, discoloration, thinning, pests, disease, none/unsure

Optional:
- Photos (1+ recommended)
- Free-text notes
- Soil test (see 7.5)

### 7.5 Soil Test Input (Optional, Structured Form)
- Fields: pH, N, P, K, organic matter %, CEC, Ca, Mg, S, Fe, Mn, Zn, Cu, B.
- All fields optional individually; user can fill in only what their report shows.
- Assume most users skip this entirely; UI should not pressure them.

### 7.6 Initial Assessment
- Triggered after onboarding submission.
- Server sends intake (text + photos + soil data) to LLM via Cloudflare AI Gateway.
- Output: likely grass species, seed-vs-sod recommendation, condition baseline, top 3 next actions.
- Stored as the first entry in the lawn's chat history.

### 7.7 Chat Interface
- Per-lawn conversation thread.
- Supports text input and image upload.
- Each message persisted to the lawn's chat history.
- LLM has access to the lawn profile (intake, soil, zone) on every turn.
- Photo analysis is performed by the multimodal LLM — no separate vision pipeline.

### 7.8 Alerts
Two trigger sources, combined:
- **Calendar-based per zone**: e.g., "Apply pre-emergent in early March for zone 7." Authored as a static rule set keyed on climate zone + month.
- **Weather-driven**: integrate a weather API (TBD — see Open Questions) to surface alerts based on soil temp, rainfall, frost, heat stress.

Delivery channels:
- **Email** (primary, time-sensitive alerts)
- **In-app**: a notifications/inbox view inside the lawn dashboard

### 7.9 Photo Storage
- Photos stored in Cloudflare R2.
- Retained indefinitely for v1 (small personal-project scale).
- Linked to lawn ID + timestamp so the user can scroll a visual history.

### 7.10 Chat History Retention
- Rolling 90-day window per lawn.
- Older messages dropped to control storage and LLM context cost.
- Photos are NOT dropped on the chat-history rotation; they live in R2 independently.

### 7.11 Disclaimers
- Static "not professional advice" disclaimer in the app footer.
- Inline disclaimer rendered with any LLM response that recommends chemicals, pesticides, herbicides, or fertilizer applications.

## 8. Technical Architecture

- **Hosting:** Cloudflare Workers (existing repo).
- **Frontend:** Web app (single-page, served from the Worker). PWA optional, not required.
- **Storage:**
  - Cloudflare D1 (or KV) for users, lawns, intake, soil tests, chat history metadata.
  - Cloudflare R2 for photos.
- **LLM:** Routed through **Cloudflare AI Gateway** (provider TBD by Kenny — likely Anthropic Claude given multimodal needs).
- **Email:** Provider TBD (see Open Questions).
- **Weather data:** Provider TBD (see Open Questions).
- **Scheduled jobs:** Cloudflare Cron Triggers to evaluate per-zone calendar rules + weather-driven alert conditions and dispatch emails / write in-app notifications.

## 9. Data Model (sketch)

- `users(email PK, created_at)`
- `lawns(id PK, user_email FK, name, climate_zone, intake_json, soil_test_json, created_at)`
- `photos(id PK, lawn_id FK, r2_key, taken_at, source: 'onboarding' | 'chat')`
- `messages(id PK, lawn_id FK, role: 'user'|'assistant', content, photo_ids[], created_at)` — pruned to rolling 90 days
- `notifications(id PK, lawn_id FK, type, title, body, sent_at, read_at)`

## 10. Success Metrics

Personal-project scale, but worth tracking:
- Weekly active sessions by the author.
- Number of alerts acted upon (self-reported via in-app "did this" button — nice-to-have).
- Subjective: does the lawn measurably improve over a season?

## 11. Open Questions / Decisions for Engineering

1. **Email provider**: Resend, Postmark, AWS SES, or Cloudflare Email Routing/Workers? Resend is the simplest fit for Workers. 

Answer: use cloudflare email routing

2. **Weather API**: OpenWeatherMap, Tomorrow.io, NOAA? Need soil-temp proxy if not directly available.

Answer: Use whatever has an easy API to hit

3. **Climate zone region list**: Need to author the state → region → USDA zone mapping. Scope to US-only for v1.

Answer: you can figure this out. Scope to US and Canada

4. **Calendar rule authoring**: Who writes the per-zone monthly action rules? Initial pass can be LLM-generated and human-reviewed by Kenny.

Answer: LLM should take initial pass.

5. **Lawn-size estimator UX**: Map polygon draw vs. manual entry vs. both?

Answer: estimate off photo but let user correct with form fill entry.

6. **Email collision**: If two people enter the same email, they share lawns. Acceptable for v1 (single user) but flag for v2.

Answer: just throw an error that email is already in use.

## 12. Out of Scope / Future

- Auth (magic-link or full).
- Mobile push notifications, native iOS/Android.
- Curated/expert-reviewed knowledge base, RAG over agronomy literature.
- Vision model for weed/disease classification.
- Product recommendations and affiliate links.
- Multi-user sharing (e.g., spouse access to the same lawn).
- Internationalization (non-US zones).
