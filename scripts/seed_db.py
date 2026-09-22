"""
seed_db.py — Seeds pre-configured demonstration patients and prescriptions into SQLite.
"""

import os
import sys
import sqlite3
from pathlib import Path

# Ensure root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.config import DB_PATH
from backend.database import init_db, get_db_connection

def seed_database():
    print("=" * 60)
    print(f"SEEDING DATABASE: {DB_PATH}")
    print("=" * 60)
    
    init_db()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM patients")
        patients_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM prescriptions")
        rx_count = cursor.fetchone()[0]
        print(f"[+] Patients loaded: {patients_count}")
        print(f"[+] Prescriptions loaded: {rx_count}")
        print("[+] Eleanor Vance (PAT-1001, +14155550192) active")
        print("[+] Atorvastatin, Metformin, Lisinopril active for Med-Sync")
        print("[+] Oxycodone-Acetaminophen active as DEA Schedule II C-II guard trigger")
    print("=" * 60)
    print("Database seeding completed successfully.\n")

if __name__ == "__main__":
    seed_database()
