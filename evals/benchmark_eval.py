"""
evals/benchmark_eval.py — Drug-name WER benchmark for AssemblyAI word boost.

Two modes:
  LIVE_AUDIO  evals/audio/manifest.json lists local audio clips + ground truth. Each clip is transcribed
              twice through AssemblyAI (with and without FDA word boost) and WER / entity recall are measured.
  REFERENCE   No manifest or no API key. Scores the illustrative transcripts below. These are NOT
              measurements and the response says so.

Manifest format: [{"file": "clip1.wav", "ground_truth": "...", "key_entities": ["Atorvastatin"]}, ...]
Run:  python -m evals.benchmark_eval
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.config import ASSEMBLYAI_API_KEY, FDA_WORD_BOOST

AUDIO_DIR = Path(__file__).resolve().parent / "audio"
MANIFEST = AUDIO_DIR / "manifest.json"

REFERENCE_DATASET = [
    {"ground_truth": "Refill Hydrochlorothiazide 25 milligram tablet for Eleanor Vance",
     "baseline_output": "Refill hydro chlorine thiazide 25 milligram tablet for Eleanor Vance",
     "boosted_output": "Refill Hydrochlorothiazide 25 milligram tablet for Eleanor Vance",
     "key_entities": ["Hydrochlorothiazide"]},
    {"ground_truth": "I need my Atorvastatin Calcium and Metformin prescription refilled",
     "baseline_output": "I need my a tour of a statin calcium and met form in prescription refilled",
     "boosted_output": "I need my Atorvastatin Calcium and Metformin prescription refilled",
     "key_entities": ["Atorvastatin", "Metformin"]},
    {"ground_truth": "Calling about Oxycodone Acetaminophen Schedule 2 controlled medication",
     "baseline_output": "Calling about oxy co done a set a min o fen schedule to controlled medication",
     "boosted_output": "Calling about Oxycodone Acetaminophen Schedule 2 controlled medication",
     "key_entities": ["Oxycodone", "Acetaminophen"]},
    {"ground_truth": "Please check if my Singulair Montelukast Sodium ten milligrams is ready",
     "baseline_output": "Please check if my sing you lair monte loo cast sodium 10 milligrams is ready",
     "boosted_output": "Please check if my Singulair Montelukast Sodium 10 milligrams is ready",
     "key_entities": ["Singulair", "Montelukast"]},
    {"ground_truth": "My cardiologist increased my Lisinopril and Metoprolol Succinate dosage",
     "baseline_output": "My cardiologist increased my listen oh pril and metal pro lol suck senate dosage",
     "boosted_output": "My cardiologist increased my Lisinopril and Metoprolol Succinate dosage",
     "key_entities": ["Lisinopril", "Metoprolol"]},
]

NUMBER_WORDS = {"zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6",
                "seven": "7", "eight": "8", "nine": "9", "ten": "10", "twenty": "20", "fifty": "50", "hundred": "100"}


def normalize(text: str) -> List[str]:
    words = re.sub(r"[^\w\s]", " ", text.lower()).split()
    return [NUMBER_WORDS.get(w, w) for w in words]


def calculate_word_error_rate(reference: str, hypothesis: str) -> float:
    r, h = normalize(reference), normalize(hypothesis)
    d = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        d[i][0] = i
    for j in range(len(h) + 1):
        d[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    return d[len(r)][len(h)] / len(r) if r else 0.0


def entity_recall(entities: List[str], hypothesis: str) -> float:
    hyp = " ".join(normalize(hypothesis))
    return sum(1 for e in entities if " ".join(normalize(e)) in hyp) / len(entities) if entities else 1.0


def _transcribe(path: Path, boosted: bool) -> str:
    import assemblyai as aai
    aai.settings.api_key = ASSEMBLYAI_API_KEY
    cfg = aai.TranscriptionConfig(word_boost=FDA_WORD_BOOST, boost_param="high") if boosted else aai.TranscriptionConfig()
    t = aai.Transcriber().transcribe(str(path), config=cfg)
    if t.status == aai.TranscriptStatus.error:
        raise RuntimeError(t.error)
    return t.text or ""


def _load_cases() -> (List[Dict], str):
    if MANIFEST.exists() and ASSEMBLYAI_API_KEY:
        cases = []
        for item in json.loads(MANIFEST.read_text(encoding="utf-8")):
            path = AUDIO_DIR / item["file"]
            if not path.exists():
                continue
            cases.append({**item, "baseline_output": _transcribe(path, False), "boosted_output": _transcribe(path, True)})
        if cases:
            return cases, "LIVE_AUDIO"
    return REFERENCE_DATASET, "REFERENCE"


def run_benchmark(verbose: bool = False) -> Dict:
    cases, mode = _load_cases()
    rows = []
    for i, c in enumerate(cases, 1):
        rows.append({
            "id": i, "ground_truth": c["ground_truth"],
            "baseline_output": c["baseline_output"], "boosted_output": c["boosted_output"],
            "baseline_wer": round(calculate_word_error_rate(c["ground_truth"], c["baseline_output"]) * 100, 1),
            "boosted_wer": round(calculate_word_error_rate(c["ground_truth"], c["boosted_output"]) * 100, 1),
            "baseline_entity_recall": round(entity_recall(c.get("key_entities", []), c["baseline_output"]) * 100, 1),
            "boosted_entity_recall": round(entity_recall(c.get("key_entities", []), c["boosted_output"]) * 100, 1),
        })
    avg = lambda k: round(sum(r[k] for r in rows) / len(rows), 1) if rows else 0.0
    result = {
        "mode": mode,
        "is_measured": mode == "LIVE_AUDIO",
        "disclaimer": None if mode == "LIVE_AUDIO" else
        "REFERENCE mode: illustrative transcripts, not measured. Add audio + evals/audio/manifest.json and an ASSEMBLYAI_API_KEY to measure.",
        "dataset_name": "Drug-name speech benchmark" + (" (live audio)" if mode == "LIVE_AUDIO" else " (reference transcripts)"),
        "samples": len(rows),
        "metrics": {
            "baseline_no_boost": {"label": "AssemblyAI (no boost)", "wer_percentage": avg("baseline_wer"),
                                  "drug_name_precision": avg("baseline_entity_recall")},
            "boosted_assemblyai": {"label": "AssemblyAI + word boost", "wer_percentage": avg("boosted_wer"),
                                   "drug_name_precision": avg("boosted_entity_recall")},
        },
        "wer_reduction_absolute": round(avg("baseline_wer") - avg("boosted_wer"), 1),
        "sample_cases": rows,
    }
    if verbose:
        print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    run_benchmark(verbose=True)
