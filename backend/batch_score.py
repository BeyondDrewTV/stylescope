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

# Import existing scoring system - DO NOT MODIFY
from backend.api import get_conn, _safe_int
from backend import scorer
from backend.scrapers import goodreads

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


def extract_spice_level(reviews: list[str], book_info: dict) -> int:
    """
    Infer spice level from reviews (0-6 scale).
    Returns conservative estimate based on keyword analysis.
    """
    review_text = " ".join(reviews).lower()
    
    # Nuclear spice indicators (6)
    if any(word in review_text for word in ["erotica", "extremely explicit", "taboo", "very graphic"]):
        return 6
    
    # Scorching (5)
    if any(word in review_text for word in ["scorching", "extremely spicy", "very explicit", "graphic sex"]):
        return 5
    
    # Steamy (4)
    if any(word in review_text for word in ["steamy", "explicit", "hot scenes", "very spicy"]):
        return 4
    
    # Hot (3)
    if any(word in review_text for word in ["spicy", "hot", "sex scenes", "explicit scenes"]):
        return 3
    
    # Mild heat (2)
    if any(word in review_text for word in ["mild heat", "some spice", "sensual", "intimate"]):
        return 2
    
    # Warm (1)
    if any(word in review_text for word in ["sweet", "fade to black", "closed door", "clean"]):
        return 1
    
    # Default to 0 (Sweet/Clean) if no indicators
    return 0


def extract_content_warnings(reviews: list[str]) -> list[str]:
    """
    Extract content warnings from review text.
    Returns list of warning strings.
    """
    review_text = " ".join(reviews).lower()
    warnings = []
    
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
        if any(kw in review_text for kw in keywords):
            warnings.append(warning)
    
    return warnings


