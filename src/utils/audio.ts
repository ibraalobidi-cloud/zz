// Unified Gemini Realistic Female Voice Audio Engine + Browser Arabic Fallback + Track SFX
// Primary voice: Server-side Gemini TTS (/api/tts) compatible with Vercel Serverless & Express
// Mobile Safari / Autoplay resilience: Synchronously unlocks AudioContext on tap and uses
// Web Audio API WAV decoding if HTMLAudioElement.play() is blocked after async fetch.
// Fallback voice: Browser Arabic SpeechSynthesis used ONLY when Gemini TTS cannot be reached/fails.

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
  usingFallback: boolean;
  canRetry: boolean;
}

type VoiceListener = (snapshot: VoicePlaybackSnapshot) => void;

const TTS_ENDPOINT = '/api/tts';
const CLIENT_TIMEOUT_MS = 24000;
const PERSISTENT_CACHE_NAME = 'triple-jump-tts-cache-v1';
const MAX_CLIENT_CACHE = 80;

const listeners = new Set<VoiceListener>();
let snapshot: VoicePlaybackSnapshot = {
  activeKey: null,
  status: 'idle',
  error: null,
  usingFallback: false,
  canRetry: false,
};

let currentAudioEl: HTMLAudioElement | null = null;
let currentWebAudioSource: AudioBufferSourceNode | null = null;
let currentWebAudioGain: GainNode | null = null;
let currentAbortController: AbortController | null = null;
let currentVolume = 0.9;
let playbackToken = 0;
let activeMode: 'none' | 'gemini' | 'webaudio' | 'fallback' = 'none';
let lastPlayParams: {
  key: string;
  text: string;
  tone: VoiceTone;
  volume?: number;
} | null = null;

// Bounded client-side Blob + ObjectURL cache + in-flight request deduplication
const audioBlobCache = new Map<string, Blob>();
const audioUrlCache = new Map<string, string>();
const inFlightFetches = new Map<string, Promise<{ url: string; blob: Blob }>>();

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
  if (currentWebAudioGain && audioCtx) {
    try {
      currentWebAudioGain.gain.setValueAtTime(clamped, audioCtx.currentTime);
    } catch {
      // Ignore gain update errors
    }
  }
}

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

function base64ToWavBlob(base64: string, mimeType = 'audio/wav'): Blob {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function setBoundedMemoryCache(cacheKey: string, blob: Blob, objectUrl: string): void {
  if (audioUrlCache.size >= MAX_CLIENT_CACHE) {
    const oldestKey = audioUrlCache.keys().next().value;
    if (oldestKey) {
      const oldUrl = audioUrlCache.get(oldestKey);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      audioUrlCache.delete(oldestKey);
      audioBlobCache.delete(oldestKey);
    }
  }
  audioBlobCache.set(cacheKey, blob);
  audioUrlCache.set(cacheKey, objectUrl);
}

function buildCacheStorageRequestUrl(cacheKey: string): string {
  return `https://tts-cache.local/clip?key=${encodeURIComponent(cacheKey)}`;
}

async function readPersistentCache(
  cacheKey: string
): Promise<{ url: string; blob: Blob } | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await window.caches.open(PERSISTENT_CACHE_NAME);
    const match = await cache.match(buildCacheStorageRequestUrl(cacheKey));
    if (!match) return null;
    const blob = await match.blob();
    if (blob.size === 0) return null;
    const url = URL.createObjectURL(blob);
    setBoundedMemoryCache(cacheKey, blob, url);
    return { url, blob };
  } catch {
    return null;
  }
}

async function writePersistentCache(cacheKey: string, blob: Blob): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await window.caches.open(PERSISTENT_CACHE_NAME);
    await cache.put(
      buildCacheStorageRequestUrl(cacheKey),
      new Response(blob, {
        headers: { 'Content-Type': blob.type || 'audio/wav' },
      })
    );
  } catch {
    // Ignore storage quota / private mode failures
  }
}

