"""
StyleScope Production API
Serves scored books and handles on-demand scoring, points, quizzes,
pepper mascot messages, and series metadata.

Usage:
    python api.py

All routes:
    GET  /api/books
    GET  /api/books/<id>
    GET  /api/books/search?q=
    GET  /api/books/<id>/series
    POST /api/series/<name>/notify
    GET  /api/spice-levels
    POST /api/score-on-demand
    GET  /api/score-on-demand/<job_id>
    POST /api/auth/magic-link
    GET  /api/auth/verify
    POST /api/stripe/checkout
    POST /api/stripe/webhook
    GET  /api/health
    GET  /api/user/<id>/points
    POST /api/user/<id>/points/award
    POST /api/user/<id>/points/redeem
    GET  /api/quiz/trivia
    POST /api/quiz/trivia/submit
    GET  /api/quiz/personality
    POST /api/quiz/personality/submit
    GET  /api/pepper/message
"""

import csv
import json
import logging
import os
import random
import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta
from typing import Any

import stripe
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_mail import Mail, Message

# ---------------------------------------------------------------------------
# Import existing scoring system — DO NOT modify scorer.py
# ---------------------------------------------------------------------------
from backend import scorer
from backend.scrapers import goodreads
from backend.quizzes import (
    TRIVIA_BANK,
    PERSONALITY_QUESTIONS,
    score_personality,
)
# NOTE: gamification_bp intentionally NOT imported or registered in v1.
# The module (backend/gamification.py) and its tables are preserved for future use.
# To re-enable: uncomment the two lines below and the register_blueprint call.
# from backend.gamification import gamification_bp, init_gamification_db
from backend.book_context import fetch_book_context
from backend.books_upsert import upsert_scored_book, ensure_schema as _ensure_books_schema
from backend.jobs import (
    create_on_demand_job,
    get_on_demand_job,
    update_on_demand_job_status,
)

logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
# app.register_blueprint(gamification_bp)  # disabled v1 — re-enable with gamification

# ------------
# Configuration
# ---------------------------------------------------------------------------
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-me")
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_USERNAME")

mail = Mail(app)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_ONE_TIME_PRICE_ID = os.getenv("STRIPE_ONE_TIME_PRICE_ID")
STRIPE_SUBSCRIPTION_PRICE_ID = os.getenv("STRIPE_SUBSCRIPTION_PRICE_ID")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

