"""
backend/phonetic_repair.py — "Say Less" Smart Phonetic Clarification Engine.
Eliminates caller repetition fatigue by matching acoustic mispronunciations
against the patient's active prescription profile using phonetic indexing and drug aliases.
"""

import re
from typing import Dict, List, Optional, Tuple, Any

# Common brand-to-generic and colloquial pharmacy phonetic aliases
DRUG_PHONETIC_ALIASES: Dict[str, List[str]] = {
    "atorvastatin": [
        "lipitor", "statin", "atorvastatina", "atorva", "atorvastin", "a tour of statin",
        "torvastatin", "ator"
    ],
    "metformin": [
        "glucophage", "metformina", "metformin hcl", "sugar pill", "met form in",
        "metform", "metformin hydrochloride"
    ],
    "lisinopril": [
        "zestril", "prinivil", "lisinopril hctz", "blood pressure pill", "liss in o pril",
        "lisino", "lisopril"
    ],
    "omeprazole": [
        "prilosec", "omeprazol", "acid pill", "heartburn pill", "o mep ra zole", "omepra"
    ],
    "levothyroxine": [
        "synthroid", "levoxyl", "thyroid pill", "levo thyroxine", "levothyroxin", "levo"
    ],
    "albuterol": [
        "proair", "ventolin", "proventil", "inhaler", "rescue inhaler", "albuterol hfa",
        "albuterol sulfate", "breathing inhaler"
    ],
    "gabapentin": [
        "neurontin", "gaba", "nerve pain pill", "gaba pentin", "gabapentina"
    ],
    "amlodipine": [
        "norvasc", "amlodipine besylate", "amlo", "am lo di pine"
    ],
    "losartan": [
        "cozaar", "losartan potassium", "lo sar tan", "losartan hctz"
    ],
    "hydrochlorothiazide": [
        "microzide", "hctz", "water pill", "hydro chlorothiazide", "hydro chlorine thiazide"
    ],
    "sertraline": [
        "zoloft", "ser tra line", "sertralin"
    ],
    "singulair": [
        "montelukast", "sing you lair", "allergy chewable", "singulair montelukast"
    ],
    "oxycodone": [
        "percocet", "roxicodone", "oxy", "oxycontin", "pain killer"
    ],
    "adderall": [
        "amphetamine", "dextroamphetamine", "adderal"
    ],
}

def _levenshtein_distance(s1: str, s2: str) -> int:
    """Calculates Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return _levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]

def _string_similarity(s1: str, s2: str) -> float:
    """Calculates normalized similarity ratio between 0.0 and 1.0."""
    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 1.0
    dist = _levenshtein_distance(s1, s2)
    return 1.0 - (dist / max_len)

def find_phonetic_repair_candidate(
    spoken_text: str,
    prescriptions: List[Dict[str, Any]],
    similarity_threshold: float = 0.62
) -> Optional[Dict[str, Any]]:
    """
    Scans caller utterance against patient's active prescriptions using phonetic aliases
    and fuzzy Levenshtein candidate ranking.
    Returns targeted 1-word repair offer if candidate is detected with high confidence.
    """
    clean_text = "".join(c if c.isalnum() else " " for c in spoken_text.lower()).strip()
    tokens = [t for t in clean_text.split() if len(t) >= 3]
    if not tokens:
        return None

    best_match: Optional[Dict[str, Any]] = None
    highest_score = 0.0
    matched_word = ""

    for rx in prescriptions:
        full_name = rx["drug_name"].lower()
        drug_stem = full_name.split()[0].split("-")[0]
        aliases = DRUG_PHONETIC_ALIASES.get(drug_stem, [])

        # 1. Check multi-word phrase matching against aliases
        for alias in aliases:
            if alias in clean_text:
                return {
                    "matched_rx": rx,
                    "target_drug": rx["drug_name"],
                    "strength": rx.get("strength", ""),
                    "confidence": 0.99,
                    "clarification_prompt": f"Did you mean your {rx['drug_name']} {rx.get('strength', '')}?",
                    "voiced_token": alias,
                    "repair_type": "PHONETIC_ALIAS_MATCH"
                }

        # 2. Check token-by-token fuzzy phonetic similarity
        for token in tokens:
            # Test against drug stem
            score = _string_similarity(token, drug_stem)
            if score > highest_score and score >= similarity_threshold:
                highest_score = score
                best_match = rx
                matched_word = token

            # Test against alias list
            for alias in aliases:
                a_stem = alias.split()[0]
                alias_score = _string_similarity(token, a_stem)
                if alias_score > highest_score and alias_score >= similarity_threshold:
                    highest_score = alias_score
                    best_match = rx
                    matched_word = token

    if best_match and highest_score >= similarity_threshold:
        return {
            "matched_rx": best_match,
            "target_drug": best_match["drug_name"],
            "strength": best_match.get("strength", ""),
            "confidence": round(highest_score, 3),
            "clarification_prompt": f"Did you mean your {best_match['drug_name']} {best_match.get('strength', '')}?",
            "voiced_token": matched_word,
            "repair_type": "FUZZY_PHONETIC_REPAIR"
        }

    return None
