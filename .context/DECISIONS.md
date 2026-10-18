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

## Open (from spec — need Sebas's answer before the noted milestone)

- [ ] **Current cost** = latest price or average of last 3? (template averages 3) — *needed in M1*.
      Default plan: configurable setting, default **avg of last 3**.
- [ ] **Platforms and %** (Uber Eats, Rappi, DiDi Food) — *needed in M3*.
- [ ] **Target food cost %**: global or per menu group? — *needed in M3*.
      Default plan: global with optional per-group override.
- [ ] Are manual portions (g/ml) the sale unit of sub-recipes? — *needed in M2*.
- [x] Dark mode in M0? → deferred (D8).
