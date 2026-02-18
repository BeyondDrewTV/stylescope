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
    POST /api/score-on-demand
    GET  /api/job-status/<id>
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
import os
import random
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta

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

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------------
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
        ("seriesName",       "TEXT"),
        ("seriesNumber",     "INTEGER"),
        ("seriesTotal",      "INTEGER"),
        ("seriesIsComplete", "INTEGER DEFAULT 0"),
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

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Migration helpers
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Book helpers
# ---------------------------------------------------------------------------

def _deserialize_book(book: dict) -> dict:
    for field in ("genres", "contentWarnings", "themes", "moods"):
        val = book.get(field)
        if isinstance(val, str):
            try:
                book[field] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                book[field] = []
        elif val is None:
            book[field] = []
    return book


# ---------------------------------------------------------------------------
# Book endpoints
# ---------------------------------------------------------------------------

@app.route("/api/books", methods=["GET"])
def get_books():
    genre = request.args.get("genre")
    author = request.args.get("author")
    min_quality = request.args.get("minQuality", type=int)
    series = request.args.get("series")
    limit = request.args.get("limit", default=200, type=int)
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


@app.route("/api/books/search", methods=["GET"])
def search_books():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])

    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        SELECT * FROM books
        WHERE title LIKE ? OR author LIKE ? OR seriesName LIKE ?
        ORDER BY qualityScore DESC
        LIMIT 20
    """, (f"%{q}%", f"%{q}%", f"%{q}%"))
    books = [_deserialize_book(dict(row)) for row in c.fetchall()]
    conn.close()
    return jsonify(books)


@app.route("/api/books/<int:book_id>", methods=["GET"])
def get_book(book_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM books WHERE id = ?", (book_id,))
    row = c.fetchone()
    conn.close()

    if row:
        return jsonify(_deserialize_book(dict(row)))
    return jsonify({"error": "Book not found"}), 404


# ---------------------------------------------------------------------------
# On-demand scoring
# ---------------------------------------------------------------------------

scoring_jobs: dict = {}
_jobs_lock = threading.Lock()


def _score_book_async(job_id: str, title: str, author: str):
    def update(progress=None, status=None, **kwargs):
        with _jobs_lock:
            if progress:
                scoring_jobs[job_id]["progress"] = progress
            if status:
                scoring_jobs[job_id]["status"] = status
            scoring_jobs[job_id].update(kwargs)

    try:
        update(progress="Scraping Goodreads reviews…")
        reviews = goodreads.scrape(title, author)

        if not reviews:
            update(status="failed", error="No reviews found on Goodreads for this book.")
            return

        update(progress=f"Scoring {len(reviews)} reviews with Gemini…")
        scores = scorer.score_book(title, author, reviews)

        conn = get_conn()
        c = conn.cursor()
        c.execute("""
            INSERT OR REPLACE INTO books
                (title, author, qualityScore, technicalQuality, proseStyle,
                 pacing, readability, craftExecution, confidenceLevel,
                 voteCount, scoredDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            title, author,
            scores["overall"],
            scores["grammar"],
            scores["prose"],
            scores["pacing"],
            scores["readability"],
            scores["polish"],
            scores.get("confidence", "medium"),
            len(reviews),
            datetime.now().isoformat(),
        ))
        book_id = c.lastrowid
        conn.commit()

        c.execute("SELECT * FROM books WHERE id = ?", (book_id,))
        book = _deserialize_book(dict(c.fetchone()))
        conn.close()

        update(status="complete", progress="Done!", book=book)

    except Exception as e:
        update(status="failed", error=str(e))


@app.route("/api/score-on-demand", methods=["POST"])
def score_on_demand():
    data = request.get_json(force=True)
    title = (data.get("title") or "").strip()
    author = (data.get("author") or "").strip()

    if not title or not author:
        return jsonify({"error": "Both 'title' and 'author' are required."}), 400

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM books WHERE title = ? AND author = ?", (title, author))
    existing = c.fetchone()
    conn.close()

    if existing:
        return jsonify({"status": "exists", "book": _deserialize_book(dict(existing))})

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        scoring_jobs[job_id] = {
            "status": "processing",
            "progress": "Starting…",
            "created_at": time.time(),
        }

    thread = threading.Thread(
        target=_score_book_async,
        args=(job_id, title, author),
        daemon=True,
    )
    thread.start()

    return jsonify({"job_id": job_id, "estimated_seconds": 30})


@app.route("/api/job-status/<job_id>", methods=["GET"])
def job_status(job_id):
    with _jobs_lock:
        job = scoring_jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)


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

if __name__ == "__main__":
    app.run(debug=True, port=5000, host="0.0.0.0")
