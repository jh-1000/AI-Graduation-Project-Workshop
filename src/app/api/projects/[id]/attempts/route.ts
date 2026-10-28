import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** 练习作答记录（P3.1）：每次真实作答一条；评分依据随 attempt 保存，供掌握判定与雷达引用。 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const body = (await req.json()) as {
    itemId?: number;
    nodeId?: number;
    kind?: "quiz" | "locate" | "review";
    correct?: boolean;
    hintsUsed?: number;
    viewedAnswer?: boolean;
    independent?: boolean;
    answerText?: string;
  };
  if (!body.kind || !["quiz", "locate", "review"].includes(body.kind)) {
    return NextResponse.json({ error: "kind 必须是 quiz|locate|review" }, { status: 400 });
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO learning_attempts (project_id, item_id, node_id, kind, correct, hints_used, viewed_answer, independent, answer_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      projectId,
      body.itemId ?? null,
      body.nodeId ?? null,
      body.kind,
      body.correct === undefined ? null : body.correct ? 1 : 0,
      body.hintsUsed ?? 0,
      body.viewedAnswer ? 1 : 0,
      body.independent === false ? 0 : 1,
      body.answerText?.slice(0, 4000) ?? null
    );
  return NextResponse.json({ ok: true, attemptId: Number(info.lastInsertRowid) });
}

/** 通过率（按题型聚合，供雷达引用）：只统计有判定结果的作答。 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();
  const byKind = db
    .prepare(
      `SELECT kind, COUNT(*) AS total, SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) AS passed,
              SUM(CASE WHEN independent = 1 THEN 1 ELSE 0 END) AS independentCount
       FROM learning_attempts WHERE project_id = ? AND correct IS NOT NULL GROUP BY kind`
    )
    .all(projectId) as { kind: string; total: number; passed: number; independentCount: number }[];
  const recent = db
    .prepare(
      "SELECT kind, correct, hints_used AS hintsUsed, viewed_answer AS viewedAnswer, independent, created_at FROM learning_attempts WHERE project_id = ? ORDER BY id DESC LIMIT 20"
    )
    .all(projectId);
  return NextResponse.json({ byKind, recent });
}
