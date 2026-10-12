# TODO / Parked Ideas

## Cloud Storage + Sync + Auth (parked)

**Goal:** Let users sign in and sync their data (history, settings, Brain Dump inbox, journal) across devices, and view/edit from a phone without rebuilding the app.

### Architecture
- **Backend:** Supabase (recommended) - Postgres + built-in auth + row-level security + generous free tier. Alternatives: Firebase (Firestore + Auth), or Cloudflare Workers + KV/D1 (cheapest, more DIY).
- **Auth:** Google OAuth as primary (via `chrome.identity.getAuthToken` / `launchWebAuthFlow`), magic-link email as fallback. Avoid passwords (support burden). Note: MV3 `chrome.identity` has OAuth client/redirect setup quirks - budget time.
- **Sync strategy:** Start with whole-document sync (store state as JSON blob(s) keyed by user id, debounced push, pull on load, newer-wins via `updatedAt`). Move to row-per-item merge later only if multi-device conflicts actually bite.
- **Local-first:** Keep `chrome.storage.local` working offline; sync is a background reconcile layered on top. Sync is additive - do not rip out current local storage.

### Critical details (don't skip)
- **Migration:** On first sign-in, UPLOAD existing local data to seed the account - never overwrite local with empty cloud state. Getting this wrong wipes users' history.
- **Security:** Enforce per-user data isolation at the datastore layer (Supabase RLS / Firestore rules), never client-side only.
- **Privacy:** This moves away from the all-local model. Update Chrome Web Store privacy disclosures + privacy policy (Google requires accurate data-use disclosure). Make sign-in/sync explicitly opt-in so privacy-conscious users stay fully local.
- **Tokens:** Store auth tokens appropriately; never log/expose them.

### Phone access
- Once auth + hosted datastore exist, build a small static PWA ("Add to Home Screen") hitting the same backend with the same login. Reuses the data layer + auth - one lightweight read/edit page, not a rebuilt app. This solves the "see it from my phone" need.

## Monetization (parked - do AFTER sync ships)

**Framing:** At ~1000 WAU (mostly students), monetization is for sustainability (cover cloud costs + fund dev time), not profit. Expect low single-digit % conversion → ~10–30 payers.

### Recommended model
- **Freemium:** Keep ALL current features free forever (don't paywall what the 1000 existing users already have - causes backlash). Make the NEW cloud sync + multi-device + phone access the paid Pro tier. Payers fund the thing that actually costs money (the server).
- **Tip jar:** Lean into the existing Buy Me a Coffee widget immediately - free money, no gating risk.
- Consider a one-time "lifetime" unlock as an alternative to subscription (students dislike recurring charges), but weigh recurring server costs vs one-time revenue.

### Pricing suggestion
- Free tier: all current features, local-only.
- Pro: ~$2–3/month or ~$15–20/year (annual discounted to push yearly). Covers sync, multi-device, phone.
- Add a student discount / occasional free codes for goodwill.

### Billing mechanics
- Use a merchant-of-record (Lemon Squeezy or Paddle) over raw Stripe - they handle global sales tax/VAT (users are international students, dev is solo). Gumroad for one-time unlocks.

### Sequencing (recommended order)
1. Build cloud sync + auth as an opt-in, FREE beta for all users. Stabilize, fix migration edge cases, prove multi-device + phone PWA get used.
2. Watch adoption to confirm sync is a real paid-worthy feature (evidence, not a bet).
3. Then introduce Pro pricing for sync; keep current local features free. Add the tip jar right away.

### Open follow-ups when picked up
- Sketch Supabase schema + RLS rules.
- Map the `chrome.identity` Google sign-in flow for MV3.
- Design the first-sign-in local→cloud migration/merge.
- Draft the free-vs-Pro feature split.
- Pull current free-tier limits/pricing for Supabase / Firebase / Lemon Squeezy before deciding.
