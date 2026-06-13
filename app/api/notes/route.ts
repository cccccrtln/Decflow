import { NextResponse } from "next/server";
import { z } from "zod";
import { addAnnotation } from "@/lib/store";

const requestSchema = z.object({
  documentId: z.string().min(1),
  anchor: z.string().min(1, "鎵规敞閿氱偣涓嶈兘涓虹┖銆?),
  note: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = requestSchema.parse(json);
    return NextResponse.json(addAnnotation(body), { status: 201 });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "璇锋眰鍙傛暟鏃犳晥銆?
        : "鍙戠敓浜嗘湭鐭ラ敊璇€?;

    return NextResponse.json({ error: message }, { status: 400 });
  }
}



