import express from "express";

const app = express();
app.use(express.json());

// GET /api/tasks 返回全部任务
app.get("/api/tasks", (_req, res) => {
  res.json({ tasks: [] });
});

// POST /api/tasks 创建新任务
app.post("/api/tasks", (req, res) => {
  const title = req.body?.title;
  if (!title) {
    res.status(400).json({ error: "title required" });
    return;
  }
  res.status(201).json({ id: 1, title, done: false });
});

// PATCH /api/tasks/:id 更新完成状态
app.patch("/api/tasks/:id", (req, res) => {
  res.json({ id: Number(req.params.id), done: Boolean(req.body?.done) });
});

app.listen(3000);
