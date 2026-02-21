"""
LLM scoring integration via OpenRouter.

Takes an aggregated context text about the book (descriptions + review snippets)
and returns structured quality scores.
"""

import json
import time
import logging
import re
import random
import requests
import os

from dotenv import load_dotenv
from backend.config import GEMINI_RETRY_MAX, GEMINI_RETRY_DELAY

load_dotenv()

logger = logging.getLogger(__name__)

# OpenRouter configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = "openai/gpt-3.5-turbo"  # Faster, lighter model (less rate-limited than Llama 70B)

# NOTE: This template now expects a generic "CONTEXT" block instead of
# Goodreads-specific "Reviews" and is agnostic to source (Hardcover, Google, retailers).
SCORING_PROMPT_TEMPLATE = """
You are StyleScope's editorial AI, trained to evaluate romance and dark romance novels based on writing quality — NOT plot, characters, or enjoyment. You score books across 5 independent dimensions using a 0-100 scale.

You will be given a block of CONTEXT about the book. This context may include:
- Descriptions or blurbs.
- Short review snippets from book communities (e.g., Hardcover) or retailers.
- Other reader commentary.

You must infer writing quality signals from this context. If context is thin or contradictory, lower your confidence score, but still make your best estimate.

**CRITICAL: READABILITY is the PRIMARY dimension.** StyleScope exists because readers struggle with books that are confusing, clunky, or hard to follow.

## THE 5 SCORING DIMENSIONS

### 1. READABILITY (0-100) ⭐ PRIMARY DIMENSION ⭐

**What to look for:** "easy to read", "flew through", "confusing", "hard to follow", "had to reread", "clunky", "smooth", "flowed perfectly"

**Scoring:**
- 90-100: "Flowed perfectly", "disappeared into story", "writing was invisible"
- 80-89: "Smooth", "easy to follow", "breezed through"
- 70-79: Generally readable, some clunky moments
- 60-69: "Had to reread parts", "confusing sentences", "choppy"
- 50-59: "Hard to follow", "struggled to get through"
- Below 50: "Couldn't finish due to writing"

**CRITICAL SIGNALS:**
- "Had to reread" = max 75
- "Confusing" or "hard to follow" = 65 or below
- "DNF'd because of writing" = 55 or below
- "Flowed perfectly" = 85+

### 2. GRAMMAR (0-100)
What to look for: "typos", "editing", "grammar errors", "well-edited", "flawless", "needed an editor"

### 3. POLISH (0-100)
What to look for: "continuity errors", "plot holes", "inconsistent", "rushed", "well-crafted", "polished"

### 4. PROSE STYLE (0-100)
What to look for: "beautiful writing", "vivid", "flat", "basic", "cliché", "purple prose", "formulaic"

### 5. PACING (0-100)
What to look for: "couldn't put down", "page-turner", "dragged", "slow", "fast-paced"

## WEIGHTED SCORING

Overall = (Readability × 40%) + (Grammar × 15%) + (Polish × 15%) + (Prose × 15%) + (Pacing × 15%)

**Critical Rules:**
- If Readability < 70: Overall CANNOT exceed 75
- If Readability > 85: Book is "Recommended" tier
- Score dimensions independently — ignore plot/character opinions
- Use the full 0-100 range

## OUTPUT FORMAT

Return ONLY valid JSON with no markdown, no code fences, no commentary:

{{
  "book_title": "{title}",
  "author": "{author}",
  "scores": {{
    "readability": 78,
    "grammar": 72,
    "polish": 70,
    "prose": 68,
    "pacing": 75
  }},
  "overall_score": 74,
  "overall_calculation": "(78×0.4) + (72×0.15) + (70×0.15) + (68×0.15) + (75×0.15) = 74.1 → 74",
  "confidence": 78,
  "reasoning": {{
    "readability": "Brief explanation citing specific context signals.",
    "grammar": "Brief explanation.",
    "polish": "Brief explanation.",
    "prose": "Brief explanation.",
    "pacing": "Brief explanation."
  }},
  "flags": ["Flag 1", "Flag 2"],
  "review_count": {review_count},
  "key_phrases": ["phrase 1", "phrase 2", "phrase 3"]
}}

---

Book: {title} by {author}

Series: {series}
Genre: {genre}

CONTEXT:
{context}
"""


def _calculate_overall(scores: dict) -> int:
    """
    Calculate the weighted overall score and enforce the readability cap rule.
    """
    r = scores.get("readability", 70)
    g = scores.get("grammar", 70)
    p = scores.get("polish", 70)
    pr = scores.get("prose", 70)
    pa = scores.get("pacing", 70)

    raw = (r * 0.40) + (g * 0.15) + (p * 0.15) + (pr * 0.15) + (pa * 0.15)
    overall = round(raw)

    # Enforce readability cap
    if r < 70 and overall > 75:
        logger.info(f"Readability cap applied: {overall} → 75 (readability={r})")
        overall = 75

    return overall


