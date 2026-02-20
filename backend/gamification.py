"""
Pepper's Universe — Gamification Backend
Flask Blueprint for points, achievements, streaks, biomes, and anonymous user identity.

Registered in api.py:
    from backend.gamification import gamification_bp, init_gamification_db
    app.register_blueprint(gamification_bp)
"""

import json
import sqlite3
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

gamification_bp = Blueprint("gamification", __name__, url_prefix="/api/game")

# ---------------------------------------------------------------------------
# Point values per event type
# ---------------------------------------------------------------------------
POINT_VALUES = {
    "app_open": 10,
    "search": 5,
    "book_viewed": 2,
    "score_requested": 15,
    "gem_found": 50,
    "tbr_added": 15,
    "biome_viewed": 0,
}

STREAK_BONUSES = {
    3: 25,
    7: 50,
    14: 75,
    30: 100,
}

BIOME_UNLOCK_THRESHOLDS = {
    "peppers_home": 0,
    "sweet_garden": 0,
    "spice_market": 100,
    "fire_plains": 250,
    "inferno_peak": 500,
    "mystery_library": 400,
    "midnight_archive": 750,   # premium
    "crystal_cove": 1000,      # premium
}

CHARACTER_UNLOCK_THRESHOLDS = {
    "pepper": 0,
    "honey": 0,
    "cinnamon": 100,
    "blaze": 250,
    "ghost": 500,
    "sage": 400,
    "shadow": 750,
    "pearl": 1000,
}

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _get_conn():
    import os
    db_path = os.getenv("DB_PATH", "stylescope.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_gamification_db(conn=None):
    """Create gamification tables. Safe to run multiple times."""
    should_close = conn is None
    if conn is None:
        conn = _get_conn()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS anon_users (
            uuid TEXT PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            linked_user_id INTEGER REFERENCES users(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS game_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            anon_uuid TEXT UNIQUE REFERENCES anon_users(uuid),
            user_id INTEGER UNIQUE REFERENCES users(id),
            points INTEGER DEFAULT 0,
            lifetime_points INTEGER DEFAULT 0,
            streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_active_date TEXT,
            active_biome TEXT DEFAULT 'peppers_home',
            favorite_biome TEXT,
            unlocked_biomes TEXT DEFAULT '["peppers_home","sweet_garden"]',
            unlocked_characters TEXT DEFAULT '["pepper","honey"]',
            discovered_lore TEXT DEFAULT '[]',
            reader_profile TEXT,
            total_searches INTEGER DEFAULT 0,
            total_books_viewed INTEGER DEFAULT 0,
            total_gems_found INTEGER DEFAULT 0,
            total_scores_requested INTEGER DEFAULT 0
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            anon_uuid TEXT,
            user_id INTEGER,
            achievement_id TEXT NOT NULL,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS lore_discoveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            anon_uuid TEXT,
            user_id INTEGER,
            lore_card_id TEXT NOT NULL,
            discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Idempotent migration for existing point_transactions table
    try:
        c.execute("ALTER TABLE point_transactions ADD COLUMN anon_uuid TEXT")
    except Exception:
        pass

    conn.commit()
    if should_close:
        conn.close()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_or_create_state(c, anon_uuid):
    """Ensure anon user + game state rows exist, return game state as dict."""
    c.execute("INSERT OR IGNORE INTO anon_users (uuid) VALUES (?)", (anon_uuid,))
    c.execute("INSERT OR IGNORE INTO game_state (anon_uuid) VALUES (?)", (anon_uuid,))
    c.execute("SELECT * FROM game_state WHERE anon_uuid = ?", (anon_uuid,))
    return dict(c.fetchone())


def _update_streak(c, anon_uuid, state):
    """Update streak based on last_active_date. Returns (new_streak, streak_bonus)."""
    today = datetime.now().strftime("%Y-%m-%d")
    last = state.get("last_active_date")

    if last == today:
        return state["streak"], 0

    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    new_streak = state["streak"] + 1 if last == yesterday else 1

    longest = max(state.get("longest_streak", 0), new_streak)
    c.execute(
        """UPDATE game_state
           SET streak = ?, longest_streak = ?, last_active_date = ?
           WHERE anon_uuid = ?""",
        (new_streak, longest, today, anon_uuid),
    )

    # Check for streak milestone bonus
    bonus = STREAK_BONUSES.get(new_streak, 0)
    return new_streak, bonus


def _check_achievements(c, anon_uuid, state, event_type, new_lifetime):
    """Check and award newly earned achievements. Returns list of earned IDs."""
    c.execute(
        "SELECT achievement_id FROM achievements WHERE anon_uuid = ?",
        (anon_uuid,),
    )
    earned_ids = {r["achievement_id"] for r in c.fetchall()}

    newly_earned = []

    checks = [
        ("first_scanner", event_type == "score_requested"),
        ("hidden_gem_hunter", state.get("total_gems_found", 0) >= 10),
        ("bookworm", state.get("total_books_viewed", 0) >= 100),
        ("streak_master", state.get("longest_streak", 0) >= 30),
        ("spice_explorer", event_type == "spice_6_viewed"),
    ]

    # Streak milestones
    streak = state.get("streak", 0)
    if streak >= 3:
        checks.append(("streak_3", True))
    if streak >= 7:
        checks.append(("streak_7", True))
    if streak >= 14:
        checks.append(("streak_14", True))
    if streak >= 30:
        checks.append(("streak_30", True))

    for ach_id, condition in checks:
        if condition and ach_id not in earned_ids:
            c.execute(
                "INSERT INTO achievements (anon_uuid, achievement_id) VALUES (?, ?)",
                (anon_uuid, ach_id),
            )
            newly_earned.append(ach_id)
            earned_ids.add(ach_id)

    return newly_earned


def _check_biome_unlocks(lifetime_points, unlocked_biomes_list):
    """Return list of newly unlockable biome IDs."""
    newly_unlocked = []
    for biome_id, threshold in BIOME_UNLOCK_THRESHOLDS.items():
        if threshold > 0 and lifetime_points >= threshold and biome_id not in unlocked_biomes_list:
            newly_unlocked.append(biome_id)
    return newly_unlocked


def _check_character_unlocks(lifetime_points, unlocked_chars_list):
    """Return list of newly unlockable character IDs."""
    newly_unlocked = []
    for char_id, threshold in CHARACTER_UNLOCK_THRESHOLDS.items():
        if threshold > 0 and lifetime_points >= threshold and char_id not in unlocked_chars_list:
            newly_unlocked.append(char_id)
    return newly_unlocked


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@gamification_bp.route("/session", methods=["GET"])
def get_session():
    """Get or create game session for anonymous user."""
    anon_uuid = request.args.get("uuid", "").strip()
    if not anon_uuid:
        return jsonify({"error": "uuid required"}), 400

    conn = _get_conn()
    c = conn.cursor()
    state = _get_or_create_state(c, anon_uuid)

    # Update last_active timestamp
    c.execute(
        "UPDATE anon_users SET last_active = ? WHERE uuid = ?",
        (datetime.now().isoformat(), anon_uuid),
    )

    # Fetch achievements
    c.execute(
        "SELECT achievement_id, unlocked_at FROM achievements WHERE anon_uuid = ?",
        (anon_uuid,),
    )
    achievements = [dict(r) for r in c.fetchall()]

    conn.commit()
    conn.close()

    return jsonify({
        "uuid": anon_uuid,
        "points": state["points"],
        "lifetime_points": state["lifetime_points"],
        "streak": state["streak"],
        "longest_streak": state.get("longest_streak", 0),
        "last_active_date": state["last_active_date"],
        "active_biome": state["active_biome"],
        "favorite_biome": state.get("favorite_biome"),
        "unlocked_biomes": json.loads(state["unlocked_biomes"]),
        "unlocked_characters": json.loads(state["unlocked_characters"]),
        "discovered_lore": json.loads(state["discovered_lore"]),
        "reader_profile": state.get("reader_profile"),
        "achievements": achievements,
        "stats": {
            "total_searches": state.get("total_searches", 0),
            "total_books_viewed": state.get("total_books_viewed", 0),
            "total_gems_found": state.get("total_gems_found", 0),
            "total_scores_requested": state.get("total_scores_requested", 0),
        },
    })


@gamification_bp.route("/event", methods=["POST"])
def handle_event():
    """Central event handler for all gamification actions."""
    data = request.get_json(force=True)
    anon_uuid = (data.get("uuid") or "").strip()
    event_type = (data.get("event_type") or "").strip()

    if not anon_uuid or not event_type:
        return jsonify({"error": "uuid and event_type required"}), 400

    conn = _get_conn()
    c = conn.cursor()
    state = _get_or_create_state(c, anon_uuid)

    # Calculate points
    points = POINT_VALUES.get(event_type, 0)

    # Update streak
    new_streak, streak_bonus = _update_streak(c, anon_uuid, state)
    points += streak_bonus

    # Update activity counters
    stat_updates = []
    if event_type == "search":
        stat_updates.append(("total_searches", state.get("total_searches", 0) + 1))
    elif event_type == "book_viewed":
        stat_updates.append(("total_books_viewed", state.get("total_books_viewed", 0) + 1))
    elif event_type == "gem_found":
        stat_updates.append(("total_gems_found", state.get("total_gems_found", 0) + 1))
    elif event_type == "score_requested":
        stat_updates.append(("total_scores_requested", state.get("total_scores_requested", 0) + 1))

    for col, val in stat_updates:
        c.execute(f"UPDATE game_state SET {col} = ? WHERE anon_uuid = ?", (val, anon_uuid))
        state[col] = val

    # Update points
    new_points = state["points"] + points
    new_lifetime = state["lifetime_points"] + points

    if points > 0:
        c.execute(
            "UPDATE game_state SET points = ?, lifetime_points = ? WHERE anon_uuid = ?",
            (new_points, new_lifetime, anon_uuid),
        )
        c.execute(
            "INSERT INTO point_transactions (anon_uuid, points, action) VALUES (?, ?, ?)",
            (anon_uuid, points, event_type),
        )

    # Check achievements
    state["streak"] = new_streak
    state["longest_streak"] = max(state.get("longest_streak", 0), new_streak)
    achievements_earned = _check_achievements(c, anon_uuid, state, event_type, new_lifetime)

    # Check biome unlocks
    unlocked_biomes = json.loads(state["unlocked_biomes"])
    new_biomes = _check_biome_unlocks(new_lifetime, unlocked_biomes)
    if new_biomes:
        unlocked_biomes.extend(new_biomes)
        c.execute(
            "UPDATE game_state SET unlocked_biomes = ? WHERE anon_uuid = ?",
            (json.dumps(unlocked_biomes), anon_uuid),
        )

    # Check character unlocks
    unlocked_chars = json.loads(state["unlocked_characters"])
    new_chars = _check_character_unlocks(new_lifetime, unlocked_chars)
    if new_chars:
        unlocked_chars.extend(new_chars)
        c.execute(
            "UPDATE game_state SET unlocked_characters = ? WHERE anon_uuid = ?",
            (json.dumps(unlocked_chars), anon_uuid),
        )

    conn.commit()
    conn.close()

    return jsonify({
        "points_awarded": points,
        "streak_bonus": streak_bonus,
        "new_total": new_points,
        "lifetime_points": new_lifetime,
        "streak": new_streak,
        "achievements_earned": achievements_earned,
        "biomes_unlocked": new_biomes,
        "characters_unlocked": new_chars,
    })


@gamification_bp.route("/biome", methods=["POST"])
def set_active_biome():
    """Set the user's active biome."""
    data = request.get_json(force=True)
    anon_uuid = (data.get("uuid") or "").strip()
    biome_id = (data.get("biome_id") or "").strip()

    if not anon_uuid or not biome_id:
        return jsonify({"error": "uuid and biome_id required"}), 400

    conn = _get_conn()
    c = conn.cursor()
    state = _get_or_create_state(c, anon_uuid)

    unlocked = json.loads(state["unlocked_biomes"])
    if biome_id not in unlocked:
        conn.close()
        return jsonify({"error": "Biome not unlocked"}), 403

    c.execute(
        "UPDATE game_state SET active_biome = ? WHERE anon_uuid = ?",
        (biome_id, anon_uuid),
    )
    conn.commit()
    conn.close()

    return jsonify({"active_biome": biome_id})


@gamification_bp.route("/link-account", methods=["POST"])
def link_account():
    """Link anonymous session to a registered user account."""
    data = request.get_json(force=True)
    anon_uuid = (data.get("uuid") or "").strip()
    user_id = data.get("user_id")

    if not anon_uuid or not user_id:
        return jsonify({"error": "uuid and user_id required"}), 400

    conn = _get_conn()
    c = conn.cursor()

    # Link the anon user
    c.execute(
        "UPDATE anon_users SET linked_user_id = ? WHERE uuid = ?",
        (user_id, anon_uuid),
    )

    # Copy game state to user_id reference
    c.execute(
        "UPDATE game_state SET user_id = ? WHERE anon_uuid = ?",
        (user_id, anon_uuid),
    )

    # Sync points to user_points table for compatibility with existing endpoints
    c.execute("SELECT points, lifetime_points FROM game_state WHERE anon_uuid = ?", (anon_uuid,))
    gs = c.fetchone()
    if gs:
        c.execute(
            """INSERT OR REPLACE INTO user_points (user_id, points, lifetime_points)
               VALUES (?, ?, ?)""",
            (user_id, gs["points"], gs["lifetime_points"]),
        )

    conn.commit()
    conn.close()

    return jsonify({"linked": True, "user_id": user_id})
