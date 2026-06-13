import { NextResponse } from "next/server";
import { z } from "zod";
import { createFavorite } from "@/lib/store";

const requestSchema = z
  .object({
    documentId: z.string().min(1),
    title: z.string().min(1, "鏀惰棌鍐呭涓嶈兘涓虹┖銆?),
    category: z.string().optional(),
    messageIds: z.array(z.string()).default([]),
    excerpt: z.string().optional(),
  })
  .refine(
    (value) => value.messageIds.length > 0 || (value.excerpt && value.excerpt.trim().length > 0),
    {
      message: "鑷冲皯鎻愪緵涓€鏉℃秷鎭垨涓€娈垫枃娈靛唴瀹广€?,
      path: ["messageIds"],
    }
  );

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = requestSchema.parse(json);
    const favorite = createFavorite(body);
    return NextResponse.json(favorite, { status: 201 });
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



