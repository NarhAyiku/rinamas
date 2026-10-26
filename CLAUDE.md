# RINAMAS

Heavy-equipment hire site + admin for RINAMAS Equipment and Trading Enterprise (Accra). Spelling is RINAMAS with an I.

- Next.js 15 App Router, React 19, Prisma 6 on Postgres (local Homebrew postgresql@17 database `rinamas`; managed Postgres in prod), Zod. No Tailwind: tokens and all styles in `src/app/globals.css`.
- Brand: JCB-to-Caterpillar yellow gradient accent (`--accent-grad`), steel dark bands, Big Shoulders Display + Barlow + IBM Plex Mono. Hazard hex badge logo in `public/brand/`.
- Data: `prisma/schema.prisma` (Machine, QuoteRequest = one hire record per job, HourLog, Staff, ActivityLog). Seed in `prisma/seed.mjs`. Rates are GH₵ integers. Statuses: new → quoted → confirmed → on_hire → closed, plus lost (`src/lib/format.ts`).
- Auth: Staff accounts with scrypt password hashes, roles `admin` | `superadmin`, HMAC session cookie (`src/lib/auth.ts`). Every server action in `src/app/admin/actions.ts` calls `guard()` or `guardSuper()` and logs to ActivityLog via `logActivity` with a human-readable before→after summary. Keep that pattern for any new action.
- Screenshots for review: Chrome extension cannot open localhost here; use playwright-core with `channel: "chrome"` (dev dependency) against `next start`.
- Photos are CC-licensed Wikimedia Commons images; the credits list in `src/data/credits.json` must stay in the footer until they are replaced with RINAMAS's own photos.
- Monolith-first by design; major capabilities graduate to their own services when justified.
- Commands: `npm run dev`, `npm run db:push`, `npm run db:seed`, `npm run build`.
