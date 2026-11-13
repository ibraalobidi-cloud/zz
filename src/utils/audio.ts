// Unified Gemini Realistic Female Voice Audio Engine + Synthesized Track SFX
// Uses server-side Gemini TTS exclusively (no browser SpeechSynthesis)

export type VoiceTone =
  | 'celebrate'
  | 'encourage'
  | 'coach'
  | 'narrate'
  | 'question';

export type VoicePlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused';

export interface VoicePlaybackSnapshot {
  activeKey: string | null;
  status: VoicePlaybackStatus;
  error: string | null;
}

type VoiceListener = (snapshot: VoicePlaybackSnapshot) => void;

const listeners = new Set<VoiceListener>();
let snapshot: VoicePlaybackSnapshot = {
  activeKey: null,
  status: 'idle',
  error: null,
};

let currentAudioEl: HTMLAudioElement | null = null;
let currentAbortController: AbortController | null = null;
let currentVolume = 0.9;
let playbackToken = 0;

// Bounded client-side ObjectURL cache + in-flight request deduplication
const audioUrlCache = new Map<string, string>();
const inFlightFetches = new Map<string, Promise<string>>();
const MAX_CLIENT_CACHE = 80;

let audioCtx: AudioContext | null = null;

function notify() {
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function setSnapshot(next: Partial<VoicePlaybackSnapshot>) {
  snapshot = { ...snapshot, ...next };
  notify();
}

export function subscribeVoiceState(listener: VoiceListener): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function getVoiceSnapshot(): VoicePlaybackSnapshot {
  return snapshot;
}

export function setGlobalVoiceVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  currentVolume = clamped;
  if (currentAudioEl) {
    currentAudioEl.volume = clamped;
  }
}

function base64WavToObjectUrl(base64: string, mimeType = 'audio/wav'): string {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

async function fetchOrGetCachedAudioUrl(
  text: string,
  tone: VoiceTone,
  signal?: AbortSignal
): Promise<string> {
  const cleanText = text.trim();
  const cacheKey = `${tone}:${cleanText}`;

  const cached = audioUrlCache.get(cacheKey);
  if (cached) return cached;

  const existingPromise = inFlightFetches.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const fetchPromise = (async () => {
    const resp = await fetch('/api/voice-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, tone }),
      signal,
    });

    if (!resp.ok) {
      const errData = (await resp.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(errData.error || 'تعذر تحميل الصوت الواقعي.');
    }

    const data = (await resp.json()) as {
      audioBase64?: string;
      mimeType?: string;
    };

    if (!data.audioBase64) {
      throw new Error('لم يتم استلام ملف الصوت من الخادم.');
    }

    const url = base64WavToObjectUrl(
      data.audioBase64,
      data.mimeType || 'audio/wav'
    );

    if (audioUrlCache.size >= MAX_CLIENT_CACHE) {
      const oldestKey = audioUrlCache.keys().next().value;
      if (oldestKey) {
        const oldUrl = audioUrlCache.get(oldestKey);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        audioUrlCache.delete(oldestKey);
      }
    }
    audioUrlCache.set(cacheKey, url);
    return url;
  })();

  inFlightFetches.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightFetches.delete(cacheKey);
  }
}

export function stopSpeaking(): void {
  playbackToken += 1;
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  if (currentAudioEl) {
    try {
      currentAudioEl.onplay = null;
      currentAudioEl.onpause = null;
      currentAudioEl.onended = null;
      currentAudioEl.onerror = null;
      currentAudioEl.pause();
      currentAudioEl.currentTime = 0;
    } catch {
      // Ignore cleanup errors
    }
    currentAudioEl = null;
  }
  setSnapshot({ activeKey: null, status: 'idle', error: null });
}

export function pauseVoiceClip(): void {
  if (currentAudioEl && !currentAudioEl.paused) {
    currentAudioEl.pause();
    setSnapshot({ status: 'paused' });
  }
}

export async function resumeVoiceClip(): Promise<void> {
  if (currentAudioEl && currentAudioEl.paused) {
    try {
      currentAudioEl.volume = currentVolume;
      await currentAudioEl.play();
      setSnapshot({ status: 'playing', error: null });
    } catch {
      setSnapshot({
        status: 'paused',
        error: 'اضغطي على تشغيل للاستماع إلى الصوت.',
      });
    }
  }
}

