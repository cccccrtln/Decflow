import { NextResponse } from "next/server";
import { deleteFavorite } from "@/lib/store";

type Context = {
  params: Promise<{ favoriteId: string }>;
};

export async function DELETE(_: Request, context: Context) {
  try {
    const { favoriteId } = await context.params;
    const favorite = deleteFavorite(favoriteId);
    return NextResponse.json(favorite);
  } catch (error) {
    const message = error instanceof Error ? error.message : "鍙戠敓浜嗘湭鐭ラ敊璇€?;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}



