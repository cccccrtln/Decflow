import { z } from "zod";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai";
import {
  COMPARISON_PROMPT,
  NAVIGATION_PROMPT,
  READING_PROMPT,
  SUMMARY_PROMPT,
  SYNTHESIS_PROMPT,
  SYSTEM_BASE,
  TRANSLATION_PROMPT,
} from "@/lib/agent/prompts";
import {
  appendConversationMessage,
  getDocument,
  listWorkspace,
  saveReport,
  updateDocumentAnalysis,
  updateCompareResult,
} from "@/lib/store";
import type { ChatMessage, CompareResult, ReadingReport } from "@/types/docflow";

const translationSchema = z.object({
  sourceLanguage: z.string(),
  translatedSummary: z.string(),
});

const qaSchema = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({
      label: z.string(),
      excerpt: z.string(),
    })
  ),
});

const comparisonSchema = z.object({
  insights: z.array(
    z.object({
      topic: z.string(),
      consensus: z.string(),
      difference: z.string(),
    })
  ),
});

const reportSchema = z.object({
  summary: z.string(),
});

const summarySchema = z.object({
  summary: z.string(),
});

const navigationSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      paragraphStart: z.number().int().nonnegative(),
      paragraphEnd: z.number().int().nonnegative(),
    })
  ),
});

const ingestSchema = z.object({
  language: z.string(),
  shouldTranslate: z.boolean(),
  removedGarbledText: z.boolean(),
  content: z.array(z.string()).min(1),
});

function extractJsonBlock(text: string) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  throw new Error("JSON block was not found in model output.");
}

function parseBooleanValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return ["true", "yes", "1", "shi", "need", "translate"].some((item) => normalized.includes(item));
}

function extractLabeledValue(text: string, labels: string[]) {
  const pattern = new RegExp(`(?:${labels.join("|")})\\s*[:：]\\s*(.+)`, "i");
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function parseSummaryFromText(text: string) {
  return {
    summary: extractLabeledValue(text, ["summary"]) || text.trim(),
  };
}

function parseReportFromText(text: string) {
  const summary = extractLabeledValue(text, ["summary"]) || text.trim();
  return { summary };
}

function parseNavigationFromText(text: string) {
  const sections = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const title = extractLabeledValue(block, ["title"]) || `Section ${index + 1}`;
      const summary = extractLabeledValue(block, ["summary"]) || block.split("\n").slice(1).join(" ").trim();
      const startRaw = extractLabeledValue(block, ["paragraphStart", "start", "start_index"]) || `${index}`;
      const endRaw = extractLabeledValue(block, ["paragraphEnd", "end", "end_index"]) || startRaw;

      return {
        title,
        summary,
        paragraphStart: Number.parseInt(startRaw, 10) || 0,
        paragraphEnd: Number.parseInt(endRaw, 10) || Number.parseInt(startRaw, 10) || 0,
      };
    });

  return { sections };
}

function parseQaFromText(text: string) {
  const answer = extractLabeledValue(text, ["answer"]) || text.trim();
  const citationBlocks = text.split(/\n{2,}/).filter((block) => /excerpt|citation|label/i.test(block));

  const citations = citationBlocks.map((block, index) => ({
    label: extractLabeledValue(block, ["label", "citation"]) || `Citation ${index + 1}`,
    excerpt: extractLabeledValue(block, ["excerpt", "content"]) || block.trim(),
  }));

  return { answer, citations };
}

function parseIngestFromText(text: string) {
  const language = extractLabeledValue(text, ["language"]) || "zh-CN";
  const shouldTranslateRaw = extractLabeledValue(text, ["shouldTranslate"]) || "false";
  const contentBlock =
    extractLabeledValue(text, ["content"]) ||
    text
      .split(/\n{2,}/)
      .filter((block) => !/language|shouldTranslate/i.test(block))
      .join("\n\n");

  return {
    language,
    shouldTranslate: parseBooleanValue(shouldTranslateRaw),
    removedGarbledText: true,
    content: contentBlock
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function parseTranslationFromText(text: string) {
  return {
    sourceLanguage: extractLabeledValue(text, ["sourceLanguage", "language"]) || "unknown",
    translatedSummary: extractLabeledValue(text, ["translatedSummary", "summary"]) || text.trim(),
  };
}

function tryStructuredParse<T>(text: string, schema: z.ZodSchema<T>, textParser?: (raw: string) => unknown) {
  const candidates: unknown[] = [];

  try {
    candidates.push(JSON.parse(extractJsonBlock(text)));
  } catch {
    // tolerate non-JSON reply
  }

  if (textParser) {
    candidates.push(textParser(text));
  }

  for (const candidate of candidates) {
    const result = schema.safeParse(candidate);
    if (result.success) {
      return result.data;
    }
  }

  throw new Error("Model output did not pass structured parsing.");
}

async function runJsonStep<T>(
  prompt: string,
  input: string,
  schema: z.ZodSchema<T>,
  textParser?: (raw: string) => unknown
) {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("Model API key is not configured.");
  }

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_BASE },
      {
        role: "system",
        content:
          "Return a JSON object only. Do not add explanations. You may wrap it in ```json ... ```, but the content must be valid JSON.parse input.",
      },
      { role: "user", content: `${prompt}\n\n${input}` },
    ],
    temperature: 0.2,
  });

  const text = response.choices[0]?.message?.content ?? "";
  return tryStructuredParse(text, schema, textParser);
}

