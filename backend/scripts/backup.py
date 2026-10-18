"""Timestamped, consistent copy of the SQLite DB (used by `make backup`)."""

import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy.engine import make_url

from app.config import settings


def backup(dest_dir: Path) -> Path:
    db_path = Path(make_url(settings.database_url).database)
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"costeo-{datetime.now():%Y%m%d-%H%M%S}.db"
    with sqlite3.connect(db_path) as src, sqlite3.connect(dest) as dst:
        src.backup(dst)
    return dest


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] else settings.backup_dir
    try:
        print(f"Backup written to {backup(target)}")
    except FileNotFoundError as exc:
        sys.exit(str(exc))