def extract_series_info(book_title: str) -> dict:
    """
    Attempt to extract series information from title.
    Returns dict with seriesName, seriesNumber, seriesTotal.
    """
    import re
    
    # Match patterns like "Title (Series Name, #1)" or "Title (Series #1)"
    series_match = re.search(r'\((.*?)[,\s]+#(\d+)\)', book_title)
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
    Score a single book using existing scoring system.
    
    Returns:
        (success: bool, error_message: Optional[str])
    """
    title = book["title"]
    author = book["author"]
    book_id = book["id"]
    
    try:
        # Step 1: Scrape Goodreads reviews using existing scraper
        logger.info(f"Scraping Goodreads for '{title}' by {author}...")
        reviews = goodreads.scrape_goodreads(title, author)
        
        if not reviews or len(reviews) == 0:
            logger.warning(f"  No reviews found for '{title}'")
            return False, "No reviews found on Goodreads"
        
        logger.info(f"  Found {len(reviews)} quality-focused reviews")
        
        # Step 2: Score using existing scorer
        logger.info(f"  Scoring with Gemini...")
        
        # Extract any series info from title
        series_info = extract_series_info(title)
        
        scores = scorer.score_book(
            title=title,
            author=author,
            series=series_info["seriesName"] or "",
            genre="Romance",  # Default genre
            subgenre="",
            excerpts=reviews,
        )
        
        if scores.get("scoring_status") == "error":
            error_msg = scores.get("flags", ["Unknown error"])[0]
            logger.warning(f"  Scoring failed: {error_msg}")
            return False, error_msg
        
        # Step 3: Extract metadata
        spice_level = extract_spice_level(reviews, scores)
        content_warnings = extract_content_warnings(reviews)
        
        # Step 4: Update database
        conn = get_conn()
        c = conn.cursor()
        
        # Map scorer dimensions to DB columns
        dimension_scores = scores.get("scores", {})
        
        c.execute("""
            UPDATE books
            SET qualityScore = ?,
                technicalQuality = ?,
                proseStyle = ?,
                pacing = ?,
                readability = ?,
                craftExecution = ?,
                confidenceLevel = ?,
                voteCount = ?,
                spiceLevel = ?,
                contentWarnings = ?,
                seriesName = COALESCE(seriesName, ?),
                seriesNumber = COALESCE(seriesNumber, ?),
                scoredDate = ?
            WHERE id = ?
        """, (
            scores["overall_score"],
            dimension_scores.get("grammar", 0),
            dimension_scores.get("prose", 0),
            dimension_scores.get("pacing", 0),
            dimension_scores.get("readability", 0),
            dimension_scores.get("polish", 0),
            "high" if scores.get("confidence", 50) >= 70 else "medium" if scores.get("confidence", 50) >= 40 else "low",
            len(reviews),
            spice_level,
            str(content_warnings) if content_warnings else None,
            series_info["seriesName"],
            series_info["seriesNumber"],
            datetime.now().isoformat(),
            book_id,
        ))
        
        conn.commit()
        conn.close()
        
        # Success output
        confidence = scores.get("confidence", 50)
        conf_label = "high" if confidence >= 70 else "medium" if confidence >= 40 else "low"
        
        logger.info(
            f"  ✓ Score: {scores['overall_score']} ({conf_label} confidence, {len(reviews)} reviews)"
        )
        
        if series_info["seriesName"]:
            logger.info(f"    Series: {series_info['seriesName']} #{series_info['seriesNumber']}")
        if spice_level > 0:
            logger.info(f"    Spice: {spice_level}/6")
        if content_warnings:
            logger.info(f"    Warnings: {', '.join(content_warnings)}")
        
        # Rate limiting delay
        if delay > 0:
            time.sleep(delay)
        
        return True, None
        
    except Exception as e:
        logger.error(f"  ✗ Error scoring '{title}': {str(e)}")
        return False, str(e)


def batch_score(
    limit: int = 10,
    filter_mode: str = "unscored",
    delay: float = 2.0
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
        c.execute("""
            SELECT id, title, author, qualityScore
            FROM books
            WHERE qualityScore = 0 OR qualityScore IS NULL
            ORDER BY RANDOM()
            LIMIT ?
        """, (limit,))
    else:  # "all"
        c.execute("""
            SELECT id, title, author, qualityScore
            FROM books
            ORDER BY RANDOM()
            LIMIT ?
        """, (limit,))
    
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
    
    logger.info(f"\n{'='*70}")
    logger.info(f"Batch Scoring: {len(books_to_score)} books")
    logger.info(f"Filter: {filter_mode} | Delay: {delay}s")
    logger.info(f"{'='*70}\n")
    
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
            if row:
                total_quality += row["qualityScore"]
            conn.close()
        else:
            failed_count += 1
            failed_books.append({
                "title": book["title"],
                "author": book["author"],
                "error": error or "Unknown error",
            })
        
        logger.info("")  # Blank line between books
    
    elapsed_time = time.time() - start_time
    minutes = int(elapsed_time // 60)
    seconds = int(elapsed_time % 60)
    
    # Calculate average quality
    avg_quality = round(total_quality / scored_count) if scored_count > 0 else None
    
    # Calculate estimated API cost (rough estimate: $0.09 per book)
    estimated_cost = scored_count * 0.09
    
    # Print summary
    logger.info(f"\n{'='*70}")
    logger.info("BATCH SCORING COMPLETE!")
    logger.info(f"{'='*70}")
    logger.info(f"Scored: {scored_count} books")
    logger.info(f"Failed: {failed_count} books")
    logger.info(f"Skipped: 0 books")
    if avg_quality:
        logger.info(f"Average quality: {avg_quality}")
    logger.info(f"Total time: {minutes}m {seconds}s")
    logger.info(f"Cost estimate: ~${estimated_cost:.2f} (OpenRouter API usage)")
    
    if failed_books:
        logger.info(f"\nFailed books:")
        for fb in failed_books:
            logger.info(f"  • '{fb['title']}' by {fb['author']}: {fb['error']}")
    
    logger.info(f"{'='*70}\n")
    
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
        description="Batch score books using StyleScope's existing scoring system",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Score 50 unscored books with 2s delay
  python -m backend.batch_score --limit 50 --filter unscored --delay 2
  
  # Re-score 10 random books
  python -m backend.batch_score --limit 10 --filter all --delay 1
  
  # Quick test with 5 books
  python -m backend.batch_score --limit 5
        """
    )
    
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum number of books to score (default: 10)"
    )
    
    parser.add_argument(
        "--filter",
        choices=["unscored", "all"],
        default="unscored",
        help="Filter mode: 'unscored' (only books with qualityScore=0) or 'all' (re-score everything)"
    )
    
    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Delay in seconds between books for rate limiting (default: 2.0)"
    )
    
    args = parser.parse_args()
    
    try:
        batch_score(
            limit=args.limit,
            filter_mode=args.filter,
            delay=args.delay
        )
    except KeyboardInterrupt:
        logger.info("\n\nBatch scoring interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n\nFatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
