import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto("http://127.0.0.1:4321/project/47/node", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
const info = await p.evaluate(() => {
  const d = document.querySelector(".depth");
  if (!d) return "no .depth";
  const cs = getComputedStyle(d);
  const btn = d.querySelector("button");
  return { display: cs.display, border: cs.border, btns: d.querySelectorAll("button").length, btnPad: btn ? getComputedStyle(btn).padding : "none" };
});
console.log(JSON.stringify(info));
await b.close();
