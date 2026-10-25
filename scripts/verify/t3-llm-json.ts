/** T3：LLM 结构化输出稳定性（需要设置页已保存 API Key；无 Key 则 SKIP） */
import { z } from "zod";
import { getApiKeyInternal } from "../../src/lib/settings";
import { chatJSON } from "../../src/lib/llm/client";

const Schema = z.object({
  summary: z.string(),
  languages: z.array(z.string()),
});

export async function run(): Promise<{ status: "pass" | "fail" | "skip"; detail: string }> {
  if (!getApiKeyInternal()) {
    return { status: "skip", detail: "未配置 API Key：到设置页保存后重跑（C4 同样依赖）" };
  }
  let ok = 0;
  const n = 10;
  const errors: string[] = [];
  for (let i = 0; i < n; i += 1) {
    try {
      await chatJSON({
        system: "你是代码分析器。只输出 JSON，不要输出任何其他文字。",
        user:
          '分析这段代码并输出 JSON：{"summary":"一句话","languages":["语言"]}。代码：\n' +
          "```ts\nexport function formatDate(d: Date): string {\n  return d.toISOString().slice(0, 10);\n}\n```",
        schema: Schema,
      });
      ok += 1;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (ok >= 9) return { status: "pass", detail: `结构化输出 ${ok}/${n} 成功` };
  return { status: "fail", detail: `仅 ${ok}/${n} 成功；失败样例：${errors[0] ?? ""}` };
}
