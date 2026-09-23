import os
import sys
import tempfile
from pathlib import Path

# Isolated database + known auth tokens; must be set before backend modules are imported.
_tmp = tempfile.mkdtemp(prefix="rxtriage-test-")
os.environ["DB_PATH"] = str(Path(_tmp) / "test.db")
os.environ["RXTRIAGE_AUTH_TOKENS"] = "admin:t-admin,pharmacist:t-rph,technician:t-tech,intern:t-intern"
os.environ["ASSEMBLYAI_API_KEY"] = ""
os.environ["CARTESIA_API_KEY"] = ""
os.environ["TWILIO_ACCOUNT_SID"] = ""

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from backend.database import reset_db  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    reset_db()
    yield
