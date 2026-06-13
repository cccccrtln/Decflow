import { NextResponse } from "next/server";
import { z } from "zod";
import { runQuestionAnswer } from "@/lib/agent/workflow";

const requestSchema = z.object({
  documentId: z.string().min(1),
  question: z.string().min(3, "闂鍐呭杩囩煭銆?),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { documentId, question } = requestSchema.parse(json);
    const message = await runQuestionAnswer(documentId, question);
    return NextResponse.json(message);
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

