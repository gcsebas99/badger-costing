# Progress log

Newest first. Each entry: date, milestone/branch, what was done, what's next, gotchas.

## Current status

- **Milestone:** M5 partially complete on branch `m5-menu` (committed locally, not pushed): M5.1 sales
  data and M5.2 menu engineering done; **M5.3/M5.4 (recipe manual import/write-back) blocked** until
  Sebas shares sample manual `.md` files. M0–M4 are merged and pushed to `main`.
- **Next:** M5.3/M5.4 once the manual format is known; after the roadmap: inventory.
- **Setup for real use:** Ajustes → create menu groups (and platforms when used); bank fee is 0 % by
  default.
- **Remote:** `origin` = https://github.com/gcsebas99/badger-costing.git

---

## 2026-10-18 · M5 (part 1) — Menu engineering (`m5-menu`)

**Done**
- Migration `0005`: `sales_period` (name unique, date range), `sales_entry` (period, product, platform
  or direct, units) with RESTRICT on product/platform.
- Services: `menu_engineering.py` (template method per group, channel-weighted margins),
  `sales_import.py` (CSV with flexible headers/delimiters, accent-insensitive matching, unmatched
  report); `usages.sales_count` guards product/platform deletion.
- API: `/api/sales-periods` CRUD, `PUT /{id}/entries`, `POST /{id}/import`, `GET /{id}/menu-engineering`.
- Frontend: "Ingeniería de menú" section: period picker + new period dialog (current month
  defaults), Ventas grid (products × channels), CSV import, Análisis (2×2 matrix with advice + table).
- Tests reproduce the template's pizza group (8 dishes, 335 units) classifications.
- Verified in Chrome on the scratch DB: 3 burgers, units incl. Uber → clásica = Caballo (weighted
  margin ₡2.292,24), BBQ/doble = Puzzle.
- Tests: backend 135, frontend 33.

**Gotchas**
- Two consecutive `setSearchParams(fn)` calls overwrite each other → update params in one call.

---

## 2026-10-18 · M4 — Dashboard & backup (`m4-dashboard`)

**Done**
- Services: `dashboard.py` (KPIs, products to review with Spanish reasons, latest-vs-previous price
  increases, incomplete recipes/products, unpriced supplies), `simulation.py` (what-if via
  `supply_factors`), `csv_export.py`, `backup.py` (shared with `make backup`).
- API: `GET /api/dashboard`, `POST /api/simulate`, `GET /api/export/{suministros|recetas|productos}.csv`,
  `GET/POST /api/backups`, `GET /api/backups/{name}`.
- Frontend: real Dashboard (KPIs, products to review, price increases with "Impacto" links,
  incomplete costs); Simulador de impacto (`/simulador`, multi-supply, before/after cost and margins
  per channel, new suggested price, affected recipes); CSV buttons on Suministros/Recetas/Productos;
  printable "Ficha PDF" for recipes and products (sub-recipes expanded and scaled); Respaldos in Ajustes.
- Verified in Chrome on the scratch DB (backups to a scratch dir): dashboard flags the burger
  (Uber margin 36,2 %, +14,8 % vs. theoretical); beef +10 % → burger +₡106,43; ficha scaling sums
  match; backup created and listed; CSV headers/content correct.
- Tests: backend 124, frontend 33.

**Gotchas**
- The ficha first showed full sub-recipe batches under a 20 g line — now scaled by
  `base_quantity / batch yield`.
- `uv run uvicorn --reload` respawns its worker; stopping a background `make dev` may need killing
  the worker PID too.

---

## 2026-10-18 · M3 — Products & pricing (`m3-products`) · MVP gate

**Done**
- Migration `0004`: `menu_group`, `sales_platform`, `product`, `product_item` (item | packaging),
  `product_platform_price`; settings columns (VAT 13 %, bank fee 0 %, margin alert 40 %, target
  food cost 30 %, deviation +5 % / −10 %) with server defaults.
- Services: `product_cost.py` (recipe × portions + components + packaging), `pricing.py` (per-channel
  formulas, suggested price, deviation, alert levels), `product_pricing.py` (PricingContext loads
  settings/groups/platforms/costing once).
- API: `/api/settings` (extended), `/api/platforms`, `/api/menu-groups` CRUD; `/api/products` CRUD,
  list = analysis rows with channels, `/preview`; usages and delete guards include products.
- Frontend: Ajustes page (settings form, inline-editable menu groups and platforms); Productos
  analysis table (grouped by menu group, one row per channel, badges, suggested price, deviation,
  filters incl. "solo con alertas"); product editor (recipe picker, components, packaging, prices
  per channel, theoretical cost, live pricing panel with channel cards and expandable cost tree).
- Verified in Chrome on the scratch DB: burger (bun, beef, two mayos) + box → direct 62,2 % margin,
  test "Uber Eats 30 %" 37,7 % flagged red, +9,1 % deviation; analysis table matches.
- Tests: backend 113, frontend 33.