DB_PATH = os.getenv("DB_PATH", "stylescope.db")
CSV_PATH = os.getenv("CSV_PATH", "data/scores_SUCCESS.csv")


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Create all tables. Safe to run multiple times (CREATE IF NOT EXISTS)."""
    conn = get_conn()
    c = conn.cursor()

    # -- Books ---------------------------------------------------------------
    c.execute("""
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            authorId TEXT,
            genres TEXT,
            publishedYear INTEGER,
            isIndie INTEGER DEFAULT 0,
            isbn TEXT,
            isbn13 TEXT,

            qualityScore INTEGER,
            technicalQuality INTEGER,
            proseStyle INTEGER,
            pacing INTEGER,
            readability INTEGER,
            craftExecution INTEGER,

            confidenceLevel TEXT,
            voteCount INTEGER DEFAULT 0,

            technicalQualityNote TEXT,
            proseStyleNote TEXT,
            pacingNote TEXT,
            readabilityNote TEXT,
            craftExecutionNote TEXT,

            spiceLevel INTEGER DEFAULT 0,
            spiceDescription TEXT,
            contentWarnings TEXT,

            synopsis TEXT,
            rating REAL,
            readers INTEGER,
            themes TEXT,
            moods TEXT,
            endingType TEXT,
            coverUrl TEXT,

            -- Series metadata
            seriesName TEXT,
            seriesNumber INTEGER,
            seriesTotal INTEGER,
            seriesIsComplete INTEGER DEFAULT 0,

            scoredDate TIMESTAMP,
            goodreadsUrl TEXT,

            UNIQUE(title, author)
        )
    """)

    # Idempotent column additions for existing databases
    for col, definition in [
        ("seriesName",            "TEXT"),
        ("seriesNumber",          "INTEGER"),
        ("seriesTotal",           "INTEGER"),
        ("seriesIsComplete",      "INTEGER DEFAULT 0"),
        ("search_normalized",     "TEXT"),
        ("officialContentWarnings", "TEXT"),
        # v1 additions — scoring transparency + usage analytics
        ("scoring_status",        "TEXT"),
        ("context_source",        "TEXT"),
        ("first_scored_at",       "TEXT"),
        ("last_scored_at",        "TEXT"),
        ("times_requested",       "INTEGER DEFAULT 0"),
    ]:
        try:
            c.execute(f"ALTER TABLE books ADD COLUMN {col} {definition}")
        except Exception:
            pass  # Column already exists

    # -- Users ---------------------------------------------------------------
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            stripe_customer_id TEXT,
            subscription_status TEXT DEFAULT 'none'
        )
    """)

    # -- Magic links ---------------------------------------------------------
    c.execute("""
        CREATE TABLE IF NOT EXISTS magic_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0
        )
    """)

    # -- Purchases -----------------------------------------------------------
    c.execute("""
        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            book_id INTEGER,
            purchase_type TEXT,
            stripe_session_id TEXT,
            purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(book_id) REFERENCES books(id)
        )
    """)

    # -- Points --------------------------------------------------------------
    c.execute("""
        CREATE TABLE IF NOT EXISTS user_points (
            user_id INTEGER PRIMARY KEY,
            points INTEGER DEFAULT 0,
            lifetime_points INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS point_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            points INTEGER,
            action TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    # ========== SERIES TRACKING ==========
    # -- Series notifications ------------------------------------------------
    c.execute("""
        CREATE TABLE IF NOT EXISTS series_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            seriesName TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(email, seriesName)
        )
    """)

    # -- User preferences (Want/Avoid system for premium) -------------------
    c.execute("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id INTEGER NOT NULL,
            category_type TEXT NOT NULL,
            category_value TEXT NOT NULL,
            preference TEXT NOT NULL CHECK(preference IN ('want', 'avoid')),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, category_type, category_value),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # -- On-demand scoring jobs ----------------------------------------------
    c.execute("""
        CREATE TABLE IF NOT EXISTS on_demand_jobs (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            status TEXT NOT NULL,
            isbn TEXT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            user_id TEXT,
            result_json TEXT,
            error_message TEXT
        )
    """)

    # -- On-demand usage tracking (soft cap per user/month) ------------------
    # user_key: user_id if logged in, else IP-derived anon key
    c.execute("""
        CREATE TABLE IF NOT EXISTS on_demand_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_key TEXT NOT NULL,
            year_month TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            UNIQUE(user_key, year_month)
        )
    """)

    # -- Analytics events (vendor-agnostic, append-only) ---------------------
    c.execute("""
        CREATE TABLE IF NOT EXISTS analytics_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            event TEXT NOT NULL,
            user_key TEXT,
            session_id TEXT,
            properties TEXT
        )
    """)
    # Index for common queries: per-user event counts, per-event time series
    c.execute("CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_analytics_user  ON analytics_events(user_key)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_analytics_ts    ON analytics_events(ts)")

    # Ensure books_upsert schema additions (scoring_status, context_source, etc.)
    _ensure_books_schema(conn)

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Migration helpers
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# On-demand scoring: soft cap config
# ---------------------------------------------------------------------------
# Change this number whenever you want to raise/lower the free monthly limit.
# Logged-in users and anon users share the same limit for now.
ON_DEMAND_MONTHLY_CAP = int(os.environ.get("ON_DEMAND_MONTHLY_CAP", "10"))


def _get_user_key(user_id: str | None, request_obj) -> str:
    """
    Derive a stable per-user key for usage tracking.
    Logged-in users  → "u:{user_id}"
    Anonymous users  → "ip:{ip_address}"
    This is intentionally coarse for v1 — easy to tighten later.
    """
    if user_id:
        return f"u:{user_id}"
    ip = (
        request_obj.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or request_obj.remote_addr
        or "unknown"
    )
    return f"ip:{ip}"


def _check_and_increment_usage(user_key: str) -> tuple[bool, int]:
    """
    Check whether user_key is under the monthly cap, then increment.

    Returns (allowed: bool, new_count: int).
    If allowed is False the count is NOT incremented.
    """
    from datetime import datetime
    year_month = datetime.utcnow().strftime("%Y-%m")
    conn = get_conn()
    try:
        c = conn.cursor()
        # Upsert: create row if missing, then read current count
        c.execute("""
            INSERT INTO on_demand_usage (user_key, year_month, count)
            VALUES (?, ?, 0)
            ON CONFLICT(user_key, year_month) DO NOTHING
        """, (user_key, year_month))
        conn.commit()

        row = c.execute(
            "SELECT count FROM on_demand_usage WHERE user_key=? AND year_month=?",
            (user_key, year_month)
        ).fetchone()
        current = row["count"] if row else 0

        if current >= ON_DEMAND_MONTHLY_CAP:
            return False, current

        c.execute("""
            UPDATE on_demand_usage SET count = count + 1
            WHERE user_key=? AND year_month=?
        """, (user_key, year_month))
        conn.commit()
        return True, current + 1
    finally:
        conn.close()


def _get_usage_count(user_key: str) -> int:
    """Return how many on-demand scores the user has used this month."""
    from datetime import datetime
    year_month = datetime.utcnow().strftime("%Y-%m")
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT count FROM on_demand_usage WHERE user_key=? AND year_month=?",
            (user_key, year_month)
        ).fetchone()
        return row["count"] if row else 0
    finally:
        conn.close()


def _log_event(event: str, user_key: str | None = None,
               session_id: str | None = None, properties: dict | None = None):
    """
    Append an analytics event (fire-and-forget, never raises).
    All events land in analytics_events for future segmentation.
    """
    import json as _json
    from datetime import datetime
    try:
        conn = get_conn()
        conn.execute(
            "INSERT INTO analytics_events (ts, event, user_key, session_id, properties) VALUES (?,?,?,?,?)",
            (
                datetime.utcnow().isoformat(),
                event,
                user_key,
                session_id,
                _json.dumps(properties) if properties else None,
            )
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # analytics must never break the main flow


def _safe_int(value, default=0):
    """Cast a CSV field to int, returning `default` for blank/invalid values."""
    try:
        if value is None or str(value).strip() == "":
            return default
        return int(float(value))
    except (ValueError, TypeError):
        return default


def migrate_csv_to_db():
    """Import existing CSV scores into SQLite (idempotent — INSERT OR IGNORE)."""
    if not os.path.exists(CSV_PATH):
        print(f"[migration] No CSV found at {CSV_PATH}, skipping.")
        return

    conn = get_conn()
    c = conn.cursor()
    migrated = 0
    skipped = 0

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = (row.get("Title") or "").strip()
            author = (row.get("Author") or "").strip()

            if not title or not author:
                print(f"[migration] Skipping row — missing Title or Author: {row}")
                skipped += 1
                continue

            confidence_raw = _safe_int(row.get("confidence"), default=50)
            if confidence_raw >= 70:
                confidence_level = "high"
            elif confidence_raw >= 40:
                confidence_level = "medium"
            else:
                confidence_level = "low"

            try:
                c.execute("""
                    INSERT OR IGNORE INTO books
                        (title, author, qualityScore, technicalQuality, proseStyle,
                         pacing, readability, craftExecution, confidenceLevel,
                         voteCount, scoredDate)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    title,
                    author,
                    _safe_int(row.get("overall_score")),
                    _safe_int(row.get("grammar")),
                    _safe_int(row.get("prose")),
                    _safe_int(row.get("pacing")),
                    _safe_int(row.get("readability")),
                    _safe_int(row.get("polish")),
                    confidence_level,
                    _safe_int(row.get("review_count")),
                    datetime.now().isoformat(),
                ))
                migrated += 1
            except Exception as e:
                print(f"[migration] DB error on '{title}': {e}")
                skipped += 1

    conn.commit()
    conn.close()
    print(f"[migration] Done — {migrated} books imported. ({skipped} skipped)")


def populate_spice_metadata():
    """
    Run once to backfill spice metadata columns.
    Adds spice_label, spice_subtitle, spice_description to all books with spice_level.
    
    Usage: python -c "from api import populate_spice_metadata; populate_spice_metadata()"
    """
    SPICE_DEFS = {
        0: {
            'label': 'CLEAN',
            'subtitle': 'No sexual content',
            'description': 'Kissing only, fade-to-black, or no romance scenes'
        },
        1: {
            'label': 'SWEET',
            'subtitle': 'Closed door',
            'description': 'Sensuality implied, nothing explicit shown'
        },
        2: {
            'label': 'WARM',
            'subtitle': 'Mild steam',
            'description': 'Some explicit scenes, not overly detailed'
        },
        3: {
            'label': 'STEAMY',
            'subtitle': 'Moderate heat',
            'description': 'Multiple explicit scenes with detail'
        },
        4: {
            'label': 'HOT',
            'subtitle': 'High heat',
            'description': 'Frequent explicit scenes, graphic detail'
        },
        5: {
            'label': 'VERY SPICY',
            'subtitle': 'Explicit content',
            'description': 'Extremely graphic, frequent scenes, kink elements'
        },
        6: {
            'label': 'SCORCHING',
            'subtitle': 'Erotica',
            'description': 'Plot-focused erotica, taboo themes, extreme kink'
        }
    }
    
    conn = get_conn()
    c = conn.cursor()
    
    # Add columns if they don't exist
    for col in ['spice_label', 'spice_subtitle', 'spice_description']:
        try:
            c.execute(f"ALTER TABLE books ADD COLUMN {col} TEXT")
            print(f"[spice-migration] Added column: {col}")
        except Exception as e:
            # Column already exists, that's fine
            pass
    
    # Update all books that have a spice_level
    c.execute("SELECT id, spice_level FROM books WHERE spice_level IS NOT NULL")
    books = c.fetchall()
    
    updated = 0
    for book_id, spice_level in books:
        if spice_level in SPICE_DEFS:
            data = SPICE_DEFS[spice_level]
            c.execute("""
                UPDATE books 
                SET spice_label = ?, spice_subtitle = ?, spice_description = ?
                WHERE id = ?
            """, (data['label'], data['subtitle'], data['description'], book_id))
            updated += 1
    
    conn.commit()
    conn.close()
    print(f"[spice-migration] ✅ Updated {updated} books with spice metadata")


