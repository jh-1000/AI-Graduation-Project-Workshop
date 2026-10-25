import crypto from "node:crypto";
import type { z } from "zod";
import { getDb } from "../db";
import { getApiKeyInternal, getLlmSettings } from "../settings";
import { assertUrlAllowed } from "./ssrf";
import { buildContext, type ContextPart } from "./outbound";

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function cacheGet(key: string): string | null {
  const row = getDb()
    .prepare("SELECT response FROM llm_cache WHERE key = ?")
    .get(key) as { response: string } | undefined;
  return row?.response ?? null;
}

function cachePut(key: string, response: string, model: string): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO llm_cache (key, response, model, meta) VALUES (?, ?, ?, ?)"
    )
    .run(key, response, model, JSON.stringify({ kind: "chat_json" }));
}

async function callChatApi(
  messages: { role: string; content: string }[],
  temperature: number
): Promise<string> {
  const s = getLlmSettings();
  const key = getApiKeyInternal();
  if (!key) throw new Error("未配置 API Key：请先到设置页填写并保存");
  if (!s.baseUrl) throw new Error("未配置 baseURL");

  // 首跳校验 + 手动重定向逐跳重校验（禁自动跟随）
  let target = await assertUrlAllowed(s.baseUrl, s.allowLocalModel);
  const url = new URL(target.href.replace(/\/+$/, "") + "/chat/completions");

  for (let hop = 0; hop < 3; hop += 1) {
    const resp = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: s.model,
        temperature,
        messages,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) throw new Error(`重定向缺少 location（${resp.status}）`);
      target = await assertUrlAllowed(new URL(loc, url).href, s.allowLocalModel);
      url.href = target.href;
      continue;
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`LLM 请求失败 ${resp.status}：${body.slice(0, 300)}`);
    }
    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("LLM 返回缺少 content");
    return content;
  }
  throw new Error("重定向次数过多（>3）");
}

function extractJson(text: string): string {
  // 从回复中提取 JSON（容忍 ```json 包裹与前后杂文本）
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.search(/[[{]/);
  if (start < 0) throw new Error("回复中未找到 JSON");
  const openChar = candidate[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < candidate.length; i += 1) {
    const ch = candidate[i];
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  throw new Error("JSON 未闭合");
}

export type ChatJsonOptions<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxRetries?: number;
  /** 需要随请求发送的项目文件：统一过出站过滤器（敏感文件排除 + 密钥遮蔽 + 限长） */
  context?: ContextPart[];
  /** 上下文上限，缺省取设置里的 maxContextChars */
  maxContextChars?: number;
};

export type OutboundTrace = {
  included: string[];
  excluded: string[];
  redactions: number;
  truncated: boolean;
};

/**
 * 结构化 LLM 调用：缓存 → 调用（手动重定向校验）→ 提取 JSON → zod 校验 → 失败重试。
 * 任务幂等键与缓存键分离：缓存键=提示词全文+模型参数+输入哈希。
 */
export async function chatJSON<T>(opts: ChatJsonOptions<T>): Promise<{
  data: T;
  cached: boolean;
  cacheKey: string;
  outbound?: OutboundTrace;
}> {
  const s = getLlmSettings();
  // Auth-L1b：项目内容一律先过出站过滤器，绝不把原始文件直接拼进提示词
  let outbound: OutboundTrace | undefined;
  let userContent = opts.user;
  if (opts.context && opts.context.length > 0) {
    const built = buildContext(opts.context, opts.maxContextChars ?? s.maxContextChars);
    userContent = `${opts.user}\n\n${built.text}`;
    outbound = {
      included: built.included,
      excluded: built.excluded,
      redactions: built.redactions,
      truncated: built.truncated,
    };
  }
  const raw = `SYSTEM:\n${opts.system}\nUSER:\n${userContent}`;
  const cacheKey = sha256(
    JSON.stringify({ raw: sha256(raw), model: s.model, temperature: s.temperature })
  );
  const hit = cacheGet(cacheKey);
  if (hit) {
    return { data: opts.schema.parse(JSON.parse(extractJson(hit))), cached: true, cacheKey, outbound };
  }

  const maxRetries = opts.maxRetries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const text = await callChatApi(
        [
          { role: "system", content: opts.system },
          { role: "user", content: userContent },
        ],
        s.temperature
      );
      const json = extractJson(text);
      const data = opts.schema.parse(JSON.parse(json));
      try {
        cachePut(cacheKey, text, s.model);
      } catch {
        // 缓存写入失败不作废结果，仅放弃缓存
      }
      return { data, cached: false, cacheKey, outbound };
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}