import os
import sys
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Test database: an isolated throwaway schema in Postgres when TEST_DATABASE_URL is set
# (e.g. your Supabase project), otherwise a temp SQLite file. Never touches the live "rxtriage" schema.
_TEST_PG = os.environ.get("TEST_DATABASE_URL", "")
_SCHEMA = f"rxtriage_test_{uuid.uuid4().hex[:8]}"
if _TEST_PG:
    os.environ["DATABASE_URL"] = _TEST_PG
    os.environ["DB_SCHEMA"] = _SCHEMA
else:
    os.environ["DATABASE_URL"] = ""
    os.environ["DB_PATH"] = str(Path(tempfile.mkdtemp(prefix="rxtriage-test-")) / "test.db")

os.environ["RXTRIAGE_AUTH_TOKENS"] = "admin:t-admin,pharmacist:t-rph,technician:t-tech,intern:t-intern"
for k in ("ASSEMBLYAI_API_KEY", "CARTESIA_API_KEY", "TWILIO_ACCOUNT_SID"):
    os.environ[k] = ""

import pytest  # noqa: E402

from backend.database import reset_db  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    reset_db()
    yield


def pytest_sessionfinish(session, exitstatus):
    if _TEST_PG:
        from backend.pg import drop_schema
        drop_schema(_TEST_PG, _SCHEMA)
