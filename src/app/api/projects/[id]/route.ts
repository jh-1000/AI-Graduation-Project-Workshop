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

  // 最新一次 map 版本的 repo_insights / coverage_stats / open_questions / edges
  const lastMap = db
    .prepare("SELECT version FROM analysis_runs WHERE project_id = ? AND kind = 'map' AND status = 'completed' ORDER BY id DESC LIMIT 1")
    .get(Number(id)) as { version: string } | undefined;

  let insights: unknown[] = [];
  let coverage: unknown[] = [];
  let openQuestions: unknown[] = [];
  let history: unknown[] = [];
  let edgeCount = 0;

  if (lastMap) {
    insights = db
      .prepare("SELECT kind, title, content, evidence_note FROM repo_insights WHERE project_id = ? AND analysis_version = ? ORDER BY kind, id")
      .all(Number(id), lastMap.version);
    coverage = db
      .prepare("SELECT dim, target_n, done_n, failed_n, skipped_n, note FROM coverage_stats WHERE project_id = ? AND analysis_version = ?")
      .all(Number(id), lastMap.version);
    openQuestions = db
      .prepare("SELECT question, why, next_check, created_at FROM open_questions WHERE project_id = ? AND analysis_version = ? ORDER BY id DESC LIMIT 20")
      .all(Number(id), lastMap.version);
    edgeCount = (db.prepare("SELECT COUNT(*) as n FROM edges WHERE project_id = ? AND analysis_version = ?").get(Number(id), lastMap.version) as { n: number }).n;
    history = db
      .prepare("SELECT commit_hash, author, committed_at, subject, files FROM history_events WHERE project_id = ? ORDER BY committed_at DESC LIMIT 60")
      .all(Number(id));
  }

  return NextResponse.json({
    project,
    stats,
    runs,
    insights,
    coverage,
    openQuestions,
    edgeCount,
    history,
    counts: {
      files: (db.prepare("SELECT COUNT(*) n FROM files WHERE project_id = ?").get(Number(id)) as { n: number }).n,
      symbols: (db.prepare("SELECT COUNT(*) n FROM symbols WHERE project_id = ?").get(Number(id)) as { n: number }).n,
      evidence: (db.prepare("SELECT COUNT(*) n FROM evidence WHERE project_id = ?").get(Number(id)) as { n: number }).n,
      claims: (db.prepare("SELECT COUNT(*) n FROM claims WHERE project_id = ?").get(Number(id)) as { n: number }).n,
      nodes: (db.prepare("SELECT COUNT(*) n FROM nodes WHERE project_id = ?").get(Number(id)) as { n: number }).n,
      flows: (db.prepare("SELECT COUNT(*) n FROM flows WHERE project_id = ?").get(Number(id)) as { n: number }).n,
      terms: (db.prepare("SELECT COUNT(*) n FROM terms WHERE project_id = ?").get(Number(id)) as { n: number }).n,
      practice: (db.prepare("SELECT COUNT(*) n FROM practice_items WHERE project_id = ?").get(Number(id)) as { n: number }).n,
      insights: (db.prepare("SELECT COUNT(*) n FROM repo_insights WHERE project_id = ?").get(Number(id)) as { n: number }).n,
    },
    llmCache: {
      entries: (db.prepare("SELECT COUNT(*) n FROM llm_cache").get() as { n: number }).n,
      hasKey: Boolean(db.prepare("SELECT value FROM settings WHERE key = 'llm_api_key'").get()),
    },
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const body = (await req.json()) as {
    mission?: string;
    defenseDate?: string;
    allowModify?: boolean;
  };
  const db = getDb();
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  // Auth-L5 前置：修改授权是项目级开关，默认关
  if (typeof body.mission === "string") db.prepare("UPDATE projects SET mission = ? WHERE id = ?").run(body.mission, projectId);
  if (typeof body.defenseDate === "string") db.prepare("UPDATE projects SET defense_date = ? WHERE id = ?").run(body.defenseDate, projectId);
  if (typeof body.allowModify === "boolean") db.prepare("UPDATE projects SET allow_modify = ? WHERE id = ?").run(body.allowModify ? 1 : 0, projectId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();
  // 先清派生数据再删项目本身
  const tables = ["learning_attempts","node_mastery","runtime_proofs","fact_conflicts","user_corrections","challenge_runs","challenges","flow_steps","flows","nodes","practice_items","terms","term_relations","repo_insights","history_events","coverage_stats","open_questions","claim_evidence","claim_dependencies","claims","edges","symbols","evidence","run_files","files","analysis_runs"];
  for (const t of tables) {
    try { db.prepare(`DELETE FROM ${t} WHERE project_id = ?`).run(projectId); } catch { /* 表可能不存在 */ }
  }
  db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  return NextResponse.json({ ok: true });
}
