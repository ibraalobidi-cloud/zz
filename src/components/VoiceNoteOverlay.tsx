import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Square,
  Trash2,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ASSET_PATHS } from '../data/lessonData';
import { VoicePlaybackStatus, VoiceTone } from '../utils/audio';

export interface VoiceNoteRecord {
  id: string;
  stationId: number;
  stationLabel: string;
  title: string;
  message: string;
  tone: VoiceTone;
  createdAt: string;
}

interface VoiceNoteBannerProps {
  activeNote: VoiceNoteRecord | null;
  status: VoicePlaybackStatus;
  errorText?: string | null;
  canRetry?: boolean;
  voiceVolume: number;
  onChangeVolume: (vol: number) => void;
  onPlayOrResume: (note: VoiceNoteRecord) => void;
  onPause: () => void;
  onReplay: (note: VoiceNoteRecord) => void;
  onStop: () => void;
  onDismiss: () => void;
  onOpenSettings: () => void;
}

export const VoiceNoteBanner: React.FC<VoiceNoteBannerProps> = ({
  activeNote,
  status,
  errorText,
  canRetry = false,
  voiceVolume,
  onChangeVolume,
  onPlayOrResume,
  onPause,
  onReplay,
  onStop,
  onDismiss,
  onOpenSettings,
}) => {
  const borderAccent =
    activeNote?.tone === 'celebrate'
      ? 'border-emerald-300 bg-emerald-50/95'
      : activeNote?.tone === 'coach'
        ? 'border-orange-300 bg-orange-50/95'
        : 'border-sky-300 bg-sky-50/95';

  return (
    <AnimatePresence>
      {activeNote && (
        <motion.div
          key={activeNote.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="no-print fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-40"
          role="region"
          aria-label="ملاحظة صوتية تشجيعية"
        >
          <div
            className={`rounded-2xl border shadow-lg p-4 backdrop-blur space-y-3 ${borderAccent}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={ASSET_PATHS.mentorHero}
                  alt="المرشدة الرياضية"
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-xl object-cover object-top border border-white shrink-0 bg-white"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-600">
                    ملاحظة صوتية · {activeNote.stationLabel}
                  </div>
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {activeNote.title}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onDismiss}
                aria-label="إغلاق الملاحظة الصوتية"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white/80 hover:text-slate-900 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-800 leading-relaxed bg-white/85 rounded-xl p-3 border border-white">
              {activeNote.message}
            </p>

            {errorText && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-orange-800 bg-white/80 rounded-lg px-2.5 py-1.5">
                <span>{errorText}</span>
                {canRetry && (
                  <button
                    type="button"
                    onClick={() => onReplay(activeNote)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-100 text-orange-900 hover:bg-orange-200 font-semibold cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>إعادة المحاولة</span>
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                {status === 'loading' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-sky-700 text-xs font-semibold border border-sky-200">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري تجهيز الصوت...</span>
                  </span>
                ) : status === 'playing' ? (
                  <>
                    <button
                      type="button"
                      onClick={onPause}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 cursor-pointer whitespace-nowrap"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>إيقاف مؤقت</span>
                    </button>
                    <button
                      type="button"
                      onClick={onStop}
                      aria-label="إيقاف"
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-red-700 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </>
                ) : status === 'paused' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onPlayOrResume(activeNote)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 cursor-pointer whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>تشغيل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onReplay(activeNote)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>إعادة</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onReplay(activeNote)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>إعادة الاستماع</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1 bg-white/80 border border-white rounded-lg px-2 py-1">
                  {voiceVolume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  ) : voiceVolume < 0.5 ? (
                    <Volume1 className="w-3.5 h-3.5 text-sky-700" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-sky-700" />
                  )}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={voiceVolume}
                    onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
                    aria-label="مستوى صوت الملاحظة"
                    className="w-14 accent-sky-600 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>الإعدادات</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceNotesEnabled: boolean;
  onToggleVoiceNotes: () => void;
  autoPlayVoiceNotes: boolean;
  onToggleAutoPlay: () => void;
  voiceVolume: number;
  onChangeVolume: (vol: number) => void;
  sfxMuted: boolean;
  onToggleSfx: () => void;
  bgMotionEnabled: boolean;
  onToggleBgMotion: () => void;
  history: VoiceNoteRecord[];
  playingNoteId: string | null;
  loadingNoteId: string | null;
  onPlayHistoryNote: (note: VoiceNoteRecord) => void;
  onStopPlayback: () => void;
  onClearHistory: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  voiceNotesEnabled,
  onToggleVoiceNotes,
  autoPlayVoiceNotes,
  onToggleAutoPlay,
  voiceVolume,
  onChangeVolume,
  sfxMuted,
  onToggleSfx,
  bgMotionEnabled,
  onToggleBgMotion,
  history,
  playingNoteId,
  loadingNoteId,
  onPlayHistoryNote,
  onStopPlayback,
  onClearHistory,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="no-print fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="إعدادات الموقع والملاحظات الصوتية"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-sky-600" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    إعدادات الصوت والملاحظات التشجيعية
                  </h2>
                  <p className="text-xs text-slate-500">
                    التحكم في صوت المرشدة الواقعي ومستوى الصوت وسجل الملاحظات
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق الإعدادات"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              {/* Audio & Encouragement Controls */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  تفضيلات الصوت والتشجيع
                </h3>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-slate-900">
                        الملاحظات الصوتية التشجيعية في اختبارات المحطات
                      </div>
                      <p className="text-xs text-slate-600">
                        إظهار وتشغيل ملاحظات صوتية تشجيعية مخصصة بناءً على أدائكِ بصوت معلمة واقعي.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={voiceNotesEnabled}
                      onClick={onToggleVoiceNotes}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        voiceNotesEnabled
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {voiceNotesEnabled ? 'مفعّلة' : 'متوقفة'}
                    </button>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-slate-900">
                        التشغيل التلقائي عند ظهور الملاحظة
                      </div>
                      <p className="text-xs text-slate-600">
                        بدء الاستماع للصوت مباشرة فور الإجابة أو إتمام التحدي.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoPlayVoiceNotes}
                      disabled={!voiceNotesEnabled}
                      onClick={onToggleAutoPlay}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${
                        autoPlayVoiceNotes && voiceNotesEnabled
                          ? 'bg-sky-600 text-white hover:bg-sky-700'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {autoPlayVoiceNotes ? 'تلقائي' : 'يدوي'}
                    </button>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-slate-900">
                        مستوى صوت المرشدة والتعليقات
                      </div>
                      <p className="text-xs text-slate-600">
                        ضبط ارتفاع صوت الشرح والأسئلة والتغذية الراجعة.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={voiceVolume}
                        onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
                        aria-label="مستوى صوت المرشدة"
                        className="w-24 sm:w-28 accent-sky-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-800 tabular-nums w-9 text-left">
                        {Math.round(voiceVolume * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-slate-900">
                        المؤثرات الصوتية للمضمار والألعاب
                      </div>
                      <p className="text-xs text-slate-600">
                        نغمات الخطوات والإجابات الصحيحة أثناء التمارين التفاعلية.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!sfxMuted}
                      onClick={onToggleSfx}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        !sfxMuted
                          ? 'bg-sky-600 text-white hover:bg-sky-700'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {!sfxMuted ? 'مفعّلة' : 'صامتة'}
                    </button>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-slate-900">
                        حركة الخلفية التفاعلية ثلاثية الأبعاد
                      </div>
                      <p className="text-xs text-slate-600">
                        حركة السحب الهادئة والعمق الحركي والجسيمات الضوئية في خلفية الملعب.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={bgMotionEnabled}
                      onClick={onToggleBgMotion}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        bgMotionEnabled
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {bgMotionEnabled ? 'مفعّلة' : 'متوقفة'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Recorded Voice Notes History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-sky-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      سجل الملاحظات الصوتية التشجيعية ({history.length})
                    </h3>
                  </div>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearHistory}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>مسح السجل</span>
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center text-xs sm:text-sm text-slate-500">
                    لم تُسجّل ملاحظات صوتية بعد. أجيبي عن الأسئلة أو أكملي أي تحدٍ في المحطات لتظهر ملاحظة المرشدة التشجيعية هنا.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {history.map((item) => {
                      const isPlaying = playingNoteId === item.id;
                      const isLoading = loadingNoteId === item.id;

                      return (
                        <div
                          key={item.id}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="text-xs text-slate-500">
                              <span className="font-semibold text-sky-700">
                                {item.stationLabel}
                              </span>
                              <span aria-hidden="true"> · </span>
                              <span>{item.title}</span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                              {item.message}
                            </p>
                          </div>

                          <div className="shrink-0">
                            {isLoading ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-sky-700">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>جاري التحميل</span>
                              </span>
                            ) : isPlaying ? (
                              <button
                                type="button"
                                onClick={onStopPlayback}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 cursor-pointer whitespace-nowrap"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>إيقاف</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onPlayHistoryNote(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-sky-50 hover:border-sky-300 cursor-pointer whitespace-nowrap"
                              >
                                <Volume2 className="w-3.5 h-3.5 text-sky-600" />
                                <span>تشغيل</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
