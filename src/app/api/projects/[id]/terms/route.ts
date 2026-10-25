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

  return NextResponse.json({
    terms: rows.map((t) => ({
      ...t,
      avoid_aliases: t.avoid_aliases ? (JSON.parse(t.avoid_aliases) as string[]) : [],
    })),
  });
}