# ========== FUZZY SEARCH ==========
def normalize_search(s: str) -> str:
    """
    Normalize search query for fuzzy matching.
    - Lowercase
    - Strip punctuation
    - Collapse multiple spaces
    """
    s = s.lower().strip()
    s = re.sub(r'[.,\'"":;()\-]', '', s)  # Remove punctuation
    s = re.sub(r'\s+', ' ', s)  # Collapse spaces
    return s


def _fuzzy_score(needle, haystack):
    """
    Sliding-window partial match for typo tolerance.
    Example: 'hd ccarlton' finds 'H.D. Carlton'
    Returns a score from 0.0 to 1.0.
    """
    if not needle or not haystack:
        return 0.0
    
    # Normalize both strings
    needle = needle.lower().replace(" ", "").replace(".", "")
    haystack = haystack.lower().replace(" ", "").replace(".", "")
    
    # Exact substring match = perfect score
    if needle in haystack:
        return 1.0
    
    # Sliding window matching for partial similarity
    window_size = len(needle)
    if window_size > len(haystack):
        return 0.0
    
    best_score = 0.0
    for i in range(len(haystack) - window_size + 1):
        window = haystack[i:i + window_size]
        matches = sum(a == b for a, b in zip(needle, window))
        score = matches / window_size
        best_score = max(best_score, score)
    
    return best_score

# ---------------------------------------------------------------------------
# Book helpers
# ---------------------------------------------------------------------------

def _deserialize_book(row):
    """Convert a sqlite3.Row dict into a clean API-friendly dict."""
    def _get(key, default=None):
        try:
            val = row.get(key) if isinstance(row, dict) else row[key]
            return val if val is not None else default
        except (KeyError, IndexError, TypeError):
            return default

    # Parse JSON fields stored as strings
    def _parse_json(key, default=None):
        val = _get(key)
        if val is None:
            return default
        if isinstance(val, (list, dict)):
            return val
        # Be resilient against malformed JSON (bad unicode/backslash escapes)
        if not isinstance(val, str):
            return default

        try:
            return json.loads(val)
        except json.JSONDecodeError:
            # Try a few common sanitizations before giving up
            try:
                # Fix lone backslashes by escaping them
                fixed = val.replace('\\', '\\\\')
                return json.loads(fixed)
            except Exception:
                pass

            try:
                # Decode unicode-escape sequences then parse
                decoded = val.encode('utf-8').decode('unicode_escape')
                return json.loads(decoded)
            except Exception:
                pass

            try:
                # Escape incomplete \u escapes (not followed by 4 hex digits)
                import re
                fixed2 = re.sub(r'\\u(?![0-9a-fA-F]{4})', r'\\\\u', val)
                return json.loads(fixed2)
            except Exception:
                return default
        except TypeError:
            return default

    return {
        "id": _get("id"),
        "title": _get("title"),
        "author": _get("author"),
        "genres": _get("genres"),
        "publishedYear": _get("publishedYear"),
        "isIndie": bool(_get("isIndie", 0)),
        "isbn": _get("isbn"),
        "isbn13": _get("isbn13"),

        "qualityScore": _get("qualityScore", 0),
        "technicalQuality": _get("technicalQuality", 0),
        "proseStyle": _get("proseStyle", 0),
        "pacing": _get("pacing", 0),
        "readability": _get("readability", 0),
        "craftExecution": _get("craftExecution", 0),
        "confidenceLevel": _get("confidenceLevel"),

        "technicalQualityNote": _get("technicalQualityNote"),
        "proseStyleNote": _get("proseStyleNote"),
        "pacingNote": _get("pacingNote"),
        "readabilityNote": _get("readabilityNote"),
        "craftExecutionNote": _get("craftExecutionNote"),

        "spiceLevel": _get("spiceLevel", 0),
        "spiceDescription": _get("spiceDescription"),
        "contentWarnings": _parse_json("contentWarnings", []),

        "synopsis": _get("synopsis"),
        "rating": _get("rating"),
        "readers": _get("readers", 0),
        "themes": _parse_json("themes", []),
        "moods": _parse_json("moods", []),
        "endingType": _get("endingType"),
        "coverUrl": _get("coverUrl"),

        "seriesName": _get("seriesName"),
        "seriesNumber": _get("seriesNumber"),
        "seriesTotal": _get("seriesTotal"),
        "seriesIsComplete": bool(_get("seriesIsComplete", 0)),

        "scoredDate": _get("scoredDate"),
        "goodreadsUrl": _get("goodreadsUrl"),

        # Computed convenience fields
        "series": _get("seriesName"),
        "genre": _get("genres"),
        "dimensions": [
            {"name": "Readability",      "score": round((_get("readability", 0) or 0) / 10, 1)},
            {"name": "Technical Quality", "score": round((_get("technicalQuality", 0) or 0) / 10, 1)},
            {"name": "Prose Style",      "score": round((_get("proseStyle", 0) or 0) / 10, 1)},
            {"name": "Pacing",           "score": round((_get("pacing", 0) or 0) / 10, 1)},
            {"name": "Craft Execution",  "score": round((_get("craftExecution", 0) or 0) / 10, 1)},
        ],
        "officialContentWarnings": _parse_json("officialContentWarnings", None),
    }


# ---------------------------------------------------------------------------
# Book endpoints
# ---------------------------------------------------------------------------

@app.route("/api/books", methods=["GET"])
def get_books():
    genre = request.args.get("genre")
    author = request.args.get("author")
    min_quality = request.args.get("minQuality", type=int)
    series = request.args.get("series")
    # ========== INCREASE BOOK LIMIT ==========
    limit = request.args.get("limit", default=500, type=int)  # Larger default limit; frontend handles pagination
    offset = request.args.get("offset", default=0, type=int)

    conn = get_conn()
    c = conn.cursor()

    query = "SELECT * FROM books WHERE 1=1"
    params = []

    if genre:
        query += " AND genres LIKE ?"
        params.append(f"%{genre}%")
    if author:
        query += " AND author = ?"
        params.append(author)
    if min_quality is not None:
        query += " AND qualityScore >= ?"
        params.append(min_quality)
    if series:
        query += " AND seriesName LIKE ?"
        params.append(f"%{series}%")

    query += " ORDER BY qualityScore DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    c.execute(query, params)
    books = [_deserialize_book(dict(row)) for row in c.fetchall()]
    conn.close()
    return jsonify(books)


