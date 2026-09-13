import os
import json
import hmac
import secrets
import sqlite3
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Set, Tuple
from pathlib import Path

import backend.config as config
from backend.models.project import Project

# Thread-local storage for SQLite connections
_local = threading.local()

# In-memory failed login tracking for brute-force protection
_failed_login_attempts: Dict[str, List[datetime]] = {}
_failed_login_lock = threading.Lock()
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 300  # 5 minutes lockout

def close_db_connection():
    if hasattr(_local, "conn") and _local.conn is not None:
        try:
            _local.conn.close()
        except Exception:
            pass
        _local.conn = None
        _local.db_path = None

def get_db_connection() -> sqlite3.Connection:
    """Returns a thread-safe SQLite connection with WAL mode enabled."""
    db_path = Path(config.ADMIN_DB_PATH)
    if hasattr(_local, "conn") and _local.conn is not None:
        if getattr(_local, "db_path", None) == str(db_path):
            return _local.conn
        close_db_connection()

    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(
        str(db_path),
        check_same_thread=False,
        timeout=30.0
    )
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for high concurrency
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    _local.conn = conn
    _local.db_path = str(db_path)
    return _local.conn

class AdminService:
    @classmethod
    def init_db(cls):
        """Initializes SQLite schema for administrative persistence and audit logs."""
        conn = get_db_connection()
        with conn:
            # 1. Admin sessions
            conn.execute("""
                CREATE TABLE IF NOT EXISTS admin_sessions (
                    token TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at);")

            # 2. Project Overrides (layered on top of PAIMANA source data)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS admin_overrides (
                    project_id TEXT NOT NULL,
                    field_name TEXT NOT NULL,
                    original_value TEXT,
                    override_value TEXT,
                    updated_by TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    reason TEXT,
                    PRIMARY KEY (project_id, field_name)
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_overrides_project ON admin_overrides(project_id);")

            # 3. Manually added projects
            conn.execute("""
                CREATE TABLE IF NOT EXISTS admin_added_projects (
                    id TEXT PRIMARY KEY,
                    project_json TEXT NOT NULL,
                    created_by TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)

            # 4. Archived projects
            conn.execute("""
                CREATE TABLE IF NOT EXISTS admin_archived_projects (
                    project_id TEXT PRIMARY KEY,
                    archived_by TEXT NOT NULL,
                    archived_at TEXT NOT NULL,
                    reason TEXT
                );
            """)

            # 5. Persistent Audit Log
            conn.execute("""
                CREATE TABLE IF NOT EXISTS admin_audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    admin_user TEXT NOT NULL,
                    action TEXT NOT NULL,
                    project_id TEXT,
                    field_changed TEXT,
                    old_value TEXT,
                    new_value TEXT,
                    reason TEXT,
                    source_type TEXT
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_project ON admin_audit_log(project_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_time ON admin_audit_log(timestamp DESC);")

    # =========================================================================
    # Authentication & Session Management
    # =========================================================================
    @classmethod
    def is_rate_limited(cls, client_id: str) -> bool:
        """Protects against brute-force attacks."""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=LOCKOUT_WINDOW_SECONDS)
        with _failed_login_lock:
            attempts = _failed_login_attempts.get(client_id, [])
            recent = [t for t in attempts if t > cutoff]
            _failed_login_attempts[client_id] = recent
            return len(recent) >= MAX_FAILED_ATTEMPTS

    @classmethod
    def record_failed_attempt(cls, client_id: str):
        now = datetime.now(timezone.utc)
        with _failed_login_lock:
            attempts = _failed_login_attempts.get(client_id, [])
            attempts.append(now)
            _failed_login_attempts[client_id] = attempts

    @classmethod
    def reset_failed_attempts(cls, client_id: str):
        with _failed_login_lock:
            if client_id in _failed_login_attempts:
                del _failed_login_attempts[client_id]

    @classmethod
    def verify_credentials(cls, username: str, password: str) -> bool:
        """Constant-time verification of admin credentials against env config."""
        expected_user = config.ADMIN_USERNAME
        expected_pass = config.ADMIN_PASSWORD
        if not expected_user or not expected_pass:
            return False
        if not username or not password:
            return False
        user_match = hmac.compare_digest(
            (username or "").strip().encode('utf-8'),
            expected_user.encode('utf-8')
        )
        pass_match = hmac.compare_digest(
            (password or "").encode('utf-8'),
            expected_pass.encode('utf-8')
        )
        return user_match and pass_match

    @classmethod
    def create_session(cls, username: str) -> Tuple[str, str]:
        """Creates a cryptographically secure token and stores in DB."""
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        expires = now + timedelta(hours=24)
        now_str = now.isoformat()
        expires_str = expires.isoformat()

        conn = get_db_connection()
        with conn:
            # Clean expired sessions
            conn.execute("DELETE FROM admin_sessions WHERE expires_at < ?", (now_str,))
            conn.execute(
                "INSERT INTO admin_sessions (token, username, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (token, username, now_str, expires_str)
            )

        cls.log_audit(
            admin_user=username,
            action="LOGIN",
            reason="Admin session initiated via credentials verification"
        )
        return token, expires_str

    @classmethod
    def validate_session(cls, token: str) -> Optional[Dict[str, Any]]:
        """Validates session token. Returns admin session dict if valid."""
        if not token:
            return None
        now_str = datetime.now(timezone.utc).isoformat()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT token, username, created_at, expires_at FROM admin_sessions WHERE token = ? AND expires_at > ?",
            (token, now_str)
        )
        row = cursor.fetchone()
        if row:
            return {
                "token": row["token"],
                "username": row["username"],
                "createdAt": row["created_at"],
                "expiresAt": row["expires_at"]
            }
        return None

    @classmethod
    def delete_session(cls, token: str):
        if not token:
            return
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT username FROM admin_sessions WHERE token = ?", (token,))
        row = cursor.fetchone()
        username = row["username"] if row else "admin"

        with conn:
            conn.execute("DELETE FROM admin_sessions WHERE token = ?", (token,))

        cls.log_audit(
            admin_user=username,
            action="LOGOUT",
            reason="Admin session terminated"
        )

    # =========================================================================
    # Audit Logging
    # =========================================================================
    @classmethod
    def log_audit(
        cls,
        admin_user: str,
        action: str,
        project_id: Optional[str] = None,
        field_changed: Optional[str] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        reason: Optional[str] = None,
        source_type: Optional[str] = None
    ):
        conn = get_db_connection()
        now_str = datetime.now(timezone.utc).isoformat()
        with conn:
            conn.execute("""
                INSERT INTO admin_audit_log (
                    timestamp, admin_user, action, project_id, field_changed,
                    old_value, new_value, reason, source_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                now_str,
                admin_user or "admin",
                action,
                project_id,
                field_changed,
                str(old_value) if old_value is not None else None,
                str(new_value) if new_value is not None else None,
                reason,
                source_type
            ))

    @classmethod
    def get_audit_logs(
        cls,
        limit: int = 50,
        offset: int = 0,
        action: Optional[str] = None,
        project_id: Optional[str] = None,
        user: Optional[str] = None
    ) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        where_clauses = []
        params = []

        if action and action != "ALL":
            where_clauses.append("action = ?")
            params.append(action)
        if project_id:
            where_clauses.append("project_id = ?")
            params.append(project_id)
        if user and user != "ALL":
            where_clauses.append("admin_user = ?")
            params.append(user)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        count_query = f"SELECT COUNT(*) as total FROM admin_audit_log {where_sql}"
        cursor.execute(count_query, params)
        total = cursor.fetchone()["total"]

        query = f"""
            SELECT id, timestamp, admin_user, action, project_id,
                   field_changed, old_value, new_value, reason, source_type
            FROM admin_audit_log
            {where_sql}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [limit, offset])
        rows = cursor.fetchall()

        logs = [
            {
                "id": r["id"],
                "timestamp": r["timestamp"],
                "adminUser": r["admin_user"],
                "action": r["action"],
                "projectId": r["project_id"],
                "fieldChanged": r["field_changed"],
                "oldValue": r["old_value"],
                "newValue": r["new_value"],
                "reason": r["reason"],
                "sourceType": r["source_type"]
            }
            for r in rows
        ]

        return {
            "total": total,
            "logs": logs,
            "limit": limit,
            "offset": offset
        }

    # =========================================================================
    # Admin Overrides & Additions Storage
    # =========================================================================
    @classmethod
    def get_all_overrides(cls) -> Dict[str, Dict[str, Dict[str, Any]]]:
        """Returns map of { project_id: { field_name: { original, override, updatedBy, updatedAt, reason } } }"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT project_id, field_name, original_value, override_value,
                   updated_by, updated_at, reason
            FROM admin_overrides
        """)
        rows = cursor.fetchall()
        result: Dict[str, Dict[str, Dict[str, Any]]] = {}
        for r in rows:
            pid = r["project_id"]
            if pid not in result:
                result[pid] = {}
            result[pid][r["field_name"]] = {
                "original": r["original_value"],
                "override": r["override_value"],
                "updatedBy": r["updated_by"],
                "updatedAt": r["updated_at"],
                "reason": r["reason"]
            }
        return result

    @classmethod
    def get_project_overrides(cls, project_id: str) -> Dict[str, Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT field_name, original_value, override_value,
                   updated_by, updated_at, reason
            FROM admin_overrides
            WHERE project_id = ?
        """, (project_id,))
        rows = cursor.fetchall()
        return {
            r["field_name"]: {
                "original": r["original_value"],
                "override": r["override_value"],
                "updatedBy": r["updated_by"],
                "updatedAt": r["updated_at"],
                "reason": r["reason"]
            }
            for r in rows
        }

    @classmethod
    def save_override(
        cls,
        project_id: str,
        field_name: str,
        original_value: Any,
        override_value: Any,
        user: str,
        reason: Optional[str] = None
    ):
        conn = get_db_connection()
        now_str = datetime.now(timezone.utc).isoformat()
        with conn:
            conn.execute("""
                INSERT OR REPLACE INTO admin_overrides (
                    project_id, field_name, original_value, override_value,
                    updated_by, updated_at, reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                project_id,
                field_name,
                str(original_value) if original_value is not None else None,
                str(override_value) if override_value is not None else None,
                user,
                now_str,
                reason
            ))

    @classmethod
    def remove_override(cls, project_id: str, field_name: Optional[str] = None):
        """Deletes admin override record(s) from persistent SQLite storage."""
        conn = get_db_connection()
        with conn:
            if field_name:
                conn.execute(
                    "DELETE FROM admin_overrides WHERE project_id = ? AND field_name = ?",
                    (project_id, field_name)
                )
            else:
                conn.execute(
                    "DELETE FROM admin_overrides WHERE project_id = ?",
                    (project_id,)
                )

    @classmethod
    def get_all_added_projects(cls) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, project_json, created_by, created_at, updated_at FROM admin_added_projects")
        rows = cursor.fetchall()
        result = []
        for r in rows:
            try:
                data = json.loads(r["project_json"])
                data["createdBy"] = r["created_by"]
                data["createdAt"] = r["created_at"]
                data["updatedAt"] = r["updated_at"]
                result.append(data)
            except Exception as err:
                print(f"[AdminService] Error decoding project json {r['id']}: {err}")
        return result

    @classmethod
    def save_added_project(cls, project_dict: Dict[str, Any], user: str):
        pid = str(project_dict["id"]).strip()
        conn = get_db_connection()
        now_str = datetime.now(timezone.utc).isoformat()
        json_str = json.dumps(project_dict)
        with conn:
            conn.execute("""
                INSERT OR REPLACE INTO admin_added_projects (
                    id, project_json, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?)
            """, (pid, json_str, user, now_str, now_str))

    @classmethod
    def get_archived_ids(cls) -> Set[str]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT project_id FROM admin_archived_projects")
        return {r["project_id"] for r in cursor.fetchall()}

    @classmethod
    def archive_project(cls, project_id: str, user: str, reason: Optional[str] = None):
        conn = get_db_connection()
        now_str = datetime.now(timezone.utc).isoformat()
        with conn:
            conn.execute("""
                INSERT OR REPLACE INTO admin_archived_projects (
                    project_id, archived_by, archived_at, reason
                ) VALUES (?, ?, ?, ?)
            """, (project_id, user, now_str, reason))
        cls.log_audit(
            admin_user=user,
            action="ARCHIVE_PROJECT",
            project_id=project_id,
            reason=reason,
            source_type="ADMIN"
        )

    @classmethod
    def unarchive_project(cls, project_id: str, user: str, reason: Optional[str] = None):
        conn = get_db_connection()
        with conn:
            conn.execute("DELETE FROM admin_archived_projects WHERE project_id = ?", (project_id,))
        cls.log_audit(
            admin_user=user,
            action="UNARCHIVE_PROJECT",
            project_id=project_id,
            reason=reason,
            source_type="ADMIN"
        )

    # =========================================================================
    # Data Validation Scanner
    # =========================================================================
    @classmethod
    def scan_data_validation(cls, projects: List[Project]) -> Dict[str, Any]:
        """
        Scans effective dataset for integrity anomalies, schema violations,
        and statistical outliers without modifying source data.
        """
        issues = []
        valid_count = 0
        warning_count = 0
        error_count = 0

        seen_ids = set()

        for p in projects:
            p_issues = []
            pid = p.id
            p_name = p.name or f"Project {pid}"

            # 1. Unique ID check
            if pid in seen_ids:
                p_issues.append({
                    "severity": "ERROR",
                    "code": "DUPLICATE_ID",
                    "field": "id",
                    "message": f"Duplicate Project ID detected: '{pid}'",
                    "value": pid
                })
            seen_ids.add(pid)

            # 2. Required Identity Fields
            if not p.name or len(p.name.strip()) < 3:
                p_issues.append({
                    "severity": "ERROR",
                    "code": "MISSING_NAME",
                    "field": "name",
                    "message": "Project name is missing or shorter than 3 characters",
                    "value": p.name
                })
            if not p.state or p.state == "Unspecified":
                p_issues.append({
                    "severity": "WARNING",
                    "code": "UNSPECIFIED_STATE",
                    "field": "state",
                    "message": "Project location is unspecified or unmapped",
                    "value": p.state
                })
            if not p.sector or p.sector == "Other Infrastructure":
                p_issues.append({
                    "severity": "WARNING",
                    "code": "GENERIC_SECTOR",
                    "field": "sector",
                    "message": "Project categorized under generic 'Other Infrastructure'",
                    "value": p.sector
                })

            # 3. Financial Bounds & Logic
            if p.originalCostCr is not None and p.originalCostCr < 0:
                p_issues.append({
                    "severity": "ERROR",
                    "code": "NEGATIVE_ORIGINAL_COST",
                    "field": "originalCostCr",
                    "message": f"Original cost cannot be negative ({p.originalCostCr} Cr)",
                    "value": p.originalCostCr
                })
            if p.revisedCostCr is not None and p.revisedCostCr < 0:
                p_issues.append({
                    "severity": "ERROR",
                    "code": "NEGATIVE_REVISED_COST",
                    "field": "revisedCostCr",
                    "message": f"Revised cost cannot be negative ({p.revisedCostCr} Cr)",
                    "value": p.revisedCostCr
                })
            if p.cumulativeExpenditureCr is not None and p.cumulativeExpenditureCr < 0:
                p_issues.append({
                    "severity": "ERROR",
                    "code": "NEGATIVE_EXPENDITURE",
                    "field": "cumulativeExpenditureCr",
                    "message": f"Cumulative expenditure cannot be negative ({p.cumulativeExpenditureCr} Cr)",
                    "value": p.cumulativeExpenditureCr
                })
            if (p.originalCostCr or 0) > 0 and (p.revisedCostCr or 0) == 0:
                p_issues.append({
                    "severity": "WARNING",
                    "code": "ZERO_REVISED_COST",
                    "field": "revisedCostCr",
                    "message": "Original cost exists but revised cost is recorded as 0",
                    "value": p.revisedCostCr
                })

            # 4. Progress Bounds (0 to 100%)
            prog = p.physicalProgressPercent
            if prog is not None:
                if prog < 0.0 or prog > 100.0:
                    p_issues.append({
                        "severity": "ERROR",
                        "code": "PROGRESS_OUT_OF_BOUNDS",
                        "field": "physicalProgressPercent",
                        "message": f"Physical progress must be between 0% and 100% (got {prog}%)",
                        "value": prog
                    })
            else:
                p_issues.append({
                    "severity": "WARNING",
                    "code": "NULL_PROGRESS",
                    "field": "physicalProgressPercent",
                    "message": "Physical progress is null or unrecorded",
                    "value": None
                })

            # 5. Risk Score Bounds
            if p.riskScore is not None and (p.riskScore < 0 or p.riskScore > 100):
                p_issues.append({
                    "severity": "ERROR",
                    "code": "RISK_SCORE_OUT_OF_BOUNDS",
                    "field": "riskScore",
                    "message": f"Computed risk score ({p.riskScore}) is out of [0, 100] scale",
                    "value": p.riskScore
                })

            # Aggregate project issues
            if p_issues:
                has_err = any(i["severity"] == "ERROR" for i in p_issues)
                if has_err:
                    error_count += 1
                else:
                    warning_count += 1

                for iss in p_issues:
                    issues.append({
                        "projectId": pid,
                        "projectName": p_name,
                        "sector": p.sector,
                        "state": p.state,
                        **iss
                    })
            else:
                valid_count += 1

        return {
            "summary": {
                "total": len(projects),
                "valid": valid_count,
                "warnings": warning_count,
                "errors": error_count,
                "cleanRate": round((valid_count / len(projects)) * 100.0, 1) if projects else 100.0
            },
            "issues": issues
        }

# Initialize database tables on import
AdminService.init_db()
