"""
formulary.py — Curated FDA Top 300 Pharmaceuticals and Clinical Nouns.
Used for AssemblyAI Word Boost (`word_boost`) and Universal Streaming Keyterms Prompt (`keyterms_prompt`).
"""
from typing import List, Dict, Optional
import difflib

# Curated FDA Top 300 Generic & Brand Medications + Pharmacy Operational Nouns
PHARMA_KEYTERMS: List[str] = [
    # Top 50 High-Volume Chronic / Maintenance Drugs
    "Atorvastatin", "Atorvastatin Calcium", "Lipitor",
    "Levothyroxine", "Levothyroxine Sodium", "Synthroid",
    "Lisinopril", "Prinivil", "Zestril",
    "Metformin", "Metformin HCl", "Glucophage",
    "Amlodipine", "Amlodipine Besylate", "Norvasc",
    "Metoprolol", "Metoprolol Succinate", "Metoprolol Tartrate", "Toprol XL",
    "Omeprazole", "Prilosec",
    "Losartan", "Losartan Potassium", "Cozaar",
    "Albuterol", "Albuterol Sulfate", "ProAir", "Ventolin",
    "Gabapentin", "Neurontin",
    "Hydrochlorothiazide", "Microzide", "HCTZ",
    "Sertraline", "Sertraline HCl", "Zoloft",
    "Simvastatin", "Zocor",
    "Montelukast", "Montelukast Sodium", "Singulair",
    "Escitalopram", "Lexapro",
    "Rosuvastatin", "Crestor",
    "Bupropion", "Wellbutrin",
    "Furosemide", "Lasix",
    "Pantoprazole", "Protonix",
    "Duloxetine", "Cymbalta",
    "Prednisone", "Deltasone",
    "Tamsulosin", "Flomax",
    "Citalopram", "Celexa",
    "Doxycycline", "Vibramycin",
    "Meloxicam", "Mobic",
    "Fluoxetine", "Prozac",
    "Carvedilol", "Coreg",
    "Trazodone", "Desyrel",
    "Warfarin", "Coumadin", "Jantoven",
    "Clopidogrel", "Plavix",
    "Spironolactone", "Aldactone",
    "Potassium Chloride", "Klor-Con",
    "Glipizide", "Glucotrol",
    "Lantus", "Insulin Glargine", "Humalog", "NovoLog",
    "Famotidine", "Pepcid",
    "Cyclobenzaprine", "Flexeril",
    "Venlafaxine", "Effexor",
    "Allopurinol", "Zyloprim",
    "Finasteride", "Proscar", "Propecia",
    "Buspirone", "Buspar",
    
    # Schedule II-V Controlled Substances (Critical for DEA Hard Gatekeeper)
    "Oxycodone", "Oxycodone-Acetaminophen", "Percocet", "OxyContin",
    "Hydrocodone", "Hydrocodone-Acetaminophen", "Norco", "Vicodin",
    "Amphetamine", "Dextroamphetamine", "Adderall", "Adderall XR",
    "Methylphenidate", "Ritalin", "Concerta",
    "Alprazolam", "Xanax",
    "Clonazepam", "Klonopin",
    "Lorazepam", "Ativan",
    "Diazepam", "Valium",
    "Zolpidem", "Ambien",
    "Tramadol", "Ultram",
    "Codeine", "Tylenol with Codeine",
    "Buprenorphine", "Suboxone",
    "Pregabalin", "Lyrica",
    
    # Clinical, Formulary, and Adjudication Terminology
    "Prescription", "Refill", "Med-Sync", "Medication Synchronization",
    "Copay", "Co-pay", "Deductible", "Prior Authorization",
    "Adjudication", "Return to Stock", "Formulary", "National Drug Code",
    "Dosage", "Milligram", "Microgram", "Tablet", "Capsule", "Inhaler",
    "Drive-thru", "Pharmacist", "Prescriber", "NPI", "DEA Schedule",
    "Eleanor Vance", "Robert Chen", "Community Care Pharmacy"
]

def get_word_boost_list() -> List[str]:
    """Returns unique deduplicated word boost array."""
    return list(dict.fromkeys(PHARMA_KEYTERMS))

def get_keyterms_prompt() -> str:
    """Returns comma-separated keyterms prompt string for AssemblyAI v3."""
    return ", ".join(get_word_boost_list()[:150])

def find_best_medication_match(query: str, candidates: List[str], cutoff: float = 0.6) -> Optional[str]:
    """Fuzzy matches spoken drug names against known pharmacy formulary."""
    query_clean = query.strip().lower()
    candidate_map = {c.lower(): c for c in candidates}
    
    # 1. Exact or substring match
    for cand_lower, cand_original in candidate_map.items():
        if query_clean in cand_lower or cand_lower in query_clean:
            return cand_original
            
    # 2. Levenshtein ratio match
    matches = difflib.get_close_matches(query_clean, candidate_map.keys(), n=1, cutoff=cutoff)
    if matches:
        return candidate_map[matches[0]]
    return None
