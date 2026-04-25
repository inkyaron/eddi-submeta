from __future__ import annotations

import csv
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SUBJECT_URL = "https://bbs.eddibb.cc/liveedge/subject-metadent.txt"
DAT_BASE_URL = "https://bbs.eddibb.cc/liveedge/dat"
DATA_DIR = Path("data")
DATA_PATH = DATA_DIR / "records.csv"
METADATA_PATH = DATA_DIR / "metadata.json"

SUBJECT_LINE_RE = re.compile(
    r"^(?P<thread_number>\d+)\.dat<>.+? \[(?P<metadent>[^\[\]\s]{8})★\] \((?P<response_count>\d+)\)$"
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
    return data.decode("shift_jis", errors="replace")


def ensure_data_file() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if DATA_PATH.exists():
        return
    with DATA_PATH.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            [
                "thread_number",
                "metadent_upper",
                "metadent_lower",
                "first_post_id",
                "first_post_datetime",
            ]
        )


def load_records() -> dict[str, dict[str, str]]:
    ensure_data_file()
    records: dict[str, dict[str, str]] = {}
    with DATA_PATH.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            thread_number = row.get("thread_number", "")
            if not thread_number:
                continue
            records[thread_number] = {
                "thread_number": thread_number,
                "metadent_upper": row.get("metadent_upper", ""),
                "metadent_lower": row.get("metadent_lower", ""),
                "first_post_id": row.get("first_post_id", ""),
                "first_post_datetime": row.get("first_post_datetime", ""),
            }
    return records


def fetch_first_post(thread_number: str) -> tuple[str, str]:
    dat_text = fetch_text(f"{DAT_BASE_URL}/{thread_number}.dat")
    first_line = dat_text.splitlines()[0] if dat_text.splitlines() else ""
    match = FIRST_POST_RE.match(first_line)
    if not match:
        return "", ""
    return match.group("post_id"), match.group("date_time")


def write_records(records: list[dict[str, str]]) -> None:
    with DATA_PATH.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            [
                "thread_number",
                "metadent_upper",
                "metadent_lower",
                "first_post_id",
                "first_post_datetime",
            ]
        )
        for record in records:
            writer.writerow(
                [
                    record["thread_number"],
                    record["metadent_upper"],
                    record["metadent_lower"],
                    record["first_post_id"],
                    record["first_post_datetime"],
                ]
            )


def write_metadata(total_records: int, added_count: int) -> str:
    updated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    METADATA_PATH.write_text(
        json.dumps(
            {
                "updatedAt": updated_at,
                "totalRecords": total_records,
                "addedCount": added_count,
            },
            ensure_ascii=False,
            indent=2,
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
        if thread_number in existing:
            continue

        metadent = match.group("metadent")
        first_post_id, first_post_datetime = "", ""
        try:
            first_post_id, first_post_datetime = fetch_first_post(thread_number)
        except Exception as error:  # noqa: BLE001
            print(f"Failed to fetch .dat for {thread_number}: {error}")

        existing[thread_number] = {
            "thread_number": thread_number,
            "metadent_upper": metadent[:4],
            "metadent_lower": metadent[4:8],
            "first_post_id": first_post_id,
            "first_post_datetime": first_post_datetime,
        }
        added_count += 1

    records = sorted(existing.values(), key=lambda row: int(row["thread_number"]), reverse=True)
    write_records(records)
    updated_at = write_metadata(len(records), added_count)

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
