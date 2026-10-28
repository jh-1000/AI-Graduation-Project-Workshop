import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * 知识图谱数据（八类节点 + 关系边）。
 * 设计依据：GRAPH（2D/3D 双视图、八类全量）——节点来自真实表，不造数据。
 * 节点类型：knowledge(按 nodes.kind) / flow / term / file
 * 边：file→file(IMPORTS)、flow→file(步骤涉及)、node→file(evidence_note 解析)、term→term/relates
 */

type NodeOut = {
  id: string;
  label: string;
  type: string;
  weight: number;
  status: string;
  href: string;
  meta: string;
  stale?: boolean;
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();
  const project = db.prepare("SELECT id, name, stack FROM projects WHERE id = ?").get(projectId) as
    | { id: number; name: string; stack: string }
    | undefined;
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const base = `/project/${projectId}`;
  const nodes: NodeOut[] = [];
  const edges: { from: string; to: string; kind: string }[] = [];

  const latestNodes = db
    .prepare("SELECT analysis_version FROM nodes WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId) as { analysis_version: string } | undefined;

  if (latestNodes) {
    const rows = db
      .prepare(
        "SELECT id, slug, title, kind, summary, evidence_note, status FROM nodes WHERE project_id = ? AND analysis_version = ? ORDER BY id"
      )
      .all(projectId, latestNodes.analysis_version) as {
      id: number;
      slug: string;
      title: string;
      kind: string;
      summary: string | null;
      evidence_note: string | null;
      status: string;
    }[];
    // 失效视图数据源：节点证据指向的文件若在最新版本中已 stale，则节点标 stale
    const staleFiles = new Set(
      (
        db
          .prepare(
            "SELECT DISTINCT file_path FROM evidence WHERE project_id = ? AND freshness = 'stale'"
          )
          .all(projectId) as { file_path: string }[]
      ).map((r) => r.file_path)
    );
    for (const n of rows) {
      const evPath = (n.evidence_note ?? "").match(/([\w./-]+\.(?:ts|tsx|js|jsx|py|java|go|sql|json|md|vue))(?::\d+)?/)?.[1];
      nodes.push({
        id: `k:${n.id}`,
        label: n.title,
        type: `k_${n.kind}`,
        weight: 10,
        status: n.status === "confirmed" ? "mastered" : "new",
        href: `${base}/node?slug=${encodeURIComponent(n.slug)}`,
        meta: n.summary ?? "",
        stale: evPath ? staleFiles.has(evPath) : false,
      });
    }
  }

  const flows = db
    .prepare(
      "SELECT id, slug, title, status FROM flows WHERE project_id = ? ORDER BY id DESC LIMIT 20"
    )
    .all(projectId) as { id: number; slug: string; title: string; status: string }[];
  for (const f of flows) {
    nodes.push({
      id: `fl:${f.id}`,
      label: f.title,
      type: "flow",
      weight: 14,
      status: f.status === "confirmed" ? "mastered" : "learning",
      href: `${base}/flow?slug=${encodeURIComponent(f.slug)}`,
      meta: "业务流程",
    });
  }

  const terms = db
    .prepare("SELECT id, slug, title, category FROM terms WHERE project_id = ? ORDER BY id LIMIT 80")
    .all(projectId) as { id: number; slug: string; title: string; category: string | null }[];
  for (const t of terms) {
    nodes.push({
      id: `t:${t.id}`,
      label: t.title,
      type: "term",
      weight: 7,
      status: "new",
      href: `${base}/kb?term=${encodeURIComponent(t.slug)}`,
      meta: t.category ?? "术语",
    });
  }

  const files = db
    .prepare("SELECT id, path, loc FROM files WHERE project_id = ? ORDER BY loc DESC LIMIT 300")
    .all(projectId) as { id: number; path: string; loc: number }[];
  const fileIdByPath = new Map(files.map((f) => [f.path, f.id]));
  for (const f of files) {
    nodes.push({
      id: `f:${f.id}`,
      label: f.path.split("/").pop() ?? f.path,
      type: "file",
      weight: Math.max(5, Math.min(12, Math.round(Math.log2((f.loc || 10) + 2) * 1.5))),
      status: "none",
      href: `${base}/code?path=${encodeURIComponent(f.path)}`,
      meta: `${f.path} · ${f.loc} 行`,
    });
  }

  // 边：file→file IMPORTS（静态引用图）
  const latestEdges = db
    .prepare("SELECT analysis_version FROM edges WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId) as { analysis_version: string } | undefined;
  if (latestEdges) {
    const rows = db
      .prepare(
        "SELECT from_type, from_id, to_type, to_id, kind FROM edges WHERE project_id = ? AND analysis_version = ?"
      )
      .all(projectId, latestEdges.analysis_version) as {
      from_type: string;
      from_id: number;
      to_type: string;
      to_id: number;
      kind: string;
    }[];
    for (const e of rows) {
      if (e.kind === "IMPORTS" && e.from_type === "file" && e.to_type === "file") {
        edges.push({ from: `f:${e.from_id}`, to: `f:${e.to_id}`, kind: "IMPORTS" });
      }
    }
  }

  // 边：flow→file（步骤涉及的文件）
  const steps = db
    .prepare(
      `SELECT s.flow_id, s.file_path FROM flow_steps s JOIN flows f ON f.id = s.flow_id
       WHERE f.project_id = ? AND s.file_path IS NOT NULL`
    )
    .all(projectId) as { flow_id: number; file_path: string }[];
  for (const s of steps) {
    const fid = fileIdByPath.get(s.file_path);
    if (fid) edges.push({ from: `fl:${s.flow_id}`, to: `f:${fid}`, kind: "TRACES" });
  }

  // 边：node→file（evidence_note 里的 path:line）
  if (latestNodes) {
    const rows = db
      .prepare("SELECT id, evidence_note FROM nodes WHERE project_id = ? AND analysis_version = ?")
      .all(projectId, latestNodes.analysis_version) as { id: number; evidence_note: string | null }[];
    for (const n of rows) {
      const m = (n.evidence_note ?? "").match(/([\w./-]+\.(?:ts|tsx|js|jsx|py|java|go|sql|json|md|vue))(?::(\d+))?/);
      if (!m) continue;
      const fid = fileIdByPath.get(m[1]);
      if (fid) edges.push({ from: `k:${n.id}`, to: `f:${fid}`, kind: "EXPLAINS" });
    }
  }

  // 掌握度
  const masteryRows = db
    .prepare("SELECT node_id, status, due FROM node_mastery WHERE project_id = ?")
    .all(projectId) as { node_id: number; status: string; due: string }[];
  const mastery: Record<string, { status: string; due: string }> = {};
  for (const m of masteryRows) mastery[`k:${m.node_id}`] = { status: m.status, due: m.due };

  return NextResponse.json({
    project: { id: project.id, name: project.name },
    nodes,
    edges,
    mastery,
  });
}
