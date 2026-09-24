"""
backend/ops_routes.py — Clinical and operations APIs:
DUR, real-time benefit check, generic substitution, adherence (PDC) risk, prior authorization board,
immunizations (+ HL7 VXU), inventory / expiry, 340B, proactive outreach, SDOH, MTM revenue,
analytics, HIPAA audit log and the smart call queue.
"""

import contextlib
import heapq
import itertools
import json
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from backend import clinical_kb as kb
from backend.database import (
    get_all_patients,
    get_db_connection,
    get_patient,
    get_patient_clinical_profile,
    get_pharmacy_info,
    get_prescriptions_for_patient,
)
from backend.security import mask_patient, masks_phi
from backend.sms_service import _send_sms

router = APIRouter(prefix="/api")


def _role(request: Request) -> str:
    return request.scope.get("state", {}).get("role", "admin")


def _require_patient(pid: str) -> Dict[str, Any]:
    p = get_patient(pid)
    if not p:
        raise HTTPException(404, "Patient not found")
    return p


def fetch_many(queries: List[str]) -> List[List[Any]]:
    """Runs independent read queries in one network round trip on Postgres (pipeline), sequentially on SQLite."""
    with get_db_connection() as conn:
        pipe = conn.pipeline() if hasattr(conn, "pipeline") else contextlib.nullcontext()
        with pipe:
            curs = [conn.execute(q) for q in queries]
        return [c.fetchall() for c in curs]


class Snapshot:
    """All clinical data for a set of patients, loaded in 7 queries on one connection.
    Keeps per-patient loops from issuing N round trips to a remote (Supabase) database."""

    def __init__(self, pids: Optional[List[str]] = None):
        where, args = ("", ()) if pids is None else (f" WHERE patient_id IN ({', '.join('?' * len(pids))})", tuple(pids))
        sqls = ["SELECT * FROM patients" + where + " ORDER BY last_name",
                "SELECT * FROM prescriptions" + where + " ORDER BY next_refill_due_date",
                "SELECT * FROM fill_history" + where,
                "SELECT patient_id, allergen, reaction FROM patient_allergies" + where,
                "SELECT patient_id, condition_code, condition_name FROM patient_conditions" + where,
                "SELECT * FROM patient_profile_ext" + where,
                "SELECT * FROM dur_overrides" + where]
        with get_db_connection() as conn:
            pipe = conn.pipeline() if hasattr(conn, "pipeline") else contextlib.nullcontext()
            with pipe:
                curs = [conn.execute(sql, args) if args else conn.execute(sql) for sql in sqls]
            pts, self._rx, self._fills, self._allergies, self._conditions, ext, self._overrides = (
                [dict(r) for r in c.fetchall()] for c in curs)
        self.patients = {p["patient_id"]: p for p in pts}
        self._ext = {r["patient_id"]: r for r in ext}

    def _by(self, rows, pid):
        return [r for r in rows if r["patient_id"] == pid]

    def patient(self, pid: str) -> Dict[str, Any]:
        if pid not in self.patients:
            raise HTTPException(404, "Patient not found")
        return self.patients[pid]

    def prescriptions(self, pid):
        return self._by(self._rx, pid)

    def fills_by_rx(self, pid):
        out: Dict[str, List[Dict[str, Any]]] = {}
        for r in self._by(self._fills, pid):
            out.setdefault(r["rx_number"], []).append(r)
        return out

    def profile(self, pid):
        strip = lambda rows: [{k: v for k, v in r.items() if k != "patient_id"} for r in rows]
        return {"allergies": strip(self._by(self._allergies, pid)), "conditions": strip(self._by(self._conditions, pid)),
                "ext": self._ext.get(pid) or {"preferred_language": "en", "is_pregnant": 0, "is_340b_eligible": 0, "sms_opt_out": 0}}

    def overrides(self, pid):
        return {r["alert_key"]: r for r in self._by(self._overrides, pid)}


def patient_dur(pid: str, snap: Optional[Snapshot] = None) -> Dict[str, Any]:
    snap = snap or Snapshot([pid])
    p, prof, rx = snap.patient(pid), snap.profile(pid), snap.prescriptions(pid)
    res = kb.run_dur(p, rx, prof["allergies"], prof["conditions"], bool(prof["ext"].get("is_pregnant")))
    overrides = snap.overrides(pid)
    for a in res["alerts"]:
        a["override"] = overrides.get(a["alert_key"])
    res.update({"patient_id": pid, "patient_name": f"{p['first_name']} {p['last_name']}",
                "allergies": prof["allergies"], "conditions": prof["conditions"],
                "checked_at": datetime.now(timezone.utc).isoformat()})
    return res


# ---------------------------------------------------------------------------
# DUR
# ---------------------------------------------------------------------------
@router.get("/clinical/dur/{pid}")
def dur_endpoint(pid: str):
    return patient_dur(pid)


class DurOverrideReq(BaseModel):
    patient_id: str
    alert_key: str
    rationale: str = Field(min_length=15, description="Mandatory clinical rationale")


@router.post("/dur/override")
def dur_override(req: DurOverrideReq, request: Request):
    oid = f"OVR-{uuid.uuid4().hex[:8].upper()}"
    with get_db_connection() as conn:
        conn.execute("INSERT INTO dur_overrides (override_id, patient_id, alert_key, rationale, overridden_by) VALUES (?, ?, ?, ?, ?)",
                     (oid, req.patient_id, req.alert_key, req.rationale, _role(request)))
        conn.commit()
    return {"override_id": oid, "status": "RECORDED"}