# ========== FUZZY SEARCH ==========
@app.route("/api/books/search", methods=["GET"])
def search_books():
    """
    Search books using fuzzy matching on search_normalized column.
    Falls back to LIKE search on title/author/series if no results.
    """
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])

    conn = get_conn()
    c = conn.cursor()
    
    # Try fuzzy search first using search_normalized column
    normalized_query = normalize_search(q)
    c.execute("""
        SELECT * FROM books
        WHERE search_normalized LIKE ?
        ORDER BY qualityScore DESC
        LIMIT 50
    """, (f"%{normalized_query}%",))
    
    books = [_deserialize_book(dict(row)) for row in c.fetchall()]
    
    # Fallback to regular search if no fuzzy results
    if not books:
        c.execute("""
            SELECT * FROM books
            WHERE title LIKE ? OR author LIKE ? OR seriesName LIKE ?
            ORDER BY qualityScore DESC
            LIMIT 50
        """, (f"%{q}%", f"%{q}%", f"%{q}%"))
        books = [_deserialize_book(dict(row)) for row in c.fetchall()]
    
    conn.close()
    return jsonify(books)


@app.route("/api/books/<int:book_id>", methods=["GET"])
def get_book(book_id):
    user_id = request.headers.get("X-User-ID")
    premium = is_premium(int(user_id)) if user_id and user_id.isdigit() else False

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM books WHERE id = ?", (book_id,))
    row = c.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Book not found"}), 404

    book = _deserialize_book(dict(row))

    if not premium:
        book["synopsis"] = None
        # Keep official warnings visible to all users, but hide inferred/community warnings for non-premium.
        book["contentWarnings"] = []
        book["isPremiumLocked"] = True
        book["upgradeMessage"] = "Upgrade to Premium to see full details"
    else:
        book["isPremiumLocked"] = False

    return jsonify(book)


# ========== SERIES TRACKING ==========
@app.route("/api/books/<int:book_id>/series", methods=["GET"])
def get_series_info(book_id):
    """
    Get complete series information and all books in the same series.
    Returns series metadata + list of all books, sorted by seriesNumber.
    """
    conn = get_conn()
    c = conn.cursor()
    
    # Get the book to find its series
    c.execute("SELECT * FROM books WHERE id = ?", (book_id,))
    book = c.fetchone()
    
    if not book or not book["seriesName"]:
        conn.close()
        return jsonify({"error": "Book not found or not part of a series"}), 404
    
    series_name = book["seriesName"]
    
    # Get all books in the same series
    c.execute("""
        SELECT * FROM books
        WHERE seriesName = ?
        ORDER BY seriesNumber ASC, title ASC
    """, (series_name,))
    
    series_books = [_deserialize_book(dict(row)) for row in c.fetchall()]
    conn.close()
    
    # Calculate series metadata
    series_total = book["seriesTotal"]
    series_is_complete = book["seriesIsComplete"] == 1
    
    return jsonify({
        "seriesName": series_name,
        "seriesTotal": series_total,
        "seriesIsComplete": series_is_complete,
        "nextExpectedDate": None,  # Not tracked yet - placeholder for future
        "books": series_books,
    })


# ------------------------- Official warnings admin -----------------------
def getOfficialWarningsForBook(book_id: int):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT officialContentWarnings FROM books WHERE id = ?", (book_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        return None
    val = row[0]
    if not val:
        return None
    try:
        return json.loads(val)
    except Exception:
        return None


@app.route("/api/books/<int:book_id>/official-warnings", methods=["POST"])
def set_official_warnings(book_id):
    """
    Set or update officialContentWarnings for a book.
    Body must be JSON with keys: source (one of publisher|author|book_trigger_warnings_api|manual), warnings (list), optional rawText.
    """
    # Admin-only: require matching ADMIN_API_KEY header
    admin_key = os.getenv("ADMIN_API_KEY")
    provided = request.headers.get("X-Admin-Key") or request.args.get("admin_key")
    if not admin_key or provided != admin_key:
        return jsonify({"error": "Unauthorized"}), 401

    payload = request.get_json(force=True, silent=True)
    if not payload:
        return jsonify({"error": "Invalid or missing JSON body"}), 400

    source = payload.get("source")
    warnings = payload.get("warnings")
    raw_text = payload.get("rawText")

    if source not in ("publisher", "author", "book_trigger_warnings_api", "manual"):
        return jsonify({"error": "Invalid source"}), 400
    if not isinstance(warnings, list):
        return jsonify({"error": "warnings must be a list"}), 400

    doc = {
        "source": source,
        "warnings": warnings,
    }
    if raw_text:
        doc["rawText"] = raw_text

    try:
        conn = get_conn()
        c = conn.cursor()
        c.execute("UPDATE books SET officialContentWarnings = ? WHERE id = ?", (json.dumps(doc), book_id))
        conn.commit()
        conn.close()
        return jsonify({"status": "ok", "officialContentWarnings": doc})
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route("/api/series/<series_name>/notify", methods=["POST"])
def subscribe_series_updates(series_name):
    """
    Subscribe an email address to notifications for series updates.
    Creates entry in series_notifications table.
    """
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    # Basic email validation
    if "@" not in email or "." not in email:
        return jsonify({"error": "Invalid email address"}), 400
    
    conn = get_conn()
    c = conn.cursor()
    
    try:
        c.execute("""
            INSERT INTO series_notifications (email, seriesName)
            VALUES (?, ?)
        """, (email, series_name))
        conn.commit()
        conn.close()
        
        return jsonify({
            "message": f"You'll be notified when new books in {series_name} are added!"
        })
    except Exception as e:
        conn.close()
        # Likely a duplicate entry (UNIQUE constraint)
        if "UNIQUE" in str(e):
            return jsonify({
                "message": f"You're already subscribed to {series_name} updates!"
            })
        return jsonify({"error": str(e)}), 500


# ========== SPICE LEVEL EXPLANATIONS ==========
@app.route("/api/spice-levels", methods=["GET"])
def get_spice_levels():
    """
    Return spice level definitions for tooltips and glossary.
    Used by frontend SpiceBadge component.
    """
    return jsonify({
        "levels": [
            {
                "level": 0,
                "label": "Sweet/Clean",
                "description": "Closed-door romance. Kissing only or fade-to-black."
            },
            {
                "level": 1,
                "label": "Warm",
                "description": "Mild heat. Some sensuality, mostly off-page."
            },
            {
                "level": 2,
                "label": "Mild Heat",
                "description": "Moderate spice. Some on-page intimacy, not explicit."
            },
            {
                "level": 3,
                "label": "Hot",
                "description": "Spicy. Multiple explicit scenes, central to plot."
            },
            {
                "level": 4,
                "label": "Steamy",
                "description": "Very spicy. Frequent explicit content."
            },
            {
                "level": 5,
                "label": "Scorching",
                "description": "Extremely explicit. Graphic detail, high frequency."
            },
            {
                "level": 6,
                "label": "Nuclear",
                "description": "Maximum spice. Erotica-level content, potentially taboo themes."
            }
        ]
    })


# ---------------------------------------------------------------------------
# On-demand scoring
# ---------------------------------------------------------------------------


