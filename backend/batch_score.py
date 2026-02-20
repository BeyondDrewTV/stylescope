# ========== BATCH SCORING SCRIPT ==========

"""
StyleScope Batch Scoring Script

Scores multiple books from the database using existing scoring system.

Usage:

python -m backend.batch_score --limit 50 --filter unscored --delay 2
python -m backend.batch_score --filter all --limit 10

CRITICAL: This script imports and reuses the existing, validated scoring system.
No changes to scoring algorithm - only batch processing logic.
"""

import argparse
import sys
import time
import logging
from datetime import datetime
from typing import Optional

from backend.api import get_conn, _safe_int
from backend import scorer
from backend.book_context import fetch_book_context  # NEW: hybrid context pipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def extract_spice_level(context_text: str) -> int:
    """
    Infer spice level from context text (0-6 scale).

    Uses keyword analysis across any review/description text in context.
    """
    review_text = context_text.lower()

    # Nuclear spice indicators (6)
    if any(
        word in review_text
        for word in ["erotica", "extremely explicit", "taboo", "very graphic"]
    ):
        return 6

    # Scorching (5)
    if any(
        word in review_text
        for word in ["scorching", "extremely spicy", "very explicit", "graphic sex"]
    ):
        return 5

    # Steamy (4)
    if any(
        word in review_text
        for word in ["steamy", "explicit", "hot scenes", "very spicy"]
    ):
        return 4

    # Hot (3)
    if any(
        word in review_text
        for word in ["spicy", "hot", "sex scenes", "explicit scenes"]
    ):
        return 3

    # Mild heat (2)
    if any(
        word in review_text
        for word in ["mild heat", "some spice", "sensual", "intimate"]
    ):
        return 2

    # Warm (1)
    if any(
        word in review_text
        for word in ["sweet", "fade to black", "closed door", "clean"]
    ):
        return 1

    # Default to 0 (Sweet/Clean) if no indicators
    return 0


def extract_content_warnings(context_text: str) -> list[str]:
    """
    Extract content warnings from context text.

    Returns list of warning strings.
    """
    text = context_text.lower()
    warnings: list[str] = []

    warning_keywords = {
        "violence": ["violence", "violent", "graphic violence"],
        "sexual assault": ["sexual assault", "rape", "non-con", "sa"],
        "dubious consent": ["dubcon", "dubious consent", "dub-con"],
        "abuse": ["abuse", "abusive", "domestic violence"],
        "self-harm": ["self harm", "self-harm", "cutting"],
        "suicide": ["suicide", "suicidal"],
        "drug use": ["drug use", "drugs", "addiction"],
        "death": ["major character death", "mcd"],
        "cheating": ["cheating", "infidelity"],
    }

    for warning, keywords in warning_keywords.items():
        if any(kw in text for kw in keywords):
            warnings.append(warning)

    return warnings


def extract_series_info(book_title: str) -> dict:
    """
    Attempt to extract series information from title.

    Returns dict with seriesName, seriesNumber, seriesTotal.
    """
    import re

    # Match patterns like "Title (Series Name, #1)" or "Title (Series #1)"
    series_match = re.search(r"\((.*?)[,\s]+#(\d+)\)", book_title)
    if series_match:
        series_name = series_match.group(1).strip()
        series_number = int(series_match.group(2))
        return {
            "seriesName": series_name,
            "seriesNumber": series_number,
            "seriesTotal": None,  # Can't determine from title alone
        }

    return {
        "seriesName": None,
        "seriesNumber": None,
        "seriesTotal": None,
    }


