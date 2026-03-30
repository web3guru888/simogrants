-- SIMOGRANTS D1 Database Schema
-- Migration: 0001_initial

-- Users (derived from wallet, minimal data)
CREATE TABLE users (
  address TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TEXT NOT NULL,
  last_login TEXT NOT NULL
);

-- Grant Rounds
CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  creator_address TEXT NOT NULL REFERENCES users(address),
  status TEXT NOT NULL DEFAULT 'active',
  matching_pool REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USDC',
  chain TEXT NOT NULL DEFAULT 'base',
  application_deadline TEXT,
  max_applications INTEGER DEFAULT 100,
  evaluation_config TEXT,
  contract_address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  website TEXT,
  github_url TEXT,
  team_size INTEGER DEFAULT 0,
  category TEXT,
  created_by TEXT NOT NULL REFERENCES users(address),
  overall_score REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Applications (project applies to a round)
CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  status TEXT NOT NULL DEFAULT 'submitted',
  applied_at TEXT NOT NULL,
  evaluated_at TEXT
);

CREATE INDEX idx_applications_round_id ON applications(round_id);
CREATE INDEX idx_applications_project_id ON applications(project_id);

-- Evaluations
CREATE TABLE evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT NOT NULL REFERENCES applications(id),
  evaluation_data TEXT NOT NULL,
  overall_score REAL,
  data_completeness REAL,
  bradley_terry_rank REAL,
  evaluated_at TEXT NOT NULL
);

CREATE INDEX idx_evaluations_application_id ON evaluations(application_id);

-- Allocations
CREATE TABLE allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id TEXT NOT NULL REFERENCES rounds(id),
  application_id TEXT NOT NULL REFERENCES applications(id),
  amount REAL NOT NULL,
  qf_base REAL,
  pheromone_modifier REAL,
  pagerank_modifier REAL,
  pheromone_state TEXT,
  epoch INTEGER NOT NULL DEFAULT 1,
  computed_at TEXT NOT NULL
);

CREATE INDEX idx_allocations_round_id ON allocations(round_id);

-- Evidence (R2 key references)
CREATE TABLE evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id),
  round_id TEXT REFERENCES rounds(id),
  r2_key TEXT NOT NULL,
  file_size INTEGER,
  evidence_type TEXT DEFAULT 'evaluation',
  uploaded_at TEXT NOT NULL
);

CREATE INDEX idx_evidence_project_id ON evidence(project_id);

-- Pipeline Runs
CREATE TABLE pipeline_runs (
  run_id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id),
  status TEXT NOT NULL DEFAULT 'pending',
  config TEXT,
  results TEXT,
  error TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);
