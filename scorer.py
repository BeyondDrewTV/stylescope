"""
LLM scoring integration via OpenRouter.
Sends aggregated review excerpts and returns structured quality scores.
"""
import json
import time
import logging
import re
import random
import requests
from config import GEMINI_RETRY_MAX, GEMINI_RETRY_DELAY
from scrapers.utils import format_review_block


logger = logging.getLogger(__name__)


# Get OpenRouter API key from environment
import os
from dotenv import load_dotenv
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


SCORING_PROMPT_TEMPLATE = """You are StyleScope's editorial AI, trained to evaluate romance and dark romance novels based on writing quality — NOT plot, characters, or enjoyment. You score books across 5 independent dimensions using a 0-100 scale.


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
**What to look for:** "typos", "editing", "grammar errors", "well-edited", "flawless", "needed an editor"


### 3. POLISH (0-100)
**What to look for:** "continuity errors", "plot holes", "inconsistent", "rushed", "well-crafted", "polished"


### 4. PROSE STYLE (0-100)
**What to look for:** "beautiful writing", "vivid", "flat", "basic", "cliché", "purple prose", "formulaic"


### 5. PACING (0-100)
**What to look for:** "couldn't put down", "page-turner", "dragged", "slow", "fast-paced"


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
    "readability": "Brief explanation citing specific review signals.",
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


Reviews:
{reviews}"""


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
    error_lower = error_msg.lower()
    if "500" in error_msg or "internal server error" in error_lower:
        return "api_error_500"
    elif "429" in error_msg or "rate limit" in error_lower:
        return "api_error_rate_limit"
    elif "json" in error_lower or "parse" in error_lower:
        return "json_parse_failure"
    elif "not found" in error_lower or "404" in error_msg:
        return "book_not_found"
    elif "no excerpts" in error_lower:
        return "no_excerpts_found"
    else:
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
            "pacing": 50
        },
        "overall_score": 50,
        "confidence": 0,
        "reasoning": {},
        "flags": ["json_parse_failure"],
        "review_count": 0,
        "key_phrases": []
    }


def score_book(
    title: str,
    author: str,
    series: str,
    genre: str,
    subgenre: str,
    excerpts: list[str],
) -> dict:
    """
    Send review excerpts to OpenRouter and return structured scoring result.
    """
    review_count = len(excerpts)
    review_block = format_review_block(excerpts)


    prompt = SCORING_PROMPT_TEMPLATE.format(
        title=title,
        author=author,
        series=series or "N/A",
        genre=f"{genre}" + (f" / {subgenre}" if subgenre else ""),
        reviews=review_block,
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
                data=json.dumps({
                    "model": "meta-llama/llama-3.3-70b-instruct:free",
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                })
            )
            
            response.raise_for_status()
            raw_text = response.json()["choices"][0]["message"]["content"]


            parsed = _parse_llm_response(raw_text)
            if parsed is None:
                raise ValueError("Could not parse JSON from LLM response")


            scores = parsed.get("scores", {})
            required_score_keys = {"readability", "grammar", "polish", "prose", "pacing"}
            if not required_score_keys.issubset(scores.keys()):
                raise ValueError(f"Missing score keys: {required_score_keys - scores.keys()}")


            parsed["overall_score"] = _calculate_overall(scores)
            parsed["scoring_status"] = "ok"
            parsed["review_count"] = review_count


            if review_count < 5:
                flags = parsed.get("flags", [])
                flags.append("low_confidence: fewer than 5 review excerpts")
                parsed["flags"] = flags


            logger.info(
                f"Scored '{title}': overall={parsed['overall_score']}, "
                f"readability={scores['readability']}, confidence={parsed.get('confidence', '?')}"
            )
            return parsed


        except Exception as e:
            last_error = str(e)
            logger.warning(f"Attempt {attempt} failed for '{title}': {e}")
            if attempt < GEMINI_RETRY_MAX:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                logger.info(f"  Retry {attempt + 1}/{GEMINI_RETRY_MAX} in {wait_time:.1f}s...")
                time.sleep(wait_time)


    logger.error(f"All retries failed for '{title}': {last_error}")
    return {
        "book_title": title,
        "author": author,
        "scores": {},
        "overall_score": None,
        "confidence": 0,
        "reasoning": {},
        "flags": [_classify_error(last_error)],
        "review_count": review_count,
        "key_phrases": [],
        "scoring_status": "error",
    }
