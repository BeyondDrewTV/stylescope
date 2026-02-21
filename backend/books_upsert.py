"""
backend/books_upsert.py — Shared books table upsert logic.

Used by both:
  - backend/batch_score.py  (batch scoring run)
  - backend/api.py          (_run_scoring_job on-demand path)

Ensures a completed score is always persisted idempotently into books using
UNIQUE(title, author) as the natural key. On conflict it updates all scoring
fields while preserving any human-entered data (goodreadsUrl, genres, etc.)
that may already exist.

Schema additions handled here (idempotent ALTER TABLE):
  - scoring_status   TEXT    — "ok" | "low_confidence" | "description_only"
  - context_source   TEXT    — "description_only" | "description+ratings" | "description+reviews"
  - first_scored_at  TEXT    — ISO timestamp, set once on first score, never overwritten
  - last_scored_at   TEXT    — ISO timestamp, updated every rescore
  - times_requested  INTEGER — incremented every time any user requests this book
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def _normalize_title_author(title: str, author: str) -> str:
    """
    Produce a lowercase, whitespace-collapsed search key for fuzzy dedup.
    Stored in search_normalized; not used as the UNIQUE key (that stays title+author).
    """
    combined = f"{title.lower().strip()} {author.lower().strip()}"
    return re.sub(r"\s+", " ", combined).strip()


def ensure_schema(conn) -> None:
    """
    Idempotently add new columns to an existing books table.
    Safe to call on every startup; existing data is never touched.
    """
    new_cols = [
        ("scoring_status",  "TEXT"),
        ("context_source",  "TEXT"),
        ("first_scored_at", "TEXT"),
        ("last_scored_at",  "TEXT"),
        ("times_requested", "INTEGER DEFAULT 0"),
    ]
    for col, definition in new_cols:
        try:
            conn.execute(f"ALTER TABLE books ADD COLUMN {col} {definition}")
        except Exception:
            pass  # column already exists — safe to ignore


def upsert_scored_book(
    *,
    conn,                              # open sqlite3 connection (caller manages lifecycle)
    title: str,
    author: str,
    isbn: Optional[str] = None,
    scores: dict,                      # full scorer.score_book() return value
    ctx: dict,                         # full fetch_book_context() return value
    official_cw_doc: Optional[str] = None,  # JSON string or None
    spice_level: int = 0,
    increment_requested: bool = False, # True when triggered by a user on-demand request
) -> Optional[int]:
    """
    Insert or update a books row from a completed scoring result.

    Returns the book_id (int) on success, None on failure.

    INSERT path: populates all available fields.
    UPDATE (ON CONFLICT) path:
      - Always overwrites scoring fields (scores, CWs, confidence, etc.)
      - Preserves existing human-entered / import data (goodreadsUrl, genres, etc.)
      - Sets first_scored_at only if NULL (never overwritten)
      - Always updates last_scored_at
      - Increments times_requested when increment_requested=True
    """
    try:
        dimension_scores  = scores.get("scores", {})
        overall_score     = scores.get("overall_score")
        confidence_val    = scores.get("confidence", 50)
        confidence_label  = (
            "high"   if confidence_val >= 70 else
            "medium" if confidence_val >= 40 else
            "low"
        )

        # Context transparency fields
        context_source        = ctx.get("context_source", "description_only")
        ratings_count_estimate = ctx.get("ratings_count_estimate", 0)
        review_count          = ctx.get("review_count", 0)
        vote_count_proxy      = ratings_count_estimate or review_count

        # Pull description + cover from context meta where available
        meta        = ctx.get("meta", {}) or {}
        description = meta.get("description") or ""
        cover_url   = meta.get("cover_url") or meta.get("thumbnail") or meta.get("coverUrl")
        isbn13      = meta.get("isbn13") or None

        # Scoring status label (mirrors confidence but score-specific)
        scoring_status = scores.get("scoring_status", "ok")
        if scoring_status == "ok" and confidence_val < 40:
            scoring_status = "low_confidence"

        search_norm = _normalize_title_author(title, author)
        now_iso     = datetime.now(timezone.utc).isoformat()

        c = conn.cursor()

        c.execute("""
            INSERT INTO books (
                title, author, isbn, isbn13, synopsis, coverUrl,
                search_normalized,
                qualityScore, technicalQuality, proseStyle, pacing,
                readability, craftExecution,
                confidenceLevel, voteCount, spiceLevel,
                officialContentWarnings,
                scoring_status, context_source,
                first_scored_at, last_scored_at,
                times_requested
            ) VALUES (
                ?,?,?,?,?,?,
                ?,
                ?,?,?,?,
                ?,?,
                ?,?,?,
                ?,
                ?,?,
                ?,?,
                ?
            )
            ON CONFLICT(title, author) DO UPDATE SET
                -- Scoring fields — always refreshed
                qualityScore            = excluded.qualityScore,
                technicalQuality        = excluded.technicalQuality,
                proseStyle              = excluded.proseStyle,
                pacing                  = excluded.pacing,
                readability             = excluded.readability,
                craftExecution          = excluded.craftExecution,
                confidenceLevel         = excluded.confidenceLevel,
                voteCount               = excluded.voteCount,
                spiceLevel              = excluded.spiceLevel,
                officialContentWarnings = excluded.officialContentWarnings,
                scoring_status          = excluded.scoring_status,
                context_source          = excluded.context_source,
                scoredDate              = excluded.last_scored_at,
                last_scored_at          = excluded.last_scored_at,
                -- first_scored_at set once and never overwritten
                first_scored_at         = COALESCE(books.first_scored_at, excluded.first_scored_at),
                -- Soft-increment times_requested only when caller opts in
                times_requested         = books.times_requested + excluded.times_requested,
                -- Metadata — fill gaps only; preserve existing human data
                synopsis                = COALESCE(NULLIF(books.synopsis, ''), excluded.synopsis),
                coverUrl                = COALESCE(books.coverUrl, excluded.coverUrl),
                isbn                    = COALESCE(books.isbn, excluded.isbn),
                isbn13                  = COALESCE(books.isbn13, excluded.isbn13),
                search_normalized       = excluded.search_normalized
        """, (
            title, author,
            isbn, isbn13,
            description[:4000] if description else None,
            cover_url,
            search_norm,
            # Scores
            overall_score,
            dimension_scores.get("grammar",     0),
            dimension_scores.get("prose",        0),
            dimension_scores.get("pacing",       0),
            dimension_scores.get("readability",  0),
            dimension_scores.get("polish",       0),
            confidence_label,
            vote_count_proxy,
            spice_level,
            official_cw_doc,
            scoring_status,
            context_source,
            now_iso,   # first_scored_at (INSERT only; ON CONFLICT uses COALESCE)
            now_iso,   # last_scored_at
            1 if increment_requested else 0,  # times_requested delta
        ))
        conn.commit()

        row = conn.execute(
            "SELECT id FROM books WHERE title=? AND author=?", (title, author)
        ).fetchone()
        book_id = row["id"] if row else None
        logger.info(f"[upsert] '{title}' by {author} → book_id={book_id} (score={overall_score})")
        return book_id

    except Exception as e:
        logger.error(f"[upsert] Failed for '{title}' by {author}: {e}", exc_info=True)
        return None
