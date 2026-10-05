#!/usr/bin/env python3
"""Export AveeCare patients to a CSV file you can import into Google Sheets.

    python sync_patients_to_sheet.py                          every patient to patients.csv
    python sync_patients_to_sheet.py --active --out active.csv
    python sync_patients_to_sheet.py --updated-after 2026-10-01T00:00:00Z

No Google API is involved: in Google Sheets choose File > Import > Upload and pick the CSV.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from typing import Any, Dict, Iterable, List, Optional

from aveecare import AveeCare, AveeCareError

# CSV header -> attribute on the SDK's Patient model. Only non-sensitive fields by default.
# Add more with --columns (for example date_of_birth); see the API docs for every field.
DEFAULT_COLUMNS = [
    "id",
    "first_name",
    "last_name",
    "status",
    "lifecycle_stage",
    "email",
    "address",
    "city",
    "state",
    "zip_code",
    "office_id",
    "updated_at",
]
ALL_COLUMNS = DEFAULT_COLUMNS + [
    "middle_name",
    "goes_by_name",
    "date_of_birth",
    "gender",
    "primary_language",
    "active",
    "service_type",
    "created_at",
]


def load_dotenv(path: str = ".env") -> None:
    """Minimal .env reader: KEY=VALUE lines. Values already in the environment win."""
    try:
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip("'\""))
    except FileNotFoundError:
        pass


def cell(value: Any) -> str:
    """One CSV cell. Blank for None, and defused if a spreadsheet would run it as a formula."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    text = str(value)
    return "'" + text if isinstance(value, str) and text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def write_rows(handle: Any, patients: Iterable[Any], columns: List[str]) -> int:
    writer = csv.writer(handle)
    writer.writerow(columns)
    count = 0
    for patient in patients:
        writer.writerow([cell(getattr(patient, column, None)) for column in columns])
        count += 1
    return count


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Export AveeCare patients to a CSV file for Google Sheets.")
    parser.add_argument("--out", default="patients.csv", help="output file (default patients.csv)")
    parser.add_argument("--active", action="store_true", help="only active clients")
    parser.add_argument("--status", help="only patients with this status (Active, Inactive, Prospect, Discharged)")
    parser.add_argument("--lifecycle-stage", choices=["Prospect", "Client"], help="only prospects or only clients")
    parser.add_argument("--office-id", help="only patients of this office")
    parser.add_argument("--updated-after", metavar="ISO_TIME", help="only patients changed after this time")
    parser.add_argument("--page-size", type=int, default=100, help="patients per request, 1 to 100 (default 100, the fewest requests)")
    parser.add_argument("--columns", help=f"comma-separated columns. Available: {', '.join(ALL_COLUMNS)}")
    args = parser.parse_args(argv)

    columns = [c.strip() for c in args.columns.split(",")] if args.columns else DEFAULT_COLUMNS
    unknown = [c for c in columns if c not in ALL_COLUMNS]
    if unknown:
        parser.error(f"unknown column(s): {', '.join(unknown)}")

    if not 1 <= args.page_size <= 100:
        parser.error("--page-size must be from 1 to 100")
    filters: Dict[str, Any] = {"limit": args.page_size}
    if args.active:
        filters["active"] = True
    if args.status:
        filters["status"] = args.status
    if args.lifecycle_stage:
        filters["lifecycle_stage"] = args.lifecycle_stage
    if args.office_id:
        filters["office_id"] = args.office_id
    if args.updated_after:
        filters["updated_after"] = args.updated_after

    load_dotenv()
    client = AveeCare()  # AVEECARE_API_KEY, and AVEECARE_BASE_URL when set, come from the environment
    newest = ""
    try:
        # utf-8-sig adds the byte order mark that makes Excel read accents correctly; Sheets ignores it.
        with open(args.out, "w", newline="", encoding="utf-8-sig") as handle:
            # Iterating the page walks every following page too.
            def seen(patients: Iterable[Any]) -> Iterable[Any]:
                nonlocal newest
                for patient in patients:
                    newest = max(newest, getattr(patient, "updated_at", None) or "")
                    yield patient

            count = write_rows(handle, seen(client.patients.list(**filters)), columns)
    except AveeCareError as err:
        print(f"AveeCare error: {err}", file=sys.stderr)
        return 1

    print(f"Wrote {count} patient(s) to {args.out}")
    if newest:
        print(f"Newest change seen: {newest}  (pass it as --updated-after next time to fetch only newer changes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
