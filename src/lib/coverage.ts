/**
 * 六维覆盖报告（coverage_stats）。
 * 设计依据：计划 §9 —— 每维给目标范围/已完成/失败/跳过原因/待处理，
 * 不用模糊百分比掩盖关键流程缺失。PageRank 未选中的文件如实计入"未覆盖"。
 *
 * 六维：
 *   files         文件解析（parsed vs text_only vs skipped）
 *   symbols       符号识别（TS/TSX 文件抽出的符号数）
 *   references    引用关系（edges 表 IMPORTS/CONTAINS 边）
 *   flows         业务流程识别（flows 表 + 未进入流程的端点证据）
 *   external_deps  外部依赖（lockfile 阶段写入 evidence 的 dep: 行）
 *   runtime       运行验证（runtime_proofs，P4）
 */
import { getDb } from "./db";

export type CoverageResult = { dims: number };

export function runCoverage(projectId: number, analysisVersion: string): CoverageResult {
  const db = getDb();

  // 按版本整体替换
  db.prepare("DELETE FROM coverage_stats WHERE project_id = ? AND analysis_version = ?")
    .run(projectId, analysisVersion);

  const ins = db.prepare(
    "INSERT INTO coverage_stats (project_id, analysis_version, dim, target_n, done_n, failed_n, skipped_n, pending_n, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    // 1. files：文件解析
    const files = db
      .prepare("SELECT parse_mode, COUNT(*) as n FROM files WHERE project_id = ? GROUP BY parse_mode")
      .all(projectId) as { parse_mode: string; n: number }[];
    const totalFiles = files.reduce((s, r) => s + r.n, 0);
    const parsed = files.find((r) => r.parse_mode === "parsed")?.n ?? 0;
    const textOnly = files.find((r) => r.parse_mode === "text_only")?.n ?? 0;
    ins.run(projectId, analysisVersion, "files", totalFiles, parsed, 0, textOnly, 0,
      totalFiles > 0 ? `${parsed}/${totalFiles} 文件已解析` : "无文件");

    // 2. symbols：符号识别
    const symCount = (db.prepare("SELECT COUNT(*) as n FROM symbols WHERE project_id = ? AND analysis_version = ?")
      .get(projectId, analysisVersion) as { n: number }).n;
    const tsFiles = (db.prepare("SELECT COUNT(*) as n FROM files WHERE project_id = ? AND (path LIKE '%.ts' OR path LIKE '%.tsx')")
      .get(projectId) as { n: number }).n;
    ins.run(projectId, analysisVersion, "symbols", tsFiles, symCount, 0, 0, 0,
      `抽出 ${symCount} 个符号（${tsFiles} 个 TS/TSX 文件）`);

    // 3. references：引用关系（edges）
    const edgeCount = (db.prepare("SELECT COUNT(*) as n FROM edges WHERE project_id = ? AND analysis_version = ?")
      .get(projectId, analysisVersion) as { n: number }).n;
    const importsCount = (db.prepare("SELECT COUNT(*) as n FROM edges WHERE project_id = ? AND analysis_version = ? AND kind = 'IMPORTS'")
      .get(projectId, analysisVersion) as { n: number }).n;
    ins.run(projectId, analysisVersion, "references", edgeCount, edgeCount, 0, 0, 0,
      `${importsCount} 条 IMPORTS + ${edgeCount - importsCount} 条 CONTAINS；CALLS/IMPLEMENTS 未实现`);

    // 4. flows：业务流程识别
    const flowCount = (db.prepare("SELECT COUNT(*) as n FROM flows WHERE project_id = ? AND analysis_version = ?")
      .get(projectId, analysisVersion) as { n: number }).n;
    // lockfile 阶段的依赖行不是端点证据，不计入业务流程口径
    const evCount = (db.prepare("SELECT COUNT(*) as n FROM evidence WHERE project_id = ? AND analysis_version = ? AND stage != 'lockfile'")
      .get(projectId, analysisVersion) as { n: number }).n;
    const directExt = (db.prepare("SELECT COUNT(*) as n FROM claims WHERE project_id = ? AND analysis_version = ? AND derivation = 'direct_extraction'")
      .get(projectId, analysisVersion) as { n: number }).n;
    ins.run(projectId, analysisVersion, "flows", evCount, flowCount, 0, directExt, 0,
      `${flowCount} 条流程；${directExt} 个端点未进入业务流`);

    // 5. external_deps：外部依赖（lockfile 阶段落库的依赖行）
    const depCount = (db.prepare("SELECT COUNT(*) as n FROM evidence WHERE project_id = ? AND analysis_version = ? AND stage = 'lockfile'")
      .get(projectId, analysisVersion) as { n: number }).n;
    ins.run(projectId, analysisVersion, "external_deps", depCount, depCount, 0, 0, 0,
      depCount > 0 ? `${depCount} 个依赖已解析（lockfile/package.json）` : "无依赖记录（lockfile 阶段未运行或未找到 lockfile）");

    // 6. runtime：运行验证（P4）
    ins.run(projectId, analysisVersion, "runtime", 0, 0, 0, 0, 0,
      "runtime_proofs 未实现（P4 答辩阶段）");
  });
  tx();

  return { dims: 6 };
}
