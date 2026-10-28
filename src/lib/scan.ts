import fs from "node:fs";
import path from "node:path";

export type StackInfo = {
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  deps: Record<string, string>;
};

const MANIFESTS = ["package.json", "pom.xml", "requirements.txt", "go.mod"];

export function detectStack(root: string): StackInfo {
  const stack: StackInfo = { languages: [], frameworks: [], packageManagers: [], deps: {} };
  const read = (rel: string) => {
    try {
      return fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      return null;
    }
  };
  const pkg = read("package.json");
  if (pkg) {
    stack.languages.push("javascript", "typescript");
    stack.packageManagers.push("npm");
    try {
      const j = JSON.parse(pkg) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) };
      stack.deps = deps;
      if (deps.next) stack.frameworks.push("next");
      if (deps.react) stack.frameworks.push("react");
      if (deps.vue) stack.frameworks.push("vue");
      if (deps.express) stack.frameworks.push("express");
      if (deps.fastify) stack.frameworks.push("fastify");
    } catch {
      /* 忽略解析失败 */
    }
  }
  if (read("pom.xml")) {
    stack.languages.push("java");
    stack.packageManagers.push("maven");
    const pom = read("pom.xml") ?? "";
    if (pom.includes("spring-boot")) stack.frameworks.push("spring-boot");
    else if (pom.includes("spring")) stack.frameworks.push("spring");
  }
  if (read("requirements.txt")) {
    stack.languages.push("python");
    stack.packageManagers.push("pip");
    const req = read("requirements.txt") ?? "";
    if (/flask/i.test(req)) stack.frameworks.push("flask");
    if (/fastapi/i.test(req)) stack.frameworks.push("fastapi");
  }
  if (read("go.mod")) {
    stack.languages.push("go");
    stack.packageManagers.push("go");
  }
  return stack;
}

export type Endpoint = { method: string; path: string; file: string; line: number };
export type RouteInfo = { path: string; file: string; kind: string };

const TEXT_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".py", ".java", ".go", ".sql", ".json", ".md", ".css", ".html",
]);

export function isTextFile(relPath: string): boolean {
  return TEXT_EXTS.has(path.extname(relPath).toLowerCase());
}

