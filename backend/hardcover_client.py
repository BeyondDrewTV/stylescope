"""
Hardcover GraphQL API client for StyleScope.

Primary data source for book metadata and reviews.
Uses Hardcover's GraphQL API at https://api.hardcover.app/v1/graphql

Docs: https://docs.hardcover.app/api/getting-started/

NOTE: The Hardcover public API does NOT permit _ilike / table-scan queries.
Only the `search` (Typesense) and `books_by_pk` queries are allowed.
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

# Strip any "Bearer " prefix the user may have included in the .env value
# so we never send "Bearer Bearer <token>" in the Authorization header.
_raw_hc_key = os.getenv("HARDCOVER_API_KEY") or ""
HARDCOVER_API_KEY = _raw_hc_key.removeprefix("Bearer ").strip() or None


class HardcoverError(Exception):
    pass


# ---------------------------------------------------------------------------
# Low-level GraphQL request
# ---------------------------------------------------------------------------

def _hc_request(query: str, variables: dict, retries: int = 2) -> dict:
    """Execute a GraphQL request against Hardcover API with retry."""
    if not HARDCOVER_API_KEY:
        raise HardcoverError("HARDCOVER_API_KEY not set in environment")

    # Log a short token preview on first use to confirm prefix stripping worked
    _preview = HARDCOVER_API_KEY[:20] + "..." if len(HARDCOVER_API_KEY) > 20 else HARDCOVER_API_KEY
    logger.debug(f"Hardcover auth token preview (should NOT start with 'Bearer'): {_preview}")

    headers = {
        "authorization": f"Bearer {HARDCOVER_API_KEY}",
        "content-type": "application/json",
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
# Book detail query — fetches full data by book ID (used for reviews)
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

# NOTE: BOOKS_BY_TITLE_QUERY (_ilike) has been removed — the Hardcover public
# API returns 403 for _ilike / table-scan operations. Use SEARCH_QUERY only.

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
    """Normalize a raw Hardcover book object (from books_by_pk) into a clean dict."""
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


def _normalize_search_doc(doc: dict) -> Dict[str, Any]:
    """
    Normalize a Typesense search hit document into the same shape as _normalize_book.

    The search document has a different structure from books_by_pk:
      - authors are in doc["author_names"] (list of strings)
      - genres are in doc["genres"] (list of strings)
      - isbns are in doc["isbns"] (flat list, mix of isbn10/isbn13)
      - description is in doc["description"]
      - id is a string, not int
    """
    # Extract authors from contributions (preferred) or author_names fallback
    authors: List[str] = []
    for c in (doc.get("contributions") or []):
        name = (c.get("author") or {}).get("name")
        if name:
            authors.append(name)
    if not authors:
        authors = [a for a in (doc.get("author_names") or []) if a]

    # Extract ISBNs from flat isbns list
    isbn10: Optional[str] = None
    isbn13: Optional[str] = None
    for raw_isbn in (doc.get("isbns") or []):
        s = str(raw_isbn).strip().replace("-", "")
        if len(s) == 13 and not isbn13:
            isbn13 = s
        elif len(s) == 10 and not isbn10:
            isbn10 = s

    genres = [g for g in (doc.get("genres") or []) if g]

    # id comes as string from Typesense
    raw_id = doc.get("id")
    book_id: Optional[int] = None
    try:
        book_id = int(raw_id) if raw_id is not None else None
    except (TypeError, ValueError):
        pass

    return {
        "id": book_id,
        "title": doc.get("title", ""),
        "slug": doc.get("slug"),
        "description": doc.get("description"),
        "authors": authors,
        "isbn10": isbn10,
        "isbn13": isbn13,
        "pages": doc.get("pages"),
        "release_date": doc.get("release_date"),
        "average_rating": doc.get("rating"),
        "ratings_count": doc.get("ratings_count"),
        "users_read_count": doc.get("users_read_count"),
        "users_count": doc.get("users_count"),
        "genres": genres[:10],
        "reviews": [],
    }


def search_books(title: str, author: str = "") -> List[Dict[str, Any]]:
    """
    Search Hardcover for books matching title (and optionally author).
    Returns normalized book dicts, best matches first.

    Uses Typesense search (the only permitted query type on the public API).
    Results are normalized directly from the search document — no extra
    books_by_pk round-trips needed at this stage.
    """
    search_term = f"{title} {author}".strip() if author.strip() else title.strip()
    logger.info(f"Hardcover search: Typesense query '{search_term}'")

    try:
        data = _hc_request(SEARCH_QUERY, {"query": search_term})
        # results is a dict: {"hits": [...], "found": N, ...}
        results = data.get("search", {}).get("results") or {}
        hits = results.get("hits") or [] if isinstance(results, dict) else []

        if not hits:
            logger.info(f"Hardcover Typesense: no hits for '{search_term}'")
            return []

        logger.info(f"Hardcover Typesense: {len(hits)} hits")
        books = []
        for hit in hits:
            doc = hit.get("document") if isinstance(hit, dict) else {}
            if doc:
                books.append(_normalize_search_doc(doc))

        return books

    except HardcoverError as e:
        logger.warning(f"Hardcover Typesense search failed: {e}")

    logger.warning(f"Hardcover search failed for '{title}'")
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

    # Pick best candidate: prefer author match over first result
    best = candidates[0]
    if search_author.strip():
        author_last = search_author.strip().lower().split()[-1]
        for candidate in candidates:
            candidate_authors = " ".join(a.lower() for a in candidate.get("authors", []))
            if re.search(r'\b' + re.escape(author_last) + r'\b', candidate_authors):
                best = candidate
                break
    logger.info(
        f"Hardcover match: '{best['title']}' by {', '.join(best['authors'])} "
        f"| id={best['id']} | ratings={best.get('ratings_count', 0)}"
    )

    # Fetch full detail (description + reviews) for the best match via books_by_pk.
    # The search document may lack a description; books_by_pk always has it.
    if best.get("id"):
        try:
            detail_data = _hc_request(BOOK_DETAIL_QUERY, {"id": int(best["id"])})
            book_detail = detail_data.get("books_by_pk")
            if book_detail:
                # Merge detail fields into best (description, isbn, genres, etc.)
                detailed = _normalize_book(book_detail)
                # Prefer detail values over search-doc values where available
                for field in ("description", "isbn10", "isbn13", "genres", "pages",
                              "release_date", "average_rating", "ratings_count",
                              "users_read_count", "users_count"):
                    if detailed.get(field) is not None:
                        best[field] = detailed[field]
        except HardcoverError as e:
            logger.warning(f"Could not fetch detail for book id={best['id']}: {e}")

        reviews = fetch_reviews(best["id"])
        best["reviews"] = reviews
        logger.info(f"Fetched {len(reviews)} Hardcover reviews")

    return best
