from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine
from sqlmodel import SQLModel

import app.models  # noqa: F401

BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_migrations_match_models(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'migrations.db'}")
    config = Config(BACKEND_DIR / "alembic.ini")

    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")

    with engine.connect() as connection:
        diff = compare_metadata(MigrationContext.configure(connection), SQLModel.metadata)

    assert diff == [], f"Models changed without a migration (run `make migration`): {diff}"