@router.get("/dur/retrospective")
def dur_retrospective():
    rows = []
    snap = Snapshot()
    for p in snap.patients.values():
        d = patient_dur(p["patient_id"], snap)
        rows.append({"patient_id": p["patient_id"], "patient_name": d["patient_name"], "overall_risk": d["overall_risk"],
                     "alerts": d["alert_count"],
                     "by_category": {c: sum(1 for a in d["alerts"] if a["category"] == c) for c in {a["category"] for a in d["alerts"]}}})
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "patients": rows,
            "total_alerts": sum(r["alerts"] for r in rows)}


# ---------------------------------------------------------------------------
# Real-time benefit check + generic substitution
# ---------------------------------------------------------------------------
@router.get("/rtbc/{pid}")
def rtbc(pid: str):
    p = _require_patient(pid)
    return {"patient_id": pid, "payer": p["insurance_carrier"],
            "results": [kb.benefit_check(p, rx) for rx in get_prescriptions_for_patient(pid)]}


@router.get("/generic-substitution/{pid}")
def generic_candidates(pid: str):
    p = _require_patient(pid)
    out = []
    for rx in get_prescriptions_for_patient(pid):
        bc = kb.benefit_check(p, rx)
        gen = next((a for a in bc["alternatives"] if a["type"] == "GENERIC"), None)
        if gen:
            out.append({"rx_number": rx["rx_number"], "brand": bc["drug_name"], "generic": gen["drug_name"],
                        "brand_copay": bc["estimated_copay"], "generic_copay": gen["estimated_copay"], "savings": gen["savings"]})
    return {"patient_id": pid, "candidates": out}


class GenericSubReq(BaseModel):
    rx_number: str
    daw_code: int = Field(default=0, ge=0, le=9)


@router.post("/generic-substitution")
def apply_generic(req: GenericSubReq, request: Request):
    if req.daw_code in (1, 7):
        raise HTTPException(409, "DAW 1/7: prescriber requires brand. Substitution not permitted.")
    with get_db_connection() as conn:
        rx = conn.execute("SELECT * FROM prescriptions WHERE rx_number = ?", (req.rx_number,)).fetchone()
        if not rx:
            raise HTTPException(404, "Prescription not found")
        rx = dict(rx)
        p = get_patient(rx["patient_id"])
        bc = kb.benefit_check(p, rx)
        gen = next((a for a in bc["alternatives"] if a["type"] == "GENERIC"), None)
        if not gen:
            raise HTTPException(400, "No AB-rated generic mapped for this product")
        conn.execute("UPDATE prescriptions SET drug_name = ?, copay_amount = ? WHERE rx_number = ?",
                     (gen["drug_name"], gen["estimated_copay"], req.rx_number))
        conn.commit()
    _send_sms(p["primary_phone"], f"Community Care Pharmacy: your {bc['drug_name']} was switched to the generic "
              f"{gen['drug_name']} (est. savings ${gen['savings']:.2f}). Reply STOP to opt out.", "GENERIC_SUBSTITUTION")
    return {"status": "SUBSTITUTED", "rx_number": req.rx_number, "new_drug": gen["drug_name"],
            "new_copay": gen["estimated_copay"], "savings": gen["savings"], "daw_code": req.daw_code,
            "prescriber_notification": "Queued (fax/e-Rx RxChange)", "performed_by": _role(request)}


# ---------------------------------------------------------------------------
# Adherence risk (PDC)
# ---------------------------------------------------------------------------
def patient_adherence(pid: str, snap: Optional[Snapshot] = None) -> Dict[str, Any]:
    snap = snap or Snapshot([pid])
    p = snap.patient(pid)
    res = kb.adherence_risk(snap.prescriptions(pid), snap.fills_by_rx(pid))
    res.update({"patient_id": pid, "patient_name": f"{p['first_name']} {p['last_name']}", "phone": p["primary_phone"]})
    return res


@router.get("/adherence")
def adherence_all():
    snap = Snapshot()
    rows = sorted((patient_adherence(pid, snap) for pid in snap.patients), key=lambda r: -r["risk_score"])
    return {"patients": rows, "high_risk_outreach_needed": sum(1 for r in rows if r["risk_band"] == "HIGH")}


@router.get("/adherence/{pid}")
def adherence_one(pid: str):
    return patient_adherence(pid)


# ---------------------------------------------------------------------------
# Prior authorization board
# ---------------------------------------------------------------------------
PA_STATUSES = ["PENDING", "SUBMITTED", "APPROVED", "DENIED", "APPEALED", "DISPENSED"]


def _pa_rows() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        rows = [dict(r) for r in conn.execute("""
            SELECT pa.*, p.first_name, p.last_name FROM prior_authorizations pa
            JOIN patients p ON p.patient_id = pa.patient_id ORDER BY pa.created_at DESC
        """).fetchall()]
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for r in rows:
        if r["decision_due_at"] and r["status"] in ("SUBMITTED", "APPEALED"):
            due = datetime.fromisoformat(r["decision_due_at"])
            r["hours_remaining"] = round((due - now).total_seconds() / 3600, 1)
            r["overdue"] = r["hours_remaining"] < 0
        else:
            r["hours_remaining"], r["overdue"] = None, False
    return rows


@router.get("/pa")
def pa_board():
    rows = _pa_rows()
    return {"columns": {s: [r for r in rows if r["status"] == s] for s in PA_STATUSES}, "total": len(rows)}


