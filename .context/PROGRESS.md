# Progress log

Newest first. Each entry: date, milestone/branch, what was done, what's next, gotchas.

## Current status

- **Milestone:** M0 complete on branch `m0-base` — awaiting Sebas's browser review before merge to `main`.
- **Next:** M1 — Supplies (branch `m1-supplies`). Current cost rule decided: avg of last up to 3 prices (D11).
- **Remote:** `origin` = https://github.com/gcsebas99/badger-costing.git

---

## 2026-10-18 · M0 — Project foundation (`m0-base`)

**Done**
- Planning: `.context/` (CLAUDE.md, ROADMAP.md, PROGRESS.md, DECISIONS.md), root `CLAUDE.md` imports it.
- Backend: uv project (Python 3.13), FastAPI app with `/api` router, `GET /api/health`
  (checks DB), settings via `COSTEO_*` env vars, SQLite engine with FK pragma, `SessionDep`,
  Alembic (SQLModel metadata, batch mode, baseline rev `0001`), pytest + ruff.
- Scripts: `scripts/export_openapi.py`, `scripts/backup.py` (SQLite online backup API).
- Frontend: Vite 8 + React 19 + TS 5.9, Tailwind v4, shadcn/ui (button, input, badge, table,
  tooltip, separator), brand tokens in `theme/tokens.css`, layout (black sidebar with gold active
  indicator, top bar with search + per-page "Nuevo" button — disabled for now), routed empty
  pages, TanStack Query, typed `openapi-fetch` client, API status indicator, `formatCRC` /
  `formatNumber` / `formatPercent` with string-based half-up rounding (vitest).
- Badge variants `ok` / `warn` / `bad` / `craft`; table styled with black header and 40px rows.
- Dashboard has a "Vista previa de estilos" sample table (fake data) for visual review — replace in M4.
- Makefile: `install`, `dev`, `test`, `migrate`, `migration`, `types`, `backup`, `lint`, `format`.
- Verified: `make test` green (2 pytest, 7 vitest, ruff, tsc, oxlint); `make dev` serves the app,
  proxy `/api/health` OK, navigation works in Chrome, no console errors; `make backup` OK.

**Gotchas**
- System Node is v14; Makefile sources nvm and uses `.nvmrc` (22). Run npm manually with `nvm use`.
- Vite falls back to the next free port if 5173 is busy (other local projects use 5173–5176).
- shadcn CLI writes `import { cn } from "cn"` in new components — fix to `@/lib/utils` after `shadcn add`.
- `src/components/ui/**` is excluded from oxlint (vendored shadcn code).