def _classify_error(error_msg: str) -> str:
    """Return specific error type for better debugging."""
    if not error_msg:
        return "unknown_error"

    error_lower = error_msg.lower()

    if "500" in error_msg or "internal server error" in error_lower:
        return "api_error_500"
    if "429" in error_msg or "rate limit" in error_lower:
        return "api_error_rate_limit"
    if "json" in error_lower or "parse" in error_lower:
        return "json_parse_failure"
    if "not found" in error_lower or "404" in error_msg:
        return "book_not_found"
    if "no context" in error_lower:
        return "no_context_found"

    return f"scoring_error: {error_msg}"


def _parse_llm_response(text: str) -> dict | None:
    """Extract and parse JSON with multiple fallback strategies."""
    # Strategy 1: Try parsing raw response
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Strategy 3: Extract JSON object between first { and last }
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error after all attempts: {e}")

    # Strategy 4: Return fallback default score
    logger.warning("All JSON parsing strategies failed - returning low-confidence default")
    return {
        "book_title": "",
        "author": "",
        "scores": {
            "readability": 50,
            "grammar": 50,
            "polish": 50,
            "prose": 50,
            "pacing": 50,
        },
        "overall_score": 50,
        "confidence": 0,
        "reasoning": {},
        "flags": ["json_parse_failure"],
        "review_count": 0,
        "key_phrases": [],
    }


CW_PROMPT_TEMPLATE = """
You are a content warning specialist for romance and dark romance novels. Your job is to identify content warnings that readers in this genre need to know about before picking up a book.

You will be given a description and optional review excerpts for a book. Based ONLY on what is explicitly stated or clearly implied in this context, list any applicable content warnings.

## CONTENT WARNING CATEGORIES

Choose ONLY from this list. Do not invent new categories.

**Violence & Safety**
- graphic violence
- torture
- kidnapping / captivity
- stalking
- murder

**Sexual Content**
- explicit sexual content
- dubious consent
- non-consent / rape
- forced seduction
- age gap (significant)
- student/teacher
- forbidden relationship

**Dark Romance Tropes**
- dark romance (general)
- villain / morally grey love interest
- mafia / organized crime
- bully romance
- enemies to lovers (extreme)

**Mental Health & Trauma**
- suicide / suicidal ideation
- self-harm
- abuse (emotional, physical, or sexual)
- trauma / PTSD
- mental illness

**Other**
- cheating / infidelity
- death of a loved one
- drug use / addiction
- pregnancy
- revenge plot
- power imbalance

## RULES

1. Only list warnings that are CLEARLY supported by the context. Do not guess.
2. If the description/reviews are vague and you cannot confirm a warning, omit it.
3. For dark romance books, "dark romance (general)" is appropriate if the tone is explicit but specifics are unclear.
4. List between 0 and 10 warnings maximum.

## OUTPUT FORMAT

Return ONLY valid JSON with no markdown, no code fences, no commentary:

{{
  "warnings": ["warning 1", "warning 2"],
  "confidence": 75,
  "reasoning": "Brief explanation of why these warnings were chosen."
}}

---

Book: {title} by {author}

CONTEXT:
{context}
"""


def extract_content_warnings_llm(
    title: str,
    author: str,
    context_text: str,
) -> dict:
    """
    Use the LLM to extract content warnings from book description + reviews.

    Returns:
        {
            "warnings": list[str],   # content warning strings
            "confidence": int,       # 0-100
            "source": "llm_inferred",
            "reasoning": str,
        }
    On failure, returns {"warnings": [], "source": "llm_inferred", "error": str}.
    """
    if not OPENROUTER_API_KEY:
        return {"warnings": [], "source": "llm_inferred", "error": "no_api_key"}

    if not context_text or len(context_text.strip()) < 50:
        return {"warnings": [], "source": "llm_inferred", "error": "insufficient_context"}

    # Truncate context to keep CW call cheap (descriptions + a few reviews is enough)
    context_truncated = context_text[:3000]

    prompt = CW_PROMPT_TEMPLATE.format(
        title=title,
        author=author,
        context=context_truncated,
    )

    try:
        logger.info(f"extract_content_warnings_llm: calling OpenRouter for '{title}'")
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://stylescope.app",
                "X-Title": "StyleScope",
            },
            data=json.dumps({
                "model": OPENROUTER_MODEL,
                "messages": [{"role": "user", "content": prompt}],
            }),
            timeout=30,
        )
        response.raise_for_status()
        raw_text = response.json()["choices"][0]["message"]["content"]
        parsed = _parse_llm_response(raw_text)

        if not parsed or not isinstance(parsed.get("warnings"), list):
            raise ValueError("LLM response missing 'warnings' list")

        warnings = [str(w).strip() for w in parsed["warnings"] if w and str(w).strip()]
        logger.info(
            f"extract_content_warnings_llm: '{title}' → {len(warnings)} warnings: {warnings}"
        )
        return {
            "warnings": warnings,
            "confidence": parsed.get("confidence", 50),
            "source": "llm_inferred",
            "reasoning": parsed.get("reasoning", ""),
        }

    except Exception as e:
        logger.warning(f"extract_content_warnings_llm failed for '{title}': {e}")
        return {"warnings": [], "source": "llm_inferred", "error": str(e)}


