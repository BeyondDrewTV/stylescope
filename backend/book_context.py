"""
Unified Book Context Fetcher for StyleScope.

Orchestrates data sources into the context object passed to scorer.py:
  1. Hardcover (primary) — book metadata + community reviews
  2. Google Books (fallback) — description + metadata
  3. Existing reviews from DB (if any previous partial data)

The assembled context replaces the old Apify/Goodreads pipeline entirely.
"""

import logging
import re
import urllib.parse
import requests
from typing import Optional, Dict, Any, List

from backend.hardcover_client import fetch_hardcover_book
from backend.google_books_client import fetch_google_book

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Quality keyword filter (reused from old scrapers.utils)
# ---------------------------------------------------------------------------

QUALITY_KEYWORDS = [
    "readability", "readable", "read", "grammar", "grammatical", "typos",
    "editing", "prose", "writing style", "pacing", "polish", "flow",
    "sentence structure", "clunky", "smooth", "choppy", "confusing",
    "clear", "clarity", "well-written", "poorly written", "writing",
    "couldn't put down", "page-turner", "beautifully written",
    "stilted", "awkward", "flowed", "easy to read", "hard to follow",
    "purple prose", "cliché", "formulaic", "vivid", "descriptive",
    "repetitive", "well-crafted", "rushed", "dragged", "slow",
    "fast-paced", "polished", "unpolished", "first draft",
    "needed an editor", "editor", "well-edited", "plot hole",
    "continuity", "inconsistent", "dnf", "couldn't finish",
]

QUALITY_KEYWORDS_SET = {kw.lower() for kw in QUALITY_KEYWORDS}


def _is_quality_relevant(text: str) -> bool:
    """Check if text contains writing-quality keywords."""
    text_lower = text.lower()
    return any(kw in text_lower for kw in QUALITY_KEYWORDS_SET)


def _filter_quality_excerpts(
    reviews: List[str],
    max_excerpts: int = 80,
    min_length: int = 50,
    max_length: int = 600,
) -> List[str]:
    """
    Filter review texts to those mentioning writing quality,
    then truncate to max_length and deduplicate.
    """
    excerpts = []
    seen_prefixes = set()

    for text in reviews:
        text = text.strip()
        if len(text) < min_length:
            continue

        if not _is_quality_relevant(text):
            continue

        # Truncate long reviews
        if len(text) > max_length:
            text = text[:max_length].rsplit(" ", 1)[0] + "..."

        # Simple dedup by prefix
        prefix = text[:60].lower()
        if prefix in seen_prefixes:
            continue
        seen_prefixes.add(prefix)

        excerpts.append(text)
        if len(excerpts) >= max_excerpts:
            break

    return excerpts


# ---------------------------------------------------------------------------
# Open Library fallback (free, no API key required)
# ---------------------------------------------------------------------------