**Gotchas**
- `str(Decimal)` can produce "4.0E+3" (e.g. 4520 / 1.13) → crashed the formatter. Fixed in API
  serialization (D35) and the formatter now also accepts exponents.
- cmdk's default filter is accent-sensitive ("clasica" ≠ "clásica") → `commandFilter`.
- Editing router/deps can trigger a Vite full reload mid-interaction during browser checks.
- openapi-typescript marks fields with defaults as required in shared in/out schemas (e.g. platform
  `active`) — send them explicitly.

---

## 2026-10-18 · M2 — Recipes & costing engine (`m2-recipes`)

**Done**
- Models + migration `0003`: `recipe` (yield qty+unit, portions, category, is_subrecipe,
  safety_margin_rate) and `recipe_item` (supply_id | subrecipe_id + CHECK, net qty, unit, waste_rate,
  position).
- `services/costing.py`: `CostingContext` (loads everything once, memoizes), gross-quantity costing,
  sub-recipe recursion, per-item breakdown with status, nested sub-recipe tree, `check_no_cycle`,
  `draft_cost` for unsaved recipes, `contains_recipe`.
- Tests first: Masa de pizza matches the template exactly; Salsa Pomodoro / Pizza margarita match
  the template plus the gross-vs-net waste difference; 3-level chain mayo → chipotle mayo → burger;
  egg price change propagation; equivalence; missing price; bad units; cycles; preview.
- API: `/api/recipes` CRUD (items replaced on PATCH), `/preview`, `/{id}/cost`, `/{id}/usages`,
  `/facets`, `/ingredients`; `/api/supplies/{id}/usages`; 409 on deleting used supplies/recipes.
- Frontend: Recetas list grouped by category (filters, search, status badges); full-page editor
  with ingredient combobox (cmdk), allowed units per ingredient, waste %, gross qty, live per-row
  cost and share, cost summary (ingredients, margin, total, per kg, per portion, portion size),
  incomplete-cost warnings, "Se usa en", delete, unsaved-changes guard; "Se usa en" in supply sheet.
- Verified in Chrome on a scratch DB: built chipotle mayo from homemade mayo via the UI
  (₡744,50); egg price change moved both (₡1.039,01 → ₡1.061,51 and ₡744,50 → ₡755,75 with
  avg-of-2); cycle shown live; unsaved-changes dialog. No console errors.
- Tests: backend 89, frontend 26.

**Gotchas**
- `SQLModel.model_validate(dict)` reads relationships with `getattr` → a relationship named `items`
  picks up `dict.items`. Hence `Recipe.ingredients`.
- `useWatch({ control })` may return a new object every render; debounce a JSON snapshot instead.
- Test DB needs `PRAGMA foreign_keys=ON` too (conftest) or RESTRICT FKs aren't enforced.

---

## 2026-10-18 · M1 — Supplies (`m1-supplies`)

**Done**
- Models + migration `0002`: `supply` (pack qty + unit), `supply_price` (₡ per pack, date, supplier),
  `unit_equivalence` (1 pz = X g/ml), `app_settings` (single row, `cost_mode`).
- `services/units.py`: g↔kg, ml↔L, pz via equivalence, Spanish error messages, `parse_unit` aliases.
- `services/supply_cost.py`: avg of latest up-to-3 / latest; unit cost per base unit + reference
  cost per kg/L/pz.
- API: `/api/supplies` CRUD + `q` (accent-insensitive), `group`, `supplier`, `active` filters;
  `/facets`; `/{id}/prices` add/list/delete (each price flagged `in_effect`); equivalence inside
  the supply payload; `/api/settings` GET/PATCH.
- Importer: `services/supply_import.py` + `scripts/import_supplies.py` + `make import-supplies`.
  Dry run on the sample workbook: 24 rows importable, 3 skipped (2 sub-recipes, 1 missing pack).
- Frontend Suministros page: sortable TanStack v9 table (name, group, supplier, pack, pack cost,
  unit cost, last update), filters (group, supplier, status) in the URL, top bar search (debounced),
  create/edit dialog (RHF + Zod, equivalence, optional initial price), price history sheet (add /
  delete prices, "Vigente" badges, current cost), activate/deactivate, delete with confirmation, toasts.
- Tests: backend 55 (units, supply cost, API, importer, migration drift); frontend 17.
- Verified in Chrome against a scratch DB loaded with the sample workbook (not `data/costeo.db`):
  create with equivalence, add price with comma decimal (avg updated), search "oregano" → "Orégano",
  delete; no console errors.

**Gotchas**
- SQLModel's `UTCDateTime` requires tz-aware datetimes → `utcnow()` returns aware UTC.
- Pydantic: put `max_length` on the inner `str` of `str | None` (constraint on the union breaks None).
- Tailwind v4 `dark:` defaulted to the OS setting and made inputs beige → now class-based (D19).
- shadcn `AlertDialogAction` takes `variant`; a `className` bg override doesn't win.
- Controlled inputs bound straight to URL params drop keystrokes → keep local state + debounce.
- Claude-in-Chrome clicks by element ref don't open Radix menus (pointerdown); use coordinates.

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