class TtsFetchError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, status = 500, code = 'TTS_ERROR', retryable = true) {
    super(message);
    this.name = 'TtsFetchError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function requestTtsFromServer(
  cleanText: string,
  tone: VoiceTone,
  externalSignal?: AbortSignal
): Promise<Blob> {
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), CLIENT_TIMEOUT_MS);

  const onExternalAbort = () => timeoutController.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const resp = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, tone }),
      signal: timeoutController.signal,
    });

    const contentType = resp.headers.get('content-type') || '';

    if (!resp.ok) {
      let errMessage = 'تعذر تحميل الصوت الواقعي.';
      let errCode = `HTTP_${resp.status}`;

      if (contentType.includes('application/json')) {
        const errData = (await resp.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (errData.error) errMessage = errData.error;
        if (errData.code) errCode = errData.code;
      }

      const retryable = resp.status >= 500 || resp.status === 408;
      throw new TtsFetchError(errMessage, resp.status, errCode, retryable);
    }

    if (!contentType.includes('application/json')) {
      throw new TtsFetchError(
        'استجابة غير متوقعة من خدمة الصوت على الخادم.',
        502,
        'INVALID_RESPONSE',
        false
      );
    }

    const data = (await resp.json()) as {
      audioBase64?: string;
      mimeType?: string;
    };

    if (!data.audioBase64) {
      throw new TtsFetchError(
        'لم يتم استلام ملف الصوت من الخادم.',
        502,
        'EMPTY_AUDIO',
        true
      );
    }

    return base64ToWavBlob(data.audioBase64, data.mimeType || 'audio/wav');
  } catch (err) {
    if (externalSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TtsFetchError(
        'انتهت مهلة تحميل الصوت الواقعي.',
        504,
        'CLIENT_TIMEOUT',
        true
      );
    }
    if (err instanceof TtsFetchError) {
      throw err;
    }
    throw new TtsFetchError(
      'تعذر الاتصال بخدمة الصوت الواقعي.',
      0,
      'NETWORK_ERROR',
      true
    );
  } finally {
    window.clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

async function fetchOrGetCachedAudio(
  text: string,
  tone: VoiceTone,
  signal?: AbortSignal
): Promise<{ url: string; blob: Blob }> {
  const cleanText = text.trim();
  const cacheKey = `${tone}:${cleanText}`;

  const memUrl = audioUrlCache.get(cacheKey);
  const memBlob = audioBlobCache.get(cacheKey);
  if (memUrl && memBlob) return { url: memUrl, blob: memBlob };

  const diskCached = await readPersistentCache(cacheKey);
  if (diskCached) return diskCached;

  const existingPromise = inFlightFetches.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const fetchPromise = (async () => {
    let lastError: unknown;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const blob = await requestTtsFromServer(cleanText, tone, signal);
        void writePersistentCache(cacheKey, blob);
        const url = URL.createObjectURL(blob);
        setBoundedMemoryCache(cacheKey, blob, url);
        return { url, blob };
      } catch (err) {
        lastError = err;
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw err;
        }
        const retryable = err instanceof TtsFetchError ? err.retryable : true;
        if (!retryable || attempt >= maxAttempts) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 550));
      }
    }

    throw lastError;
  })();

  inFlightFetches.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightFetches.delete(cacheKey);
  }
}

async function playWavBlobViaWebAudio(
  blob: Blob,
  key: string,
  myToken: number
): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const arrayBuffer = await blob.arrayBuffer();
    if (myToken !== playbackToken) return false;
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    if (myToken !== playbackToken) return false;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = decoded;
    gain.gain.setValueAtTime(currentVolume, ctx.currentTime);
    source.connect(gain);
    gain.connect(ctx.destination);

    currentWebAudioSource = source;
    currentWebAudioGain = gain;
    activeMode = 'webaudio';

    source.onended = () => {
      if (myToken !== playbackToken) return;
      currentWebAudioSource = null;
      currentWebAudioGain = null;
      activeMode = 'none';
      setSnapshot({
        activeKey: null,
        status: 'idle',
        error: null,
        usingFallback: false,
        canRetry: false,
      });
    };

    source.start(0);
    setSnapshot({
      activeKey: key,
      status: 'playing',
      error: null,
      usingFallback: false,
      canRetry: false,
    });
    return true;
  } catch {
    return false;
  }
}

