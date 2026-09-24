"""
Live Supabase Auth tests: real users, real password sign-in, real JWTs verified via JWKS.
Opt-in (touches your Supabase project):  SUPABASE_LIVE_TESTS=1 python -m pytest tests/test_supabase_live.py
Temporary users are deleted afterwards.
"""

import os
import secrets
import uuid

import pytest
import requests
from fastapi.testclient import TestClient

from backend.config import SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_URL

pytestmark = pytest.mark.skipif(os.environ.get("SUPABASE_LIVE_TESTS") != "1" or not SUPABASE_URL,
                                reason="set SUPABASE_LIVE_TESTS=1 to run against the live Supabase project")


def _sign_in(email: str, password: str) -> str:
    r = requests.post(f"{SUPABASE_URL}/auth/v1/token", params={"grant_type": "password"},
                      headers={"apikey": SUPABASE_PUBLISHABLE_KEY}, json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def staff():
    from backend.staff_admin import delete_staff, upsert_staff
    created, tokens = [], {}
    tag = uuid.uuid4().hex[:6]
    for role in ("pharmacist", "technician", None):
        email = f"rxtriage-test-{role or 'norole'}-{tag}@example.com"
        pw = secrets.token_urlsafe(16)
        u = upsert_staff(email, role or "intern", pw)
        if role is None:  # strip the role to simulate an un-provisioned account
            r = requests.put(f"{SUPABASE_URL}/auth/v1/admin/users/{u['id']}",
                             headers={"apikey": SUPABASE_SECRET_KEY, "Authorization": f"Bearer {SUPABASE_SECRET_KEY}"},
                             json={"app_metadata": {"rxtriage_role": None}}, timeout=15)
            assert r.status_code == 200
        created.append(u["id"])
        tokens[role or "norole"] = (email, _sign_in(email, pw))
    yield tokens
    for uid in created:
        delete_staff(uid)


@pytest.fixture
def client():
    from backend.main import app
    with TestClient(app) as c:
        yield c


def test_pharmacist_jwt_is_accepted(client, staff):
    email, tok = staff["pharmacist"]
    me = client.get("/api/me", headers={"Authorization": f"Bearer {tok}"}).json()
    assert me["role"] == "pharmacist" and me["email"] == email
    assert not client.get("/api/patients", headers={"Authorization": f"Bearer {tok}"}).json()[0]["dob"].startswith("*")


def test_technician_jwt_gets_masked_phi_and_is_denied_admin(client, staff):
    _, tok = staff["technician"]
    h = {"Authorization": f"Bearer {tok}"}
    assert client.get("/api/patients", headers=h).json()[0]["dob"].startswith("****")
    assert client.get("/api/audit-log", headers=h).status_code == 403


def test_unprovisioned_account_rejected(client, staff):
    _, tok = staff["norole"]
    assert client.get("/api/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


def test_tampered_jwt_rejected(client, staff):
    _, tok = staff["pharmacist"]
    head, body, sig = tok.split(".")
    bad = f"{head}.{body}.{sig[:-4]}AAAA"
    assert client.get("/api/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_access_log_records_user_identity(client, staff):
    email, tok = staff["pharmacist"]
    client.get("/api/patient/PAT-1002", headers={"Authorization": f"Bearer {tok}"})
    log = client.get("/api/audit-log", headers={"Authorization": "Bearer t-admin"}, params={"patient_id": "PAT-1002"}).json()
    assert any(e["user_email"] == email for e in log["entries"])


def test_websocket_accepts_jwt(client, staff):
    _, tok = staff["pharmacist"]
    with client.websocket_connect(f"/ws/dashboard?token={tok}") as ws:
        assert ws.receive_json()["type"] == "INITIAL_SNAPSHOT"