class CreatePaReq(BaseModel):
    patient_id: str
    rx_number: str
    urgency: str = Field(default="STANDARD", pattern="^(STANDARD|URGENT)$")


@router.post("/pa")
def pa_create(req: CreatePaReq):
    p = _require_patient(req.patient_id)
    rx = next((r for r in get_prescriptions_for_patient(req.patient_id) if r["rx_number"] == req.rx_number), None)
    if not rx:
        raise HTTPException(404, "Prescription not found for patient")
    prof = get_patient_clinical_profile(req.patient_id)
    dx = "; ".join(f"{c['condition_name']} ({c['condition_code']})" for c in prof["conditions"])
    justification = (f"{p['first_name']} {p['last_name']} (DOB {p['dob']}) requires {rx['drug_name']} {rx['strength']}. "
                     f"Active diagnoses: {dx or 'none recorded'}. Current therapy: "
                     f"{', '.join(r['drug_name'] for r in get_prescriptions_for_patient(req.patient_id))}.")
    pa_id = f"PA-{uuid.uuid4().hex[:6].upper()}"
    with get_db_connection() as conn:
        conn.execute("""INSERT INTO prior_authorizations (pa_id, patient_id, rx_number, drug_name, payer, urgency, status, clinical_justification)
                        VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)""",
                     (pa_id, req.patient_id, req.rx_number, f"{rx['drug_name']} {rx['strength']}", p["insurance_carrier"], req.urgency, justification))
        conn.commit()
    return {"pa_id": pa_id, "status": "PENDING", "clinical_justification": justification}


class PaStatusReq(BaseModel):
    status: str
    denial_reason: Optional[str] = None


@router.post("/pa/{pa_id}/status")
def pa_status(pa_id: str, req: PaStatusReq):
    if req.status not in PA_STATUSES:
        raise HTTPException(400, f"status must be one of {PA_STATUSES}")
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM prior_authorizations WHERE pa_id = ?", (pa_id,)).fetchone()
        if not row:
            raise HTTPException(404, "PA not found")
        sets, args = ["status = ?", "updated_at = CURRENT_TIMESTAMP"], [req.status]
        if req.status in ("SUBMITTED", "APPEALED"):
            # CMS-0057-F: 72h for expedited, 7 calendar days for standard
            hours = 72 if row["urgency"] == "URGENT" else 168
            sets += ["submitted_at = datetime('now')", f"decision_due_at = datetime('now', '+{hours} hours')"]
        if req.status == "DENIED":
            sets.append("denial_reason = ?"); args.append(req.denial_reason or "Not specified by payer")
        conn.execute(f"UPDATE prior_authorizations SET {', '.join(sets)} WHERE pa_id = ?", (*args, pa_id))
        if req.status == "APPROVED" and row["rx_number"]:
            conn.execute("UPDATE prescriptions SET adjudication_status = 'APPROVED' WHERE rx_number = ?", (row["rx_number"],))
        conn.commit()
    return {"pa_id": pa_id, "status": req.status}


@router.post("/pa/{pa_id}/appeal")
def pa_appeal(pa_id: str):
    from backend.assemblyai_service import _llm_chat
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM prior_authorizations WHERE pa_id = ?", (pa_id,)).fetchone()
    if not row:
        raise HTTPException(404, "PA not found")
    row = dict(row)
    letter = _llm_chat("You write concise, professional prior-authorization appeal letters for pharmacists.",
                       f"Write an appeal letter to {row['payer']} for {row['drug_name']}. Denial reason: {row['denial_reason']}. "
                       f"Clinical justification: {row['clinical_justification']}. Under 250 words. No placeholders except [Prescriber Signature].",
                       max_tokens=600)
    if not letter:
        letter = (f"To: {row['payer']} Pharmacy Benefit Appeals\nRe: Appeal of prior authorization denial ({pa_id}) — {row['drug_name']}\n\n"
                  f"We request reconsideration of the denial dated {row['updated_at']} (reason: {row['denial_reason']}).\n\n"
                  f"Clinical summary: {row['clinical_justification']}\n\n"
                  "The requested therapy is medically necessary; formulary alternatives are inappropriate or have been tried. "
                  "Please expedite review per CMS-0057-F timelines.\n\nSincerely,\n[Prescriber Signature]\nCommunity Care Pharmacy, on behalf of the prescriber")
    with get_db_connection() as conn:
        conn.execute("UPDATE prior_authorizations SET appeal_letter = ?, status = 'APPEALED', submitted_at = datetime('now'), "
                     "decision_due_at = datetime('now', ?), updated_at = CURRENT_TIMESTAMP WHERE pa_id = ?",
                     (letter, "+72 hours" if row["urgency"] == "URGENT" else "+168 hours", pa_id))
        conn.commit()
    return {"pa_id": pa_id, "status": "APPEALED", "appeal_letter": letter}


# ---------------------------------------------------------------------------
# Immunizations
# ---------------------------------------------------------------------------
@router.get("/immunizations")
def immunizations(patient_id: Optional[str] = None):
    with get_db_connection() as conn:
        q = "SELECT i.*, p.first_name, p.last_name FROM immunizations i JOIN patients p ON p.patient_id = i.patient_id"
        rows = conn.execute(q + (" WHERE i.patient_id = ?" if patient_id else "") + " ORDER BY i.created_at DESC",
                            (patient_id,) if patient_id else ()).fetchall()
    return {"immunizations": [dict(r) for r in rows], "screening_questions": kb.SCREENING_QUESTIONS}


