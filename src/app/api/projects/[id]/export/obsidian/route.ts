import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { getDb } from "@/lib/db";

/**
 * P5.2 Obsidian 双链导出。
 * 产物：一个 zip，内含 [[wikilink]] 互通的 Markdown（overview/nodes/flows/terms/claims + MOC 索引）。
 * 丢进任意 vault 即可在 Obsidian 图谱里看到项目知识网络。
 */

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as
    | { id: number; name: string; slug: string; stack: string; mission: string | null; defense_date: string | null }
    | undefined;
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const latestNodes = db
    .prepare("SELECT analysis_version FROM nodes WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId) as { analysis_version: string } | undefined;
  const nodes = latestNodes
    ? (db
        .prepare("SELECT id, slug, title, kind, summary, sections, evidence_note, status FROM nodes WHERE project_id = ? AND analysis_version = ? ORDER BY id")
        .all(projectId, latestNodes.analysis_version) as {
        id: number;
        slug: string;
        title: string;
        kind: string;
        summary: string | null;
        sections: string | null;
        evidence_note: string | null;
        status: string;
      }[])
    : [];
  const flows = db
    .prepare("SELECT id, slug, title, trigger_desc, status FROM flows WHERE project_id = ? ORDER BY id DESC LIMIT 30")
    .all(projectId) as { id: number; slug: string; title: string; trigger_desc: string | null; status: string }[];
  const flowSteps = db
    .prepare(
      `SELECT s.flow_id, s.seq, s.title, s.file_path, s.start_line FROM flow_steps s JOIN flows f ON f.id = s.flow_id
       WHERE f.project_id = ? ORDER BY s.flow_id, s.seq`
    )
    .all(projectId) as { flow_id: number; seq: number; title: string; file_path: string | null; start_line: number | null }[];
  const terms = db
    .prepare("SELECT id, slug, title, plain_def, pro_def, pitfall FROM terms WHERE project_id = ? ORDER BY id")
    .all(projectId) as { id: number; slug: string; title: string; plain_def: string | null; pro_def: string | null; pitfall: string | null }[];
  const claims = db
    .prepare("SELECT content, derivation, review_state FROM claims WHERE project_id = ? ORDER BY id DESC LIMIT 60")
    .all(projectId) as { content: string; derivation: string; review_state: string }[];

  const zip = new AdmZip();
  const slug = project.slug;
  const nodeName = (slugN: string) => `01-知识节点/${slugN}.md`;

  // MOC 索引
  const nodeLinks = nodes.map((n) => `- [[${nodeName(n.slug)}|${n.title}]]（${n.kind} · ${n.status}）`).join("\n");
  const flowLinks = flows.map((f) => `- [[02-业务流程/${f.slug}|${f.title}]]（${f.status}）`).join("\n");
  const termLinks = terms.map((t) => `- [[03-术语/${t.slug}|${t.title}]]`).join("\n");
  zip.addFile(
    "index.md",
    Buffer.from(
      `---\nproject: ${slug}\ntype: moc\n---\n\n# ${project.name} · 知识图谱导出\n\n` +
        `> 由软件项目分析学习系统生成 · 含 [[00-概览]] · 知识节点 ${nodes.length} · 业务流程 ${flows.length} · 术语 ${terms.length} · 结论 ${claims.length}\n\n` +
        `## 知识节点\n${nodeLinks || "（无）"}\n\n## 业务流程\n${flowLinks || "（无）"}\n\n## 术语\n${termLinks || "（无）"}\n`
    )
  );

  // 概览
  zip.addFile(
    "00-概览.md",
    Buffer.from(
      `---\nproject: ${slug}\ntype: overview\n---\n\n# ${project.name}\n\n## 任务书\n${project.mission ?? "（未填写）"}\n\n## 答辩日期\n${project.defense_date ?? "（未填写）"}\n\n## 技术栈\n${project.stack}\n\n## 关联\n- [[index]]\n${nodes.slice(0, 8).map((n) => `- [[${nodeName(n.slug)}|${n.title}]]`).join("\n")}\n`
    )
  );

  // 知识节点（十段/分段展开为正文）
  for (const n of nodes) {
    let body = `---\nproject: ${slug}\ntype: node\nkind: ${n.kind}\nstatus: ${n.status}\n---\n\n# ${n.title}\n\n${n.summary ?? ""}\n`;
    if (n.sections) {
      try {
        for (const s of JSON.parse(n.sections) as { heading: string; body: string }[]) {
          body += `\n## ${s.heading}\n\n${s.body}\n`;
        }
      } catch {
        /* sections 解析失败则只输出摘要 */
      }
    }
    if (n.evidence_note) body += `\n> 证据：${n.evidence_note}\n`;
    zip.addFile(nodeName(n.slug), Buffer.from(body));
  }

  // 业务流程
  for (const f of flows) {
    const steps = flowSteps
      .filter((s) => s.flow_id === f.id)
      .map((s) => `${s.seq}. **${s.title}**${s.file_path ? ` — \`${s.file_path}:${s.start_line ?? ""}\`` : ""}`)
      .join("\n");
    zip.addFile(
      `02-业务流程/${f.slug}.md`,
      Buffer.from(`---\nproject: ${slug}\ntype: flow\n---\n\n# ${f.title}\n\n${steps}\n`)
    );
  }

  // 术语
  for (const t of terms) {
    zip.addFile(
      `03-术语/${t.slug}.md`,
      Buffer.from(
        `---\nproject: ${slug}\ntype: term\n---\n\n# ${t.title}\n\n## 先说人话\n${t.plain_def ?? "—"}\n\n## 专业定义\n${t.pro_def ?? "—"}\n\n## 常见误区\n${t.pitfall ?? "—"}\n`
      )
    );
  }

  // 结论层
  zip.addFile(
    "04-结论.md",
    Buffer.from(
      `---\nproject: ${slug}\ntype: claims\n---\n\n# 结论层\n\n${claims
        .map((c) => `- **[${c.review_state}]** ${c.content}（${c.derivation}）`)
        .join("\n")}\n`
    )
  );

  const buf = zip.toBuffer();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-obsidian.zip"`,
    },
  });
}
