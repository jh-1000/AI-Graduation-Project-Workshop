-- 0006: P4 实战挑战（隔离工作区 / 运行验证 / 诚实边界记录）
-- 挑战定义
CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT NOT NULL,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('locate', 'modify', 'mutation')),
  title TEXT NOT NULL,
  goal TEXT,
  target_file TEXT,
  target_line INTEGER,
  allowed_scope TEXT,
  forbidden TEXT,
  acceptance TEXT,
  verify_command TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'confirmed')),
  UNIQUE (project_id, analysis_version, slug)
);

-- 挑战执行（含破坏实验：run_type=mutation）
CREATE TABLE IF NOT EXISTS challenge_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  run_type TEXT NOT NULL CHECK (run_type IN ('locate', 'modify', 'mutation')),
  workspace_mode TEXT NOT NULL CHECK (workspace_mode IN ('worktree', 'copy')),
  workspace_path TEXT NOT NULL,
  baseline_path TEXT,
  baseline_commit TEXT,
  diff TEXT,
  modified INTEGER NOT NULL DEFAULT 0,
  verify_command TEXT,
  verify_status TEXT NOT NULL DEFAULT 'none' CHECK (verify_status IN ('none', 'ran', 'passed', 'failed')),
  verify_output TEXT,
  verify_scope TEXT,
  accepted INTEGER NOT NULL DEFAULT 0,
  rolled_back INTEGER NOT NULL DEFAULT 0,
  auth_l5_at TEXT,
  auth_l2_at TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  ended_at TEXT
);

-- 运行验证证据（八级类型 + 断言范围 + 未覆盖场景）
CREATE TABLE IF NOT EXISTS runtime_proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT,
  challenge_run_id INTEGER REFERENCES challenge_runs(id),
  proof_type TEXT NOT NULL CHECK (proof_type IN ('static_lint','type_build','unit_test','integration_test','e2e_test','api_behavior','business_rule','manual_review')),
  command TEXT NOT NULL,
  environment TEXT,
  exit_code INTEGER,
  output_summary TEXT,
  asserted_scope TEXT,
  uncovered TEXT,
  result TEXT NOT NULL CHECK (result IN ('passed', 'failed')),
  recorded_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 事实冲突记录（Correction 三段式：原声称 / 现验证为真 / 逐字证据）
CREATE TABLE IF NOT EXISTS fact_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  claim_id INTEGER REFERENCES claims(id),
  original_claim TEXT NOT NULL,
  verified_fact TEXT NOT NULL,
  evidence_quote TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 用户纠错（不直接覆盖源码事实；触发相关证据重核）
CREATE TABLE IF NOT EXISTS user_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  target_type TEXT NOT NULL,
  target_id INTEGER,
  original TEXT NOT NULL,
  correction TEXT NOT NULL,
  evidence_note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'verified', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
