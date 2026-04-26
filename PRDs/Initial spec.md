Background

There is not a clear definitive guide for young homeowners to deal with their lawns. People will post to r/lawncare or hire a landscaper or go to websites like bermudabible.com. All lawncare products are also just marketing fluff that say they're the next best thing for your lawn even though they may not actually be.

Proposed solution

I want to have a chat interface and alert notification system that will help me maintain a great looking lawn.

The interface should allow me to upload photos, select my region, provide text input on the current state of my lawn. It should also collect some structured inputs that any average homeowner could collect. Along with advanced inputs like soil testing results, etc.

The initial analysis should give an assessment of what current grass someone most likely has. If they should use seed or sod. And which species of grass.

Then the app should ask for regular input of photos and/or text about the lawn. Plus give best practice alerts about what someone should do for a given season and region.

---

## Open Questions (PM Review — please answer inline)

1. **MVP cut**: If we had to ship in 6 weeks, is it (a) onboarding assessment only, (b) assessment + seasonal alerts, or (c) full chat + photo check-ins?
   - Answer: C all of them

2. **Advice engine**: LLM with retrieval over a curated knowledge base, or pure LLM? Are you willing to fund expert/agronomist content review?
   - Answer: I think just pure LLM

3. **Platform**: Web app first (PWA with push), native iOS, or both?
   - Answer: Web app only. No need for auth initially

4. **Region granularity**: ZIP code → climate zone lookup, or ask user for USDA zone directly?
   - Answer: Just add a climate zone drop down. But the climate zone dropdown should include state/regions in sates, so people don't have to know the exact zone

5. **Target user**: Just you, or are you building for a broader audience? (Affects monetization, polish bar, content breadth.)
   - Answer: Just me to start. I may expand. Won't monetize any time soon.

6. **Notification channels**: Push, email, SMS, or in-app only?
   - Answer: Email and in-app

7. **Photo analysis ambition**: Visual diagnosis of weeds/disease/stress (hard, vision model + labeled data), or just "attach photo to chat for context"?
   - Answer: Just have the LLM model do photo analysis.

8. **Monetization / business model**: Personal project, free, freemium, paid?
   - Answer: Personal project

9. **Soil test inputs**: Free-text paste, structured form, or PDF/image upload from labs like Waypoint/UGA?
   - Answer: The soil test inputs should be a structured form

10. **Multi-lawn / multi-zone**: One lawn per user MVP, or support front/back/different grass types?
    - Answer: I think the user should be able to add multiple lawns

---

## Follow-up Questions (Round 2 — please answer inline)

11. **Identity without auth**: If there's no auth but you want email notifications + multiple saved lawns, how should we identify a user?
    - (a) Email address as the de facto ID (enter once, stored locally + server-side)
    - (b) Anonymous device ID in localStorage, email collected only for notifications
    - (c) Magic-link "lite" auth (email → click link → session)
    - Answer: just email address

12. **LLM provider**: Anthropic API directly (Claude, with prompt caching) or Cloudflare Workers AI?
    - Answer: use cloudflare ai gateway

13. **Photo storage**: Cloudflare R2 for persistent storage (enables tracking over time), or pass to LLM and discard?
    - Answer: R2 is good

14. **Alert trigger logic**:
    - (a) Calendar-based per climate zone (e.g., "apply pre-emergent in early March for zone 7")
    - (b) Weather-API-driven (soil temp, rainfall)
    - (c) Both
    - Answer: both

15. **Onboarding intake — structured fields**: Proposed defaults: lawn size, sun exposure (full/partial/shade), irrigation (yes/no/sprinkler type), current issues (multi-select), mowing frequency. Anything to add or remove?
    - Answer: I think that makes sense

16. **Soil test fields**: Full set (pH, N, P, K, OM, CEC, Ca, Mg, S, micros: Fe, Mn, Zn, Cu, B) or simpler subset (pH, N-P-K, OM)?
    - Answer: This works but should be purely optional. assume most users won't do

17. **Chat history**: Persist per-lawn conversations forever, or rolling window (e.g., last 90 days)?
    - Answer: rolling window, can drop out chat history to save space

18. **Disclaimer / safety**: Surface a "not professional advice" disclaimer before chemical/pesticide recommendations?
    - Answer: sure
