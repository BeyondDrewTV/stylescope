"""
StyleScope Bulk Import Script
Imports romance books from CSV into stylescope.db

Usage:
    python -m backend.bulk_import romance_books_1000.csv
    python -m backend.bulk_import --preview romance_books_1000.csv

Features:
- Flexible column mapping (Title/title/book_title → title)
- Duplicate detection with normalized string matching
- Optional --preview mode (dry run)
- Adds search_normalized column for future fuzzy search
- Reuses existing DB helpers from backend.api
"""

import argparse
import csv
import os
import re
import sys
from datetime import datetime

# Import existing helpers from api
from backend.api import get_conn, _safe_int



# ---------------------------------------------------------------------------
# String normalization
# ---------------------------------------------------------------------------

def normalize_for_comparison(text: str) -> str:
    """
    Normalize text for duplicate detection.
    - Lowercase
    - Strip leading/trailing whitespace
    - Collapse internal whitespace to single spaces
    """
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text.strip().lower())


# SEARCH_NORMALIZED COLUMN
def normalize_for_search(text: str) -> str:
    """
    Normalize text for fuzzy search indexing.
    - Lowercase
    - Strip punctuation: . , ' : ; -
    - Collapse whitespace to single spaces
    """
    if not text:
        return ""
    # Remove common punctuation
    text = re.sub(r'[.,\':;-]', '', text)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text.strip().lower())
    return text


# ---------------------------------------------------------------------------
# Column mapping
# ---------------------------------------------------------------------------

def map_columns(headers: list) -> dict:
    """
    Map CSV column headers to database fields (case-insensitive).
    
    Mappings:
    - Title / title / book_title / name → title
    - Author / author / writer → author  
    - Series / series_name / series → seriesName
    
    Returns dict: {db_field: csv_column_name or None}
    """
    headers_lower = {h.lower().strip(): h for h in headers}
    
    mapping = {}
    
    # Title mapping
    for variant in ['title', 'book_title', 'name']:
        if variant in headers_lower:
            mapping['title'] = headers_lower[variant]
            break
    else:
        mapping['title'] = None
    
    # Author mapping
    for variant in ['author', 'writer']:
        if variant in headers_lower:
            mapping['author'] = headers_lower[variant]
            break
    else:
        mapping['author'] = None
    
    # Series mapping
    for variant in ['series', 'series_name']:
        if variant in headers_lower:
            mapping['seriesName'] = headers_lower[variant]
            break
    else:
        mapping['seriesName'] = None
    
    return mapping


# ---------------------------------------------------------------------------
# Database migration
# ---------------------------------------------------------------------------

# SEARCH_NORMALIZED COLUMN
def ensure_search_normalized_column(conn) -> None:
    """
    Add search_normalized column if it doesn't exist.
    Backfill existing rows with normalized search text.
    """
    c = conn.cursor()
    
    # Try to add column (idempotent)
    try:
        c.execute("ALTER TABLE books ADD COLUMN search_normalized TEXT")
        print("[migration] Added search_normalized column to books table")
        conn.commit()
    except Exception:
        pass  # Column already exists
    
    # Backfill existing rows that have NULL search_normalized
    c.execute("""
        SELECT id, title, author FROM books
        WHERE search_normalized IS NULL
    """)
    rows = c.fetchall()
    
    if rows:
        print(f"[migration] Backfilling search_normalized for {len(rows)} existing books...")
        for row in rows:
            book_id = row['id']
            title = row['title'] or ""
            author = row['author'] or ""
            search_text = normalize_for_search(f"{title} {author}")
            c.execute(
                "UPDATE books SET search_normalized = ? WHERE id = ?",
                (search_text, book_id)
            )
        conn.commit()
        print(f"[migration] Backfill complete")


# ---------------------------------------------------------------------------
# Duplicate detection
# ---------------------------------------------------------------------------

def is_duplicate(conn, title: str, author: str) -> bool:
    """
    Check if book already exists using normalized comparison.
    Returns True if duplicate found.
    """
    c = conn.cursor()
    norm_title = normalize_for_comparison(title)
    norm_author = normalize_for_comparison(author)
    
    c.execute("""
        SELECT id FROM books
        WHERE LOWER(TRIM(title)) = ? AND LOWER(TRIM(author)) = ?
        LIMIT 1
    """, (norm_title, norm_author))
    
    return c.fetchone() is not None


# ---------------------------------------------------------------------------
# Import logic
# ---------------------------------------------------------------------------

