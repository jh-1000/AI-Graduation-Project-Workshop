-- 0002: P1 数据层（业务流 / 知识点 / 术语 / 练习 / 仓库洞察 / 历史事件）
-- 只增不删：不影响 0001 的 19 张表。全部 IF NOT EXISTS，按 schema_version 顺序执行一次。

-- D-1（Decision-Register）：symbols 缺版本标签，补列。SQLite 无 ADD COLUMN IF NOT EXISTS，
-- 依赖迁移的 schema_version 闸门保证只执行一次。
ALTER TABLE symbols ADD COLUMN analysis_version TEXT;

CREATE TABLE IF NOT EXISTS nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'concept' CHECK (kind IN ('module', 'flow', 'concept', 'api', 'data')),
  summary TEXT,
  sections TEXT,
  evidence_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'confirmed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (project_id, analysis_version, slug)
);
CREATE INDEX IF NOT EXISTS idx_nodes_project ON nodes(project_id, analysis_version);

CREATE TABLE IF NOT EXISTS flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  trigger_desc TEXT,
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'confirmed')),
  UNIQUE (project_id, analysis_version, slug)
);

CREATE TABLE IF NOT EXISTS flow_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flow_id INTEGER NOT NULL REFERENCES flows(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  seq INTEGER NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT,
  start_line INTEGER,
  end_line INTEGER,
  evidence_id INTEGER REFERENCES evidence(id),
  note TEXT,
  UNIQUE (flow_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_flow_steps_flow ON flow_steps(flow_id, seq);

CREATE TABLE IF NOT EXISTS repo_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('architecture', 'module', 'health', 'risk')),
  title TEXT NOT NULL,
  content TEXT,
  evidence_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS history_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT,
  commit_hash TEXT,
  author TEXT,
  committed_at TEXT,
  subject TEXT,
  files TEXT
);

CREATE TABLE IF NOT EXISTS practice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('quiz', 'locate')),
  slug TEXT NOT NULL,
  prompt TEXT NOT NULL,
  answer TEXT,
  hints TEXT,
  target_file TEXT,
  target_line INTEGER,
  evidence_id INTEGER REFERENCES evidence(id),
  node_id INTEGER REFERENCES nodes(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'confirmed')),
  UNIQUE (project_id, analysis_version, kind, slug)
);
