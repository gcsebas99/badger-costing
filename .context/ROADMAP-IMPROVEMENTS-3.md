# Improvements 3 — Week prep planner

Follow-up to the main roadmap ([`ROADMAP.md`](ROADMAP.md)). New section "Planeación", below
"Productos": estimate the products to prepare and get the recipes and supplies needed to cover them.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

**Status:** 🚧 in progress (backend and page done, printing and export pending).

**Branch:** `imp3-week-prep` (small commits per task). Each block ends with `make test` and
`make types` passing; the frontend block adds a browser check against a scratch DB.

---

## Requested feature (from Sebas, 2026-11-04)

- Report name (input), e.g. "Planeación sesión 0".
- A list of products taken from "Productos" (active only). Each has a target quantity and an
  additional quantity for last-minute orders ("Adicional").
- One extra percentage for waste and contingencies. It is a single value, not per product or category,
  and only affects acompañamientos, salsas and vegetales.
- Output: quantity of each recipe/sub-recipe to make ("Mermelada de tocineta → 4,5 recetas"), then
  the quantities of supplies, including disposables and drinks.
- Export and print buttons.
- The report is not stored for now.

## Calculation rules

1. **Units** per product = target + additional.
2. **Main recipe batches** = units × product's recipe portions ÷ recipe portions.
3. **Direct components and packaging** = gross quantity × units.
4. **Sub-recipe batches** = quantity needed, in base units ÷ the sub-recipe's yield, in base units.
   Quantities add up per recipe and per supply across the whole plan.
5. **Waste %** multiplies:
   - any recipe in category Acompañamientos, Salsas or Vegetales, and with it everything inside
     that recipe. It applies once per branch: a sauce inside a sauce does not compound.
   - supplies of group "Frutas y verduras" on a line of a product or of a recipe that isn't a
     sub-recipe (e.g. arugula directly on a burger). It does not apply inside other sub-recipes:
     a batch of buns has to keep its own ingredients.
   - never packaging.
6. **No rounding.** The system shows the exact batches to 2 decimals; whoever runs the prep decides
   whether 4,5 becomes 5, since that depends on the recipe.
7. Prices don't matter here: a supply without a price still gets its quantity. A line whose units
   can't be converted is left out and reported as a warning.

## P1 — Backend

- [x] **P1.1 `services/prep_plan.py`**: walks products and recipes using `CostingContext` for unit and
      gross-quantity rules. Nothing is stored.
- [x] **P1.2 `POST /api/prep-plan`**: `{buffer_rate, items: [{product_id, target_qty, extra_qty}]}` →
      recipes, supplies, warnings. 422 with a Spanish `detail` on unknown, inactive or repeated products, or
      when everything is zero.
- [x] **P1.3 `POST /api/prep-plan/export.csv`**: same payload plus `name` (used for the filename);
      usual CSV format (D37).
- [x] **P1.4 Tests** in `tests/test_prep_plan.py`.

## P2 — Page `/planeacion`

- [x] **P2.1 Navigation**: sidebar item "Planeación" below "Productos".
- [x] **P2.2 Form**: report name, waste %, rows of product (active only, no repeats), objetivo and
      adicional. The form lives in the URL, so it survives a reload without being stored; a value in
      memory brings it back after visiting another section.
- [x] **P2.3 Live result**: debounced call; "Recetas" table (category, batches, total yield, portions)
      and "Suministros" table grouped by group (kg / L / pz); warnings shown above them.
- [x] **P2.4 Tests**: URL encoding and form validation in vitest.

## P3 — Print and export

- [ ] **P3.1 Printable sheet** `/planeacion/reporte?…` (no prices) with `PrintPreviewDialog`
      `waitForReady`.
- [ ] **P3.2 "Exportar CSV" button**: downloads the CSV from P1.3.

## P4 — Wrap-up

- [ ] Update `.context/CLAUDE.md`, `DECISIONS.md` and `PROGRESS.md`.
- [ ] Browser pass on a scratch DB.

## Out of scope for now

Total plan cost, packs to buy, links to the scaled kitchen sheet, saving plans.
