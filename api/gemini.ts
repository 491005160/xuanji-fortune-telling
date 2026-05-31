import { GoogleGenAI } from "@google/genai";
import type { IncomingMessage, ServerResponse } from "node:http";

type GeminiRequest = {
  prompt?: string;
  systemInstruction?: string;
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: "GEMINI_API_KEY is not configured." });
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
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Gemini request failed." });
      return;
    }
    res.end();
  }
}
