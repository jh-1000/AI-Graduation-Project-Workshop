import crypto from "node:crypto";
import type { z } from "zod";
import { getDb } from "../db";
import { getApiKeyInternal, getLlmSettings } from "../settings";
import { assertUrlAllowed } from "./ssrf";
import { buildContext, type ContextPart } from "./outbound";

const BUDGET_ENV = "PAL_BUDGET_TOKENS";
let spentThisProcess = 0;

export class BudgetExceededError extends Error {
  constructor(public readonly budget: number, public readonly spent: number) {
    super(`预算超限：已用 ${spent} tokens / 上限 ${budget}`);
    this.name = "BudgetExceededError";
  }
}

function budget(): number {
  const raw = process.env[BUDGET_ENV];
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function assertBudget(): void {
  const b = budget();
  if (b > 0 && spentThisProcess >= b) throw new BudgetExceededError(b, spentThisProcess);
}

function bumpMeta(key: string, delta: number): void {
  try {
    getDb()
      .prepare(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + ? AS TEXT)"
      )
      .run(key, String(delta), delta);
  } catch {
    /* 计量失败不影响主流程 */
  }
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function cacheGet(key: string): string | null {
  const row = getDb()
    .prepare("SELECT response FROM llm_cache WHERE key = ?")
    .get(key) as { response: string } | undefined;
  return row?.response ?? null;
}

function cachePut(
  key: string,
  response: string,
  model: string,
  usage?: { promptTokens: number; completionTokens: number }
): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO llm_cache (key, response, model, meta) VALUES (?, ?, ?, ?)"
    )
    .run(key, response, model, JSON.stringify({ kind: "chat_json", ...(usage ?? {}) }));
}

async function callChatApi(
  messages: { role: string; content: string }[],
  temperature: number
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
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
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("LLM 返回缺少 content");
    return {
      content,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    };
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
    bumpMeta("llm_cache_hits", 1);
    return { data: opts.schema.parse(JSON.parse(extractJson(hit))), cached: true, cacheKey, outbound };
  }
  bumpMeta("llm_cache_misses", 1);

  assertBudget();
  const maxRetries = opts.maxRetries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const res = await callChatApi(
        [
          { role: "system", content: opts.system },
          { role: "user", content: userContent },
        ],
        s.temperature
      );
      const tokens = res.promptTokens + res.completionTokens;
      spentThisProcess += tokens;
      bumpMeta("llm_calls", 1);
      bumpMeta("llm_tokens_prompt", res.promptTokens);
      bumpMeta("llm_tokens_completion", res.completionTokens);
      const json = extractJson(res.content);
      const data = opts.schema.parse(JSON.parse(json));
      try {
        cachePut(cacheKey, res.content, s.model, {
          promptTokens: res.promptTokens,
          completionTokens: res.completionTokens,
        });
      } catch {
        // 缓存写入失败不作废结果，仅放弃缓存
      }
      return { data, cached: false, cacheKey, outbound };
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err; // 预算超限不重试
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}