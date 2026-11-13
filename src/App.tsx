import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Map,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  QUIZ_QUESTIONS,
  SAFETY_ITEMS,
  STATIONS,
} from './data/lessonData';
import { MentorBar } from './components/MentorBar';
import {
  ConceptStation,
  GoalsStation,
  PhaseStation,
  WelcomeStation,
} from './components/LessonStations';
import { FootMapGame } from './components/FootMapGame';
import { ErrorsLab, RulesChallenge } from './components/RulesAndErrorsLab';
import {
  InteractiveQuiz,
  SafetyChecklist,
  SelfAssessment,
} from './components/SafetyAndAssessment';
import { CertificateView } from './components/CertificateView';
import {
  SettingsModal,
  VoiceNoteBanner,
  VoiceNoteRecord,
} from './components/VoiceNoteOverlay';
import { StageBackdrop } from './components/StageBackdrop';
import {
  pauseVoiceClip,
  playStepTone,
  playVoiceClip,
  resumeVoiceClip,
  setGlobalVoiceVolume,
  stopSpeaking,
  subscribeVoiceState,
  VoicePlaybackSnapshot,
  VoiceTone,
} from './utils/audio';

interface StoredProgress {
  currentStation: number;
  completedStations: number[];
  studentName: string;
  footMapScore: number;
  safetyCheckedIds: string[];
  quizAnswers: Record<number, number>;
  selfRatings: Record<string, 1 | 2 | 3>;
  muted: boolean;
  voiceVolume: number;
  voiceNotesEnabled: boolean;
  autoPlayVoiceNotes: boolean;
  bgMotionEnabled: boolean;
  voiceNotesHistory: VoiceNoteRecord[];
}

const STORAGE_KEY = 'triple_jump_champions_progress_v1';

const DEFAULT_PROGRESS: StoredProgress = {
  currentStation: 1,
  completedStations: [1],
  studentName: '',
  footMapScore: 0,
  safetyCheckedIds: [],
  quizAnswers: {},
  selfRatings: {},
  muted: false,
  voiceVolume: 0.9,
  voiceNotesEnabled: true,
  autoPlayVoiceNotes: true,
  bgMotionEnabled: true,
  voiceNotesHistory: [],
};

