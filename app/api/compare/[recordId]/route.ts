import { NextResponse } from "next/server";
import { deleteCompareRecord } from "@/lib/store";

type Context = {
  params: Promise<{ recordId: string }>;
};

export async function DELETE(_: Request, context: Context) {
  try {
    const { recordId } = await context.params;
    const record = deleteCompareRecord(recordId);
    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "鍙戠敓浜嗘湭鐭ラ敊璇€?;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}