function fallbackTranslation(documentId: string) {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  return {
    sourceLanguage: document.language,
    translatedSummary: document.summary,
  };
}

function fallbackQa(documentId: string) {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  const snippets = document.content.slice(0, 2);
  return {
    answer: `Current answer is generated from the parsed document content. Core information: ${document.summary}`,
    citations: snippets.map((excerpt, index) => ({
      label: `Paragraph ${index + 1}`,
      excerpt,
    })),
  };
}

function fallbackComparison(documentIds: string[]) {
  const documents = documentIds.map((documentId) => getDocument(documentId)).filter(Boolean);
  if (documents.length < 2) {
    throw new Error("At least two documents are required for comparison.");
  }

  const [firstDocument, secondDocument] = documents;

  return {
    insights: [
      {
        topic: "Document overview",
        consensus: "Both documents focus on improving knowledge work efficiency and structured understanding.",
        difference: `${firstDocument.title} emphasizes one direction, while ${secondDocument.title} emphasizes another.`,
      },
    ],
  };
}

function fallbackReport(documentId: string) {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  return {
    title: `${document.title} Reading Report`,
    summary: [
      `Core content: ${document.summary}`,
      ...document.notes.slice(0, 2).map((note) => `Note: ${note.note}`),
    ].join(" "),
  };
}

function fallbackSummary(documentId: string) {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  return {
    summary: document.content.slice(0, 2).join(" ").slice(0, 180) || "No summary yet.",
  };
}

function fallbackNavigation(documentId: string) {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  return {
    sections: document.content.slice(0, 6).map((paragraph, index) => ({
      title: `Section ${index + 1}`,
      summary: paragraph.slice(0, 80),
      paragraphStart: index,
      paragraphEnd: index,
    })),
  };
}

