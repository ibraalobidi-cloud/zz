import { GoogleGenAI } from '@google/genai';

export const config = {
  maxDuration: 30,
};

const PRIMARY_MODEL = 'gemini-3.8-flash-lite-tts';
const FALLBACK_MODEL = 'gemini-3.8-flash-tts';
const GEMINI_TIMEOUT_MS = 22000;
const MAX_TEXT_LENGTH = 900;
const MAX_CACHE_SIZE = 120;
const MODEL_COOLDOWN_MS = 5 * 60 * 1000;

// Persists across warm Vercel Serverless invocations & local Express runtime
const ttsCache = new Map();
const modelCooldownUntil = new Map();

const BASE_PERSONA =
  'A young, warm, cheerful Saudi female physical education teacher speaking in clear Modern Standard Arabic with a gentle, natural Saudi accent to 6th-grade girls on an athletics track. Soft, natural, realistic human female voice with smiling warmth, clear pronunciation of sports terms, moderate comfortable pacing, and natural pauses between sentences. Never robotic or metallic.';

const STYLE_MAP = {
  narrate: `${BASE_PERSONA} Tone: enthusiastic, welcoming, clear storytelling and guidance as if standing beside the students on the track.`,
  question: `${BASE_PERSONA} Tone: clear, attentive, friendly teacher reading an interactive question with a natural inquisitive cadence and brief pauses.`,
  celebrate: `${BASE_PERSONA} Tone: joyful, proud, genuinely excited smile praising a student for a great achievement or correct answer.`,
  encourage: `${BASE_PERSONA} Tone: warm, uplifting, motivating and confident, cheering the student forward.`,
  coach: `${BASE_PERSONA} Tone: gentle, empathetic, reassuring and supportive when guiding a student to try again after a mistake.`,
};

function getApiKey() {
  const raw = (process.env.GEMINI_API_KEY || '').trim();
  if (!raw || raw === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return raw;
}

function createAiClient(apiKey) {
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      apiVersion: 'v1beta',
      timeout: GEMINI_TIMEOUT_MS,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseSampleRateFromMime(mimeType) {
  if (!mimeType || typeof mimeType !== 'string') return 24000;
  const match = mimeType.match(/rate=(\d+)/i);
  if (match && match[1]) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed >= 8000 && parsed <= 96000) {
      return parsed;
    }
  }
  return 24000;
}

/**
 * Ensures returned audio bytes always have a valid 44-byte RIFF/WAV header
 * so HTMLAudioElement / Web Audio API plays consistently across all browsers.
 */
function ensureWavBuffer(rawBuffer, mimeType) {
  if (
    rawBuffer.length >= 12 &&
    rawBuffer.toString('ascii', 0, 4) === 'RIFF' &&
    rawBuffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    return rawBuffer;
  }

  const sampleRate = parseSampleRateFromMime(mimeType);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = rawBuffer.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, rawBuffer]);
}

function classifyGeminiError(err) {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err?.message === 'string'
        ? err.message
        : String(err);
  const statusCode = typeof err?.status === 'number' ? err.status : 0;
  const lower = msg.toLowerCase();

  if (
    err?.name === 'AbortError' ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('etimedout') ||
    statusCode === 504 ||
    statusCode === 408
  ) {
    return {
      status: 504,
      code: 'TIMEOUT',
      userMessage: 'انتهت مهلة الاتصال بخدمة الصوت. يرجى المحاولة مرة أخرى.',
      technicalMessage: msg,
    };
  }

  if (
    statusCode === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    return {
      status: 429,
      code: 'RATE_LIMITED',
      userMessage:
        'تم تجاوز الحد المؤقت لطلبات توليد الصوت. انتظري لحظات ثم أعيدي المحاولة.',
      technicalMessage: msg,
    };
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied')
  ) {
    return {
      status: 502,
      code: 'INVALID_API_KEY',
      userMessage:
        'تعذر التحقق من صلاحية مفتاح GEMINI_API_KEY على الخادم. يرجى مراجعة متغيرات البيئة في Vercel.',
      technicalMessage: msg,
    };
  }

  if (statusCode === 404 || lower.includes('not_found')) {
    return {
      status: 502,
      code: 'MODEL_UNAVAILABLE',
      userMessage: 'نموذج الصوت المطلوب غير متاح حالياً.',
      technicalMessage: msg,
    };
  }

  if (
    lower.includes('econnreset') ||
    lower.includes('enotfound') ||
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    statusCode >= 500
  ) {
    return {
      status: 502,
      code: 'UPSTREAM_ERROR',
      userMessage: 'حدث خطأ مؤقت في الاتصال بخدمة الصوت الواقعي.',
      technicalMessage: msg,
    };
  }

  return {
    status: 502,
    code: 'TTS_FAILED',
    userMessage: 'تعذر توليد الصوت الواقعي في الوقت الحالي.',
    technicalMessage: msg,
  };
}

