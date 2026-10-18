# Badger Grub Costeo — Roadmap

Oct 18, 2026 · @Sebas

## Resumen

Una web app local para costear el menú de Badger Grub: suministros, recetas con sub-recetas anidadas y productos de venta con margen por canal. Reemplaza las plantillas de Excel de costeo; el inventario queda para una fase posterior.

- **Uso:** personal, en `localhost`, sin autenticación.
- **Stack:** FastAPI + Pydantic + SQLite (backend), React + Vite + Tailwind (frontend).
- **Moneda e impuestos:** colones (₡), IVA 13% configurable, comisiones de banco y plataformas configurables.
- **Idioma de la UI:** español.
- **Forma de trabajo:** 6 milestones pequeños; cada uno es una o dos sesiones de Claude Code y termina con algo usable.

## Stack y estructura del repo

Un monorepo con dos carpetas y un script que levanta ambas.

| Capa | Herramienta | Por qué |
| --- | --- | --- |
| API | FastAPI + Pydantic v2 | Validación de unidades y cantidades, docs automáticas en `/docs` |
| ORM | SQLModel (o SQLAlchemy 2) | Modelos Pydantic y tablas en un solo lugar |
| Migraciones | Alembic | Cambiar el esquema sin perder datos |
| Base de datos | SQLite (`data/costeo.db`) | Un archivo, sin servidor, fácil de respaldar |
| Decimales | `Decimal` en Python, `NUMERIC` en DB | Evita errores de redondeo con colones |
| Tests backend | pytest | El motor de costeo es lo que más importa probar |
| Frontend | React + Vite + TypeScript | Editor de recetas con filas dinámicas y recálculo en vivo |
| Estilos | Tailwind CSS + shadcn/ui | Componentes de tabla, formulario y diálogo listos, tema propio |
| Datos en el cliente | TanStack Query + TanStack Table | Caché de la API y tablas ordenables y filtrables |
| Formularios | React Hook Form + Zod | Validación en el cliente que refleja la del backend |
| Tipos compartidos | `openapi-typescript` | Genera los tipos TS desde el OpenAPI de FastAPI |
| Arranque | `make dev` o `uv` + `npm` | Un comando para levantar todo |

```
badger-costeo/
├── CLAUDE.md            # contexto para Claude Code
├── ROADMAP.md           # este plan, con checkboxes
├── Makefile             # dev, test, migrate, backup
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models/      # SQLModel: supply, recipe, product, settings
│   │   ├── schemas/     # Pydantic de entrada/salida
│   │   ├── routers/     # supplies, recipes, products, settings
│   │   ├── services/
│   │   │   ├── units.py     # conversión de unidades
│   │   │   └── costing.py   # motor de costeo recursivo
│   │   └── db.py
│   ├── alembic/
│   └── tests/
├── frontend/
│   └── src/
│       ├── api/         # cliente + tipos generados
│       ├── components/  # ui/ (shadcn), layout/, tables/
│       ├── pages/       # Dashboard, Suministros, Recetas, Productos, Ajustes
│       └── theme/       # tokens de color Badger Grub
└── data/                # costeo.db + backups (fuera de git)
```

## Lineamientos visuales

Un panel administrativo sobrio: el negro y el burgundy cargan la marca, el craft da calidez a fondos y bordes, y el gold se reserva para destacar. La pantalla principal son tablas densas y legibles, no tarjetas grandes.

| Token | Color | Uso |
| --- | --- | --- |
| `brand-black` | #1A1A1A | Sidebar, encabezados de tabla, texto principal |
| `brand-burgundy` | #5B1E2D | Botón primario, links, pestaña activa, foco |
| `brand-craft` | #CBA97E | Bordes suaves, fila seleccionada (al 15–20%), badges de categoría |
| `brand-gold` | #D4AF37 | Indicador del menú activo, KPI destacado, precio sugerido |
| `surface` | #FAF7F2 | Fondo de la app (craft muy aclarado) |
| `surface-card` | #FFFFFF | Tablas y formularios |
| `ok` / `warn` / `bad` | verde / ámbar / rojo apagados | Alertas de margen y desviación de costo |

