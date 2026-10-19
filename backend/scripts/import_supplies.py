"""Import supplies from a costing template .xlsx (used by `make import-supplies`).

uv run python -m scripts.import_supplies FILE [--sheet NAME] [--date YYYY-MM-DD] [--dry-run]
"""

import argparse
import sys
from datetime import date
from pathlib import Path

from sqlmodel import Session

from app.db import engine
from app.services.supply_import import (
    DEFAULT_SHEET,
    ImportFormatError,
    apply_import,
    parse_workbook,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("file", type=Path)
    parser.add_argument("--sheet", default=DEFAULT_SHEET)
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=date.today(),
        help="Purchase date for imported prices (default: today)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would be imported")
    args = parser.parse_args()

    if not args.file.exists():
        print(f"File not found: {args.file}", file=sys.stderr)
        return 1
    try:
        plan = parse_workbook(args.file, args.sheet)
    except ImportFormatError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    for skipped in plan.skipped:
        print(f"  skip  row {skipped.row:>4}  {skipped.name}: {skipped.reason}")

    if args.dry_run:
        for row in plan.rows:
            prices = ", ".join(str(p) for p in row.prices) or "no price"
            pack = f"{row.pack_qty} {row.pack_unit}"
            print(f"  new   row {row.row:>4}  {row.name} ({pack}) [{prices}]")
        print(f"Dry run: {len(plan.rows)} rows to import, {len(plan.skipped)} skipped.")
        return 0

    with Session(engine) as session:
        result = apply_import(session, plan, args.date)
    for row in result.existing:
        print(f"  exists row {row.row:>4}  {row.name}")
    print(
        f"Imported {len(result.created)} supplies; {len(result.existing)} already existed; "
        f"{len(plan.skipped)} rows skipped."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