async function synthesizeWithModel(ai, model, text, style) {
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text,
            speechMetadata: {
              style,
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const audioPart = parts.find((p) => p.inlineData?.data);
  const inlineData = audioPart?.inlineData;

  if (!inlineData?.data) {
    throw new Error(`Model ${model} returned an empty audio payload.`);
  }

  const rawBuffer = Buffer.from(inlineData.data, 'base64');
  if (rawBuffer.length === 0) {
    throw new Error(`Model ${model} returned zero audio bytes.`);
  }

  const wavBuffer = ensureWavBuffer(rawBuffer, inlineData.mimeType);
  return { wavBuffer, model };
}

async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString('utf8').trim();
      return str ? JSON.parse(str) : {};
    }
    if (typeof req.body === 'string') {
      const str = req.body.trim();
      return str ? JSON.parse(str) : {};
    }
    if (typeof req.body === 'object') {
      return req.body;
    }
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (status >= 400) {
    res.setHeader('Cache-Control', 'no-store');
  }
  for (const [k, v] of Object.entries(extraHeaders)) {
    res.setHeader(k, v);
  }
  res.end(body);
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  const method = (req.method || 'GET').toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (method === 'GET') {
    const queryUrl = new URL(req.url || '/api/tts', 'http://localhost');
    if (
      queryUrl.searchParams.get('health') === '1' ||
      !queryUrl.searchParams.get('text')
    ) {
      const configured = Boolean(getApiKey());
      sendJson(res, configured ? 200 : 503, {
        ok: configured,
        configured,
        runtime: process.env.VERCEL ? 'vercel' : 'node',
        models: [PRIMARY_MODEL, FALLBACK_MODEL],
        cacheSize: ttsCache.size,
      });
      return;
    }
  }

  if (method !== 'POST' && method !== 'GET') {
    sendJson(res, 405, {
      error: 'طريقة الطلب غير مدعومة.',
      code: 'METHOD_NOT_ALLOWED',
    });
    return;
  }

  try {
    let payload = {};
    let format = 'json';

    if (method === 'POST') {
      try {
        payload = await readJsonBody(req);
      } catch (parseErr) {
        console.warn('[TTS] Invalid JSON request body:', parseErr);
        sendJson(res, 400, {
          error: 'تنسيق الطلب غير صالح.',
          code: 'INVALID_JSON',
        });
        return;
      }
    } else {
      const queryUrl = new URL(req.url || '/api/tts', 'http://localhost');
      payload = {
        text: queryUrl.searchParams.get('text') || '',
        tone: queryUrl.searchParams.get('tone') || 'narrate',
      };
      format = queryUrl.searchParams.get('format') || 'json';
    }

    const cleanText = String(payload?.text || '').trim();
    if (!cleanText) {
      sendJson(res, 400, {
        error: 'النص المطلوب تحويله إلى صوت فارغ.',
        code: 'EMPTY_TEXT',
      });
      return;
    }

    if (cleanText.length > MAX_TEXT_LENGTH) {
      sendJson(res, 400, {
        error: 'النص طويل جداً لتوليد مقطع صوتي واحد.',
        code: 'TEXT_TOO_LONG',
      });
      return;
    }

    const rawTone = String(payload?.tone || 'narrate');
    const safeTone = rawTone in STYLE_MAP ? rawTone : 'narrate';
    const cacheKey = `${safeTone}:${cleanText}`;

    // 1. Check warm serverless / server cache
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      console.info(
        `[TTS] Cache HIT | tone=${safeTone} | len=${cleanText.length} | model=${cached.model} | ${Date.now() - startedAt}ms`
      );
      if (format === 'audio') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', String(cached.wavBuffer.length));
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-TTS-Cache', 'HIT');
        res.setHeader('X-TTS-Model', cached.model);
        res.end(cached.wavBuffer);
        return;
      }
      sendJson(
        res,
        200,
        {
          audioBase64: cached.base64,
          mimeType: 'audio/wav',
          model: cached.model,
          cached: true,
        },
        {
          'Cache-Control': 'private, max-age=3600',
          'X-TTS-Cache': 'HIT',
          'X-TTS-Model': cached.model,
        }
      );
      return;
    }

    // 2. Verify server-side GEMINI_API_KEY
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error(
        '[TTS] Missing GEMINI_API_KEY environment variable in server runtime.'
      );
      sendJson(res, 503, {
        error:
          'مفتاح GEMINI_API_KEY غير مضبوط في إعدادات البيئة على Vercel (Environment Variables).',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    const ai = createAiClient(apiKey);
    const style = STYLE_MAP[safeTone];

    // 3. Try primary model (flash-lite-tts), skipping models currently in 429 cooldown
    let result = null;
    let lastErr = null;
    const now = Date.now();

    const candidateAttempts = [
      { model: PRIMARY_MODEL, delayMs: 0 },
      { model: FALLBACK_MODEL, delayMs: 200 },
      { model: PRIMARY_MODEL, delayMs: 650 },
    ].filter((a, idx, arr) => {
      const until = modelCooldownUntil.get(a.model) || 0;
      if (until > now) return false;
      if (idx > 0 && a.model === arr[idx - 1].model) return false;
      return true;
    });

    const attempts =
      candidateAttempts.length > 0
        ? candidateAttempts
        : [{ model: PRIMARY_MODEL, delayMs: 0 }];

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
        if (classified.code === 'RATE_LIMITED') {
          modelCooldownUntil.set(attempt.model, Date.now() + MODEL_COOLDOWN_MS);
          console.info(
            `[TTS] Model ${attempt.model} rate-limited (429), switching to backup.`
          );
        } else {
          console.info(
            `[TTS] Attempt ${i + 1}/${attempts.length} skipped | model=${attempt.model} | code=${classified.code}`
          );
        }
        if (classified.code === 'INVALID_API_KEY') {
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
        code: classified.code,
      });
      return;
    }

    const base64 = result.wavBuffer.toString('base64');

    if (ttsCache.size >= MAX_CACHE_SIZE) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, {
      wavBuffer: result.wavBuffer,
      base64,
      model: result.model,
      createdAt: Date.now(),
    });

    console.info(
      `[TTS] Synthesis OK | tone=${safeTone} | len=${cleanText.length} | bytes=${result.wavBuffer.length} | model=${result.model} | ${Date.now() - startedAt}ms`
    );

    if (format === 'audio') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', String(result.wavBuffer.length));
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-TTS-Cache', 'MISS');
      res.setHeader('X-TTS-Model', result.model);
      res.end(result.wavBuffer);
      return;
    }

    sendJson(
      res,
      200,
      {
        audioBase64: base64,
        mimeType: 'audio/wav',
        model: result.model,
        cached: false,
      },
      {
        'Cache-Control': 'private, max-age=3600',
        'X-TTS-Cache': 'MISS',
        'X-TTS-Model': result.model,
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
      code: classified.code,
    });
  }
}
