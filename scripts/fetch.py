from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

SUBJECT_URL = "https://bbs.eddibb.cc/liveedge/subject-metadent.txt"
DAT_BASE_URL = "https://bbs.eddibb.cc/liveedge/dat"
DATA_DIR = Path("data")
DATA_PATH = DATA_DIR / "records.json"
RECORD_COLUMNS = [
    "threadNumber",
    "metadentUpper",
    "metadentLower",
    "firstPostId",
    "firstPostDateTime",
    "threadTitle",
]

SUBJECT_LINE_RE = re.compile(
    r"^(?P<thread_number>\d+)\.dat<>(?P<title>.+) \[(?P<metadent>[^\[\]\s]{8})★\] \((?P<response_count>\d+)\)$"
)
FIRST_POST_RE = re.compile(
    r"^.*?<>(?P<date_time>\d{4}/\d{2}/\d{2}\([^)]+\) \d{2}:\d{2}:\d{2}(?:\.\d+)?) ID:(?P<post_id>[A-Za-z0-9+\/._-]+)<>"
)


def fetch_text(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "eddi-submeta-bot/1.0 (+https://github.com/)"},
    )
    with urllib.request.urlopen(request) as response:
        data = response.read()
    return data.decode("cp932", errors="replace")


def ensure_data_file() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if DATA_PATH.exists():
        return
    DATA_PATH.write_text(
        json.dumps(
            {
                "updatedAt": None,
                "totalRecords": 0,
                "columns": RECORD_COLUMNS,
                "records": [],
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )


def normalize_row(row: dict[str, str]) -> dict[str, str]:
    return {
        "threadNumber": row.get("threadNumber", ""),
        "metadentUpper": row.get("metadentUpper", ""),
        "metadentLower": row.get("metadentLower", ""),
        "firstPostId": row.get("firstPostId", ""),
        "firstPostDateTime": row.get("firstPostDateTime", ""),
        "threadTitle": unescape(row.get("threadTitle", "")),
    }


def load_records() -> dict[str, dict[str, str]]:
    ensure_data_file()
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8-sig"))
    columns = payload.get("columns") or RECORD_COLUMNS
    rows = payload.get("records", [])
    records: dict[str, dict[str, str]] = {}

    for row in rows:
        if isinstance(row, list):
            record = normalize_row(dict(zip(columns, row, strict=False)))
        else:
            record = normalize_row(row)

        thread_number = record.get("threadNumber", "")
        if not thread_number:
            continue
        records[thread_number] = record

    return records


def fetch_first_post(thread_number: str) -> tuple[str, str]:
    dat_text = fetch_text(f"{DAT_BASE_URL}/{thread_number}.dat")
    first_line = dat_text.splitlines()[0] if dat_text.splitlines() else ""
    match = FIRST_POST_RE.match(first_line)
    if not match:
        return "", ""
    return match.group("post_id"), match.group("date_time")


def serialize_record(row: dict[str, str]) -> list[str]:
    return [row.get(column, "") for column in RECORD_COLUMNS]


def write_payload(records: list[dict[str, str]], added_count: int) -> str:
    updated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    DATA_PATH.write_text(
        json.dumps(
            {
                "updatedAt": updated_at,
                "totalRecords": len(records),
                "addedCount": added_count,
                "columns": RECORD_COLUMNS,
                "records": [serialize_record(row) for row in records],
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )
    return updated_at


def main() -> None:
    existing = load_records()
    subject_text = fetch_text(SUBJECT_URL)
    added_count = 0

    for line in subject_text.splitlines():
        line = line.strip()
        if not line:
            continue

        match = SUBJECT_LINE_RE.match(line)
        if not match:
            continue

        thread_number = match.group("thread_number")
        metadent = match.group("metadent")
        title = unescape(match.group("title"))

        if thread_number in existing:
            existing[thread_number]["threadTitle"] = title
            continue

        first_post_id, first_post_datetime = "", ""
        try:
            first_post_id, first_post_datetime = fetch_first_post(thread_number)
        except Exception as error:  # noqa: BLE001
            print(f"Failed to fetch .dat for {thread_number}: {error}")

        existing[thread_number] = {
            "threadNumber": thread_number,
            "metadentUpper": metadent[:4],
            "metadentLower": metadent[4:8],
            "firstPostId": first_post_id,
            "firstPostDateTime": first_post_datetime,
            "threadTitle": title,
        }
        added_count += 1

    records = sorted(existing.values(), key=lambda row: int(row["threadNumber"]), reverse=True)
    updated_at = write_payload(records, added_count)

    print(
        json.dumps(
            {
                "updatedAt": updated_at,
                "totalRecords": len(records),
                "addedCount": added_count,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
