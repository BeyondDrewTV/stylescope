"""Shared scraping utilities."""
import re
from config import QUALITY_KEYWORDS


def extract_quality_sentences(text: str, max_sentences: int = 8) -> list[str]:
    """
    From a block of review text, extract sentences that contain
    quality-signal keywords. Returns up to max_sentences.
    """
    if not text:
        return []

    # Split into sentences (rough but effective)
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    all_keywords = [kw for kws in QUALITY_KEYWORDS.values() for kw in kws]
    matched = []

    for sentence in sentences:
        s_lower = sentence.lower()
        if any(kw in s_lower for kw in all_keywords):
            clean = sentence.strip()
            if 15 < len(clean) < 400:   # skip too short/long
                matched.append(clean)

    return matched[:max_sentences]


def clean_text(text: str) -> str:
    """Basic text cleanup."""
    if not text:
        return ""
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove non-printable characters
    text = re.sub(r'[^\x20-\x7E]', ' ', text)
    return text.strip()


def deduplicate(excerpts: list[str], similarity_threshold: int = 80) -> list[str]:
    """Remove near-duplicate excerpts (simple length+prefix check)."""
    seen_prefixes = set()
    unique = []
    for e in excerpts:
        prefix = e[:60].lower().strip()
        if prefix not in seen_prefixes:
            seen_prefixes.add(prefix)
            unique.append(e)
    return unique


def format_review_block(excerpts: list[str]) -> str:
    """Format list of excerpts into a numbered block for the LLM prompt."""
    if not excerpts:
        return "(No reviews found — scoring with low confidence)"
    return "\n".join(f"{i+1}. \"{e}\"" for i, e in enumerate(excerpts))
