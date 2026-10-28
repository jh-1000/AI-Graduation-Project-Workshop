-- 0005: P3 练习闭环持久化（学习记录 —— teach 技能的 learning-records 数据化）
-- 只记录"被证明的"：每次作答的题型/提示次数/是否看答案/是否独立完成。
-- mere coverage 不写：只有真实作答才产生记录。
CREATE TABLE IF NOT EXISTS learning_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  item_id INTEGER REFERENCES practice_items(id),
  node_id INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('quiz', 'locate', 'review')),
  correct INTEGER CHECK (correct IN (0, 1)),
  hints_used INTEGER NOT NULL DEFAULT 0,
  viewed_answer INTEGER NOT NULL DEFAULT 0,
  independent INTEGER NOT NULL DEFAULT 1,
  answer_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_attempts_project ON learning_attempts(project_id, kind, created_at);
