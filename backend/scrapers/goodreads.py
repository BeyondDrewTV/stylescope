
"""
Goodreads scraper using Apify API for robust review extraction.
Uses requests for book search, then Apify for review scraping.
"""
import re
import time
import random
import logging
import os
from typing import List, Optional
import requests
from bs4 import BeautifulSoup
from apify_client import ApifyClient
from pathlib import Path
from dotenv import load_dotenv


# Load .env from project root (one level above backend/)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)


logger = logging.getLogger(__name__)


# Browser-like headers for search requests
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
}


# Quality keywords to filter reviews
QUALITY_KEYWORDS = [
    'readability', 'readable', 'read',
    'grammar', 'grammatical', 'typos', 'typo',
    'editing', 'edited', 'editor',
    'prose', 'writing style', 'writing',
    'pacing', 'pace', 'paced',
    'polish', 'polished',
    'flow', 'flowed', 'flowing',
    'sentence structure', 'sentences',
    'clunky', 'smooth', 'choppy',
    'confusing', 'clear', 'clarity',
    'well-written', 'poorly written',
]

# Phrases that identify non-original editions to skip
NON_BOOK_PATTERNS = [
    'study guide',
    "teacher's edition",
    'teacher edition',
    'companion',
    'summary and analysis',
    'summary',
    'analysis',
    'a guide to',
    'guide to the novel',
    'workbook',
    'discussion guide',
    'the complete summary',
]


def search_goodreads_for_book_id(title: str, author: str) -> Optional[str]:
    """
    Search Goodreads and return the book_id for the best-matching result.

    Filtering logic (in order of priority):
      1. Skip results whose titles contain non-book phrases (study guides, etc.)
      2. Among remaining candidates, prefer the closest title match
      3. Break ties by rating count — most ratings wins
      4. Fall back to first non-filtered result if no ratings are visible
    """
    session = requests.Session()
    session.headers.update(HEADERS)

    try:
        query = f"{title} {author}".strip()
        url = f"https://www.goodreads.com/search?q={requests.utils.quote(query)}"
        logger.debug(f"Search URL: {url}")

        response = session.get(url, timeout=30)
        if response.status_code != 200:
            logger.warning(f"Search returned status {response.status_code}")
            logger.debug(f"Response preview: {response.text[:200]}")
            return None

        soup = BeautifulSoup(response.content, 'html.parser')

        # Each search hit lives in a <tr> with class 'bookContainer' or inside
        # a table row that holds a .bookTitle anchor.  Collect all rows.
        result_rows = (
            soup.select('tr[itemtype="http://schema.org/Book"]') or
            soup.select('table.tableList tr') or
            soup.select('tr')          # broad fallback
        )

        candidates = []

        for row in result_rows:
            # ── Extract title ──────────────────────────────────────────────
            title_tag = (
                row.select_one('a.bookTitle span[itemprop="name"]') or
                row.select_one('a.bookTitle') or
                row.select_one('.bookTitle')
            )
            if not title_tag:
                continue

            result_title = title_tag.get_text(strip=True)
            if not result_title:
                continue

            # ── Filter out non-original editions ──────────────────────────
            title_lower = result_title.lower()
            if any(pat in title_lower for pat in NON_BOOK_PATTERNS):
                logger.debug(f"Skipping non-book result: '{result_title}'")
                continue

            # ── Extract book ID ────────────────────────────────────────────
            link_tag = row.select_one('a.bookTitle') or row.select_one('a[href*="/book/show/"]')
            if not link_tag:
                continue

            href = link_tag.get('href', '')
            id_match = re.search(r'/book/show/(\d+)', href)
            if not id_match:
                continue

            book_id = id_match.group(1)

            # ── Extract rating count (may not be present on all layouts) ──
            rating_count = 0
            for elem in row.select('.minirating, .greyText.smallText'):
                text = elem.get_text()
                # Matches patterns like "60,342 ratings" or "60.3k ratings"
                count_match = re.search(r'([\d,]+)\s*rating', text)
                if count_match:
                    rating_count = int(count_match.group(1).replace(',', ''))
                    break

            # ── Score title similarity ────────────────────────────────────
            s = title.lower().strip()
            r = result_title.lower().strip()
            if s == r:
                title_score = 3          # exact match
            elif r.startswith(s):
                title_score = 2          # e.g. "Twisted Love (Twisted, #1)"
            elif s in r:
                title_score = 1          # search title appears somewhere in result
            else:
                title_score = 0          # no overlap — still include, just ranked last

            candidates.append({
                'book_id':     book_id,
                'title':       result_title,
                'rating_count': rating_count,
                'title_score': title_score,
            })

            logger.debug(
                f"Candidate: '{result_title}' | id={book_id} | "
                f"ratings={rating_count:,} | title_score={title_score}"
            )

        if not candidates:
            logger.warning("No valid candidates found after filtering")
            return None

        # ── Pick the best candidate ────────────────────────────────────────
        # Sort by: title_score DESC, then rating_count DESC
        candidates.sort(key=lambda c: (c['title_score'], c['rating_count']), reverse=True)

        best = candidates[0]
        logger.info(
            f"Best match: '{best['title']}' | id={best['book_id']} | "
            f"ratings={best['rating_count']:,} | title_score={best['title_score']}"
        )
        return best['book_id']

    except requests.Timeout:
        logger.warning("Search request timed out after 30 seconds")
        return None
    except Exception as e:
        logger.warning(f"Error in search_goodreads_for_book_id: {e}")
        return None
    finally:
        session.close()


