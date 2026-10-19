# Roadmap — task checklist

Derived from [`../badger-costing-roadmap.md`](../badger-costing-roadmap.md). Each milestone is a
branch, ends with green `make test`, and a browser review by Sebas. M0–M3 = MVP gate.
M4 and M5 can go in any order after the gate.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## M0 — Project foundation (`m0-base`)

Repo, tooling and visual skeleton; no features yet.

**Done when:** `make dev` opens the app with working navigation and `make test` passes.

- [x] **M0.1 Repo setup** — git init, `.gitignore`, `.nvmrc`, `.context/` docs, root `CLAUDE.md`
- [x] **M0.2 Backend skeleton**
  - [x] uv project (`backend/pyproject.toml`), FastAPI, SQLModel, Alembic, pytest, ruff
  - [x] `app/main.py` with `/api` router, `app/config.py` (settings), `app/db.py` (engine, session dep)
  - [x] `GET /api/health` → `{status, version, database}` + test
  - [x] Alembic configured with SQLModel metadata, SQLite batch mode, baseline revision
- [x] **M0.3 Frontend skeleton**
  - [x] Vite + React + TS, Tailwind v4, shadcn/ui (`components.json`, `cn` util, base components)
  - [x] Badger Grub tokens (`theme/tokens.css`) mapped to Tailwind; Inter font
  - [x] Layout: black sidebar w/ gold active indicator, top bar (search + "Nuevo"), routed empty pages
  - [x] TanStack Query provider; API status indicator using `/api/health`
  - [x] `formatCRC()` / number helpers + vitest
- [x] **M0.4 Integration**
  - [x] Vite proxy `/api` → `:8000`
  - [x] `make types`: dump OpenAPI → `openapi-typescript` → `src/api/schema.d.ts`; typed fetch client
- [x] **M0.5 Makefile** — `install`, `dev`, `test`, `migrate`, `migration`, `types`, `backup`, `lint`, `format`
- [x] **M0.6 Verification** — `make test` green, `make dev` checked in the browser

## M1 — Supplies (`m1-supplies`)

Supply catalog with price history.

**Done when:** 30 real supplies loaded, change a price and see unit cost update.

- [x] **M1.1 Models + migration** — `supply`, `supply_price`, `unit_equivalence`; `settings` row
      for current-cost mode (latest vs avg of last 3)
- [x] **M1.2 Units service** — `services/units.py`: g↔kg, ml↔L, pz via equivalence; clear errors; tests
- [x] **M1.3 Supply cost** — current price (latest / avg-3), unit cost = price ÷ pack qty in base unit; tests
- [x] **M1.4 API** — CRUD supplies, filters (group, supplier, active), name search; prices
      sub-resource (list/add/delete); equivalences sub-resource; tests
- [x] **M1.5 Supplies table** — TanStack Table: name, brand, group, supplier, pack, cost/pack,
      unit cost, last update; filters + search; sortable
- [x] **M1.6 Supply form** — create/edit dialog (RHF + Zod), deactivate
- [x] **M1.7 Price history panel** — side sheet with history and "add price"
- [x] **M1.8 Excel import** — `scripts/import_supplies.py` for sheet "Base Datos Productos" (openpyxl), dry-run mode

## M2 — Recipes & costing engine (`m2-recipes`)

**Done when:** chipotle mayo uses homemade mayo as a sub-recipe, and changing the egg price changes both.

- [x] **M2.1 Models + migration** — `recipe`, `recipe_item` (type supply|recipe, ref_id, net qty, unit, waste%)
- [x] **M2.2 Tests first** — Pizza Margarita from the template; 3-level chain
      (homemade mayo → chipotle mayo → burger); cycle; missing equivalence; missing price
- [x] **M2.3 `costing.py`** — recursive cost, gross qty, per-item breakdown, cycle detection, per-request cache
- [x] **M2.4 API** — recipe CRUD (cycle check on save), `GET /recipes/{id}/cost`, `GET /recipes/{id}/usages`
- [x] **M2.5 Recipes list** — grouped by manual category (Bases, Salsas, Proteínas…)
- [x] **M2.6 Recipe editor** — dynamic rows, supply/sub-recipe combobox, live total / per-unit / per-portion cost
- [x] **M2.7 Extras** — safety margin per recipe (template's "Margen de seguridad"), ingredient options
      endpoint (allowed units, cycle-safe), supply/recipe delete guards (409 when used), "Se usa en"
      in the supply price sheet and recipe editor, unsaved-changes guard

## M3 — Products & pricing (`m3-products`)  · MVP gate

**Done when:** a burger with bun, protein, two sauces and packaging shows margin in direct sale
and Uber Eats, red when below threshold.

- [x] **M3.1 Settings** — model + API + Ajustes page: VAT, bank fee, platforms (name, %), thresholds,
      target food cost %, deviation range
- [x] **M3.2 Product model + migration** — recipe or direct items, packaging, PVP per channel, target cost
- [x] **M3.3 Pricing service** — price ex VAT, fee, margin, food cost %, suggested price; tests
- [x] **M3.4 Products API** — CRUD + pricing analysis endpoint
- [x] **M3.5 Price analysis table** — like "Análisis Coste Platos", alert badges by thresholds
- [x] **M3.6 Product detail** — expandable cost tree
- [x] **M3.7 Extras** — menu groups with per-group target food cost, platforms table (empty until
      used), cost deviation vs. theoretical cost, live product preview, accent-insensitive pickers,
      route error page, plain-notation decimals in all API responses

## M4 — Dashboard & backup (`m4-dashboard`)

**Done when:** opening the app shows which products need a price review.

- [ ] **M4.1 Dashboard** — products under margin threshold, supplies with largest recent increase,
      recipes with unpriced items
- [ ] **M4.2 Impact simulator** — "if cheese +10%, which products change and by how much"
- [ ] **M4.3 Export** — cost sheet PDF, tables CSV
- [ ] **M4.4 Backup** — backup button in Ajustes (reuses `make backup` logic), list/download backups

## M5 — Menu engineering & manual (`m5-menu`)

**Done when:** manual sauces exist as costed recipes without manual re-entry.

- [ ] **M5.1 Sales data** — units sold per period (manual entry or CSV)
- [ ] **M5.2 Classification** — Star / Plowhorse / Puzzle / Dog matrix
- [ ] **M5.3 Manual import** — parse recipe `.md` ingredient tables → `recipe_item`
- [ ] **M5.4 Write-back** — write computed cost into the "Costo aproximado" section of each `.md`

---

**After the roadmap:** inventory, min/max, purchase orders, waste (Inventario template).
