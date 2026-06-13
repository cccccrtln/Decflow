import { NextResponse } from "next/server";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai";

export async function GET() {
  try {
    const client = getOpenAIClient();
    if (!client) {
      return NextResponse.json(
        { ok: false, error: "鏈厤缃ā鍨?API Key銆? },
        { status: 400 }
      );
    }

    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: "浣犲ソ锛岃鍙洖澶嶁€滄祴璇曟垚鍔熲€濄€? }],
      temperature: 0,
    });

    return NextResponse.json({
      ok: true,
      model: OPENAI_MODEL,
      content: response.choices[0]?.message?.content ?? "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "鍙戠敓浜嗘湭鐭ラ敊璇€?,
      },
      { status: 500 }
    );
  }
}