def _run_scoring_job(
    job_id: str,
    isbn: str | None,
    title: str,
    author: str,
    user_id: str | None,
    user_key: str | None = None,
    session_id: str | None = None,
):
    """Background worker for scoring a book on-demand."""
    import logging
    import json as _json
    logger = logging.getLogger(__name__)

    try:
        update_on_demand_job_status(job_id, "running")
        logger.info(f"[JOB {job_id}] Starting scoring: title='{title}', author='{author}', isbn={isbn}")

        # 1) Build context via existing hybrid pipeline
        logger.info(f"[JOB {job_id}] Calling fetch_book_context()...")
        ctx = fetch_book_context(isbn=isbn, title=title, author=author)
        context_text: str = ctx.get("context_text", "") or ""
        meta = ctx.get("meta", {}) or {}
        review_count = ctx.get("review_count", 0)
        excerpt_count = ctx.get("excerpt_count", 0)
        context_source: str = ctx.get("context_source", "description_only")
        ratings_count_estimate: int = ctx.get("ratings_count_estimate", 0)

        logger.info(
            f"[JOB {job_id}] Context fetched: source={meta.get('source')}, "
            f"context_source={context_source}, context_text_length={len(context_text)}, "
            f"review_count={review_count}, ratings_count_estimate={ratings_count_estimate}"
        )

        if not context_text.strip():
            error_msg = "No context available from data sources"
            logger.warning(f"[JOB {job_id}] {error_msg}")
            update_on_demand_job_status(job_id, "failed", error_message=error_msg)
            _log_event("on_demand_failed", user_key, session_id,
                       {"reason": "no_context", "title": title, "author": author})
            return

        # 2) Score with existing scorer
        logger.info(f"[JOB {job_id}] Calling scorer.score_book() with review_count={review_count}")
        scores = scorer.score_book(
            title=title,
            author=author,
            series="",
            genre="Romance",
            subgenre="",
            context_text=context_text,
            review_count=review_count,
        )

        if scores.get("scoring_status") == "error":
            error_msg = (scores.get("flags") or ["Unknown error"])[0]
            logger.error(f"[JOB {job_id}] Scoring failed (error): {error_msg}")
            update_on_demand_job_status(job_id, "failed", error_message=error_msg)
            _log_event("on_demand_failed", user_key, session_id,
                       {"reason": "scoring_error", "flag": error_msg, "title": title})
            return

        if scores.get("scoring_status") == "temporarily_unavailable":
            error_msg = "Scoring is temporarily busy, please try again in a few minutes."
            logger.warning(f"[JOB {job_id}] Scoring rate-limited (OpenRouter 429)")
            update_on_demand_job_status(job_id, "failed", error_message=error_msg)
            _log_event("on_demand_rate_limited", user_key, session_id, {"title": title})
            return

        logger.info(
            f"[JOB {job_id}] Scoring OK: score={scores.get('overall_score')}, "
            f"confidence={scores.get('confidence')}%"
        )

        # 3) LLM content warnings (same path as batch_score.py)
        from backend.scorer import extract_content_warnings_llm
        from backend.batch_score import extract_content_warnings_keyword, extract_spice_level

        spice_level = extract_spice_level(context_text) if review_count > 0 else 0

        cw_result = extract_content_warnings_llm(title=title, author=author, context_text=context_text)
        official_warnings = cw_result.get("warnings") or []
        if not official_warnings and "error" in cw_result:
            logger.warning(f"[JOB {job_id}] LLM CW failed ({cw_result['error']}), using keyword fallback")
            official_warnings = extract_content_warnings_keyword(context_text)

        official_cw_doc: str | None = None
        if official_warnings:
            official_cw_doc = _json.dumps({
                "source": cw_result.get("source", "llm_inferred"),
                "warnings": official_warnings,
                "confidence": cw_result.get("confidence"),
                "reasoning": cw_result.get("reasoning", ""),
            })

        # 4) Augment result dict with transparency fields + CWs
        scores["context_source"] = context_source
        scores["ratings_count_estimate"] = ratings_count_estimate
        scores["official_content_warnings"] = official_warnings
        scores["spice_level"] = spice_level

        # 5) Upsert into books table so future users get the cached result
        _upsert_conn = get_conn()
        try:
            book_id = upsert_scored_book(
                conn=_upsert_conn,
                title=title,
                author=author,
                isbn=isbn,
                scores=scores,
                ctx=ctx,
                official_cw_doc=official_cw_doc,
                spice_level=spice_level,
                increment_requested=True,   # user explicitly triggered this
            )
        finally:
            _upsert_conn.close()
        if book_id:
            scores["book_id"] = book_id
            logger.info(f"[JOB {job_id}] Upserted into books table: book_id={book_id}")
        else:
            logger.warning(f"[JOB {job_id}] books upsert returned None — job result still saved")

        # 6) Persist job result + fire analytics
        update_on_demand_job_status(job_id, "completed", result=scores)
        _log_event("on_demand_completed", user_key, session_id, {
            "title": title, "author": author,
            "overall_score": scores.get("overall_score"),
            "confidence": scores.get("confidence"),
            "context_source": context_source,
            "review_count": review_count,
            "book_id": book_id,
            "cw_count": len(official_warnings),
        })

    except Exception as e:
        logger.exception(f"[JOB {job_id}] Exception in _run_scoring_job")
        update_on_demand_job_status(job_id, "failed", error_message=str(e))
        _log_event("on_demand_failed", user_key, session_id,
                   {"reason": "exception", "error": str(e), "title": title})


