import mammoth from "mammoth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDocument } from "@/lib/store";

const uploadSchema = z.object({
  title: z.string().min(1, "璇疯緭鍏ユ枃妗ｆ爣棰樸€?),
  sourceType: z.enum(["pdf", "html", "docx", "text"]),
  categoryId: z.string().min(1, "蹇呴』鍏堥€夋嫨鏂囨。鍒嗙被銆?),
  content: z.string().optional(),
});

function stripHtmlTags(content: string) {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExtractedText(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(file: File) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return normalizeExtractedText(result.text);
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `PDF 瑙ｆ瀽澶辫触锛?{error.message}`
        : "PDF 瑙ｆ瀽澶辫触锛岃鏇存崲鏂囦欢鎴栨敼鐢ㄦ枃鏈矘璐淬€?
    );
  }
}

async function readUploadedContent(file: File, sourceType: "pdf" | "html" | "docx" | "text") {
  if (sourceType === "html") {
    const html = await file.text();
    return normalizeExtractedText(stripHtmlTags(html));
  }

  const lowerName = file.name.toLowerCase();
  if (sourceType === "text" || lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
    return normalizeExtractedText(await file.text());
  }

  if (sourceType === "docx") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return normalizeExtractedText(result.value);
  }

  if (sourceType === "pdf") {
    return extractPdfText(file);
  }

  return "";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const rawTitle = formData.get("title");
    const rawSourceType = formData.get("sourceType");
    const rawCategoryId = formData.get("categoryId");
    const rawContent = formData.get("content");

    const body = uploadSchema.parse({
      title: typeof rawTitle === "string" ? rawTitle : "",
      sourceType: typeof rawSourceType === "string" ? rawSourceType : "",
      categoryId: typeof rawCategoryId === "string" ? rawCategoryId : "",
      content: typeof rawContent === "string" ? rawContent : "",
    });

    let content = body.content?.trim() ?? "";

    if (!content && fileEntry instanceof File) {
      content = (await readUploadedContent(fileEntry, body.sourceType)).trim();
    }

    if (content.length < 50) {
      return NextResponse.json(
        { error: "鏂囨。鍐呭杩囩煭锛岃涓婁紶鏈夋晥鏂囦欢鎴栬ˉ鍏呮鏂囧唴瀹广€? },
        { status: 400 }
      );
    }

    const document = createDocument({
      title: body.title,
      sourceType: body.sourceType,
      categoryId: body.categoryId,
      content,
    });

    return NextResponse.json(document, { status: 201 });
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



