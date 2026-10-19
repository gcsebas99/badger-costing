"""Unit conversion.

Every supply has a base unit: g (mass), ml (volume) or pz (count). Quantities convert freely
within a family (g↔kg, ml↔L). Count ↔ mass/volume only works through a piece equivalence
defined for the supply (e.g. 1 pz = 50 g for an egg); otherwise a UnitConversionError is raised.
"""

from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum


class Unit(StrEnum):
    G = "g"
    KG = "kg"
    ML = "ml"
    L = "L"
    PZ = "pz"


class UnitFamily(StrEnum):
    MASS = "mass"
    VOLUME = "volume"
    COUNT = "count"


class UnitConversionError(ValueError):
    """Raised when a quantity cannot be converted between two units."""


_UNIT_INFO: dict[Unit, tuple[UnitFamily, Decimal]] = {
    Unit.G: (UnitFamily.MASS, Decimal(1)),
    Unit.KG: (UnitFamily.MASS, Decimal(1000)),
    Unit.ML: (UnitFamily.VOLUME, Decimal(1)),
    Unit.L: (UnitFamily.VOLUME, Decimal(1000)),
    Unit.PZ: (UnitFamily.COUNT, Decimal(1)),
}

BASE_UNITS: dict[UnitFamily, Unit] = {
    UnitFamily.MASS: Unit.G,
    UnitFamily.VOLUME: Unit.ML,
    UnitFamily.COUNT: Unit.PZ,
}

# Units used to show readable reference costs (₡ per kg / L / pz instead of per g / ml).
REFERENCE_UNITS: dict[UnitFamily, Unit] = {
    UnitFamily.MASS: Unit.KG,
    UnitFamily.VOLUME: Unit.L,
    UnitFamily.COUNT: Unit.PZ,
}

_ALIASES: dict[str, Unit] = {
    "g": Unit.G,
    "gr": Unit.G,
    "gramo": Unit.G,
    "gramos": Unit.G,
    "kg": Unit.KG,
    "kilo": Unit.KG,
    "kilos": Unit.KG,
    "ml": Unit.ML,
    "l": Unit.L,
    "lt": Unit.L,
    "litro": Unit.L,
    "litros": Unit.L,
    "pz": Unit.PZ,
    "pza": Unit.PZ,
    "pieza": Unit.PZ,
    "piezas": Unit.PZ,
    "und": Unit.PZ,
    "unidad": Unit.PZ,
}


@dataclass(frozen=True)
class PieceEquivalence:
    """1 pz = `quantity` `unit` (unit must be mass or volume)."""

    quantity: Decimal
    unit: Unit

    def __post_init__(self) -> None:
        if family(self.unit) == UnitFamily.COUNT:
            raise UnitConversionError("La equivalencia de una pieza debe ser en peso o volumen.")
        if self.quantity <= 0:
            raise UnitConversionError("La equivalencia de una pieza debe ser mayor que cero.")


def units_in_family(unit_family: UnitFamily) -> list[Unit]:
    return [unit for unit, (fam, _) in _UNIT_INFO.items() if fam == unit_family]


def parse_unit(raw: str) -> Unit:
    """Parse user/spreadsheet input like 'kg ', 'L', 'Litros', 'pza'."""
    key = raw.strip().lower().rstrip(".")
    try:
        return _ALIASES[key]
    except KeyError:
        raise UnitConversionError(f"Unidad desconocida: '{raw.strip()}'.") from None


def family(unit: Unit) -> UnitFamily:
    return _UNIT_INFO[unit][0]


def base_unit(unit: Unit) -> Unit:
    return BASE_UNITS[family(unit)]


def reference_unit(unit: Unit) -> Unit:
    return REFERENCE_UNITS[family(unit)]


def to_base(quantity: Decimal, unit: Unit) -> Decimal:
    """Convert to the base unit of the same family (kg → g, L → ml)."""
    return quantity * _UNIT_INFO[unit][1]


def convert(
    quantity: Decimal,
    from_unit: Unit,
    to_unit: Unit,
    equivalence: PieceEquivalence | None = None,
) -> Decimal:
    from_family, to_family = family(from_unit), family(to_unit)
    if from_family == to_family:
        return to_base(quantity, from_unit) / _UNIT_INFO[to_unit][1]

    if UnitFamily.COUNT not in (from_family, to_family):
        raise UnitConversionError(
            f"No se puede convertir de {from_unit} a {to_unit} (peso y volumen no son compatibles)."
        )

    other_family = to_family if from_family == UnitFamily.COUNT else from_family
    if equivalence is None or family(equivalence.unit) != other_family:
        raise UnitConversionError(
            f"Falta la equivalencia de 1 pz en {BASE_UNITS[other_family]} "
            f"para convertir de {from_unit} a {to_unit}."
        )

    base_per_piece = to_base(equivalence.quantity, equivalence.unit)
    if from_family == UnitFamily.COUNT:
        return quantity * base_per_piece / _UNIT_INFO[to_unit][1]
    return to_base(quantity, from_unit) / base_per_piece