def import_books(csv_path: str, preview: bool = False) -> tuple:
    """
    Import books from CSV into database.
    
    Returns: (imported_count, skipped_count)
    """
    if not os.path.exists(csv_path):
        print(f"[error] CSV file not found: {csv_path}")
        sys.exit(1)
    
    conn = get_conn()
    c = conn.cursor()
    
    # SEARCH_NORMALIZED COLUMN - Ensure column exists and backfill
    if not preview:
        ensure_search_normalized_column(conn)
    
    imported = 0
    skipped = 0
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            # Map CSV columns to DB fields
            headers = reader.fieldnames or []
            col_map = map_columns(headers)
            
            print(f"[info] Column mapping detected:")
            for db_field, csv_col in col_map.items():
                status = csv_col if csv_col else "NOT FOUND (will use NULL)"
                print(f"  {db_field:12} ← {status}")
            print()
            
            if preview:
                print("[PREVIEW MODE] Will NOT write to database\n")
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (1 is header)
                # Extract and clean values
                title = ""
                author = ""
                series_name = None
                
                if col_map['title']:
                    title = (row.get(col_map['title']) or "").strip()
                if col_map['author']:
                    author = (row.get(col_map['author']) or "").strip()
                if col_map['seriesName'] and row.get(col_map['seriesName']):
                    series_name = row.get(col_map['seriesName']).strip()
                    if not series_name:  # Empty string becomes NULL
                        series_name = None
                
                # Validation: skip if missing title or author
                if not title or not author:
                    if preview:
                        print(f"[skip] Row {row_num}: Missing title or author")
                    skipped += 1
                    continue
                
                # Duplicate detection
                if not preview and is_duplicate(conn, title, author):
                    if preview:
                        print(f"[skip] Row {row_num}: Duplicate - '{title}' by {author}")
                    skipped += 1
                    continue
                
                # Preview output
                if preview:
                    series_info = f", series: {series_name}" if series_name else ""
                    print(f"[would import] '{title}' by {author}{series_info}")
                    imported += 1
                    continue
                
                # SEARCH_NORMALIZED COLUMN - Generate search text
                search_text = normalize_for_search(f"{title} {author}")
                
                # Insert into database
                try:
                    c.execute("""
                        INSERT INTO books
                            (title, author, seriesName, qualityScore, technicalQuality,
                             proseStyle, pacing, readability, craftExecution,
                             confidenceLevel, spiceLevel, voteCount, rating, readers,
                             scoredDate, isIndie, seriesIsComplete, search_normalized)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        title,
                        author,
                        series_name,
                        0,  # qualityScore
                        0,  # technicalQuality
                        0,  # proseStyle
                        0,  # pacing
                        0,  # readability
                        0,  # craftExecution
                        "unknown",  # confidenceLevel
                        0,  # spiceLevel
                        None,  # voteCount
                        None,  # rating
                        None,  # readers
                        None,  # scoredDate
                        0,  # isIndie
                        0,  # seriesIsComplete
                        search_text,  # search_normalized
                    ))
                    imported += 1
                    
                except Exception as e:
                    print(f"[error] Row {row_num}: Failed to insert '{title}' - {e}")
                    skipped += 1
        
        if not preview:
            conn.commit()
            print(f"\n[success] Imported {imported} books ({skipped} skipped: already existed or invalid).")
        else:
            print(f"\n[preview] Would import {imported} books ({skipped} would be skipped).")
    
    except Exception as e:
        print(f"[fatal error] {e}")
        sys.exit(1)
    
    finally:
        conn.close()
    
    return imported, skipped


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Bulk import romance books from CSV into StyleScope database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m backend.bulk_import romance_books_1000.csv
  python -m backend.bulk_import --preview romance_books_1000.csv
        """
    )
    
    parser.add_argument(
        'csv_file',
        help='Path to CSV file with book data'
    )
    
    parser.add_argument(
        '--preview',
        action='store_true',
        help='Preview what would be imported without writing to database'
    )
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("StyleScope Bulk Import")
    print("=" * 70)
    print(f"CSV file: {args.csv_file}")
    print(f"Mode: {'PREVIEW (dry run)' if args.preview else 'IMPORT (will write to DB)'}")
    print("=" * 70)
    print()
    
    import_books(args.csv_file, preview=args.preview)
    
    print("\n[done] Import complete!")


if __name__ == "__main__":
    main()
