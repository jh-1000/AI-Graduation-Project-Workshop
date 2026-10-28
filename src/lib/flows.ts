import { getDb } from "./db";
import type { Endpoint } from "./scan";

/** 业务流程的确定性追踪：不依赖 LLM，只用端点/调用点/表定义三类静态锚点 */
export type FlowStepDraft = {
  title: string;
  file: string | null;
  line: number | null;
  note: string | null;
};

export type FlowDraft = {
  slug: string;
  title: string;
  triggerDesc: string | null;
  steps: FlowStepDraft[];
};

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** 把 "POST /api/tasks" 变成稳定 slug："post-api-tasks" */
function slugOf(method: string, routePath: string): string {
  const tail = routePath
    .replace(/[:*][A-Za-z0-9_]*/g, "")
    .split("/")
    .filter(Boolean)
    .join("-");
  return `${method.toLowerCase()}-${tail || "root"}`;
}

/** 资源名：/api/tasks 或 /api/tasks/:id → tasks */
function resourceOf(routePath: string): string {
  const segs = routePath.split("/").filter((s) => s && !s.startsWith(":"));
  return (segs[segs.length - 1] ?? "").toLowerCase();
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

/** 调用点所在函数名：向上找最近的 function 声明或 const 箭头函数 */
function enclosingFunction(content: string, callIndex: number): { name: string; line: number } | null {
  const before = content.slice(0, callIndex);
  const lines = before.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = lines[i].match(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m) return { name: m[1], line: i + 1 };
    const a = lines[i].match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/);
    if (a) return { name: a[1], line: i + 1 };
  }
  return null;
}

/**
 * 从端点推导业务流程。只追踪「写操作端点」，按 触发 → 处理函数 → 调用点 → 服务端 → 表 → 响应 顺序排列。
 * contents 是本次已读入内存的文本文件正文（rel → content），不重复读盘。
 */
