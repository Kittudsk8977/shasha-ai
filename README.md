# SHASHA-AI — Backend Scaffold

This is a **working architectural skeleton**, not a finished product. Every
pattern the original spec called out as critical is implemented for real;
every place that needs a paid third-party account (AI models, payments,
storage) is a clearly marked stub you swap in.

## What's real here

- **Prisma schema** (`prisma/schema.prisma`) — the full data model: users,
  credits, subscriptions, plans, coupons, AI providers, generation jobs,
  projects, media, API keys, abuse flags. This is the source of truth for
  the whole system.
- **Server-side credit system** (`src/lib/credits.ts`) — atomic
  reserve-then-refund logic using a DB transaction, so two concurrent
  requests can never overdraw a balance, and a failed generation always
  refunds automatically. The frontend never calculates or sends a credit
  amount — it sends a `toolKey` and the server looks up the price itself,
  from the `GenerationCost` table (admin-editable, not hard-coded).
- **Multi-provider AI abstraction** (`src/lib/ai/`) — `providerRegistry.ts`
  picks the highest-priority *enabled* provider from the database, retries,
  and falls back to the next one on failure. Two template adapters
  (`mockImageProvider.ts`, `mockVideoProvider.ts`) show the exact shape a
  real adapter takes — swap the body of `generate()` for a real API call
  and nothing else in the app changes.
- **The full generate → job → refund flow** end to end in
  `src/app/api/v1/image/generate/route.ts`: auth check → rate limit →
  moderation → reserve credits → create job → call provider → refund on
  failure / mark complete on success. `video` and `voice` routes follow
  the same pattern.
- **Job polling** (`src/app/api/v1/jobs/[id]/route.ts`) — the frontend is
  expected to poll this, never assume a generation succeeded synchronously.
- **Payment webhooks** (`src/app/api/webhooks/`) — Razorpay and Stripe,
  both with signature verification. Client-side payment confirmation is
  never trusted; a subscription only becomes ACTIVE when the signed
  webhook says so.
- **Auth scaffold** (`src/lib/auth.ts`) — NextAuth with email/password +
  Google OAuth, password hashing, signup bonus credits, referral code
  generation, and an unverified-by-default account status.

## What you need to add before this runs

1. **A Postgres database** — set `DATABASE_URL` in `.env`, then:
   ```
   npm install
   npx prisma migrate dev --name init
   npx prisma db seed
   ```
2. **Real AI provider keys** — pick your image/video/voice/music vendors,
   add their keys to `.env`, write an adapter per `src/lib/ai/types.ts`
   (copy `mockImageProvider.ts` as a template), and register it in
   `providerRegistry.ts`. Then add a matching row to the `AiProvider`
   table (via `prisma studio` or the admin API) with `isEnabled: true`.
3. **Object storage** — an S3-compatible bucket (S3, R2, etc.) for
   generated media. Nothing currently uploads real bytes; the mock
   adapters return placeholder storage keys.
4. **Payment accounts** — a Razorpay account (India) and/or Stripe account
   (international), plus their webhook secrets.
5. **`getServerAuthUser`** in `src/lib/auth.ts` is a TODO stub — wire it to
   `getServerSession(authOptions)` plus API-key header resolution once
   you've decided on session strategy.
6. **A background job runner** for anything that can't finish inside one
   HTTP request (long video renders) — e.g. a queue (BullMQ + Redis) or
   cron-based poller that updates `GenerationJob.status` when the
   provider reports completion.

## What this scaffold deliberately leaves out

The admin dashboard UI, the browser-based image/video editor, the
in-app credit-purchase checkout UI, and the marketing site are not code
here — they're either separate UI work (see the published SHASHA-AI
landing page) or genuinely large enough to be their own follow-up.

## Directory guide

```
prisma/schema.prisma        full data model
prisma/seed.ts               default plans + generation costs
src/lib/credits.ts           the only file allowed to touch creditBalance
src/lib/ai/                  provider abstraction + template adapters
src/lib/auth.ts              NextAuth config + user creation
src/lib/moderation.ts        swappable content moderation
src/lib/rateLimit.ts         Upstash-based rate limiting
src/app/api/v1/...           generation endpoints (image/video/voice)
src/app/api/webhooks/...     Razorpay + Stripe, signature-verified
src/app/api/admin/providers  admin CRUD for AI provider config
```
