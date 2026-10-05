#!/usr/bin/env python3
"""Caregiver credentials that expire soon.

    python credential_expiry_report.py --days 30
    python credential_expiry_report.py --days 60 --csv expiring.csv
    python credential_expiry_report.py --days 30 --include-expired

Reads every certification and every active caregiver through the AveeCare SDK, and
reports certifications and state licenses that expire within the next N days. The API
has no "expires before" filter, so the date check happens here.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional

from aveecare import AveeCare, AveeCareError


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


@dataclass
class Row:
    caregiver: str
    caregiver_id: str
    credential: str
    expires: date
    days_left: int


def parse_day(value: Optional[str]) -> Optional[date]:
    """Reads a date or an ISO 8601 time. Returns None when there is no usable date."""
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def caregiver_name(caregiver: object) -> str:
    first = getattr(caregiver, "first_name", None) or ""
    last = getattr(caregiver, "last_name", None) or ""
    return f"{first} {last}".strip() or getattr(caregiver, "id", "(unknown)")


def sort_key(row: Row) -> tuple:
    return (row.expires, row.caregiver, row.credential)


def find_expiring(
    caregivers: Iterable[object],
    certifications: Iterable[object],
    today: date,
    days: int,
    include_expired: bool = False,
) -> List[Row]:
    """Pure function: the rows to report, soonest first. Only caregivers in `caregivers` count."""
    by_id: Dict[str, object] = {c.id: c for c in caregivers}
    horizon = today + timedelta(days=days)
    rows: List[Row] = []

    def consider(caregiver: object, credential: str, expires: Optional[date]) -> None:
        if expires is None or expires > horizon or (expires < today and not include_expired):
            return
        rows.append(Row(caregiver_name(caregiver), caregiver.id, credential, expires, (expires - today).days))  # type: ignore[attr-defined]

    for cert in certifications:
        caregiver = by_id.get(getattr(cert, "caregiver_id", None) or "")
        if caregiver is not None:
            consider(caregiver, getattr(cert, "name", None) or "Certification", parse_day(getattr(cert, "expires", None)))
    for caregiver in by_id.values():
        license_type = getattr(caregiver, "license_type", None)
        label = f"State license ({license_type})" if license_type else "State license"
        consider(caregiver, label, parse_day(getattr(caregiver, "state_license_expiry", None)))

    rows.sort(key=sort_key)
    return rows


def spreadsheet_safe(value: str) -> str:
    """Stops a spreadsheet from running a cell that starts like a formula."""
    return "'" + value if value[:1] in ("=", "+", "-", "@", "\t", "\r") else value


def print_table(rows: List[Row]) -> None:
    headers = ["Caregiver", "Credential", "Expires", "Days left"]
    body = [[r.caregiver, r.credential, r.expires.isoformat(), str(r.days_left)] for r in rows]
    widths = [max(len(h), *(len(line[i]) for line in body)) if body else len(h) for i, h in enumerate(headers)]
    fmt = "  ".join(f"{{:<{w}}}" for w in widths)
    print(fmt.format(*headers))
    print(fmt.format(*("-" * w for w in widths)))
    for line in body:
        print(fmt.format(*line))


def write_csv(path: str, rows: List[Row]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["caregiver", "caregiver_id", "credential", "expires", "days_left"])
        for r in rows:
            writer.writerow([spreadsheet_safe(r.caregiver), r.caregiver_id, spreadsheet_safe(r.credential), r.expires.isoformat(), r.days_left])


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Report caregiver credentials that expire soon.")
    parser.add_argument("--days", type=int, default=30, help="look this many days ahead (default 30)")
    parser.add_argument("--include-expired", action="store_true", help="also list credentials that already expired")
    parser.add_argument("--csv", metavar="FILE", help="write a CSV file instead of printing a table")
    parser.add_argument("--page-size", type=int, default=100, help="records per request, 1 to 100 (default 100, the fewest requests)")
    parser.add_argument("--as-of", metavar="YYYY-MM-DD", help="treat this as today (default: today, UTC)")
    args = parser.parse_args(argv)
    if args.days < 0:
        parser.error("--days must be zero or more")
    if not 1 <= args.page_size <= 100:
        parser.error("--page-size must be from 1 to 100")
    today = parse_day(args.as_of) if args.as_of else datetime.now(timezone.utc).date()
    if today is None:
        parser.error("--as-of must look like 2026-10-05")

    load_dotenv()
    client = AveeCare()  # AVEECARE_API_KEY, and AVEECARE_BASE_URL when set, come from the environment
    try:
        # Iterating a page walks every following page too.
        caregivers = list(client.caregivers.list(status="Active", limit=args.page_size))
        certifications = list(client.certifications.list(limit=args.page_size))
    except AveeCareError as err:
        print(f"AveeCare error: {err}", file=sys.stderr)
        return 1

    rows = find_expiring(caregivers, certifications, today, args.days, args.include_expired)
    if args.csv:
        write_csv(args.csv, rows)
        print(f"Wrote {len(rows)} row(s) to {args.csv}")
    elif rows:
        print(f"Credentials expiring within {args.days} days of {today.isoformat()} ({len(caregivers)} active caregivers checked):\n")
        print_table(rows)
    else:
        print(f"Nothing expires within {args.days} days of {today.isoformat()} ({len(caregivers)} active caregivers checked).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
