"""
simulate_call.py — Interactive CLI testing suite for PharmaRefill AI.
Tests clinical conversational flows without placing real telephone calls.
Usage:
    python scripts/simulate_call.py happy_path
    python scripts/simulate_call.py dea_block
    python scripts/simulate_call.py emergency
"""

import sys
import os
from pathlib import Path

# Ensure root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.config import DB_PATH
from backend.state_machine import PharmacyStateMachine, AgentState

def simulate_flow(scenario: str):
    session_id = f"SIM-{scenario.upper()}"
    caller_phone = "+14155550192"  # Eleanor Vance
    sm = PharmacyStateMachine(session_id, caller_phone, DB_PATH)

    print(f"\n=======================================================")
    print(f"RUNNING SCENARIO: {scenario.upper()}")
    print(f"=======================================================")

    # Initial Turn: Consent & Greeting
    resp = sm.process_utterance("START")
    print(f"Agent:  {resp['spoken_text']}\n")

    if scenario == "happy_path":
        turns = [
            "April 12 1958",
            "Yes, please refill my Atorvastatin.",
            "Yes, please sync all three for Friday.",
            "Sounds good, I confirm the copay.",
            "Yes, I will pick it up Friday afternoon."
        ]
    elif scenario == "dea_block":
        turns = [
            "1958",
            "I need a refill on my Oxycodone prescription."
        ]
    elif scenario == "emergency":
        turns = [
            "April 12 1958",
            "I took my medication and my throat feels tight and swollen and I can't breathe!"
        ]
    else:
        print(f"Unknown scenario '{scenario}'. Available: happy_path, dea_block, emergency")
        return

    for user_text in turns:
        print(f"Caller: {user_text}")
        out = sm.process_utterance(user_text)
        print(f"Agent:  {out['spoken_text']}")
        print(f"[State: {out['current_state']} | Escalated: {out['is_escalation']}]\n")
        if out["is_escalation"]:
            print(f"--> Flow terminated via Safety Guardrail ({out.get('escalation_reason')})")
            break

if __name__ == "__main__":
    scenario = sys.argv[1] if len(sys.argv) > 1 else "happy_path"
    simulate_flow(scenario)
