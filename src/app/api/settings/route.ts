import { NextRequest, NextResponse } from "next/server";
import { getLlmSettings, maskedApiKey, setSetting } from "@/lib/settings";

export async function GET() {
  const s = getLlmSettings();
  return NextResponse.json({
    baseUrl: s.baseUrl,
    model: s.model,
    temperature: s.temperature,
    allowLocalModel: s.allowLocalModel,
    maxContextChars: s.maxContextChars,
    apiKeyMasked: maskedApiKey(),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  if (typeof body.baseUrl === "string") setSetting("llm_base_url", body.baseUrl.trim());
  if (typeof body.model === "string") setSetting("llm_model", body.model.trim());
  if (typeof body.apiKey === "string" && body.apiKey.length > 0) {
    setSetting("llm_api_key", body.apiKey.trim()); // 只写不读；GET 永远只回掩码
  }
  if (typeof body.temperature === "number") setSetting("llm_temperature", String(body.temperature));
  if (typeof body.allowLocalModel === "boolean") setSetting("llm_allow_local", body.allowLocalModel ? "1" : "0");
  if (typeof body.maxContextChars === "number") setSetting("llm_max_context_chars", String(body.maxContextChars));
  return NextResponse.json({ ok: true });
}