export function detectFlows(endpoints: Endpoint[], contents: Map<string, string>): FlowDraft[] {
  const drafts: FlowDraft[] = [];
  // 同文件内端点按行号排序，用于界定「本 handler 的搜索窗口」——不越过下一个端点
  const epLines = new Map<string, number[]>();
  for (const ep of endpoints) {
    const list = epLines.get(ep.file) ?? [];
    list.push(ep.line);
    epLines.set(ep.file, list);
  }
  for (const list of epLines.values()) list.sort((a, b) => a - b);
  const sqlTables = new Map<string, { file: string; line: number }>();
  for (const [rel, content] of contents) {
    if (!rel.endsWith(".sql")) continue;
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      sqlTables.set(m[1].toLowerCase(), { file: rel, line: lineAt(content, m.index) });
    }
  }

  // 同一 method+path 可能出现在多个文件（重复声明/多实例），slug 在库里有唯一约束，只保留首条
  const seen = new Set<string>();
  for (const ep of endpoints) {
    if (!MUTATING.has(ep.method)) continue;
    const slug = slugOf(ep.method, ep.path);
    if (seen.has(slug)) continue;
    const steps: FlowStepDraft[] = [];

    // ① 前端调用点：任一文本文件里出现该路径字面量（fetch/axios 均可）
    let callSite: { file: string; line: number } | null = null;
    let handler: { name: string; line: number } | null = null;
    for (const [rel, content] of contents) {
      if (rel === ep.file || !/\.(ts|tsx|js|jsx|mjs|cjs|vue)$/.test(rel)) continue;
      const idx = content.indexOf(`"${ep.path}"`);
      const idx2 = idx < 0 ? content.indexOf(`'${ep.path}'`) : idx;
      const at = idx >= 0 ? idx : idx2;
      if (at < 0) continue;
      callSite = { file: rel, line: lineAt(content, at) };
      handler = enclosingFunction(content, at);
      break;
    }

    // ② UI 触发点：onClick 引用该处理函数
    let trigger: { file: string; line: number } | null = null;
    if (callSite && handler) {
      const content = contents.get(callSite.file);
      if (content) {
        const m = content.match(new RegExp(`onClick=\\{\\s*${handler.name}\\s*\\}`));
        if (m && m.index !== undefined) trigger = { file: callSite.file, line: lineAt(content, m.index) };
      }
    }

    if (trigger) steps.push({ title: "用户触发前端事件", file: trigger.file, line: trigger.line, note: "event handler" });

    // ②b UI 触发点扩展：onSubmit / addEventListener / form action
    if (!trigger) {
      for (const [rel, content] of contents) {
        if (!/\.(ts|tsx|js|jsx|vue)$/.test(rel)) continue;
        const fnRef = handler?.name ? content.indexOf(handler.name) : -1;
        if (fnRef < 0) continue;
        const sub = content.slice(0, fnRef);
        const trig = sub.match(/on(?:Submit|Click|Change|Blur)\s*=|addEventListener\s*\(\s*["'](submit|click|change)["']/);
        if (trig) {
          const line = lineAt(content, trig.index ?? 0);
          trigger = { file: rel, line };
          break;
        }
      }
    }
    if (handler && callSite) {
      steps.push({ title: `${handler.name} 组装请求`, file: callSite.file, line: handler.line, note: "handler" });
      steps.push({ title: `发起 ${ep.method} ${ep.path}`, file: callSite.file, line: callSite.line, note: "request" });
    }
    steps.push({ title: `服务端处理 ${ep.method} ${ep.path}`, file: ep.file, line: ep.line, note: "endpoint" });

    // ③ 数据表：资源名与 CREATE TABLE 名匹配
    const res = resourceOf(ep.path);
    const table = sqlTables.get(res) ?? sqlTables.get(res.replace(/s$/, ""));
    if (table) steps.push({ title: `读写 ${res} 表`, file: table.file, line: table.line, note: "table" });

    // ③b ORM 操作检测（prisma / mongoose / sequelize / drizzle / typeorm / knex / supabase）
    const ormPats = [
      /prisma\.[\w.]+(?:create|findMany|findUnique|findFirst|update|delete|upsert|aggregate)/i,
      /(?:db|database)\.(?:collection|model)\.[\w]+\s*\(/i,
      /(?:sequelize|knex|drizzle|typeorm|supabase)\.[\w.]+\s*\(/i,
      /\.(?:insertOne|insertMany|findOne|findMany|updateOne|updateMany|deleteOne|deleteMany)\s*\(/,
    ];
    for (const [rel, content] of contents) {
      if (rel === ep.file) continue;
      const lines = content.split("\n");
      for (const pat of ormPats) {
        for (let li = 0; li < lines.length; li++) {
          if (pat.test(lines[li])) {
            steps.push({ title: `ORM 操作（${rel.split("/").pop()}）`, file: rel, line: li + 1, note: "orm" });
            break;
          }
        }
        if (steps.some((s) => s.note === "orm")) break;
      }
      if (steps.some((s) => s.note === "orm")) break;
    }

    // ④ 响应：端点所在文件里该 handler 块内的 res.status/res.json/NextResponse.json/Response.json 最后一次出现
    const serverContent = contents.get(ep.file);
    if (serverContent) {
      const lines = serverContent.split("\n");
      const next = (epLines.get(ep.file) ?? []).find((l) => l > ep.line) ?? ep.line + 41;
      const end = Math.min(lines.length, next - 1, ep.line + 40);
      let last = -1;
      for (let i = ep.line - 1; i < end; i += 1) {
        if (/res\.(status|json)\s*\(/.test(lines[i])) last = i + 1;
      }
      if (last > 0) steps.push({ title: "返回响应", file: ep.file, line: last, note: "response" });
    }

    if (steps.length < 2) continue; // 少于两步不成流程
    seen.add(slug);
    drafts.push({
      slug,
      title: `${ep.method} ${ep.path} 写入流程`,
      triggerDesc: trigger ? `前端 ${callSite?.file}` : null,
      steps,
    });
  }
  return drafts;
}

export type FlowPersistResult = { inserted: number; skipped: number };

/** 业务流程落库：同项目同版本整体替换（先删后插，幂等） */
export function persistFlows(
  projectId: number,
  analysisVersion: string,
  drafts: FlowDraft[]
): FlowPersistResult {
  const db = getDb();
  const delFlows = db.prepare("DELETE FROM flows WHERE project_id = ? AND analysis_version = ?");
  const delSteps = db.prepare("DELETE FROM flow_steps WHERE project_id = ? AND flow_id NOT IN (SELECT id FROM flows WHERE project_id = ?)");
  const insFlow = db.prepare(
    "INSERT INTO flows (project_id, analysis_version, slug, title, trigger_desc, confidence) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insStep = db.prepare(
    "INSERT INTO flow_steps (flow_id, project_id, seq, title, file_path, start_line, end_line, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  let inserted = 0;
  let skipped = 0;
  db.transaction(() => {
    delFlows.run(projectId, analysisVersion);
    delSteps.run(projectId, projectId);
    const insertedSlugs = new Set<string>();
    for (const d of drafts) {
      if (d.steps.length === 0 || insertedSlugs.has(d.slug)) {
        skipped++;
        continue;
      }
      insertedSlugs.add(d.slug);
      const info = insFlow.run(projectId, analysisVersion, d.slug, d.title, d.triggerDesc, 0.8);
      const flowId = Number(info.lastInsertRowid);
      d.steps.forEach((s, i) => {
        insStep.run(flowId, projectId, i + 1, s.title, s.file, s.line, s.line, s.note);
      });
      inserted++;
    }
  })();
  return { inserted, skipped };
}