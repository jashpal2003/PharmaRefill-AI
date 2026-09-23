"""
backend/clinical_kb.py — Rule-based clinical knowledge engine.

Every result here is computed from the patient's actual record (prescriptions, allergies,
conditions, age, fill history). The reference tables are a curated subset of well-established
interactions and guidelines (FDA labeling, AGS Beers Criteria 2023, CDC ACIP adult schedule,
CDC 2022 opioid MME factors). They are NOT a substitute for a licensed drug-knowledge feed
(First Databank, Medi-Span, Lexicomp); swap `DDI_RULES` etc. for that feed in production.
"""

import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

KB_SOURCE = "RxTriage curated rule set (FDA labels, AGS Beers 2023, CDC ACIP, CDC MME) — demo scope"

# ---------------------------------------------------------------------------
# Drug dictionary: ingredient key -> attributes
# ---------------------------------------------------------------------------
DRUGS: Dict[str, Dict[str, Any]] = {
    "atorvastatin": {"class": "statin", "rxnorm": "83367", "pregnancy": "X", "max_daily_mg": 80},
    "rosuvastatin": {"class": "statin", "rxnorm": "301542", "pregnancy": "X", "max_daily_mg": 40},
    "simvastatin": {"class": "statin", "rxnorm": "36567", "pregnancy": "X", "max_daily_mg": 40},
    "metformin": {"class": "biguanide", "rxnorm": "6809", "pregnancy": "B", "max_daily_mg": 2550},
    "lisinopril": {"class": "ace_inhibitor", "rxnorm": "29046", "pregnancy": "D", "max_daily_mg": 80},
    "losartan": {"class": "arb", "rxnorm": "52175", "pregnancy": "D", "max_daily_mg": 100},
    "amlodipine": {"class": "ccb", "rxnorm": "17767", "pregnancy": "C", "max_daily_mg": 10},
    "oxycodone": {"class": "opioid", "rxnorm": "7804", "pregnancy": "C", "mme_factor": 1.5, "controlled": 2},
    "hydrocodone": {"class": "opioid", "rxnorm": "5489", "pregnancy": "C", "mme_factor": 1.0, "controlled": 2},
    "tramadol": {"class": "opioid", "rxnorm": "10689", "pregnancy": "C", "mme_factor": 0.2, "controlled": 4},
    "codeine": {"class": "opioid", "rxnorm": "2670", "pregnancy": "C", "mme_factor": 0.15, "controlled": 2},
    "morphine": {"class": "opioid", "rxnorm": "7052", "pregnancy": "C", "mme_factor": 1.0, "controlled": 2},
    "omeprazole": {"class": "ppi", "rxnorm": "7646", "pregnancy": "C", "max_daily_mg": 40},
    "pantoprazole": {"class": "ppi", "rxnorm": "40790", "pregnancy": "B", "max_daily_mg": 80},
    "sertraline": {"class": "ssri", "rxnorm": "36437", "pregnancy": "C", "max_daily_mg": 200},
    "fluoxetine": {"class": "ssri", "rxnorm": "4493", "pregnancy": "C", "max_daily_mg": 80},
    "amphetamine": {"class": "stimulant", "rxnorm": "725", "pregnancy": "C", "max_daily_mg": 40, "controlled": 2},
    "levothyroxine": {"class": "thyroid", "rxnorm": "10582", "pregnancy": "A"},
    "albuterol": {"class": "saba", "rxnorm": "435", "pregnancy": "C"},
    "gabapentin": {"class": "gabapentinoid", "rxnorm": "25480", "pregnancy": "C", "max_daily_mg": 3600},
    "pregabalin": {"class": "gabapentinoid", "rxnorm": "187832", "pregnancy": "C", "controlled": 5},
    "warfarin": {"class": "anticoagulant", "rxnorm": "11289", "pregnancy": "X"},
    "clopidogrel": {"class": "antiplatelet", "rxnorm": "32968", "pregnancy": "B"},
    "spironolactone": {"class": "k_sparing_diuretic", "rxnorm": "9997", "pregnancy": "C"},
    "potassium": {"class": "potassium", "rxnorm": "8591", "pregnancy": "A"},
    "clarithromycin": {"class": "macrolide", "rxnorm": "21212", "pregnancy": "C"},
    "alprazolam": {"class": "benzodiazepine", "rxnorm": "596", "pregnancy": "D", "controlled": 4},
    "lorazepam": {"class": "benzodiazepine", "rxnorm": "6470", "pregnancy": "D", "controlled": 4},
    "zolpidem": {"class": "z_drug", "rxnorm": "39993", "pregnancy": "C", "controlled": 4},
    "ibuprofen": {"class": "nsaid", "rxnorm": "5640", "pregnancy": "C", "max_daily_mg": 3200},
    "naproxen": {"class": "nsaid", "rxnorm": "7258", "pregnancy": "C", "max_daily_mg": 1500},
    "glipizide": {"class": "sulfonylurea", "rxnorm": "4815", "pregnancy": "C", "max_daily_mg": 40},
    "amoxicillin": {"class": "penicillin", "rxnorm": "723", "pregnancy": "B"},
    "cephalexin": {"class": "cephalosporin", "rxnorm": "2231", "pregnancy": "B"},
    "sulfamethoxazole": {"class": "sulfonamide_antibiotic", "rxnorm": "10180", "pregnancy": "C"},
    "montelukast": {"class": "leukotriene", "rxnorm": "88249", "pregnancy": "B"},
}

