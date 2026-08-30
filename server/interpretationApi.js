import {
  CLASSIFIER_SYSTEM_PROMPT,
  normalizeClassification,
  validateClassification,
} from "../app/domain/interpretation.js";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_TEXT_LENGTH = 4000;

function writeJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function extractJsonObject(rawText) {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("MODEL_RESPONSE_WITHOUT_JSON");
  return JSON.parse(match[0]);
}

export function createInterpretationHandler({ apiKey, model, baseUrl = "https://api.anthropic.com" }) {
  return async function interpretationHandler(request, response) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      writeJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
      return;
    }
    if (!apiKey) {
      writeJson(response, 503, { error: "AI_NOT_CONFIGURED" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      const statusCode = error.message === "REQUEST_TOO_LARGE" ? 413 : 400;
      writeJson(response, statusCode, { error: "INVALID_REQUEST" });
      return;
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < 3 || text.length > MAX_TEXT_LENGTH) {
      writeJson(response, 400, { error: "INVALID_TEXT" });
      return;
    }

    const providerController = new AbortController();
    const providerTimeout = setTimeout(() => providerController.abort(), 12000);
    try {
      const providerResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/messages`, {
        method: "POST",
        signal: providerController.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          temperature: 0,
          system: CLASSIFIER_SYSTEM_PROMPT,
          messages: [{ role: "user", content: text }],
        }),
      });

      if (!providerResponse.ok) {
        const providerError = await providerResponse.text();
        console.error("AI interpretation provider error", providerResponse.status, providerError.slice(0, 500));
        writeJson(response, 502, { error: "AI_PROVIDER_ERROR" });
        return;
      }

      const providerData = await providerResponse.json();
      const rawText = (providerData.content || [])
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();
      const classification = normalizeClassification(extractJsonObject(rawText));
      if (!validateClassification(classification)) {
        writeJson(response, 502, { error: "INVALID_AI_RESPONSE" });
        return;
      }

      writeJson(response, 200, { classification });
    } catch (error) {
      console.error("AI interpretation provider request failed", error);
      writeJson(response, 502, { error: "AI_PROVIDER_ERROR" });
    } finally {
      clearTimeout(providerTimeout);
    }
  };
}
