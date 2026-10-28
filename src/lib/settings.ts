import { getDb } from "./db";

export type LlmSettings = {
  baseUrl: string;
  model: string;
  temperature: number;
  allowLocalModel: boolean;
  maxContextChars: number;
};

const DEFAULTS: LlmSettings = {
  baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  model: "glm-4-flash",
  temperature: 0.2,
  allowLocalModel: false,
  maxContextChars: 60000,
};

function get(key: string): string | undefined {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','localtime')"
    )
    .run(key, value);
}

export function getLlmSettings(): LlmSettings {
  return {
    baseUrl: get("llm_base_url") ?? DEFAULTS.baseUrl,
    model: get("llm_model") ?? DEFAULTS.model,
    temperature: Number(get("llm_temperature") ?? DEFAULTS.temperature),
    allowLocalModel: (get("llm_allow_local") ?? "0") === "1",
    maxContextChars: Number(get("llm_max_context_chars") ?? DEFAULTS.maxContextChars),
  };
}

/** 仅服务端内部使用；绝不通过 API 返回明文 */
export function getApiKeyInternal(): string | null {
  return get("llm_api_key") ?? null;
}

export function hasApiKey(): boolean {
  return Boolean(getApiKeyInternal());
}

export function maskedApiKey(): string | null {
  const k = getApiKeyInternal();
  if (!k) return null;
  if (k.length <= 8) return "****";
  return `${k.slice(0, 4)}****${k.slice(-4)}`;
}
