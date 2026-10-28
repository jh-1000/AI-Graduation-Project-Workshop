-- 0004_node_mastery.sql：掌握度 + FSRS 复习调度
CREATE TABLE IF NOT EXISTS node_mastery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  node_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'unlearned' CHECK (status IN ('unlearned', 'learning', 'mastered')),
  -- FSRS 参数
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  due TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  last_reviewed TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (project_id, node_id)
);
CREATE INDEX IF NOT EXISTS idx_node_mastery_due ON node_mastery(project_id, due);
