import { chromium } from "playwright";
const base = "http://127.0.0.1:4321";
const list = await fetch(`${base}/api/projects`).then((r) => r.json());
const pid = list.projects.find((x) => x.slug === "regression-fixture1").id;
const pages = [
  ["01-overview", `/project/${pid}`, "h1"],
  ["02-scan", `/project/${pid}/scan`, "h1"],
  ["03-code", `/project/${pid}/code?path=src/server/index.ts&line=12`, ".ccode"],
  ["04-map", `/project/${pid}/map`, "h1"],
  ["05-graph", `/project/${pid}/graph`, "#gcanvas"],
  ["06-flow", `/project/${pid}/flow`, ".metro"],
  ["07-kb", `/project/${pid}/kb`, "h1"],
  ["08-node", `/project/${pid}/node?slug=date-format-utility`, "h1"],
  ["09-defend", `/project/${pid}/defend`, "h1"],
  ["10-challenge", `/project/${pid}/challenge`, "h1"],
  ["11-radar", `/project/${pid}/radar`, "h1"],
  ["13-impact", `/project/${pid}/impact`, "h1"],
  ["14-insights", `/project/${pid}/insights`, "h1"],
  ["12-settings", `/settings`, "h1"],
];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1680, height: 1000 }, locale: "zh-CN" });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(`${p.url()} :: ${e}`));
for (const [name, url, sel] of pages) {
  await p.goto(base + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForSelector(sel, { timeout: 30000 }).catch(() => errs.push(`${url} 缺少 ${sel}`));
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `aidd-wiki/output/screens/${name}.png`, fullPage: true });
  const text = (await p.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 120);
  console.log(name.padEnd(14), "|", text);
}
console.log("\nERRORS:", errs.length ? errs.join("\n") : "none");
await b.close();
