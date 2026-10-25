import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(Number(id)) as
    | Record<string, unknown>
    | undefined;
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const stats = db
    .prepare(
      "SELECT parse_mode, COUNT(*) AS n FROM files WHERE project_id = ? GROUP BY parse_mode"
    )
    .all(Number(id));
  const runs = db
    .prepare(
      "SELECT id, version, kind, status, stage, step, progress_note, recovery_count, updated_at FROM analysis_runs WHERE project_id = ? ORDER BY id DESC LIMIT 10"
    )
    .all(Number(id));
  return NextResponse.json({ project, stats, runs });
}
