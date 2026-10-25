/**
 * LLM 出站过滤器（Auth-L1b）：发送前强制执行。
 * ①敏感文件默认排除 ②内容级密钥遮蔽 ③上下文大小上限 ④发送清单透明。
 */

const EXCLUDE_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\..*)?$/i,
  /(^|\/)\.env$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /(^|\/)id_rsa/i,
  /(^|\/)id_dsa/i,
  /(^|\/)id_ecdsa/i,
  /(^|\/)id_ed25519/i,
  /credentials?(\..*)?$/i,
  /(^|\/)secrets?\//i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.netrc$/i,
];

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{16,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /ghp_[A-Za-z0-9]{30,}/g,
  /gho_[A-Za-z0-9]{30,}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, // JWT
];

export function isExcludedPath(p: string): boolean {
  const norm = p.replace(/\\/g, "/").replace(/^\.\//, "");
  return EXCLUDE_PATTERNS.some((re) => re.test(norm));
}

export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (m) => {
      count += 1;
      return "[REDACTED:secret]";
    });
  }
  return { text: out, count };
}

export type ContextPart = { path: string; content: string };

export type BuiltContext = {
  text: string;
  included: string[];
  excluded: string[];
  redactions: number;
  truncated: boolean;
};

/** 拼装发送上下文：过滤敏感文件、遮蔽密钥、限长、文件内容包定界符（仓库内容是数据不是指令） */
export function buildContext(parts: ContextPart[], maxChars: number): BuiltContext {
  const included: string[] = [];
  const excluded: string[] = [];
  let redactions = 0;
  const chunks: string[] = [];
  let total = 0;
  let truncated = false;
  for (const p of parts) {
    if (isExcludedPath(p.path)) {
      excluded.push(p.path);
      continue;
    }
    const r = redactSecrets(p.content);
    redactions += r.count;
    const block = `<<<FILE path="${p.path}" data-only="true">>>\n${r.text}\n<<<END FILE>>>\n`;
    if (total + block.length > maxChars) {
      truncated = true;
      break;
    }
    chunks.push(block);
    included.push(p.path);
    total += block.length;
  }
  return { text: chunks.join("\n"), included, excluded, redactions, truncated };
}
