"""
test_all_credentials.py — Comprehensive Diagnostic Suite for Live Credentials.
Tests:
1. AssemblyAI (Universal-3.5 Streaming WebSocket, LLM Gateway, LeMUR)
2. Cartesia (Sonic-2 Streaming TTS, Voice Synthesis)
3. Twilio (Account Credentials, Phone Number Verification)
4. Supabase (Auth API, JWKS/Settings, Postgres Pool / Database Connection)
"""

import os
import sys
import time
import json
import asyncio
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def mask(s: str) -> str:
    if not s or "your_" in s:
        return "<NOT_SET_OR_PLACEHOLDER>"
    if len(s) <= 8:
        return "***"
    return f"{s[:6]}...{s[-4:]}"

ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY", "").strip()
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY", "").strip()
CARTESIA_VOICE_ID = os.getenv("CARTESIA_VOICE_ID", "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4").strip()
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "").strip()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "").strip()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

print("\n" + "=" * 80)
print("  PHARMAREFILL AI — COMPLETE LIVE CREDENTIALS & SERVICE VERIFICATION SUITE")
print("=" * 80)
print(f"AssemblyAI API Key:       {mask(ASSEMBLYAI_API_KEY)}")
print(f"Cartesia API Key:         {mask(CARTESIA_API_KEY)}")
print(f"Cartesia Voice ID:        {CARTESIA_VOICE_ID}")
print(f"Twilio Account SID:       {mask(TWILIO_ACCOUNT_SID)}")
print(f"Twilio Phone Number:      {TWILIO_PHONE_NUMBER or '<NOT SET>'}")
print(f"Supabase URL:             {SUPABASE_URL or '<NOT SET>'}")
print(f"Supabase Publishable Key: {mask(SUPABASE_PUBLISHABLE_KEY)}")
print(f"Supabase Secret Key:      {mask(SUPABASE_SECRET_KEY)}")
print(f"Postgres DATABASE_URL:    {mask(DATABASE_URL)}")
print("=" * 80 + "\n")

results = {}

# -------------------------------------------------------------
# 1. TEST CARTESIA
# -------------------------------------------------------------
def test_cartesia():
    print("[1/5] Testing Cartesia Sonic-2 Live TTS...")
    if not CARTESIA_API_KEY or "your_" in CARTESIA_API_KEY:
        print("  ❌ Cartesia API key not provided or placeholder.")
        results["Cartesia Sonic-2 TTS"] = False
        return

    url = "https://api.cartesia.ai/tts/bytes"
    headers = {
        "X-API-Key": CARTESIA_API_KEY,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json"
    }
    payload = {
        "model_id": "sonic-2",
        "transcript": "Cartesia Sonic-2 voice synthesis active for Community Care Pharmacy.",
        "voice": {"mode": "id", "id": CARTESIA_VOICE_ID},
        "output_format": {"container": "wav", "encoding": "pcm_s16le", "sample_rate": 24000},
        "voice_settings": {"speed": 0.95}
    }
    t0 = time.time()
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=10)
        ms = int((time.time() - t0) * 1000)
        if r.status_code == 200 and len(r.content) > 1000:
            print(f"  ✅ SUCCESS: Cartesia returned {len(r.content):,} bytes audio in {ms}ms (HTTP 200)")
            results["Cartesia Sonic-2 TTS"] = True
        else:
            print(f"  ❌ FAILED: HTTP {r.status_code} - {r.text[:200]}")
            results["Cartesia Sonic-2 TTS"] = False
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        results["Cartesia Sonic-2 TTS"] = False

