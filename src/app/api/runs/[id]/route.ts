import { NextRequest, NextResponse } from "next/server";
import { getRun } from "@/lib/tasks";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getRun(Number(id));
  if (!run) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  return NextResponse.json({ run });
}
