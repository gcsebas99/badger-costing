# Improvements 1 — kitchen tools for Recetas

Follow-up to the main roadmap ([`ROADMAP.md`](ROADMAP.md), M0–M5). Adds kitchen-facing features to
Recetas: preparation steps, a printable kitchen sheet, and batch scaling (by multiplier or by one
ingredient's available quantity).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

**Branch:** `imp1-kitchen` (small commits per task). Each block ends with `make test` and
`make types` passing, plus a browser check against a scratch DB.

---

## Requested features (from Sebas, 2026-10-24)

1. **Multiplicar receta**: a button in Recetas opens a modal. You pick a multiplier (×0.5, ×2,
   ×3, ×4) and see the ingredient list adjusted to it.
2. **Ajustar a ingrediente**: you set the quantity you have of **one** ingredient (e.g. 1.44 kg
   of meat when the recipe uses 1 kg), and every other ingredient scales in proportion.
3. Both modals show a **PDF preview** with a **print** option. Choices are calculated live and
   **never stored**.
4. **Preparación**: a new card below "Ingredientes" in the recipe editor, holding an ordered list
   of instructions.
5. **Ficha para cocina**: a button opens a PDF preview with the ingredients (×1) and the
   preparation steps.

## Design summary

- **One scaling rule.** Both features use the same factor `f`:
  - Multiplier: `f` is the chosen value.
  - Adjust to ingredient: `f = available qty (converted to the line's unit) ÷ that line's qty`.
  - Every line's net qty, gross qty, the yield and the portions are multiplied by `f`. Waste %
    does not change.
- **Scaling runs in the backend**, keeping Decimal end to end. `GET /api/recipes/{id}/scaled`
  takes either `factor`, or `anchor_item_id` + `anchor_qty` + `anchor_unit`. It returns the scaled
  lines, yield, portions and the factor used. It writes nothing to the database.
  - This also gives us unit conversion (kg ↔ g, pz via equivalence) from `services/units.py` for
    free.
- **One printable component.** The kitchen sheet route `/recetas/:id/cocina` reads the factor or
  anchor from query params (default ×1).
  - "Ficha para cocina" opens it at ×1.
  - The two modals open it with their current selection.
  - Query params are temporary UI state, not storage, which meets "never stored".
- **The PDF preview is the real print page.** The modal embeds the route in an `<iframe>` (same
  origin). "Imprimir / guardar PDF" calls `iframe.contentWindow.print()`.
  - What you see is exactly what prints.
  - No PDF library, consistent with D36 (browser print dialog).
- **The kitchen sheet has no prices.** It is for the line, not for costing. Costs stay on the
  existing "Ficha PDF" (cost sheet).
- **Steps are stored in a `recipe_step` table** (position + text, cascade delete). The API exposes
  them as `steps: list[str]` on create, update and detail, and saving replaces the whole list,
  the same way ingredients work.
- **Tools work on the saved recipe.** While the editor has unsaved changes, the three buttons are
  disabled with the hint "Guarda los cambios primero". This avoids printing something that doesn't
  match the database.

---

## I1 — Preparación (steps)

- [x] **I1.1 Model + migration**: `RecipeStep` (`id`, `recipe_id` FK CASCADE, `position`,
      `text`), relationship `Recipe.steps` ordered by position, migration `0006`.
- [x] **I1.2 API**: `steps: list[StepText]` (non-empty, trimmed, max ~1000 chars) on
      `RecipeCreate` / `RecipeUpdate` / `RecipeDetail`. Saving replaces the list. Blank steps are
      dropped. Tests cover create, reorder, clear and the cascade on recipe delete.
- [x] **I1.3 Editor card "Preparación"**: placed below "Ingredientes".
  - Numbered rows, each with an auto-growing `Textarea`.
  - Buttons per row: ↑ / ↓ to reorder, 🗑 to delete. "Agregar paso" at the end.
  - Enter in the last step adds a new one; Shift+Enter makes a line break.
  - Uses RHF `useFieldArray`, Zod schema and the dirty guard.
- [x] **I1.4 Cost sheet**: show the steps in the existing "Ficha PDF" too, after Ingredientes.
      *(Confirmed: Q4.)*

## I2 — Scaling engine (backend)

- [x] **I2.1 `services/scaling.py`**: `scale_factor_for_anchor(item, qty, unit)` converts with
      `units.py` and errors when the unit is incompatible or the line's qty is 0. `scale_recipe(recipe, f)`
      returns the scaled lines (supply/sub-recipe name, net, gross, unit, waste) plus the yield and
      portions.
- [x] **I2.2 Endpoint** `GET /api/recipes/{id}/scaled`:
  - Takes exactly one mode, either `factor` or `anchor_*`. Otherwise it returns 422 with a
    Spanish `detail`.
  - `factor` must be > 0 and ≤ 100.
  - The response includes a screen-only `total_cost` computed by `CostingContext`, so the cost is
    correct by construction. The print page does not show it.
- [x] **I2.3 Tests** (service cases in `tests/test_costing.py`, endpoint cases in
      `tests/test_recipes_api.py`):
  - ×0.5 and ×3 on the template recipe.
  - Anchor 1.44 kg against a 1 kg line gives f = 1.44, and another line's 200 g becomes 288 g.
  - Anchor entered in g against a kg line.
  - Anchor through a pz equivalence.
  - Incompatible unit → 422.
  - Recipe with a sub-recipe line: the line scales, the sub-recipe is not expanded.

## I3 — Kitchen sheet + preview modal (feature 5, shared by 1–2)

- [x] **I3.1 Route `/recetas/:id/cocina`**: outside the layout, like the existing sheets.
  - Reads `?factor=` or `?ingrediente=&cantidad=&unidad=` and calls the scaled endpoint.
  - Header: "Badger Grub · Ficha de cocina", recipe name, category, date, and a scaling badge
    (e.g. "×2" or "Ajustada a 1,44 kg de Carne molida").
  - Facts: yield and portions (scaled).
  - Ingredients table: ☐ checkbox column for mise en place, ingredient, quantity + unit. A "Bruto"
    column appears only when a line has waste.
  - Numbered preparation steps, then notes.
  - Large print-friendly type, no prices.
  - Reuses `SheetLayout` with a configurable kicker ("Ficha de costo" / "Ficha de cocina").
- [x] **I3.2 Kitchen-friendly display rounding** (`formatKitchenQuantity` in `lib/format.ts`):
  - g / ml: whole numbers from 10 up, 1 decimal from 1 to 10, 2 decimals below 1.
  - kg / L: up to 3 decimals, trimmed.
  - pz: up to 2 decimals, with a "≈" marker when fractional.
  - Display only; the API value stays exact. Vitest cases included.
- [x] **I3.3 `PrintPreviewDialog` component**: wide dialog with an `<iframe src=…>` A4-like
      preview and a loading state. Footer actions: "Imprimir / guardar PDF" (iframe print),
      "Abrir en pestaña" and "Cerrar". Optional `controls` slot at the top for the scaling
      selectors.
- [x] **I3.4 "Ficha para cocina" button** in the recipe editor header, next to "Ficha PDF". It
      opens `PrintPreviewDialog` at ×1.

## I4 — Multiplicar receta (feature 1)

- [x] **I4.1 "Multiplicar" button** (editor header) opens `PrintPreviewDialog` with a segmented
      control: ×0.5 · ×2 · ×3 · ×4 (default ×2).
- [x] **I4.2 Live update**: changing the multiplier updates the iframe URL right away. The new
      yield, portions and screen-only batch cost show above the preview. Nothing is persisted.

## I5 — Ajustar a ingrediente (feature 2)

- [ ] **I5.1 "Ajustar a ingrediente" button** opens `PrintPreviewDialog` with these controls:
  - Ingredient select, listing the recipe's lines.
  - "Cantidad disponible" input, accepting `1,44` or `1.44`.
  - Unit select, limited to units compatible with that line (from the ingredient options
    endpoint).
- [ ] **I5.2 Live calculation**: input is debounced, then the iframe reloads. The resulting factor
      shows ("Factor ×1,44"), with the new yield and portions. Errors (incompatible unit, empty
      qty) appear inline and the last valid preview stays visible.
- [x] **I5.3 Highlight the anchor line** in the sheet ("ingrediente base"). *(Done with I3: the sheet
      already reads `?ingrediente=&cantidad=&unidad=`.)*

## I6 — Wrap-up

- [ ] Update `.context/CLAUDE.md` (routes, `recipe_step`, scaling endpoint), `DECISIONS.md`
      (D48+) and `PROGRESS.md`.
- [ ] Full browser pass on a scratch DB: create steps, print the kitchen sheet, ×0.5 / ×4, and
      adjust to 1.44 kg.

---

## Open questions (defaults applied unless Sebas says otherwise)

| # | Question | Default |
| --- | --- | --- |
| Q1 | When adjusting to an ingredient, is the "available qty" the **gross** amount (raw, before waste) or the **net** amount from the recipe? | **Net** (matches the recipe's quantity column). If a line has waste, the modal also shows its gross equivalent. Switch to gross if you weigh raw product. |
| Q2 | Should the kitchen sheet expand sub-recipe lines into their own ingredients? | No. The sub-recipe shows as one scaled line, and its own kitchen sheet covers it. |
| Q3 | Should the multiplier allow a custom value (e.g. ×1.5)? | Only the 4 requested options for now; a "Otro" input is easy to add. |
| Q4 | Should preparation steps also appear on the cost "Ficha PDF"? | Yes (I1.4). |
| Q5 | Should the kitchen sheet show the gross qty column? | Only when a line has waste > 0. |
