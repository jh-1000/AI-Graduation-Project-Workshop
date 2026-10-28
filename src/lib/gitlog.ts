/**
 * git 考古：按功能聚合提交历史（意图 / 改动 / AI 迭代痕迹）。
 * 设计依据：01-Requirements/modules/analysis/audit/SPEC.md F-3
 *   - R-2 git 不可用时功能降级为不可用，不阻塞其他分析
 *
 * 产物：history_events 表（commit_hash / author / committed_at / subject / files）。
 * 失败静默跳过——不抛错、不写 open_questions（这不是模型产物失败，是环境缺 git）。
 */
import { getDb } from "./db";
import { execFileSync } from "node:child_process";

export type GitResult = { commits: number; available: boolean };

export function runGitArchaeology(projectId: number, analysisVersion: string, root: string): GitResult {
  let out: string;
  try {
    out = execFileSync(
      "git",
      ["log", "-n", "50", "--name-only", "--pretty=format:COMMIT%x1f%H%x1f%an%x1f%aI%x1f%s"],
      { cwd: root, timeout: 10_000, encoding: "utf8" }
    );
  } catch {
    // 无 git / 不是仓库 / 超时——静默降级
    return { commits: 0, available: false };
  }

  const db = getDb();
  db.prepare("DELETE FROM history_events WHERE project_id = ? AND analysis_version = ?").run(projectId, analysisVersion);

  const ins = db.prepare(
    "INSERT INTO history_events (project_id, analysis_version, commit_hash, author, committed_at, subject, files) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  let commits = 0;
  // 输出格式：每条提交一行 COMMIT\x1f<hash>\x1f<author>\x1f<iso>\x1f<subject>，后跟若干文件名（空行分隔）
  const blocks = out.split(/(?=COMMIT\x1f)/);
  const tx = db.transaction(() => {
    for (const block of blocks) {
      const lineEnd = block.indexOf("\n");
      const header = lineEnd >= 0 ? block.slice(0, lineEnd) : block;
      if (!header.startsWith("COMMIT\x1f")) continue;
      const parts = header.split("\x1f");
      // parts: [COMMIT, hash, author, iso, subject]
      if (parts.length < 5) continue;
      const [, hash, author, iso, subject] = parts;
      const files = lineEnd >= 0 ? block.slice(lineEnd + 1).split("\n").filter(Boolean) : [];
      ins.run(projectId, analysisVersion, hash.slice(0, 12), author, iso, subject, JSON.stringify(files.slice(0, 20)));
      commits++;
    }
  });
  tx();
  return { commits, available: true };
}
