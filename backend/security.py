"""
backend/security.py — Token auth, role-based access control and the HIPAA access log.

Two kinds of bearer credentials are accepted (`Authorization: Bearer <token>`, or `?token=` for WebSockets):
  1. Supabase Auth access tokens (staff logins). Verified locally against the project's JWKS (ES256/RS256),
     audience "authenticated". The role comes from app_metadata.rxtriage_role, which only the service
     (secret) key can set, so users cannot grant themselves a role.
  2. Static service tokens from RXTRIAGE_AUTH_TOKENS="role:token,..." for scripts and tests.
When neither is configured the server runs in local dev mode as 'admin' and says so loudly.
"""

import asyncio
import logging
import re
from typing import Optional, Tuple

import jwt

from backend.config import AUTH_TOKENS, SUPABASE_JWKS_URL, SUPABASE_URL
from backend.database import get_db_connection

logger = logging.getLogger("security")

ROLES = ("admin", "pharmacist", "technician", "intern")
PATIENT_ID_RE = re.compile(r"PAT-\d+")

# (method or "*", path prefix) -> roles allowed. First match wins; default is any authenticated role.
POLICY = [
    ("POST", "/api/reset-demo", {"admin"}),
    ("*", "/api/admin", {"admin"}),
    ("GET", "/api/audit-log", {"admin"}),
    ("POST", "/api/orders/dispense-all", {"admin", "pharmacist"}),
    ("POST", "/api/dur/override", {"admin", "pharmacist"}),
    ("*", "/api/pa", {"admin", "pharmacist", "technician"}),
    ("POST", "/api/immunizations", {"admin", "pharmacist"}),
    ("POST", "/api/outreach", {"admin", "pharmacist"}),
    ("POST", "/api/generic-substitution", {"admin", "pharmacist"}),
    ("POST", "/api/billing", {"admin", "pharmacist", "technician"}),
    ("POST", "/api/sms", {"admin", "pharmacist", "technician"}),
]
READ_ONLY_ROLES = {"intern"}
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


AUTH_ENABLED = bool(AUTH_TOKENS or SUPABASE_JWKS_URL)
_jwks_client = jwt.PyJWKClient(SUPABASE_JWKS_URL, cache_keys=True, lifespan=3600) if SUPABASE_JWKS_URL else None


def verify_supabase_jwt(token: str) -> Optional[dict]:
    if not _jwks_client or token.count(".") != 2:
        return None
    try:
        key = _jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(token, key.key, algorithms=["ES256", "RS256"], audience="authenticated",
                          issuer=f"{SUPABASE_URL}/auth/v1", options={"require": ["exp", "sub"]})
    except Exception as e:
        logger.info("JWT rejected: %s", e)
        return None


def resolve_identity(token: Optional[str]) -> Optional[dict]:
    """Returns {"role", "user_id", "email"} for a valid credential, else None."""
    if not AUTH_ENABLED:
        return {"role": "admin", "user_id": None, "email": None}  # dev mode
    if not token:
        return None
    token = token.strip()
    if token in AUTH_TOKENS:
        return {"role": AUTH_TOKENS[token], "user_id": f"service:{AUTH_TOKENS[token]}", "email": None}
    claims = verify_supabase_jwt(token)
    if not claims:
        return None
    role = (claims.get("app_metadata") or {}).get("rxtriage_role")
    if role not in ROLES:
        return None  # authenticated but not provisioned as staff
    return {"role": role, "user_id": claims["sub"], "email": claims.get("email")}


def resolve_role(token: Optional[str]) -> Optional[str]:
    ident = resolve_identity(token)
    return ident["role"] if ident else None


def is_allowed(role: str, method: str, path: str) -> bool:
    for m, prefix, roles in POLICY:
        if (m == "*" or m == method) and path.startswith(prefix):
            return role in roles
    if role in READ_ONLY_ROLES and method not in ("GET", "HEAD", "OPTIONS"):
        return path.startswith("/api/call/")  # interns may still run the call simulator
    return True


def masks_phi(role: str) -> bool:
    return role in ("technician", "intern")


def mask_patient(p: dict) -> dict:
    out = dict(p)
    if out.get("dob"):
        out["dob"] = "****-" + out["dob"][5:7] + "-**"
    if out.get("primary_phone"):
        out["primary_phone"] = "***-***-" + out["primary_phone"][-4:]
    if out.get("street_address"):
        out["street_address"] = "[redacted]"
    if out.get("insurance_member_id"):
        out["insurance_member_id"] = "****" + out["insurance_member_id"][-4:]
    return out


def write_access_log(role: str, method: str, path: str, query: str, status: int, client_ip: str,
                     ident: Optional[dict] = None):
    m = PATIENT_ID_RE.search(path) or PATIENT_ID_RE.search(query or "")
    ident = ident or {}
    try:
        with get_db_connection() as conn:
            conn.execute(
                "INSERT INTO access_log (role, user_id, user_email, method, path, patient_id, status_code, client_ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (role, ident.get("user_id"), ident.get("email"), method, path, m.group(0) if m else None, status, client_ip),
            )
            conn.commit()
    except Exception as e:  # never let logging take the API down, but make failures visible
        logger.error("access_log write failed: %s", e)


def _extract_token(scope) -> Optional[str]:
    headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
    auth = headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:]
    if headers.get("x-api-key"):
        return headers["x-api-key"]
    qs = scope.get("query_string", b"").decode()
    m = re.search(r"(?:^|&)token=([^&]+)", qs)
    return m.group(1) if m else None


class SecurityMiddleware:
    """Pure ASGI middleware so it covers both HTTP and WebSocket routes."""

    def __init__(self, app):
        self.app = app
        if not AUTH_ENABLED:
            logger.warning("No Supabase Auth or RXTRIAGE_AUTH_TOKENS configured: API is running WITHOUT authentication (dev mode).")

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)

        path = scope.get("path", "")
        method = scope.get("method", "WS") if scope["type"] == "http" else "WS"
        if method == "OPTIONS" or path in PUBLIC_PATHS:
            return await self.app(scope, receive, send)

        ident = await asyncio.to_thread(resolve_identity, _extract_token(scope))
        role = ident["role"] if ident else None
        client_ip = (scope.get("client") or ("?", 0))[0]
        query = scope.get("query_string", b"").decode()

        if scope["type"] == "websocket":
            if role is None:
                await asyncio.to_thread(write_access_log, "anonymous", "WS", path, "", 4401, client_ip)
                await send({"type": "websocket.close", "code": 4401})
                return
            scope.setdefault("state", {}).update(role=role, identity=ident)
            await asyncio.to_thread(write_access_log, role, "WS", path, "", 101, client_ip, ident)
            return await self.app(scope, receive, send)

        if role is None or not is_allowed(role, method, path):
            status = 401 if role is None else 403
            await asyncio.to_thread(write_access_log, role or "anonymous", method, path, query, status, client_ip)
            body = b'{"detail":"Unauthorized"}' if status == 401 else b'{"detail":"Forbidden for role"}'
            await send({"type": "http.response.start", "status": status,
                        "headers": [(b"content-type", b"application/json")]})
            await send({"type": "http.response.body", "body": body})
            return

        scope.setdefault("state", {}).update(role=role, identity=ident)
        status_holder = {"code": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["code"] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            if path.startswith("/api/"):
                await asyncio.to_thread(write_access_log, role, method, path, query, status_holder["code"], client_ip, ident)
