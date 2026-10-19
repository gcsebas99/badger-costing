import unicodedata


def fold(text: str | None) -> str:
    """Case- and accent-insensitive form for search and matching ('Orégano' → 'oregano')."""
    decomposed = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in decomposed if not unicodedata.combining(c)).casefold()