def score_single_book(book: dict, delay: float = 2.0) -> tuple[bool, Optional[str]]:
    """
    Score a single book using existing scoring system + new hybrid context.

    Returns:
        (success: bool, error_message: Optional[str])
    """
    title = book["title"]
    author = book["author"]
    book_id = book["id"]

    try:
        # Step 1: Build context from Hardcover/Google/retailers (NEW PIPELINE)
        logger.info(f"Building context for '{title}' by {author}...")
        ctx = fetch_book_context(
            isbn=book.get("isbn") or None,
            title=title,
            author=author,
        )
        context_text: str = ctx.get("context_text", "") or ""
        meta = ctx.get("meta", {}) or {}
        review_count = ctx.get("review_count", 0)  # Correct field name from fetch_book_context

        if not context_text.strip():
            logger.warning(f" No context found for '{title}'")
            return False, "No context available from data sources"

        source = meta.get('source', 'unknown')
        excerpt_count = ctx.get("excerpt_count", 0)
        logger.info(
            f" Context: {len(context_text)} chars from {source}, "
            f"reviews={review_count}, excerpts={excerpt_count}"
        )

        # Step 2: Score using scorer with context_text (NEW PIPELINE)
        logger.info(" Scoring with OpenRouter...")
        series_info = extract_series_info(title)

        scores = scorer.score_book(
            title=title,
            author=author,
            series=series_info["seriesName"] or "",
            genre="Romance",  # Default genre for now
            subgenre="",
            context_text=context_text,
            review_count=review_count,
        )

        scoring_status = scores.get("scoring_status", "unknown")
        
        # Check for errors or rate limiting
        if scoring_status == "error":
            error_msg = scores.get("flags", ["Unknown error"])[0]
            logger.warning(f" Scoring failed (error): {error_msg}")
            return False, error_msg
        
        if scoring_status == "temporarily_unavailable":
            # Rate limit - treat as retriable
            logger.warning(f" Scoring failed (rate limited): OpenRouter 429")
            return False, "Rate limited by OpenRouter, retry later"

        # Step 3: Extract metadata from context (only if we have reviews)
        # Don't extract warnings/spice from description alone — too much hallucination risk
        spice_level = 0
        content_warnings = []
        if review_count > 0:
            spice_level = extract_spice_level(context_text)
            content_warnings = extract_content_warnings(context_text)

        # Step 4: Update database
        conn = get_conn()
        c = conn.cursor()

        dimension_scores = scores.get("scores", {})
        overall_score = scores.get("overall_score")

        confidence_val = scores.get("confidence", 50)
        confidence_label = (
            "high" if confidence_val >= 70 else "medium" if confidence_val >= 40 else "low"
        )

        c.execute(
            """
            UPDATE books
            SET qualityScore = ?,
                technicalQuality = ?,   -- maps from grammar
                proseStyle = ?,         -- maps from prose
                pacing = ?,             -- maps from pacing
                readability = ?,        -- maps from readability
                craftExecution = ?,     -- maps from polish
                confidenceLevel = ?,
                voteCount = ?,          -- reuse as "review/ratings count" proxy
                spiceLevel = ?,
                contentWarnings = ?,
                seriesName = COALESCE(seriesName, ?),
                seriesNumber = COALESCE(seriesNumber, ?),
                scoredDate = ?
            WHERE id = ?
            """,
            (
                overall_score,
                dimension_scores.get("grammar", 0),
                dimension_scores.get("prose", 0),
                dimension_scores.get("pacing", 0),
                dimension_scores.get("readability", 0),
                dimension_scores.get("polish", 0),
                confidence_label,
                review_count,
                spice_level,
                str(content_warnings) if content_warnings else None,
                series_info["seriesName"],
                series_info["seriesNumber"],
                datetime.now().isoformat(),
                book_id,
            ),
        )

        conn.commit()
        conn.close()

        # Success output
        logger.info(
            f" ✓ Scored {overall_score}/100 ({confidence_label} confidence, "
            f"{review_count} reviews from {source})"
        )

        if series_info["seriesName"]:
            logger.info(
                f" Series: {series_info['seriesName']} #{series_info['seriesNumber']}"
            )
        if spice_level > 0:
            logger.info(f" Spice: {spice_level}/6")
        if content_warnings:
            logger.info(f" Warnings: {', '.join(content_warnings)}")

        # Rate limiting delay
        if delay > 0:
            time.sleep(delay)

        return True, None

    except Exception as e:
        logger.error(f" ✗ Error scoring '{title}': {str(e)}")
        return False, str(e)


