import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { chatJSON } from "@/lib/llm/client";
import fs from "node:fs";
import path from "node:path";

/**
 * 换一种写法对比器（升级 3）。
 * 给定知识点关联的代码位置，LLM 生成 2-3 种替代实现 + 各自 tradeoff。
 * 帮助学习者理解「为什么 AI 选了这种写法」——答辩必问。
 */

const AltSchema = z.object({
  alternatives: z.array(
    z.object({
      name: z.string().describe("方案名称，如 回调版 / async-await 版 / ORM 版"),
      code: z.string().describe("替代实现的关键代码（不是完整文件，是核心段）"),
      pros: z.array(z.string()).min(1),
      cons: z.array(z.string()).min(1),
      chosen: z.boolean().describe("是否是当前项目采用的方案"),
    })
  ).min(2).max(3),
  insight: z.string().describe("一句话总结：当前方案为什么适合这个项目"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const body = (await req.json()) as { nodeId?: number; filePath?: string; startLine?: number; endLine?: number };
  if (!body.nodeId || !body.filePath) {
    return NextResponse.json({ error: "需要 nodeId 和 filePath" }, { status: 400 });
  }

  const db = getDb();
  const project = db.prepare("SELECT root_path, stack FROM projects WHERE id = ?").get(projectId) as
    | { root_path: string; stack: string }
    | undefined;
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (!db.prepare("SELECT value FROM settings WHERE key = 'llm_api_key'").get()) {
    return NextResponse.json({ error: "未配置 API Key：替代实现需要模型生成" }, { status: 400 });
  }

  // 读源码片段
  const root = fs.realpathSync(project.root_path);
  const abs = path.resolve(root, body.filePath);
  let code = "";
  try {
    const real = fs.realpathSync(abs);
    if (!real.startsWith(root)) return NextResponse.json({ error: "越界访问" }, { status: 403 });
    code = fs.readFileSync(real, "utf8");
    if (body.startLine && body.endLine) {
      const lines = code.split("\n");
      code = lines.slice(body.startLine - 1, body.endLine).join("\n");
    }
    if (code.length > 6000) code = code.slice(0, 6000) + "\n// ... (truncated)";
  } catch {
    return NextResponse.json({ error: "读取文件失败" }, { status: 404 });
  }

  const node = db.prepare("SELECT title, summary FROM nodes WHERE id = ?").get(body.nodeId) as
    | { title: string; summary: string | null }
    | undefined;

  const system =
    "你是资深架构师，正在帮一个 AI 辅助开发者理解代码设计决策。\n" +
    "给定一段当前项目的代码实现，请生成 2-3 种替代实现方案。\n" +
    "每种方案：给核心代码（不是完整文件，是关键差异段）、列出优点和缺点。\n" +
    "标记哪种是当前项目采用的方案。\n" +
    "最后用一句话总结：当前方案为什么适合这个项目。\n" +
    "严格输出 JSON，必须使用精确英文字段名：\n" +
    '{"alternatives":[{"name":"...","code":"...","pros":["..."],"cons":["..."],"chosen":true|false}],"insight":"..."}\n' +
    "只输出这个 JSON 对象，不要输出其他文字。";

  const user =
    `概念：${node?.title ?? "未知"}\n` +
    `当前实现（${body.filePath}:${body.startLine ?? "?"}）：\n\`\`\`\n${code}\n\`\`\`\n` +
    `项目技术栈：${project.stack}\n` +
    "请生成 2-3 种替代实现方案，标记哪种是当前项目采用的。";

  try {
    const { data } = await chatJSON({ system, user, schema: AltSchema, maxRetries: 1 });
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 300) : String(err) },
      { status: 502 }
    );
  }
}
