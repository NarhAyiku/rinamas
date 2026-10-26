# RINAMAS Equipment & Trading

Website and dispatch desk for RINAMAS Equipment and Trading Enterprise, a heavy-equipment hire business in Accra, Ghana.

## What it does

- Public site: fleet spec sheet with GH₵ rates, rate card, how hire works, coverage, FAQ.
- Quote request form: saved to the database with a reference number, then a one-tap WhatsApp handoff to dispatch.
- Dispatch desk at `/admin` for front-desk staff: triage requests, reply on WhatsApp, and keep one hire record per job the way Ghanaian plant-hire desks run it: quote and deposit, site agent, dispatch with hour-meter reading and condition, a daily hour and standby log signed off by the site agent, return with meter and condition, then close.
- Super admin (management) sees everything admins see, plus an activity log of every sign-in and change any staff member makes, and manages staff accounts.
- Customers can revisit their reference page (`/quote/<id>`) to see the job's progress.
- Installable as a PWA on phones (manifest, icons, light service worker); phones also get a sticky WhatsApp / Call / Quote bar.

## Run locally

```bash
cp .env.example .env     # then set ADMIN_PASSWORD and SESSION_SECRET
npm install
npm run db:push          # creates prisma/dev.db (SQLite)
npm run db:seed          # loads the 12 machine classes
npm run dev              # http://localhost:3000
```

Admin: http://localhost:3000/admin. The seed creates two accounts from `.env`: `ceo` (super admin, `SUPERADMIN_PASSWORD`) and `frontdesk` (admin, `ADMIN_PASSWORD`). Create more under Staff once signed in as the super admin.

## Deploy

Works on any Node host (Vercel, Railway, Render, a VPS). Set the env vars from `.env.example`. For production use Postgres: change `provider = "sqlite"` to `"postgresql"` in `prisma/schema.prisma`, set `DATABASE_URL`, then run `npx prisma db push` and `npm run db:seed` once.

## Stack

Next.js 15 (App Router, server actions), React 19, Prisma 6, SQLite locally / Postgres in production, Zod validation. No CSS framework: design tokens live in `src/app/globals.css`.

## Roles

| | Admin (front desk) | Super admin |
|---|---|---|
| Requests, hire records, hour logs | yes | yes |
| Fleet, rates, availability | yes | yes |
| Delete a machine | no | yes |
| Staff accounts, password resets | no | yes |
| Activity log | own actions are recorded | sees everything |

## Roadmap

- Paystack deposit on confirmed quotes (behind `ENABLE_PAYSTACK`), with signed webhooks and an idempotency table.
- SMS or WhatsApp Business API notification to dispatch on each new request.
- Customer photo uploads for site access.