def fetch_open_library(
    title: str,
    author: str,
    isbn: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Fetch book metadata and ratings from Open Library.

    Tries ISBN lookup first (most precise), then title+author search.
    Returns a dict with average_rating, ratings_count, already_read_count,
    want_to_read_count, and work_key — or None on failure.
    """
    base = "https://openlibrary.org"

    def _get(url: str, params: dict | None = None) -> Optional[dict]:
        try:
            resp = requests.get(url, params=params, timeout=10)
            if resp.status_code == 200:
                return resp.json()
            logger.debug(f"Open Library {url} returned {resp.status_code}")
        except Exception as e:
            logger.debug(f"Open Library request failed: {e}")
        return None

    # ── Step 1: search for the best matching work ──
    search_params: dict[str, str] = {
        "fields": "key,title,author_name,ratings_average,ratings_count,"
                  "want_to_read_count,already_read_count",
        "limit": "1",
    }
    if isbn:
        search_params["isbn"] = isbn
    else:
        search_params["title"] = title
        search_params["author"] = author

    data = _get(f"{base}/search.json", search_params)
    if not data:
        return None

    docs = data.get("docs") or []
    if not docs:
        logger.debug(f"Open Library: no docs found for '{title}'")
        return None

    doc = docs[0]
    work_key: Optional[str] = doc.get("key")  # e.g. "/works/OL1234W"

    result: Dict[str, Any] = {
        "work_key": work_key,
        "title": doc.get("title"),
        "authors": doc.get("author_name", []),
        "ratings_average": doc.get("ratings_average"),
        "ratings_count": doc.get("ratings_count"),
        "want_to_read_count": doc.get("want_to_read_count"),
        "already_read_count": doc.get("already_read_count"),
    }

    # ── Step 2: fetch /works/<key>/ratings.json for richer signal ──
    if work_key:
        ratings_data = _get(f"{base}{work_key}/ratings.json")
        if ratings_data:
            summary = ratings_data.get("summary") or {}
            # Prefer the richer ratings endpoint values if present
            if summary.get("average") is not None:
                result["ratings_average"] = round(summary["average"], 2)
            if summary.get("count") is not None:
                result["ratings_count"] = summary["count"]

    logger.info(
        f"Open Library: '{result.get('title')}' | "
        f"rating={result.get('ratings_average')} ({result.get('ratings_count')} ratings) | "
        f"already_read={result.get('already_read_count')}"
    )
    return result


# ---------------------------------------------------------------------------
# Context builder
# ---------------------------------------------------------------------------

def build_context_text(
    title: str,
    author: str,
    hardcover_data: Optional[Dict[str, Any]] = None,
    google_data: Optional[Dict[str, Any]] = None,
    open_library_data: Optional[Dict[str, Any]] = None,
    quality_excerpts: Optional[List[str]] = None,
) -> str:
    """
    Assemble all available data into a single context string
    for the LLM scorer.
    """
    parts: List[str] = []

    parts.append(f"Title: {title}")
    parts.append(f"Author: {author}")

    # Hardcover metadata
    if hardcover_data:
        desc = hardcover_data.get("description")
        if desc:
            # Clean HTML if any leaked through
            desc = re.sub(r"<[^>]+>", "", desc).strip()
            parts.append(f"\n[Book Description (Hardcover)]\n{desc}")

        genres = hardcover_data.get("genres", [])
        if genres:
            parts.append(f"Genres: {', '.join(genres[:8])}")

        rating = hardcover_data.get("average_rating")
        ratings_count = hardcover_data.get("ratings_count")
        if rating:
            parts.append(
                f"Community Rating: {rating}/5 "
                f"({ratings_count or '?'} ratings)"
            )

    # Google Books fallback metadata
    elif google_data:
        desc = google_data.get("description")
        if desc:
            parts.append(f"\n[Book Description (Google Books)]\n{desc}")

        cats = google_data.get("categories", [])
        if cats:
            parts.append(f"Categories: {', '.join(cats)}")

    # Open Library supplemental ratings signal (additive, shown regardless of primary source)
    if open_library_data:
        ol_rating = open_library_data.get("ratings_average")
        ol_count = open_library_data.get("ratings_count")
        ol_read = open_library_data.get("already_read_count")
        ol_want = open_library_data.get("want_to_read_count")
        ol_parts: List[str] = []
        if ol_rating is not None:
            ol_parts.append(f"avg rating {ol_rating}/5 ({ol_count or '?'} ratings)")
        if ol_read is not None:
            ol_parts.append(f"{ol_read:,} readers have read it")
        if ol_want is not None:
            ol_parts.append(f"{ol_want:,} want to read it")
        if ol_parts:
            parts.append(f"Open Library: {', '.join(ol_parts)}")

    # Quality-focused review excerpts
    if quality_excerpts:
        parts.append(
            f"\n[Reader Reviews — {len(quality_excerpts)} quality-focused excerpts]"
        )
        for i, excerpt in enumerate(quality_excerpts, 1):
            parts.append(f'{i}. "{excerpt}"')
    else:
        parts.append(
            "\n(No reader reviews available — scoring based on "
            "book description and metadata only. Low confidence expected.)"
        )

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def fetch_book_context(
    title: str,
    author: str,
    isbn: Optional[str] = None,
    series: Optional[str] = None,
    genre: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch book data from all available sources and assemble scoring context.

    Returns:
        {
            "context_text": str,          # formatted text for LLM
            "quality_excerpts": list,      # filtered review excerpts
            "review_count": int,           # total reviews found
            "excerpt_count": int,          # quality-filtered count
            "context_source": str,         # "description_only" | "description+ratings" | "description+reviews"
            "ratings_count_estimate": int, # best available ratings count across all sources
            "meta": {
                "source": str,             # "hardcover", "google", "open_library", "none"
                "hardcover_id": int|None,
                "average_rating": float|None,
                "ratings_count": int|None,
                "genres": list,
                "description_length": int,
                "open_library": dict|None, # raw OL result if available
            }
        }
    """
    logger.info(f"fetch_book_context START: title='{title}', author='{author}', isbn={isbn}")

    # ── Step 1: Try Hardcover (primary) ──
    hc = None
    try:
        logger.info("Attempting Hardcover lookup...")
        hc = fetch_hardcover_book(isbn=isbn, title=title, author=author)
        if hc:
            logger.info(f"Hardcover SUCCESS: found '{hc.get('title')}', reviews={len(hc.get('reviews', []))}")
        else:
            logger.info("Hardcover returned None")
    except Exception as e:
        logger.warning(f"Hardcover fetch failed: {e}")

    # ── Step 2: Try Google Books (fallback) ──
    google = None
    if not hc or (not hc.get("description") and not hc.get("reviews")):
        try:
            logger.info("Attempting Google Books fallback...")
            google = fetch_google_book(isbn=isbn, title=title, author=author)
            if google:
                logger.info(f"Google Books SUCCESS: found '{google.get('title')}'")
            else:
                logger.info("Google Books returned None")
        except Exception as e:
            logger.warning(f"Google Books fetch failed: {e}")

    # ── Step 3: Try Open Library (free ratings/metadata fallback) ──
    open_library = None
    try:
        logger.info("Attempting Open Library lookup...")
        open_library = fetch_open_library(isbn=isbn, title=title, author=author)
        if open_library:
            logger.info(
                f"Open Library SUCCESS: ratings={open_library.get('ratings_count')}, "
                f"avg={open_library.get('ratings_average')}"
            )
        else:
            logger.info("Open Library returned None")
    except Exception as e:
        logger.warning(f"Open Library fetch failed: {e}")

    # ── Step 4: Collect all review texts ──
    all_review_texts: List[str] = []

    if hc and hc.get("reviews"):
        for r in hc["reviews"]:
            text = r.get("text", "") if isinstance(r, dict) else str(r)
            if text.strip():
                all_review_texts.append(text.strip())

    total_reviews = len(all_review_texts)

    # ── Step 5: Filter for quality-relevant excerpts ──
    quality_excerpts = _filter_quality_excerpts(all_review_texts)

    # If we have very few quality excerpts, include ALL reviews
    # (let the LLM figure out relevance)
    if len(quality_excerpts) < 3 and total_reviews > 0:
        logger.info(
            f"Only {len(quality_excerpts)} quality excerpts — "
            f"including all {total_reviews} reviews as fallback"
        )
        seen = {e[:60].lower() for e in quality_excerpts}
        for text in all_review_texts:
            prefix = text[:60].lower()
            if prefix not in seen and len(text) > 50:
                if len(text) > 600:
                    text = text[:600].rsplit(" ", 1)[0] + "..."
                quality_excerpts.append(text)
                seen.add(prefix)
                if len(quality_excerpts) >= 30:
                    break

    excerpt_count = len(quality_excerpts)

    # ── Step 6: Build context text ──
    context_text = build_context_text(
        title=title,
        author=author,
        hardcover_data=hc,
        google_data=google,
        open_library_data=open_library,
        quality_excerpts=quality_excerpts if quality_excerpts else None,
    )

    # ── Step 7: Build metadata ──
    description = ""
    if hc and hc.get("description"):
        description = hc["description"]
    elif google and google.get("description"):
        description = google["description"]

    source = "none"
    if hc:
        source = "hardcover"
    elif google:
        source = "google"
    elif open_library:
        source = "open_library"

    # Best ratings count across all sources
    ratings_count: Optional[int] = (
        (hc or {}).get("ratings_count")
        or (google or {}).get("ratings_count")
        or (open_library or {}).get("ratings_count")
    )
    try:
        ratings_count_estimate: int = int(ratings_count) if ratings_count is not None else 0
    except (TypeError, ValueError):
        logger.warning(f"Could not parse ratings_count value: {ratings_count!r} — defaulting to 0")
        ratings_count_estimate = 0

    # Best average rating across all sources
    average_rating = (
        (hc or {}).get("average_rating")
        or (google or {}).get("average_rating")
        or (open_library or {}).get("ratings_average")
    )

    # ── Step 8: Determine context_source label ──
    has_excerpts = excerpt_count > 0
    has_ratings = ratings_count_estimate > 0 or average_rating is not None
    if has_excerpts:
        context_source = "description+reviews"
    elif has_ratings:
        context_source = "description+ratings"
    else:
        context_source = "description_only"

    meta = {
        "source": source,
        "hardcover_id": hc.get("id") if hc else None,
        "average_rating": average_rating,
        "ratings_count": ratings_count_estimate or None,
        "genres": (hc or {}).get("genres", []) or (google or {}).get("categories", []),
        "description_length": len(description),
        "open_library": open_library,
    }

    logger.info(
        f"Context assembled: source={source}, context_source={context_source}, "
        f"{total_reviews} total reviews → {excerpt_count} quality excerpts, "
        f"ratings_count_estimate={ratings_count_estimate}, "
        f"description={len(description)} chars"
    )

    return {
        "context_text": context_text,
        "quality_excerpts": quality_excerpts,
        "review_count": total_reviews,
        "excerpt_count": excerpt_count,
        "context_source": context_source,
        "ratings_count_estimate": ratings_count_estimate,
        "meta": meta,
    }
