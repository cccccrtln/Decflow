import { NextResponse } from "next/server";
import { z } from "zod";
import { runComparison } from "@/lib/agent/workflow";

const requestSchema = z.object({
  documentIds: z.array(z.string()).min(2, "鑷冲皯閫夋嫨涓ょ瘒鏂囨。銆?),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { documentIds } = requestSchema.parse(json);
    const result = await runComparison(documentIds);
    return NextResponse.json(result);
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