def batch_score(
    limit: int = 10,
    filter_mode: str = "unscored",
    delay: float = 2.0,
) -> dict:
    """
    Score multiple books from database.

    Args:
        limit: Maximum number of books to score
        filter_mode: "unscored" (only qualityScore=0) or "all" (re-score everything)
        delay: Seconds to wait between books (rate limiting)

    Returns:
        dict with scoring statistics
    """
    conn = get_conn()
    c = conn.cursor()

    # Build query based on filter mode
    if filter_mode == "unscored":
        c.execute(
            """
            SELECT id, title, author, qualityScore, isbn
            FROM books
            WHERE qualityScore = 0 OR qualityScore IS NULL
            ORDER BY RANDOM()
            LIMIT ?
            """,
            (limit,),
        )
    else:  # "all"
        c.execute(
            """
            SELECT id, title, author, qualityScore, isbn
            FROM books
            ORDER BY RANDOM()
            LIMIT ?
            """,
            (limit,),
        )

    books_to_score = [dict(row) for row in c.fetchall()]
    conn.close()

    if not books_to_score:
        logger.info("No books found matching filter criteria")
        return {
            "scored": 0,
            "failed": 0,
            "skipped": 0,
            "average_quality": None,
        }

    logger.info(f"\n{'=' * 70}")
    logger.info(f"Batch Scoring: {len(books_to_score)} books")
    logger.info(f"Filter: {filter_mode} | Delay: {delay}s")
    logger.info(f"{'=' * 70}\n")

    start_time = time.time()
    scored_count = 0
    failed_count = 0
    failed_books = []
    total_quality = 0

    for idx, book in enumerate(books_to_score, 1):
        logger.info(f"[{idx}/{len(books_to_score)}] '{book['title']}' by {book['author']}")
        success, error = score_single_book(book, delay=delay)

        if success:
            scored_count += 1

            # Get the new score
            conn = get_conn()
            c = conn.cursor()
            c.execute("SELECT qualityScore FROM books WHERE id = ?", (book["id"],))
            row = c.fetchone()
            if row and row["qualityScore"] is not None:
                total_quality += row["qualityScore"]
            conn.close()
        else:
            failed_count += 1
            failed_books.append(
                {
                    "title": book["title"],
                    "author": book["author"],
                    "error": error or "Unknown error",
                }
            )

        logger.info("")  # Blank line between books

    elapsed_time = time.time() - start_time
    minutes = int(elapsed_time // 60)
    seconds = int(elapsed_time % 60)

    # Calculate average quality
    avg_quality = round(total_quality / scored_count) if scored_count > 0 else None

    # Estimate API cost (you can tweak this per-call estimate)
    estimated_cost = scored_count * 0.09

    logger.info(f"\n{'=' * 70}")
    logger.info("BATCH SCORING COMPLETE!")
    logger.info(f"{'=' * 70}")
    logger.info(f"Scored: {scored_count} books")
    logger.info(f"Failed: {failed_count} books")
    logger.info("Skipped: 0 books")
    if avg_quality is not None:
        logger.info(f"Average quality: {avg_quality}")
    logger.info(f"Total time: {minutes}m {seconds}s")
    logger.info(f"Cost estimate: ~${estimated_cost:.2f} (OpenRouter API usage)")

    if failed_books:
        logger.info("\nFailed books:")
        for fb in failed_books:
            logger.info(f" • '{fb['title']}' by {fb['author']}: {fb['error']}")
    logger.info(f"{'=' * 70}\n")

    return {
        "scored": scored_count,
        "failed": failed_count,
        "skipped": 0,
        "average_quality": avg_quality,
        "elapsed_seconds": int(elapsed_time),
        "estimated_cost": estimated_cost,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Batch score books using StyleScope's scoring system",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:

# Score 50 unscored books with 2s delay
python -m backend.batch_score --limit 50 --filter unscored --delay 2

# Re-score 10 random books
python -m backend.batch_score --limit 10 --filter all --delay 1

# Quick test with 5 books
python -m backend.batch_score --limit 5
""",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum number of books to score (default: 10)",
    )

    parser.add_argument(
        "--filter",
        choices=["unscored", "all"],
        default="unscored",
        help="Filter mode: 'unscored' (only books with qualityScore=0) or 'all' (re-score everything)",
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Delay in seconds between books for rate limiting (default: 2.0)",
    )

    args = parser.parse_args()

    try:
        batch_score(
            limit=args.limit,
            filter_mode=args.filter,
            delay=args.delay,
        )
    except KeyboardInterrupt:
        logger.info("\n\nBatch scoring interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n\nFatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