export async function playVoiceClip(params: {
  key: string;
  text: string;
  tone?: VoiceTone;
  volume?: number;
}): Promise<boolean> {
  const { key, text, tone = 'narrate', volume } = params;
  if (typeof volume === 'number') {
    currentVolume = Math.max(0, Math.min(1, volume));
  }

  // Stop any previous audio or in-flight request to prevent overlap
  stopSpeaking();
  const myToken = ++playbackToken;
  const controller = new AbortController();
  currentAbortController = controller;

  setSnapshot({ activeKey: key, status: 'loading', error: null });

  try {
    const objectUrl = await fetchOrGetCachedAudioUrl(
      text,
      tone,
      controller.signal
    );

    if (myToken !== playbackToken) {
      return false;
    }

    const audio = new Audio(objectUrl);
    audio.preload = 'auto';
    audio.volume = currentVolume;
    currentAudioEl = audio;

    audio.onended = () => {
      if (myToken !== playbackToken) return;
      currentAudioEl = null;
      setSnapshot({ activeKey: null, status: 'idle', error: null });
    };

    audio.onerror = () => {
      if (myToken !== playbackToken) return;
      currentAudioEl = null;
      setSnapshot({
        activeKey: key,
        status: 'idle',
        error: 'تعذر تشغيل المقطع الصوتي على هذا الجهاز.',
      });
    };

    try {
      await audio.play();
      if (myToken !== playbackToken) {
        audio.pause();
        return false;
      }
      setSnapshot({ activeKey: key, status: 'playing', error: null });
      return true;
    } catch {
      // Browser autoplay restriction (e.g. mobile Safari/Chrome before direct tap)
      if (myToken !== playbackToken) return false;
      setSnapshot({
        activeKey: key,
        status: 'paused',
        error: 'جاهز للاستماع — اضغطي على زر التشغيل.',
      });
      return false;
    }
  } catch (err) {
    if (myToken !== playbackToken) return false;
    if (err instanceof DOMException && err.name === 'AbortError') {
      return false;
    }
    const msg =
      err instanceof Error ? err.message : 'تعذر تحميل التعليق الصوتي الواقعي.';
    setSnapshot({ activeKey: key, status: 'idle', error: msg });
    return false;
  } finally {
    if (currentAbortController === controller) {
      currentAbortController = null;
    }
  }
}

export async function prefetchVoiceClip(
  text: string,
  tone: VoiceTone = 'narrate'
): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) return;
  const cacheKey = `${tone}:${cleanText}`;
  if (audioUrlCache.has(cacheKey) || inFlightFetches.has(cacheKey)) return;
  try {
    await fetchOrGetCachedAudioUrl(cleanText, tone);
  } catch {
    // Silent prefetch failure
  }
}

// Gentle Web Audio UI sound effects for track steps & game actions
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTone(
  frequency: number,
  durationMs: number,
  type: OscillatorType = 'sine',
  volume = 0.08,
  muted = false
): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + durationMs / 1000
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
  } catch {
    // Ignore audio context blocks
  }
}

export function playStepTone(stepIndex: number, muted = false): void {
  const notes = [440, 523.25, 659.25, 783.99];
  const freq = notes[stepIndex % notes.length];
  playTone(freq, 130, 'triangle', 0.09, muted);
}

export function playSuccessTone(muted = false): void {
  if (muted) return;
  playTone(523.25, 110, 'triangle', 0.09, muted);
  setTimeout(() => playTone(659.25, 130, 'triangle', 0.09, muted), 95);
  setTimeout(() => playTone(783.99, 210, 'triangle', 0.1, muted), 190);
}

export function playErrorTone(muted = false): void {
  if (muted) return;
  playTone(260, 140, 'sine', 0.08, muted);
  setTimeout(() => playTone(210, 180, 'sine', 0.08, muted), 120);
}

export function playFanfare(muted = false): void {
  if (muted) return;
  const seq = [523.25, 659.25, 783.99, 1046.5];
  seq.forEach((freq, idx) => {
    setTimeout(() => playTone(freq, 180, 'triangle', 0.09, muted), idx * 110);
  });
}
