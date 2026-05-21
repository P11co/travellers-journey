"""
database.py — Async SQLite database layer for SeoulWalk

Uses aiosqlite for non-blocking I/O.  Tables:
  - sessions: one row per user session
  - itinerary_items: ordered stops within a session's itinerary
"""

from __future__ import annotations

import aiosqlite
import os
from server.config import DATABASE_PATH

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    location    TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS itinerary_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id          TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    item_order          INTEGER NOT NULL,
    time_slot           TEXT    NOT NULL,
    place               TEXT    NOT NULL,
    activity            TEXT    NOT NULL DEFAULT '',
    duration_minutes    INTEGER NOT NULL DEFAULT 60,
    estimated_cost_krw  INTEGER NOT NULL DEFAULT 0,
    latitude            REAL,
    longitude           REAL,
    naver_map_url       TEXT
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id          TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    latitude            REAL NOT NULL,
    longitude           REAL NOT NULL,
    matched_waypoint_id TEXT,
    map_snapshot_b64     TEXT,
    timestamp           TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


# ---------------------------------------------------------------------------
# Lifecycle helpers
# ---------------------------------------------------------------------------
async def get_db() -> aiosqlite.Connection:
    """Open (and optionally create) the database. Caller must close."""
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    db = await aiosqlite.connect(DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db() -> None:
    """Create tables if they don't exist."""
    db = await get_db()
    try:
        await db.executescript(_CREATE_TABLES)
        await db.commit()
    finally:
        await db.close()


# ---------------------------------------------------------------------------
# Session CRUD
# ---------------------------------------------------------------------------
async def create_session(session_id: str, location: str = "") -> None:
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO sessions (id, location) VALUES (?, ?)",
            (session_id, location),
        )
        await db.commit()
    finally:
        await db.close()


async def get_session(session_id: str) -> dict | None:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, location, created_at FROM sessions WHERE id = ?",
            (session_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return dict(row)
    finally:
        await db.close()


# ---------------------------------------------------------------------------
# Chat History CRUD
# ---------------------------------------------------------------------------
async def save_chat_message(session_id: str, role: str, content: str) -> None:
    """Save a single chat message (user or assistant) to history."""
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),
        )
        await db.commit()
    finally:
        await db.close()


async def get_chat_history(session_id: str, limit: int = 6) -> list[dict]:
    """Retrieve the last N chat messages for a session, ordered chronologically."""
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT role, content 
               FROM chat_messages 
               WHERE session_id = ? 
               ORDER BY id DESC LIMIT ?""",
            (session_id, limit),
        )
        rows = await cursor.fetchall()
        # Reverse to get chronological order (oldest first)
        return [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]
    finally:
        await db.close()


# ---------------------------------------------------------------------------
# Itinerary CRUD
# ---------------------------------------------------------------------------
async def save_itinerary_items(
    session_id: str,
    items: list[dict],
) -> None:
    """Replace all itinerary items for a session."""
    db = await get_db()
    try:
        # Clear existing items
        await db.execute(
            "DELETE FROM itinerary_items WHERE session_id = ?", (session_id,)
        )
        for item in items:
            await db.execute(
                """INSERT INTO itinerary_items
                   (session_id, item_order, time_slot, place, activity,
                    duration_minutes, estimated_cost_krw, latitude, longitude, naver_map_url)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    session_id,
                    item["order"],
                    item["time"],
                    item["place"],
                    item.get("activity", ""),
                    item.get("duration_minutes", 60),
                    item.get("estimated_cost_krw", 0),
                    item.get("latitude"),
                    item.get("longitude"),
                    item.get("naver_map_url"),
                ),
            )
        await db.commit()
    finally:
        await db.close()


async def get_itinerary_items(session_id: str) -> list[dict]:
    """Retrieve all itinerary items for a session, ordered."""
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT item_order, time_slot, place, activity,
                      duration_minutes, estimated_cost_krw,
                      latitude, longitude, naver_map_url
               FROM itinerary_items
               WHERE session_id = ?
               ORDER BY item_order ASC""",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [
            {
                "order": row["item_order"],
                "time": row["time_slot"],
                "place": row["place"],
                "activity": row["activity"],
                "duration_minutes": row["duration_minutes"],
                "estimated_cost_krw": row["estimated_cost_krw"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "naver_map_url": row["naver_map_url"],
            }
            for row in rows
        ]
    finally:
        await db.close()


async def reorder_itinerary(session_id: str, new_order: list[int]) -> bool:
    """
    Reorder itinerary items. `new_order` is a list of current item_order
    values in the desired new sequence. Returns True if successful.
    """
    db = await get_db()
    try:
        # Fetch existing items
        cursor = await db.execute(
            "SELECT id, item_order FROM itinerary_items WHERE session_id = ? ORDER BY item_order",
            (session_id,),
        )
        rows = await cursor.fetchall()
        if len(rows) != len(new_order):
            return False

        # Map old item_order → id (primary key)
        order_to_id = {row["item_order"]: row["id"] for row in rows}

        # Update each item's order
        for new_pos, old_order in enumerate(new_order, start=1):
            item_id = order_to_id.get(old_order)
            if item_id is None:
                return False
            await db.execute(
                "UPDATE itinerary_items SET item_order = ? WHERE id = ?",
                (new_pos, item_id),
            )
        await db.commit()
        return True
    finally:
        await db.close()


async def save_activity_log(
    session_id: str,
    latitude: float,
    longitude: float,
    matched_waypoint_id: str | None = None,
    map_snapshot_b64: str | None = None,
) -> None:
    """Record a single GPS ping with optional waypoint match and map snapshot."""
    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO activity_logs
               (session_id, latitude, longitude, matched_waypoint_id, map_snapshot_b64)
               VALUES (?, ?, ?, ?, ?)""",
            (session_id, latitude, longitude, matched_waypoint_id, map_snapshot_b64),
        )
        await db.commit()
    finally:
        await db.close()


async def get_activity_logs(session_id: str, limit: int = 50) -> list[dict]:
    """Retrieve activity logs for a session, ordered chronologically."""
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT latitude, longitude, matched_waypoint_id,
                      map_snapshot_b64, timestamp
               FROM activity_logs
               WHERE session_id = ?
               ORDER BY id ASC
               LIMIT ?""",
            (session_id, limit),
        )
        rows = await cursor.fetchall()
        return [
            {
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "matched_waypoint_id": row["matched_waypoint_id"],
                "map_snapshot_b64": row["map_snapshot_b64"],
                "timestamp": row["timestamp"],
            }
            for row in rows
        ]
    finally:
        await db.close()


async def get_latest_activity_log(session_id: str) -> dict | None:
    """Retrieve the most recent activity log entry for a session."""
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT latitude, longitude, matched_waypoint_id,
                      map_snapshot_b64, timestamp
               FROM activity_logs
               WHERE session_id = ?
               ORDER BY id DESC
               LIMIT 1""",
            (session_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return {
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "matched_waypoint_id": row["matched_waypoint_id"],
            "map_snapshot_b64": row["map_snapshot_b64"],
            "timestamp": row["timestamp"],
        }
    finally:
        await db.close()


async def delete_session(session_id: str) -> bool:
    """Delete a session and its itinerary items (cascade)."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM sessions WHERE id = ?", (session_id,)
        )
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()
