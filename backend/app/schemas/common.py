from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _blank_to_none(value: object) -> object:
    if isinstance(value, str) and not value.strip():
        return None
    return value


PositiveDecimal = Annotated[Decimal, Field(gt=0)]
NonNegativeDecimal = Annotated[Decimal, Field(ge=0)]
RequiredText = Annotated[str, Field(min_length=1, max_length=200)]
OptionalText = Annotated[
    Annotated[str, Field(max_length=200)] | None, BeforeValidator(_blank_to_none)
]


class ApiModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)