@router.get("/immunizations/recommend/{pid}")
def immunization_recs(pid: str):
    p = _require_patient(pid)
    prof = get_patient_clinical_profile(pid)
    hist = immunizations(pid)["immunizations"]
    return {"patient_id": pid, "age": kb.age_from_dob(p["dob"]), "recommended": kb.recommended_vaccines(p, prof["conditions"], hist)}


class ScheduleVaxReq(BaseModel):
    patient_id: str
    vaccine: str
    scheduled_for: str
    screening: Dict[str, bool] = {}


@router.post("/immunizations")
def schedule_vax(req: ScheduleVaxReq):
    _require_patient(req.patient_id)
    if req.vaccine not in {v["code"] for v in kb.VACCINES}:
        raise HTTPException(400, "Unknown vaccine code")
    flagged = [q for q, yes in req.screening.items() if yes]
    iid = f"IMM-{uuid.uuid4().hex[:6].upper()}"
    status = "NEEDS_PHARMACIST_REVIEW" if flagged else "SCHEDULED"
    with get_db_connection() as conn:
        conn.execute("INSERT INTO immunizations (immunization_id, patient_id, vaccine, status, scheduled_for, screening_json) VALUES (?, ?, ?, ?, ?, ?)",
                     (iid, req.patient_id, req.vaccine, status, req.scheduled_for, json.dumps(req.screening)))
        conn.commit()
    return {"immunization_id": iid, "status": status, "screening_flags": flagged}


class AdministerReq(BaseModel):
    lot_number: str = Field(min_length=3)


@router.post("/immunizations/{iid}/administer")
def administer(iid: str, req: AdministerReq):
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM immunizations WHERE immunization_id = ?", (iid,)).fetchone()
        if not row:
            raise HTTPException(404, "Immunization not found")
        p = get_patient(row["patient_id"])
        now = datetime.now()
        msg = kb.build_hl7_vxu(p, row["vaccine"], req.lot_number, now)
        conn.execute("UPDATE immunizations SET status = 'ADMINISTERED', administered_at = ?, lot_number = ?, iis_message = ? WHERE immunization_id = ?",
                     (now.isoformat(timespec="seconds"), req.lot_number, msg, iid))
        conn.commit()
    return {"immunization_id": iid, "status": "ADMINISTERED", "hl7_vxu": msg,
            "iis_submission": "Message generated. Configure the state IIS endpoint to transmit."}


# ---------------------------------------------------------------------------
# Inventory + 340B
# ---------------------------------------------------------------------------
@router.get("/inventory")
def inventory():
    today = date.today()
    with get_db_connection() as conn:
        items = [dict(r) for r in conn.execute("SELECT * FROM inventory ORDER BY drug_name").fetchall()]
        velocity = {r[0]: r[1] for r in conn.execute("""
            SELECT p.drug_name, SUM(f.days_supply) FROM fill_history f JOIN prescriptions p ON p.rx_number = f.rx_number
            WHERE f.fill_date >= date('now', '-90 days') GROUP BY p.drug_name
        """).fetchall()}
    by_drug: Dict[str, int] = {}
    for it in items:
        by_drug[it["drug_name"]] = by_drug.get(it["drug_name"], 0) + it["on_hand"]
    alerts = []
    for it in items:
        days = (datetime.strptime(it["expiration_date"], "%Y-%m-%d").date() - today).days
        it["days_to_expiry"] = days
        it["expiry_band"] = "EXPIRED" if days < 0 else "30" if days <= 30 else "60" if days <= 60 else "90" if days <= 90 else "OK"
        daily = (velocity.get(it["drug_name"], 0) / 90.0)
        it["daily_usage_units"] = round(daily, 2)
        it["days_on_hand"] = round(by_drug[it["drug_name"]] / daily, 1) if daily else None
        if it["expiry_band"] in ("EXPIRED", "30", "60"):
            alerts.append({"type": "EXPIRY", "ndc": it["ndc"], "lot": it["lot_number"], "drug": it["drug_name"], "detail": f"{days} days to expiry"})
    for drug, total in by_drug.items():
        rp = max(i["reorder_point"] for i in items if i["drug_name"] == drug)
        if total <= rp:
            daily = velocity.get(drug, 0) / 90.0
            alerts.append({"type": "REORDER", "drug": drug, "detail": f"On hand {total} <= reorder point {rp}",
                           "suggested_order_qty": max(rp * 2 - total, int(daily * 30))})
    return {"items": items, "alerts": alerts,
            "note": "DSCSA T3 exchange and wholesaler EDI (850/855) require trading-partner integration."}


@router.get("/340b")
def program_340b():
    with get_db_connection() as conn:
        pts = [dict(r) for r in conn.execute("""
            SELECT p.patient_id, p.first_name, p.last_name, p.insurance_carrier, e.is_340b_eligible, e.covered_entity
            FROM patients p LEFT JOIN patient_profile_ext e ON e.patient_id = p.patient_id
        """).fetchall()]
        orders = [dict(r) for r in conn.execute("""
            SELECT o.order_id, o.patient_id, o.rx_number, o.status, pr.drug_name FROM dispense_orders o
            JOIN prescriptions pr ON pr.rx_number = o.rx_number
        """).fetchall()]
        stock_340b = {r[0] for r in conn.execute("SELECT drug_name FROM inventory WHERE is_340b_stock = 1 AND on_hand > 0").fetchall()}
    elig = {p["patient_id"]: p for p in pts}
    routed = []
    for o in orders:
        p = elig.get(o["patient_id"], {})
        medicaid = "medicaid" in (p.get("insurance_carrier") or "").lower()
        is340 = bool(p.get("is_340b_eligible")) and o["drug_name"] in stock_340b and not medicaid
        routed.append({**o, "route": "340B" if is340 else "COMMERCIAL",
                       "duplicate_discount_risk": medicaid and bool(p.get("is_340b_eligible"))})
    return {"patients": pts, "claim_routing": routed, "340b_stock": sorted(stock_340b),
            "summary": {"eligible_patients": sum(1 for p in pts if p["is_340b_eligible"]),
                        "orders_340b": sum(1 for r in routed if r["route"] == "340B"),
                        "orders_commercial": sum(1 for r in routed if r["route"] == "COMMERCIAL")}}


