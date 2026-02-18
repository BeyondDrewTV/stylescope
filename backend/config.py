"""Configuration for StyleScope scorer."""
import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
REDDIT_CLIENT_ID     = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")
REDDIT_USER_AGENT    = os.getenv("REDDIT_USER_AGENT", "StyleScopeBot/1.0")
GEMINI_API_KEY       = os.getenv("GEMINI_API_KEY", "")

# Reddit config
REDDIT_SUBREDDITS    = ["RomanceBooks", "DarkRomance", "FantasyRomance", "booksuggestions", "books"]
REDDIT_POSTS_LIMIT   = 10   # posts per subreddit search
REDDIT_COMMENTS_MAX  = 40   # max comments to extract per book

# Goodreads config
GOODREADS_DELAY_SEC  = 2.0  # seconds between requests
GOODREADS_MAX_PAGES  = 3    # review pages to scrape
GOODREADS_HEADERS    = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# Gemini config
GEMINI_MODEL         = "gemini-2.0-flash-exp"
GEMINI_RPM_LIMIT     = 15   # free tier: 15 requests/minute
GEMINI_RETRY_MAX     = 3
GEMINI_RETRY_DELAY   = 5    # seconds

# Quality signal keywords (used to filter relevant sentences from reviews)
QUALITY_KEYWORDS = {
    "readability": [
        "easy to read", "flew through", "couldn't put down", "can't put down",
        "flowed", "smooth", "accessible", "addictive", "confusing", "hard to follow",
        "had to reread", "clunky", "awkward", "stilted", "choppy", "bogged down",
        "writing style", "writing is", "prose is", "couldn't get into",
        "writing threw me", "dnf", "gave up", "readable", "clear writing",
        "lost track", "couldn't follow",
    ],
    "grammar": [
        "typo", "typos", "grammar", "editing", "editor", "well-edited",
        "spelling", "punctuation", "errors", "proofreading", "copy edit",
        "flawless", "clean writing", "polished writing", "needed an editor",
        "grammatically", "tense", "inconsistent tense",
    ],
    "polish": [
        "plot hole", "continuity", "inconsistent", "inconsistency", "rushed",
        "unfinished", "polished", "well-crafted", "tight", "structured",
        "timeline", "character inconsistent", "details don't", "first draft",
        "continuity error", "character name",
    ],
    "prose": [
        "beautiful writing", "vivid", "descriptive", "purple prose", "over-written",
        "flat prose", "basic writing", "cliché", "clichés", "formulaic",
        "generic", "voice", "poetic", "lyrical", "bland", "simplistic",
        "repetitive", "word choice", "descriptions", "metaphors",
    ],
    "pacing": [
        "page-turner", "page turner", "fast-paced", "fast paced", "slow",
        "dragged", "couldn't stop", "one sitting", "boring", "nothing happens",
        "momentum", "gripping", "tension", "pacing", "picked up at",
        "slow start", "rushed ending", "dnf", "lost interest",
    ],
}

# Minimum review excerpts needed to score with confidence
MIN_EXCERPTS_HIGH_CONFIDENCE = 15
MIN_EXCERPTS_MED_CONFIDENCE  = 5

# Output columns
OUTPUT_COLUMNS = [
    "Title", "Author", "Series", "Genre", "Subgenre",
    "readability", "grammar", "polish", "prose", "pacing",
    "overall_score", "confidence", "review_count", "flags",
    "key_phrases", "scoring_status",
]
