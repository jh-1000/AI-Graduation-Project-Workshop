import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** 自测题与定位挑战：只读，按版本过滤。答案随题返回，由前端控制何时揭示。 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();

  const latest = db
    .prepare(
      "SELECT analysis_version FROM practice_items WHERE project_id = ? ORDER BY id DESC LIMIT 1"
    )
    .get(projectId) as { analysis_version: string } | undefined;
  if (!latest) return NextResponse.json({ analysisVersion: null, items: [] });

  const rows = db
    .prepare(
      "SELECT id, kind, slug, prompt, answer, hints, target_file, target_line, status FROM practice_items WHERE project_id = ? AND analysis_version = ? ORDER BY kind, id"
    )
    .all(projectId, latest.analysis_version) as {
    id: number;
    kind: string;
    slug: string;
    prompt: string;
    answer: string | null;
    hints: string | null;
    target_file: string | null;
    target_line: number | null;
    status: string;
  }[];

  return NextResponse.json({
    analysisVersion: latest.analysis_version,
    items: rows.map((p) => ({
      ...p,
      hints: p.hints ? (JSON.parse(p.hints) as string[]) : [],
    })),
  });
}