function fallbackIngest(documentId: string) {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  const joinedContent = document.content.join("\n\n");
  const cleanedContent = joinedContent
    .replace(/[^\S\r\n]{2,}/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const hasChinese = /[\u4e00-\u9fa5]/.test(joinedContent);
  const segmentedContent = cleanedContent
    .split(/\n{2,}/)
    .flatMap((paragraph) =>
      paragraph.length > 160
        ? paragraph.split(/(?<=[。！？；.!?;])/).map((item) => item.trim()).filter(Boolean)
        : [paragraph]
    )
    .filter(Boolean);

  return {
    language: hasChinese ? "zh-CN" : "non-zh",
    shouldTranslate: !hasChinese,
    removedGarbledText: cleanedContent !== joinedContent,
    content: segmentedContent.length ? segmentedContent : document.content,
  };
}

export async function runTranslation(documentId: string) {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  try {
    return await runJsonStep(
      TRANSLATION_PROMPT,
      [`title: ${document.title}`, `language: ${document.language}`, ...document.content].join("\n\n"),
      translationSchema,
      parseTranslationFromText
    );
  } catch {
    return fallbackTranslation(documentId);
  }
}

export async function runIngestion(documentId: string) {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  let result: z.infer<typeof ingestSchema>;
  try {
    result = await runJsonStep(
      TRANSLATION_PROMPT,
      [`title: ${document.title}`, `content:\n${document.content.join("\n\n")}`].join("\n\n"),
      ingestSchema,
      parseIngestFromText
    );
  } catch {
    result = fallbackIngest(documentId);
  }

  const nextLanguage = result.shouldTranslate ? `${result.language} -> zh-CN` : result.language;

  return updateDocumentAnalysis(documentId, {
    content: result.content,
    language: nextLanguage,
    status: result.shouldTranslate ? "translated" : "ready",
  });
}

export async function runSummary(documentId: string) {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  let result: z.infer<typeof summarySchema>;
  try {
    result = await runJsonStep(
      SUMMARY_PROMPT,
      [`title: ${document.title}`, `content:\n${document.content.join("\n\n")}`].join("\n\n"),
      summarySchema,
      parseSummaryFromText
    );
  } catch {
    result = fallbackSummary(documentId);
  }

  return updateDocumentAnalysis(documentId, {
    summary: result.summary,
    status: "translated",
  });
}

export async function runNavigation(documentId: string) {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  let result: z.infer<typeof navigationSchema>;
  try {
    result = await runJsonStep(
      NAVIGATION_PROMPT,
      [`title: ${document.title}`, `content:\n${document.content.join("\n\n")}`].join("\n\n"),
      navigationSchema,
      parseNavigationFromText
    );
  } catch {
    result = fallbackNavigation(documentId);
  }

  return updateDocumentAnalysis(documentId, {
    sections: result.sections.map((section, index) => ({
      id: `${document.id}-section-${index + 1}`,
      title: section.title,
      summary: section.summary,
      paragraphStart: Math.max(0, Math.min(section.paragraphStart, document.content.length - 1)),
      paragraphEnd: Math.max(
        Math.max(0, Math.min(section.paragraphStart, document.content.length - 1)),
        Math.min(section.paragraphEnd, document.content.length - 1)
      ),
    })),
  });
}

export async function runQuestionAnswer(documentId: string, question: string) {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  appendConversationMessage(documentId, {
    id: `user-${Date.now()}`,
    role: "user",
    content: question,
    createdAt: new Date().toISOString(),
  });

  const excerpts = document.content.map((paragraph, index) => `Paragraph ${index + 1}: ${paragraph}`).join("\n");

  let result: z.infer<typeof qaSchema>;
  try {
    result = await runJsonStep(
      READING_PROMPT,
      [`title: ${document.title}`, `question: ${question}`, `excerpts:\n${excerpts}`].join("\n\n"),
      qaSchema,
      parseQaFromText
    );
  } catch {
    result = fallbackQa(documentId);
  }

  const message: ChatMessage = {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    content: result.answer,
    citations: result.citations.map((citation, index) => ({
      id: `citation-${index + 1}`,
      label: citation.label,
      excerpt: citation.excerpt,
    })),
    createdAt: new Date().toISOString(),
  };

  appendConversationMessage(documentId, message);
  return message;
}

export async function runComparison(documentIds: string[]): Promise<CompareResult> {
  const documents = documentIds.map((documentId) => getDocument(documentId)).filter(Boolean);
  if (documents.length < 2) {
    throw new Error("At least two documents are required for comparison.");
  }

  const payload = documents
    .map(
      (document) =>
        `title: ${document.title}\nsummary: ${document.summary}\nsections: ${document.sections
          .map((section) => `${section.title}: ${section.summary}`)
          .join("; ")}`
    )
    .join("\n\n");

  let result: z.infer<typeof comparisonSchema>;
  try {
    result = await runJsonStep(COMPARISON_PROMPT, payload, comparisonSchema);
  } catch {
    result = fallbackComparison(documentIds);
  }

  const compareResult = {
    documentIds,
    insights: result.insights,
  };

  updateCompareResult(compareResult);
  return compareResult;
}

export async function runReport(documentId: string): Promise<ReadingReport> {
  const document = getDocument(documentId);
  if (!document) {
    throw new Error("Document not found.");
  }

  const conversations = document.conversation.map((message) => {
    const roleLabel = message.role === "assistant" ? "assistant" : "user";
    return `${roleLabel}: ${message.content}`;
  });
  const notes = document.notes.map((note) => `${note.anchor}: ${note.note}`);
  const content = document.content.join("\n\n");

  let result: z.infer<typeof reportSchema>;
  try {
    result = await runJsonStep(
      SYNTHESIS_PROMPT,
      [
        `title: ${document.title}`,
        `content: ${content}`,
        `notes: ${notes.join("\n")}`,
        `conversation: ${conversations.join("\n")}`,
      ].join("\n\n"),
      reportSchema,
      parseReportFromText
    );
  } catch {
    result = fallbackReport(documentId);
  }

  const report: ReadingReport = {
    id: `report-${Date.now()}`,
    title: `${document.title} Reading Report`,
    summary: result.summary,
    generatedAt: new Date().toISOString(),
  };

  return saveReport(documentId, report);
}

export function getWorkspaceSnapshot() {
  return listWorkspace();
}