@app.route("/api/score-on-demand", methods=["POST"])
def score_on_demand():
    """
    Start an on-demand scoring job.

    Request body:
        { "title": str, "author": str, "isbn": str?, "user_id": str?, "session_id": str? }

    Response (202 Accepted):
        { "job_id": str, "usage": { "used": int, "cap": int } }

    Response (429 Too Many Requests — soft cap hit):
        { "error": "cap_reached", "used": int, "cap": int,
          "message": "You've used all 10 score slots this month..." }
    """
    try:
        data = request.get_json(force=True) or {}
    except Exception as exc:
        logger.warning("/api/score-on-demand invalid JSON payload: %s", exc)
        return jsonify({
            "error": "invalid_json",
            "message": "Request body must be valid JSON.",
        }), 400

    logger.info(
        "/api/score-on-demand payload received: %s",
        {
            "title": data.get("title"),
            "author": data.get("author"),
            "isbn": data.get("isbn"),
            "user_id": data.get("user_id"),
            "session_id": data.get("session_id"),
        },
    )

    title = (data.get("title") or "").strip()
    author = (data.get("author") or "").strip()
    isbn = (data.get("isbn") or None) or None
    user_id = data.get("user_id")
    session_id = data.get("session_id")

    missing_fields = []
    if not title:
        missing_fields.append("title")
    if not author:
        missing_fields.append("author")
    if missing_fields:
        return jsonify({
            "error": "validation_error",
            "message": "Title and author are required.",
            "missing_fields": missing_fields,
        }), 400

    # Derive stable user key for cap tracking + analytics
    user_key = _get_user_key(user_id, request)

    # Check whether this book is already scored in books table (skip cap check)
    conn = get_conn()
    try:
        existing = conn.execute(
            "SELECT id, qualityScore FROM books WHERE title=? AND author=?",
            (title, author)
        ).fetchone()
    finally:
        conn.close()

    if existing and existing["qualityScore"] is not None:
        # Already scored — return the book directly, no job needed, no cap consumed
        _log_event("on_demand_cache_hit", user_key, session_id,
                   {"title": title, "author": author, "book_id": existing["id"]})
        return jsonify({
            "status": "already_scored",
            "book_id": existing["id"],
            "message": "This book is already in the StyleScope library.",
        }), 200

    # Enforce monthly soft cap
    allowed, new_count = _check_and_increment_usage(user_key)
    if not allowed:
        _log_event("on_demand_cap_hit", user_key, session_id,
                   {"title": title, "author": author, "cap": ON_DEMAND_MONTHLY_CAP})
        return jsonify({
            "error": "cap_reached",
            "used": new_count,
            "cap": ON_DEMAND_MONTHLY_CAP,
            "message": (
                f"You've used all {ON_DEMAND_MONTHLY_CAP} score slots for this month. "
                "We're still in early access, so slots are limited — more coming soon."
            ),
        }), 429

    job_id = create_on_demand_job(title=title, author=author, isbn=isbn, user_id=user_id)

    _log_event("on_demand_requested", user_key, session_id, {
        "title": title, "author": author, "isbn": isbn,
        "usage_this_month": new_count, "cap": ON_DEMAND_MONTHLY_CAP,
    })

    # Start background thread, passing user_key + session_id for analytics
    t = threading.Thread(
        target=_run_scoring_job,
        args=(job_id, isbn, title, author, user_id),
        kwargs={"user_key": user_key, "session_id": session_id},
        daemon=True,
    )
    t.start()

    return jsonify({
        "job_id": job_id,
        "usage": {"used": new_count, "cap": ON_DEMAND_MONTHLY_CAP},
    }), 202


@app.route("/api/score-on-demand/<job_id>", methods=["GET"])
def get_score_on_demand(job_id: str):
    """
    Poll the status of an on-demand scoring job.

    Response:
        {
            "job_id": "uuid",
            "status": "queued|running|completed|failed",
            "result": { ... scoring result ... },  # if completed
            "error_message": "..."  # if failed
        }
    """
    job = get_on_demand_job(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404

    status = job["status"]
    resp: dict[str, Any] = {
        "job_id": job["id"],
        "status": status,
    }

    if status == "completed":
        # result_json is a JSON string; parse to dict
        result_json = job["result_json"]
        try:
            resp["result"] = json.loads(result_json) if result_json else None
        except Exception:
            resp["result"] = None
            resp["error_message"] = "Failed to parse result JSON"

        result_obj = resp.get("result") or {}
        book_id = result_obj.get("book_id") if isinstance(result_obj, dict) else None
        if book_id:
            conn = get_conn()
            try:
                row = conn.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
                if row:
                    resp["book"] = _deserialize_book(dict(row))
            finally:
                conn.close()
    elif status == "failed":
        resp["error_message"] = job["error_message"]

    return jsonify(resp), 200


# ---------------------------------------------------------------------------
# Analytics: client-side event ingestion
# ---------------------------------------------------------------------------

@app.route("/api/analytics/event", methods=["POST"])
def log_analytics_event():
    """
    Lightweight client-side event ingestion.
    Body: { "event": str, "user_key": str?, "session_id": str?, "properties": {}? }
    Always returns 204 — never expose errors to client.
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        event = (data.get("event") or "").strip()
        if event:
            user_id = data.get("user_id")
            user_key = _get_user_key(user_id, request)
            _log_event(
                event=event,
                user_key=user_key,
                session_id=data.get("session_id"),
                properties=data.get("properties"),
            )
    except Exception:
        pass
    return "", 204


# ---------------------------------------------------------------------------
# Auth: Magic Links
# ---------------------------------------------------------------------------

@app.route("/api/auth/magic-link", methods=["POST"])
def send_magic_link():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required."}), 400

    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT OR IGNORE INTO users (email) VALUES (?)", (email,))
    conn.commit()

    token = str(uuid.uuid4())
    expires_at = (datetime.now() + timedelta(hours=1)).isoformat()
    c.execute(
        "INSERT INTO magic_links (email, token, expires_at) VALUES (?, ?, ?)",
        (email, token, expires_at),
    )
    conn.commit()
    conn.close()

    login_url = f"{FRONTEND_URL}/auth/verify?token={token}"

    try:
        msg = Message(
            subject="Your StyleScope login link",
            recipients=[email],
            body=(
                f"Click the link below to log in to StyleScope.\n\n"
                f"{login_url}\n\n"
                f"This link expires in 1 hour and can only be used once.\n\n"
                f"If you didn't request this, you can safely ignore this email."
            ),
        )
        mail.send(msg)
    except Exception as e:
        print(f"[mail] Failed to send to {email}: {e}")
        print(f"[dev] Magic link: {login_url}")

    return jsonify({"message": "Magic link sent! Check your email."})


@app.route("/api/auth/verify", methods=["GET"])
def verify_magic_link():
    token = request.args.get("token", "").strip()
    if not token:
        return jsonify({"error": "Token is required."}), 400

    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        SELECT * FROM magic_links
        WHERE token = ? AND used = 0 AND expires_at > ?
    """, (token, datetime.now().isoformat()))
    link = c.fetchone()

    if not link:
        conn.close()
        return jsonify({"error": "Invalid or expired token."}), 401

    c.execute("UPDATE magic_links SET used = 1 WHERE token = ?", (token,))
    email = link["email"]
    c.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = dict(c.fetchone())
    conn.commit()
    conn.close()

    return jsonify({
        "user": {
            "id": user["id"],
            "email": user["email"],
            "subscription_status": user["subscription_status"],
        }
    })


# ---------------------------------------------------------------------------
# Stripe Payments
# ---------------------------------------------------------------------------

