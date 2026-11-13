import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '1mb' }));

// Bounded in-memory cache for generated Arabic female voice clips
const ttsCache = new Map<string, string>();
const MAX_CACHE_SIZE = 120;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      apiVersion: 'v1beta',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

type VoiceTone = 'celebrate' | 'encourage' | 'coach' | 'narrate' | 'question';

const BASE_PERSONA =
  'A young, warm, cheerful Saudi female physical education teacher speaking in clear Modern Standard Arabic with a gentle, natural Saudi accent to 6th-grade girls on an athletics track. Soft, natural, realistic human female voice with smiling warmth, clear pronunciation of sports terms, moderate comfortable pacing, and natural pauses between sentences. Never robotic or metallic.';

const STYLE_MAP: Record<VoiceTone, string> = {
  narrate: `${BASE_PERSONA} Tone: enthusiastic, welcoming, clear storytelling and guidance as if standing beside the students on the track.`,
  question: `${BASE_PERSONA} Tone: clear, attentive, friendly teacher reading an interactive question with a natural inquisitive cadence and brief pauses.`,
  celebrate: `${BASE_PERSONA} Tone: joyful, proud, genuinely excited smile praising a student for a great achievement or correct answer.`,
  encourage: `${BASE_PERSONA} Tone: warm, uplifting, motivating and confident, cheering the student forward.`,
  coach: `${BASE_PERSONA} Tone: gentle, empathetic, reassuring and supportive when guiding a student to try again after a mistake.`,
};

async function synthesizeWithModel(
  ai: GoogleGenAI,
  model: string,
  text: string,
  style: string
): Promise<string | undefined> {
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

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}

app.post('/api/voice-feedback', async (req, res) => {
  try {
    const { text, tone = 'narrate' } = req.body as {
      text?: string;
      tone?: VoiceTone;
    };

    const cleanText = (text ?? '').trim();
    if (!cleanText || cleanText.length > 900) {
      res.status(400).json({ error: 'نص التعليق الصوتي غير صالح.' });
      return;
    }

    const safeTone: VoiceTone = tone in STYLE_MAP ? tone : 'narrate';
    const cacheKey = `${safeTone}:${cleanText}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      res.json({ audioBase64: cached, mimeType: 'audio/wav', cached: true });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'مفتاح Gemini API غير متوفر لتوليد الصوت الواقعي.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    const style = STYLE_MAP[safeTone];
    let base64Audio: string | undefined;

    try {
      base64Audio = await synthesizeWithModel(
        ai,
        'gemini-3.8-flash-tts',
        cleanText,
        style
      );
    } catch {
      base64Audio = await synthesizeWithModel(
        ai,
        'gemini-3.8-flash-lite-tts',
        cleanText,
        style
      );
    }

    if (!base64Audio) {
      res.status(502).json({ error: 'لم يتم استلام مقطع صوتي من خدمة التوليد.' });
      return;
    }

    if (ttsCache.size >= MAX_CACHE_SIZE) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, base64Audio);

    res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'حدث خطأ أثناء توليد الصوت الواقعي.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
