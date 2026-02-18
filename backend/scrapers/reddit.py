"""Reddit review scraper using PRAW."""
import logging
import praw
from config import (
    REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT,
    REDDIT_SUBREDDITS, REDDIT_POSTS_LIMIT, REDDIT_COMMENTS_MAX,
)
from scrapers.utils import extract_quality_sentences, clean_text, deduplicate

logger = logging.getLogger(__name__)


def _build_reddit_client() -> praw.Reddit:
    return praw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        user_agent=REDDIT_USER_AGENT,
        # Read-only mode — no username/password needed
    )


def _search_queries(title: str, author: str, series: str) -> list[str]:
    """Generate search query variants."""
    queries = [
        f'"{title}" {author}',
        f'"{title}"',
    ]
    if series:
        series_base = series.split("#")[0].strip()
        queries.append(f'"{series_base}"')
    return queries


def scrape_reddit(title: str, author: str, series: str = "") -> list[str]:
    """
    Search Reddit for reviews of the given book.
    Returns list of quality-signal sentence excerpts.
    """
    if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
        logger.warning("Reddit credentials not configured — skipping Reddit scrape.")
        return []

    try:
        reddit = _build_reddit_client()
    except Exception as e:
        logger.error(f"Failed to initialize Reddit client: {e}")
        return []

    excerpts = []
    queries = _search_queries(title, author, series)

    for subreddit_name in REDDIT_SUBREDDITS:
        try:
            subreddit = reddit.subreddit(subreddit_name)
        except Exception as e:
            logger.warning(f"Could not access r/{subreddit_name}: {e}")
            continue

        for query in queries[:2]:   # limit queries per subreddit
            try:
                results = subreddit.search(query, limit=REDDIT_POSTS_LIMIT, sort="relevance")
                for submission in results:
                    # Score post body
                    if submission.selftext:
                        sents = extract_quality_sentences(clean_text(submission.selftext))
                        excerpts.extend(sents)

                    # Score top-level comments
                    try:
                        submission.comments.replace_more(limit=0)
                        for comment in submission.comments.list()[:20]:
                            if comment.body and len(comment.body) > 30:
                                sents = extract_quality_sentences(clean_text(comment.body))
                                excerpts.extend(sents)
                    except Exception:
                        pass

                    if len(excerpts) >= REDDIT_COMMENTS_MAX:
                        break

            except Exception as e:
                logger.warning(f"Reddit search error for '{query}' in r/{subreddit_name}: {e}")
                continue

        if len(excerpts) >= REDDIT_COMMENTS_MAX:
            break

    result = deduplicate(excerpts)[:REDDIT_COMMENTS_MAX]
    logger.info(f"Reddit: found {len(result)} quality excerpts for '{title}'")
    return result
