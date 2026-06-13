import { NextResponse } from "next/server";
import { z } from "zod";
import { runReport } from "@/lib/agent/workflow";

const requestSchema = z.object({
  documentId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { documentId } = requestSchema.parse(json);
    const report = await runReport(documentId);
    return NextResponse.json(report);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "璇锋眰鍙傛暟鏃犳晥銆?
        : error instanceof Error
          ? error.message
          : "鍙戠敓浜嗘湭鐭ラ敊璇€?;

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

