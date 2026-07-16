# cve-cli

A CVE findings explorer — a searchable, filterable, sortable and paginated table of vulnerability data, with the entire view state living in the URL.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui and [nuqs](https://nuqs.dev).

---

## Setup

**Prerequisites:** Node 20+ and [pnpm](https://pnpm.io). The repo is pnpm-only — it has a `pnpm-lock.yaml` and a `pnpm-workspace.yaml`, so installing with npm or yarn will drift the lockfile.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**There is no `.env` and there are no API keys.** The only runtime requirement is outbound network access to `dummyjson.com`, which is fetched when the page renders.

### Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server (Next.js + Turbopack) on port 3000 |
| `pnpm build` | Production build |
| `pnpm start` | Serve a production build |
| `pnpm lint` | ESLint (flat config, `eslint-config-next`) |
| `pnpm exec tsc --noEmit` | Type-check — there is deliberately no `typecheck` script |

No test framework is configured yet. See [Known gaps](#known-gaps--what-id-do-next).

---

## Architecture at a glance

```
app/page.tsx  (React Server Component)  ──fetch──▶  dummyjson endpoint
      │
      │  mapCveReportToFindings()                   lib/cve.ts
      ▼
CveResults  ("use client")                          components/cve-results.tsx
      │
      │  useCveFilters()  ◀────── URL  ?q=&severity=&patch=&dir=&page=
      ▼
filterFindings → sortFindings → paginate            lib/cve-filters.ts  (pure, server-safe)
      ▼
CveToolbar · CveTable · CvePagination
```

| Path | Responsibility |
| --- | --- |
| [app/page.tsx](app/page.tsx) | Server component: fetches the report, maps it to findings |
| [app/layout.tsx](app/layout.tsx) | Fonts, dark class, `<NuqsAdapter>` |
| [lib/types.ts](lib/types.ts) | Literal tuples → the app's types |
| [lib/cve.ts](lib/cve.ts) | Raw API shape → `CveFinding` |
| [lib/cve-filters.ts](lib/cve-filters.ts) | URL parsers + the pure filter/sort/paginate pipeline |
| [lib/use-cve-filters.ts](lib/use-cve-filters.ts) | The one hook that reads and writes URL state |
| [components/](components/) | App components (toolbar, table, pagination, chips…) |
| [components/ui/](components/ui/) | shadcn primitives — treated as generated code |

---