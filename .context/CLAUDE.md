# Badger Grub Costeo — Project Context

Local web app to cost the Badger Grub menu: supplies, recipes with nested sub-recipes, and
sale products with margin per sales channel. Replaces the Excel costing templates. Inventory
is out of scope until after the roadmap. Personal use on `localhost`, no auth.

- Source spec (Spanish): [`../badger-costing-roadmap.md`](../badger-costing-roadmap.md)
- Milestones & task checklist: [`ROADMAP.md`](ROADMAP.md)
- Session log / current status: [`PROGRESS.md`](PROGRESS.md)
- Decisions (made and open): [`DECISIONS.md`](DECISIONS.md)

**At the start of every session:** read `PROGRESS.md` (where we are) and the current milestone
in `ROADMAP.md`. **At the end:** tick checkboxes in `ROADMAP.md` and append an entry to
`PROGRESS.md`.

## Stack

| Layer | Tool |
| --- | --- |
| API | FastAPI + Pydantic v2 (`backend/app`) |
| ORM / migrations | SQLModel + Alembic (SQLite batch mode) |
| DB | SQLite at `data/costeo.db` (gitignored) |
| Backend tooling | uv (Python 3.13), pytest, ruff |
| Frontend | React + Vite + TypeScript (`frontend/`) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Client data | TanStack Query + TanStack Table |
| Forms | React Hook Form + Zod |
| Shared types | `openapi-typescript` → `frontend/src/api/schema.d.ts` |
| Node | v22 (pinned in `.nvmrc`; the Makefile loads nvm automatically) |

## Commands (run from repo root)

| Command | What it does |
| --- | --- |
| `make install` | `uv sync` + `npm install` |
| `make dev` | API on :8000 + Vite on :5173 (Vite proxies `/api` → API) |
| `make test` | ruff + pytest + frontend typecheck, lint and vitest |
| `make migrate` | `alembic upgrade head` |
| `make migration m="msg"` | autogenerate a new Alembic revision |
| `make types` | dump OpenAPI from the app and regenerate TS types |
| `make backup` | timestamped copy of the DB into `data/backups/` (or `$BACKUP_DIR`) |

Always run `make test` and `make types` before calling a task done.

## Domain rules (non-negotiable)

1. Base units per supply: `g`, `ml`, `pz`. Everything converts to the supply's base unit.
   Cross-family conversions (pz ↔ g/ml) only via a defined `unit_equivalence`; otherwise raise
   a clear error.
2. Money uses `Decimal` end to end (`NUMERIC` in DB, strings in JSON). Round only for display.
3. Gross qty = net qty × (1 + waste%). **Cost uses gross qty** (the Excel template used net).
4. Costs are **never stored**: computed on read by walking the recipe tree.
5. Recipes must not form cycles; validate before saving.
6. Cost responses always include a per-item breakdown.
7. Channel margin: `price_ex_vat = pvp / (1 + vat)`; `margin = price_ex_vat − cost − fee`.
   Bank fee applies to direct sales; on platforms only the platform fee applies.
   `suggested_price = cost / target_food_cost% × (1 + vat)`.
8. **Always add or update tests in `tests/test_costing.py` when touching cost calculation.**

## Conventions

- **Code in English** — identifiers, table names, comments, commits, API paths.
- **UI labels in Spanish** — all user-visible text. Keep labels inline in components (no i18n lib).
- Money display: `₡ 1.234,50` via `formatCRC()` in `frontend/src/lib/format.ts`;
  numbers use `tabular-nums` and are right-aligned.
- Backend layout: `models/` (SQLModel tables), `schemas/` (API in/out), `routers/`,
  `services/` (`units.py`, `costing.py`). All routes are mounted under `/api`.
- Frontend layout: `api/` (client + generated types), `components/{ui,layout,tables}`,
  `pages/`, `theme/`.
- One branch per milestone (`m0-base`, `m1-supplies`, …); small commits per task.

## Visual guidelines

| Token | Color | Use |
| --- | --- | --- |
| `brand-black` | #1A1A1A | Sidebar, table headers, main text |
| `brand-burgundy` | #5B1E2D | Primary button, links, active tab, focus |
| `brand-craft` | #CBA97E | Soft borders, selected row (15–20%), category badges |
| `brand-gold` | #D4AF37 | Active menu indicator, highlighted KPI, suggested price |
| `surface` | #FAF7F2 | App background |
| `surface-card` | #FFFFFF | Tables and forms |
| `ok` / `warn` / `bad` | muted green / amber / red | Margin and cost-deviation alerts |

- **Contrast rule:** gold and craft are never text on white. Gold on black and burgundy on white are fine.
- Tokens live as CSS variables in `frontend/src/theme/tokens.css` and are mapped to Tailwind
  in `frontend/src/index.css` (`@theme inline`). Dark mode later = another variable set.
- Layout: fixed black sidebar (logo, Dashboard, Suministros, Recetas, Productos, Ajustes), top bar
  with search + "Nuevo" button, dense tables (40px rows, 14px base font, Inter).