// Browser Arabic SpeechSynthesis — ONLY used as an emergency fallback if server Gemini TTS fails
function pickArabicFallbackVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const femaleHints = ['salma', 'zariyah', 'laila', 'amina', 'hoda', 'rana', 'female', 'woman'];
  const arabicVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith('ar')
  );
  if (!arabicVoices.length) return null;

  const saudiFemale = arabicVoices.find(
    (v) =>
      v.lang.toLowerCase().includes('sa') &&
      femaleHints.some((h) => v.name.toLowerCase().includes(h))
  );
  if (saudiFemale) return saudiFemale;

  const saudiAny = arabicVoices.find((v) => v.lang.toLowerCase().includes('sa'));
  if (saudiAny) return saudiAny;

  const femaleAny = arabicVoices.find((v) =>
    femaleHints.some((h) => v.name.toLowerCase().includes(h))
  );
  return femaleAny ?? arabicVoices[0];
}

function tryPlayBrowserArabicFallback(params: {
  key: string;
  text: string;
  myToken: number;
  reasonMessage: string;
}): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(params.text);
    const voice = pickArabicFallbackVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'ar-SA';
    }

    utterance.rate = 0.96;
    utterance.pitch = 1.05;
    utterance.volume = currentVolume;

    utterance.onstart = () => {
      if (params.myToken !== playbackToken) return;
      activeMode = 'fallback';
      setSnapshot({
        activeKey: params.key,
        status: 'playing',
        usingFallback: true,
        canRetry: true,
        error: `${params.reasonMessage} (تم تفعيل الصوت الاحتياطي مؤقتاً)`,
      });
    };

    utterance.onend = () => {
      if (params.myToken !== playbackToken) return;
      activeMode = 'none';
      setSnapshot({
        activeKey: null,
        status: 'idle',
        usingFallback: false,
        canRetry: false,
        error: null,
      });
    };

    utterance.onerror = () => {
      if (params.myToken !== playbackToken) return;
      activeMode = 'none';
      setSnapshot({
        activeKey: params.key,
        status: 'idle',
        usingFallback: false,
        canRetry: true,
        error: params.reasonMessage,
      });
    };

    activeMode = 'fallback';
    setSnapshot({
      activeKey: params.key,
      status: 'playing',
      usingFallback: true,
      canRetry: true,
      error: `${params.reasonMessage} (تم تفعيل الصوت الاحتياطي مؤقتاً)`,
    });
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  playbackToken += 1;
  activeMode = 'none';
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
  if (currentWebAudioSource) {
    try {
      currentWebAudioSource.onended = null;
      currentWebAudioSource.stop();
      currentWebAudioSource.disconnect();
    } catch {
      // Ignore cleanup errors
    }
    currentWebAudioSource = null;
  }
  if (currentWebAudioGain) {
    try {
      currentWebAudioGain.disconnect();
    } catch {
      // Ignore
    }
    currentWebAudioGain = null;
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore cleanup errors
    }
  }
  setSnapshot({
    activeKey: null,
    status: 'idle',
    error: null,
    usingFallback: false,
    canRetry: false,
  });
}

