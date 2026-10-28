const base = "http://127.0.0.1:4321";
const list = await fetch(`${base}/api/projects`).then((r) => r.json());
const pid = list.projects.find((x) => x.slug === "regression-fixture1").id;
const res = await fetch(`${base}/api/projects/${pid}/analyze`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ kind: "map" }),
});
const j = await res.json();
console.log("start:", res.status, JSON.stringify(j));
const runId = j.runId;
const t0 = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 4000));
  const r = await fetch(`${base}/api/runs/${runId}`).then((x) => x.json());
  const run = r.run;
  console.log(`${((Date.now()-t0)/1000).toFixed(0)}s`, run.status, run.stage, run.step, run.progress_note ?? "");
  if (["completed","failed","cancelled"].includes(run.status) || Date.now()-t0 > 480000) break;
}
const info = await fetch(`${base}/api/projects/${pid}`).then((x) => x.json());
console.log("counts:", JSON.stringify(info.counts));
console.log("openQuestions:", info.openQuestions.length);
