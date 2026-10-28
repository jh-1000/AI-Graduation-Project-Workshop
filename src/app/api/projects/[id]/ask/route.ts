import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { chatJSON } from "@/lib/llm/client";
import { hasApiKey } from "@/lib/settings";

/**
 * 全局学习助手（P3.3）。
 * 召回 = 词法（LIKE 多关键词）+ 图谱邻域（命中节点的关联文件/流程）。
 * 回答 = 仅依据召回材料；材料不足时明说缺口并给下一步核查——绝不编造。
 * 未配置 Key 时降级为"仅检索结果"，同样诚实。
 */

type Match = {
  type: "node" | "claim" | "term" | "question";
  label: string;
  text: string;
  href: string | null;
};

function keywords(q: string): string[] {
  return q
    .split(/[\s，。？?！!、/]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const body = (await req.json()) as { question?: string };
  const question = (body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "问题不能为空" }, { status: 400 });

  const db = getDb();
  const kws = keywords(question);
  const base = `/project/${projectId}`;
  const matches: Match[] = [];

  // 词法召回：知识点
  const latestNodes = db
    .prepare("SELECT analysis_version FROM nodes WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId) as { analysis_version: string } | undefined;
  if (latestNodes) {
    const rows = db
      .prepare(
        "SELECT id, slug, title, kind, summary, evidence_note FROM nodes WHERE project_id = ? AND analysis_version = ?"
      )
      .all(projectId, latestNodes.analysis_version) as {
      id: number;
      slug: string;
      title: string;
      kind: string;
      summary: string | null;
      evidence_note: string | null;
    }[];
    const scored = rows
      .map((n) => {
        const hay = `${n.title} ${n.summary ?? ""} ${n.evidence_note ?? ""}`;
        return { n, score: kws.filter((k) => hay.includes(k)).length };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    for (const { n } of scored) {
      matches.push({
        type: "node",
        label: n.title,
        text: `${n.summary ?? ""}${n.evidence_note ? `（证据：${n.evidence_note}）` : ""}`,
        href: `${base}/node?slug=${encodeURIComponent(n.slug)}`,
      });
    }
  }

  // 词法召回：结论
  const latestClaims = db
    .prepare("SELECT analysis_version FROM claims WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId) as { analysis_version: string } | undefined;
  if (latestClaims) {
    const rows = db
      .prepare("SELECT id, content, derivation, review_state FROM claims WHERE project_id = ? AND analysis_version = ?")
      .all(projectId, latestClaims.analysis_version) as { id: number; content: string; derivation: string; review_state: string }[];
    const scored = rows
      .map((c) => ({ c, score: kws.filter((k) => c.content.includes(k)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    for (const { c } of scored) {
      matches.push({
        type: "claim",
        label: `结论（${c.derivation} · ${c.review_state}）`,
        text: c.content,
        href: `${base}/graph`,
      });
    }
  }

  // 词法召回：术语
  const termRows = db
    .prepare("SELECT id, slug, title, plain_def, pro_def FROM terms WHERE project_id = ?")
    .all(projectId) as { id: number; slug: string; title: string; plain_def: string | null; pro_def: string | null }[];
  const scoredTerms = termRows
    .map((t) => ({ t, score: kws.filter((k) => `${t.title} ${t.plain_def ?? ""} ${t.pro_def ?? ""}`.includes(k)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  for (const { t } of scoredTerms) {
    matches.push({
      type: "term",
      label: t.title,
      text: t.plain_def ?? "",
      href: `${base}/kb?term=${encodeURIComponent(t.slug)}`,
    });
  }

  // 无召回：诚实返回
  if (matches.length === 0) {
    return NextResponse.json({
      mode: "no-match",
      answer: null,
      matches: [],
      gap: "知识库里没有检索到与这个问题相关的内容——可能该主题还没被分析，或换一种问法。",
      nextCheck: "先运行一次完整分析（map），或换个关键词重试。",
    });
  }

  // 未配 Key：只给检索结果
  if (!hasApiKey()) {
    return NextResponse.json({
      mode: "retrieval-only",
      answer: null,
      matches: matches.slice(0, 6),
      gap: "未配置 API Key：无法生成组织好的回答；上面是检索到的相关内容。",
      nextCheck: "到设置页配置后重试。",
    });
  }

  const material = matches
    .map((m, i) => `[${i + 1}] ${m.type} · ${m.label}\n${m.text}`)
    .join("\n\n");
  const system =
    "你是项目学习助手。规则：\n" +
    "1) 只依据【材料】回答，材料不够就明确说'材料不足'，绝不编造；\n" +
    "2) 回答里引用材料编号（如 [2]）；\n" +
    "3) 需要看代码时给出材料里的文件:行号。\n" +
    "严格输出 JSON，必须使用精确英文字段名：\n" +
    '{"answer": string, "usedRefs": [number], "gap": string | null, "nextCheck": string | null}\n' +
    "usedRefs 是你用到的材料编号数组；gap 是材料还缺什么（没有就 null）；nextCheck 是建议的下一步核查。";

  try {
    const { data } = await chatJSON({
      system,
      user: `问题：${question}\n\n【材料】\n${material}`,
      schema: z.object({
        answer: z.string(),
        usedRefs: z.array(z.coerce.number()),
        gap: z.string().nullable(),
        nextCheck: z.string().nullable(),
      }),
      maxRetries: 1,
    });
    return NextResponse.json({
      mode: "model",
      answer: data.answer,
      usedRefs: data.usedRefs,
      matches: data.usedRefs.map((i) => matches[i - 1]).filter(Boolean),
      gap: data.gap,
      nextCheck: data.nextCheck,
    });
  } catch (err) {
    return NextResponse.json({
      mode: "retrieval-only",
      answer: null,
      matches: matches.slice(0, 6),
      gap: `模型调用失败：${err instanceof Error ? err.message.slice(0, 160) : "unknown"}`,
      nextCheck: "检查设置页模型配置后重试。",
    });
  }
}
