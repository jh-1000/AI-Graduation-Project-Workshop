import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** 知识节点：只读，按版本过滤，缺省取最新版本。 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();

  const latest = db
    .prepare("SELECT analysis_version FROM nodes WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId) as { analysis_version: string } | undefined;
  if (!latest) return NextResponse.json({ analysisVersion: null, nodes: [] });

  const rows = db
    .prepare(
      "SELECT id, slug, title, kind, summary, sections, evidence_note, status FROM nodes WHERE project_id = ? AND analysis_version = ? ORDER BY id"
    )
    .all(projectId, latest.analysis_version) as {
    id: number;
    slug: string;
    title: string;
    kind: string;
    summary: string | null;
    sections: string | null;
    evidence_note: string | null;
    status: string;
  }[];

  return NextResponse.json({
    analysisVersion: latest.analysis_version,
    nodes: rows.map((n) => ({
      ...n,
      sections: n.sections ? (JSON.parse(n.sections) as { heading: string; body: string }[]) : [],
    })),
  });
}
