"""
backend/staff_admin.py — Staff account management through the Supabase Auth Admin API.
Roles live in app_metadata.rxtriage_role, which only the secret (service) key can write.
"""

from typing import Any, Dict, List, Optional

import requests

from backend.config import SUPABASE_SECRET_KEY, SUPABASE_URL
from backend.security import ROLES


class StaffAdminError(Exception):
    pass


def _headers() -> Dict[str, str]:
    if not (SUPABASE_URL and SUPABASE_SECRET_KEY):
        raise StaffAdminError("Supabase is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY).")
    return {"apikey": SUPABASE_SECRET_KEY, "Authorization": f"Bearer {SUPABASE_SECRET_KEY}", "Content-Type": "application/json"}


def _summ(u: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": u["id"], "email": u.get("email"), "role": (u.get("app_metadata") or {}).get("rxtriage_role"),
            "full_name": (u.get("user_metadata") or {}).get("full_name"), "last_sign_in_at": u.get("last_sign_in_at"),
            "created_at": u.get("created_at")}


def list_staff() -> List[Dict[str, Any]]:
    r = requests.get(f"{SUPABASE_URL}/auth/v1/admin/users", headers=_headers(), params={"per_page": 200}, timeout=15)
    if r.status_code != 200:
        raise StaffAdminError(f"Supabase admin API {r.status_code}: {r.text[:200]}")
    return [_summ(u) for u in r.json().get("users", [])]


def find_by_email(email: str) -> Optional[Dict[str, Any]]:
    return next((u for u in list_staff() if (u["email"] or "").lower() == email.lower()), None)


def upsert_staff(email: str, role: str, password: Optional[str] = None, full_name: Optional[str] = None) -> Dict[str, Any]:
    if role not in ROLES:
        raise StaffAdminError(f"role must be one of {ROLES}")
    existing = find_by_email(email)
    body: Dict[str, Any] = {"app_metadata": {"rxtriage_role": role}}
    if full_name:
        body["user_metadata"] = {"full_name": full_name}
    if password:
        body["password"] = password
    if existing:
        r = requests.put(f"{SUPABASE_URL}/auth/v1/admin/users/{existing['id']}", headers=_headers(), json=body, timeout=15)
    else:
        if not password:
            raise StaffAdminError("password is required for a new staff account")
        r = requests.post(f"{SUPABASE_URL}/auth/v1/admin/users", headers=_headers(),
                          json={**body, "email": email, "email_confirm": True}, timeout=15)
    if r.status_code not in (200, 201):
        raise StaffAdminError(f"Supabase admin API {r.status_code}: {r.text[:200]}")
    return _summ(r.json())


def delete_staff(user_id: str):
    r = requests.delete(f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}", headers=_headers(), timeout=15)
    if r.status_code not in (200, 204):
        raise StaffAdminError(f"Supabase admin API {r.status_code}: {r.text[:200]}")
