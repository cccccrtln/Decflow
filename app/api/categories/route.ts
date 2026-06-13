import { NextResponse } from "next/server";
import { z } from "zod";
import { createCategory, listWorkspace } from "@/lib/store";

const requestSchema = z.object({
  name: z.string().min(1, "鍒嗙被鍚嶇О涓嶈兘涓虹┖銆?),
});

export async function GET() {
  return NextResponse.json(listWorkspace().categories);
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = requestSchema.parse(json);
    const category = createCategory(body);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "璇锋眰鍙傛暟鏃犳晥銆?
        : "鍙戠敓浜嗘湭鐭ラ敊璇€?;

    return NextResponse.json({ error: message }, { status: 400 });
  }
}



