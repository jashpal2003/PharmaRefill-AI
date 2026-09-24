"""
backend/pg.py — Supabase Postgres adapter.

The data layer is written against a small portable SQL subset. This module lets the same code run on
Supabase Postgres by translating the few SQLite-isms it uses:
  ?                           -> %s
  INSERT OR REPLACE INTO t    -> INSERT ... ON CONFLICT (pk) DO UPDATE SET ...
  date('now'[, modifier])     -> (CURRENT_DATE + modifier::interval)::date
  datetime('now'[, modifier]) -> timezone('utc', now()) + modifier::interval
Rows behave like sqlite3.Row (index or key access); DATE/TIMESTAMP/NUMERIC come back as the same
strings/floats SQLite returned, so callers are dialect-agnostic.
"""

import datetime as _dt
import re
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Optional

import psycopg
from psycopg_pool import ConnectionPool

MIGRATION_FILE = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "001_rxtriage_schema.sql"

PRIMARY_KEYS: Dict[str, str] = {
    "patients": "patient_id", "prescriptions": "rx_number", "call_sessions": "session_id",
    "dispense_orders": "order_id", "consultations": "consultation_id", "billing_accounts": "patient_id",
    "pharmacy_info": "key", "patient_allergies": "patient_id, allergen",
    "patient_conditions": "patient_id, condition_code", "patient_profile_ext": "patient_id",
    "prior_authorizations": "pa_id", "immunizations": "immunization_id", "inventory": "ndc, lot_number",
    "outreach_campaigns": "campaign_id", "sdoh_screenings": "screening_id", "dur_overrides": "override_id",
}

_INSERT_OR_REPLACE = re.compile(r"INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]*)\)", re.I)
_DATE_NOW = re.compile(r"\bdate\(\s*'now'\s*(?:,\s*([^()]*?))?\s*\)", re.I)
_DATETIME_NOW = re.compile(r"\bdatetime\(\s*'now'\s*(?:,\s*([^()]*?))?\s*\)", re.I)


def translate(sql: str, has_params: bool) -> str:
    m = _INSERT_OR_REPLACE.search(sql)
    if m:
        table, cols = m.group(1), [c.strip() for c in m.group(2).split(",")]
        pk = PRIMARY_KEYS[table.lower()]
        pk_cols = {c.strip() for c in pk.split(",")}
        updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c not in pk_cols)
        sql = sql[:m.start()] + f"INSERT INTO {table} ({m.group(2)})" + sql[m.end():]
        sql = sql.rstrip().rstrip(";") + f" ON CONFLICT ({pk}) DO " + (f"UPDATE SET {updates}" if updates else "NOTHING")
    sql = _DATE_NOW.sub(lambda x: f"(CURRENT_DATE + ({x.group(1)})::interval)::date" if x.group(1) else "CURRENT_DATE", sql)
    sql = _DATETIME_NOW.sub(lambda x: f"(timezone('utc', now()) + ({x.group(1)})::interval)" if x.group(1) else "timezone('utc', now())", sql)
    if has_params:
        sql = sql.replace("%", "%%").replace("?", "%s")
    return sql


def _plain(v: Any) -> Any:
    if isinstance(v, _dt.datetime):
        if v.tzinfo is not None:
            v = v.astimezone(_dt.timezone.utc).replace(tzinfo=None)
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, _dt.date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    return v


class Row(dict):
    """dict that also supports positional access, like sqlite3.Row."""

    __slots__ = ("_vals",)

    def __init__(self, keys, vals):
        super().__init__(zip(keys, vals))
        self._vals = vals

    def __getitem__(self, k):
        if isinstance(k, int):
            return self._vals[k]
        return super().__getitem__(k)

    def __iter__(self):
        # Like sqlite3.Row: iterating (and tuple-unpacking) yields values, not column names.
        # dict(row) still works because dict() uses keys() + __getitem__ for mappings.
        return iter(self._vals)

    def __len__(self):
        return len(self._vals)


def _row_factory(cursor):
    keys = [d.name for d in cursor.description] if cursor.description else []
    return lambda values: Row(keys, [_plain(v) for v in values])


class PgCursor:
    def __init__(self, cur):
        self._cur = cur

    def execute(self, sql: str, params: Optional[tuple] = None):
        self._cur.execute(translate(sql, params is not None), params)
        return self

    def executemany(self, sql: str, seq):
        self._cur.executemany(translate(sql, True), list(seq))
        return self

    def executescript(self, script: str):
        self._cur.execute(script)
        return self

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    @property
    def rowcount(self):
        return self._cur.rowcount


class PgConnection:
    def __init__(self, conn: psycopg.Connection):
        self._conn = conn

    def cursor(self) -> PgCursor:
        return PgCursor(self._conn.cursor(row_factory=_row_factory))

    def execute(self, sql: str, params: Optional[tuple] = None) -> PgCursor:
        return self.cursor().execute(sql, params)

    def executemany(self, sql: str, seq) -> PgCursor:
        return self.cursor().executemany(sql, seq)

    def executescript(self, script: str) -> PgCursor:
        return self.cursor().executescript(script)

    def pipeline(self):
        """Batch several queries into one network round trip (execute all, then fetch)."""
        return self._conn.pipeline()

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()


_pool: Optional[ConnectionPool] = None
_pool_key = None


def get_pool(url: str, schema: str) -> ConnectionPool:
    global _pool, _pool_key
    if _pool is None or _pool_key != (url, schema):
        if _pool is not None:
            _pool.close()
        _pool = ConnectionPool(
            url, min_size=1, max_size=10, open=True, timeout=30,
            kwargs={"options": f"-c search_path={schema},public -c timezone=UTC", "prepare_threshold": None},
        )
        _pool_key = (url, schema)
    return _pool


def apply_migration(conn: PgConnection, schema: str):
    sql = MIGRATION_FILE.read_text(encoding="utf-8")
    conn.executescript(f'CREATE SCHEMA IF NOT EXISTS "{schema}"; SET search_path TO "{schema}", public;')
    conn.executescript(sql)
    conn.commit()


def drop_schema(url: str, schema: str):
    with psycopg.connect(url, autocommit=True) as c:
        c.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
