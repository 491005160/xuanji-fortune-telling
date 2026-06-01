import { GoogleGenAI } from "@google/genai";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);

const MAX_PROMPT_LENGTH = 20000;
const MAX_SYSTEM_INSTRUCTION_LENGTH = 3000;

app.use(express.json({ limit: "32kb" }));

function normalizeError(error) {
  if (!(error instanceof Error)) {
    return {
      statusCode: 500,
      message: "Unknown AI provider error.",
    };
  }

  const statusCode =
    error.status || error.statusCode || error.response?.status || 500;
  const parts = [
    error.message,
    error.code ? `code: ${error.code}` : "",
    error.response?.statusText,
  ].filter(Boolean);

  return {
    statusCode,
    message: parts.join(" | ") || "AI provider request failed.",
  };
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).type("application/json").send(payload);
}

async function streamOpenAICompatible(res, prompt, systemInstruction) {
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

  res.status(200).set({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith("data:")) continue;

      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;

      try {
        const chunk = JSON.parse(data);
        const text =
          chunk.choices?.[0]?.delta?.content ||
          chunk.choices?.[0]?.message?.content ||
          "";
        if (text) res.write(text);
      } catch {
        // Ignore malformed stream fragments and continue reading.
      }
    }
  }

  res.end();
}

async function streamGemini(res, prompt, systemInstruction) {
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

  res.status(200).set({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });

  for await (const chunk of stream) {
    if (chunk.text) res.write(chunk.text);
  }

  res.end();
}

app.post("/api/gemini", async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body || {};

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

    await streamGemini(res, prompt, systemInstruction);
  } catch (error) {
    console.error("AI API error:", error);
    const normalizedError = normalizeError(error);
    if (!res.headersSent) {
      sendJson(res, normalizedError.statusCode, {
        error: normalizedError.message,
      });
      return;
    }
    res.end();
  }
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});
