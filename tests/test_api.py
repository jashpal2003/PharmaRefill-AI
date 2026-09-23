import pytest
from fastapi.testclient import TestClient

from backend.main import app

ADMIN = {"Authorization": "Bearer t-admin"}
RPH = {"Authorization": "Bearer t-rph"}
TECH = {"Authorization": "Bearer t-tech"}
INTERN = {"Authorization": "Bearer t-intern"}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health_is_public(client):
    assert client.get("/health").json()["auth_enabled"] is True


def test_unauthenticated_rejected(client):
    assert client.get("/api/patients").status_code == 401
    assert client.get("/api/patients", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_rbac(client):
    assert client.post("/api/reset-demo", headers=RPH).status_code == 403
    assert client.post("/api/reset-demo", headers=ADMIN).status_code == 200
    assert client.get("/api/audit-log", headers=TECH).status_code == 403
    assert client.post("/api/billing/PAT-1001/pay", headers=INTERN, json={"amount": 1}).status_code == 403


def test_phi_masked_for_technician(client):
    p = client.get("/api/patients", headers=TECH).json()[0]
    assert p["dob"].startswith("****") and p["primary_phone"].startswith("***")
    assert not client.get("/api/patients", headers=RPH).json()[0]["dob"].startswith("*")


def test_access_log_records_and_is_immutable(client):
    client.get("/api/patient/PAT-1001", headers=RPH)
    log = client.get("/api/audit-log", headers=ADMIN, params={"patient_id": "PAT-1001"}).json()
    assert any(e["path"] == "/api/patient/PAT-1001" and e["role"] == "pharmacist" for e in log["entries"])
    from backend.database import get_db_connection
    with get_db_connection() as conn, pytest.raises(Exception):
        conn.execute("DELETE FROM access_log")


def test_websocket_requires_token(client):
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/dashboard") as ws:
            ws.receive_text()
    with client.websocket_connect("/ws/dashboard?token=t-rph") as ws:
        assert ws.receive_json()["type"] == "INITIAL_SNAPSHOT"


def test_simulated_call_records_metrics_and_analytics(client):
    sid = "API-1"
    for u in ["START", "April 12, 1958", "refill atorvastatin", "yes", "yes", "yes", "no that's all"]:
        r = client.post("/api/call/simulate-step", headers=RPH, json={"session_id": sid, "utterance": u})
        assert r.status_code == 200
    assert r.json()["end_call"] and r.json()["lemur_audit"]["patient_full_name"] == "Eleanor Vance"
    a = client.get("/api/analytics", headers=RPH).json()
    assert a["calls"]["total"] >= 1 and a["latency_ms"]["turns_measured"] >= 7
    assert a["intents"].get("REFILL")


def test_dur_pdmp_soap_fhir(client):
    dur = client.get("/api/clinical/dur/PAT-1002", headers=RPH).json()
    assert dur["alert_count"] >= 1
    pdmp = client.get("/api/clinical/pdmp/PAT-1001", headers=RPH).json()
    assert pdmp["total_mme_daily"] == 15.0
    assert client.get("/api/clinical/pdmp/PAT-1004", headers=RPH).json()["total_mme_daily"] == 0
    soap = client.post("/api/clinical/soap-note", headers=RPH, json={"patient_id": "PAT-1004"}).json()
    assert "David Kim" in soap["soap"]["subjective"] and "Atorvastatin" not in soap["soap"]["objective"]
    fhir = client.get("/api/export/fhir/PAT-1001", headers=RPH).json()
    kinds = {e["resource"]["resourceType"] for e in fhir["entry"]}
    assert {"Patient", "MedicationRequest", "AllergyIntolerance", "Condition"} <= kinds
    mr = next(e["resource"] for e in fhir["entry"] if e["resource"]["resourceType"] == "MedicationRequest")
    assert mr["intent"] == "order" and mr["subject"]["reference"] == "Patient/PAT-1001"


def test_pa_lifecycle(client):
    pa = client.post("/api/pa", headers=RPH, json={"patient_id": "PAT-1002", "rx_number": "RX-7718293", "urgency": "URGENT"}).json()
    client.post(f"/api/pa/{pa['pa_id']}/status", headers=RPH, json={"status": "SUBMITTED"})
    board = client.get("/api/pa", headers=RPH).json()
    item = next(r for r in board["columns"]["SUBMITTED"] if r["pa_id"] == pa["pa_id"])
    assert 71 <= item["hours_remaining"] <= 72
    client.post(f"/api/pa/{pa['pa_id']}/status", headers=RPH, json={"status": "DENIED", "denial_reason": "step therapy"})
    appeal = client.post(f"/api/pa/{pa['pa_id']}/appeal", headers=RPH).json()
    assert appeal["status"] == "APPEALED" and "step therapy" in appeal["appeal_letter"]


def test_immunization_flow(client):
    recs = client.get("/api/immunizations/recommend/PAT-1001", headers=RPH).json()["recommended"]
    assert any(r["code"] == "SHINGRIX" for r in recs)
    imm = client.post("/api/immunizations", headers=RPH, json={"patient_id": "PAT-1001", "vaccine": "FLU", "scheduled_for": "tomorrow"}).json()
    out = client.post(f"/api/immunizations/{imm['immunization_id']}/administer", headers=RPH, json={"lot_number": "FL2026A"}).json()
    assert out["hl7_vxu"].startswith("MSH|")
    recs2 = client.get("/api/immunizations/recommend/PAT-1001", headers=RPH).json()["recommended"]
    assert not any(r["code"] == "FLU" for r in recs2)


def test_outreach_respects_opt_out(client):
    c = client.post("/api/outreach", headers=RPH, json={"name": "Flu", "campaign_type": "FLU_SEASON", "message_template": "Hi {first_name}, flu shots are in!"}).json()
    sent = client.post(f"/api/outreach/{c['campaign_id']}/send", headers=RPH).json()
    assert sent["skipped_opt_out"] == 1 and sent["sent"] == c["target_count"] - 1


def test_generic_substitution_and_daw(client):
    cands = client.get("/api/generic-substitution/PAT-1002", headers=RPH).json()["candidates"]
    assert cands and cands[0]["rx_number"] == "RX-9922331"
    assert client.post("/api/generic-substitution", headers=RPH, json={"rx_number": "RX-9922331", "daw_code": 1}).status_code == 409
    ok = client.post("/api/generic-substitution", headers=RPH, json={"rx_number": "RX-9922331", "daw_code": 0}).json()
    assert ok["status"] == "SUBSTITUTED"


def test_dur_override_requires_rationale(client):
    assert client.post("/api/dur/override", headers=RPH, json={"patient_id": "PAT-1001", "alert_key": "x", "rationale": "ok"}).status_code == 422
    assert client.post("/api/dur/override", headers=RPH, json={"patient_id": "PAT-1001", "alert_key": "x", "rationale": "Reviewed with prescriber, benefit outweighs risk"}).status_code == 200


def test_queue_priority(client):
    client.post("/api/queue/enqueue", headers=RPH, json={"caller_phone": "+15550000001"})
    client.post("/api/queue/enqueue", headers=RPH, json={"caller_phone": "+15550000002", "reason": "allergic reaction"})
    assert client.post("/api/queue/next", headers=RPH).json()["priority"] == "URGENT"
    client.post("/api/queue/next", headers=RPH)


def test_inventory_340b_sdoh_mtm(client):
    inv = client.get("/api/inventory", headers=RPH).json()
    assert any(a["type"] == "EXPIRY" for a in inv["alerts"]) and any(a["type"] == "REORDER" for a in inv["alerts"])
    assert client.get("/api/340b", headers=RPH).json()["summary"]["eligible_patients"] == 2
    s = client.post("/api/sdoh", headers=RPH, json={"patient_id": "PAT-1003", "answers": {"transport": True, "food": False}}).json()
    assert s["risk_flags"][0]["id"] == "transport" and s["fhir_observation"]["resourceType"] == "Observation"
    assert client.get("/api/mtm", headers=RPH).json()["projected_revenue"] > 0


def test_benchmark_is_labelled(client):
    b = client.get("/api/eval/benchmark", headers=RPH).json()
    assert b["mode"] == "REFERENCE" and b["is_measured"] is False and b["disclaimer"]