BRAND_TO_INGREDIENT = {
    "adderall": "amphetamine", "lipitor": "atorvastatin", "crestor": "rosuvastatin", "zocor": "simvastatin",
    "glucophage": "metformin", "zestril": "lisinopril", "prinivil": "lisinopril", "cozaar": "losartan",
    "norvasc": "amlodipine", "percocet": "oxycodone", "oxycontin": "oxycodone", "vicodin": "hydrocodone",
    "prilosec": "omeprazole", "protonix": "pantoprazole", "zoloft": "sertraline", "prozac": "fluoxetine",
    "synthroid": "levothyroxine", "proair": "albuterol", "ventolin": "albuterol", "neurontin": "gabapentin",
    "lyrica": "pregabalin", "coumadin": "warfarin", "plavix": "clopidogrel", "xanax": "alprazolam",
    "ativan": "lorazepam", "ambien": "zolpidem", "singulair": "montelukast", "ultram": "tramadol",
}


def ingredient_of(drug_name: str) -> Optional[str]:
    n = drug_name.lower()
    for brand, ing in BRAND_TO_INGREDIENT.items():
        if re.search(rf"\b{brand}\b", n):
            return ing
    for ing in DRUGS:
        if re.search(rf"\b{ing}\b", n):
            return ing
    return None


def strength_mg(strength: str) -> Optional[float]:
    m = re.match(r"\s*([\d.]+)", strength or "")
    if not m or "mcg" in (strength or "").lower():
        return None
    return float(m.group(1))


# ---------------------------------------------------------------------------
# Drug-drug interaction rules, keyed on ingredient or class ("class:<name>")
# ---------------------------------------------------------------------------
DDI_RULES: List[Dict[str, Any]] = [
    {"a": "class:opioid", "b": "class:benzodiazepine", "severity": "CONTRAINDICATED",
     "effect": "Profound sedation, respiratory depression, coma and death (FDA boxed warning).",
     "action": "Avoid combination. If unavoidable, lowest doses, shortest duration, co-prescribe naloxone."},
    {"a": "class:opioid", "b": "class:gabapentinoid", "severity": "MAJOR",
     "effect": "Additive CNS and respiratory depression (FDA 2019 safety communication).",
     "action": "Use lowest effective doses; counsel on sedation; consider naloxone."},
    {"a": "class:opioid", "b": "class:z_drug", "severity": "MAJOR",
     "effect": "Additive CNS depression.", "action": "Avoid or reduce doses; monitor sedation."},
    {"a": "class:ssri", "b": "tramadol", "severity": "MAJOR",
     "effect": "Serotonin syndrome and lowered seizure threshold.", "action": "Prefer non-serotonergic analgesic."},
    {"a": "class:ssri", "b": "amphetamine", "severity": "MODERATE",
     "effect": "Increased risk of serotonin syndrome.", "action": "Monitor for agitation, hyperthermia, tremor."},
    {"a": "class:ssri", "b": "oxycodone", "severity": "MODERATE",
     "effect": "Serotonergic opioid plus SSRI; serotonin syndrome risk.", "action": "Monitor; counsel on symptoms."},
    {"a": "class:ssri", "b": "warfarin", "severity": "MODERATE",
     "effect": "Increased bleeding risk (platelet serotonin depletion).", "action": "Monitor INR and bleeding."},
    {"a": "class:ace_inhibitor", "b": "class:arb", "severity": "MAJOR",
     "effect": "Dual RAAS blockade: hyperkalemia, hypotension, acute kidney injury.", "action": "Avoid combination."},
    {"a": "class:ace_inhibitor", "b": "class:k_sparing_diuretic", "severity": "MAJOR",
     "effect": "Hyperkalemia.", "action": "Monitor serum potassium and renal function closely."},
    {"a": "class:ace_inhibitor", "b": "class:potassium", "severity": "MAJOR",
     "effect": "Hyperkalemia.", "action": "Check K+ before dispensing; avoid unless hypokalemic."},
    {"a": "class:arb", "b": "class:k_sparing_diuretic", "severity": "MAJOR",
     "effect": "Hyperkalemia.", "action": "Monitor serum potassium."},
    {"a": "class:ace_inhibitor", "b": "class:nsaid", "severity": "MODERATE",
     "effect": "Reduced antihypertensive effect; renal injury risk ('triple whammy' with diuretics).",
     "action": "Limit NSAID use; monitor BP and renal function."},
    {"a": "atorvastatin", "b": "clarithromycin", "severity": "MAJOR",
     "effect": "CYP3A4 inhibition raises statin levels; rhabdomyolysis risk.", "action": "Hold statin during course or use azithromycin."},
    {"a": "simvastatin", "b": "clarithromycin", "severity": "CONTRAINDICATED",
     "effect": "Marked simvastatin exposure increase; rhabdomyolysis.", "action": "Contraindicated."},
    {"a": "simvastatin", "b": "amlodipine", "severity": "MODERATE",
     "effect": "Amlodipine increases simvastatin exposure.", "action": "Do not exceed simvastatin 20 mg/day."},
    {"a": "clopidogrel", "b": "omeprazole", "severity": "MAJOR",
     "effect": "CYP2C19 inhibition reduces clopidogrel activation.", "action": "Switch to pantoprazole or famotidine."},
    {"a": "warfarin", "b": "class:nsaid", "severity": "MAJOR",
     "effect": "Bleeding risk.", "action": "Avoid; use acetaminophen."},
    {"a": "levothyroxine", "b": "class:ppi", "severity": "MINOR",
     "effect": "Reduced levothyroxine absorption with gastric acid suppression.", "action": "Monitor TSH."},
    {"a": "amphetamine", "b": "class:ppi", "severity": "MINOR",
     "effect": "PPIs may accelerate release of extended-release amphetamine.", "action": "Monitor response."},
]

