import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1680, height: 1000 } })).newPage();
await p.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2000);
await p.screenshot({ path: "aidd-wiki/output/screens/00-home.png", fullPage: true });
const browseBtn = await p.getByText("📁 浏览").count();
console.log("browse button:", browseBtn > 0 ? "visible" : "missing");
// 点浏览按钮测试弹窗
await p.getByText("📁 浏览").click();
await p.waitForTimeout(1000);
const modal = await p.locator(".modal").count();
console.log("folder browser modal:", modal > 0 ? "open" : "missing");
// 检查有没有盘符
const cDrive = await p.getByText("C:\\").count();
console.log("C: drive visible:", cDrive > 0);
await p.screenshot({ path: "aidd-wiki/output/screens/00-folder-browser.png", fullPage: true });
await b.close();
