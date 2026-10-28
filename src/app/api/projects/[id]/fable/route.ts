import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { chatJSON } from "@/lib/llm/client";

/**
 * 寓言卡生成（设计依据：node-page F-4 固定四段）
 * 先讲故事不点破 → 反转揭晓 → 映射解释 → 回到项目（含"类比不成立之处"）。
 * 产物追加到 nodes.sections（heading="寓言卡"），可重复生成覆盖同一条。
 */

const FableSchema = z.object({
  story: z.string().describe("寓言故事正文，不要提前出现技术概念"),
  reveal: z.string().describe("揭晓：这个故事其实在讲什么概念"),
  mapping: z
    .array(z.object({ story_element: z.string(), concept: z.string() }))
    .describe("故事元素与概念的逐项对应"),
  backToProject: z.string().describe("回到本项目：这个概念在项目里的真实实现位置与用法"),
  limitations: z.array(z.string()).describe("类比在哪些地方不成立，至少 2 条"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const body = (await req.json()) as { nodeId?: number };
  if (!body.nodeId) return NextResponse.json({ error: "缺少 nodeId" }, { status: 400 });

  const db = getDb();
  const node = db
    .prepare("SELECT id, title, kind, summary, sections, evidence_note FROM nodes WHERE id = ? AND project_id = ?")
    .get(body.nodeId, projectId) as
    | { id: number; title: string; kind: string; summary: string | null; sections: string | null; evidence_note: string | null }
    | undefined;
  if (!node) return NextResponse.json({ error: "节点不存在" }, { status: 404 });

  const hasKey = Boolean(db.prepare("SELECT value FROM settings WHERE key = 'llm_api_key'").get());
  if (!hasKey) {
    return NextResponse.json(
      { error: "未配置 API Key：寓言卡需要模型生成。到设置页配置后重试（不会伪造故事）。" },
      { status: 400 }
    );
  }

  const system =
    "你在为一个具体的软件项目写教学寓言卡。要求：\n" +
    "1) 先讲故事，用间接方式把概念讲清楚，不要在开头点破概念名；\n" +
    "2) 故事快结束时才让人意识到讲的是什么概念；\n" +
    "3) 故事后揭晓概念，并逐项解释故事里的隐喻对应什么；\n" +
    "4) 最后必须指出类比在哪里不成立——类比是理解的起点，不是事实的替代品。\n" +
    "严格输出 JSON，且必须使用以下**精确英文字段名**（不要翻译成中文键）：\n" +
    '{"story": string, "reveal": string, "mapping": [{"story_element": string, "concept": string}], "backToProject": string, "limitations": [string]}\n' +
    "只输出这个 JSON 对象，不要输出其他文字。";

  const user =
    `概念：${node.title}（类型 ${node.kind}）\n` +
    `本项目中的解释：${node.summary ?? "（无摘要）"}\n` +
    `本项目证据位置：${node.evidence_note ?? "（无）"}\n` +
    "请生成四段式寓言卡。";

  try {
    const { data } = await chatJSON({
      system,
      user,
      schema: FableSchema,
      maxRetries: 1,
    });

    const sections = node.sections ? (JSON.parse(node.sections) as { heading: string; body: string }[]) : [];
    const next = sections.filter((s) => s.heading !== "寓言卡");
    next.push({ heading: "寓言卡", body: JSON.stringify(data) });
    db.prepare("UPDATE nodes SET sections = ? WHERE id = ?").run(JSON.stringify(next), node.id);

    return NextResponse.json({ ok: true, fable: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
