"""
Hardcover GraphQL API client for StyleScope.

Primary data source for book metadata and reviews.
Uses Hardcover's GraphQL API at https://api.hardcover.app/v1/graphql

Docs: https://docs.hardcover.app/api/getting-started/
"""

import os
import re
import logging
import time
from pathlib import Path
from typing import Optional, Dict, Any, List

import requests
from dotenv import load_dotenv

# Load .env from project root
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

logger = logging.getLogger(__name__)

HARDCOVER_ENDPOINT = "https://api.hardcover.app/v1/graphql"
HARDCOVER_API_KEY = os.getenv("HARDCOVER_API_KEY")


class HardcoverError(Exception):
    pass


# ---------------------------------------------------------------------------
# Low-level GraphQL request
# ---------------------------------------------------------------------------

def _hc_request(query: str, variables: dict, retries: int = 2) -> dict:
    """Execute a GraphQL request against Hardcover API with retry."""
    if not HARDCOVER_API_KEY:
        raise HardcoverError("HARDCOVER_API_KEY not set in environment")

    headers = {
    "Authorization": HARDCOVER_API_KEY,
    "Content-Type": "application/json",
}
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            resp = requests.post(
                HARDCOVER_ENDPOINT,
                json={"query": query, "variables": variables},
                headers=headers,
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()

            if "errors" in data:
                err_msg = str(data["errors"])
                logger.warning(f"Hardcover GraphQL errors: {err_msg}")
                # Some errors are non-fatal (partial data returned)
                if "data" in data and data["data"]:
                    return data["data"]
                raise HardcoverError(err_msg)

            return data["data"]

        except requests.exceptions.RequestException as e:
            last_err = e
            logger.warning(
                f"Hardcover request attempt {attempt}/{retries} failed: {e}"
            )
            if attempt < retries:
                time.sleep(2 * attempt)

    raise HardcoverError(f"All {retries} attempts failed: {last_err}")


# ---------------------------------------------------------------------------
# Search query — uses Hardcover's Typesense-backed search
# ---------------------------------------------------------------------------

SEARCH_QUERY = """
query SearchBooks($query: String!) {
  search(
    query: $query,
    query_type: "books",
    per_page: 5,
    page: 1
  ) {
    results
  }
}
"""

# ---------------------------------------------------------------------------
# Book detail query — fetches full data by book ID
# ---------------------------------------------------------------------------

BOOK_DETAIL_QUERY = """
query BookDetail($id: Int!) {
  books_by_pk(id: $id) {
    id
    title
    slug
    description
    pages
    release_date
    rating
    ratings_count
    users_read_count
    users_count
    cached_tags
    cached_contributors
    contributions {
      author {
        name
      }
    }
    editions {
      isbn_10
      isbn_13
    }
  }
}
"""

# ---------------------------------------------------------------------------
# Books by title query — direct table lookup
# ---------------------------------------------------------------------------

BOOKS_BY_TITLE_QUERY = """
query BooksByTitle($title: String!) {
  books(
    where: { title: { _ilike: $title } }
    limit: 5
    order_by: { users_count: desc }
  ) {
    id
    title
    slug
    description
    pages
    release_date
    rating
    ratings_count
    users_read_count
    users_count
    cached_tags
    cached_contributors
    contributions {
      author {
        name
      }
    }
    editions {
      isbn_10
      isbn_13
    }
  }
}
"""

# ---------------------------------------------------------------------------
# User reviews for a book — fetches community reviews
# ---------------------------------------------------------------------------

BOOK_REVIEWS_QUERY = """
query BookReviews($book_id: Int!) {
  user_books(
    where: {
      _and: [
        { book_id: { _eq: $book_id } },
        { has_review: { _eq: true } }
      ]
    }
    limit: 30
    order_by: { reviewed_at: desc }
  ) {
    rating
    review_raw
    reviewed_at
  }
}
"""


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def _normalize_title(title: str) -> str:
    """Normalize title for comparison (lowercase, strip series info)."""
    t = title.lower().strip()
    # Remove series info in parens: "Paper Hearts (Hearts, #2)" -> "paper hearts"
    t = re.sub(r"\s*\(.*?\)\s*", " ", t).strip()
    return t


def _title_match_score(query_title: str, candidate_title: str) -> int:
    """Score how well a candidate title matches the query. Higher = better."""
    qt = _normalize_title(query_title)
    ct = _normalize_title(candidate_title)

    if qt == ct:
        return 3  # exact
    if ct.startswith(qt) or qt.startswith(ct):
        return 2  # prefix
    if qt in ct or ct in qt:
        return 1  # substring
    return 0


def _extract_authors(book: dict) -> List[str]:
    """Extract author names from a Hardcover book object."""
    authors = []

    # Try contributions first (structured data)
    contributions = book.get("contributions") or []
    for c in contributions:
        author = c.get("author", {})
        name = author.get("name")
        if name:
            authors.append(name)

    # Fallback to cached_contributors
    if not authors:
        cached = book.get("cached_contributors")
        if isinstance(cached, list):
            for c in cached:
                if isinstance(c, dict) and c.get("name"):
                    authors.append(c["name"])
                elif isinstance(c, str):
                    authors.append(c)
        elif isinstance(cached, str):
            authors.append(cached)

    return authors


def _extract_isbns(book: dict) -> Dict[str, Optional[str]]:
    """Extract ISBN-10 and ISBN-13 from editions."""
    isbn10 = None
    isbn13 = None
    editions = book.get("editions") or []
    for ed in editions:
        if ed.get("isbn_13") and not isbn13:
            isbn13 = ed["isbn_13"]
        if ed.get("isbn_10") and not isbn10:
            isbn10 = ed["isbn_10"]
        if isbn10 and isbn13:
            break
    return {"isbn10": isbn10, "isbn13": isbn13}


def _extract_genres(book: dict) -> List[str]:
    """Extract genre/tag names from cached_tags."""
    tags = book.get("cached_tags") or []
    genres = []
    if isinstance(tags, list):
        for t in tags:
            if isinstance(t, dict):
                name = t.get("tag") or t.get("name") or t.get("genre")
                if name:
                    genres.append(name)
            elif isinstance(t, str):
                genres.append(t)
    return genres[:10]  # cap at 10


def _normalize_book(raw: dict) -> Dict[str, Any]:
    """Normalize a raw Hardcover book object into a clean dict."""
    isbns = _extract_isbns(raw)
    return {
        "id": raw.get("id"),
        "title": raw.get("title", ""),
        "slug": raw.get("slug"),
        "description": raw.get("description"),
        "authors": _extract_authors(raw),
        "isbn10": isbns["isbn10"],
        "isbn13": isbns["isbn13"],
        "pages": raw.get("pages"),
        "release_date": raw.get("release_date"),
        "average_rating": raw.get("rating"),
        "ratings_count": raw.get("ratings_count"),
        "users_read_count": raw.get("users_read_count"),
        "users_count": raw.get("users_count"),
        "genres": _extract_genres(raw),
        "reviews": [],  # populated separately
    }


def search_books(title: str, author: str = "") -> List[Dict[str, Any]]:
    """
    Search Hardcover for books matching title (and optionally author).
    Returns normalized book dicts, best matches first.
    Uses multiple fallback strategies to find books.
    """
    # Strategy 1: Direct title query with LIKE matching (MOST RELIABLE)
    logger.info(f"Hardcover search: trying title query for '{title}'")
    try:
        data = _hc_request(BOOKS_BY_TITLE_QUERY, {"title": f"%{title}%"})
        books = data.get("books") or []
        if books:
            normalized = [_normalize_book(b) for b in books]
            logger.info(f"Title query found {len(normalized)} results")
            return normalized
        else:
            logger.debug(f"Title query returned empty books list")
    except HardcoverError as e:
        logger.warning(f"Title query failed: {e}")

    # Strategy 2: Try title + author together
    if author.strip():
        logger.info(f"Hardcover search: trying title+author query")
        try:
            # Search for title that matches and filter by approximate author
            data = _hc_request(BOOKS_BY_TITLE_QUERY, {"title": f"%{title}%"})
            books = data.get("books") or []
            if books:
                # Return all matches - caller will pick best match
                normalized = [_normalize_book(b) for b in books]
                logger.info(f"Title+author query found {len(normalized)} results")
                return normalized
        except HardcoverError as e:
            logger.warning(f"Title+author query failed: {e}")

    # Strategy 3: Try Typesense search (if it works better for your API)
    logger.info(f"Hardcover search: trying Typesense search")
    search_term = f"{title} {author}".strip() if author.strip() else title.strip()
    try:
        data = _hc_request(SEARCH_QUERY, {"query": search_term})
        logger.debug(f"Typesense search response: {data}")
        results = data.get("search", {}).get("results") or []
        if results and isinstance(results, list):
            logger.info(f"Typesense search found {len(results)} results")
            books = []
            for hit in results:
                doc = hit if isinstance(hit, dict) else {}
                if "document" in doc:
                    doc = doc["document"]
                book_id = doc.get("id")
                if book_id:
                    try:
                        detail = _hc_request(BOOK_DETAIL_QUERY, {"id": int(book_id)})
                        book_data = detail.get("books_by_pk")
                        if book_data:
                            books.append(_normalize_book(book_data))
                    except HardcoverError:
                        continue
            if books:
                return books
    except HardcoverError as e:
        logger.warning(f"Typesense search failed: {e}")

    logger.warning(f"All search strategies failed for '{title}'")
    return []


def fetch_reviews(book_id: int) -> List[Dict[str, Any]]:
    """Fetch community reviews for a book by Hardcover book ID."""
    try:
        data = _hc_request(BOOK_REVIEWS_QUERY, {"book_id": book_id})
    except HardcoverError as e:
        logger.warning(f"Failed to fetch reviews for book {book_id}: {e}")
        return []

    raw_reviews = data.get("user_books") or []
    reviews = []
    for r in raw_reviews:
        text = r.get("review_raw") or ""
        text = text.strip()
        if len(text) > 30:  # skip trivially short reviews
            reviews.append({
                "text": text,
                "rating": r.get("rating"),
                "reviewed_at": r.get("reviewed_at"),
            })

    return reviews


def fetch_hardcover_book(
    isbn: Optional[str] = None,
    title: Optional[str] = None,
    author: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Fetch book data + reviews from Hardcover.

    Tries search by title+author, then picks the best match.
    Returns a normalized dict with reviews attached, or None.
    """
    if not HARDCOVER_API_KEY:
        logger.warning("HARDCOVER_API_KEY not set — skipping Hardcover")
        return None

    if not title and not isbn:
        return None

    search_title = title or ""
    search_author = author or ""

    # Search for the book
    logger.info(f"Searching Hardcover for '{search_title}' by {search_author}...")
    candidates = search_books(search_title, search_author)

    if not candidates:
        logger.info("No Hardcover results found")
        return None

    # Pick best candidate (already sorted by match quality)
    best = candidates[0]
    logger.info(
        f"Hardcover match: '{best['title']}' by {', '.join(best['authors'])} "
        f"| id={best['id']} | ratings={best.get('ratings_count', 0)}"
    )

    # Fetch reviews for the best match
    if best.get("id"):
        reviews = fetch_reviews(best["id"])
        best["reviews"] = reviews
        logger.info(f"Fetched {len(reviews)} Hardcover reviews")

    return best
