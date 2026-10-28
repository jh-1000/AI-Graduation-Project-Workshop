import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * 变更影响（失效传播状态，只读）。
 * 设计依据：evidence/invalidation SPEC + 计划 §7「源码变化后不得把旧结论当当前事实」。
 * POST /api/projects/[id]/invalidate 执行对比后，本接口回读状态。
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();

  const lastRun = db
    .prepare(
      "SELECT r.id, r.version, r.kind, r.updated_at FROM analysis_runs r WHERE r.project_id = ? AND r.status = 'completed' AND EXISTS (SELECT 1 FROM run_files rf WHERE rf.run_id = r.id) ORDER BY r.id DESC LIMIT 1"
    )
    .get(projectId) as { id: number; version: string; kind: string; updated_at: string } | undefined;

  const snapshotFiles = lastRun
    ? (db.prepare("SELECT COUNT(*) n FROM run_files WHERE run_id = ?").get(lastRun.id) as { n: number }).n
    : 0;

  // 只统计最新证据/结论版本——旧版本是历史，不冒充当前（D-2 防线）
  const latestEv = db
    .prepare("SELECT analysis_version FROM evidence WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId) as { analysis_version: string } | undefined;
  const evCounts = latestEv
    ? (db
        .prepare("SELECT freshness, COUNT(*) n FROM evidence WHERE project_id = ? AND analysis_version = ? GROUP BY freshness")
        .all(projectId, latestEv.analysis_version) as { freshness: string; n: number }[])
    : [];
  const ev = Object.fromEntries(evCounts.map((r) => [r.freshness, r.n])) as Record<string, number>;

  const latestCl = db
    .prepare("SELECT analysis_version FROM claims WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId) as { analysis_version: string } | undefined;
  const claimCounts = latestCl
    ? (db
        .prepare("SELECT review_state, COUNT(*) n FROM claims WHERE project_id = ? AND analysis_version = ? GROUP BY review_state")
        .all(projectId, latestCl.analysis_version) as { review_state: string; n: number }[])
    : [];
  const cl = Object.fromEntries(claimCounts.map((r) => [r.review_state, r.n])) as Record<string, number>;

  const staleEvidence = latestEv
    ? (db
        .prepare(
          "SELECT id, file_path, start_line, note, freshness FROM evidence WHERE project_id = ? AND analysis_version = ? AND freshness != 'current' ORDER BY id DESC LIMIT 50"
        )
        .all(projectId, latestEv.analysis_version) as { id: number; file_path: string; start_line: number | null; note: string | null; freshness: string }[])
    : [];

  const flaggedClaims = latestCl
    ? (db
        .prepare(
          "SELECT id, content, derivation, review_state FROM claims WHERE project_id = ? AND analysis_version = ? AND review_state IN ('flagged','superseded') ORDER BY id DESC LIMIT 50"
        )
        .all(projectId, latestCl.analysis_version) as { id: number; content: string; derivation: string; review_state: string }[])
    : [];

  const changeQuestions = db
    .prepare(
      "SELECT question, why, next_check, status FROM open_questions WHERE project_id = ? AND (question LIKE '%变更%' OR question LIKE '%失效%' OR question LIKE '%变化%' OR question LIKE '%预算%' OR question LIKE '%失败%') ORDER BY id DESC LIMIT 30"
    )
    .all(projectId);

  return NextResponse.json({
    snapshot: lastRun
      ? { version: lastRun.version, kind: lastRun.kind, updatedAt: lastRun.updated_at, files: snapshotFiles }
      : null,
    evidence: { current: ev.current ?? 0, shifted: ev.shifted ?? 0, stale: ev.stale ?? 0 },
    claims: {
      draft: cl.draft ?? 0,
      supported: cl.supported ?? 0,
      reviewed: cl.reviewed ?? 0,
      flagged: cl.flagged ?? 0,
      superseded: cl.superseded ?? 0,
    },
    staleEvidence,
    flaggedClaims,
    changeQuestions,
  });
}