# ---------------------------------------------------------------------------
# Proactive outreach
# ---------------------------------------------------------------------------
CAMPAIGN_TYPES = {
    "REFILL_REMINDER": "Refills due in the next 7 days",
    "ADHERENCE": "High adherence-risk patients",
    "FLU_SEASON": "All patients without a flu shot this season",
    "CMR_INVITE": "Patients eligible for a free medication review",
}


def _campaign_targets(ctype: str) -> List[Dict[str, Any]]:
    pts = get_all_patients()
    if ctype == "REFILL_REMINDER":
        with get_db_connection() as conn:
            ids = {r[0] for r in conn.execute("SELECT DISTINCT patient_id FROM prescriptions WHERE dea_schedule = 0 AND next_refill_due_date BETWEEN date('now') AND date('now', '+7 days')").fetchall()}
        return [p for p in pts if p["patient_id"] in ids]
    if ctype == "ADHERENCE":
        snap = Snapshot()
        return [p for p in pts if patient_adherence(p["patient_id"], snap)["risk_band"] != "LOW"]
    if ctype == "FLU_SEASON":
        with get_db_connection() as conn:
            done = {r[0] for r in conn.execute("SELECT patient_id FROM immunizations WHERE vaccine = 'FLU' AND status = 'ADMINISTERED' AND administered_at >= date('now', '-200 days')").fetchall()}
        return [p for p in pts if p["patient_id"] not in done]
    if ctype == "CMR_INVITE":
        snap = Snapshot()
        return [p for p in pts if kb.cmr_eligibility(p, snap.prescriptions(p["patient_id"]),
                                                      snap.profile(p["patient_id"])["conditions"])["eligible"]]
    raise HTTPException(400, f"campaign_type must be one of {list(CAMPAIGN_TYPES)}")


@router.get("/outreach")
def outreach_list():
    with get_db_connection() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM outreach_campaigns ORDER BY created_at DESC").fetchall()]
    return {"campaigns": rows, "types": CAMPAIGN_TYPES}


class CampaignReq(BaseModel):
    name: str
    campaign_type: str
    message_template: str = Field(description="Supports {first_name}")


@router.post("/outreach")
def outreach_create(req: CampaignReq):
    targets = _campaign_targets(req.campaign_type)
    cid = f"CMP-{uuid.uuid4().hex[:6].upper()}"
    with get_db_connection() as conn:
        conn.execute("INSERT INTO outreach_campaigns (campaign_id, name, campaign_type, message_template, target_count) VALUES (?, ?, ?, ?, ?)",
                     (cid, req.name, req.campaign_type, req.message_template, len(targets)))
        conn.commit()
    return {"campaign_id": cid, "target_count": len(targets), "targets": [f"{t['first_name']} {t['last_name']}" for t in targets]}


@router.post("/outreach/{cid}/send")
def outreach_send(cid: str):
    with get_db_connection() as conn:
        c = conn.execute("SELECT * FROM outreach_campaigns WHERE campaign_id = ?", (cid,)).fetchone()
        if not c:
            raise HTTPException(404, "Campaign not found")
        opted = {r[0] for r in conn.execute("SELECT patient_id FROM patient_profile_ext WHERE sms_opt_out = 1").fetchall()}
    sent = skipped = 0
    for p in _campaign_targets(c["campaign_type"]):
        if p["patient_id"] in opted:  # TCPA: honor opt-out
            skipped += 1
            continue
        body = c["message_template"].replace("{first_name}", p["first_name"]) + " Reply STOP to opt out."
        _send_sms(p["primary_phone"], body, f"CAMPAIGN_{c['campaign_type']}")
        sent += 1
    with get_db_connection() as conn:
        conn.execute("UPDATE outreach_campaigns SET status = 'SENT', sent_count = ?, skipped_opt_out = ?, sent_at = CURRENT_TIMESTAMP WHERE campaign_id = ?",
                     (sent, skipped, cid))
        conn.commit()
    return {"campaign_id": cid, "sent": sent, "skipped_opt_out": skipped}


class OptOutReq(BaseModel):
    patient_id: str
    opt_out: bool = True


@router.post("/outreach/opt-out")
def outreach_opt_out(req: OptOutReq):
    with get_db_connection() as conn:
        conn.execute("UPDATE patient_profile_ext SET sms_opt_out = ? WHERE patient_id = ?", (1 if req.opt_out else 0, req.patient_id))
        conn.commit()
    return {"patient_id": req.patient_id, "sms_opt_out": req.opt_out}


# ---------------------------------------------------------------------------
# SDOH
# ---------------------------------------------------------------------------
@router.get("/sdoh/questions")
def sdoh_questions():
    return {"instrument": "AHC Health-Related Social Needs (core + medication cost)", "questions": kb.SDOH_QUESTIONS}


class SdohReq(BaseModel):
    patient_id: str
    answers: Dict[str, bool]


