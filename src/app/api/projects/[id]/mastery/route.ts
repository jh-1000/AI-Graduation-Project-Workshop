import { NextRequest, NextResponse } from "next/server";
import { fsrs, createEmptyCard, Rating, type Card, type Grade } from "ts-fsrs";
import { getDb } from "@/lib/db";

/**
 * 掌握度与 FSRS 复习调度（设计依据：DES-learning「掌握判定与复习调度分离」）。
 * GET  : 返回节点掌握状态与到期队列（due <= now）
 * POST : { nodeId, rating: 'again'|'hard'|'good'|'easy', independent?: boolean }
 *        - rating 只驱动 FSRS 调度（下次 due / stability / difficulty）
 *        - independent 由前端根据「是否用提示/是否看过答案」传入，决定掌握态升级；
 *          FSRS 成功本身不等于掌握（同一题重复答对不虚增证据）
 */

const scheduler = fsrs({ enable_fuzz: false });

const GRADE: Record<string, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT m.node_id, m.status, m.due, m.reps, m.lapses, m.stability, m.difficulty,
              n.title, n.slug, n.kind, n.evidence_note, n.summary
       FROM node_mastery m JOIN nodes n ON n.id = m.node_id
       WHERE m.project_id = ? ORDER BY m.due`
    )
    .all(projectId) as {
    node_id: number;
    status: string;
    due: string;
    reps: number;
    lapses: number;
    stability: number;
    difficulty: number;
    title: string;
    slug: string;
    kind: string;
    evidence_note: string | null;
    summary: string | null;
  }[];

  const now = new Date();
  const due = rows.filter((r) => new Date(r.due.replace(" ", "T")) <= now);

  return NextResponse.json({
    items: rows,
    due: due.map((r) => ({
      nodeId: r.node_id,
      title: r.title,
      slug: r.slug,
      kind: r.kind,
      status: r.status,
      evidenceNote: r.evidence_note,
      summary: r.summary,
    })),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const body = (await req.json()) as {
    nodeId?: number;
    rating?: string;
    independent?: boolean;
  };
  if (!body.nodeId || !body.rating || !GRADE[body.rating]) {
    return NextResponse.json({ error: "需要 nodeId 与 rating(again|hard|good|easy)" }, { status: 400 });
  }

  const db = getDb();
  const node = db
    .prepare("SELECT id, title FROM nodes WHERE id = ? AND project_id = ?")
    .get(body.nodeId, projectId) as { id: number; title: string } | undefined;
  if (!node) return NextResponse.json({ error: "节点不存在" }, { status: 404 });

  const prev = db
    .prepare("SELECT * FROM node_mastery WHERE project_id = ? AND node_id = ?")
    .get(projectId, node.id) as
    | {
        status: string;
        due: string;
        reps: number;
        lapses: number;
        stability: number;
        difficulty: number;
        last_reviewed: string | null;
      }
    | undefined;

  const card: Card = prev
    ? {
        ...createEmptyCard(new Date(prev.last_reviewed ?? Date.now())),
        due: new Date(prev.due.replace(" ", "T")),
        stability: prev.stability,
        difficulty: prev.difficulty,
        reps: prev.reps,
        lapses: prev.lapses,
        last_review: prev.last_reviewed ? new Date(prev.last_reviewed.replace(" ", "T")) : new Date(),
        state: prev.status === "mastered" ? 2 : prev.status === "learning" ? 1 : 0,
      }
    : createEmptyCard(new Date());

  const now = new Date();
  const result = scheduler.next(card, now, GRADE[body.rating]);
  const nextCard = result.card;

  // 掌握判定与调度分离：独立答对 good/easy 才升级；again 降级
  let status = prev?.status ?? "unlearned";
  const independent = body.independent !== false;
  if (body.rating === "again") status = "learning";
  else if (independent && (body.rating === "good" || body.rating === "easy")) {
    status = nextCard.reps >= 2 ? "mastered" : "learning";
  } else if (status === "unlearned") status = "learning";

  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  db.prepare(
    `INSERT INTO node_mastery (project_id, node_id, status, stability, difficulty, due, reps, lapses, last_reviewed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, node_id) DO UPDATE SET
       status = excluded.status, stability = excluded.stability, difficulty = excluded.difficulty,
       due = excluded.due, reps = excluded.reps, lapses = excluded.lapses,
       last_reviewed = excluded.last_reviewed, updated_at = datetime('now','localtime')`
  ).run(
    projectId,
    node.id,
    status,
    nextCard.stability,
    nextCard.difficulty,
    fmt(nextCard.due),
    nextCard.reps,
    nextCard.lapses,
    fmt(now)
  );

  return NextResponse.json({
    ok: true,
    status,
    due: fmt(nextCard.due),
    reps: nextCard.reps,
    intervalDays: Math.max(0, Math.round((nextCard.due.getTime() - now.getTime()) / 86400000)),
  });
}
