"""
Backfill officialContentWarnings for books from CSV.
CSV columns:
  book_id, source, warnings, rawText

- book_id: integer id in books table
- source: publisher | author | book_trigger_warnings_api | manual
- warnings: semicolon-separated list of warnings (e.g. "sexual assault;suicide ideation")
- rawText: optional full warning text

Usage:
  python -m backend.backfill_official_warnings path/to/warnings.csv

This script updates the `officialContentWarnings` JSON column directly in the DB.
"""
import csv
import json
import sys
from backend.api import get_conn

ALLOWED_SOURCES = {"publisher", "author", "book_trigger_warnings_api", "manual"}


def backfill(csv_path: str, preview: bool = False):
    conn = get_conn()
    c = conn.cursor()

    updated = 0
    skipped = 0

    with open(csv_path, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            bid = row.get('book_id') or row.get('id')
            source = (row.get('source') or '').strip()
            warnings_raw = row.get('warnings') or ''
            raw_text = row.get('rawText') or row.get('raw_text') or None

            try:
                book_id = int(bid)
            except Exception:
                print(f"[skip] invalid book_id: {bid}")
                skipped += 1
                continue

            if source not in ALLOWED_SOURCES:
                print(f"[skip] invalid source for book {book_id}: {source}")
                skipped += 1
                continue

            warnings = [w.strip() for w in warnings_raw.split(';') if w.strip()]
            if not warnings:
                print(f"[skip] no warnings for book {book_id}")
                skipped += 1
                continue

            doc = {"source": source, "warnings": warnings}
            if raw_text:
                doc['rawText'] = raw_text

            if preview:
                print(f"[preview] would set book {book_id} -> {doc}")
                updated += 1
                continue

            try:
                c.execute("UPDATE books SET officialContentWarnings = ? WHERE id = ?", (json.dumps(doc), book_id))
                updated += 1
            except Exception as e:
                print(f"[error] book {book_id}: {e}")
                skipped += 1

    if not preview:
        conn.commit()
    conn.close()

    print(f"Done. updated={updated}, skipped={skipped}")
    return updated, skipped


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python -m backend.backfill_official_warnings path/to/file.csv [--preview]")
        sys.exit(1)
    csv_path = sys.argv[1]
    preview = '--preview' in sys.argv[2:]
    backfill(csv_path, preview=preview)