@router.post("/sdoh")
def sdoh_submit(req: SdohReq):
    _require_patient(req.patient_id)
    flags = kb.score_sdoh(req.answers)
    sid = f"SDOH-{uuid.uuid4().hex[:6].upper()}"
    with get_db_connection() as conn:
        conn.execute("INSERT INTO sdoh_screenings (screening_id, patient_id, answers_json, risk_flags) VALUES (?, ?, ?, ?)",
                     (sid, req.patient_id, json.dumps(req.answers), json.dumps(flags)))
        conn.commit()
    fhir = {"resourceType": "Observation", "status": "final",
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "social-history"}]}],
            "code": {"coding": [{"system": "http://loinc.org", "code": "96777-8", "display": "AHC HRSN screening tool"}]},
            "subject": {"reference": f"Patient/{req.patient_id}"},
            "component": [{"code": {"text": f["domain"]}, "valueBoolean": True} for f in flags]}
    return {"screening_id": sid, "risk_flags": flags, "fhir_observation": fhir}


@router.get("/sdoh/{pid}")
def sdoh_history(pid: str):
    with get_db_connection() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM sdoh_screenings WHERE patient_id = ? ORDER BY created_at DESC", (pid,)).fetchall()]
    for r in rows:
        r["risk_flags"] = json.loads(r["risk_flags"])
        r["answers"] = json.loads(r.pop("answers_json"))
    return {"patient_id": pid, "screenings": rows}


# ---------------------------------------------------------------------------
# MTM / CMR revenue
# ---------------------------------------------------------------------------
@router.get("/mtm")
def mtm_dashboard():
    rows = []
    snap = Snapshot()
    for p in snap.patients.values():
        e = kb.cmr_eligibility(p, snap.prescriptions(p["patient_id"]), snap.profile(p["patient_id"])["conditions"])
        rows.append({"patient_id": p["patient_id"], "patient_name": f"{p['first_name']} {p['last_name']}", **e})
    with get_db_connection() as conn:
        completed = conn.execute("SELECT COUNT(*) FROM consultations WHERE status = 'COMPLETED'").fetchone()[0]
        scheduled = conn.execute("SELECT COUNT(*) FROM consultations WHERE status = 'SCHEDULED'").fetchone()[0]
    per_cmr = kb.MTM_CPT_RATES["99605"] + kb.MTM_CPT_RATES["99607"]
    return {"patients": rows, "cpt_rates": kb.MTM_CPT_RATES,
            "projected_revenue": round(sum(r["projected_revenue"] for r in rows), 2),
            "captured_revenue": round(completed * per_cmr, 2), "completed_sessions": completed, "scheduled_sessions": scheduled}


class CompleteConsultReq(BaseModel):
    notes: str = ""
    minutes: int = Field(default=15, ge=1, le=180)


