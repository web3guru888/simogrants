"""
SIMOGRANTS — SQLite persistence layer.
Uses aiosqlite for async database operations.
"""
from __future__ import annotations

import json
import logging
import aiosqlite
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path("simogrants.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    github_url TEXT,
    contract_addresses TEXT,  -- JSON array
    defillama_slug TEXT,
    snapshot_space TEXT,
    package_names TEXT,  -- JSON dict
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
    project_id TEXT PRIMARY KEY,
    profile_data TEXT NOT NULL,  -- Full ProjectProfile as JSON
    data_completeness REAL DEFAULT 0.0,
    collected_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    evaluation_data TEXT NOT NULL,  -- Full EvaluationResult as JSON
    overall_score REAL,
    data_completeness REAL,
    evaluated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    epoch INTEGER NOT NULL,
    allocation_data TEXT NOT NULL,  -- JSON dict of project_id -> amount
    matching_pool REAL NOT NULL,
    pheromone_state TEXT,  -- JSON dict
    computed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attestations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    evaluation_hash TEXT NOT NULL,
    filecoin_cid TEXT,
    tx_hash TEXT,
    epoch INTEGER,
    attested_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, collecting, evaluating, allocating, attesting, complete, failed
    project_ids TEXT NOT NULL,  -- JSON array
    matching_pool REAL,
    results TEXT,  -- JSON results when complete
    error TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT
);
"""


class Database:
    """Async SQLite database wrapper."""

    def __init__(self, db_path: str | Path = DB_PATH):
        self.db_path = str(db_path)
        self._db: aiosqlite.Connection | None = None

    async def connect(self):
        """Open database connection and initialize schema."""
        self._db = await aiosqlite.connect(self.db_path)
        self._db.row_factory = aiosqlite.Row
        await self._db.executescript(SCHEMA)
        await self._db.commit()
        logger.info(f"Database connected: {self.db_path}")

    async def close(self):
        """Close database connection."""
        if self._db:
            await self._db.close()
            self._db = None

    @property
    def db(self) -> aiosqlite.Connection:
        if self._db is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        return self._db

    # --- Projects ---

    async def create_project(self, project_id: str, name: str, description: str = "",
                             github_url: str | None = None,
                             contract_addresses: list[str] | None = None,
                             defillama_slug: str | None = None,
                             snapshot_space: str | None = None,
                             package_names: dict | None = None) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            """INSERT INTO projects (project_id, name, description, github_url, 
               contract_addresses, defillama_slug, snapshot_space, package_names,
               created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (project_id, name, description, github_url,
             json.dumps(contract_addresses) if contract_addresses else None,
             defillama_slug, snapshot_space,
             json.dumps(package_names) if package_names else None,
             now, now)
        )
        await self.db.commit()
        return await self.get_project(project_id)

    async def get_project(self, project_id: str) -> dict | None:
        cursor = await self.db.execute(
            "SELECT * FROM projects WHERE project_id = ?", (project_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._row_to_dict(row)

    async def list_projects(self) -> list[dict]:
        cursor = await self.db.execute("SELECT * FROM projects ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [self._row_to_dict(r) for r in rows]

    async def delete_project(self, project_id: str) -> bool:
        cursor = await self.db.execute(
            "DELETE FROM projects WHERE project_id = ?", (project_id,)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    # --- Profiles ---

    async def save_profile(self, project_id: str, profile_data: dict,
                           data_completeness: float) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            """INSERT OR REPLACE INTO profiles 
               (project_id, profile_data, data_completeness, collected_at)
               VALUES (?, ?, ?, ?)""",
            (project_id, json.dumps(profile_data), data_completeness, now)
        )
        await self.db.commit()

    async def get_profile(self, project_id: str) -> dict | None:
        cursor = await self.db.execute(
            "SELECT * FROM profiles WHERE project_id = ?", (project_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        result = self._row_to_dict(row)
        result["profile_data"] = json.loads(result["profile_data"])
        return result

    # --- Evaluations ---

    async def save_evaluation(self, project_id: str, evaluation_data: dict,
                              overall_score: float, data_completeness: float) -> int:
        now = datetime.now(timezone.utc).isoformat()
        cursor = await self.db.execute(
            """INSERT INTO evaluations 
               (project_id, evaluation_data, overall_score, data_completeness, evaluated_at)
               VALUES (?, ?, ?, ?, ?)""",
            (project_id, json.dumps(evaluation_data), overall_score, data_completeness, now)
        )
        await self.db.commit()
        return cursor.lastrowid

    async def get_evaluation(self, project_id: str) -> dict | None:
        cursor = await self.db.execute(
            """SELECT * FROM evaluations WHERE project_id = ? 
               ORDER BY evaluated_at DESC LIMIT 1""",
            (project_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        result = self._row_to_dict(row)
        result["evaluation_data"] = json.loads(result["evaluation_data"])
        return result

    async def list_evaluations(self) -> list[dict]:
        cursor = await self.db.execute(
            "SELECT * FROM evaluations ORDER BY evaluated_at DESC"
        )
        rows = await cursor.fetchall()
        results = []
        for r in rows:
            d = self._row_to_dict(r)
            d["evaluation_data"] = json.loads(d["evaluation_data"])
            results.append(d)
        return results

    # --- Allocations ---

    async def save_allocation(self, epoch: int, allocation_data: dict,
                              matching_pool: float, pheromone_state: dict | None = None) -> int:
        now = datetime.now(timezone.utc).isoformat()
        cursor = await self.db.execute(
            """INSERT INTO allocations 
               (epoch, allocation_data, matching_pool, pheromone_state, computed_at)
               VALUES (?, ?, ?, ?, ?)""",
            (epoch, json.dumps(allocation_data), matching_pool,
             json.dumps(pheromone_state) if pheromone_state else None, now)
        )
        await self.db.commit()
        return cursor.lastrowid

    async def get_latest_allocation(self) -> dict | None:
        cursor = await self.db.execute(
            "SELECT * FROM allocations ORDER BY computed_at DESC LIMIT 1"
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        result = self._row_to_dict(row)
        result["allocation_data"] = json.loads(result["allocation_data"])
        if result.get("pheromone_state"):
            result["pheromone_state"] = json.loads(result["pheromone_state"])
        return result

    # --- Attestations ---

    async def save_attestation(self, project_id: str, evaluation_hash: str,
                               filecoin_cid: str | None = None,
                               tx_hash: str | None = None,
                               epoch: int | None = None) -> int:
        now = datetime.now(timezone.utc).isoformat()
        cursor = await self.db.execute(
            """INSERT INTO attestations 
               (project_id, evaluation_hash, filecoin_cid, tx_hash, epoch, attested_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (project_id, evaluation_hash, filecoin_cid, tx_hash, epoch, now)
        )
        await self.db.commit()
        return cursor.lastrowid

    async def get_attestations(self, project_id: str) -> list[dict]:
        cursor = await self.db.execute(
            "SELECT * FROM attestations WHERE project_id = ? ORDER BY attested_at DESC",
            (project_id,)
        )
        rows = await cursor.fetchall()
        return [self._row_to_dict(r) for r in rows]

    # --- Pipeline Runs ---

    async def create_pipeline_run(self, run_id: str, project_ids: list[str],
                                  matching_pool: float | None = None) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            """INSERT INTO pipeline_runs 
               (run_id, status, project_ids, matching_pool, started_at)
               VALUES (?, 'pending', ?, ?, ?)""",
            (run_id, json.dumps(project_ids), matching_pool, now)
        )
        await self.db.commit()

    async def update_pipeline_run(self, run_id: str, status: str,
                                  results: dict | None = None,
                                  error: str | None = None) -> None:
        now = datetime.now(timezone.utc).isoformat()
        if status in ("complete", "failed"):
            await self.db.execute(
                """UPDATE pipeline_runs SET status = ?, results = ?, error = ?, completed_at = ?
                   WHERE run_id = ?""",
                (status, json.dumps(results) if results else None, error, now, run_id)
            )
        else:
            await self.db.execute(
                "UPDATE pipeline_runs SET status = ? WHERE run_id = ?",
                (status, run_id)
            )
        await self.db.commit()

    async def get_pipeline_run(self, run_id: str) -> dict | None:
        cursor = await self.db.execute(
            "SELECT * FROM pipeline_runs WHERE run_id = ?", (run_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        result = self._row_to_dict(row)
        result["project_ids"] = json.loads(result["project_ids"])
        if result.get("results"):
            result["results"] = json.loads(result["results"])
        return result

    # --- Helpers ---

    @staticmethod
    def _row_to_dict(row: aiosqlite.Row) -> dict:
        return dict(row)


# Singleton instance
db = Database()