DRUG_DISEASE_RULES = [
    {"drug": "amphetamine", "condition_prefix": "I10", "severity": "MODERATE",
     "effect": "Stimulants raise blood pressure and heart rate.", "action": "Confirm BP controlled; monitor."},
    {"drug": "class:nsaid", "condition_prefix": "I10", "severity": "MODERATE",
     "effect": "NSAIDs raise BP and blunt antihypertensives.", "action": "Prefer acetaminophen."},
    {"drug": "class:nsaid", "condition_prefix": "N18", "severity": "MAJOR",
     "effect": "NSAIDs worsen chronic kidney disease.", "action": "Avoid."},
    {"drug": "metformin", "condition_prefix": "N18", "severity": "MAJOR",
     "effect": "Lactic acidosis risk if eGFR < 30.", "action": "Verify eGFR before dispensing."},
    {"drug": "class:opioid", "condition_prefix": "J45", "severity": "MODERATE",
     "effect": "Respiratory depression in asthma.", "action": "Use cautiously; lowest dose."},
    {"drug": "class:opioid", "condition_prefix": "F32", "severity": "MODERATE",
     "effect": "Depression increases opioid misuse and overdose risk.", "action": "Screen and counsel; naloxone."},
]

# AGS Beers Criteria 2023 (subset) — potentially inappropriate in adults >= 65
BEERS_RULES = [
    {"drug": "class:benzodiazepine", "reason": "Cognitive impairment, delirium, falls, fractures.", "action": "Avoid."},
    {"drug": "class:z_drug", "reason": "Delirium, falls, fractures; minimal sleep benefit.", "action": "Avoid."},
    {"drug": "class:sulfonylurea", "reason": "Prolonged hypoglycemia (glipizide lower risk; still caution).", "action": "Avoid as first/second line."},
    {"drug": "class:ppi", "reason": "C. difficile, bone loss, fractures with > 8 weeks use.", "action": "Avoid > 8 weeks unless high-risk indication."},
    {"drug": "class:nsaid", "reason": "GI bleeding, kidney injury, BP increase.", "action": "Avoid chronic use."},
    {"drug": "class:opioid+class:gabapentinoid", "reason": "Opioid + gabapentinoid: sedation, respiratory depression.", "action": "Avoid combination."},
    {"drug": "class:opioid+class:benzodiazepine", "reason": "Opioid + CNS depressant: overdose risk.", "action": "Avoid combination."},
]