export function pauseVoiceClip(): void {
  if (
    activeMode === 'fallback' &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window
  ) {
    try {
      window.speechSynthesis.pause();
      setSnapshot({ status: 'paused' });
    } catch {
      // Ignore
    }
    return;
  }

  if (activeMode === 'webaudio' && audioCtx && audioCtx.state === 'running') {
    audioCtx
      .suspend()
      .then(() => setSnapshot({ status: 'paused' }))
      .catch(() => {});
    return;
  }

  if (currentAudioEl && !currentAudioEl.paused) {
    currentAudioEl.pause();
    setSnapshot({ status: 'paused' });
  }
}

export async function resumeVoiceClip(): Promise<void> {
  if (
    activeMode === 'fallback' &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window
  ) {
    try {
      window.speechSynthesis.resume();
      setSnapshot({ status: 'playing' });
    } catch {
      // Ignore
    }
    return;
  }

  if (activeMode === 'webaudio' && audioCtx && audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
      setSnapshot({ status: 'playing', error: null });
    } catch {
      // Ignore
    }
    return;
  }

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

export async function retryLastVoiceClip(): Promise<boolean> {
  if (!lastPlayParams) return false;
  return playVoiceClip(lastPlayParams);
}

export async function playVoiceClip(params: {
  key: string;
  text: string;
  tone?: VoiceTone;
  volume?: number;
}): Promise<boolean> {
  const { key, text, tone = 'narrate', volume } = params;
  lastPlayParams = { key, text, tone, volume };

  if (typeof volume === 'number') {
    currentVolume = Math.max(0, Math.min(1, volume));
  }

  // Synchronously unlock AudioContext inside user gesture before any await
  getAudioContext();

  // Stop any previous audio, fallback speech, or in-flight request to prevent overlap
  stopSpeaking();
  const myToken = ++playbackToken;
  const controller = new AbortController();
  currentAbortController = controller;

  setSnapshot({
    activeKey: key,
    status: 'loading',
    error: null,
    usingFallback: false,
    canRetry: false,
  });

  try {
    const { url: objectUrl, blob } = await fetchOrGetCachedAudio(
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
    activeMode = 'gemini';

    audio.onended = () => {
      if (myToken !== playbackToken) return;
      currentAudioEl = null;
      activeMode = 'none';
      setSnapshot({
        activeKey: null,
        status: 'idle',
        error: null,
        usingFallback: false,
        canRetry: false,
      });
    };

    audio.onerror = () => {
      if (myToken !== playbackToken) return;
      currentAudioEl = null;
      activeMode = 'none';
      setSnapshot({
        activeKey: key,
        status: 'idle',
        usingFallback: false,
        canRetry: true,
        error: 'تعذر تشغيل المقطع الصوتي على هذا الجهاز.',
      });
    };

    try {
      await audio.play();
      if (myToken !== playbackToken) {
        audio.pause();
        return false;
      }
      setSnapshot({
        activeKey: key,
        status: 'playing',
        error: null,
        usingFallback: false,
        canRetry: false,
      });
      return true;
    } catch {
      // If HTMLAudioElement.play() was blocked (e.g. mobile Safari after async fetch),
      // play the same realistic Gemini WAV via pre-unlocked Web Audio API.
      currentAudioEl = null;
      const webAudioOk = await playWavBlobViaWebAudio(blob, key, myToken);
      if (webAudioOk) {
        return true;
      }

      if (myToken !== playbackToken) return false;
      setSnapshot({
        activeKey: key,
        status: 'paused',
        usingFallback: false,
        canRetry: true,
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
      err instanceof Error ? err.message : 'تعذر تحميل الصوت الواقعي.';

    // Fallback ONLY when Gemini TTS server generation failed
    const fallbackStarted = tryPlayBrowserArabicFallback({
      key,
      text,
      myToken,
      reasonMessage: msg,
    });

    if (fallbackStarted) {
      return true;
    }

    activeMode = 'none';
    setSnapshot({
      activeKey: key,
      status: 'idle',
      usingFallback: false,
      canRetry: true,
      error: msg,
    });
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
    await fetchOrGetCachedAudio(cleanText, tone);
  } catch {
    // Silent prefetch failure
  }
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
