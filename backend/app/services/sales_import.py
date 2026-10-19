"""Parse units sold from a CSV (e.g. a POS export).

Accepted columns (header names, any case/accents): product → "producto" | "plato" | "nombre" |
"item"; units → "unidades" | "cantidad" | "uds" | "vendidas"; optional channel → "canal" |
"plataforma". Delimiter is detected (";" or "," or tab). Products and channels are matched by name,
ignoring case and accents; rows for the same product and channel are added up.
"""

import csv
import io
from dataclasses import dataclass, field

from app.services.text import fold

PRODUCT_HEADERS = {"producto", "plato", "nombre", "item", "articulo", "nombre del plato"}
UNITS_HEADERS = {"unidades", "cantidad", "uds", "vendidas", "uds vendidas", "unidades vendidas"}
CHANNEL_HEADERS = {"canal", "plataforma", "channel"}
DIRECT_NAMES = {"", "directo", "directa", "venta directa", "local", "salon", "mostrador"}


class SalesFormatError(ValueError):
    pass


@dataclass
class ParsedSales:
    units: dict[tuple[int, int | None], int] = field(default_factory=dict)
    unmatched_products: list[str] = field(default_factory=list)
    unmatched_channels: list[str] = field(default_factory=list)
    invalid_rows: list[int] = field(default_factory=list)


def parse_sales_csv(
    content: str, products: dict[str, int], platforms: dict[str, int]
) -> ParsedSales:
    """`products` / `platforms`: folded name → id."""
    text = content.lstrip("﻿")
    if not text.strip():
        raise SalesFormatError("El archivo está vacío.")
    try:
        dialect = csv.Sniffer().sniff(text.splitlines()[0], delimiters=";,\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    header = [fold(h).strip() for h in next(reader)]

    def column(names: set[str]) -> int | None:
        return next((i for i, h in enumerate(header) if h in names), None)

    product_col, units_col, channel_col = (
        column(PRODUCT_HEADERS),
        column(UNITS_HEADERS),
        column(CHANNEL_HEADERS),
    )
    if product_col is None or units_col is None:
        raise SalesFormatError(
            "El CSV necesita columnas «producto» y «unidades» (y opcionalmente «canal»)."
        )

    result = ParsedSales()
    for line_number, row in enumerate(reader, start=2):
        if not any(cell.strip() for cell in row):
            continue
        name = row[product_col].strip() if product_col < len(row) else ""
        raw_units = row[units_col].strip() if units_col < len(row) else ""
        try:
            units = int(float(raw_units.replace(".", "").replace(",", ".")))
        except ValueError:
            result.invalid_rows.append(line_number)
            continue
        if units < 0 or not name:
            result.invalid_rows.append(line_number)
            continue
        product_id = products.get(fold(name))
        if product_id is None:
            if name not in result.unmatched_products:
                result.unmatched_products.append(name)
            continue
        channel = (
            row[channel_col].strip() if channel_col is not None and channel_col < len(row) else ""
        )
        platform_id: int | None = None
        if fold(channel) not in DIRECT_NAMES:
            platform_id = platforms.get(fold(channel))
            if platform_id is None:
                if channel not in result.unmatched_channels:
                    result.unmatched_channels.append(channel)
                continue
        key = (product_id, platform_id)
        result.units[key] = result.units.get(key, 0) + units
    return result