@app.route("/api/stripe/checkout", methods=["POST"])
def create_checkout():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    plan = data.get("plan", "one_time")

    if not email:
        return jsonify({"error": "Email is required."}), 400

    price_id = (
        STRIPE_SUBSCRIPTION_PRICE_ID if plan == "subscription"
        else STRIPE_ONE_TIME_PRICE_ID
    )
    if not price_id:
        return jsonify({"error": f"Price ID for plan '{plan}' not configured."}), 500

    mode = "subscription" if plan == "subscription" else "payment"

    try:
        session = stripe.checkout.Session.create(
            mode=mode,
            customer_email=email,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{FRONTEND_URL}/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/pricing",
        )
        return jsonify({"checkout_url": session.url})
    except stripe.error.StripeError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/stripe/webhook", methods=["POST"])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get("Stripe-Signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        return jsonify({"error": str(e)}), 400

    if event["type"] in ("checkout.session.completed", "invoice.payment_succeeded"):
        session = event["data"]["object"]
        customer_email = session.get("customer_email") or session.get("customer_details", {}).get("email")
        stripe_customer_id = session.get("customer")

        if customer_email:
            conn = get_conn()
            c = conn.cursor()
            c.execute("""
                UPDATE users
                SET subscription_status = 'active', stripe_customer_id = ?
                WHERE email = ?
            """, (stripe_customer_id, customer_email.lower()))
            conn.commit()
            conn.close()
            print(f"[stripe] Activated subscription for {customer_email}")

    elif event["type"] in ("customer.subscription.deleted", "invoice.payment_failed"):
        subscription = event["data"]["object"]
        stripe_customer_id = subscription.get("customer")
        if stripe_customer_id:
            conn = get_conn()
            c = conn.cursor()
            c.execute("""
                UPDATE users SET subscription_status = 'cancelled'
                WHERE stripe_customer_id = ?
            """, (stripe_customer_id,))
            conn.commit()
            conn.close()
            print(f"[stripe] Cancelled subscription for customer {stripe_customer_id}")

    return jsonify({"received": True})


# ---------------------------------------------------------------------------
# Points system
# ---------------------------------------------------------------------------

def _ensure_points_row(c, user_id: int):
    """Create a user_points row if it doesn't exist yet."""
    c.execute(
        "INSERT OR IGNORE INTO user_points (user_id, points, lifetime_points) VALUES (?, 0, 0)",
        (user_id,),
    )


def _get_points(c, user_id: int) -> dict:
    c.execute("SELECT points, lifetime_points FROM user_points WHERE user_id = ?", (user_id,))
    row = c.fetchone()
    return {"points": row["points"], "lifetime_points": row["lifetime_points"]} if row else {"points": 0, "lifetime_points": 0}


def _add_points(conn, user_id: int, amount: int, action: str) -> dict:
    """Add points and log the transaction. Returns updated balances."""
    c = conn.cursor()
    _ensure_points_row(c, user_id)
    c.execute("""
        UPDATE user_points
        SET points = points + ?, lifetime_points = lifetime_points + ?
        WHERE user_id = ?
    """, (amount, amount, user_id))
    c.execute("""
        INSERT INTO point_transactions (user_id, points, action)
        VALUES (?, ?, ?)
    """, (user_id, amount, action))
    conn.commit()
    return _get_points(c, user_id)


@app.route("/api/user/<int:user_id>/points", methods=["GET"])
def get_user_points(user_id):
    conn = get_conn()
    c = conn.cursor()
    _ensure_points_row(c, user_id)
    conn.commit()
    balances = _get_points(c, user_id)
    conn.close()
    return jsonify(balances)


@app.route("/api/user/<int:user_id>/points/award", methods=["POST"])
def award_points(user_id):
    data = request.get_json(force=True)
    action = (data.get("action") or "manual").strip()
    amount = int(data.get("points", 0))

    if amount <= 0:
        return jsonify({"error": "Points must be a positive integer."}), 400

    conn = get_conn()
    balances = _add_points(conn, user_id, amount, action)
    conn.close()
    return jsonify(balances)


@app.route("/api/user/<int:user_id>/points/redeem", methods=["POST"])
def redeem_points(user_id):
    data = request.get_json(force=True)
    redemption = (data.get("redemption") or "").strip()
    cost = int(data.get("cost", 0))

    if cost <= 0:
        return jsonify({"error": "Cost must be a positive integer."}), 400

    conn = get_conn()
    c = conn.cursor()
    _ensure_points_row(c, user_id)
    conn.commit()
    balances = _get_points(c, user_id)

    if balances["points"] < cost:
        conn.close()
        return jsonify({"error": "Insufficient points.", "points": balances["points"]}), 400

    c.execute(
        "UPDATE user_points SET points = points - ? WHERE user_id = ?",
        (cost, user_id),
    )
    c.execute(
        "INSERT INTO point_transactions (user_id, points, action) VALUES (?, ?, ?)",
        (user_id, -cost, f"redeem:{redemption}"),
    )
    conn.commit()
    updated = _get_points(c, user_id)
    conn.close()
    return jsonify(updated)


# ---------------------------------------------------------------------------
# Quiz endpoints
# ---------------------------------------------------------------------------

@app.route("/api/quiz/trivia", methods=["GET"])
def get_trivia_quiz():
    sample = random.sample(TRIVIA_BANK, min(5, len(TRIVIA_BANK)))
    # Strip correct_index before sending to client
    questions = [
        {"id": q["id"], "question": q["question"], "options": q["options"]}
        for q in sample
    ]
    return jsonify({"questions": questions})


@app.route("/api/quiz/trivia/submit", methods=["POST"])
def submit_trivia_quiz():
    data = request.get_json(force=True)
    user_id = data.get("user_id")
    answers = data.get("answers", [])  # [{"id": int, "option_index": int}]

    # Build lookup by id
    bank_by_id = {q["id"]: q for q in TRIVIA_BANK}
    correct_count = 0

    for ans in answers:
        q = bank_by_id.get(ans.get("id"))
        if q and ans.get("option_index") == q["correct_index"]:
            correct_count += 1

    points_awarded = correct_count * 10

    if user_id and points_awarded > 0:
        conn = get_conn()
        _add_points(conn, user_id, points_awarded, "trivia_quiz")
        conn.close()

    return jsonify({
        "correct": correct_count,
        "total": len(answers),
        "points_awarded": points_awarded,
    })


@app.route("/api/quiz/personality", methods=["GET"])
def get_personality_quiz():
    questions = [
        {"id": q["id"], "question": q["question"], "options": q["options"]}
        for q in PERSONALITY_QUESTIONS
    ]
    return jsonify({"questions": questions})


@app.route("/api/quiz/personality/submit", methods=["POST"])
def submit_personality_quiz():
    data = request.get_json(force=True)
    user_id = data.get("user_id")
    answers = data.get("answers", [])  # [option_index, ...]

    profile = score_personality(answers)
    points_awarded = 50

    if user_id:
        conn = get_conn()
        _add_points(conn, user_id, points_awarded, "personality_quiz")
        conn.close()

    return jsonify({"profile": profile, "points_awarded": points_awarded})


# ---------------------------------------------------------------------------
# Pepper mascot
# ---------------------------------------------------------------------------

