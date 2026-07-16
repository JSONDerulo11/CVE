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

## Architectural decisions & why

### Fetch on the server, filter on the client

The data source is a static dummyjson `/c/` custom-response endpoint. Before designing around it, I probed it: `?severity=`, `?limit=`, `?skip=`, `?select=` and `?q=` all return **byte-identical responses** (same md5), and POST returns the same blob. It ignores every query parameter, so **filtering at the origin is impossible** — the only real question was where *we* filter.

The payload is 27 findings (~35 KB), fetched once by the server component. At that size, filtering in the browser is instant and search-as-you-type costs no round-trip. Server-side filtering through RSC was considered and rejected — it would add latency for nothing here.

That decision is not load-bearing, though: the pipeline is written as **pure functions in a server-safe module**, so a real paginated API could move the work back to the server without rewriting the UI. See [the nuqs section](#imported-from-nuqsserver-on-purpose).

### One client boundary

`page.tsx` stays an async server component. [`CveResults`](components/cve-results.tsx) is the only `"use client"` orchestrator: it reads URL state, runs the pipeline, and passes plain data down. Sort and pagination state deliberately do *not* live inside `CveTable` — that keeps the table presentational and reusable, and matches the design, where the "X of N" indicator sits outside the table card.

### One row per (CVE × product)

`mapCveReportToFindings` flattens the report: an entry listing three affected products becomes three rows. Users filter and search by product, so the product is what a row should represent. Severity is normalised to lowercase through a type guard, with an `n/a` fallback for unrecognised values, and `patchAvailable` is derived from whether the entry lists any patches.

### Literal tuples are the single source of truth

`SEVERITIES`, `PATCH_STATUSES` and `SORT_DIRECTIONS` in [lib/types.ts](lib/types.ts) are `as const` tuples. The TypeScript types derive from them via `(typeof X)[number]`, *and* the same tuples are handed to nuqs' `parseAsStringLiteral`. Types and accepted URL values therefore cannot drift apart, and adding a severity is a one-line change.

### Severity sorts by rank, not alphabetically

Alphabetical ordering would give critical, high, low, medium, n/a — nonsense for a severity column. A private `SEVERITY_RANK` (critical 0 → n/a 4) drives the comparison instead. `desc` means *most severe first* and is the default. `Array.prototype.sort` is stable, so rows of equal severity keep their existing order.

### Filter semantics, and faceted counts

An empty selection means "no constraint". Within a dimension the selections are OR'd (critical **or** high); across dimensions they are AND'd (critical **and** patch available). Search is a trimmed, case-insensitive substring match over the CVE ID, product and version.

The counts in the dropdowns are **faceted**: each facet is counted against the set filtered by every *other* facet, but not by itself (`computeFacetCounts`). That is what makes the numbers useful — with `Critical` already selected, the `High` count still shows how many rows ticking it would *add*, rather than collapsing to zero.

### Two distinct empty states

An empty table has two causes that deserve different answers, so `CveResults` tells them apart: an empty report ("No CVEs found") versus filters that match nothing ("No matching CVEs", with a **Clear filters** button). The distinction is cheap to make — with findings but no filters, the result set can't be empty, so `findings.length` alone separates the cases.

---

## Why nuqs

The short version: **the URL is the source of truth for view state**, and nuqs is what makes that ergonomic.

### Why use it at all

Every piece of view state in this app is something a user would reasonably want to share, bookmark or reload — a search, a severity filter, a page number. With `useState`, sending a colleague "the critical and high findings with no patch available" means sending a screenshot and a list of instructions, and a refresh throws the view away. With nuqs, `?severity=critical,high&patch=unavailable` *is* the view. Browser back and forward work for free, because state changes are history entries.

The full contract is `?q=<text>&severity=<list>&patch=<list>&dir=asc|desc&page=<n>`. Some URLs to paste in, against the current dataset:

| URL | What you get |
| --- | --- |
| `/` | All 27 findings, most severe first — `1 of 3` |
| `/?q=glib` | The 5 `glib` findings |
| `/?severity=critical,high&patch=unavailable&dir=asc` | The 6 unpatched critical/high findings, least severe first |
| `/?patch=unavailable&page=2` | Page 2 of the 17 unpatched findings — `2 of 2` |
| `/?severity=low` | The "No matching CVEs" empty state — `low` is a valid severity with no rows |

### It isn't in tension with client-side filtering

Worth stating plainly, since the two decisions look opposed: nuqs governs *where state lives*, not *where filtering happens*. `shallow: true` — set once, in the hook — means URL updates never notify the server. That is exactly right here, because the server component already fetched everything and the pipeline runs in memory. Every keystroke updates the URL at zero network cost.

### The parsers

From [lib/cve-filters.ts](lib/cve-filters.ts):

```ts
export const cveFilterParsers = {
  q: parseAsString.withDefault(""),
  severity: parseAsArrayOf(parseAsStringLiteral(SEVERITIES)).withDefault([]),
  patch: parseAsArrayOf(parseAsStringLiteral(PATCH_STATUSES)).withDefault([]),
  dir: parseAsStringLiteral(SORT_DIRECTIONS).withDefault("desc"),
  page: parseAsInteger.withDefault(1),
}
```

Three things this buys us:

- **`parseAsStringLiteral` fed the shared tuples** makes URL values both type-safe and validated. `?severity=banana` cannot produce an invalid state — it is rejected at the parser, not defended against in the components.
- **`parseAsArrayOf`** uses a comma separator by default, so multi-select reads well: `?severity=critical,high`.
- **`clearOnDefault`** (the v2 default) keeps defaults out of the URL, so the unfiltered view is a clean `/` rather than a URL full of empty parameters.

### Imported from `nuqs/server`, on purpose

[lib/cve-filters.ts](lib/cve-filters.ts) has no `"use client"` and imports only from `nuqs/server`, the server-safe entry point. Nothing requires that today — it is what keeps the seam open. Because the parsers and the pure pipeline stay importable from a server component, moving to server-side filtering later means adding `createSearchParamsCache` and flipping `shallow: false`, with no toolbar refactor.

### `useQueryStates`, not `useQueryState`

The whole hook is eight lines:

```ts
"use client"
import { useQueryStates } from "nuqs"
import { cveFilterParsers } from "@/lib/cve-filters"

export function useCveFilters() {
  return useQueryStates(cveFilterParsers, { shallow: true })
}
```

The plural form is the point. Changing any filter must also reset `page` back to 1 — otherwise you filter down to three results while the URL still claims `page=5`. `useQueryStates` writes both keys in **one atomic update**:

```ts
onChange={(severity) => setFilters({ severity, page: 1 })}
```

No `useEffect` syncing derived state, no double history entry, no frame where the user sees page 5 of a one-page list. Every mutation follows this pattern — search, dropdowns, chip removal and the sort toggle all write `page: 1` alongside their own key. Only page changes write `page` on its own.

The same API gives a clean reset — passing `null` clears a key back to its default, which is the entire **Clear filters** button:

```ts
setFilters({ q: null, severity: null, patch: null, page: null })
```

`dir` is deliberately absent there: a sort is not a filter, so clearing filters leaves the user's chosen ordering alone.

### No prop drilling

`CveResults` and `CveToolbar` each call `useCveFilters()` independently. Both read the same URL, which *is* the shared store — so there is no lifted state, no context provider, and no setter threaded through props. This is the ergonomic win that's easy to miss: URL state is global state that happens to be free.

### The cost: URL input is untrusted

`page` comes from the URL, so it can point anywhere. `CveResults` clamps it:

```ts
const page = Math.min(Math.max(filters.page, 1), pageCount)
```

A hand-pasted `?page=99` renders the last page instead of a blank table. Parsers guarantee type validity; they can't know that page 99 doesn't exist, so range checks stay the component's job.

### Setup

One wrapper, in [app/layout.tsx](app/layout.tsx):

```tsx
import { NuqsAdapter } from "nuqs/adapters/next/app"
// …
<NuqsAdapter>{children}</NuqsAdapter>
```

---

## shadcn/ui and the theme

### Configuration

Per [components.json](components.json): style `base-nova`, base colour `neutral`, icons from `lucide-react`, RSC enabled, and `@/*` path aliases.

### These are Base UI primitives, not Radix

**The most important thing to know before editing a component.** shadcn's `base-nova` style is built on [`@base-ui/react`](https://base-ui.com), not Radix. The APIs differ from the Radix-flavoured shadcn code that most people — and most LLMs — have memorised:

| Radix habit | What this codebase uses |
| --- | --- |
| `asChild` | `render={<Button />}` |
| `data-[state=open]` | `data-[popup-open]` |

[components/cve-filter-dropdown.tsx](components/cve-filter-dropdown.tsx) shows both. Check the actual primitive in [components/ui/](components/ui/) rather than assuming Radix conventions.

`components/ui/*` is treated as generated library code: compose and override via `className` and the `cn()` helper from [lib/utils.ts](lib/utils.ts) instead of editing those files in place. App-specific components live one level up.

### The theme

Tailwind v4, CSS-first — there is no `tailwind.config.js`. Design tokens are CSS custom properties in [app/globals.css](app/globals.css), mapped into Tailwind utilities via `@theme inline`. What was modified, and why:

**1. `.dark` was replaced wholesale.** Stock shadcn ships a neutral oklch greyscale. Every token here is a hex value taken from the design source (a Pencil file):

```css
--background: #181c1f;   --card: #19232a;
--primary: #95d1ff;      --border: #25475e;
```

That blue-tinted palette is what stops the app looking like default shadcn grey.

**2. `--severity-critical/high/medium/low` are additions.** They are not shadcn tokens. Mapping them through `@theme inline` as `--color-severity-*` is what turns them into real utilities like `text-severity-critical`:

```css
@theme inline {
  --color-severity-critical: var(--severity-critical);
  /* …high, medium, low */
}
```

This is the idiomatic v4 way to extend the palette, and it keeps domain semantics out of the generic `--destructive` token — a critical CVE and a destructive button are not the same concept, even when they are the same red.

**3. `--radius: 0.625rem`** (10px), with the rest of the scale derived multiplicatively from it (`--radius-lg` is the base). This matches the design source exactly, so prefer the existing radius and colour tokens over ad-hoc values when styling.

**4. Dark mode only.** `<html>` is hardcoded to `className="dark"` in [app/layout.tsx](app/layout.tsx); there is no toggle. `:root` still holds the stock light palette, so it is inert but intact — adding light mode would mean filling those values in, not restructuring anything.

**5. Fonts.** DM Sans → `--font-sans` and JetBrains Mono → `--font-mono`, loaded via `next/font/google`. Mono carries the data — CVE IDs, severity labels, counts — which is why it is a token rather than a one-off.

---

## Known gaps / what I'd do next

- **No tests.** The pipeline was written with this in mind: `filterFindings`, `sortFindings` and `paginate` are pure and dependency-free, so they are unit-testable without a DOM as soon as a runner is added. That is where I would start.
- **The page metadata is still `create-next-app` boilerplate** (`title: "Create Next App"` in [app/layout.tsx](app/layout.tsx)).
- **No loading or error states around the fetch.** If dummyjson is unreachable, the server component throws. A real deployment wants `error.tsx`, `loading.tsx` and an explicit cache strategy on the fetch.
- **The data source is a fixed dummy endpoint**, not the live NVD API. Swapping it in would mean revisiting the client-side filtering decision — which is exactly why the pipeline is server-safe.
- **A few arbitrary Tailwind values remain** in [components/cve-table.tsx](components/cve-table.tsx) (`text-[11px]`, `max-w-[220px]`) that should be promoted to tokens.
# CVE