def _filter_quality_reviews(reviews: List[str]) -> List[str]:
    """Filter reviews to only include those mentioning writing quality."""
    filtered = []
    
    for review in reviews:
        if not review or len(review) < 50:
            continue
        
        review_lower = review.lower()
        
        # Check if review mentions any quality keywords
        has_quality_mention = any(
            keyword in review_lower for keyword in QUALITY_KEYWORDS
        )
        
        if has_quality_mention:
            # Truncate to reasonable excerpt length (500 chars)
            if len(review) > 500:
                review = review[:497] + "..."
            
            filtered.append(review)
    
    return filtered


def _scrape_reviews_with_apify(book_id: str) -> List[str]:
    """Use Apify to scrape reviews for a given book ID."""
    try:
        # Get Apify API token
        apify_token = os.getenv('APIFY_API_TOKEN')
        if not apify_token:
            logger.error("APIFY_API_TOKEN not found in environment variables")
            return []
        
        # Initialize Apify client
        client = ApifyClient(apify_token)
        
        # Configure scraping run
        run_input = {
            "startUrls": [f"https://www.goodreads.com/book/show/{book_id}"],
            "includeReviews": True,
            "endPage": 3,  # Only first 3 pages = ~30 reviews
            "proxy": {"useApifyProxy": True}
        }
        
        logger.info(f"Starting Apify scrape for book ID {book_id}...")
        
        # Run the Apify actor
        run = client.actor("epctex/goodreads-scraper").call(run_input=run_input)
        
        # Wait a moment for results to be ready
        time.sleep(2)
        
        # Extract reviews from results
        reviews = []
        logger.info("Fetching results from Apify...")
        
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            if 'reviews' in item and item['reviews']:
                for review in item['reviews']:
                    if review.get('text'):
                        # Clean up the review text
                        text = review['text'].strip()
                        text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
                        
                        if text:
                            reviews.append(text)
        
        logger.info(f"Apify returned {len(reviews)} total reviews")
        return reviews
        
    except Exception as e:
        logger.error(f"Apify scraping failed: {e}")
        return []


def scrape_goodreads(
    title: str,
    author: str,
    series: str = "",
) -> List[str]:
    """
    Scrape review excerpts from Goodreads for a given book.
    
    Uses requests to search for the book, then Apify to scrape reviews.
    
    Args:
        title: Book title
        author: Author name
        series: Series name (optional, not used but kept for compatibility)
    
    Returns:
        List of review excerpt strings mentioning writing quality
    """
    logger.info(f"Scraping Goodreads for '{title}' by {author}")
    
    try:
        # Step 1: Search for the book and get its ID
        book_id = search_goodreads_for_book_id(title, author)
        
        if not book_id:
            logger.warning(f"Could not find book on Goodreads")
            return []
        
        # Polite delay before scraping reviews
        time.sleep(random.uniform(1, 2))
        
        # Step 2: Use Apify to scrape reviews
        all_reviews = _scrape_reviews_with_apify(book_id)

        if not all_reviews:
            logger.warning("No reviews found via Apify")
            return []

        # Step 3: Filter for quality-focused reviews
        quality_excerpts = _filter_quality_reviews(all_reviews)

        logger.info(
            f"Found {len(quality_excerpts)} quality excerpts "
            f"(from {len(all_reviews)} total reviews)"
        )

        return quality_excerpts
        
    except Exception as e:
        logger.error(f"Unexpected error in scrape_goodreads: {e}")
        return []


def test_goodreads_connection() -> bool:
    """Test if Goodreads is accessible for searches."""
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        
        response = session.get("https://www.goodreads.com", timeout=30)
        session.close()
        
        if response.status_code == 200:
            logger.info("✓ Goodreads connection successful")
            return True
        else:
            logger.warning(f"✗ Goodreads returned status {response.status_code}")
            logger.debug(f"Response preview: {response.text[:200]}")
            return False
            
    except Exception as e:
        logger.error(f"✗ Goodreads connection failed: {e}")
        return False


def _scrape_reviews_with_apify(book_id: str) -> List[str]:
    """Use Apify to scrape reviews for a given book ID."""
    try:
        # Get Apify API token
        apify_token = os.getenv('APIFY_API_TOKEN')
        if not apify_token:
            logger.error("APIFY_API_TOKEN not found in environment variables")
            return []
        
        # Initialize Apify client
        client = ApifyClient(apify_token)
        
        # Configure scraping run
        run_input = {
            "startUrls": [f"https://www.goodreads.com/book/show/{book_id}"],
            "includeReviews": True,
            "endPage": 3,  # Only first 3 pages = ~30 reviews
            "proxy": {"useApifyProxy": True}
        }
        
        logger.info(f"Starting Apify scrape for book ID {book_id}...")
        
        # Run the Apify actor
        run = client.actor("epctex/goodreads-scraper").call(run_input=run_input)
        
        # Wait a moment for results to be ready
        time.sleep(2)
        
        # Extract reviews from results
        reviews = []
        logger.info("Fetching results from Apify...")
        
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            if 'reviews' in item and item['reviews']:
                for review in item['reviews']:
                    if review.get('text'):
                        # Clean up the review text
                        text = review['text'].strip()
                        text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
                        
                        if text:
                            reviews.append(text)
        
        logger.info(f"Apify returned {len(reviews)} total reviews")
        return reviews
        
    except Exception as e:
        logger.error(f"Apify scraping failed: {e}")
        return []



