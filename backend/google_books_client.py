"""
Google Books API client for StyleScope.

Fallback data source when Hardcover doesn't have enough context.
Uses the free Google Books API (no key required for basic queries).

Docs: https://developers.google.com/books/docs/v1/using
"""

import logging
import re
import time
from typing import Optional, Dict, Any, List

def _author_matches(author_lower: str, author_last: str, item_authors_joined: str) -> tuple[bool, int]:
    """
    Check if an author string matches item authors.
    Returns (matched: bool, score_bonus: int).
    Uses word-boundary regex to avoid 'nora' matching inside 'eleanor'.
    """
    if not author_lower:
        return False, 0
    # Full name match
    for part in item_authors_joined.split(","):
        part = part.strip()
        if author_lower in part or part in author_lower:
            return True, 3
    # Last name word-boundary match
    if author_last and re.search(r'\b' + re.escape(author_last) + r'\b', item_authors_joined):
        return True, 2
    return False, 0

import requests

logger = logging.getLogger(__name__)

GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes"


def _clean_html(text: str) -> str:
    """Strip HTML tags from Google Books descriptions."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", "", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def _search_google_books(query: str, max_results: int = 5) -> List[dict]:
    """Execute a Google Books search and return raw items."""
    try:
        resp = requests.get(
            GOOGLE_BOOKS_ENDPOINT,
            params={"q": query, "maxResults": max_results, "printType": "books"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", [])
    except requests.exceptions.RequestException as e:
        logger.warning(f"Google Books request failed: {e}")
        return []


def _normalize_item(item: dict) -> Dict[str, Any]:
    """Normalize a Google Books volume item into a clean dict."""
    vol = item.get("volumeInfo", {})
    return {
        "google_id": item.get("id"),
        "title": vol.get("title", ""),
        "subtitle": vol.get("subtitle"),
        "authors": vol.get("authors", []),
        "publisher": vol.get("publisher"),
        "published_date": vol.get("publishedDate"),
        "description": _clean_html(vol.get("description", "")),
        "isbn10": None,
        "isbn13": None,
        "page_count": vol.get("pageCount"),
        "categories": vol.get("categories", []),
        "average_rating": vol.get("averageRating"),
        "ratings_count": vol.get("ratingsCount"),
        "language": vol.get("language"),
        "preview_link": vol.get("previewLink"),
    }


def _extract_isbns(item: dict) -> Dict[str, Optional[str]]:
    """Extract ISBNs from industry identifiers."""
    vol = item.get("volumeInfo", {})
    identifiers = vol.get("industryIdentifiers", [])
    isbn10 = None
    isbn13 = None
    for ident in identifiers:
        id_type = ident.get("type", "")
        if id_type == "ISBN_13":
            isbn13 = ident.get("identifier")
        elif id_type == "ISBN_10":
            isbn10 = ident.get("identifier")
    return {"isbn10": isbn10, "isbn13": isbn13}


def fetch_google_book(
    isbn: Optional[str] = None,
    title: Optional[str] = None,
    author: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Fetch book data from Google Books API.

    Search priority:
      1. ISBN lookup (most precise)
      2. Title + Author search
      3. Title-only search

    Returns a normalized dict or None.
    """
    items = []

    # Strategy 1: ISBN lookup
    if isbn:
        isbn_clean = isbn.strip().replace("-", "")
        logger.info(f"Google Books: searching by ISBN {isbn_clean}")
        items = _search_google_books(f"isbn:{isbn_clean}", max_results=1)

    # Strategy 2: Title + Author
    if not items and title:
        query_parts = []
        if title:
            query_parts.append(f"intitle:{title.strip()}")
        if author:
            query_parts.append(f"inauthor:{author.strip()}")
        query = "+".join(query_parts)
        logger.info(f"Google Books: searching '{query}'")
        items = _search_google_books(query, max_results=5)

    # Strategy 3: Title only (broader) — only when no author is known
    if not items and title and not author:
        logger.info(f"Google Books: broad title search '{title}'")
        items = _search_google_books(title.strip(), max_results=5)

    if not items:
        logger.info("Google Books: no results found")
        return None

    # Pick the best match
    best = None
    best_score = -1
    title_lower = (title or "").lower().strip()
    author_lower = (author or "").lower().strip()

    # Build last-name token for looser author matching (e.g. "darling" from "Giana Darling")
    author_last = author_lower.split()[-1] if author_lower else ""

    for item in items:
        vol = item.get("volumeInfo", {})
        item_title = (vol.get("title") or "").lower()
        item_authors_raw = vol.get("authors") or []
        item_authors = [a.lower() for a in item_authors_raw]
        item_authors_joined = " ".join(item_authors)

        score = 0
        author_matched = False

        # Title matching
        if title_lower and title_lower == item_title:
            score += 3
        elif title_lower and title_lower in item_title:
            score += 2
        elif title_lower and item_title in title_lower:
            score += 1

        # Author matching — word-boundary safe
        if author_lower:
            matched, bonus = _author_matches(author_lower, author_last, item_authors_joined)
            if matched:
                score += bonus
                author_matched = True

        # Prefer items with descriptions
        if vol.get("description"):
            score += 1

        # Prefer items with more ratings (capped contribution)
        score += min((vol.get("ratingsCount") or 0) / 1000, 1)

        if score > best_score:
            best_score = score
            best = item

    if not best:
        return None

    # Reject the match if we have an author and it didn't match at all
    # (prevents cross-author false positives like Darling→Lark)
    if author_lower:
        vol = best.get("volumeInfo", {})
        item_authors_joined = " ".join(
            a.lower() for a in (vol.get("authors") or [])
        )
        matched, _ = _author_matches(author_lower, author_last, item_authors_joined)
        if not matched:
            logger.warning(
                f"Google Books: best match author '{item_authors_joined}' "
                f"doesn't match '{author}' — discarding"
            )
            return None

    result = _normalize_item(best)
    isbns = _extract_isbns(best)
    result["isbn10"] = isbns["isbn10"]
    result["isbn13"] = isbns["isbn13"]

    logger.info(
        f"Google Books match: '{result['title']}' "
        f"by {', '.join(result['authors'])}"
    )
    return result
