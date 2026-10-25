import { getDb } from "./db";
import type { Endpoint, RouteInfo } from "./scan";
import type { SymbolInfo } from "./symbols";

export type PersistResult = { inserted: number; skipped: number };

/** 文件路径 → files 行（id 与快照哈希）；路径口径与 files.path 一致（正斜杠相对路径） */
function loadFiles(projectId: number): Map<string, { id: number; contentHash: string | null }> {
  const rows = getDb()
    .prepare("SELECT id, path, content_hash FROM files WHERE project_id = ?")
    .all(projectId) as { id: number; path: string; content_hash: string | null }[];
  const m = new Map<string, { id: number; contentHash: string | null }>();
  for (const r of rows) m.set(r.path, { id: r.id, contentHash: r.content_hash || null });
  return m;
}

/** 符号落库：ts-morph 产物按版本整体替换（同项目同版本同 identify_by 先删后插，幂等） */
export function persistSymbols(projectId: number, analysisVersion: string, symbols: SymbolInfo[]): PersistResult {
  const db = getDb();
  const files = loadFiles(projectId);
  const del = db.prepare(
    "DELETE FROM symbols WHERE project_id = ? AND analysis_version = ? AND identify_by = 'ts-morph'"
  );
  const ins = db.prepare(
    "INSERT INTO symbols (project_id, analysis_version, file_id, name, kind, line, identify_by, precision) VALUES (?, ?, ?, ?, ?, ?, 'ts-morph', 'exact')"
  );
  let inserted = 0;
  let skipped = 0;
  db.transaction(() => {
    del.run(projectId, analysisVersion);
    for (const s of symbols) {
      const f = files.get(s.file);
      if (!f) {
        skipped++; // 文件不在 files 表：无法满足 file_id NOT NULL，跳过并计数
        continue;
      }
      ins.run(projectId, analysisVersion, f.id, s.name, s.kind, s.line);
      inserted++;
    }
  })();
  return { inserted, skipped };
}

/**
 * 静态证据落库：端点/路由写入 evidence（origin=static_analyzer）。
 * note 前缀（endpoint:/route:）是删除判别键，避免误删同版本其他来源的证据。
 */
export function persistEvidence(
  projectId: number,
  analysisVersion: string,
  endpoints: Endpoint[],
  routes: RouteInfo[]
): PersistResult {
  const db = getDb();
  const files = loadFiles(projectId);
  const del = db.prepare(
    "DELETE FROM evidence WHERE project_id = ? AND analysis_version = ? AND (note LIKE 'endpoint:%' OR note LIKE 'route:%')"
  );
  const ins = db.prepare(
    "INSERT INTO evidence (project_id, analysis_version, file_path, start_line, end_line, content_hash, origin, processing, freshness, note) VALUES (?, ?, ?, ?, ?, ?, 'static_analyzer', 'extracted', 'current', ?)"
  );
  let inserted = 0;
  let skipped = 0;
  db.transaction(() => {
    del.run(projectId, analysisVersion);
    for (const e of endpoints) {
      const f = files.get(e.file);
      if (!f) {
        skipped++;
        continue;
      }
      ins.run(projectId, analysisVersion, e.file, e.line, e.line, f.contentHash, `endpoint: ${e.method} ${e.path}`);
      inserted++;
    }
    for (const r of routes) {
      const f = files.get(r.file);
      if (!f) {
        skipped++;
        continue;
      }
      // 路由声明无行号（RouteInfo 不带 line），行号列留空而不是填 0
      ins.run(projectId, analysisVersion, r.file, null, null, f.contentHash, `route: ${r.path}`);
      inserted++;
    }
  })();
  return { inserted, skipped };
}