import { NextResponse } from "next/server";
import { deleteAnnotation } from "@/lib/store";

type Context = {
  params: Promise<{ noteId: string }>;
};

export async function DELETE(_: Request, context: Context) {
  try {
    const { noteId } = await context.params;
    const note = deleteAnnotation(noteId);
    return NextResponse.json(note);
  } catch (error) {
    const message = error instanceof Error ? error.message : "鍙戠敓浜嗘湭鐭ラ敊璇€?;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}



