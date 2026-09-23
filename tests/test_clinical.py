from datetime import date, timedelta

from backend import clinical_kb as kb

PT_OLD = {"patient_id": "X", "first_name": "A", "last_name": "B", "dob": "1950-01-01", "insurance_carrier": "Kaiser Senior Gold"}


def rx(name, strength="10mg", n="RX-1", sched=0, copay=5.0):
    return {"rx_number": n, "drug_name": name, "strength": strength, "dosage_form": "Tablet", "dea_schedule": sched,
            "copay_amount": copay, "refills_remaining": 2, "next_refill_due_date": (date.today() + timedelta(days=3)).isoformat()}


def test_ingredient_from_brand():
    assert kb.ingredient_of("Adderall XR") == "amphetamine"
    assert kb.ingredient_of("Oxycodone-Acetaminophen") == "oxycodone"


def test_opioid_gabapentinoid_ddi_and_beers():
    res = kb.run_dur(PT_OLD, [rx("Oxycodone-Acetaminophen", "5-325mg", "R1", 2), rx("Gabapentin", "300mg", "R2")], [], [])
    cats = {a["category"] for a in res["alerts"]}
    assert "DRUG_DRUG" in cats and "DRUG_AGE_BEERS" in cats


def test_duplicate_therapy_and_dual_raas():
    res = kb.run_dur(PT_OLD, [rx("Lisinopril", n="R1"), rx("Losartan Potassium", "50mg", "R2"), rx("Atorvastatin", n="R3"), rx("Rosuvastatin", n="R4")], [], [])
    cats = [a["category"] for a in res["alerts"]]
    assert cats.count("DUPLICATE_THERAPY") == 1  # statins
    assert any(a["severity"] == "MAJOR" and a["category"] == "DRUG_DRUG" for a in res["alerts"])


def test_allergy_cross_reactivity():
    res = kb.run_dur(PT_OLD, [rx("Cephalexin", "500mg")], [{"allergen": "Penicillin", "reaction": "Hives"}], [])
    assert res["alerts"][0]["category"] == "DRUG_ALLERGY" and res["alerts"][0]["severity"] == "MODERATE"


def test_drug_disease_and_pregnancy():
    res = kb.run_dur(PT_OLD, [rx("Adderall XR", "20mg")], [], [{"condition_code": "I10", "condition_name": "HTN"}])
    assert any(a["category"] == "DRUG_DISEASE" for a in res["alerts"])
    res = kb.run_dur(PT_OLD, [rx("Atorvastatin")], [], [], is_pregnant=True)
    assert res["overall_risk"] == "CONTRAINDICATED"


def test_clean_profile_has_no_alerts():
    young = {**PT_OLD, "dob": "1990-01-01"}
    assert kb.run_dur(young, [rx("Levothyroxine Sodium", "75mcg")], [], [])["overall_risk"] == "NO_ISSUES_FOUND"


def test_pdc_perfect_and_gappy():
    today = date.today()
    full = [{"fill_date": (today - timedelta(days=d)).isoformat(), "days_supply": 30} for d in (180, 150, 120, 90, 60, 30)]
    assert kb.pdc(full, today=today) == 1.0
    gappy = [{"fill_date": (today - timedelta(days=d)).isoformat(), "days_supply": 30} for d in (180, 90)]
    assert kb.pdc(gappy, today=today) < 0.5


def test_mme():
    assert kb.compute_mme(rx("Oxycodone-Acetaminophen", "5-325mg")) == 15.0


def test_benefit_check_brand_generic():
    res = kb.benefit_check(PT_OLD, rx("Adderall XR", "20mg"))
    assert res["pa_required"] and res["formulary_tier"] == 3


def test_vaccine_recommendations_by_age():
    recs = {v["code"] for v in kb.recommended_vaccines({**PT_OLD, "dob": "1945-01-01"}, [], [])}
    assert {"FLU", "SHINGRIX", "PCV", "RSV"} <= recs and "HEPB" not in recs


def test_hl7_vxu_shape():
    msg = kb.build_hl7_vxu({**PT_OLD}, "FLU", "LOT123", __import__("datetime").datetime(2026, 9, 23, 10, 0))
    segs = msg.split("\r")
    assert segs[0].startswith("MSH|") and "VXU^V04" in segs[0] and segs[3].startswith("RXA|") and "LOT123" in segs[3]


def test_language_detection():
    assert kb.detect_language("Hola, necesito mi receta") == "es"
    assert kb.detect_language("I need my prescription") == "en"
