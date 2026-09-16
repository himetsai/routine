# AGENTS.md

Personal routine tracker for one user (Ray) at `routine.himetsai.com`. Sibling of the
`himetsai.com` site (Astro on Vercel) — separate repo, same vendors, same design tokens.

## Commands

```bash
npm run dev          # Astro dev server (--host) at localhost:4321
npm run build        # Production build → .vercel/output
npm run check        # astro check — type-checks .astro/.ts/.tsx (the only lint)
npm run test         # vitest run (engine + outbox tests)
npm run db:generate  # drizzle-kit generate — new migration from src/db/schema.ts
npm run db:migrate   # drizzle-kit migrate — apply migrations to DATABASE_URL
```

The machine's global npm (11.4.2) crashes on this dependency tree (`edgesOut` arborist
bug). Install with `npx -y npm@11.19.1 install` instead.

## Architecture

- **Astro 7** (`output: "static"`, Vercel adapter). The app is one React island on `/`;
  the API is Astro actions in `src/actions/`. Versions were chosen so that the Astro 5.x
  security advisories are fixed — don't downgrade to match the site.
- **`src/engine/`** — pure TypeScript, no DOM/DB. Every rule lives here and is tested.
  Derived data (day status, streaks, grades, heatmaps, milestones) is computed from an
  `Index` over a `Snapshot`; nothing derived is ever stored.
- **Tailwind 4**, tokens in `src/styles/global.css` `@theme` — copied from the site's
  `tailwind.config.mjs` (`background/primary/secondary/highlight`, `font-sans/display`,
  shadow scale). Light-only by decision. The site's animated Y2K backdrop is reduced to
  its static gradient. No site header/wordmark and no confetti — milestones are a toast
  plus a haptic.
- **Data**: Drizzle + `@libsql/client`. Local dev `DATABASE_URL=file:local.db`;
  production Turso (`himetsai-routine`, `aws-us-west-2`). Vercel region `sfo1`.

## Domain rules (see `src/engine/*.test.ts` for the executable version)

- Day = local `YYYY-MM-DD` computed on the device with a cutoff hour (default 4 am).
  Weeks are Monday–Sunday. One completion per routine per day. Backfill ≤ 7 days.
- Cadences: `daily` or `weekly` (N×/week, 1–6). A week is governed by the schedule in
  effect on its first day the routine existed; mid-week cadence changes apply next Monday.
- Events are append-only (`done|undone|skip|unskip`); latest by `loggedAt` wins.
  A mark beats a pause.
- Skips: 2 per routine per calendar month; a weekly skip lowers that week's target by 1;
  skips are excused from grades and bridge streaks.
- Pauses (per-routine or global, back-datable ≤ 7 days): days are not due; streak frozen.
  Weekly proration `round(N × activeDays / 7)`; 0 excludes the week.
- Grade: importance-weighted (light 1 / medium 2 / high 3) mean of per-routine
  `done/target`; A+ 100, A ≥90, B ≥80, C ≥70, D ≥60, F. Only completed weeks get letters.
- Streaks: `done` extends; skipped/paused/excluded bridge; missed/failed/impossible
  break; today/this week never breaks until it is over.
- Milestones: daily 7/30/100/365, weekly 4/12/26/52.

## Conventions

- Match the site's style: 2-space, double quotes, semicolons, compact code.
- Reads are public; writes require the passphrase session. Never expose write actions
  without `requireOwner`.