# Allergen -> (drugs/classes that cross-react, severity, note)
ALLERGY_CROSS = {
    "penicillin": [("class:penicillin", "CONTRAINDICATED", "Same drug class."),
                   ("class:cephalosporin", "MODERATE", "~1-2% cross-reactivity (higher with similar R1 side chains).")],
    "sulfonamides": [("class:sulfonamide_antibiotic", "CONTRAINDICATED", "Sulfonamide antibiotic allergy.")],
    "codeine": [("codeine", "CONTRAINDICATED", "Documented codeine intolerance."),
                ("morphine", "MODERATE", "Phenanthrene opioid; possible cross-sensitivity."),
                ("hydrocodone", "MODERATE", "Phenanthrene opioid; possible cross-sensitivity."),
                ("oxycodone", "MODERATE", "Phenanthrene opioid; possible cross-sensitivity.")],
    "nsaid": [("class:nsaid", "CONTRAINDICATED", "NSAID hypersensitivity.")],
}

SEVERITY_ORDER = {"CONTRAINDICATED": 4, "MAJOR": 3, "MODERATE": 2, "MINOR": 1}


def _matches(token: str, ing: str) -> bool:
    if token.startswith("class:"):
        return DRUGS.get(ing, {}).get("class") == token[6:]
    return token == ing


def age_from_dob(dob: str, today: Optional[date] = None) -> int:
    today = today or date.today()
    d = datetime.strptime(dob, "%Y-%m-%d").date()
    return today.year - d.year - ((today.month, today.day) < (d.month, d.day))


