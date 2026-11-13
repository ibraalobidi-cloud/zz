import React, { useEffect, useState } from 'react';
import { Loader2, Pause, Play, Volume2 } from 'lucide-react';
import {
  pauseVoiceClip,
  playVoiceClip,
  resumeVoiceClip,
  subscribeVoiceState,
  VoicePlaybackSnapshot,
  VoiceTone,
} from '../utils/audio';

interface VoiceReadButtonProps {
  clipKey: string;
  text: string;
  tone?: VoiceTone;
  volume?: number;
  label?: string;
}

export const VoiceReadButton: React.FC<VoiceReadButtonProps> = ({
  clipKey,
  text,
  tone = 'question',
  volume,
  label = 'استماع',
}) => {
  const [snap, setSnap] = useState<VoicePlaybackSnapshot>({
    activeKey: null,
    status: 'idle',
    error: null,
    usingFallback: false,
    canRetry: false,
  });

  useEffect(() => {
    return subscribeVoiceState(setSnap);
  }, []);

  const isMine = snap.activeKey === clipKey;
  const status = isMine ? snap.status : 'idle';
  const showRetryLabel = isMine && status === 'idle' && snap.canRetry;

  const handleClick = () => {
    if (status === 'loading') return;
    if (status === 'playing') {
      pauseVoiceClip();
    } else if (status === 'paused') {
      void resumeVoiceClip();
    } else {
      void playVoiceClip({
        key: clipKey,
        text,
        tone,
        volume,
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === 'loading'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 ${
        status === 'playing'
          ? 'bg-orange-600 border-orange-600 text-white hover:bg-orange-700'
          : 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'
      }`}
    >
      {status === 'loading' ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>جاري التحميل</span>
        </>
      ) : status === 'playing' ? (
        <>
          <Pause className="w-3.5 h-3.5" />
          <span>إيقاف مؤقت</span>
        </>
      ) : status === 'paused' ? (
        <>
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>استكمال</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5" />
          <span>{showRetryLabel ? 'إعادة المحاولة' : label}</span>
        </>
      )}
    </button>
  );
};
