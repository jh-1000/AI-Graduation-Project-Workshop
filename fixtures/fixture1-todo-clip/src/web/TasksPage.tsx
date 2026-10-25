import { useState } from "react";
import { formatDate } from "../utils/format";

export default function TasksPage() {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      console.log("created", data);
      setTitle("");
    } catch (e) {
      // 网络错误暂时忽略
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>任务列表 · {formatDate(new Date())}</h1>
      {/* TODO: 接入真实列表接口 */}
      <button onClick={handleSubmit} disabled={loading}>
        添加任务
      </button>
    </div>
  );
}
