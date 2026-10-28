/**
 * 建边（edges）：从静态分析结果确定性推导节点间关系。
 * 设计依据：01-Requirements/modules/analysis/map-pipeline/SPEC.md F-6
 *   边类型：CONTAINS / IMPORTS / CALLS / IMPLEMENTS / RELATES_TO / EXPLAINS
 *
 * 当前实现：
 *   - CONTAINS：file → symbol（文件包含某符号，从 symbols 表推）
 *   - IMPORTS：file → file（ts-morph 抽 import 声明，A import B）
 *   - CALLS/IMPLEMENTS/RELATES_TO/EXPLAINS：留给后续（需要数据流/类型分析）
 *
 * 产物：edges 表，origin='static_analyzer'。
 */
import { getDb } from "./db";
import { Project } from "ts-morph";
import path from "node:path";

export type EdgesResult = { inserted: number; imports: number; contains: number };

export function buildEdges(projectId: number, analysisVersion: string, root: string): EdgesResult {
  const db = getDb();

  // 1. files: path → id
  const files = db
    .prepare("SELECT id, path FROM files WHERE project_id = ?")
    .all(projectId) as { id: number; path: string }[];
  const fileIdByPath = new Map(files.map((f) => [f.path, f.id]));

  // 2. symbols: (file_id, name) → id
  const symbols = db
    .prepare("SELECT id, file_id, name FROM symbols WHERE project_id = ? AND analysis_version = ?")
    .all(projectId, analysisVersion) as { id: number; file_id: number; name: string }[];

  // 3. 按版本整体替换
  db.prepare("DELETE FROM edges WHERE project_id = ? AND analysis_version = ?").run(projectId, analysisVersion);

  const ins = db.prepare(
    "INSERT INTO edges (project_id, analysis_version, from_type, from_id, to_type, to_id, kind, origin) VALUES (?, ?, ?, ?, ?, ?, ?, 'static_analyzer')"
  );

  let imports = 0;
  let contains = 0;

  const tx = db.transaction(() => {
    // CONTAINS: file → symbol
    for (const s of symbols) {
      ins.run(projectId, analysisVersion, "file", s.file_id, "symbol", s.id, "CONTAINS");
      contains++;
    }

    // IMPORTS: file → file（ts-morph 抽 import）
    const tsFiles = files.filter((f) => /\.(ts|tsx)$/.test(f.path));
    if (tsFiles.length > 0) {
      const project = new Project({
        skipAddingFilesFromTsConfig: true,
        skipLoadingLibFiles: true,
        useInMemoryFileSystem: false,
      });
      const absPaths = tsFiles.map((f) => path.join(root, f.path));
      const sourceFiles = project.addSourceFilesAtPaths(absPaths);
      const toRel = (abs: string) => path.relative(root, abs).replace(/\\/g, "/");

      for (const sf of sourceFiles) {
        const fromRel = toRel(sf.getFilePath());
        const fromId = fileIdByPath.get(fromRel);
        if (!fromId) continue;
        for (const imp of sf.getImportDeclarations()) {
          const spec = imp.getModuleSpecifierValue();
          if (!spec.startsWith(".")) continue;
          const target = imp.getModuleSpecifierSourceFile();
          if (!target) continue;
          const toRelPath = toRel(target.getFilePath());
          const toId = fileIdByPath.get(toRelPath);
          if (!toId) continue;
          ins.run(projectId, analysisVersion, "file", fromId, "file", toId, "IMPORTS");
          imports++;
        }
      }
    }
  });
  tx();

  return { inserted: contains + imports, imports, contains };
}
