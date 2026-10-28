import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * P5.3 答辩速查包：离线单页 HTML（答辩前一晚打印/手机可看）。
 * 内容：项目一页纸 / 核心业务链卡 / 高频问法+答案要点 / 术语卡 / 代码位置索引。
 * 附带分析版本与生成时间；不导出密钥与不必要源代码。
 */

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as
    | { id: number; name: string; slug: string; stack: string; mission: string | null; defense_date: string | null }
    | undefined;
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const lastRun = db
    .prepare("SELECT version, updated_at FROM analysis_runs WHERE project_id = ? AND kind = 'map' AND status = 'completed' ORDER BY id DESC LIMIT 1")
    .get(projectId) as { version: string; updated_at: string } | undefined;

  const nodes = lastRun
    ? (db
        .prepare("SELECT title, kind, summary, evidence_note, status FROM nodes WHERE project_id = ? AND analysis_version = ? ORDER BY id")
        .all(projectId, lastRun.version) as { title: string; kind: string; summary: string | null; evidence_note: string | null; status: string }[])
    : [];
  const flows = db
    .prepare("SELECT id, slug, title FROM flows WHERE project_id = ? ORDER BY id DESC LIMIT 10")
    .all(projectId) as { id: number; slug: string; title: string }[];
  const allFlows = flows.map((f) => {
    const steps = db
      .prepare("SELECT seq, title, file_path, start_line FROM flow_steps WHERE flow_id = ? ORDER BY seq")
      .all(f.id) as { seq: number; title: string; file_path: string | null; start_line: number | null }[];
    return { title: f.title, steps };
  });
  const terms = db
    .prepare("SELECT title, plain_def, pro_def, pitfall FROM terms WHERE project_id = ? ORDER BY id")
    .all(projectId) as { title: string; plain_def: string | null; pro_def: string | null; pitfall: string | null }[];
  const insights = lastRun
    ? (db
        .prepare("SELECT title, evidence_note FROM repo_insights WHERE project_id = ? AND analysis_version = ? AND kind IN ('health','risk')")
        .all(projectId, lastRun.version) as { title: string; evidence_note: string | null }[])
    : [];

  const stack = (() => {
    try {
      return JSON.parse(project.stack || "{}") as { languages?: string[]; frameworks?: string[] };
    } catch {
      return {};
    }
  })();

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  const flowCards = allFlows
    .map(
      (f) => `<div class="card">
  <h3>流程：${esc(f.title)}</h3>
  <ol>${f.steps.map((s) => `<li><b>${esc(s.title)}</b>${s.file_path ? ` <code>${esc(s.file_path)}:${s.start_line ?? ""}</code>` : ""}</li>`).join("")}</ol>
</div>`
    )
    .join("\n");

  const quiz = nodes
    .filter((n) => n.evidence_note)
    .slice(0, 10)
    .map(
      (n) => `<div class="q"><b>${esc(n.title)}</b>
  <div class="mut">${esc(n.summary ?? "")}</div>
  ${n.evidence_note ? `<code>${esc(n.evidence_note)}</code>` : ""}
</div>`
    )
    .join("\n");

  const termRows = terms
    .map((t) => `<tr><td><b>${esc(t.title)}</b></td><td>${esc(t.plain_def ?? "")}</td><td>${esc(t.pitfall ?? "")}</td></tr>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>答辩速查包 · ${esc(project.name)}</title>
<style>
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1B2A4A;margin:0;padding:32px;background:#fff;max-width:900px;margin-inline:auto}
h1{font-size:24px;border-bottom:3px solid #1B2A4A;padding-bottom:8px}
h2{font-size:16px;background:#1B2A4A;color:#fff;padding:6px 12px;margin-top:28px}
h3{font-size:14px;margin:12px 0 6px}
code{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;background:#EEF1F6;padding:1px 5px;border-radius:4px}
table{width:100%;border-collapse:collapse;font-size:12px}
td,th{border:1px solid #DCE4F0;padding:5px 8px;text-align:left}
th{background:#F2F5FA}
.card{border:1px solid #DCE4F0;border-radius:8px;padding:12px 16px;margin:10px 0}
.mut{color:#5B6B85;font-size:11px}
ol,ul{margin:4px 0;padding-left:22px}
li{margin:3px 0}
.q{border-left:3px solid #B7791F;padding:6px 10px;margin:8px 0;background:#FFFDF7;font-size:12.5px}
@media print{body{padding:12px}.noprint{display:none}}
</style>
</head>
<body>
<h1>答辩速查包 · ${esc(project.name)}</h1>
<p class="mut">生成时间 ${generatedAt} · 分析版本 ${lastRun?.version ?? "—"} · 本页不含密钥与完整源码</p>

<h2>一、项目一页纸</h2>
<p><b>技术栈：</b>${[...(stack.languages ?? []), ...(stack.frameworks ?? [])].map(esc).join(" · ")}</p>
<p><b>答辩任务书：</b>${esc(project.mission ?? "（未填写）")}</p>
<p><b>答辩日期：</b>${esc(project.defense_date ?? "未填写")}</p>

<h2>二、核心业务链</h2>
${flowCards || "<p class='mut'>尚无业务流程（先运行分析）。</p>"}

<h2>三、高频知识点（每条挂证据位置）</h2>
${quiz || "<p class='mut'>尚无知识点。</p>"}

<h2>四、术语速查</h2>
<table><tr><th>术语</th><th>通俗定义</th><th>常见误区</th></tr>${termRows}</table>

<h2>五、评委可能追问的疑似问题（自己先过一遍）</h2>
<ul>${insights.map((i) => `<li><b>${esc(i.title)}</b>${i.evidence_note ? ` <code>${esc(i.evidence_note)}</code>` : ""}</li>`).join("") || "<li class='mut'>暂无</li>"}</ul>

<script>document.title += "（打印版）";</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.slug}-cheatsheet.html"`,
    },
  });
}