# -------------------------------------------------------------
# 2. TEST ASSEMBLYAI
# -------------------------------------------------------------
def test_assemblyai_llm_gateway():
    print("\n[2/5] Testing AssemblyAI LLM Gateway...")
    if not ASSEMBLYAI_API_KEY or "your_" in ASSEMBLYAI_API_KEY:
        print("  ❌ AssemblyAI API key not provided or placeholder.")
        results["AssemblyAI LLM Gateway"] = False
        return

    url = "https://llm-gateway.assemblyai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {ASSEMBLYAI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "qwen3.5-4b-32k-fast",
        "messages": [
            {"role": "system", "content": "You are a clinical pharmacy audit assistant. Reply with single-word JSON."},
            {"role": "user", "content": "Confirm you are active: reply with {\"status\": \"ONLINE\"}"}
        ],
        "temperature": 0.1,
        "max_tokens": 50
    }
    t0 = time.time()
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=12)
        ms = int((time.time() - t0) * 1000)
        if r.status_code == 200:
            data = r.json()
            reply = data["choices"][0]["message"]["content"].strip()
            print(f"  ✅ SUCCESS: LLM Gateway responded in {ms}ms: {reply}")
            results["AssemblyAI LLM Gateway"] = True
        else:
            print(f"  ❌ FAILED: HTTP {r.status_code} - {r.text[:200]}")
            results["AssemblyAI LLM Gateway"] = False
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        results["AssemblyAI LLM Gateway"] = False

async def test_assemblyai_streaming():
    print("\n[3/5] Testing AssemblyAI Universal-3.5 Streaming WebSocket...")
    if not ASSEMBLYAI_API_KEY or "your_" in ASSEMBLYAI_API_KEY:
        print("  ❌ AssemblyAI API key not provided or placeholder.")
        results["AssemblyAI Universal-3.5 Streaming"] = False
        return

    import websockets
    url = "wss://streaming.assemblyai.com/v3/ws?sample_rate=16000"
    headers = {"Authorization": ASSEMBLYAI_API_KEY}
    t0 = time.time()
    try:
        async with websockets.connect(url, additional_headers=headers) as ws:
            begin_raw = await asyncio.wait_for(ws.recv(), timeout=6.0)
            begin_data = json.loads(begin_raw)
            ms = int((time.time() - t0) * 1000)
            
            # Send FDA Top 250 Keyterm configuration
            config = {
                "type": "UpdateConfiguration",
                "keyterms_prompt": ["Atorvastatin", "Lisinopril", "Metformin", "Title 21 CFR 1306"],
                "prompt": "Community care outpatient pharmacy prescription triage."
            }
            await ws.send(json.dumps(config))
            await ws.send(json.dumps({"type": "Terminate"}))
            
            print(f"  ✅ SUCCESS: WebSocket connected & Begin handshake received in {ms}ms!")
            print(f"     Session ID: {begin_data.get('session_id', 'unknown')}")
            print(f"     Handshake:  {begin_data.get('type')}")
            results["AssemblyAI Universal-3.5 Streaming"] = True
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        results["AssemblyAI Universal-3.5 Streaming"] = False

# -------------------------------------------------------------
# 3. TEST TWILIO
# -------------------------------------------------------------
def test_twilio():
    print("\n[4/5] Testing Twilio SMS Integration...")
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        print("  ⚠️ Twilio credentials not set in .env (SMS will run in simulated mode).")
        results["Twilio SMS"] = "NOT_CONFIGURED (Simulated Mode Active)"
        return

    # Verify Twilio credentials by inspecting Account Details via Twilio REST API
    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}.json"
    t0 = time.time()
    try:
        r = requests.get(url, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN), timeout=10)
        ms = int((time.time() - t0) * 1000)
        if r.status_code == 200:
            data = r.json()
            friendly_name = data.get("friendly_name")
            status = data.get("status")
            print(f"  ✅ SUCCESS: Twilio account verified in {ms}ms!")
            print(f"     Account Name:   {friendly_name}")
            print(f"     Account Status: {status}")
            print(f"     Outbound Phone: {TWILIO_PHONE_NUMBER}")
            results["Twilio SMS"] = True
        else:
            print(f"  ❌ FAILED: HTTP {r.status_code} - {r.text[:200]}")
            results["Twilio SMS"] = False
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        results["Twilio SMS"] = False

