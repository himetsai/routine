# routine

Personal routine tracker at `routine.himetsai.com`: check things off, keep streaks,
grade the week, watch the heatmap fill in. Reads are public; writes need the passphrase.

Architecture, domain rules and conventions live in [AGENTS.md](./AGENTS.md).

## Local development

```bash
npx -y npm@11.19.1 install      # the machine's global npm 11.4.2 crashes on this tree
cp .env.example .env            # then fill in ROUTINE_PASSPHRASE and SESSION_SECRET
npm run db:migrate              # creates local.db
npm run dev                     # http://localhost:4321
npm test && npm run check       # engine + outbox tests; type-check
```

`local.db` is a plain SQLite file — open it straight from a notebook.

## First deployment

One-time, account-side steps. Everything the code needs is an environment variable.

1. **Turso** — create the database and a token (dashboard, or `brew install tursodatabase/tap/turso`):
   ```bash
   turso db create himetsai-routine --location aws-us-west-2
   turso db show himetsai-routine --url        # → DATABASE_URL (libsql://…)
   turso db tokens create himetsai-routine     # → DATABASE_AUTH_TOKEN
   ```
   Apply the schema from this machine:
   ```bash
   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run db:migrate
   ```
   Re-run that command whenever a new file appears in `drizzle/`.

2. **Secrets** — generate two long random strings:
   ```bash
   openssl rand -hex 32   # SESSION_SECRET
   openssl rand -hex 24   # ROUTINE_PASSPHRASE (or any long passphrase you can type once a year)
   ```

3. **GitHub** — create the private repo `himetsai/routine` and push `main`.

4. **Vercel** — *Add New Project* → import `himetsai/routine`. Framework: Astro (auto-detected).
   Environment variables: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `ROUTINE_PASSPHRASE`, `SESSION_SECRET`.
   Function region is pinned to `sfo1` by `vercel.json`. Deploy.

5. **Domain** — Vercel project → *Settings → Domains* → add `routine.himetsai.com`.
   At Porkbun, add a DNS record for `himetsai.com`: type `CNAME`, host `routine`,
   answer `cname.vercel-dns.com`. Nameservers do not change. Vercel issues the certificate.

6. **Phone** — open `https://routine.himetsai.com` in Safari → Share → *Add to Home Screen*.
   Sign in once; the session lasts a year. Tap a check: the haptic comes from the
   native switch under your finger.

## Later

- Schema change: edit `src/db/schema.ts` → `npm run db:generate` → commit `drizzle/` →
  run `db:migrate` against Turso before or right after deploying.
- Export from *settings*: `daily status (.csv)` is one row per routine per day.
- Full dump: `turso db shell himetsai-routine .dump > routine.sql`.
