import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * 结论层只读端点：claims + 每条结论支撑了哪些证据行。
 * 结论跨版本累积，必须按版本过滤（同 evidence，见 Decision-Register D-2）。
 */
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
        .prepare("SELECT analysis_version FROM claims WHERE project_id = ? ORDER BY id DESC LIMIT 1")
        .get(projectId) as { analysis_version: string } | undefined
    )?.analysis_version;

  if (!version) return NextResponse.json({ analysisVersion: null, claims: [] });

  const claims = db
    .prepare(
      "SELECT id, content, derivation, review_state, confidence, subject_type, subject_id FROM claims WHERE project_id = ? AND analysis_version = ? ORDER BY id LIMIT 200"
    )
    .all(projectId, version) as {
    id: number;
    content: string;
    derivation: string;
    review_state: string;
    confidence: number | null;
    subject_type: string | null;
    subject_id: number | null;
  }[];

  const links = db
    .prepare(
      "SELECT ce.claim_id, ce.support_role, e.id AS evidence_id, e.file_path, e.start_line, e.note FROM claim_evidence ce JOIN claims c ON c.id = ce.claim_id JOIN evidence e ON e.id = ce.evidence_id WHERE c.project_id = ? AND c.analysis_version = ? ORDER BY ce.claim_id, ce.support_role"
    )
    .all(projectId, version) as {
    claim_id: number;
    support_role: string | null;
    evidence_id: number;
    file_path: string;
    start_line: number | null;
    note: string | null;
  }[];

  const byClaim = new Map<number, typeof links>();
  for (const l of links) {
    const arr = byClaim.get(l.claim_id) ?? [];
    arr.push(l);
    byClaim.set(l.claim_id, arr);
  }

  return NextResponse.json({
    analysisVersion: version,
    claims: claims.map((c) => ({ ...c, supports: byClaim.get(c.id) ?? [] })),
  });
}