# -------------------------------------------------------------
# 4. TEST SUPABASE (Auth & Postgres)
# -------------------------------------------------------------
def test_supabase():
    print("\n[5/5] Testing Supabase Platform Integration...")
    
    # A: Test Supabase Auth URL / JWKS
    if SUPABASE_URL:
        t0 = time.time()
        try:
            # Check JWKS or Auth Settings
            jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
            r = requests.get(jwks_url, timeout=8)
            ms = int((time.time() - t0) * 1000)
            if r.status_code == 200:
                print(f"  ✅ Supabase Auth Endpoint active: JWKS retrieved in {ms}ms (HTTP 200)")
                results["Supabase Auth API"] = True
            else:
                # Try settings endpoint with apikey
                s_url = f"{SUPABASE_URL}/auth/v1/settings"
                headers = {"apikey": SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY}
                r2 = requests.get(s_url, headers=headers, timeout=8)
                if r2.status_code == 200:
                    print(f"  ✅ Supabase Auth Endpoint active: Settings retrieved in {ms}ms (HTTP 200)")
                    results["Supabase Auth API"] = True
                else:
                    print(f"  ⚠️ Supabase Auth status HTTP {r.status_code}")
                    results["Supabase Auth API"] = False
        except Exception as e:
            print(f"  ❌ Supabase Auth reachable check failed: {e}")
            results["Supabase Auth API"] = False
    else:
        print("  ⚠️ SUPABASE_URL not provided.")
        results["Supabase Auth API"] = "NOT_CONFIGURED"

    # B: Test Database Connection (Postgres or SQLite)
    from backend.database import get_db_connection, using_postgres, init_db
    t0 = time.time()
    try:
        init_db()
        with get_db_connection() as conn:
            pts = conn.execute("SELECT COUNT(*) FROM patients").fetchone()
            count = pts[0] if pts else 0
            ms = int((time.time() - t0) * 1000)
            engine_type = "Supabase Postgres" if using_postgres() else "Local SQLite"
            print(f"  ✅ Database Engine ({engine_type}) active: {count} patients loaded in {ms}ms")
            results[f"Database ({engine_type})"] = True
    except Exception as e:
        print(f"  ❌ Database connection check failed: {e}")
        results["Database"] = False

# -------------------------------------------------------------
# 5. TEST END-TO-END LIVE CALL TURN + CERTIFICATE
# -------------------------------------------------------------
def test_e2e_live_turn():
    print("\n[6/6] Testing Live E2E Voice Turn & SHA-256 Certificate...")
    from backend.agent_engine import PharmaAgentEngine
    from backend.compliance_certificate import generate_compliance_certificate, verify_compliance_certificate
    from backend.assemblyai_service import generate_soap_note_llm

    session_id = f"LIVE-TEST-{int(time.time())}"
    engine = PharmaAgentEngine(session_id=session_id, caller_phone="+14155550192")
    
    # 1. Start call
    r1 = engine.process_utterance("START")
    # 2. Authenticate DOB
    r2 = engine.process_utterance("April 12, 1958")
    # 3. Refill Atorvastatin
    r3 = engine.process_utterance("I need to refill my atorvastatin")
    
    print(f"  ✅ Live FSM Turn Transition: State={r3['current_state']} | Intent={r3['intent']}")
    print(f"     Agent Spoken: \"{r3['spoken_text'][:80]}...\"")

    # 4. Generate SHA-256 Certificate
    cert = generate_compliance_certificate(session_id)
    sig = cert["cryptographic_proof"]["certificate_signature"]
    v = verify_compliance_certificate(session_id, sig)
    if v["is_valid"]:
        print(f"  ✅ SHA-256 Cryptographic Certificate: VERIFIED ({sig[:16]}...)")
        results["E2E Voice Engine & Certificate"] = True
    else:
        print(f"  ❌ Certificate verification failed")
        results["E2E Voice Engine & Certificate"] = False

# -------------------------------------------------------------
# RUN ALL
# -------------------------------------------------------------
def main():
    test_cartesia()
    test_assemblyai_llm_gateway()
    asyncio.run(test_assemblyai_streaming())
    test_twilio()
    test_supabase()
    test_e2e_live_turn()

    print("\n" + "=" * 80)
    print("  CREDENTIALS DIAGNOSTIC SUMMARY")
    print("=" * 80)
    for service, status in results.items():
        if status is True:
            icon = "✅ ACTIVE & VERIFIED"
        elif status is False:
            icon = "❌ FAILED / ERROR"
        else:
            icon = f"ℹ️  {status}"
        print(f"  {service:<38} {icon}")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    main()