function loadProgress(): StoredProgress {
  if (typeof window === 'undefined') return DEFAULT_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      currentStation:
        typeof parsed.currentStation === 'number' &&
        parsed.currentStation >= 1 &&
        parsed.currentStation <= 15
          ? parsed.currentStation
          : 1,
      completedStations: Array.isArray(parsed.completedStations)
        ? parsed.completedStations
        : [1],
      safetyCheckedIds: Array.isArray(parsed.safetyCheckedIds)
        ? parsed.safetyCheckedIds
        : [],
      voiceVolume:
        typeof parsed.voiceVolume === 'number' &&
        parsed.voiceVolume >= 0 &&
        parsed.voiceVolume <= 1
          ? parsed.voiceVolume
          : 0.9,
      voiceNotesEnabled:
        typeof parsed.voiceNotesEnabled === 'boolean'
          ? parsed.voiceNotesEnabled
          : true,
      autoPlayVoiceNotes:
        typeof parsed.autoPlayVoiceNotes === 'boolean'
          ? parsed.autoPlayVoiceNotes
          : true,
      bgMotionEnabled:
        typeof parsed.bgMotionEnabled === 'boolean'
          ? parsed.bgMotionEnabled
          : true,
      voiceNotesHistory: Array.isArray(parsed.voiceNotesHistory)
        ? parsed.voiceNotesHistory
        : [],
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export default function App() {
  const [progress, setProgress] = useState<StoredProgress>(loadProgress);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [activeVoiceNote, setActiveVoiceNote] =
    useState<VoiceNoteRecord | null>(null);
  const [voiceSnap, setVoiceSnap] = useState<VoicePlaybackSnapshot>({
    activeKey: null,
    status: 'idle',
    error: null,
    usingFallback: false,
    canRetry: false,
  });

  useEffect(() => {
    const unsub = subscribeVoiceState(setVoiceSnap);
    return unsub;
  }, []);

  useEffect(() => {
    setGlobalVoiceVolume(progress.voiceVolume);
  }, [progress.voiceVolume]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore storage quota errors
    }
  }, [progress]);

  const currentStationMeta = useMemo(
    () => STATIONS.find((s) => s.id === progress.currentStation) ?? STATIONS[0],
    [progress.currentStation]
  );

  const quizCorrectCount = useMemo(
    () =>
      QUIZ_QUESTIONS.filter((q) => progress.quizAnswers[q.id] === q.correctIndex)
        .length,
    [progress.quizAnswers]
  );

  const quizScorePercent = Math.round(
    (quizCorrectCount / QUIZ_QUESTIONS.length) * 100
  );

  const heroName = progress.studentName.trim()
    ? `يا ${progress.studentName.trim()}`
    : 'يا بطلة';

  const playNoteAudio = async (note: VoiceNoteRecord) => {
    await playVoiceClip({
      key: note.id,
      text: note.message,
      tone: note.tone,
      volume: progress.voiceVolume,
    });
  };

  const stopNoteAudio = () => {
    stopSpeaking();
  };

  const handleChangeVoiceVolume = (vol: number) => {
    setGlobalVoiceVolume(vol);
    setProgress((prev) => ({ ...prev, voiceVolume: vol }));
  };

  const triggerVoiceNote = (params: {
    stationId: number;
    stationLabel: string;
    title: string;
    message: string;
    tone: VoiceTone;
  }) => {
    if (!progress.voiceNotesEnabled) return;

    const newRecord: VoiceNoteRecord = {
      id: `${params.stationId}-${Date.now()}`,
      stationId: params.stationId,
      stationLabel: params.stationLabel,
      title: params.title,
      message: params.message,
      tone: params.tone,
      createdAt: new Date().toISOString(),
    };

    setProgress((prev) => ({
      ...prev,
      voiceNotesHistory: [newRecord, ...prev.voiceNotesHistory].slice(0, 20),
    }));
    setActiveVoiceNote(newRecord);

    if (progress.autoPlayVoiceNotes) {
      void playNoteAudio(newRecord);
    }
  };

  const markStationVisited = (stationId: number) => {
    setProgress((prev) => {
      const completed = prev.completedStations.includes(stationId)
        ? prev.completedStations
        : [...prev.completedStations, stationId];
      return {
        ...prev,
        currentStation: stationId,
        completedStations: completed,
      };
    });
  };

  const goToStation = (stationId: number) => {
    const clamped = Math.max(1, Math.min(15, stationId));
    stopNoteAudio();
    playStepTone(clamped, progress.muted);
    markStationVisited(clamped);
    setIsMapOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSafety = (id: string) => {
    setProgress((prev) => {
      const exists = prev.safetyCheckedIds.includes(id);
      const nextIds = exists
        ? prev.safetyCheckedIds.filter((x) => x !== id)
        : [...prev.safetyCheckedIds, id];
      return { ...prev, safetyCheckedIds: nextIds };
    });
  };

  const handleSelectQuizAnswer = (qId: number, optIdx: number) => {
    setProgress((prev) => ({
      ...prev,
      quizAnswers: { ...prev.quizAnswers, [qId]: optIdx },
    }));
  };

  const handleResetQuiz = () => {
    setProgress((prev) => ({ ...prev, quizAnswers: {} }));
  };

  const handleRateSelf = (id: string, level: 1 | 2 | 3) => {
    setProgress((prev) => ({
      ...prev,
      selfRatings: { ...prev.selfRatings, [id]: level },
    }));
  };

  const completionPercent = Math.round(
    (progress.completedStations.length / STATIONS.length) * 100
  );

  const renderStationContent = () => {
    const id = progress.currentStation;
    if (id === 1) {
      return (
        <WelcomeStation
          studentName={progress.studentName}
          onChangeName={(name) =>
            setProgress((prev) => ({ ...prev, studentName: name }))
          }
          onStartJourney={() => goToStation(2)}
          completedCount={progress.completedStations.length}
        />
      );
    }
    if (id === 2) {
      return <ConceptStation muted={progress.muted} />;
    }
    if (id === 3) {
      return (
        <GoalsStation
          muted={progress.muted}
          voiceVolume={progress.voiceVolume}
          onGoalCheckComplete={(correctCount, totalCount) => {
            if (correctCount === totalCount) {
              triggerVoiceNote({
                stationId: 3,
                stationLabel: 'أهداف الدرس',
                title: 'إتقان أهداف العقل والجسم والقلب',
                message: `رائع ${heroName}! أجبتِ عن جميع نقاط التحقق الثلاث بدقة، وهذا يثبت أن عقلكِ وجسمكِ وقلبكِ مستعدون لتحدي الوثب الثلاثي.`,
                tone: 'celebrate',
              });
            } else {
              triggerVoiceNote({
                stationId: 3,
                stationLabel: 'أهداف الدرس',
                title: 'تشجيع على مراجعة الأهداف',
                message: `بداية طيبة ${heroName}! حصلتِ على ${correctCount} من ${totalCount} في تحقق الأهداف. أعيدي قراءة النقطة المتبقية لتنطلقي بثقة كاملة.`,
                tone: 'coach',
              });
            }
          }}
        />
      );
    }
    if (id >= 4 && id <= 8) {
      return (
        <PhaseStation
          stationId={id}
          muted={progress.muted}
          onCompleteSim={() => {
            markStationVisited(id);
            if (id === 8) {
              triggerVoiceNote({
                stationId: 8,
                stationLabel: 'مختبر الإيقاع الكامل',
                title: 'إتمام محاكاة الإيقاع الحركي',
                message: `ممتاز ${heroName}! شاهدتِ الربط الانسيابي بين الاقتراب والحجلة والخطوة والقفز والهبوط. أنتِ الآن جاهزة للعبة خريطة الأقدام.`,
                tone: 'encourage',
              });
            }
          }}
        />
      );
    }
    if (id === 9) {
      return (
        <FootMapGame
          muted={progress.muted}
          savedScore={progress.footMapScore}
          onSaveScore={(score) =>
            setProgress((prev) => ({ ...prev, footMapScore: score }))
          }
          onChallengeFeedback={({ challengeNumber, mistakes }) => {
            if (mistakes === 0) {
              triggerVoiceNote({
                stationId: 9,
                stationLabel: 'خريطة الأقدام',
                title: `أداء متقن في التحدي ${challengeNumber}`,
                message: `مدهش ${heroName}! أكملتِ خريطة الأقدام في التحدي رقم ${challengeNumber} دون أي خطأ! إيقاعكِ في الحجلة والخطوة رائع جداً.`,
                tone: 'celebrate',
              });
            } else {
              triggerVoiceNote({
                stationId: 9,
                stationLabel: 'خريطة الأقدام',
                title: `نجاح في التحدي ${challengeNumber}`,
                message: `أحسنتِ المثابرة ${heroName}! لقد أتممتِ التحدي بنجاح بعد تصحيح مسار القدمين. تذكري دائماً: نفس القدم في الحجلة ثم تبديل القدم في الخطوة.`,
                tone: 'encourage',
              });
            }
          }}
        />
      );
    }
    if (id === 10) {
      return (
        <RulesChallenge
          muted={progress.muted}
          voiceVolume={progress.voiceVolume}
          onCompleteRules={(correctCount, totalCount) => {
            if (correctCount >= totalCount - 1) {
              triggerVoiceNote({
                stationId: 10,
                stationLabel: 'قوانين الوثب',
                title: 'حكمة ميدان متميزة',
                message: `رائع جداً! أحسنتِ ${heroName}! قراراتكِ التحكيمية كانت دقيقة بنتيجة ${correctCount} من ${totalCount}. أنتِ تعرفين تماماً كيف تتجنبين الفاول وتحافظين على محاولة قانونية.`,
                tone: 'celebrate',
              });
            } else {
              triggerVoiceNote({
                stationId: 10,
                stationLabel: 'قوانين الوثب',
                title: 'توجيه حول قوانين الارتقاء',
                message: `محاولة جميلة ${heroName}! أجبتِ على ${correctCount} من ${totalCount} حالات تحكيمية. راجعي قاعدة خط الارتقاء والخروج للأمام من حفرة الرمل، فأنتِ قادرة على النجاح.`,
                tone: 'coach',
              });
            }
          }}
        />
      );
    }
    if (id === 11) {
      return (
        <ErrorsLab
          muted={progress.muted}
          voiceVolume={progress.voiceVolume}
          onCompleteErrors={(correctCount, totalCount) => {
            if (correctCount === totalCount) {
              triggerVoiceNote({
                stationId: 11,
                stationLabel: 'تصحيح الأخطاء',
                title: 'خبرة فنية عالية',
                message: `رائع جداً! أحسنتِ ${heroName}! استطعتِ تصحيح جميع الأخطاء الفنية الأربعة بنجاح، وهذا سيجعل قفزاتكِ أكثر أماناً وأطول مسافة.`,
                tone: 'celebrate',
              });
            } else {
              triggerVoiceNote({
                stationId: 11,
                stationLabel: 'تصحيح الأخطاء',
                title: 'ملاحظة فنية للتدريب',
                message: `محاولة جميلة ${heroName}! صححتِ ${correctCount} من ${totalCount} حالات. تذكري إبقاء النظر للأمام وثني الركبتين عند الهبوط في الرمل، وأنتِ قادرة على الإتقان.`,
                tone: 'coach',
              });
            }
          }}
        />
      );
    }
    if (id === 12) {
      return (
        <SafetyChecklist
          checkedIds={progress.safetyCheckedIds}
          onToggleItem={handleToggleSafety}
          muted={progress.muted}
          onAllReady={() => {
            triggerVoiceNote({
              stationId: 12,
              stationLabel: 'السلامة الرياضية',
              title: 'شارة الاستعداد الآمن',
              message: `رائع جداً! أحسنتِ الالتزام ${heroName}! بتحققكِ من الحذاء الرياضي والإحماء ونظافة حفرة الرمل أصبحتِ قدوة في السلامة الرياضية.`,
              tone: 'celebrate',
            });
          }}
        />
      );
    }
    if (id === 13) {
      return (
        <InteractiveQuiz
          answers={progress.quizAnswers}
          onSelectAnswer={handleSelectQuizAnswer}
          onResetQuiz={handleResetQuiz}
          muted={progress.muted}
          voiceVolume={progress.voiceVolume}
          onQuestionFeedback={({ questionNumber, isCorrect, explanation }) => {
            if (isCorrect) {
              triggerVoiceNote({
                stationId: 13,
                stationLabel: `السؤال ${questionNumber}`,
                title: 'إجابة صحيحة!',
                message: `رائع جداً! أحسنتِ ${heroName}، لقد أتقنتِ هذه المهارة! ${explanation}`,
                tone: 'celebrate',
              });
            } else {
              triggerVoiceNote({
                stationId: 13,
                stationLabel: `السؤال ${questionNumber}`,
                title: 'محاولة جميلة!',
                message: `محاولة جميلة ${heroName}! لا بأس، فأنتِ قادرة على النجاح. ${explanation}`,
                tone: 'coach',
              });
            }
          }}
          onQuizFinish={(correctCount, totalCount) => {
            const pct = Math.round((correctCount / totalCount) * 100);
            if (pct >= 83) {
              triggerVoiceNote({
                stationId: 13,
                stationLabel: 'الاختبار التفاعلي',
                title: `تفوق باهر (${pct}%)`,
                message: `رائع جداً! مبارك لكِ هذا التفوق ${heroName}! حصلتِ على ${correctCount} من ${totalCount} بنسبة ${pct} بالمئة في اختبار الأبطال. فخورة جداً بتركيزكِ وإتقانكِ للوثب الثلاثي!`,
                tone: 'celebrate',
              });
            } else if (pct >= 50) {
              triggerVoiceNote({
                stationId: 13,
                stationLabel: 'الاختبار التفاعلي',
                title: `أداء جيد (${pct}%)`,
                message: `أحسنتِ المحاولة ${heroName}! نتيجتكِ هي ${correctCount} من ${totalCount}. لديكِ أساس ممتاز، ويمكنكِ مراجعة الإجابات لترتفع نتيجتكِ إلى القمة.`,
                tone: 'encourage',
              });
            } else {
              triggerVoiceNote({
                stationId: 13,
                stationLabel: 'الاختبار التفاعلي',
                title: 'محاولة جميلة يا بطلة',
                message: `محاولة جميلة ${heroName}! لا بأس، حاولي مرة أخرى، فأنتِ قادرة على النجاح. اقرئي الشرح أسفل كل سؤال، ثم اضغطي على إعادة الاختبار.`,
                tone: 'coach',
              });
            }
          }}
        />
      );
    }
    if (id === 14) {
      return (
        <SelfAssessment
          ratings={progress.selfRatings}
          onRate={handleRateSelf}
          muted={progress.muted}
        />
      );
    }
    return (
      <CertificateView
        studentName={progress.studentName}
        onChangeName={(name) =>
          setProgress((prev) => ({ ...prev, studentName: name }))
        }
        completedStationsCount={progress.completedStations.length}
        quizScorePercent={quizScorePercent}
        footMapScore={progress.footMapScore}
      />
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <StageBackdrop
        stationId={progress.currentStation}
        motionEnabled={progress.bgMotionEnabled}
      />
      <div className="min-h-screen flex flex-col relative z-10 text-slate-900">
      {/* Top Bar strictly following 3-zone contract */}
      <header className="no-print sticky top-0 z-30 glass-header border-b border-sky-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => goToStation(1)}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer font-display"
          >
            تحدي الأبطال
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => goToStation(2)}
              className={`hover:text-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                progress.currentStation >= 2 && progress.currentStation <= 8
                  ? 'text-sky-700 font-bold'
                  : ''
              }`}
            >
              المراحل
            </button>
            <button
              type="button"
              onClick={() => goToStation(9)}
              className={`hover:text-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                progress.currentStation === 9 ? 'text-sky-700 font-bold' : ''
              }`}
            >
              خريطة الأقدام
            </button>
            <button
              type="button"
              onClick={() => goToStation(10)}
              className={`hover:text-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                progress.currentStation >= 10 && progress.currentStation <= 12
                  ? 'text-sky-700 font-bold'
                  : ''
              }`}
            >
              القوانين والسلامة
            </button>
            <button
              type="button"
              onClick={() => goToStation(13)}
              className={`hover:text-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                progress.currentStation >= 13 && progress.currentStation <= 14
                  ? 'text-sky-700 font-bold'
                  : ''
              }`}
            >
              التقويم
            </button>
            <button
              type="button"
              onClick={() => goToStation(15)}
              className={`hover:text-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                progress.currentStation === 15 ? 'text-sky-700 font-bold' : ''
              }`}
            >
              الشهادة
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsMapOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Map className="w-4 h-4" />
              <span>المحطات ({progress.currentStation}/15)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Compact Lesson Progress Strip + Site Audio Settings */}
      <div className="no-print bg-white/75 backdrop-blur-md border-b border-sky-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600">
            <span className="font-bold text-slate-900">{currentStationMeta.title}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">التقدم: {completionPercent}%</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="w-28 sm:w-40 h-2 bg-slate-200/70 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-sky-500 via-orange-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${(progress.currentStation / 15) * 100}%` }}
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setProgress((prev) => ({
                  ...prev,
                  bgMotionEnabled: !prev.bgMotionEnabled,
                }))
              }
              title={
                progress.bgMotionEnabled
                  ? 'إيقاف حركة الخلفية ثلاثية الأبعاد'
                  : 'تفعيل حركة الخلفية ثلاثية الأبعاد'
              }
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
            >
              <Sparkles
                className={`w-4 h-4 ${
                  progress.bgMotionEnabled ? 'text-orange-500' : 'text-slate-400'
                }`}
              />
              <span>
                {progress.bgMotionEnabled ? 'خلفية متحركة' : 'خلفية ثابتة'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setProgress((prev) => ({ ...prev, muted: !prev.muted }))
              }
              title={progress.muted ? 'تفعيل المؤثرات الصوتية' : 'كتم المؤثرات الصوتية'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
            >
              {progress.muted ? (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span>صامت</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-sky-600" />
                  <span>المؤثرات</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-200/80 bg-white/80 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>
                إعدادات الصوت ({progress.voiceNotesEnabled ? 'مفعّلة' : 'متوقفة'})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Mentor Guidance + Realistic Female TTS */}
        <div className="no-print">
          <MentorBar
            stationNumber={currentStationMeta.id}
            sectionLabel={currentStationMeta.sectionLabel}
            script={currentStationMeta.mentorScript}
            studentName={progress.studentName}
            voiceVolume={progress.voiceVolume}
            onChangeVolume={handleChangeVoiceVolume}
          />
        </div>

        {/* Station Interactive Content with smooth fade-in transition */}
        <section aria-label={currentStationMeta.title}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={progress.currentStation}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {renderStationContent()}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Bottom Station Stepper Navigation */}
        <div className="no-print pt-4 border-t border-sky-200/60 flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={progress.currentStation <= 1}
            onClick={() => goToStation(progress.currentStation - 1)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl glass-surface text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <ChevronRight className="w-4 h-4" />
            <span>المحطة السابقة</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5">
            {STATIONS.map((st) => {
              const isCurrent = st.id === progress.currentStation;
              const isDone = progress.completedStations.includes(st.id);
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => goToStation(st.id)}
                  title={`${st.id}. ${st.shortTitle}`}
                  aria-label={`الانتقال إلى المحطة ${st.id}: ${st.shortTitle}`}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    isCurrent
                      ? 'w-7 bg-sky-600'
                      : isDone
                        ? 'w-2.5 bg-emerald-500 hover:bg-emerald-600'
                        : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              );
            })}
          </div>

          {progress.currentStation < 15 ? (
            <button
              type="button"
              onClick={() => goToStation(progress.currentStation + 1)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>المحطة التالية</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goToStation(1)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>العودة للبداية</span>
            </button>
          )}
        </div>
      </main>

      {/* Clean Footer */}
      <footer className="no-print border-t border-sky-200/60 glass-header py-5 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            تحدي الأبطال: الوثب الثلاثي · التربية البدنية للصف السادس الابتدائي · المعلمة: عزيزة العنزي
          </div>
          <div className="flex items-center gap-4 tabular-nums">
            <span>السلامة: {progress.safetyCheckedIds.length}/{SAFETY_ITEMS.length}</span>
            <span aria-hidden="true">·</span>
            <span>المحطات: {progress.completedStations.length}/15</span>
          </div>
        </div>
      </footer>

      {/* Encouraging Voice Note Floating Card */}
      <VoiceNoteBanner
        activeNote={activeVoiceNote}
        status={
          activeVoiceNote && voiceSnap.activeKey === activeVoiceNote.id
            ? voiceSnap.status
            : 'idle'
        }
        errorText={
          activeVoiceNote && voiceSnap.activeKey === activeVoiceNote.id
            ? voiceSnap.error
            : null
        }
        canRetry={
          Boolean(
            activeVoiceNote &&
              voiceSnap.activeKey === activeVoiceNote.id &&
              voiceSnap.canRetry
          )
        }
        voiceVolume={progress.voiceVolume}
        onChangeVolume={handleChangeVoiceVolume}
        onPlayOrResume={(note) => {
          if (
            voiceSnap.activeKey === note.id &&
            voiceSnap.status === 'paused'
          ) {
            void resumeVoiceClip();
          } else {
            void playNoteAudio(note);
          }
        }}
        onPause={pauseVoiceClip}
        onReplay={(note) => void playNoteAudio(note)}
        onStop={stopNoteAudio}
        onDismiss={() => {
          stopNoteAudio();
          setActiveVoiceNote(null);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Settings & Recorded Voice Notes Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        voiceNotesEnabled={progress.voiceNotesEnabled}
        onToggleVoiceNotes={() =>
          setProgress((prev) => {
            const nextVal = !prev.voiceNotesEnabled;
            if (!nextVal) {
              stopNoteAudio();
              setActiveVoiceNote(null);
            }
            return { ...prev, voiceNotesEnabled: nextVal };
          })
        }
        autoPlayVoiceNotes={progress.autoPlayVoiceNotes}
        onToggleAutoPlay={() =>
          setProgress((prev) => ({
            ...prev,
            autoPlayVoiceNotes: !prev.autoPlayVoiceNotes,
          }))
        }
        voiceVolume={progress.voiceVolume}
        onChangeVolume={handleChangeVoiceVolume}
        sfxMuted={progress.muted}
        onToggleSfx={() =>
          setProgress((prev) => ({ ...prev, muted: !prev.muted }))
        }
        bgMotionEnabled={progress.bgMotionEnabled}
        onToggleBgMotion={() =>
          setProgress((prev) => ({
            ...prev,
            bgMotionEnabled: !prev.bgMotionEnabled,
          }))
        }
        history={progress.voiceNotesHistory}
        playingNoteId={
          voiceSnap.status === 'playing' ? voiceSnap.activeKey : null
        }
        loadingNoteId={
          voiceSnap.status === 'loading' ? voiceSnap.activeKey : null
        }
        onPlayHistoryNote={(note) => void playNoteAudio(note)}
        onStopPlayback={stopNoteAudio}
        onClearHistory={() => {
          stopNoteAudio();
          setProgress((prev) => ({ ...prev, voiceNotesHistory: [] }));
        }}
      />

      {/* 15-Station Interactive Map Modal */}
      <AnimatePresence>
        {isMapOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="no-print fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="خريطة المحطات التعليمية الخمس عشرة"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="glass-surface rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-200/70 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    خريطة المحطات التعليمية (15 محطة)
                  </h2>
                  <p className="text-xs text-slate-500">
                    اختاري أي محطة للانتقال إليها مباشرة · يُحفظ تقدمكِ تلقائياً
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMapOpen(false)}
                  aria-label="إغلاق خريطة المحطات"
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {STATIONS.map((st) => {
                  const isCurrent = st.id === progress.currentStation;
                  const isDone = progress.completedStations.includes(st.id);

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => goToStation(st.id)}
                      className={`text-right rounded-xl border p-3.5 transition-colors flex flex-col justify-between gap-2 cursor-pointer ${
                        isCurrent
                          ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-300'
                          : isDone
                            ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400'
                            : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-500">
                          {st.sectionLabel}
                        </span>
                        {isDone && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        <span className="text-sky-700 tabular-nums ml-1">{st.id}.</span>
                        {st.shortTitle}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{st.objective}</p>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
