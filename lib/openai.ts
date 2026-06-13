import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL,
    });
  }

  return client;
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.LLM_MODEL || "glm-4.5-air";