def score_book(
    title: str,
    author: str,
    series: str,
    genre: str,
    subgenre: str,
    context_text: str,
    review_count: int = 0,
) -> dict:
    """
    Score a book using OpenRouter, given an aggregated context text.

    NEW PIPELINE: Receives context_text from fetch_book_context (Hardcover/Google/hybrid).
    Logs diagnostic info for debugging the end-to-end flow.
    """
    logger.info(
        f"score_book START: title='{title}', author='{author}', "
        f"context_len={len(context_text)}, review_count={review_count}"
    )
    
    if not OPENROUTER_API_KEY:
        logger.error("OPENROUTER_API_KEY not set - cannot score book")
        return {
            "book_title": title,
            "author": author,
            "scores": {},
            "overall_score": None,
            "confidence": 0,
            "reasoning": {},
            "flags": ["missing_openrouter_api_key"],
            "review_count": review_count,
            "key_phrases": [],
            "scoring_status": "error",
        }

    if not context_text or len(context_text.strip()) == 0:
        logger.warning(f"No context text provided for '{title}' — cannot score")
        return {
            "book_title": title,
            "author": author,
            "scores": {},
            "overall_score": None,
            "confidence": 0,
            "reasoning": {},
            "flags": ["no_context_found"],
            "review_count": review_count,
            "key_phrases": [],
            "scoring_status": "error",
        }

    prompt = SCORING_PROMPT_TEMPLATE.format(
        title=title,
        author=author,
        series=series or "N/A",
        genre=f"{genre}" + (f" / {subgenre}" if subgenre else ""),
        context=context_text,
        review_count=review_count,
    )

    last_error = None

    for attempt in range(1, GEMINI_RETRY_MAX + 1):
        try:
            logger.info(f"OpenRouter request attempt {attempt} for '{title}'")

            response = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://stylescope.app",
                    "X-Title": "StyleScope",
                },
                data=json.dumps(
                    {
                        "model": OPENROUTER_MODEL,
                        "messages": [
                            {"role": "user", "content": prompt},
                        ],
                    }
                ),
                timeout=60,
            )

            response.raise_for_status()
            raw = response.json()
            raw_text = raw["choices"][0]["message"]["content"]
            parsed = _parse_llm_response(raw_text)

            if parsed is None:
                raise ValueError("Could not parse JSON from LLM response")

            scores = parsed.get("scores", {})
            required_score_keys = {"readability", "grammar", "polish", "prose", "pacing"}
            if not required_score_keys.issubset(scores.keys()):
                missing = required_score_keys - set(scores.keys())
                raise ValueError(f"Missing score keys: {missing}")

            parsed["overall_score"] = _calculate_overall(scores)
            parsed["scoring_status"] = "ok"
            parsed["review_count"] = review_count

            # Add low-confidence flag if context is thin
            flags = parsed.get("flags", [])
            if review_count < 5:
                flags.append("low_confidence: fewer than 5 review-derived snippets")
            if len(context_text) < 800:
                flags.append("low_confidence: limited context length")
            parsed["flags"] = flags

            logger.info(
                f"score_book SUCCESS: '{title}' scored {parsed['overall_score']}/100 "
                f"(readability={scores['readability']}, confidence={parsed.get('confidence', '?')}%, "
                f"status=ok)"
            )

            return parsed

        except Exception as e:
            last_error = str(e)
            logger.warning(f"Attempt {attempt} failed for '{title}': {e}")
            if attempt < GEMINI_RETRY_MAX:
                # Exponential backoff with jitter
                wait_time = (2**attempt) + random.uniform(0, 1)
                logger.info(
                    f" Retry {attempt + 1}/{GEMINI_RETRY_MAX} in {wait_time:.1f}s..."
                )
                time.sleep(wait_time)

    logger.error(f"All retries failed for '{title}': {last_error}")
    
    # Special handling for rate limits: return "temporarily_unavailable" status
    error_classification = _classify_error(last_error)
    is_rate_limit = error_classification == "api_error_rate_limit"
    
    flags = [error_classification]
    if is_rate_limit:
        flags = ["openrouter_rate_limited"]
        logger.error(f"score_book FAILED: '{title}' hit OpenRouter rate limit (429)")
    else:
        logger.error(f"score_book FAILED: '{title}' hit {error_classification}")
    
    return {
        "book_title": title,
        "author": author,
        "scores": {},
        "overall_score": None,
        "confidence": 0,
        "reasoning": {},
        "flags": flags,
        "review_count": review_count,
        "key_phrases": [],
        "scoring_status": "temporarily_unavailable" if is_rate_limit else "error",
    }
