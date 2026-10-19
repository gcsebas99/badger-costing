"""Timestamped, consistent copy of the SQLite DB (used by `make backup`)."""

import sys
from pathlib import Path

from app.services.backup import create_backup

if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] else None
    try:
        print(f"Backup written to {create_backup(target).path}")
    except FileNotFoundError as exc:
        sys.exit(str(exc))
