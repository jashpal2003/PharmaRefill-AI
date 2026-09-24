"""
create_staff_user.py — Create or update a pharmacy staff login in Supabase Auth.
Usage:  python scripts/create_staff_user.py <email> <admin|pharmacist|technician|intern> [--password P] [--name "Full Name"]
If --password is omitted for a new user, a strong random password is generated and printed once.
"""

import argparse
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.staff_admin import find_by_email, upsert_staff


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("email")
    ap.add_argument("role", choices=["admin", "pharmacist", "technician", "intern"])
    ap.add_argument("--password")
    ap.add_argument("--name")
    a = ap.parse_args()
    pw = a.password
    if not pw and not find_by_email(a.email):
        pw = secrets.token_urlsafe(14)
    user = upsert_staff(a.email, a.role, pw, a.name)
    print(f"{user['email']}  role={user['role']}  id={user['id']}")
    if pw and not a.password:
        print(f"Generated password (shown once): {pw}")


if __name__ == "__main__":
    main()
