# Decisions

## Made

| # | Date | Decision | Why |
| --- | --- | --- | --- |
| D1 | 2026-10-18 | Context docs live in `.context/`; root `CLAUDE.md` just imports `.context/CLAUDE.md` | Requested by Sebas; root import keeps Claude Code auto-loading it |
| D2 | 2026-10-18 | Tailwind CSS **v4** (CSS-first `@theme inline`) instead of `tailwind.config.js` | Current shadcn/ui default; tokens still live as CSS variables, same intent as spec |
| D3 | 2026-10-18 | Python 3.13 via uv; Node 22 pinned in `.nvmrc` | System default Node is v14, too old for Vite |
| D4 | 2026-10-18 | All API routes under `/api` prefix (`/api/health`, …) | Single Vite proxy rule, no clash with SPA routes |
| D5 | 2026-10-18 | Money serialized as JSON strings (Decimal) | No float rounding on the wire |
| D6 | 2026-10-18 | UI labels inline in Spanish, no i18n library | Single-language personal app; less ceremony |
| D7 | 2026-10-18 | Routing with `react-router` | Standard, small; one route per sidebar page |
| D8 | 2026-10-18 | Dark mode deferred; tokens structured so it's one more variable set | Open question in spec; default to "later" |
| D9 | 2026-10-18 | TypeScript pinned to `~5.9` | `openapi-typescript` 7.x peer-requires TS 5; revisit when it supports TS 6 |
| D10 | 2026-10-18 | OpenAPI operationId = endpoint function name; `src/api/openapi.json` is committed | Clean generated type names; API changes visible in diffs |
| D11 | 2026-10-18 | Current supply cost = average of the last **up to 3** prices (1 price → that price; 2 → avg of 2). Latest-only stays available as a setting | Answered by Sebas; matches the Excel template |
| D12 | 2026-10-18 | Decimals stored as TEXT via `DecimalText` (not `NUMERIC`) | SQLite NUMERIC silently falls back to float; TEXT keeps exact values |
| D13 | 2026-10-18 | Enums stored by value (`'kg'`, `'average_last_3'`) via `value_enum()` | Readable DB, safe to rename Python members |
| D14 | 2026-10-18 | Supply = pack (qty + unit); prices are ₡ per pack; unit cost per base unit, plus a reference cost per kg / L / pz for display | Matches the template ("Formato de compra" + price); per-gram costs are unreadable |
| D15 | 2026-10-18 | One piece equivalence per supply (`1 pz = X g/ml/kg/L`), editable in the supply form | Covers eggs (bought by pz, used in g) and garlic (bought by kg, used in pz) |
| D16 | 2026-10-18 | Supply groups are free text, with template groups as suggestions (`DEFAULT_SUPPLY_GROUPS`) | Flexible without a groups table |
| D17 | 2026-10-18 | API error `detail` messages are in Spanish | They're shown directly in UI toasts |
| D18 | 2026-10-18 | Search is accent/case-insensitive and done in Python | SQLite `LIKE` isn't accent-aware; catalog is small |
| D19 | 2026-10-18 | Tailwind `dark:` variant is class-based (`.dark`), not OS-based | Otherwise shadcn dark styles leak in when macOS is in dark mode |
| D20 | 2026-10-18 | `samples_xlsx/` is gitignored; sample data never goes into `data/costeo.db` | Spreadsheets are reference examples, not Badger Grub data |
| D21 | 2026-10-18 | Importer: skips "Subrecetas" rows and existing name+brand; Precio 1–3 imported with one date, Precio 3 = newest | Template has no price dates; re-runs are safe |

## Open (from spec — need Sebas's answer before the noted milestone)

- [x] **Current cost** → D11.
- [ ] **Platforms and %** (Uber Eats, Rappi, DiDi Food) — *needed in M3*.
- [ ] **Target food cost %**: global or per menu group? — *needed in M3*.
      Default plan: global with optional per-group override.
- [ ] Are manual portions (g/ml) the sale unit of sub-recipes? — *needed in M2*.
- [x] Dark mode in M0? → deferred (D8).
