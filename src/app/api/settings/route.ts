import { NextRequest, NextResponse } from "next/server";
import { getLlmSettings, maskedApiKey, setSetting } from "@/lib/settings";
import { getDb } from "@/lib/db";

export async function GET() {
  const s = getLlmSettings();
  return NextResponse.json({
    baseUrl: s.baseUrl,
    model: s.model,
    temperature: s.temperature,
    allowLocalModel: s.allowLocalModel,
    maxContextChars: s.maxContextChars,
    budgetTokens: Number((getDb().prepare("SELECT value FROM settings WHERE key = 'llm_budget_tokens'").get() as { value: string } | undefined)?.value ?? 0),
    apiKeyMasked: maskedApiKey(),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  // 防双拼：粘贴两次的 "xxx" 折叠为 "xxx"（用户实测踩过的坑）
  const dedupe = (v: string) =>
    v.length % 2 === 0 && v.slice(0, v.length / 2) === v.slice(v.length / 2) ? v.slice(0, v.length / 2) : v;
  if (typeof body.baseUrl === "string") setSetting("llm_base_url", dedupe(body.baseUrl.trim()));
  if (typeof body.model === "string") setSetting("llm_model", dedupe(body.model.trim()));
  if (typeof body.apiKey === "string" && body.apiKey.length > 0) {
    setSetting("llm_api_key", body.apiKey.trim()); // 只写不读；GET 永远只回掩码
  }
  if (typeof body.temperature === "number") setSetting("llm_temperature", String(body.temperature));
  if (typeof body.allowLocalModel === "boolean") setSetting("llm_allow_local", body.allowLocalModel ? "1" : "0");
  if (typeof body.maxContextChars === "number") setSetting("llm_max_context_chars", String(body.maxContextChars));
  if (typeof body.budgetTokens === "number") setSetting("llm_budget_tokens", String(Math.max(0, Math.floor(body.budgetTokens))));
  return NextResponse.json({ ok: true });
}
