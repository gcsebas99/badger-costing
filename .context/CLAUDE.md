# Badger Grub Costeo — Project Context

Local web app to cost the Badger Grub menu: supplies, recipes with nested sub-recipes, and
sale products with margin per sales channel. Replaces the Excel costing templates. Inventory
is out of scope until after the roadmap. Personal use on `localhost`, no auth.

- Source spec (Spanish): [`../badger-costing-roadmap.md`](../badger-costing-roadmap.md)
- Milestones & task checklist: [`ROADMAP.md`](ROADMAP.md)
- Improvements after the roadmap: [`ROADMAP-IMPROVEMENTS-1.md`](ROADMAP-IMPROVEMENTS-1.md) (kitchen tools for Recetas)
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
| `make import-supplies file=x.xlsx [args=--dry-run]` | import the template's "Base Datos Productos" sheet |

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
7. Channel margin: `price_ex_vat = pvp / (1 + vat)`; `fee = pvp × rate`;
   `margin = price_ex_vat − cost − fee`. Bank fee applies to direct sales; on platforms only the
   platform fee applies. `suggested_price = cost / target_food_cost% × (1 + vat)`; target food cost
   comes from the product's menu group, else the global default (`services/pricing.py`).
8. Recipe total = ingredients + optional safety margin (`safety_margin_rate`); a sub-recipe's cost
   per unit includes its margin. Missing price / bad unit → item flagged, recipe `complete=false`.
9. Current supply cost = average of the latest up-to-3 prices (1 → that price, 2 → avg of 2), or
   latest only, per the `cost_mode` setting (`services/supply_cost.py`).
10. **Always add or update tests in `tests/test_costing.py` / `tests/test_supply_cost.py` when touching
   cost calculation.**

## Conventions

- **Code in English** — identifiers, table names, comments, commits, API paths.
- **UI labels in Spanish** — all user-visible text. Keep labels inline in components (no i18n lib).
- Money display: `₡ 1.234,50` via `formatCRC()` in `frontend/src/lib/format.ts`;
  numbers use `tabular-nums` and are right-aligned.
- Backend layout: `models/` (SQLModel tables), `schemas/` (API in/out), `routers/`,
  `services/` (`units.py`, `supply_cost.py`, `costing.py`). All routes are mounted under `/api`.
- API schemas: never annotate outputs with bare `Decimal`; use `DecimalOut` / `PositiveDecimal` /
  `NonNegativeDecimal` from `schemas/common.py` (plain-notation serialization).
- DB columns: money/quantities use `DecimalText` (exact TEXT), enums use `value_enum()`. After
  model changes run `make migration m="..."`; `tests/test_migrations.py` fails on drift.
- API `detail` error messages are Spanish (shown in toasts); everything else in code is English.
- Sebas may have `make dev` running on the **real DB** (:8000 / :5173). Never send writes to :8000 from
  scripts; run scratch servers on other ports (API :8010, Vite :5190 with `VITE_API_TARGET`).
- `samples_xlsx/` holds **sample** spreadsheets only (gitignored) — never load them into
  `data/costeo.db`. For visual checks use a scratch DB: `COSTEO_DATABASE_URL=sqlite:////tmp/x.db COSTEO_BACKUP_DIR=/tmp/b make dev`.
- Frontend layout: `api/` (typed client + TanStack Query hooks per resource), `components/{ui,layout,
  tables,forms}`, `pages/<area>/`, `theme/`, `lib/` (format, units).
- Tables use TanStack Table **v9** (`useTable` + `tableFeatureSet` in `components/tables/features.ts`).
- Page URL state: top bar search → `?q=`, "Nuevo" button → `?nuevo=1` (page opens its form).
- Forms: React Hook Form + Zod; numeric inputs accept `1,36` or `1.36` (`parseDecimalInput`); loaded
  values use `toDecimalInput`. Percent inputs ↔ API rates via `percentInputToRate` / `rateToPercentInput`.
- Full-page editors live at `/<area>/nueva|nuevo` and `/<area>/:id`; "Nuevo" uses `NavItem.newPath`.
  Printable sheets at `/<area>/:id/ficha` (outside the layout). Hidden routes use `NavItem.hidden`.
- Kitchen sheet `/recetas/:id/cocina?factor=` or `?ingrediente=&cantidad=&unidad=` (no prices;
  `pages/recipes/kitchenScale.ts`). `components/PrintPreviewDialog.tsx` previews any sheet in an iframe
  (`?embed=1`) and prints it; recipe editor buttons live in `pages/recipes/KitchenTools.tsx`.
- Menu engineering: `/api/sales-periods` (+ `/entries`, `/import`, `/menu-engineering`), page `/menu`.
- Dashboard data: `GET /api/dashboard`; what-if: `POST /api/simulate`; CSV: `/api/export/{kind}.csv`;
  backups: `/api/backups`.
- Recipe steps: `recipe_step` → `steps: list[str]` on recipe create/update/detail. Batch scaling:
  `GET /api/recipes/{id}/scaled` (`factor` or `anchor_item_id`+`anchor_qty`+`anchor_unit`), `services/scaling.py`.
- Editors' live cost: debounced form snapshot → `POST /api/recipes/preview` / `/api/products/preview`.
- Comboboxes (cmdk) use `commandFilter` (accent-insensitive). Shared row editor:
  `components/forms/IngredientRows.tsx` + `ingredientRow.ts`.
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
