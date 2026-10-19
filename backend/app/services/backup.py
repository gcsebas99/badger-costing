"""Consistent SQLite backups (online backup API), used by `make backup` and the Ajustes page."""

import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from sqlalchemy.engine import make_url

from app.config import settings

BACKUP_NAME = re.compile(r"^costeo-\d{8}-\d{6}\.db$")


@dataclass
class BackupFile:
    name: str
    size: int
    created_at: datetime
    path: Path


def database_path() -> Path:
    return Path(make_url(settings.database_url).database)


def create_backup(dest_dir: Path | None = None) -> BackupFile:
    source = database_path()
    if not source.exists():
        raise FileNotFoundError(f"Database not found: {source}")
    directory = dest_dir or settings.backup_dir
    directory.mkdir(parents=True, exist_ok=True)
    dest = directory / f"costeo-{datetime.now():%Y%m%d-%H%M%S}.db"
    with sqlite3.connect(source) as src, sqlite3.connect(dest) as dst:
        src.backup(dst)
    return _describe(dest)


def list_backups(directory: Path | None = None) -> list[BackupFile]:
    directory = directory or settings.backup_dir
    if not directory.exists():
        return []
    files = [_describe(p) for p in directory.iterdir() if BACKUP_NAME.match(p.name)]
    return sorted(files, key=lambda f: f.name, reverse=True)


def find_backup(name: str, directory: Path | None = None) -> Path | None:
    """Only names produced by create_backup are accepted (no path traversal)."""
    if not BACKUP_NAME.match(name):
        return None
    path = (directory or settings.backup_dir) / name
    return path if path.is_file() else None


def _describe(path: Path) -> BackupFile:
    stat = path.stat()
    return BackupFile(path.name, stat.st_size, datetime.fromtimestamp(stat.st_mtime), path)
