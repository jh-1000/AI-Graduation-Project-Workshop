-- P0 核心链路 schema（最终版计划 §8）
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('path', 'zip')),
  root_path TEXT NOT NULL,
  stack TEXT NOT NULL DEFAULT '{}',
  mission TEXT,
  defense_date TEXT,
  allow_modify INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  path TEXT NOT NULL,
  ext TEXT,
  loc INTEGER NOT NULL DEFAULT 0,
  role TEXT,
  parse_mode TEXT NOT NULL DEFAULT 'text_only' CHECK (parse_mode IN ('parsed', 'text_only', 'skipped')),
  content_hash TEXT,
  summary TEXT,
  UNIQUE (project_id, path)
);

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  file_id INTEGER NOT NULL REFERENCES files(id),
  name TEXT NOT NULL,
  kind TEXT,
  line INTEGER,
  identify_by TEXT NOT NULL DEFAULT 'regex' CHECK (identify_by IN ('ts-morph', 'tree-sitter', 'regex')),
  precision TEXT NOT NULL DEFAULT 'approximate' CHECK (precision IN ('exact', 'approximate'))
);
CREATE INDEX IF NOT EXISTS idx_symbols_project ON symbols(project_id, name);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('scan', 'map', 'invalidation')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  stage TEXT,
  step TEXT,
  progress_note TEXT,
  budget_json TEXT,
  resume_key TEXT,
  recovery_count INTEGER NOT NULL DEFAULT 0,
  idem_key TEXT,
  heartbeat_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_runs_project ON analysis_runs(project_id, kind);

CREATE TABLE IF NOT EXISTS run_files (
  run_id INTEGER NOT NULL REFERENCES analysis_runs(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  path TEXT NOT NULL,
  size INTEGER NOT NULL,
  mtime TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  PRIMARY KEY (run_id, path)
);

CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT NOT NULL,
  file_path TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  content_hash TEXT,
  origin TEXT NOT NULL CHECK (origin IN ('source_code', 'static_analyzer', 'llm', 'user', 'runtime', 'unknown')),
  processing TEXT NOT NULL DEFAULT 'extracted' CHECK (processing IN ('extracted', 'linked', 'reviewed')),
  freshness TEXT NOT NULL DEFAULT 'current' CHECK (freshness IN ('current', 'shifted', 'stale')),
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_evidence_project ON evidence(project_id, file_path);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT NOT NULL,
  content TEXT NOT NULL,
  derivation TEXT NOT NULL CHECK (derivation IN ('direct_extraction', 'inferred', 'llm_interpreted', 'user_asserted', 'measured')),
  review_state TEXT NOT NULL DEFAULT 'draft' CHECK (review_state IN ('draft', 'supported', 'reviewed', 'flagged', 'superseded')),
  confidence REAL,
  subject_type TEXT,
  subject_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_claims_project ON claims(project_id, review_state);

CREATE TABLE IF NOT EXISTS claim_evidence (
  claim_id INTEGER NOT NULL REFERENCES claims(id),
  evidence_id INTEGER NOT NULL REFERENCES evidence(id),
  support_role TEXT,
  PRIMARY KEY (claim_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS claim_dependencies (
  claim_id INTEGER NOT NULL REFERENCES claims(id),
  depends_on_claim_id INTEGER NOT NULL REFERENCES claims(id),
  PRIMARY KEY (claim_id, depends_on_claim_id)
);

CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT NOT NULL,
  from_type TEXT NOT NULL,
  from_id INTEGER NOT NULL,
  to_type TEXT NOT NULL,
  to_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('source_code', 'static_analyzer', 'llm', 'user', 'runtime', 'unknown'))
);
CREATE INDEX IF NOT EXISTS idx_edges_project ON edges(project_id);

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  plain_def TEXT,
  pro_def TEXT,
  example TEXT,
  pitfall TEXT,
  avoid_aliases TEXT,
  category TEXT,
  version_note TEXT,
  usage TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS term_relations (
  term_id INTEGER NOT NULL REFERENCES terms(id),
  related_type TEXT NOT NULL CHECK (related_type IN ('prerequisite', 'confused_with', 'relates')),
  target_kind TEXT NOT NULL DEFAULT 'term' CHECK (target_kind IN ('term', 'node')),
  target_id INTEGER NOT NULL,
  note TEXT,
  PRIMARY KEY (term_id, related_type, target_kind, target_id)
);

CREATE TABLE IF NOT EXISTS open_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT,
  question TEXT NOT NULL,
  why TEXT,
  next_check TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS llm_cache (
  key TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  model TEXT,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS coverage_stats (
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT NOT NULL,
  dim TEXT NOT NULL CHECK (dim IN ('files', 'symbols', 'references', 'flows', 'external_deps', 'runtime')),
  target_n INTEGER NOT NULL DEFAULT 0,
  done_n INTEGER NOT NULL DEFAULT 0,
  failed_n INTEGER NOT NULL DEFAULT 0,
  skipped_n INTEGER NOT NULL DEFAULT 0,
  pending_n INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  PRIMARY KEY (project_id, analysis_version, dim)
);

CREATE TABLE IF NOT EXISTS regression_specs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  expected TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS regression_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture TEXT NOT NULL,
  run_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  passed INTEGER NOT NULL,
  failures TEXT
);
