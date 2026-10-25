import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** 证据卡：只读。必须按版本过滤——evidence 跨版本累积（见 Decision-Register D-2）。 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();
  const url = new URL(req.url);
  const requested = url.searchParams.get("version");

  const version =
    requested ??
    (
      db
        .prepare(
          "SELECT analysis_version FROM evidence WHERE project_id = ? ORDER BY id DESC LIMIT 1"
        )
        .get(projectId) as { analysis_version: string } | undefined
    )?.analysis_version;

  if (!version) return NextResponse.json({ analysisVersion: null, evidence: [], symbols: [] });

  const evidence = db
    .prepare(
      "SELECT id, file_path, start_line, end_line, origin, processing, freshness, note FROM evidence WHERE project_id = ? AND analysis_version = ? ORDER BY file_path, start_line LIMIT 200"
    )
    .all(projectId, version) as {
    id: number;
    file_path: string;
    start_line: number | null;
    end_line: number | null;
    origin: string;
    processing: string;
    freshness: string;
    note: string | null;
  }[];

  const symbols = db
    .prepare(
      "SELECT s.id, s.name, s.kind, s.line, s.precision, f.path AS file_path FROM symbols s JOIN files f ON f.id = s.file_id WHERE s.project_id = ? AND s.analysis_version = ? ORDER BY f.path, s.line LIMIT 200"
    )
    .all(projectId, version) as {
    id: number;
    name: string;
    kind: string | null;
    line: number | null;
    precision: string;
    file_path: string;
  }[];

  return NextResponse.json({ analysisVersion: version, evidence, symbols });
}