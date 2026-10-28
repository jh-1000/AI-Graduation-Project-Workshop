-- 0007: P3 技术栈学习路径（从依赖自动生成概念链，锚到项目真实代码）
CREATE TABLE IF NOT EXISTS tech_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  analysis_version TEXT NOT NULL,
  tech_name TEXT NOT NULL,
  tech_version TEXT,
  reason TEXT,
  UNIQUE (project_id, analysis_version, tech_name)
);

CREATE TABLE IF NOT EXISTS tech_path_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path_id INTEGER NOT NULL REFERENCES tech_paths(id),
  seq INTEGER NOT NULL,
  concept_title TEXT NOT NULL,
  concept_slug TEXT NOT NULL,
  why_needed TEXT,
  project_ref TEXT,
  prereq_item_id INTEGER REFERENCES tech_path_items(id),
  UNIQUE (path_id, seq)
);