PEPPER_MESSAGES = {
    "idle": {
        "messages": [
            "I've read more romance novels than most book clubs combined. Ask me anything.",
            "Go ahead. Judge a book by its cover. I'll judge it by its prose.",
            "Standing by. Ready to save you from a bad reading decision.",
            "Some books are a gift. Others are a two-star warning label in disguise.",
            "Your next great read is one score away.",
        ],
        "animation": "neutral",
    },
    "loading": {
        "messages": [
            "Sifting through reader opinions so you don't have to.",
            "Analyzing writing quality. This takes longer than reading the blurb.",
            "Running the numbers. Please do not shake the algorithm.",
            "Consulting the data. Real reviews from real readers — no marketing copy.",
            "Processing. The scoring engine is working harder than the author's editor.",
        ],
        "animation": "sweating",
    },
    "low_score": {
        "messages": [
            "The writing needed more time in the oven. The score reflects that.",
            "Technically, this qualifies as a book. Technically.",
            "Some readers enjoyed it. The prose did not make it easy for them.",
            "A low score is not a personal attack on the characters. Just the craft.",
            "The plot had ambition. The execution had a different plan.",
        ],
        "animation": "eyeroll",
    },
    "high_score": {
        "messages": [
            "Clean prose, strong pacing, solid craft. This one earned its score.",
            "A high score means the writing works. The rest is up to your taste.",
            "Not every highly scored book will be your favorite. But this one is well-made.",
            "The author clearly revised. It shows. Well done.",
            "This is what a polished manuscript looks like. Take notes.",
        ],
        "animation": "heart_eyes",
    },
    "nuclear_spice": {
        "messages": [
            "Content warnings are not suggestions. Read them.",
            "This book operates at an elevated intensity level. You have been informed.",
            "Spice level: significant. Proceed with full awareness of what that means.",
            "The content here is not subtle. The score reflects writing quality, not temperature.",
            "High spice does not mean low quality. It means high spice. Plan accordingly.",
        ],
        "animation": "on_fire",
    },
}

ANIMATION_MAP = {
    "idle": "neutral",
    "loading": "sweating",
    "low_score": "eyeroll",
    "high_score": "heart_eyes",
    "nuclear_spice": "on_fire",
}


@app.route("/api/pepper/message", methods=["GET"])
def pepper_message():
    context = request.args.get("context", "idle")
    quality_score = request.args.get("quality_score", type=int)
    spice_level = request.args.get("spice_level", type=int)

    # Auto-resolve context from scores if not explicitly set
    if context == "idle":
        if spice_level is not None and spice_level >= 5:
            context = "nuclear_spice"
        elif quality_score is not None:
            if quality_score >= 80:
                context = "high_score"
            elif quality_score < 60:
                context = "low_score"

    bucket = PEPPER_MESSAGES.get(context, PEPPER_MESSAGES["idle"])
    message = random.choice(bucket["messages"])
    animation = ANIMATION_MAP.get(context, "neutral")

    return jsonify({"message": message, "animation": animation})


# ---------------------------------------------------------------------------
# Premium helpers
# ---------------------------------------------------------------------------

def is_premium(user_id):
    """Check if user has active premium subscription."""
    if not user_id:
        return False
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT subscription_status FROM users WHERE id = ?", (user_id,))
    user = c.fetchone()
    conn.close()
    return user is not None and user["subscription_status"] == "active"


# ---------------------------------------------------------------------------
# Home sections
# ---------------------------------------------------------------------------

@app.route("/api/books/home-sections", methods=["GET"])
def get_home_sections():
    """Return curated sections for the home page."""
    conn = get_conn()
    c = conn.cursor()

    # Recently scored (newest first)
    c.execute("""
        SELECT * FROM books
        WHERE qualityScore IS NOT NULL AND qualityScore > 0
        ORDER BY scoredDate DESC
        LIMIT 12
    """)
    recently_scored = [_deserialize_book(dict(row)) for row in c.fetchall()]

    # Highest rated
    c.execute("""
        SELECT * FROM books
        WHERE qualityScore IS NOT NULL AND qualityScore > 0
        ORDER BY qualityScore DESC
        LIMIT 12
    """)
    highest_rated = [_deserialize_book(dict(row)) for row in c.fetchall()]

    # Random picks
    c.execute("""
        SELECT * FROM books
        WHERE qualityScore IS NOT NULL AND qualityScore > 0
        ORDER BY RANDOM()
        LIMIT 12
    """)
    random_picks = [_deserialize_book(dict(row)) for row in c.fetchall()]

    conn.close()
    return jsonify({
        "recentlyScored": recently_scored,
        "highestRated": highest_rated,
        "randomPicks": random_picks,
    })


# ---------------------------------------------------------------------------
# Content warnings
# ---------------------------------------------------------------------------

@app.route("/api/content-warnings/categories", methods=["GET"])
def get_warning_categories():
    """Return all content warning categories with definitions."""
    return jsonify({
        "categories": [
            {"id": "dubious_consent",  "label": "Dubious Consent",    "definition": "Consent issues or unclear consent"},
            {"id": "sexual_violence",  "label": "Sexual Violence",    "definition": "Non-consensual sexual content"},
            {"id": "graphic_violence", "label": "Graphic Violence",   "definition": "Detailed violent scenes"},
            {"id": "stalking",         "label": "Stalking",           "definition": "Obsessive following or monitoring"},
            {"id": "age_gap",          "label": "Age Gap",            "definition": "Significant age difference (10+ years)"},
            {"id": "mental_health",    "label": "Mental Health",      "definition": "Depression, anxiety, PTSD"},
            {"id": "suicide",          "label": "Suicide/Self-Harm",  "definition": "Suicide ideation or self-harm"},
            {"id": "cheating",         "label": "Cheating/Infidelity","definition": "Infidelity by main characters"},
            {"id": "death",            "label": "Death of Loved One", "definition": "Loss of family member or partner"},
            {"id": "substance_abuse",  "label": "Substance Abuse",    "definition": "Drug or alcohol abuse"},
        ]
    })


# ---------------------------------------------------------------------------
# User preferences (Premium)
# ---------------------------------------------------------------------------

@app.route("/api/user/<int:user_id>/preferences", methods=["GET"])
def get_preferences(user_id):
    """Get all user preferences (PREMIUM ONLY)."""
    if not is_premium(user_id):
        return jsonify({"error": "Premium feature"}), 403

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM user_preferences WHERE user_id = ?", (user_id,))
    rows = c.fetchall()
    conn.close()

    prefs = {}
    for row in rows:
        cat_type = row["category_type"]
        if cat_type not in prefs:
            prefs[cat_type] = {}
        prefs[cat_type][row["category_value"]] = row["preference"]

    return jsonify(prefs)


@app.route("/api/user/<int:user_id>/preferences", methods=["PUT"])
def update_preferences(user_id):
    """Bulk update preferences (PREMIUM ONLY)."""
    if not is_premium(user_id):
        return jsonify({"error": "Premium feature"}), 403

    data = request.get_json(force=True)

    conn = get_conn()
    c = conn.cursor()

    for cat_type, values in data.items():
        for cat_value, preference in values.items():
            c.execute("""
                INSERT OR REPLACE INTO user_preferences
                (user_id, category_type, category_value, preference, updated_at)
                VALUES (?, ?, ?, ?, ?)
            """, (user_id, cat_type, cat_value, preference, datetime.now().isoformat()))

    conn.commit()
    conn.close()
    return jsonify({"message": "Preferences updated"})


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM books")
    book_count = c.fetchone()[0]
    conn.close()
    return jsonify({"status": "ok", "books_in_db": book_count})


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

init_db()
migrate_csv_to_db()
# init_gamification_db() — disabled v1; tables preserved but blueprint not registered

if __name__ == "__main__":
    app.run(debug=True, port=5000, host="0.0.0.0")
