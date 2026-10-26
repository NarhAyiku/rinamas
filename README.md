# RINAMAS Equipment & Trading

Website and dispatch desk for RINAMAS Equipment and Trading Enterprise, a heavy-equipment hire business in Accra, Ghana.

## What it does

- Public site: fleet spec sheet with GH₵ rates, rate card, how hire works, coverage, FAQ.
- Quote request form: saved to the database with a reference number, then a one-tap WhatsApp handoff to dispatch.
- Admin at `/admin`: see and triage requests (new → quoted → confirmed → closed), reply on WhatsApp, and edit the fleet, rates, specs and availability. Fleet changes show on the public site at once.

## Run locally

```bash
cp .env.example .env     # then set ADMIN_PASSWORD and SESSION_SECRET
npm install
npm run db:push          # creates prisma/dev.db (SQLite)
npm run db:seed          # loads the 12 machine classes
npm run dev              # http://localhost:3000
```

Admin: http://localhost:3000/admin with the password from `.env`.

## Deploy

Works on any Node host (Vercel, Railway, Render, a VPS). Set the env vars from `.env.example`. For production use Postgres: change `provider = "sqlite"` to `"postgresql"` in `prisma/schema.prisma`, set `DATABASE_URL`, then run `npx prisma db push` and `npm run db:seed` once.

## Stack

Next.js 15 (App Router, server actions), React 19, Prisma 6, SQLite locally / Postgres in production, Zod validation. No CSS framework: design tokens live in `src/app/globals.css`.

## Roadmap

- Paystack deposit on confirmed quotes (behind `ENABLE_PAYSTACK`), with signed webhooks and an idempotency table.
- SMS or WhatsApp Business API notification to dispatch on each new request.
- Customer photo uploads for site access.
