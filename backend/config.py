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

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
PHARMACY_NAME = "Community Care Pharmacy"
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
