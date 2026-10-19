from decimal import Decimal
from enum import StrEnum
from typing import Any

from sqlalchemy import Enum as SAEnum
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator


class DecimalText(TypeDecorator[Decimal]):
    """Exact Decimal stored as TEXT.

    SQLite has no real decimal type (NUMERIC columns fall back to floats), so money and quantities
    are stored as their exact string form and parsed back into Decimal.
    """

    impl = String
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> str | None:
        if value is None:
            return None
        return format(Decimal(value), "f")

    def process_result_value(self, value: Any, dialect: Any) -> Decimal | None:
        return None if value is None else Decimal(value)


def value_enum(enum_cls: type[StrEnum]) -> SAEnum:
    """Store a StrEnum by its value ('kg') rather than its name ('KG'), as a VARCHAR + CHECK."""
    return SAEnum(
        enum_cls,
        values_callable=lambda members: [member.value for member in members],
        native_enum=False,
        validate_strings=True,
        length=32,
    )
