from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, PlainSerializer


def _blank_to_none(value: object) -> object:
    if isinstance(value, str) and not value.strip():
        return None
    return value


# Decimals go out as plain strings: str(Decimal) may use exponent notation ("4.0E+3").
_PLAIN = PlainSerializer(lambda d: format(d, "f"), return_type=str, when_used="json")

DecimalOut = Annotated[Decimal, _PLAIN]
PositiveDecimal = Annotated[Decimal, Field(gt=0), _PLAIN]
NonNegativeDecimal = Annotated[Decimal, Field(ge=0), _PLAIN]
RequiredText = Annotated[str, Field(min_length=1, max_length=200)]
OptionalText = Annotated[
    Annotated[str, Field(max_length=200)] | None, BeforeValidator(_blank_to_none)
]


class ApiModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)


LongOptionalText = Annotated[
    Annotated[str, Field(max_length=2000)] | None, BeforeValidator(_blank_to_none)
]
