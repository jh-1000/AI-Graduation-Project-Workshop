import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getLlmSettings } from "@/lib/settings";

/**
 * LLM 花费与缓存统计（设计依据：platform/storage F-5）。
 * GET    : 计量计数 + 缓存条目 + 命中率 + 预算
 * DELETE : 只清 llm_cache（知识点/证据/寓言卡都是落库实体，零 token 损失）
 */

function metaNum(key: string): number {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  const n = row ? Number(row.value) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  const db = getDb();
  const s = getLlmSettings();
  const budgetRow = db
    .prepare("SELECT value FROM settings WHERE key = 'llm_budget_tokens'")
    .get() as { value: string } | undefined;
  const budget = budgetRow ? Number(budgetRow.value) : 0;

  const calls = metaNum("llm_calls");
  const hits = metaNum("llm_cache_hits");
  const misses = metaNum("llm_cache_misses");
  const prompt = metaNum("llm_tokens_prompt");
  const completion = metaNum("llm_tokens_completion");
  const entries = (db.prepare("SELECT COUNT(*) n FROM llm_cache").get() as { n: number }).n;

  return NextResponse.json({
    model: s.model,
    calls,
    cacheHits: hits,
    cacheMisses: misses,
    hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
    tokensPrompt: prompt,
    tokensCompletion: completion,
    tokensTotal: prompt + completion,
    cacheEntries: entries,
    budget: Number.isFinite(budget) && budget > 0 ? budget : 0,
  });
}

export async function DELETE(_req: NextRequest) {
  const db = getDb();
  const before = (db.prepare("SELECT COUNT(*) n FROM llm_cache").get() as { n: number }).n;
  db.prepare("DELETE FROM llm_cache").run();
  return NextResponse.json({
    ok: true,
    cleared: before,
    note: "仅清空模型响应缓存；知识点/证据/术语/练习等已落库内容不受影响。",
  });
}
