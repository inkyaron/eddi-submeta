from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

DATA_PATH = Path("data") / "records.csv"
DOCS_DATA_DIR = Path("docs") / "data"


def main() -> None:
    DOCS_DATA_DIR.mkdir(parents=True, exist_ok=True)

    with DATA_PATH.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        records = [
            {
                "threadNumber": row.get("thread_number", ""),
                "metadentUpper": row.get("metadent_upper", ""),
                "metadentLower": row.get("metadent_lower", ""),
                "firstPostId": row.get("first_post_id", ""),
                "firstPostDateTime": row.get("first_post_datetime", ""),
            }
            for row in reader
            if row.get("thread_number")
        ]

    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "totalRecords": len(records),
        "records": records,
    }

    (DOCS_DATA_DIR / "index.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (DOCS_DATA_DIR / "records.csv").write_text(DATA_PATH.read_text(encoding="utf-8"), encoding="utf-8")


if __name__ == "__main__":
    main()
