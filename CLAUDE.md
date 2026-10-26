# RINAMAS

Heavy-equipment hire site + admin for RINAMAS Equipment and Trading Enterprise (Accra). Spelling is RINAMAS with an I.

- Next.js 15 App Router, React 19, Prisma 6 on SQLite (dev) / Postgres (prod), Zod. No Tailwind: tokens and all styles in `src/app/globals.css`.
- Brand: JCB-to-Caterpillar yellow gradient accent (`--accent-grad`), steel dark bands, Big Shoulders Display + Barlow + IBM Plex Mono. Hazard hex badge logo in `public/brand/`.
- Data: `prisma/schema.prisma` (Machine, QuoteRequest). Seed in `prisma/seed.mjs`. Rates are GH₵ integers.
- Admin auth: single password (`ADMIN_PASSWORD`) with an HMAC cookie (`src/lib/auth.ts`). Server actions in `src/app/admin/actions.ts` must call the guard.
- Photos are CC-licensed Wikimedia Commons images; the credits list in `src/data/credits.json` must stay in the footer until they are replaced with RINAMAS's own photos.
- Monolith-first by design; major capabilities graduate to their own services when justified.
- Commands: `npm run dev`, `npm run db:push`, `npm run db:seed`, `npm run build`.
