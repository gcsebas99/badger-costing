from decimal import Decimal

import pytest

from app.services.units import (
    PieceEquivalence,
    Unit,
    UnitConversionError,
    base_unit,
    convert,
    parse_unit,
    reference_unit,
    to_base,
)

D = Decimal


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("kg ", Unit.KG),
        ("L", Unit.L),
        ("l", Unit.L),
        ("Litros", Unit.L),
        ("g", Unit.G),
        ("pz", Unit.PZ),
        ("pza.", Unit.PZ),
        ("ml", Unit.ML),
    ],
)
def test_parse_unit_normalizes_spreadsheet_values(raw, expected):
    assert parse_unit(raw) == expected


def test_parse_unit_rejects_unknown():
    with pytest.raises(UnitConversionError):
        parse_unit("taza")


def test_base_and_reference_units():
    assert base_unit(Unit.KG) == Unit.G
    assert base_unit(Unit.L) == Unit.ML
    assert base_unit(Unit.PZ) == Unit.PZ
    assert reference_unit(Unit.G) == Unit.KG
    assert reference_unit(Unit.ML) == Unit.L


def test_to_base():
    assert to_base(D("1.36"), Unit.KG) == D("1360")
    assert to_base(D("6"), Unit.L) == D("6000")
    assert to_base(D("24"), Unit.PZ) == D("24")


def test_convert_within_family():
    assert convert(D("250"), Unit.G, Unit.KG) == D("0.25")
    assert convert(D("0.454"), Unit.KG, Unit.G) == D("454")
    assert convert(D("1.5"), Unit.L, Unit.ML) == D("1500")


def test_convert_pieces_with_equivalence():
    egg = PieceEquivalence(D("50"), Unit.G)
    assert convert(D("3"), Unit.PZ, Unit.G, egg) == D("150")
    assert convert(D("100"), Unit.G, Unit.PZ, egg) == D("2")
    assert convert(D("2"), Unit.PZ, Unit.KG, egg) == D("0.1")


def test_convert_pieces_with_equivalence_in_other_unit():
    can = PieceEquivalence(D("0.355"), Unit.L)
    assert convert(D("2"), Unit.PZ, Unit.ML, can) == D("710")


def test_convert_pieces_without_equivalence_fails():
    with pytest.raises(UnitConversionError, match="equivalencia"):
        convert(D("1"), Unit.PZ, Unit.G)


def test_convert_with_equivalence_of_wrong_family_fails():
    with pytest.raises(UnitConversionError):
        convert(D("1"), Unit.PZ, Unit.ML, PieceEquivalence(D("50"), Unit.G))


def test_mass_to_volume_is_not_allowed():
    with pytest.raises(UnitConversionError, match="no son compatibles"):
        convert(D("1"), Unit.G, Unit.ML, PieceEquivalence(D("50"), Unit.G))


def test_piece_equivalence_validation():
    with pytest.raises(UnitConversionError):
        PieceEquivalence(D("1"), Unit.PZ)
    with pytest.raises(UnitConversionError):
        PieceEquivalence(D("0"), Unit.G)
