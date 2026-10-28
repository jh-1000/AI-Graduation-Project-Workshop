import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** 技术栈学习路径（P3 方向1）：从依赖自动生成的概念链，每条挂到项目真实代码。 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();

  const latest = db
    .prepare("SELECT analysis_version FROM tech_paths WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId) as { analysis_version: string } | undefined;
  if (!latest) return NextResponse.json({ analysisVersion: null, paths: [] });

  const paths = db
    .prepare(
      "SELECT id, tech_name, tech_version, reason FROM tech_paths WHERE project_id = ? AND analysis_version = ? ORDER BY id"
    )
    .all(projectId, latest.analysis_version) as {
    id: number;
    tech_name: string;
    tech_version: string | null;
    reason: string | null;
  }[];

  const itemsStmt = db.prepare(
    "SELECT seq, concept_title, concept_slug, why_needed, project_ref, prereq_item_id FROM tech_path_items WHERE path_id = ? ORDER BY seq"
  );

  return NextResponse.json({
    analysisVersion: latest.analysis_version,
    paths: paths.map((p) => ({
      ...p,
      concepts: itemsStmt.all(p.id) as {
        seq: number;
        concept_title: string;
        concept_slug: string;
        why_needed: string | null;
        project_ref: string | null;
        prereq_item_id: number | null;
      }[],
    })),
  });
}
