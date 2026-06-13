import { NextResponse } from "next/server";
import { deleteCategory } from "@/lib/store";

type Context = {
  params: Promise<{ categoryId: string }>;
};

export async function DELETE(_: Request, context: Context) {
  try {
    const { categoryId } = await context.params;
    const category = deleteCategory(categoryId);
    return NextResponse.json(category);
  } catch (error) {
    const message = error instanceof Error ? error.message : "鍙戠敓浜嗘湭鐭ラ敊璇€?;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}



