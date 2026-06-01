import { GoogleGenAI } from "@google/genai";
import type { IncomingMessage, ServerResponse } from "node:http";

type GeminiRequest = {
  prompt?: string;
  systemInstruction?: string;
};

type OpenAICompatibleChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
  }>;
};

type ErrorWithDetails = Error & {
  status?: number;
  statusCode?: number;
  code?: string | number;
  response?: {
    status?: number;
    statusText?: string;
  };
};

const MAX_PROMPT_LENGTH = 20000;
const MAX_SYSTEM_INSTRUCTION_LENGTH = 3000;

function readBody(req: IncomingMessage): Promise<GeminiRequest> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_PROMPT_LENGTH + MAX_SYSTEM_INSTRUCTION_LENGTH + 1000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function normalizeError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      statusCode: 500,
      message: "Unknown Gemini error.",
    };
  }

  const detailedError = error as ErrorWithDetails;
  const statusCode =
    detailedError.status ||
    detailedError.statusCode ||
    detailedError.response?.status ||
    500;
  const parts = [
    detailedError.message,
    detailedError.code ? `code: ${detailedError.code}` : "",
    detailedError.response?.statusText,
  ].filter(Boolean);

  return {
    statusCode,
    message: parts.join(" | ") || "Gemini request failed.",
  };
}

async function streamOpenAICompatible(
  res: ServerResponse,
  prompt: string,
  systemInstruction?: string,
) {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL || "https://api.siliconflow.cn/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.AI_MODEL || "deepseek-ai/DeepSeek-V4-Flash";

  if (!apiKey) {
    sendJson(res, 500, { error: "AI_API_KEY is not configured." });
    return;
  }

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            systemInstruction || "你是一位专业大师，以严谨神秘的风格提供解答。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    sendJson(res, upstream.status, {
      error: `AI provider request failed: ${text || upstream.statusText}`,
    });
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith("data:")) {
        continue;
      }

      const data = line.slice(5).trim();
      if (data === "[DONE]") {
        continue;
      }

      try {
        const chunk = JSON.parse(data) as OpenAICompatibleChunk;
        const text =
          chunk.choices?.[0]?.delta?.content ||
          chunk.choices?.[0]?.message?.content ||
          "";
        if (text) {
          res.write(text);
        }
      } catch {
        // Ignore malformed stream fragments and continue reading.
      }
    }
  }

  res.end();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const { prompt, systemInstruction } = await readBody(req);

    if (!prompt || typeof prompt !== "string") {
      sendJson(res, 400, { error: "Prompt is required." });
      return;
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      sendJson(res, 400, { error: "Prompt is too long." });
      return;
    }

    if (
      systemInstruction &&
      (typeof systemInstruction !== "string" ||
        systemInstruction.length > MAX_SYSTEM_INSTRUCTION_LENGTH)
    ) {
      sendJson(res, 400, { error: "System instruction is invalid." });
      return;
    }

    if (process.env.AI_PROVIDER === "siliconflow" || process.env.AI_API_KEY) {
      await streamOpenAICompatible(res, prompt, systemInstruction);
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      sendJson(res, 500, { error: "GEMINI_API_KEY is not configured." });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const stream = await ai.models.generateContentStream({
      model,
      contents: prompt,
      config: {
        temperature: 0.7,
        systemInstruction:
          systemInstruction || "你是一位专业大师，以严谨神秘的风格提供解答。",
      },
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }

    res.end();
  } catch (error) {
    console.error("Gemini API error:", error);
    const normalizedError = normalizeError(error);
    if (!res.headersSent) {
      sendJson(res, normalizedError.statusCode, {
        error: normalizedError.message,
      });
      return;
    }
    res.end();
  }
}
