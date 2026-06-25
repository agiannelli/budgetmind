# BudgetMind

An anticipatory personal finance assistant — *YNAB's intentionality without YNAB's
bookkeeping.* It learns your rhythm, anticipates lumpy months (taxes, vests, payoffs),
and does the "where do I pull this from?" reconciliation for you. Its north star:
**falling off the wagon costs you nothing.**

The full product spec and phased roadmap are maintained separately, outside this repo.

## Stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (radix base)
- **Supabase** (Postgres) · **Auth0** — wired in PR 2
- **Anthropic / Claude** for categorization, check-ins, and profile learning
- Deployed on **Vercel**

## Requirements

- **Node 22+** and **pnpm 11+** (`packageManager` is pinned in `package.json`)

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to the dashboard.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Lint with ESLint |

## Status

**Phase 1 — supervised brain (in progress).** PR 1 (base scaffold) is live: app shell,
design tokens, empty dashboard. Auth, data model, ingest, and the assistant's intelligence
land in subsequent PRs. The database schema lives in
[supabase/migrations/](supabase/migrations/).
