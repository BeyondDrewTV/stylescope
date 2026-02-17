#!/usr/bin/env python3
"""
StyleScope Book Scorer — CLI entry point.

Usage:
    python main.py --input input/books.csv --output output/scored_books.csv
    python main.py --input input/books.csv --output output/scored_books.csv --no-reddit
    python main.py --input input/books.csv --output output/scored_books.csv --dry-run
"""
import argparse
import logging
import sys
import time
import json
import pandas as pd
from pathlib import Path
from config import MIN_EXCERPTS_HIGH_CONFIDENCE, MIN_EXCERPTS_MED_CONFIDENCE, OUTPUT_COLUMNS, GEMINI_RPM_LIMIT

# ─── Logging setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("scorer.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="StyleScope automated book scorer")
    parser.add_argument("--input",    required=True,  help="Path to input CSV (Title,Author,Series,Genre,Subgenre)")
    parser.add_argument("--output",   required=True,  help="Path to output CSV")
    parser.add_argument("--no-reddit",action="store_true", help="Skip Reddit scraping (useful if no API keys)")
    parser.add_argument("--no-goodreads", action="store_true", help="Skip Goodreads scraping")
    parser.add_argument("--dry-run",  action="store_true", help="Print what would be scored, don't call APIs")
    parser.add_argument("--limit",    type=int, default=None, help="Only score first N books (for testing)")
    return parser.parse_args()


def load_input(path: str) -> pd.DataFrame:
    """Load and validate the input CSV."""
    df = pd.read_csv(path)
    required_cols = {"Title", "Author"}
    missing = required_cols - set(df.columns)
    if missing:
        logger.error(f"Input CSV missing required columns: {missing}")
        sys.exit(1)
    # Fill optional columns
    for col in ["Series", "Genre", "Subgenre"]:
        if col not in df.columns:
            df[col] = ""
    df = df.fillna("")
    logger.info(f"Loaded {len(df)} books from {path}")
    return df


def aggregate_excerpts(
    title: str, author: str, series: str,
    use_reddit: bool, use_goodreads: bool
) -> list[str]:
    """Gather review excerpts from all enabled sources."""
    excerpts = []

    if use_reddit:
        from scrapers.reddit import scrape_reddit
        try:
            reddit_excerpts = scrape_reddit(title, author, series)
            excerpts.extend(reddit_excerpts)
            logger.info(f"  Reddit: {len(reddit_excerpts)} excerpts")
        except Exception as e:
            logger.warning(f"  Reddit scrape failed: {e}")

    if use_goodreads:
        from scrapers.goodreads import scrape_goodreads
        try:
            gr_excerpts = scrape_goodreads(title, author, series)
            excerpts.extend(gr_excerpts)
            logger.info(f"  Goodreads: {len(gr_excerpts)} excerpts")
        except Exception as e:
            logger.warning(f"  Goodreads scrape failed: {e}")

    # Deduplicate across sources
    from scrapers.utils import deduplicate
    excerpts = deduplicate(excerpts)
    return excerpts


def result_to_row(book_row: pd.Series, result: dict) -> dict:
    """Flatten scoring result + original book data into a single output row."""
    scores = result.get("scores", {})
    flags  = result.get("flags", [])
    key_phrases = result.get("key_phrases", [])

    return {
        "Title":       book_row.get("Title", ""),
        "Author":      book_row.get("Author", ""),
        "Series":      book_row.get("Series", ""),
        "Genre":       book_row.get("Genre", ""),
        "Subgenre":    book_row.get("Subgenre", ""),
        "readability": scores.get("readability", ""),
        "grammar":     scores.get("grammar", ""),
        "polish":      scores.get("polish", ""),
        "prose":       scores.get("prose", ""),
        "pacing":      scores.get("pacing", ""),
        "overall_score":  result.get("overall_score", ""),
        "confidence":     result.get("confidence", ""),
        "review_count":   result.get("review_count", 0),
        "flags":          " | ".join(flags) if flags else "",
        "key_phrases":    " | ".join(key_phrases) if key_phrases else "",
        "scoring_status": result.get("scoring_status", "unknown"),
    }


def main():
    args = parse_args()
    df   = load_input(args.input)

    if args.limit:
        df = df.head(args.limit)
        logger.info(f"Limiting to first {args.limit} books (--limit)")

    if args.dry_run:
        logger.info("DRY RUN — printing books to score, no API calls")
        for _, row in df.iterrows():
            print(f"  • {row['Title']} by {row['Author']}  [{row['Genre']}]")
        return

    output_rows = []
    total       = len(df)
    
    # Rate limiting: 15 seconds between requests = 6 requests/min (well under 20/min limit)
    min_gap_sec = 15

    for i, (_, row) in enumerate(df.iterrows()):
        title   = row["Title"].strip()
        author  = row["Author"].strip()
        series  = row.get("Series", "").strip()
        genre   = row.get("Genre", "").strip()
        subgenre= row.get("Subgenre", "").strip()

        logger.info(f"\n[{i+1}/{total}] Scoring: '{title}' by {author}")

        try:
            # 1. Aggregate reviews
            excerpts = aggregate_excerpts(
                title, author, series,
                use_reddit=not args.no_reddit,
                use_goodreads=not args.no_goodreads,
            )

            if not excerpts:
                logger.warning(f"  No excerpts found — scoring with zero-signal prompt")

            # 2. Score via LLM
            from scorer import score_book
            result = score_book(title, author, series, genre, subgenre, excerpts)

            # 3. Log summary
            if result.get("scoring_status") == "ok":
                s = result["scores"]
                logger.info(
                    f"  ✓ Overall: {result['overall_score']} | "
                    f"R:{s.get('readability')} G:{s.get('grammar')} P:{s.get('polish')} "
                    f"Pr:{s.get('prose')} Pa:{s.get('pacing')} | "
                    f"Confidence: {result.get('confidence')}%"
                )
            else:
                logger.error(f"  ✗ Scoring failed: {result.get('flags')}")

            output_rows.append(result_to_row(row, result))

        except Exception as e:
            logger.error(f"  ✗ Unexpected error processing '{title}': {e}")
            # Create error result so CSV has a row
            error_result = {
                "book_title": title,
                "author": author,
                "scores": {},
                "overall_score": None,
                "confidence": 0,
                "flags": [f"processing_error: {str(e)}"],
                "review_count": 0,
                "key_phrases": [],
                "scoring_status": "error",
            }
            output_rows.append(result_to_row(row, error_result))

        # 4. Rate limiting
        if i < total - 1:
            time.sleep(min_gap_sec)

    # Write output CSV
    out_df = pd.DataFrame(output_rows)
    # Ensure all output columns present
    for col in OUTPUT_COLUMNS:
        if col not in out_df.columns:
            out_df[col] = ""
    out_df = out_df[OUTPUT_COLUMNS]

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    out_df.to_csv(args.output, index=False)
    logger.info(f"\nDone. Results written to: {args.output}")

    # Summary stats
    ok_mask  = out_df["scoring_status"] == "ok"
    err_mask = out_df["scoring_status"] == "error"
    logger.info(
        f"Summary: {ok_mask.sum()} scored successfully, "
        f"{err_mask.sum()} errors, "
        f"{(~ok_mask & ~err_mask).sum()} other"
    )
    if ok_mask.any():
        avg_overall = pd.to_numeric(out_df.loc[ok_mask, "overall_score"], errors="coerce").mean()
        logger.info(f"Average overall score: {avg_overall:.1f}")


if __name__ == "__main__":
    main()
