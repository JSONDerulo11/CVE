# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Package manager is **pnpm** (see `pnpm-workspace.yaml` / `pnpm-lock.yaml` — don't use npm/yarn).

- `pnpm dev` — start the dev server (Next.js + Turbopack), http://localhost:3000
- `pnpm build` — production build
- `pnpm start` — run a production build
- `pnpm lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- `pnpm exec tsc --noEmit` — type-check (there is no dedicated `typecheck` script)

There is no test framework configured in this repo yet.

## Architecture

Next.js 16 App Router, currently a single route (`app/page.tsx` + `app/layout.tsx` + `app/globals.css`). Fonts (DM Sans as `--font-sans`, JetBrains Mono as `--font-mono`) are loaded in `app/layout.tsx` via `next/font/google`. The `<html>` element is hardcoded to the `dark` class — this app is dark-mode-only right now, there is no light/dark toggle.

**Styling** is Tailwind CSS v4, CSS-first config (no `tailwind.config.js`). `app/globals.css` defines design tokens as CSS custom properties (`:root` / `.dark`) and maps them into Tailwind utilities via `@theme inline`. Beyond the standard shadcn tokens (`--background`, `--card`, `--border`, `--primary`, etc.), it also defines CVE-severity tokens — `--severity-critical/high/medium/low` — usable as `text-severity-critical` etc. `--radius-lg` equals the base `--radius` (10px), matching the design source (a Pencil file) exactly, so prefer the existing radius/color tokens over ad-hoc values when styling to match a design.

**UI components** use shadcn/ui, configured via `components.json`: style `base-nova`, base color `neutral`, icon library `lucide-react`. Primitives are built on **`@base-ui/react`, not Radix** — component APIs (e.g. `Button`) differ from the Radix-based shadcn code you may recall from training data; check the actual primitive's props/behavior in `components/ui/` rather than assuming Radix conventions. Path aliases (`@/components`, `@/components/ui`, `@/lib`, `@/hooks`) resolve via the `@/*` mapping in `tsconfig.json`.

- `components/ui/*` — generic shadcn primitives (`Button`, `Table`). Treat these as library/generated code: prefer composing/overriding via `className` (using the `cn()` helper from `lib/utils.ts`) rather than editing them directly.
- `components/*.tsx` (outside `ui/`) — app-specific components composed from those primitives, e.g. `cve-table.tsx`.
