"""
Configuration and Environment Settings for PharmaRefill AI (RxTriage).
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="allow")
    # App Settings
    APP_NAME: str = "PharmaRefill AI (RxTriage)"
    APP_VERSION: str = "2.0.0-PROD"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Paths
    DATABASE_PATH: str = str(BASE_DIR / "pharma_records.db")
    
    # AssemblyAI Configuration
    ASSEMBLYAI_API_KEY: str = os.getenv("ASSEMBLYAI_API_KEY", "")
    ASSEMBLYAI_V3_WS_URL: str = "wss://streaming.assemblyai.com/v3/realtime"
    ASSEMBLYAI_V2_WS_URL: str = "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000"
    
    # Cartesia / TTS Configuration
    CARTESIA_API_KEY: str = os.getenv("CARTESIA_API_KEY", "")
    CARTESIA_VOICE_ID: str = "794f9389-aac1-45b6-b726-9d9369183238"  # Calm, warm healthcare voice
    SPEECH_PACING: float = 0.92  # 0.92x geriatric intake cadence
    
    # Twilio Telephony / SMS
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.getenv("TWILIO_PHONE_NUMBER", "+15550190000")
    
    # Pharmacy Default Station
    PHARMACY_NAME: str = "Community Care Pharmacy"
    PHARMACY_PHONE: str = "+1 (415) 555-0192"
    ACTIVE_STATION: str = "Dispense Counter 1"



settings = Settings()
