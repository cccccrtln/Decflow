import { NextResponse } from "next/server";
import { deleteDocument } from "@/lib/store";

type Context = {
  params: Promise<{ documentId: string }>;
};

export async function DELETE(_: Request, context: Context) {
  try {
    const { documentId } = await context.params;
    const document = deleteDocument(documentId);
    return NextResponse.json(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : "鍙戠敓浜嗘湭鐭ラ敊璇€?;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}