const ENDPOINT_PATTERNS: { re: RegExp; method: (m: RegExpMatchArray) => string }[] = [
  // Express / Fastify / Koa / Go (Gin/Echo/Echo 小写)
  { re: /\b(?:app|router|r|e|server)\s*\.\s*(get|post|put|patch|delete|all|GET|POST|PUT|PATCH|DELETE)\s*\(\s*["'`]([^"'`]+)["'`]/, method: (m) => m[1].toUpperCase() },
  // NestJS / Spring 装饰器
  { re: /@(Get|Post|Put|Patch|Delete|RequestMapping|All)\s*\(\s*(?:value\s*=\s*)?["'`]([^"'`]+)["'`]/, method: (m) => (m[1] === "RequestMapping" ? "ANY" : m[1].toUpperCase()) },
  // FastAPI / Flask（Python 装饰器）
  { re: /@(?:app|router|bp)\.(get|post|put|patch|delete|route)\s*\(\s*["'`]([^"'`]+)["'`]/, method: (m) => m[1].toUpperCase() },
  // Flask app.route / Blueprint.route
  { re: /\b(?:app|bp)\.route\s*\(\s*["'`]([^"'`]+)["'`]\s*,.*methods\s*=\s*\[?\s*["'`](GET|POST|PUT|PATCH|DELETE)/, method: (m) => m[2].toUpperCase() },
  // Go 大写方法（Gin / Echo / Chi）
  { re: /\b(?:r|e|router|app|api)\.(GET|POST|PUT|PATCH|DELETE)\s*\(\s*"([^"]+)"/, method: (m) => m[1] },
  // Axum / Actix (Rust)
  { re: /\.route\s*\(\s*"([^"]+)"\s*,\s*(?:web::)?(get|post|put|patch|delete)\s*\(/, method: (m) => m[2].toUpperCase() },
  // Rails
  { re: /\b(?:get|post|put|patch|delete)\s+["']([^"']+)["']\s*=>/, method: (m) => m[1].toUpperCase() },
  // Nuxt / Nitro defineEventHandler（从文件路径推断方法，标记为 ANY）
  { re: /defineEventHandler\s*\(/, method: () => "ANY" },
  // Next.js Pages Router（pages/api/*.ts 的 export default handler —— 从文件路径推断，方法由文件内检测）
  { re: /export\s+default\s+(?:async\s+)?(?:function\s+)?handler\b/, method: () => "ANY" },
  // Hono
  { re: /\b(?:app|route)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/, method: (m) => m[1].toUpperCase() },
  // tRPC / H3
  { re: /\.(query|mutation)\s*\(\s*\{?\s*path\s*:\s*["'`]([^"'`]+)["'`]/, method: () => "POST" },
];

const ROUTE_PATTERNS: { re: RegExp; kind: string }[] = [
  { re: /path\s*:\s*["'`](\/[^"'`]*)["'`]/, kind: "router-config" },
  { re: /<Route\s+path\s*=\s*["'`](\/[^"'`]*)["'`]/, kind: "react-router" },
];

/** 从单文件文本中抽取端点与路由（正则级；P0 用，LLM 兜底在 Map 阶段） */
export function extractFromFile(rel: string, content: string): { endpoints: Endpoint[]; routes: RouteInfo[] } {
  const endpoints: Endpoint[] = [];
  const routes: RouteInfo[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const p of ENDPOINT_PATTERNS) {
      const m = line.match(p.re);
      if (m) {
        const method = p.method(m);
        const ep = m[m.length - 1];
        endpoints.push({ method, path: ep, file: rel, line: i + 1 });
        break;
      }
    }
    for (const r of ROUTE_PATTERNS) {
      const m = line.match(r.re);
      if (m) {
        routes.push({ path: m[1], file: rel, kind: r.kind });
        break;
      }
    }
  }
  return { endpoints, routes };
}

/** Next.js App Router 页面约定：app 目录下的 page 文件 → 路由 */
export function nextAppRoute(rel: string): string | null {
  const norm = rel.replace(/\\/g, "/");
  const m = norm.match(/(?:^|\/)(?:src\/)?app\/(.+)\/page\.(tsx|jsx|js|ts)$/);
  if (norm.includes("app/page.")) return "/";
  if (!m) return null;
  return "/" + m[1].replace(/\((.*?)\)\//g, "").replace(/\[\.\.\.(\w+)\]/g, "*").replace(/\/$/, "");
}

/** Next.js App Router API 路由约定：app 目录下的 route 文件 → HTTP 端点（P2 补全） */
export function extractNextApiEndpoints(rel: string, content: string): Endpoint[] {
  const norm = rel.replace(/\\/g, "/");
  const m = norm.match(/(?:^|\/)(?:src\/)?app\/(.+?)\/route\.(?:ts|tsx|js)$/);
  if (!m) return [];
  const apiPath = "/" + m[1].replace(/\((.*?)\)\//g, "").replace(/\[\.\.\.(\w+)\]/g, "*");
  const endpoints: Endpoint[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const em = lines[i].match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/);
    if (em) {
      endpoints.push({ method: em[1], path: apiPath, file: rel, line: i + 1 });
    }
  }
  return endpoints;
}

/** Next.js Pages Router API 路由约定：pages/api/ 目录下的文件 → HTTP 端点（路径从文件目录推导，方法 ANY） */
export function extractNextPagesApiEndpoints(rel: string): Endpoint | null {
  const norm = rel.replace(/\\/g, "/");
  const m = norm.match(/(?:^|\/)pages\/api\/(.+?)\.(?:ts|tsx|js)$/);
  if (!m) return null;
  const apiPath = "/api/" + m[1].replace(/\[\.\.\.(\w+)\]/g, "*").replace(/\/index$/, "");
  return { method: "ANY", path: apiPath, file: rel, line: 1 };
}