- **Contraste:** gold y craft no van como texto sobre blanco (no pasan WCAG AA). Gold sobre negro y burgundy sobre blanco sí.
- **Layout:** sidebar fija negra a la izquierda (logo, Dashboard, Suministros, Recetas, Productos, Ajustes), barra superior con buscador y botón "Nuevo", contenido en tablas con filtros arriba.
- **Tipografía:** Inter para la UI; números con `tabular-nums` y alineados a la derecha; montos siempre como ₡ 1.234,50.
- **Densidad:** filas de 40 px, tamaño base 14 px, edición en línea donde se pueda.
- **Estados:** % de food cost y margen como badges de color según los umbrales de Ajustes.
- **Tema:** los colores viven como variables CSS en `theme/` y se mapean en `tailwind.config`, así un modo oscuro después es solo otro set de variables.

## Modelo de datos y reglas de costeo

El costo nunca se guarda: se calcula al consultar recorriendo el árbol de la receta. Así un cambio de precio llega solo a todo lo que depende de él.

| Tabla | Campos clave |
| --- | --- |
| `supply` | nombre, marca, grupo, proveedor, cantidad por empaque, unidad base (g, ml, pz), activo |
| `supply_price` | supply\_id, monto (₡), proveedor, fecha — el costo vigente es el promedio de los últimos 3 o el más reciente (configurable) |
| `unit_equivalence` | supply\_id, 1 pz = X g o ml (ej. 1 huevo = 50 g) |
| `recipe` | nombre, categoría del manual, es\_subreceta, rendimiento (cantidad + unidad), porciones, tamaño de porción |
| `recipe_item` | recipe\_id, tipo (supply o recipe), ref\_id, cantidad neta, unidad, % merma |
| `product` | nombre, grupo del menú, receta o ítems directos, empaque, PVP por canal, costo teórico objetivo |
| `settings` | IVA, comisión bancaria, plataformas con su %, umbral de margen, % food cost objetivo, rango de desviación |

**Reglas del motor (`services/costing.py`):**

1. Todo se convierte a la unidad base del suministro (g, ml o pz). Las conversiones entre familias solo valen si hay una equivalencia definida; si no, error claro.
2. Cantidad bruta = neta × (1 + merma). **El costo usa la bruta** (la plantilla de Excel usaba la neta).
3. Costo de un ítem = cantidad bruta × costo unitario del suministro, o × costo por unidad de la sub-receta.
4. Costo por unidad de una receta = costo total ÷ rendimiento; costo por porción = costo total ÷ porciones.
5. Antes de guardar una receta se verifica que no forme un ciclo (A dentro de B dentro de A).
6. Cada respuesta incluye el desglose por ítem para mostrar de dónde viene cada colón.

**Precio y margen de un producto por canal:**

```latex
\text{Precio sin IVA} = \frac{PVP}{1 + IVA}
```

```latex
\text{Margen} = \text{Precio sin IVA} - \text{Costo} - \text{Comisión (banco o plataforma)}
```

```latex
\text{Precio sugerido} = \frac{\text{Costo}}{\%\ \text{food cost objetivo}} \times (1 + IVA)
```

La comisión bancaria aplica a la venta directa; en plataforma aplica solo la de la plataforma, igual que en la plantilla original.

## Roadmap

Seis milestones. Del M0 al M3 sale el MVP: con eso ya se costean hamburguesas y bebidas con precio por canal. M4 y M5 agregan visibilidad y la conexión con el manual de recetas.

&#91;embedded content: roadmap · 6 milestones, 1 gate\]

Cada milestone depende del anterior; después del gate del MVP, M4 y M5 se pueden hacer en cualquier orden.

### M0 — Base del proyecto

