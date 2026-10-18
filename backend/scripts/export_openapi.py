"""Write the app's OpenAPI schema to a file (used by `make types`)."""

import json
import sys
from pathlib import Path

from app.main import app

if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("openapi.json")
    out.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n")
    print(f"OpenAPI written to {out}")