def run_dur(patient: Dict[str, Any], prescriptions: List[Dict[str, Any]], allergies: List[Dict[str, Any]],
            conditions: List[Dict[str, Any]], is_pregnant: bool = False,
            candidate: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Full 7-category DUR across the active profile (plus an optional candidate drug)."""
    meds = list(prescriptions) + ([candidate] if candidate else [])
    items: List[Tuple[Dict[str, Any], str]] = []
    for rx in meds:
        ing = ingredient_of(rx["drug_name"])
        if ing:
            items.append((rx, ing))

    alerts: List[Dict[str, Any]] = []
    age = age_from_dob(patient["dob"])

    def add(category, severity, drugs, effect, action, key):
        alerts.append({"category": category, "severity": severity, "drugs": drugs,
                       "clinical_effect": effect, "recommendation": action, "alert_key": key})

    # 1. Drug-drug
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            (ra, ia), (rb, ib) = items[i], items[j]
            if ia == ib:
                continue
            for rule in DDI_RULES:
                if (_matches(rule["a"], ia) and _matches(rule["b"], ib)) or (_matches(rule["a"], ib) and _matches(rule["b"], ia)):
                    add("DRUG_DRUG", rule["severity"],
                        [f"{ra['drug_name']} {ra['strength']}", f"{rb['drug_name']} {rb['strength']}"],
                        rule["effect"], rule["action"], f"DDI:{min(ia, ib)}:{max(ia, ib)}")
                    break

    # 2. Duplicate therapy (same class, different Rx)
    by_class: Dict[str, List[Dict[str, Any]]] = {}
    for rx, ing in items:
        by_class.setdefault(DRUGS[ing]["class"], []).append(rx)
    for cls, rxs in by_class.items():
        if len(rxs) > 1:
            add("DUPLICATE_THERAPY", "MAJOR", [f"{r['drug_name']} {r['strength']}" for r in rxs],
                f"Two or more agents from the same class ({cls.replace('_', ' ')}).",
                "Confirm intentional; otherwise contact prescriber to discontinue one.", f"DUP:{cls}")

    # 3. Drug-allergy
    for a in allergies:
        allergen = a["allergen"].lower()
        rules = next((v for k, v in ALLERGY_CROSS.items() if k in allergen), [])
        for rx, ing in items:
            for token, sev, note in rules:
                if _matches(token, ing):
                    add("DRUG_ALLERGY", sev, [f"{rx['drug_name']} {rx['strength']}"],
                        f"Documented allergy: {a['allergen']} ({a.get('reaction') or 'reaction not recorded'}). {note}",
                        "Verify allergy history with patient; contact prescriber for alternative.", f"ALG:{allergen}:{ing}")

    # 4. Drug-disease
    codes = [c["condition_code"] for c in conditions]
    for rule in DRUG_DISEASE_RULES:
        for rx, ing in items:
            if _matches(rule["drug"], ing) and any(c.startswith(rule["condition_prefix"]) for c in codes):
                cond = next(c for c in conditions if c["condition_code"].startswith(rule["condition_prefix"]))
                add("DRUG_DISEASE", rule["severity"], [f"{rx['drug_name']} {rx['strength']}"],
                    f"{rule['effect']} Condition: {cond['condition_name']} ({cond['condition_code']}).",
                    rule["action"], f"DDX:{ing}:{rule['condition_prefix']}")

    # 5. Drug-age (Beers, >= 65)
    if age >= 65:
        for rule in BEERS_RULES:
            parts = rule["drug"].split("+")
            hits = [next((rx for rx, ing in items if _matches(p, ing)), None) for p in parts]
            if all(hits):
                add("DRUG_AGE_BEERS", "MAJOR" if len(parts) > 1 else "MODERATE",
                    [f"{h['drug_name']} {h['strength']}" for h in hits],
                    f"AGS Beers Criteria (age {age}): {rule['reason']}", rule["action"], f"BEERS:{rule['drug']}")

    # 6. Drug-pregnancy
    if is_pregnant:
        for rx, ing in items:
            if DRUGS[ing].get("pregnancy") in ("X", "D"):
                add("DRUG_PREGNANCY", "CONTRAINDICATED" if DRUGS[ing]["pregnancy"] == "X" else "MAJOR",
                    [f"{rx['drug_name']} {rx['strength']}"],
                    f"Pregnancy risk category {DRUGS[ing]['pregnancy']}.", "Contact prescriber before dispensing.",
                    f"PREG:{ing}")

    # 7. Dose range (strength vs. maximum daily dose; assumes once-daily when no sig is recorded)
    for rx, ing in items:
        mg = strength_mg(rx.get("strength", ""))
        mx = DRUGS[ing].get("max_daily_mg")
        if mg and mx and mg > mx:
            add("DOSE_RANGE", "MAJOR", [f"{rx['drug_name']} {rx['strength']}"],
                f"Unit strength {mg:g} mg exceeds max daily dose {mx} mg.", "Verify dose with prescriber.", f"DOSE:{ing}")

    alerts.sort(key=lambda a: -SEVERITY_ORDER[a["severity"]])
    worst = alerts[0]["severity"] if alerts else None
    overall = {"CONTRAINDICATED": "CONTRAINDICATED", "MAJOR": "PHARMACIST_REVIEW_REQUIRED",
               "MODERATE": "SAFE_WITH_MONITORING", "MINOR": "SAFE_WITH_MONITORING", None: "NO_ISSUES_FOUND"}[worst]
    return {
        "age": age,
        "overall_risk": overall,
        "alert_count": len(alerts),
        "alerts": alerts,
        "polypharmacy": len(prescriptions) >= 5,
        "source": KB_SOURCE,
    }


# ---------------------------------------------------------------------------
# Real-time benefit check (formulary tiers per payer)
# ---------------------------------------------------------------------------
# Demo formulary. In production this is a Surescripts RTPB / NCPDP RTPB response.
TIER_COPAY = {
    "BlueCross Medicare Advantage": {1: 0.00, 2: 4.00, 3: 47.00, 4: 100.00},
    "Kaiser Senior Gold": {1: 2.00, 2: 10.00, 3: 45.00, 4: 95.00},
    "Aetna Premier Choice": {1: 5.00, 2: 15.00, 3: 50.00, 4: 120.00},
    "UnitedHealthcare Choice Plus": {1: 3.00, 2: 12.00, 3: 47.00, 4: 110.00},
}
FORMULARY_TIER = {
    "atorvastatin": 1, "rosuvastatin": 2, "simvastatin": 1, "metformin": 1, "lisinopril": 1, "losartan": 1,
    "amlodipine": 1, "oxycodone": 2, "omeprazole": 1, "pantoprazole": 1, "sertraline": 1, "fluoxetine": 1,
    "levothyroxine": 1, "gabapentin": 1, "montelukast": 1, "albuterol": 2, "amphetamine": 3,
}
BRAND_PENALTY_TIER = 3  # brand products with a generic available fall to tier 3
PA_REQUIRED = {"amphetamine", "pregabalin"}

# Brand -> (generic product name, typical generic cash price / 30 days)
GENERIC_EQUIVALENTS = {
    "adderall": ("Amphetamine/Dextroamphetamine ER", 38.00),
    "lipitor": ("Atorvastatin Calcium", 9.00),
    "crestor": ("Rosuvastatin Calcium", 12.00),
    "singulair": ("Montelukast Sodium", 10.00),
    "proair": ("Albuterol Sulfate HFA (generic)", 25.00),
    "ventolin": ("Albuterol Sulfate HFA (generic)", 25.00),
    "synthroid": ("Levothyroxine Sodium", 11.00),
    "zoloft": ("Sertraline HCl", 8.00),
    "prilosec": ("Omeprazole DR", 10.00),
    "percocet": ("Oxycodone-Acetaminophen", 18.00),
}
THERAPEUTIC_ALTERNATIVES = {
    "rosuvastatin": "atorvastatin", "pantoprazole": "omeprazole", "losartan": "lisinopril",
}


def brand_of(drug_name: str) -> Optional[str]:
    n = drug_name.lower()
    return next((b for b in GENERIC_EQUIVALENTS if re.search(rf"\b{b}\b", n)), None)


def benefit_check(patient: Dict[str, Any], rx: Dict[str, Any]) -> Dict[str, Any]:
    payer = patient.get("insurance_carrier") or "Cash"
    ing = ingredient_of(rx["drug_name"])
    brand = brand_of(rx["drug_name"])
    tiers = TIER_COPAY.get(payer)
    tier = BRAND_PENALTY_TIER if brand else FORMULARY_TIER.get(ing or "", 3)
    tier = max(tier, FORMULARY_TIER.get(ing or "", 1))
    oop = tiers[tier] if tiers else None
    alternatives = []
    if brand and tiers:
        gname, _ = GENERIC_EQUIVALENTS[brand]
        g_tier = FORMULARY_TIER.get(ing or "", 1)
        alternatives.append({"type": "GENERIC", "drug_name": gname, "tier": g_tier,
                             "estimated_copay": tiers[g_tier], "savings": round(tiers[tier] - tiers[g_tier], 2)})
    if ing in THERAPEUTIC_ALTERNATIVES and tiers:
        alt = THERAPEUTIC_ALTERNATIVES[ing]
        a_tier = FORMULARY_TIER[alt]
        if tiers[a_tier] < tiers[tier]:
            alternatives.append({"type": "THERAPEUTIC", "drug_name": alt.capitalize(), "tier": a_tier,
                                 "estimated_copay": tiers[a_tier], "savings": round(tiers[tier] - tiers[a_tier], 2),
                                 "requires_prescriber": True})
    return {
        "rx_number": rx["rx_number"],
        "drug_name": f"{rx['drug_name']} {rx['strength']}",
        "payer": payer,
        "formulary_tier": tier,
        "estimated_copay": oop,
        "copay_on_file": float(rx["copay_amount"]),
        "pa_required": (ing in PA_REQUIRED),
        "alternatives": alternatives,
        "source": "Local formulary table (demo). Connect Surescripts RTPB for live payer responses.",
    }


# ---------------------------------------------------------------------------
# PDMP / MME
# ---------------------------------------------------------------------------
def compute_mme(rx: Dict[str, Any], doses_per_day: float = 2.0) -> Optional[float]:
    """MME/day = strength(mg) * doses/day * conversion factor. No sig is stored, so doses/day is assumed."""
    ing = ingredient_of(rx["drug_name"])
    factor = DRUGS.get(ing or "", {}).get("mme_factor")
    mg = strength_mg(rx.get("strength", ""))
    if factor is None or mg is None:
        return None
    return round(mg * doses_per_day * factor, 1)


# ---------------------------------------------------------------------------
# Adherence: Proportion of Days Covered (PQA method) + risk score
# ---------------------------------------------------------------------------
def pdc(fills: List[Dict[str, Any]], window_days: int = 180, today: Optional[date] = None) -> Optional[float]:
    today = today or date.today()
    if not fills:
        return None
    dates = sorted(datetime.strptime(f["fill_date"], "%Y-%m-%d").date() for f in fills)
    start = max(dates[0], today - timedelta(days=window_days))
    period = (today - start).days
    if period <= 0:
        return 1.0
    covered = set()
    carry_until = start
    for f in sorted(fills, key=lambda x: x["fill_date"]):
        d = datetime.strptime(f["fill_date"], "%Y-%m-%d").date()
        begin = max(d, carry_until)  # early refills shift forward (PQA)
        for k in range(int(f["days_supply"])):
            day = begin + timedelta(days=k)
            if start <= day < today:
                covered.add(day)
        carry_until = begin + timedelta(days=int(f["days_supply"]))
    return round(len(covered) / period, 3)


def adherence_risk(prescriptions: List[Dict[str, Any]], fills_by_rx: Dict[str, List[Dict[str, Any]]],
                   today: Optional[date] = None) -> Dict[str, Any]:
    today = today or date.today()
    per_drug = []
    for rx in prescriptions:
        if rx["dea_schedule"] >= 2:
            continue  # PDC measures exclude PRN controlled substances
        value = pdc(fills_by_rx.get(rx["rx_number"], []), today=today)
        due = datetime.strptime(rx["next_refill_due_date"], "%Y-%m-%d").date()
        per_drug.append({
            "rx_number": rx["rx_number"], "drug_name": rx["drug_name"], "pdc": value,
            "adherent": value is not None and value >= 0.8,
            "days_until_due": (due - today).days, "refills_remaining": rx["refills_remaining"],
        })
    pdcs = [d["pdc"] for d in per_drug if d["pdc"] is not None]
    avg = sum(pdcs) / len(pdcs) if pdcs else 1.0
    score = (1 - avg) * 100 * 0.6
    factors = []
    if len(prescriptions) >= 5:
        score += 10; factors.append("Polypharmacy (5+ active medications)")
    low = [d for d in per_drug if d["pdc"] is not None and d["pdc"] < 0.8]
    if low:
        score += 10 * len(low); factors.append(f"{len(low)} medication(s) below PDC 80%")
    lapsing = [d for d in per_drug if 0 <= d["days_until_due"] <= 7]
    if lapsing:
        score += 5; factors.append(f"{len(lapsing)} refill(s) due within 7 days")
    overdue = [d for d in per_drug if d["days_until_due"] < 0]
    if overdue:
        score += 15; factors.append(f"{len(overdue)} refill(s) overdue")
    zero = [d for d in per_drug if d["refills_remaining"] == 0]
    if zero:
        score += 10; factors.append("Needs prescriber renewal")
    score = int(min(100, round(score)))
    band = "HIGH" if score >= 50 else "MEDIUM" if score >= 25 else "LOW"
    return {"risk_score": score, "risk_band": band, "average_pdc": round(avg, 3),
            "factors": factors, "medications": per_drug, "lapsing_within_7_days": len(lapsing)}


# ---------------------------------------------------------------------------
# Immunizations — CDC ACIP adult schedule (abridged)
# ---------------------------------------------------------------------------
VACCINES = [
    {"code": "FLU", "name": "Influenza (seasonal)", "cvx": "150", "min_age": 18, "interval_days": 365},
    {"code": "COVID", "name": "COVID-19 (2025-26 formula)", "cvx": "309", "min_age": 18, "interval_days": 365},
    {"code": "TDAP", "name": "Tdap / Td booster", "cvx": "115", "min_age": 18, "interval_days": 3650},
    {"code": "SHINGRIX", "name": "Zoster recombinant (Shingrix, 2 doses)", "cvx": "187", "min_age": 50, "interval_days": None},
    {"code": "PCV", "name": "Pneumococcal conjugate (PCV20/PCV21)", "cvx": "216", "min_age": 50, "interval_days": None},
    {"code": "RSV", "name": "RSV (adults 75+, or 50-74 at increased risk)", "cvx": "305", "min_age": 75, "risk_min_age": 50, "interval_days": None},
    {"code": "HEPB", "name": "Hepatitis B (adults 19-59)", "cvx": "189", "min_age": 19, "max_age": 59, "interval_days": None},
]
RSV_RISK_PREFIXES = ("J45", "J44", "E11", "I50", "N18")

SCREENING_QUESTIONS = [
    "Are you sick today or have a fever?",
    "Have you ever had a serious reaction after a vaccine?",
    "Do you have a severe allergy to any vaccine component (e.g., gelatin, eggs, latex)?",
    "Do you have a weakened immune system (cancer, HIV, steroids, chemotherapy)?",
    "Are you pregnant or could you become pregnant in the next month?",
    "Have you received any vaccines in the past 4 weeks?",
]


def recommended_vaccines(patient: Dict[str, Any], conditions: List[Dict[str, Any]],
                         history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    age = age_from_dob(patient["dob"])
    codes = [c["condition_code"] for c in conditions]
    at_risk = any(c.startswith(RSV_RISK_PREFIXES) for c in codes)
    out = []
    for v in VACCINES:
        eligible = age >= v["min_age"] and age <= v.get("max_age", 200)
        if v["code"] == "RSV":
            eligible = age >= 75 or (age >= v["risk_min_age"] and at_risk)
        if not eligible:
            continue
        given = [h for h in history if h["vaccine"] == v["code"] and h["status"] == "ADMINISTERED"]
        if given and v["interval_days"] is None:
            continue
        if given and v["interval_days"]:
            last = max(datetime.fromisoformat(h["administered_at"]).date() for h in given)
            if (date.today() - last).days < v["interval_days"]:
                continue
        out.append({"code": v["code"], "name": v["name"], "cvx": v["cvx"]})
    return out


def build_hl7_vxu(patient: Dict[str, Any], vaccine_code: str, lot: str, administered_at: datetime,
                  facility: str = "COMMUNITY CARE PHARMACY") -> str:
    """HL7 v2.5.1 VXU^V04 (CDC IIS implementation guide, abridged) for state registry submission."""
    v = next(x for x in VACCINES if x["code"] == vaccine_code)
    ts = administered_at.strftime("%Y%m%d%H%M%S")
    dob = patient["dob"].replace("-", "")
    segs = [
        f"MSH|^~\\&|RXTRIAGE|{facility}|IIS|STATE|{ts}||VXU^V04^VXU_V04|{patient['patient_id']}{ts}|P|2.5.1|||ER|AL|||||Z22^CDCPHINVS",
        f"PID|1||{patient['patient_id']}^^^RXTRIAGE^MR||{patient['last_name'].upper()}^{patient['first_name'].upper()}||{dob}",
        "ORC|RE||" + f"{patient['patient_id']}-{vaccine_code}",
        f"RXA|0|1|{ts}||{v['cvx']}^{v['name']}^CVX|0.5|mL^mL^UCUM||00^New Immunization^NIP001||||||{lot}",
        "RXR|C28161^Intramuscular^NCIT|LD^Left Deltoid^HL70163",
    ]
    return "\r".join(segs)


# ---------------------------------------------------------------------------
# SDOH — AHC Health-Related Social Needs core domains
# ---------------------------------------------------------------------------
SDOH_QUESTIONS = [
    {"id": "housing", "domain": "Housing instability", "question": "Are you worried about losing your housing, or do you not have steady housing?"},
    {"id": "food", "domain": "Food insecurity", "question": "In the past 12 months, did you worry food would run out before you got money to buy more?"},
    {"id": "transport", "domain": "Transportation", "question": "In the past 12 months, has lack of transportation kept you from medical appointments or getting medications?"},
    {"id": "utilities", "domain": "Utilities", "question": "In the past 12 months, has a utility company threatened to shut off services?"},
    {"id": "safety", "domain": "Interpersonal safety", "question": "Does anyone physically hurt, insult, threaten or scream at you?"},
    {"id": "cost", "domain": "Medication affordability", "question": "In the past 12 months, have you skipped medication because of cost?"},
]
SDOH_RESOURCES = {
    "housing": "211 housing assistance line; local Continuum of Care",
    "food": "SNAP enrollment; local food bank referral (211)",
    "transport": "Free courier delivery enrollment; Medicaid NEMT benefit",
    "utilities": "LIHEAP energy assistance",
    "safety": "National DV Hotline 1-800-799-7233; warm handoff to pharmacist",
    "cost": "Manufacturer assistance, Medicare Extra Help (LIS), generic substitution review",
}


def score_sdoh(answers: Dict[str, bool]) -> List[Dict[str, str]]:
    return [{"domain": q["domain"], "id": q["id"], "resource": SDOH_RESOURCES[q["id"]]}
            for q in SDOH_QUESTIONS if answers.get(q["id"])]


# ---------------------------------------------------------------------------
# MTM / CMR eligibility (Medicare Part D, simplified CY2025 criteria)
# ---------------------------------------------------------------------------
CORE_CHRONIC_PREFIXES = {
    "E78": "Hyperlipidemia", "E11": "Diabetes", "I10": "Hypertension", "I50": "Heart failure",
    "J45": "Asthma", "J44": "COPD", "F32": "Depression", "F90": "ADHD", "E03": "Hypothyroidism",
    "N18": "CKD", "F20": "Schizophrenia", "M81": "Osteoporosis", "G30": "Alzheimer's",
}
# Illustrative MTM billing rates (payer contracts vary).
MTM_CPT_RATES = {"99605": 55.00, "99606": 40.00, "99607": 20.00}


def cmr_eligibility(patient: Dict[str, Any], prescriptions: List[Dict[str, Any]], conditions: List[Dict[str, Any]]) -> Dict[str, Any]:
    chronic = sorted({name for c in conditions for pref, name in CORE_CHRONIC_PREFIXES.items() if c["condition_code"].startswith(pref)})
    is_part_d = "medicare" in (patient.get("insurance_carrier") or "").lower() or "senior" in (patient.get("insurance_carrier") or "").lower()
    eligible = is_part_d and len(chronic) >= 3 and len(prescriptions) >= 4
    return {
        "eligible": eligible,
        "part_d": is_part_d,
        "chronic_conditions": chronic,
        "active_medications": len(prescriptions),
        "criteria": "Part D enrollee, >= 3 core chronic diseases, >= 4 Part D drugs (plan-specific thresholds apply)",
        "billable_cpt": ["99605", "99607"] if eligible else [],
        "projected_revenue": MTM_CPT_RATES["99605"] + MTM_CPT_RATES["99607"] if eligible else 0.0,
    }


# ---------------------------------------------------------------------------
# Multilingual support (English / Spanish)
# ---------------------------------------------------------------------------
SPANISH_MARKERS = {
    "hola", "necesito", "receta", "medicina", "medicamento", "por favor", "gracias", "sí", "quiero",
    "buenos", "buenas", "español", "surtir", "resurtir", "farmacia", "cuánto", "cuando", "nací", "nacimiento",
    "mi nombre", "me llamo", "ayuda", "hablar", "cita", "pago", "saldo",
}


def detect_language(text: str) -> str:
    t = f" {text.lower()} "
    hits = sum(1 for m in SPANISH_MARKERS if f" {m} " in t or f" {m}," in t or f" {m}." in t)
    if "español" in t or "spanish" in t or hits >= 2 or any(ch in t for ch in "¿¡ñ"):
        return "es"
    return "en"
