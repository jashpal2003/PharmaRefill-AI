import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY", "")
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY", "")
CARTESIA_VOICE_ID = os.getenv("CARTESIA_VOICE_ID", "47c38ca4-5f35-497b-b1a3-415245fb35e1")  # Daniel - Modern Assistant
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "+15550190000")
DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "pharma_records.db"))

# Bind to loopback by default; set HOST=0.0.0.0 only behind auth + TLS.
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))
PHARMACY_NAME = "Community Care Pharmacy"

# Comma-separated allowlist of dashboard origins.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]

# Role-bound API tokens: "role:token,role:token". Roles: admin, pharmacist, technician, intern.
# When empty, the API runs in local dev mode (no auth) and logs a warning at startup.
AUTH_TOKENS = {}
for _pair in os.getenv("RXTRIAGE_AUTH_TOKENS", "").split(","):
    if ":" in _pair:
        _role, _tok = _pair.split(":", 1)
        if _tok.strip():
            AUTH_TOKENS[_tok.strip()] = _role.strip().lower()

# LLM used for SOAP notes and post-call audits (AssemblyAI LLM Gateway, OpenAI-compatible).
LLM_GATEWAY_URL = os.getenv("LLM_GATEWAY_URL", "https://llm-gateway.assemblyai.com/v1/chat/completions")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen3.5-4b-32k-fast")
ACTIVE_STATION = "Counter 1"

# Top high-frequency pharmaceutical entities for AssemblyAI Word Boost / Keyterms
FDA_WORD_BOOST = [
    "Atorvastatin", "Levothyroxine", "Lisinopril", "Metformin", "Amlodipine",
    "Metoprolol", "Omeprazole", "Losartan", "Albuterol", "Gabapentin",
    "Hydrochlorothiazide", "Sertraline", "Simvastatin", "Montelukast", "Escitalopram",
    "Rosuvastatin", "Bupropion", "Furosemide", "Pantoprazole", "Duloxetine",
    "Prednisone", "Tamsulosin", "Citalopram", "Amphetamine", "Doxycycline",
    "Oxycodone", "Hydrocodone", "Acetaminophen", "Ezetimibe", "Clopidogrel",
    "Meloxicam", "Fluoxetine", "Carvedilol", "Trazodone", "Warfarin",
    "Spironolactone", "Potassium Chloride", "Glipizide", "Famotidine", "Cyclobenzaprine",
    "Venlafaxine", "Allopurinol", "Finasteride", "Buspirone", "Zolpidem",
    "Tramadol", "Codeine", "Buprenorphine", "Pregabalin", "Singulair",
    "Co-pay", "Prior Authorization", "Medicare Part D", "Med-Sync", "Dispense"
]
