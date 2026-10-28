import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** 术语卡片：只读。terms 以 (project_id, slug) 唯一，跨版本 upsert，故不按版本过滤。 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();

  const rows = db
    .prepare(
      "SELECT id, slug, title, plain_def, pro_def, example, pitfall, avoid_aliases, category, usage, status FROM terms WHERE project_id = ? ORDER BY id"
    )
    .all(projectId) as {
    id: number;
    slug: string;
    title: string;
    plain_def: string | null;
    pro_def: string | null;
    example: string | null;
    pitfall: string | null;
    avoid_aliases: string | null;
    category: string | null;
    usage: string | null;
    status: string;
  }[];

  const rels = db
    .prepare(
      `SELECT tr.term_id, tr.target_id, tr.note FROM term_relations tr
       WHERE tr.related_type = 'confused_with' AND tr.term_id IN (SELECT id FROM terms WHERE project_id = ?)`
    )
    .all(projectId) as { term_id: number; target_id: number; note: string | null }[];
  const titleById = new Map(rows.map((t) => [t.id, t.title]));
  const confusions: Record<number, { other: string; rows: { dim: string; a: string; b: string }[] }> = {};
  for (const r of rels) {
    try {
      const parsed = r.note ? (JSON.parse(r.note) as { dim: string; a: string; b: string }[]) : [];
      const otherTitle = titleById.get(r.target_id) ?? `#${r.target_id}`;
      confusions[r.term_id] = { other: otherTitle, rows: parsed };
    } catch {
      /* 忽略坏数据 */
    }
  }

  return NextResponse.json({
    terms: rows.map((t) => ({
      ...t,
      avoid_aliases: t.avoid_aliases ? (JSON.parse(t.avoid_aliases) as string[]) : [],
      confusion: confusions[t.id] ?? null,
    })),
  });
}
