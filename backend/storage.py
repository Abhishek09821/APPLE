"""Transactional local persistence. No personal data leaves this directory."""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4

DATA_DIR = Path(os.getenv('APPLE_DATA_DIR', Path(__file__).parent / 'data'))


@contextmanager
def db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATA_DIR / 'apple.db', timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT, body TEXT, created TEXT)')
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def put(kind, body, record_id=None):
    record_id = record_id or uuid4().hex
    with db() as conn:
        conn.execute('INSERT OR REPLACE INTO records VALUES (?, ?, ?, ?)',
                     (record_id, kind, json.dumps(body), datetime.now(timezone.utc).isoformat()))
    return {**body, 'id': record_id}


def get(kind, record_id):
    with db() as conn:
        row = conn.execute('SELECT * FROM records WHERE id=? AND kind=?', (record_id, kind)).fetchone()
    return {**json.loads(row['body']), 'id': row['id'], 'created': row['created']} if row else None


def list_records(kind, limit=100):
    with db() as conn:
        rows = conn.execute('SELECT * FROM records WHERE kind=? ORDER BY created DESC LIMIT ?', (kind, limit)).fetchall()
    return [{**json.loads(r['body']), 'id': r['id'], 'created': r['created']} for r in rows]


def delete(kind, record_id):
    with db() as conn:
        conn.execute('DELETE FROM records WHERE kind=? AND id=?', (kind, record_id))


def settings():
    from models import Settings
    return Settings(**(get('settings', 'settings') or {}))