Repo, herramientas y el esqueleto visual, sin funcionalidad todavía.

- [ ] Monorepo con `backend/` (FastAPI, SQLModel, Alembic, pytest, ruff) y `frontend/` (Vite, React, TS, Tailwind, shadcn/ui)
- [ ] Tokens de color Badger Grub y layout: sidebar negra, barra superior, páginas vacías
- [ ] `GET /health`, proxy de Vite a la API y generación de tipos desde OpenAPI
- [ ] `Makefile` con `dev`, `test`, `migrate`, `types`, `backup`
- [ ] `CLAUDE.md` y `ROADMAP.md` en la raíz

**Listo cuando:** `make dev` abre la app en el navegador con la navegación funcionando y `make test` pasa.

### M1 — Suministros

El catálogo de insumos con su historial de precios.

- [ ] Modelos `supply`, `supply_price`, `unit_equivalence` + migración
- [ ] API CRUD con filtros por grupo y proveedor, y búsqueda por nombre
- [ ] Servicio de unidades (g↔kg, ml↔L, pz con equivalencia) con tests
- [ ] Tabla de suministros: costo por empaque, costo unitario, última actualización
- [ ] Formulario de alta y edición, y panel lateral con historial de precios
- [ ] Script para importar la hoja "Base Datos Productos" desde el .xlsx

**Listo cuando:** puedo cargar 30 suministros reales, cambiar un precio y ver el costo unitario actualizado.

### M2 — Recetas y motor de costeo

El corazón de la app: recetas anidadas con costo en vivo.

- [ ] Modelos `recipe` y `recipe_item` + migración
- [ ] `costing.py`: costo recursivo, merma sobre cantidad bruta, desglose por ítem, detección de ciclos
- [ ] Tests con casos conocidos: la Pizza Margarita de la plantilla y una cadena de 3 niveles (mayo casera → mayo chipotle → hamburguesa)
- [ ] API de recetas con endpoint de costo y de "dónde se usa"
- [ ] Lista de recetas por categoría del manual (Bases, Salsas, Proteínas…)
- [ ] Editor de recetas: filas dinámicas, buscador de suministros y sub-recetas, costo total, por unidad y por porción en vivo

**Listo cuando:** la mayo chipotle usa la mayo casera como sub-receta, y al cambiar el precio del huevo cambian ambas.

### M3 — Productos y precios

Lo que se vende, con empaque y margen por canal.

- [ ] Modelo `product` con receta o ítems directos, empaque, PVP por canal
- [ ] Página de Ajustes: IVA, comisión bancaria, plataformas, umbrales, % food cost objetivo
- [ ] Tabla de análisis de precios (como "Análisis Coste Platos"): precio sin IVA, costo, % costo, comisión, margen, badges de alerta
- [ ] Precio sugerido según el % food cost objetivo
- [ ] Ficha de producto con el árbol de costo desplegable

**Listo cuando:** una hamburguesa con pan, proteína, dos salsas y empaque muestra su margen en venta directa y en Uber Eats, y se marca en rojo si baja del umbral.

### M4 — Dashboard y respaldo

Ver lo importante de un vistazo y no perder datos.

- [ ] Dashboard: productos bajo el umbral de margen, suministros con mayor alza reciente, recetas con ítems sin precio
- [ ] Simulador de impacto: "si el queso sube 10%, ¿qué productos se afectan y cuánto?"
- [ ] Exportar ficha de costo (PDF) y tablas (CSV)
- [ ] Respaldo de la base con `make backup` y botón en Ajustes

**Listo cuando:** abro la app y en una pantalla veo qué productos necesitan revisión de precio.

### M5 — Menú engineering y manual

Conectar ventas y el manual de recetas existente.

- [ ] Carga de unidades vendidas por periodo (manual o CSV)
- [ ] Clasificación Estrella / Caballo / Puzzle / Perro con su matriz
- [ ] Importar recetas desde los .md del manual (tabla de ingredientes → `recipe_item`)
- [ ] Escribir el costo calculado de vuelta en la sección "Costo aproximado" del .md