@router.post("/consultations/{cid}/complete")
def complete_consult(cid: str, req: CompleteConsultReq):
    extra_units = max(0, (req.minutes - 15 + 14) // 15)
    with get_db_connection() as conn:
        n = conn.execute("UPDATE consultations SET status = 'COMPLETED', notes = COALESCE(notes, '') || ? WHERE consultation_id = ?",
                         (f"\n[{req.minutes} min] {req.notes}", cid)).rowcount
        conn.commit()
    if not n:
        raise HTTPException(404, "Consultation not found")
    return {"consultation_id": cid, "status": "COMPLETED", "billing": ["99605"] + ["99607"] * extra_units}


# ---------------------------------------------------------------------------
# Analytics (all values computed from recorded data)
# ---------------------------------------------------------------------------
STAR_MEASURES = {"Statins": {"statin"}, "RAS antagonists": {"ace_inhibitor", "arb"}, "Diabetes (non-insulin)": {"biguanide", "sulfonylurea"}}


@router.get("/analytics")
def analytics():
    (total_r, completed_r, esc_r, spans, lat_r, p95_r, intent_r, lang_r, fills_r, revenue_r, dispensed_r, queued_r) = fetch_many([
        "SELECT COUNT(*) FROM call_sessions",
        "SELECT COUNT(*) FROM call_sessions WHERE call_status = 'COMPLETED' AND escalation_reason IS NULL",
        "SELECT escalation_reason, COUNT(*) FROM call_sessions WHERE escalation_reason IS NOT NULL GROUP BY escalation_reason",
        "SELECT started_at, ended_at FROM call_sessions",
        "SELECT AVG(stt_ms), AVG(engine_ms), AVG(tts_ms), COUNT(*) FROM call_metrics",
        "SELECT COALESCE(stt_ms,0)+COALESCE(engine_ms,0)+COALESCE(tts_ms,0) t FROM call_metrics ORDER BY t",
        "SELECT intent, COUNT(*) FROM call_metrics WHERE intent IS NOT NULL GROUP BY intent",
        "SELECT language, COUNT(DISTINCT session_id) FROM call_metrics GROUP BY language",
        "SELECT date(created_at), COUNT(*) FROM dispense_orders WHERE status IN ('QUEUED_FOR_FILL','DISPENSED') GROUP BY 1 ORDER BY 1 DESC LIMIT 14",
        "SELECT COALESCE(SUM(copay_charged), 0) FROM dispense_orders WHERE status IN ('QUEUED_FOR_FILL','DISPENSED')",
        "SELECT COUNT(*) FROM dispense_orders WHERE status = 'DISPENSED'",
        "SELECT COUNT(*) FROM dispense_orders WHERE status = 'QUEUED_FOR_FILL'",
    ])
    total, completed = total_r[0][0], completed_r[0][0]
    escalations = {r[0]: r[1] for r in esc_r}
    lat = lat_r[0]
    p95_rows = [r[0] for r in p95_r]
    intents = {r[0]: r[1] for r in intent_r}
    languages = {r[0]: r[1] for r in lang_r}
    hourly: Dict[str, int] = {}
    for sp in spans:
        if sp[0]:
            hourly[str(sp[0])[11:13]] = hourly.get(str(sp[0])[11:13], 0) + 1
    durations = [(datetime.fromisoformat(str(e)) - datetime.fromisoformat(str(b))).total_seconds()
                 for b, e in ((sp[0], sp[1]) for sp in spans) if b and e]
    aht = sum(durations) / len(durations) if durations else None
    fills_daily = [dict(date=r[0], fills=r[1]) for r in fills_r]
    revenue, dispensed, queued = revenue_r[0][0], dispensed_r[0][0], queued_r[0][0]
    # Star-rating adherence proxies: % of patients on a class with PDC >= 80%
    star = {}
    snap = Snapshot()
    adherence_by_pid = {pid: patient_adherence(pid, snap) for pid in snap.patients}
    for label, classes in STAR_MEASURES.items():
        num = den = 0
        for adh in adherence_by_pid.values():
            vals = [m["pdc"] for m in adh["medications"] if m["pdc"] is not None
                    and kb.DRUGS.get(kb.ingredient_of(m["drug_name"]) or "", {}).get("class") in classes]
            if vals:
                den += 1
                num += 1 if min(vals) >= 0.8 else 0
        star[label] = {"adherent_patients": num, "eligible_patients": den, "rate": round(num / den, 3) if den else None}
    p95 = p95_rows[int(len(p95_rows) * 0.95) - 1] if p95_rows else None
    return {
        "calls": {"total": total, "contained_by_ai": completed,
                  "containment_rate": round(completed / total, 3) if total else None,
                  "escalations": escalations, "avg_handle_time_sec": round(aht, 1) if aht else None,
                  "by_hour": hourly},
        "latency_ms": {"stt_avg": round(lat[0]) if lat[0] else None, "engine_avg": round(lat[1]) if lat[1] else None,
                       "tts_avg": round(lat[2]) if lat[2] else None, "turn_p95": p95, "turns_measured": lat[3]},
        "intents": intents, "languages": languages,
        "fulfillment": {"queued": queued, "dispensed": dispensed, "daily": fills_daily, "copay_revenue": round(float(revenue), 2)},
        "star_adherence": star,
        "note": "All figures are computed from recorded sessions; empty until calls are made.",
    }


# ---------------------------------------------------------------------------
# HIPAA audit log
# ---------------------------------------------------------------------------
@router.get("/audit-log")
def audit_log(limit: int = Query(default=200, le=2000), patient_id: Optional[str] = None):
    with get_db_connection() as conn:
        q = "SELECT * FROM access_log" + (" WHERE patient_id = ?" if patient_id else "") + " ORDER BY log_id DESC LIMIT ?"
        rows = [dict(r) for r in conn.execute(q, ((patient_id, limit) if patient_id else (limit,))).fetchall()]
        # Breach heuristics: many distinct patients touched per role/IP in the last hour, or repeated denials
        bulk = [dict(r) for r in conn.execute("""
            SELECT role, client_ip, COUNT(DISTINCT patient_id) n FROM access_log
            WHERE ts >= datetime('now', '-1 hour') AND patient_id IS NOT NULL GROUP BY role, client_ip HAVING COUNT(DISTINCT patient_id) >= 25
        """).fetchall()]
        denied = [dict(r) for r in conn.execute("""
            SELECT role, client_ip, COUNT(*) n FROM access_log
            WHERE ts >= datetime('now', '-1 hour') AND status_code IN (401, 403, 4401) GROUP BY role, client_ip HAVING COUNT(*) >= 10
        """).fetchall()]
    anomalies = [{"type": "BULK_PHI_ACCESS", **b} for b in bulk] + [{"type": "REPEATED_DENIALS", **d} for d in denied]
    return {"entries": rows, "anomalies": anomalies, "immutable": True}


@router.get("/me")
def whoami(request: Request):
    role = _role(request)
    ident = request.scope.get("state", {}).get("identity") or {}
    return {"role": role, "phi_masked": masks_phi(role), "email": ident.get("email"), "user_id": ident.get("user_id")}


# ---------------------------------------------------------------------------
# Smart call queue
# ---------------------------------------------------------------------------
_counter = itertools.count()
CALL_QUEUE: List[Any] = []  # heap of (priority, seq, entry)
CALLBACKS: List[Dict[str, Any]] = []
HANDLED_SECONDS: List[float] = []


def _is_after_hours(now: Optional[datetime] = None) -> bool:
    now = now or datetime.now()
    info = get_pharmacy_info()
    key = "hours_sun" if now.weekday() == 6 else "hours_sat" if now.weekday() == 5 else "hours_mon_fri"
    try:
        open_s, close_s = [x.strip() for x in info.get(key, "8:00 AM - 8:00 PM").split("-")]
        o = datetime.strptime(open_s, "%I:%M %p").time()
        cl = datetime.strptime(close_s, "%I:%M %p").time()
        return not (o <= now.time() <= cl)
    except ValueError:
        return False


class EnqueueReq(BaseModel):
    caller_phone: str
    reason: Optional[str] = None


@router.post("/queue/enqueue")
def enqueue(req: EnqueueReq):
    from backend.database import get_patient_by_phone
    p = get_patient_by_phone(req.caller_phone)
    priority, label = 3, "ROUTINE"
    if req.reason and any(k in req.reason.lower() for k in ("reaction", "emergency", "breath", "chest")):
        priority, label = 0, "URGENT"
    elif p:
        band = patient_adherence(p["patient_id"])["risk_band"]
        priority, label = (1, "HIGH_RISK") if band == "HIGH" else (2, "KNOWN_PATIENT")
    entry = {"ticket": f"Q-{uuid.uuid4().hex[:5].upper()}", "caller_phone": req.caller_phone,
             "patient_id": p["patient_id"] if p else None, "priority": label, "enqueued_at": time.time(),
             "route": "AI_AGENT" if _is_after_hours() else "AI_AGENT_WITH_STAFF_BACKUP"}
    heapq.heappush(CALL_QUEUE, (priority, next(_counter), entry))
    return {**entry, "position": len(CALL_QUEUE), **queue_status()}


@router.get("/queue")
def queue_status():
    waiting = [e for _, _, e in sorted(CALL_QUEUE)]
    avg = (sum(HANDLED_SECONDS[-20:]) / len(HANDLED_SECONDS[-20:])) if HANDLED_SECONDS else 180.0
    now = time.time()
    for i, e in enumerate(waiting):
        e["wait_sec"] = int(now - e["enqueued_at"])
        e["position"] = i + 1
    return {"depth": len(waiting), "estimated_wait_sec": int(avg * len(waiting)), "after_hours": _is_after_hours(),
            "waiting": waiting, "callbacks": CALLBACKS[-20:]}


@router.post("/queue/next")
def dequeue():
    if not CALL_QUEUE:
        raise HTTPException(404, "Queue empty")
    _, _, e = heapq.heappop(CALL_QUEUE)
    HANDLED_SECONDS.append(time.time() - e["enqueued_at"])
    return e


@router.post("/queue/callback")
def request_callback(req: EnqueueReq):
    for i, (_, _, e) in enumerate(CALL_QUEUE):
        if e["caller_phone"] == req.caller_phone:
            CALL_QUEUE.pop(i)
            heapq.heapify(CALL_QUEUE)
            break
    cb = {"caller_phone": req.caller_phone, "requested_at": datetime.now().isoformat(timespec="seconds"), "status": "PENDING"}
    CALLBACKS.append(cb)
    return cb


# ---------------------------------------------------------------------------
# Snap-to-Verify: NDC barcode -> inventory product -> patient's prescription
# ---------------------------------------------------------------------------
def extract_ndc10(code: str) -> Optional[str]:
    """Pulls a 10-digit NDC from a UPC-A (3 + NDC10 + check) or GS1 GTIN-14 ((01)003 + NDC10 + check) barcode."""
    digits = "".join(c for c in code if c.isdigit())
    if code.strip().startswith("(01)") or (len(digits) >= 16 and digits.startswith("01")):
        digits = digits[2:16]
    if len(digits) == 14 and digits.startswith("003"):
        return digits[3:13]
    if len(digits) == 12 and digits.startswith("3"):
        return digits[1:11]
    if len(digits) == 10:
        return digits
    return None


def _ndc11_to_10_candidates(ndc11: str) -> set:
    d = "".join(c for c in ndc11 if c.isdigit())
    out = set()
    if len(d) == 11:
        if d[0] == "0":
            out.add(d[1:])            # 4-4-2
        if d[5] == "0":
            out.add(d[:5] + d[6:])    # 5-3-2
        if d[9] == "0":
            out.add(d[:9] + d[10:])   # 5-4-1
    return out


@router.get("/verify/ndc")
def verify_ndc(code: str, patient_id: str):
    ndc10 = extract_ndc10(code)
    if not ndc10:
        raise HTTPException(400, "Could not read an NDC from that barcode")
    with get_db_connection() as conn:
        items = [dict(r) for r in conn.execute("SELECT DISTINCT ndc, drug_name, strength FROM inventory").fetchall()]
    product = next((i for i in items if ndc10 in _ndc11_to_10_candidates(i["ndc"])), None)
    if not product:
        return {"ndc10": ndc10, "match": False, "reason": "NDC not in pharmacy catalog"}
    rx = next((r for r in get_prescriptions_for_patient(patient_id)
               if kb.ingredient_of(r["drug_name"]) == kb.ingredient_of(product["drug_name"])
               and r["strength"].replace(" ", "").lower() == product["strength"].replace(" ", "").lower()), None)
    return {"ndc10": ndc10, "ndc11": product["ndc"], "product": f"{product['drug_name']} {product['strength']}",
            "match": bool(rx), "rx": rx,
            "reason": None if rx else "Product does not match any active prescription for this patient (drug or strength differs)"}


# ---------------------------------------------------------------------------
# Staff administration (Supabase Auth)
# ---------------------------------------------------------------------------
class StaffReq(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: str
    password: Optional[str] = Field(default=None, min_length=12)
    full_name: Optional[str] = None


@router.get("/admin/staff")
def staff_list():
    from backend.staff_admin import StaffAdminError, list_staff
    try:
        return {"staff": list_staff()}
    except StaffAdminError as e:
        raise HTTPException(502, str(e))


@router.post("/admin/staff")
def staff_upsert(req: StaffReq):
    from backend.staff_admin import StaffAdminError, upsert_staff
    try:
        return upsert_staff(req.email, req.role, req.password, req.full_name)
    except StaffAdminError as e:
        raise HTTPException(400, str(e))
