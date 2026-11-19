# Improvements 4 — Session closing ("Cierres")

Follow-up to the main roadmap ([`ROADMAP.md`](ROADMAP.md)). New section "Cierres", below "Planeación":
record what a sales session really sold and spent, and get income, costs and net profit.
Unlike Planeación, closings **are stored** (the latest N, default 5).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

**Status:** 🚧 in progress on `imp4-closing` (branched from `imp3-week-prep`, which isn't merged yet). C1 done.

Each block ends with `make test` and `make types` passing; the frontend blocks add a browser check
against a scratch DB.

---

## Requested feature (from Sebas, 2026-11-19)

Sebas matches the cafeteria POS against the badgergrub.com report (pre-orders + last-minute orders), so
for each session he knows the billed total and the combos and drinks actually sold. He needs:

1. Enter the units sold per product by hand (CSV import can come in a second version).
2. Enter hours and hourly rate per collaborator (each one can charge a different rate).
3. A dynamic list of related expenses not costed inside products (frying oil, electricity, water…):
   name + amount. Names are saved for reuse, and new ones can be added on the fly.
4. Enter the billed amount of the session.
5. A report: income + expenses + net profit.
6. Export to PDF; keep at least the latest 5 reports, the oldest one is discarded when a new one is added.

Answers (2026-11-19):
- **Costs are frozen when the closing is closed**; while it's a draft they're computed live (D66).
- **Billed amount** comes with two fields, IVA and bank fee, both default 0 (D67).
- **A session is a date range** (start–end) plus a name.
- **Retention:** setting "Cierres a conservar", default 5 (D69).

## Calculation rules

1. **Net income** = billed − IVA − bank fee. IVA and bank fee are **amounts in ₡** typed by Sebas
   (default 0); the UI shows a hint with the amounts the Ajustes rates would give
   (`billed − billed / (1 + vat)`, `billed × bank_fee_rate`) and a button to use them.
2. **Product cost** = Σ units × product unit cost (recipe portions + direct components + packaging, same
   engine as Productos). Shown per product, with food and packaging split.
3. **Labor** = Σ hours × hourly rate. Hours accept decimals (`7,5`).
4. **Other expenses** = Σ amounts.
5. **Total expenses** = product cost + labor + other expenses.
6. **Net profit** = net income − total expenses; **net margin %** = net profit / net income.
7. **Ratios** (over net income): food cost %, labor %, prime cost % (product + labor), other expenses %.
8. **Expected billing** = Σ units × product's direct PVP. The report shows the **difference** with the
   billed amount (discounts, courtesies, matching errors). Products without a direct price are excluded
   from it and listed.
9. A product with an incomplete cost (missing price, bad unit) is flagged and the report is marked
   "Costo incompleto"; closing is allowed after a confirmation (D68).
10. Money is `Decimal` end to end; rounding only for display.

## Data model

| Table | Columns |
| --- | --- |
| `collaborator` | name (unique), default `hourly_rate`, active |
| `expense_type` | name (unique), active |
| `closing` | name, start_date, end_date, status (`draft` / `closed`), billed_amount, vat_amount, bank_fee_amount, notes, closed_at, created_at |
| `closing_product` | closing_id (CASCADE), product_id (RESTRICT), units; snapshot: `unit_cost`, `food_cost`, `packaging_cost`, `unit_price`, `cost_complete` (null while draft) |
| `closing_labor` | closing_id (CASCADE), collaborator_id (SET NULL), name snapshot, hours, hourly_rate |
| `closing_expense` | closing_id (CASCADE), expense_type_id (SET NULL), name snapshot, amount |
| `app_settings` | + `closings_to_keep` (int, default 5, min 1) |

Rates and amounts are stored per line, so changing a collaborator's default rate never changes an old
closing. The name snapshot keeps the report readable if a collaborator or expense type is renamed or
deleted.

## C1 — Backend

- [x] **C1.1 Models + migration**: tables above; `closings_to_keep` in settings.
- [x] **C1.2 Catalogs**: `/api/collaborators` and `/api/expense-types` CRUD (list with `active` filter,
      409 on duplicate name, Spanish `detail`).
- [x] **C1.3 `services/closing.py`**: `closing_report(ctx, closing)` → income, product lines, labor,
      expenses, totals, ratios, expected billing and warnings. Draft → live costs; closed → snapshot.
- [x] **C1.4 `/api/closings`**: list (summary with net profit), create, get detail + report, PUT (full payload,
      lines replaced; 409 when closed), delete, `POST /preview` (unsaved form → report),
      `POST /{id}/close` (writes the snapshot), `POST /{id}/reopen` (drops the snapshot, back to live).
- [x] **C1.5 Retention**: on create, if there are already `closings_to_keep`, delete the oldest by
      `end_date` (then `created_at`) in the same transaction. `GET /api/closings/retention` tells the UI
      which one would go, to warn before creating.
- [x] **C1.6 Tests** in `tests/test_closing.py`: income math, labor, expenses, ratios, expected billing,
      incomplete cost, snapshot frozen after a supply price change, reopen goes live again, retention,
      catalog SET NULL keeps names. Touches cost → also a case in `tests/test_costing.py` if
      `product_cost` changes.

## C2 — Page `/cierres`

- [ ] **C2.1 Navigation**: sidebar item "Cierres" below "Planeación"; "Nuevo" → `/cierres/nuevo`.
- [ ] **C2.2 List**: table of the stored closings (name, dates, facturado, ganancia neta, margen, estado
      badge), plus a note "Se conservan los últimos N cierres".
- [ ] **C2.3 Editor** `/cierres/nuevo` and `/cierres/:id` (full page, RHF + Zod, unsaved-changes guard):
      - Session: name, start date, end date, notes.
      - Ingresos: facturado, IVA, comisión bancaria (with the "usar tasas de Ajustes" hint).
      - Productos vendidos: rows of product (active only, no repeats) + units, using `IngredientRows`-style
        combobox; per-row unit cost and subtotal.
      - Colaboradores: combobox with "Crear «…»" option; rate prefilled from the default, editable; hours.
      - Otros gastos: combobox with "Crear «…»"; amount prefilled with the last amount used for that type.
      - Live summary panel via debounced `POST /api/closings/preview`.
      - Buttons: Guardar, Cerrar cierre (confirmation, extra warning if cost incomplete), Reabrir,
        Eliminar. A closed closing is read-only.
      - Creating when the limit is reached shows which closing will be deleted before saving.
- [ ] **C2.4 Catalogs in Ajustes**: collaborators (name, default rate, active) and expense types
      (name, active); "Cierres a conservar" setting.
- [ ] **C2.5 Tests** (vitest): form validation, percent/decimal parsing, preview payload mapping.

## C3 — Report and PDF

- [ ] **C3.1 Printable sheet** `/cierres/:id/reporte` (outside the layout, `?embed=1`), with prices:
      header (name, dates, estado), Ingresos block, Gastos block (product cost per product, labor per
      collaborator, other expenses), Resultado (net profit, margin, ratios), billed vs expected
      difference, warnings. `notifySheetReady()`.
- [ ] **C3.2 "Imprimir / PDF"** button in the editor and the list (`PrintPreviewDialog` with
      `waitForReady`), disabled with unsaved changes.
- [ ] **C3.3 CSV** button — endpoint `GET /api/closings/{id}/export.csv` already done in C1 (D37).

## C4 — Wrap-up

- [ ] Update `.context/CLAUDE.md`, `DECISIONS.md` and `PROGRESS.md`.
- [ ] Browser pass on a scratch DB (never `data/costeo.db`).

## Out of scope for now (candidates for v2)

- CSV import of units sold (can reuse `services/sales_import.py`).
- Pull products from a Planeación plan to compare planned vs sold, and cost the leftovers as waste.
- Per-channel split (POS vs badgergrub.com vs platforms) and platform fees.
- Send a closing's units to a sales period for Ingeniería de menú.
- Trends across closings on the Dashboard.
