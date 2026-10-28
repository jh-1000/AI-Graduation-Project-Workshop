/**
 * 失效传播（invalidation）—— 计划 §7。
 *
 * MVP 版本（保守失效，不做 AST diff）：
 *   对比当前文件哈希和最新一次 completed map run 的 run_files 快照，
 *   哈希不一致的文件 → 相关 evidence 标 freshness='stale'
 *   → 引用这些 evidence 的 claims 标 review_state='flagged'
 *   → 记 open_question 列出变化文件。
 *
 * 后续补 AST 对比：注释/空白差异只标 shifted（行号重映射），不标 stale。
 * 现在保守做法：哈希变了就标 stale，不假装知道变化影响。
 */
import { getDb } from "./db";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type InvalidationResult = {
  changedFiles: string[];
  staleEvidence: number;
  flaggedClaims: number;
  openQuestions: number;
};

export function runInvalidation(projectId: number, root: string): InvalidationResult {
  const db = getDb();

  // 1. 找最新一次有 run_files 的 run（scan 或 map 都可能写快照）
  const lastRun = db
    .prepare(
      "SELECT r.id, r.version FROM analysis_runs r WHERE r.project_id = ? AND r.status = 'completed' AND EXISTS (SELECT 1 FROM run_files rf WHERE rf.run_id = r.id) ORDER BY r.id DESC LIMIT 1"
    )
    .get(projectId) as { id: number; version: string } | undefined;

  if (!lastRun) {
    return { changedFiles: [], staleEvidence: 0, flaggedClaims: 0, openQuestions: 0 };
  }

  const snapshots = db
    .prepare("SELECT path, sha256 FROM run_files WHERE run_id = ?")
    .all(lastRun.id) as { path: string; sha256: string }[];

  if (snapshots.length === 0) return { changedFiles: [], staleEvidence: 0, flaggedClaims: 0, openQuestions: 0 };

  // 2. 对比当前文件哈希
  const changed: string[] = [];
  for (const snap of snapshots) {
    try {
      const abs = path.join(root, snap.path);
      const buf = fs.readFileSync(abs);
      const nowHash = crypto.createHash("sha256").update(buf).digest("hex");
      if (nowHash !== snap.sha256) changed.push(snap.path);
    } catch {
      // 文件被删了——也算变化
      changed.push(snap.path + "（已删除）");
    }
  }

  if (changed.length === 0) {
    // 没变化——把之前 stale/flagged 的重置回来？不，保守不重置，等用户重跑
    return { changedFiles: [], staleEvidence: 0, flaggedClaims: 0, openQuestions: 0 };
  }

  // 3. 标记 evidence stale（精确匹配 file_path）
  let staleEvidence = 0;
  let flaggedClaims = 0;
  let openQuestions = 0;

  const tx = db.transaction(() => {
    for (const f of changed) {
      const cleanPath = f.replace("（已删除）", "");
      const r = db
        .prepare("UPDATE evidence SET freshness = 'stale' WHERE project_id = ? AND analysis_version = ? AND file_path = ?")
        .run(projectId, lastRun.version, cleanPath);
      staleEvidence += r.changes;
    }

    // 4. 多跳传播：引用 stale evidence 的 claims → flagged
    const claimsToFlag = db
      .prepare(
        `SELECT DISTINCT c.id FROM claims c
         JOIN claim_evidence ce ON ce.claim_id = c.id
         JOIN evidence e ON e.id = ce.evidence_id
         WHERE c.project_id = ? AND c.analysis_version = ? AND e.freshness = 'stale'`
      )
      .all(projectId, lastRun.version) as { id: number }[];

    for (const c of claimsToFlag) {
      db.prepare("UPDATE claims SET review_state = 'flagged' WHERE id = ?").run(c.id);
      flaggedClaims++;
    }

    // 5. 记 open_question
    db.prepare(
      "INSERT INTO open_questions (project_id, analysis_version, question, why, next_check) VALUES (?, ?, ?, ?, ?)"
    ).run(
      projectId,
      lastRun.version,
      `检测到 ${changed.length} 个文件在分析后发生变化`,
      "以下文件哈希与快照不一致，相关证据和结论已标记为 stale/flagged：\n- " + changed.join("\n- "),
      "重跑 map 任务以刷新分析"
    );
    openQuestions++;
  });
  tx();

  return { changedFiles: changed, staleEvidence, flaggedClaims, openQuestions };
}
