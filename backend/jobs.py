"""
On-demand scoring job management for StyleScope.

Handles creation, retrieval, and status updates for background scoring tasks.
Jobs are persisted to SQLite for durability and can be polled by the frontend.
"""

import uuid
import json
import datetime
from datetime import timezone
import os
import sqlite3
from typing import Optional, Dict, Any


def _get_conn():
    db_path = os.getenv("DB_PATH", "stylescope.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _row_to_dict(row) -> Dict[str, Any]:
    """Convert sqlite3.Row to dict. Assumes row_factory = sqlite3.Row."""
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "status": row["status"],
        "isbn": row["isbn"],
        "title": row["title"],
        "author": row["author"],
        "user_id": row["user_id"],
        "result_json": row["result_json"],
        "error_message": row["error_message"],
    }


def create_on_demand_job(
    title: str,
    author: str,
    isbn: Optional[str] = None,
    user_id: Optional[str] = None,
) -> str:
    """
    Create a new on-demand scoring job.

    Args:
        title: Book title
        author: Book author
        isbn: Optional ISBN
        user_id: Optional user ID

    Returns:
        job_id (UUID string)
    """
    job_id = str(uuid.uuid4())
    now = datetime.datetime.now(timezone.utc).isoformat()

    conn = _get_conn()
    c = conn.cursor()
    c.execute(
        """
        INSERT INTO on_demand_jobs (
            id, created_at, updated_at, status,
            isbn, title, author, user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (job_id, now, now, "queued", isbn, title, author, user_id),
    )
    conn.commit()
    conn.close()

    return job_id


def get_on_demand_job(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a job by ID.

    Args:
        job_id: The UUID of the job

    Returns:
        Job dict or None if not found
    """
    conn = _get_conn()
    c = conn.cursor()
    c.execute(
        """
        SELECT id, created_at, updated_at, status,
               isbn, title, author, user_id,
               result_json, error_message
        FROM on_demand_jobs
        WHERE id = ?
        """,
        (job_id,),
    )
    row = c.fetchone()
    conn.close()

    if not row:
        return None
    return _row_to_dict(row)


def update_on_demand_job_status(
    job_id: str,
    status: str,
    result: Optional[dict] = None,
    error_message: Optional[str] = None,
) -> None:
    """
    Update job status and optionally store result or error.

    Args:
        job_id: The UUID of the job
        status: New status (queued, running, completed, failed)
        result: Optional scoring result dict
        error_message: Optional error message
    """
    now = datetime.datetime.now(timezone.utc).isoformat()
    result_json = json.dumps(result) if result is not None else None

    conn = _get_conn()
    c = conn.cursor()
    c.execute(
        """
        UPDATE on_demand_jobs
        SET status = ?,
            updated_at = ?,
            result_json = COALESCE(?, result_json),
            error_message = COALESCE(?, error_message)
        WHERE id = ?
        """,
        (status, now, result_json, error_message, job_id),
    )
    conn.commit()
    conn.close()
