from logging.config import fileConfig

import sqlalchemy as sa
from alembic import context
from sqlmodel import SQLModel

import app.models  # noqa: F401  (registers all tables on SQLModel.metadata)
from app.db import engine
from app.models.types import DecimalText

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def render_item(type_, obj, autogen_context):
    # DecimalText is TEXT at the DB level; render it as a plain String so migrations don't
    # import app code.
    if type_ == "type" and isinstance(obj, DecimalText):
        return "sa.String()"
    if type_ == "type" and isinstance(obj, sa.Enum) and not obj.native_enum:
        # value_enum(): render the stored values, not the Python enum class.
        values = ", ".join(repr(v) for v in obj.enums)
        return f"sa.Enum({values}, name={obj.name!r}, native_enum=False, length={obj.length})"
    return False


def run_migrations_offline() -> None:
    context.configure(
        url=str(engine.url),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
        render_item=render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run_with_connection(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,  # SQLite needs batch mode for ALTER TABLE
        render_item=render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Tests pass their own connection via `config.attributes["connection"]`.
    connection = config.attributes.get("connection")
    if connection is not None:
        _run_with_connection(connection)
        return
    with engine.connect() as connection:
        _run_with_connection(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
