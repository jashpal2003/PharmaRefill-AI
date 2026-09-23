"""
simulate_call.py — CLI conversation runner for the production agent engine.
Usage:
    python scripts/simulate_call.py happy_path | dea_block | emergency | spanish | new_caller
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.agent_engine import PharmaAgentEngine
from backend.database import init_db

SCENARIOS = {
    "happy_path": ("+14155550192", ["April 12, 1958", "Yes, please refill my Atorvastatin.",
                                    "Yes, please sync them for Friday.", "Sounds good, I confirm.",
                                    "Yes, I will pick it up Friday afternoon.", "No, that's all."]),
    "dea_block": ("+14155550192", ["April 12, 1958", "I need a refill on my Oxycodone prescription."]),
    "emergency": ("+14155550192", ["April 12, 1958", "My throat feels tight and I can't breathe!"]),
    "spanish": ("+14155550233", ["15 de agosto de 1974", "Sí, quiero resurtir mi Levothyroxine", "sí", "sí", "sí"]),
    "new_caller": ("+15555550100", ["My name is Robert Chen", "November 20, 1965", "What is my balance?"]),
}


def simulate_flow(scenario: str):
    if scenario not in SCENARIOS:
        print(f"Unknown scenario '{scenario}'. Available: {', '.join(SCENARIOS)}")
        return
    init_db()
    phone, turns = SCENARIOS[scenario]
    engine = PharmaAgentEngine(f"SIM-{scenario.upper()}", phone)
    print(f"\n=== SCENARIO: {scenario.upper()} ===")
    print(f"Agent:  {engine.process_utterance('START')['spoken_text']}\n")
    for text in turns:
        out = engine.process_utterance(text)
        print(f"Caller: {text}\nAgent:  {out['spoken_text']}\n[State: {out['current_state'].value} | Intent: {out['intent']} | Escalated: {out['is_escalation']}]\n")
        if out["is_escalation"] or out.get("end_call"):
            break


if __name__ == "__main__":
    simulate_flow(sys.argv[1] if len(sys.argv) > 1 else "happy_path")
