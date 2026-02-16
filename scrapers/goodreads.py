"""Goodreads review scraper using BeautifulSoup."""
import time
import logging
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote_plus
from config import GOODREADS_DELAY_SEC, GOODREADS_MAX_PAGES, GOODREADS_HEADERS
from scrapers.utils import extract_quality_sentences, clean_text, deduplicate

logger = logging.getLogger(__name__)

GR_BASE        = "https://www.goodreads.com"
GR_SEARCH_URL  = "https://www.goodreads.com/search?q={query}&search_type=books"
GR_REVIEWS_URL = "https://www.goodreads.com/book/show/{book_id}/reviews?sort=helpful"


def _get(url: str, session: requests.Session) -> requests.Response | None:
    """GET with error handling and delay."""
    time.sleep(GOODREADS_DELAY_SEC)
    try:
        resp = session.get(url, headers=GOODREADS_HEADERS, timeout=15)
        resp.raise_for_status()
        return resp
    except requests.RequestException as e:
        logger.warning(f"Goodreads GET failed for {url}: {e}")
        return None


def _find_book_id(title: str, author: str, session: requests.Session) -> str | None:
    """Search Goodreads and return the book's numeric ID."""
    query = f"{title} {author}"
    url   = GR_SEARCH_URL.format(query=quote_plus(query))
    resp  = _get(url, session)
    if not resp:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # Try the search result table
    for row in soup.select("tr[itemtype='http://schema.org/Book']"):
        title_el = row.select_one(".bookTitle")
        author_el = row.select_one(".authorName")
        link_el   = row.select_one("a.bookTitle")
        if title_el and link_el:
            found_title  = title_el.get_text(strip=True).lower()
            found_author = author_el.get_text(strip=True).lower() if author_el else ""
            if title.lower() in found_title or found_title in title.lower():
                href = link_el.get("href", "")
                # href looks like /book/show/12345.Title_name
                parts = href.split("/show/")
                if len(parts) == 2:
                    book_id = parts[1].split(".")[0].split("-")[0].split("?")[0]
                    logger.info(f"Goodreads: found book_id={book_id} for '{title}'")
                    return book_id

    # Fallback: look for any /book/show/ link on the page
    for a in soup.select("a[href*='/book/show/']"):
        href = a.get("href", "")
        if "/book/show/" in href:
            book_id = href.split("/show/")[1].split(".")[0].split("?")[0]
            if book_id.isdigit():
                logger.info(f"Goodreads: fallback book_id={book_id} for '{title}'")
                return book_id

    logger.warning(f"Goodreads: could not find book_id for '{title}' by '{author}'")
    return None


def _scrape_reviews_page(url: str, session: requests.Session) -> list[str]:
    """Scrape quality-signal sentences from one Goodreads review page."""
    resp = _get(url, session)
    if not resp:
        return []

    soup     = BeautifulSoup(resp.text, "html.parser")
    excerpts = []

    # Standard review sections (Goodreads HTML varies; try several selectors)
    review_bodies = (
        soup.select("section.ReviewText__content")
        or soup.select("div.reviewText span[style]")
        or soup.select("div.review-text-content span")
        or soup.select("div.reviewText")
    )

    for block in review_bodies:
        text = clean_text(block.get_text(separator=" "))
        sents = extract_quality_sentences(text, max_sentences=6)
        excerpts.extend(sents)

    return excerpts


def scrape_goodreads(title: str, author: str, series: str = "") -> list[str]:
    """
    Scrape Goodreads for quality-signal review excerpts.
    Returns list of sentences containing writing quality signals.
    """
    session  = requests.Session()
    excerpts = []

    book_id = _find_book_id(title, author, session)
    if not book_id:
        logger.warning(f"Goodreads: skipping '{title}' — book not found.")
        return []

    # Scrape multiple pages of reviews
    for page in range(1, GOODREADS_MAX_PAGES + 1):
        url = f"{GR_BASE}/book/show/{book_id}?page={page}#reviews"
        sents = _scrape_reviews_page(url, session)
        excerpts.extend(sents)
        logger.debug(f"Goodreads page {page}: +{len(sents)} excerpts")

        if len(excerpts) >= 40:
            break

    result = deduplicate(excerpts)[:40]
    logger.info(f"Goodreads: found {len(result)} quality excerpts for '{title}'")
    return result
