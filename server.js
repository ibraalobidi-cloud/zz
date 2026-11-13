// server.ts
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// api/_ttsCore.ts
import { GoogleGenAI } from "@google/genai";
var PRIMARY_MODEL = "gemini-3.8-flash-lite-tts";
var FALLBACK_MODEL = "gemini-3.8-flash-tts";
var GEMINI_TIMEOUT_MS = 2e4;
var MAX_TEXT_LENGTH = 900;
var MAX_CACHE_SIZE = 120;
var MODEL_COOLDOWN_MS = 5 * 60 * 1e3;
var modelCooldownUntil = /* @__PURE__ */ new Map();
var BASE_PERSONA = "A young, warm, cheerful Saudi female physical education teacher speaking in clear Modern Standard Arabic with a gentle, natural Saudi accent to 6th-grade girls on an athletics track. Soft, natural, realistic human female voice with smiling warmth, clear pronunciation of sports terms, moderate comfortable pacing, and natural pauses between sentences. Never robotic or metallic.";
var STYLE_MAP = {
  narrate: `${BASE_PERSONA} Tone: enthusiastic, welcoming, clear storytelling and guidance as if standing beside the students on the track.`,
  question: `${BASE_PERSONA} Tone: clear, attentive, friendly teacher reading an interactive question with a natural inquisitive cadence and brief pauses.`,
  celebrate: `${BASE_PERSONA} Tone: joyful, proud, genuinely excited smile praising a student for a great achievement or correct answer.`,
  encourage: `${BASE_PERSONA} Tone: warm, uplifting, motivating and confident, cheering the student forward.`,
  coach: `${BASE_PERSONA} Tone: gentle, empathetic, reassuring and supportive when guiding a student to try again after a mistake.`
};
var ttsCache = /* @__PURE__ */ new Map();
function getApiKey() {
  const raw = process.env.GEMINI_API_KEY?.trim();
  if (!raw || raw === "MY_GEMINI_API_KEY") {
    return null;
  }
  return raw;
}
function createAiClient(apiKey) {
  return new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      apiVersion: "v1beta",
      timeout: GEMINI_TIMEOUT_MS,
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
function parseSampleRateFromMime(mimeType) {
  if (!mimeType) return 24e3;
  const match = mimeType.match(/rate=(\d+)/i);
  if (match && match[1]) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed >= 8e3 && parsed <= 96e3) {
      return parsed;
    }
  }
  return 24e3;
}
function ensureWavBuffer(rawBuffer, mimeType) {
  if (rawBuffer.length >= 12 && rawBuffer.toString("ascii", 0, 4) === "RIFF" && rawBuffer.toString("ascii", 8, 12) === "WAVE") {
    return rawBuffer;
  }
  const sampleRate = parseSampleRateFromMime(mimeType);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = rawBuffer.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, rawBuffer]);
}
function classifyGeminiError(err) {
  const errObj = err;
  const msg = err instanceof Error ? err.message : typeof errObj?.message === "string" ? errObj.message : String(err);
  const statusCode = typeof errObj?.status === "number" ? errObj.status : 0;
  const lower = msg.toLowerCase();
  if (errObj?.name === "AbortError" || lower.includes("timeout") || lower.includes("timed out") || lower.includes("etimedout") || statusCode === 504 || statusCode === 408) {
    return {
      status: 504,
      code: "TIMEOUT",
      userMessage: "\u0627\u0646\u062A\u0647\u062A \u0645\u0647\u0644\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u062E\u062F\u0645\u0629 \u0627\u0644\u0635\u0648\u062A. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.",
      technicalMessage: msg,
      retryable: true
    };
  }
  if (statusCode === 429 || lower.includes("resource_exhausted") || lower.includes("quota") || lower.includes("rate limit")) {
    return {
      status: 429,
      code: "RATE_LIMITED",
      userMessage: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0624\u0642\u062A \u0644\u0637\u0644\u0628\u0627\u062A \u062A\u0648\u0644\u064A\u062F \u0627\u0644\u0635\u0648\u062A. \u0627\u0646\u062A\u0638\u0631\u064A \u0644\u062D\u0638\u0627\u062A \u062B\u0645 \u0623\u0639\u064A\u062F\u064A \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.",
      technicalMessage: msg,
      retryable: false
    };
  }
  if (statusCode === 401 || statusCode === 403 || lower.includes("api_key_invalid") || lower.includes("api key not valid") || lower.includes("permission_denied")) {
    return {
      status: 502,
      code: "INVALID_API_KEY",
      userMessage: "\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0635\u0644\u0627\u062D\u064A\u0629 \u0645\u0641\u062A\u0627\u062D Gemini API \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645. \u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0628\u064A\u0626\u0629.",
      technicalMessage: msg,
      retryable: false
    };
  }
  if (statusCode === 404 || lower.includes("not_found")) {
    return {
      status: 502,
      code: "MODEL_UNAVAILABLE",
      userMessage: "\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0635\u0648\u062A \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u062D\u0627\u0644\u064A\u0627\u064B.",
      technicalMessage: msg,
      retryable: false
    };
  }
  if (lower.includes("econnreset") || lower.includes("enotfound") || lower.includes("fetch failed") || lower.includes("network") || statusCode >= 500) {
    return {
      status: 502,
      code: "UPSTREAM_ERROR",
      userMessage: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0645\u0624\u0642\u062A \u0641\u064A \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u062E\u062F\u0645\u0629 \u0627\u0644\u0635\u0648\u062A \u0627\u0644\u0648\u0627\u0642\u0639\u064A.",
      technicalMessage: msg,
      retryable: true
    };
  }
  return {
    status: 502,
    code: "TTS_FAILED",
    userMessage: "\u062A\u0639\u0630\u0631 \u062A\u0648\u0644\u064A\u062F \u0627\u0644\u0635\u0648\u062A \u0627\u0644\u0648\u0627\u0642\u0639\u064A \u0641\u064A \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u062D\u0627\u0644\u064A.",
    technicalMessage: msg,
    retryable: true
  };
}
async function synthesizeWithModel(ai, model, text, style) {
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text,
            speechMetadata: {
              style
            }
          }
        ]
      }
    ],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" }
        }
      }
    }
  });
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const audioPart = parts.find((p) => p.inlineData?.data);
  const inlineData = audioPart?.inlineData;
  if (!inlineData?.data) {
    throw new Error(`Model ${model} returned an empty audio payload.`);
  }
  const rawBuffer = Buffer.from(inlineData.data, "base64");
  if (rawBuffer.length === 0) {
    throw new Error(`Model ${model} returned zero audio bytes.`);
  }
  const wavBuffer = ensureWavBuffer(rawBuffer, inlineData.mimeType);
  return { wavBuffer, model };
}
async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}
function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(extraHeaders)) {
    res.setHeader(k, v);
  }
  res.end(body);
}
async function handleTtsNodeRequest(req, res) {
  const startedAt = Date.now();
  const method = (req.method ?? "GET").toUpperCase();
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (method === "GET") {
    const queryUrl = new URL(req.url || "/api/tts", "http://localhost");
    if (queryUrl.searchParams.get("health") === "1" || !queryUrl.searchParams.get("text")) {
      const configured = Boolean(getApiKey());
      sendJson(res, configured ? 200 : 503, {
        ok: configured,
        configured,
        models: [PRIMARY_MODEL, FALLBACK_MODEL],
        cacheSize: ttsCache.size
      });
      return;
    }
  }
  if (method !== "POST" && method !== "GET") {
    sendJson(res, 405, {
      error: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629.",
      code: "METHOD_NOT_ALLOWED"
    });
    return;
  }
  try {
    let payload = {};
    let format = "json";
    if (method === "POST") {
      try {
        payload = await readJsonBody(req);
      } catch (parseErr) {
        console.warn("[TTS] Invalid JSON request body:", parseErr);
        sendJson(res, 400, {
          error: "\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.",
          code: "INVALID_JSON"
        });
        return;
      }
    } else {
      const queryUrl = new URL(req.url || "/api/tts", "http://localhost");
      payload = {
        text: queryUrl.searchParams.get("text") ?? "",
        tone: queryUrl.searchParams.get("tone") || "narrate"
      };
      format = queryUrl.searchParams.get("format") || "json";
    }
    const cleanText = (payload.text ?? "").trim();
    if (!cleanText) {
      sendJson(res, 400, {
        error: "\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u062A\u062D\u0648\u064A\u0644\u0647 \u0625\u0644\u0649 \u0635\u0648\u062A \u0641\u0627\u0631\u063A.",
        code: "EMPTY_TEXT"
      });
      return;
    }
    if (cleanText.length > MAX_TEXT_LENGTH) {
      sendJson(res, 400, {
        error: "\u0627\u0644\u0646\u0635 \u0637\u0648\u064A\u0644 \u062C\u062F\u0627\u064B \u0644\u062A\u0648\u0644\u064A\u062F \u0645\u0642\u0637\u0639 \u0635\u0648\u062A\u064A \u0648\u0627\u062D\u062F.",
        code: "TEXT_TOO_LONG"
      });
      return;
    }
    const safeTone = payload.tone && payload.tone in STYLE_MAP ? payload.tone : "narrate";
    const cacheKey = `${safeTone}:${cleanText}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      console.info(
        `[TTS] Cache HIT | tone=${safeTone} | len=${cleanText.length} | model=${cached.model} | ${Date.now() - startedAt}ms`
      );
      if (format === "audio") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Content-Length", String(cached.wavBuffer.length));
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("X-TTS-Cache", "HIT");
        res.setHeader("X-TTS-Model", cached.model);
        res.end(cached.wavBuffer);
        return;
      }
      sendJson(
        res,
        200,
        {
          audioBase64: cached.base64,
          mimeType: "audio/wav",
          model: cached.model,
          cached: true
        },
        {
          "Cache-Control": "private, max-age=3600",
          "X-TTS-Cache": "HIT",
          "X-TTS-Model": cached.model
        }
      );
      return;
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error(
        "[TTS] Missing GEMINI_API_KEY environment variable in server runtime."
      );
      sendJson(res, 503, {
        error: "\u0645\u0641\u062A\u0627\u062D GEMINI_API_KEY \u063A\u064A\u0631 \u0645\u0636\u0628\u0648\u0637 \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062E\u0627\u062F\u0645 (Vercel Environment Variables).",
        code: "MISSING_API_KEY"
      });
      return;
    }
    const ai = createAiClient(apiKey);
    const style = STYLE_MAP[safeTone];
    let result = null;
    let lastErr = null;
    const now = Date.now();
    const candidateAttempts = [
      { model: PRIMARY_MODEL, delayMs: 0 },
      { model: FALLBACK_MODEL, delayMs: 200 },
      { model: PRIMARY_MODEL, delayMs: 650 }
    ].filter((a, idx, arr) => {
      const until = modelCooldownUntil.get(a.model) ?? 0;
      if (until > now) return false;
      if (idx > 0 && a.model === arr[idx - 1].model) return false;
      return true;
    });
    const attempts = candidateAttempts.length > 0 ? candidateAttempts : [{ model: PRIMARY_MODEL, delayMs: 0 }];
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      if (attempt.delayMs > 0) {
        await new Promise((r) => setTimeout(r, attempt.delayMs));
      }
      try {
        result = await synthesizeWithModel(ai, attempt.model, cleanText, style);
        modelCooldownUntil.delete(attempt.model);
        break;
      } catch (err) {
        lastErr = err;
        const classified = classifyGeminiError(err);
        if (classified.code === "RATE_LIMITED") {
          modelCooldownUntil.set(attempt.model, Date.now() + MODEL_COOLDOWN_MS);
          console.info(
            `[TTS] Model ${attempt.model} rate-limited (429), switching to backup/fallback.`
          );
        } else {
          console.info(
            `[TTS] Attempt ${i + 1}/${attempts.length} skipped | model=${attempt.model} | code=${classified.code}`
          );
        }
        if (classified.code === "INVALID_API_KEY") {
          break;
        }
      }
    }
    if (!result) {
      const classified = classifyGeminiError(lastErr);
      console.error(
        `[TTS] All synthesis attempts failed | tone=${safeTone} | len=${cleanText.length} | status=${classified.status} | code=${classified.code} | ${Date.now() - startedAt}ms | detail=${classified.technicalMessage}`
      );
      sendJson(res, classified.status, {
        error: classified.userMessage,
        code: classified.code
      });
      return;
    }
    const base64 = result.wavBuffer.toString("base64");
    if (ttsCache.size >= MAX_CACHE_SIZE) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, {
      wavBuffer: result.wavBuffer,
      base64,
      model: result.model,
      createdAt: Date.now()
    });
    console.info(
      `[TTS] Synthesis OK | tone=${safeTone} | len=${cleanText.length} | bytes=${result.wavBuffer.length} | model=${result.model} | ${Date.now() - startedAt}ms`
    );
    if (format === "audio") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", String(result.wavBuffer.length));
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("X-TTS-Cache", "MISS");
      res.setHeader("X-TTS-Model", result.model);
      res.end(result.wavBuffer);
      return;
    }
    sendJson(
      res,
      200,
      {
        audioBase64: base64,
        mimeType: "audio/wav",
        model: result.model,
        cached: false
      },
      {
        "Cache-Control": "private, max-age=3600",
        "X-TTS-Cache": "MISS",
        "X-TTS-Model": result.model
      }
    );
  } catch (err) {
    const classified = classifyGeminiError(err);
    console.error(
      `[TTS] Unhandled server exception | code=${classified.code} | ${Date.now() - startedAt}ms`,
      err
    );
    sendJson(res, classified.status, {
      error: classified.userMessage,
      code: classified.code
    });
  }
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
app.use(express.json({ limit: "1mb" }));
app.all("/api/tts", (req, res) => {
  void handleTtsNodeRequest(req, res);
});
app.all("/api/voice-feedback", (req, res) => {
  void handleTtsNodeRequest(req, res);
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
