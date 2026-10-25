import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** 业务流程 + 步骤：只读。按版本过滤，缺省取该项目最新 map 版本。 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();

  const latest = db
    .prepare(
      "SELECT analysis_version FROM flows WHERE project_id = ? ORDER BY id DESC LIMIT 1"
    )
    .get(projectId) as { analysis_version: string } | undefined;

  if (!latest) return NextResponse.json({ analysisVersion: null, flows: [] });

  const flows = db
    .prepare(
      "SELECT id, slug, title, trigger_desc, confidence, status FROM flows WHERE project_id = ? AND analysis_version = ? ORDER BY id"
    )
    .all(projectId, latest.analysis_version) as {
    id: number;
    slug: string;
    title: string;
    trigger_desc: string | null;
    confidence: number | null;
    status: string;
  }[];

  const steps = db
    .prepare(
      `SELECT s.flow_id, s.seq, s.title, s.file_path, s.start_line, s.note
       FROM flow_steps s JOIN flows f ON f.id = s.flow_id
       WHERE f.project_id = ? AND f.analysis_version = ? ORDER BY s.flow_id, s.seq`
    )
    .all(projectId, latest.analysis_version) as {
    flow_id: number;
    seq: number;
    title: string;
    file_path: string | null;
    start_line: number | null;
    note: string | null;
  }[];

  return NextResponse.json({
    analysisVersion: latest.analysis_version,
    flows: flows.map((f) => ({ ...f, steps: steps.filter((s) => s.flow_id === f.id) })),
  });
}
