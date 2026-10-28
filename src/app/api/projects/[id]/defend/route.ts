import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { chatJSON } from "@/lib/llm/client";

/**
 * 答辩评分 + 追问链（设计依据：defend/grill SPEC F-2 双轴 + 方向 4 追问链升级）。
 *
 * action=score   : 对回答做双轴独立评分
 * action=followup: 基于回答缺口生成下一层追问（表层→原理→边界，最多 3 层）
 *
 * 追问链由 LLM 动态生成：每层追问引用项目证据和学生上一轮回答的具体缺口。
 */

const ScoreSchema = z.object({
  axisA: z.coerce.number().min(1).max(5),
  gapsA: z.string(),
  axisB: z.coerce.number().min(1).max(5),
  gapsB: z.string(),
  reference: z.string().describe("参考答案要点，引用具体文件与行"),
});

const FollowupSchema = z.object({
  question: z.string().describe("追问内容"),
  depth: z.enum(["surface", "principle", "boundary"]).describe("追问层级"),
  reference: z.string().describe("评委心中的参考答案要点（含证据位置）"),
  reason: z.string().describe("为什么要追问这个——学生回答里的具体缺口"),
});

type QAPair = { q: string; a: string };

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const body = (await req.json()) as {
    itemId?: number;
    answer?: string;
    action?: "score" | "followup";
    depth?: number;
    chain?: QAPair[];
    targetFile?: string;
    targetLine?: number;
  };
  if (!body.itemId || !body.answer?.trim()) {
    return NextResponse.json({ error: "需要 itemId 与非空回答" }, { status: 400 });
  }

  const db = getDb();
  const project = db
    .prepare("SELECT mission, defense_date FROM projects WHERE id = ?")
    .get(projectId) as { mission: string | null; defense_date: string | null } | undefined;
  const item = db
    .prepare(
      "SELECT id, prompt, answer, hints, target_file, target_line FROM practice_items WHERE id = ? AND project_id = ? AND kind = 'quiz'"
    )
    .get(body.itemId, projectId) as
    | { id: number; prompt: string; answer: string | null; hints: string | null; target_file: string | null; target_line: number | null }
    | undefined;
  if (!item) return NextResponse.json({ error: "题目不存在" }, { status: 404 });

  const hasKey = Boolean(db.prepare("SELECT value FROM settings WHERE key = 'llm_api_key'").get());

  if (!hasKey) {
    // 启发式：只做关键词覆盖，明确标注不是模型评分
    const ans = body.answer.trim();
    const keys = (item.answer ?? "")
      .split(/[，,。；;、\s]+/)
      .filter((w) => w.length >= 2)
      .slice(0, 8);
    const hit = keys.filter((k) => ans.includes(k)).length;
    const ratio = keys.length ? hit / keys.length : 0;
    const axisA = Math.max(1, Math.min(5, Math.round(ratio * 5)));
    return NextResponse.json({
      mode: "heuristic",
      axisA,
      gapsA: ratio >= 0.6 ? "关键词覆盖较高（启发式判断，非语义理解）" : `参考答案中的关键点覆盖 ${hit}/${keys.length}（启发式）`,
      axisB: Math.max(1, Math.min(5, Math.round(ratio * 4))),
      gapsB: "未接入模型，无法判断是否真正回答了问题",
      reference: item.answer ?? "（该题没有参考答案要点）",
      note: "未配置 API Key：当前为启发式评分，仅供自查；配 Key 后由模型双轴评分。",
    });
  }

  const system =
    "你是严格但公正的项目答辩评委。给定学生的回答、题目、参考答案要点与证据位置：\n" +
    "1) 只依据证据判断，不得凭想象补充事实；\n" +
    "2) 两个评分轴独立打分（整数 1-5），不要合并成总分；\n" +
    "3) gaps 必须指出具体缺口，而不是泛泛而谈；\n" +
    "4) reference 用一段字符串给出参考答案要点并引用文件与行。\n" +
    "严格输出 JSON，且必须使用以下**精确英文字段名**（不要翻译成中文键）：\n" +
    '{"axisA": number, "gapsA": string, "axisB": number, "gapsB": string, "reference": string}\n' +
    "只输出这个 JSON 对象，不要输出其他文字。";

  const user =
    `题目：${item.prompt}\n` +
    `参考答案要点：${item.answer ?? "（无）"}\n` +
    `证据位置：${item.target_file ?? "—"}:${item.target_line ?? "—"}\n` +
    `学生回答：${body.answer}`;

  if (body.action === "followup") {
    // ── 追问链生成：基于学生回答缺口 + 项目证据，动态生成下一层追问 ──
    const depth = Math.min(Math.max(body.depth ?? 0, 0), 2);
    const depthNames = ["表层（做了什么）", "原理（为什么这样做）", "边界（失败时会怎样）"];
    const chain = (body.chain ?? []).map((p) => `问：${p.q}\n学生答：${p.a}`).join("\n\n");
    const evidence = item.target_file ? `${item.target_file}:${item.target_line ?? ""}` : "（无）";

    const followSystem =
      "你是项目答辩评委，正在追问学生。\n" +
      "规则：\n" +
      "1) 追问必须基于学生的回答缺口和项目证据，不要脱离上下文；\n" +
      "2) 追问要有层次：表层→原理→边界，当前层是：" + depthNames[depth] + "\n" +
      "3) 追问必须引用项目里真实的文件和行号；\n" +
      "4) reference 给出评委心中的参考答案要点；\n" +
      "5) reason 解释为什么要追问这个。\n" +
      "严格输出 JSON，必须使用精确英文字段名：\n" +
      '{"question": string, "depth": "surface"|"principle"|"boundary", "reference": string, "reason": string}\n' +
      "只输出这个 JSON 对象。";

    const followUser =
      `原始题目：${item.prompt}
` +
      `证据位置：${evidence}
` +
      `追问链（已有 ${body.chain?.length ?? 0} 轮）：
${chain}
` +
      `请生成第 ${depth + 1} 层追问。`;

    try {
      const { data } = await chatJSON({ system: followSystem, user: followUser, schema: FollowupSchema, maxRetries: 1 });
      return NextResponse.json({ mode: "model", ...data });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 502 }
      );
    }
  }

  // ── 默认：双轴评分 ──
  try {
    const { data } = await chatJSON({ system, user, schema: ScoreSchema, maxRetries: 1 });
    return NextResponse.json({ mode: "model", ...data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