**Listo cuando:** las salsas del manual existen como recetas costeadas sin haberlas recapturado a mano.

**Después del roadmap:** inventario, máximos y mínimos, pedidos y mermas (la plantilla de Inventario).

## Cómo trabajarlo con Claude Code

Cada milestone es una rama, empieza en modo plan y termina con tests verdes y una revisión tuya en el navegador.

**Flujo por milestone:**

1. Rama `m1-suministros` desde `main`.
2. Pedir el plan primero (modo plan): "Lee CLAUDE.md y ROADMAP.md. Planea el M1 completo; no escribas código hasta que apruebe el plan."
3. Implementar backend primero (modelos, migración, API, tests), luego el frontend.
4. Pedir que corra `make test` y `make types` antes de dar algo por terminado.
5. Probar en el navegador; los ajustes visuales van en la misma rama.
6. Marcar los checkboxes en `ROADMAP.md`, commit y merge a `main`.

**Qué va en `CLAUDE.md`** (el contexto que Claude Code lee en cada sesión):

- Propósito de la app en 3 líneas y el link a este documento.
- Stack y comandos: `make dev`, `make test`, `make migrate`, `make types`.
- Reglas de dominio: unidades base g/ml/pz, `Decimal` para dinero, costo con cantidad bruta, nada de costos guardados.
- Convenciones: UI en español, código y nombres de tablas en inglés, montos en ₡ con formato `1.234,50`.
- Tokens de color y la regla de contraste del gold y el craft.
- "Siempre agrega o actualiza tests de `costing.py` cuando toques el cálculo."

**Prompts útiles:**

- Arranque (M0): "Crea el monorepo descrito en ROADMAP.md §Stack. Usa uv para Python y npm para el frontend. Configura shadcn/ui con los tokens de Badger Grub y un layout con sidebar. Escribe CLAUDE.md con lo que acordamos."
- Motor (M2): "Implementa costing.py siguiendo las reglas del ROADMAP. Escribe primero los tests con la Pizza Margarita y la cadena mayo casera → mayo chipotle → hamburguesa, y luego el código hasta que pasen."
- Visual: "Revisa la página de Suministros contra los lineamientos visuales; ajusta densidad, alineación de números y contraste."

**Consejos:**

- Una sesión por milestone; si se alarga, `/clear` y retomar desde el ROADMAP.
- Commits pequeños por paso, para poder volver atrás si algo se rompe.
- Datos reales desde el M1: costear con tus suministros verdaderos destapa los casos raros temprano.

## Riesgos y decisiones abiertas

El riesgo principal es el motor de costeo: si las unidades o la merma están mal, todos los números lo están. Por eso el M2 empieza por los tests.

| Riesgo | Mitigación |
| --- | --- |
| Conversiones erróneas (pz vs g) | Unidad base por suministro y error explícito si falta una equivalencia |
| Redondeo con colones | `Decimal` de punta a punta; redondear solo al mostrar |
| Sub-recetas circulares | Validación de ciclos al guardar |
| Recálculo lento con muchas recetas | Caché por petición; con decenas de recetas no debería notarse |
| Pérdida del archivo `.db` | `make backup` con fecha y copia fuera del repo |
| El alcance crece (inventario, ventas) | Fuera del MVP; entra solo después del M3 |

**Por decidir:**

- [ ] ¿Costo vigente = último precio o promedio de los últimos 3? (la plantilla promedia 3)
- [ ] ¿Qué plataformas y con qué %? (Uber Eats, Rappi, DiDi Food)
- [ ] ¿El % food cost objetivo es uno global o uno por grupo (hamburguesas, bebidas, sides)?
- [ ] ¿Las porciones del manual (g/ml) son la unidad de venta de las sub-recetas?
- [ ] ¿Incluir modo oscuro en M0 o dejarlo para después?
