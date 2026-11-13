import React, { useEffect, useState } from 'react';
import {
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ASSET_PATHS } from '../data/lessonData';
import {
  pauseVoiceClip,
  playVoiceClip,
  prefetchVoiceClip,
  resumeVoiceClip,
  stopSpeaking,
  subscribeVoiceState,
  VoicePlaybackSnapshot,
} from '../utils/audio';

interface MentorBarProps {
  stationNumber: number;
  sectionLabel: string;
  script: string;
  studentName?: string;
  voiceVolume: number;
  onChangeVolume: (vol: number) => void;
}

export const MentorBar: React.FC<MentorBarProps> = ({
  stationNumber,
  sectionLabel,
  script,
  studentName,
  voiceVolume,
  onChangeVolume,
}) => {
  const [voiceSnap, setVoiceSnap] = useState<VoicePlaybackSnapshot>({
    activeKey: null,
    status: 'idle',
    error: null,
  });
  const [imgFailed, setImgFailed] = useState(false);

  const mentorKey = `mentor-station-${stationNumber}`;
  const isMine = voiceSnap.activeKey === mentorKey;
  const myStatus = isMine ? voiceSnap.status : 'idle';
  const myError = isMine ? voiceSnap.error : null;

  const personalizedScript = studentName?.trim()
    ? `${script} هيا يا ${studentName.trim()}!`
    : script;

  useEffect(() => {
    const unsub = subscribeVoiceState(setVoiceSnap);
    return unsub;
  }, []);

  // Stop previous scene audio automatically on station change & prefetch current script
  useEffect(() => {
    stopSpeaking();
    const timer = window.setTimeout(() => {
      void prefetchVoiceClip(personalizedScript, 'narrate');
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [stationNumber, personalizedScript]);

  const handlePrimaryPlayPause = () => {
    if (myStatus === 'loading') return;
    if (myStatus === 'playing') {
      pauseVoiceClip();
    } else if (myStatus === 'paused') {
      void resumeVoiceClip();
    } else {
      void playVoiceClip({
        key: mentorKey,
        text: personalizedScript,
        tone: 'narrate',
        volume: voiceVolume,
      });
    }
  };

  const handleReplay = () => {
    void playVoiceClip({
      key: mentorKey,
      text: personalizedScript,
      tone: 'narrate',
      volume: voiceVolume,
    });
  };

  const handleStop = () => {
    stopSpeaking();
  };

  return (
    <div className="glass-surface rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
      <div className="flex items-start sm:items-center gap-4 min-w-0">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-sky-50 border border-sky-200 shrink-0 flex items-center justify-center">
          {!imgFailed ? (
            <img
              src={ASSET_PATHS.mentorHero}
              alt="المرشدة الرياضية"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <span className="text-sky-700 font-display font-bold text-lg">م</span>
          )}
        </div>

        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-sky-700">المعلمة: عزيزة العنزي</span>
            <span aria-hidden="true">·</span>
            <span>{sectionLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">محطة {stationNumber} من 15</span>
          </div>
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed">
            {script}
          </p>
          {myError && (
            <p className="text-xs text-orange-700 pt-0.5">{myError}</p>
          )}
        </div>
      </div>

      {/* Unified Audio Controls: Play/Pause, Replay, Stop, Volume */}
      <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-start lg:justify-end">
        <button
          type="button"
          onClick={handlePrimaryPlayPause}
          disabled={myStatus === 'loading'}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
            myStatus === 'playing'
              ? 'bg-orange-600 text-white hover:bg-orange-700'
              : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
          }`}
        >
          {myStatus === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري التحميل...</span>
            </>
          ) : myStatus === 'playing' ? (
            <>
              <Pause className="w-4 h-4" />
              <span>إيقاف مؤقت</span>
            </>
          ) : myStatus === 'paused' ? (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>استكمال الشرح</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>استماع للشرح</span>
            </>
          )}
        </button>

        {(myStatus === 'playing' || myStatus === 'paused') && (
          <>
            <button
              type="button"
              onClick={handleReplay}
              title="إعادة الاستماع من البداية"
              aria-label="إعادة الاستماع من البداية"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة</span>
            </button>

            <button
              type="button"
              onClick={handleStop}
              title="إيقاف الصوت"
              aria-label="إيقاف الصوت"
              className="inline-flex items-center justify-center p-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          </>
        )}

        {/* Volume Slider */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50/70"
          title="مستوى الصوت"
        >
          {voiceVolume === 0 ? (
            <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
          ) : voiceVolume < 0.5 ? (
            <Volume1 className="w-4 h-4 text-sky-700 shrink-0" />
          ) : (
            <Volume2 className="w-4 h-4 text-sky-700 shrink-0" />
          )}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={voiceVolume}
            onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
            aria-label="التحكم في مستوى الصوت"
            className="w-16 sm:w-20 accent-sky-600 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
