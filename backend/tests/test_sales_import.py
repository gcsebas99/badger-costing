import pytest

from app.services.sales_import import SalesFormatError, parse_sales_csv

PRODUCTS = {"hamburguesa clasica": 1, "papas fritas": 2}
PLATFORMS = {"uber eats": 7}


def test_parses_semicolon_csv_with_channels_and_accents():
    content = (
        "﻿Producto;Unidades;Canal\n"
        "Hamburguesa Clásica;120;Directo\n"
        "hamburguesa clasica;30;Uber Eats\n"
        "Papas fritas;80;\n"
        "Papas fritas;5;\n"
    )
    result = parse_sales_csv(content, PRODUCTS, PLATFORMS)
    assert result.units == {(1, None): 120, (1, 7): 30, (2, None): 85}
    assert result.unmatched_products == []


def test_comma_csv_without_channel_and_pos_style_headers():
    content = 'Nombre del plato,Uds vendidas\nHamburguesa clásica,"1.234"\n'
    result = parse_sales_csv(content, PRODUCTS, PLATFORMS)
    assert result.units == {(1, None): 1234}


def test_reports_unmatched_and_invalid_rows():
    content = "producto;cantidad;plataforma\nPizza;3;\nPapas fritas;abc;\nPapas fritas;2;Rappi\n"
    result = parse_sales_csv(content, PRODUCTS, PLATFORMS)
    assert result.unmatched_products == ["Pizza"]
    assert result.invalid_rows == [3]
    assert result.unmatched_channels == ["Rappi"]
    assert result.units == {}


def test_requires_product_and_units_columns():
    with pytest.raises(SalesFormatError):
        parse_sales_csv("fecha;total\n2026-10-01;5\n", PRODUCTS, PLATFORMS)
    with pytest.raises(SalesFormatError):
        parse_sales_csv("", PRODUCTS, PLATFORMS)
