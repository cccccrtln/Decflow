import { NextResponse } from "next/server";
import { getWorkspaceSnapshot } from "@/lib/agent/workflow";

export async function GET() {
  return NextResponse.json(getWorkspaceSnapshot());
}

