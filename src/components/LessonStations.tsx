import React, { useState } from 'react';
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Dumbbell,
  Heart,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  ASSET_PATHS,
  GOAL_PILLARS,
  PHASE_DETAILS,
} from '../data/lessonData';
import { InteractiveTrackSim, SimFocusPhase } from './InteractiveTrackSim';
import { playErrorTone, playSuccessTone } from '../utils/audio';
import { VoiceReadButton } from './VoiceReadButton';

interface WelcomeStationProps {
  studentName: string;
  onChangeName: (name: string) => void;
  onStartJourney: () => void;
  completedCount: number;
}

export const WelcomeStation: React.FC<WelcomeStationProps> = ({
  studentName,
  onChangeName,
  onStartJourney,
  completedCount,
}) => {
  const [heroImgErr, setHeroImgErr] = useState(false);
  const [trackImgErr, setTrackImgErr] = useState(false);

  return (
    <div className="space-y-6">
      {/* Main Hero Split */}
      <div className="glass-surface rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="text-xs sm:text-sm font-semibold text-sky-700">
              التربية البدنية · الصف السادس الابتدائي · المعلمة: عزيزة العنزي
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight [text-wrap:balance]">
              تحدي الأبطال: إتقان مهارة الوثب الثلاثي
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
              انطلقي مع مرشدتكِ الرياضية على مضمار ألعاب القوى لتتعلمي تسلسل المهارات الأربع:
              الاقتراب، ثم الحجلة، ثم الخطوة، وأخيراً القفز والهبوط الآمن في حفرة الرمل.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="hero-student-name"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  اكتبي اسمكِ لتخصيص الشهادة والرحلة:
                </label>
                <input
                  id="hero-student-name"
                  type="text"
                  value={studentName}
                  onChange={(e) => onChangeName(e.target.value)}
                  placeholder="مثال: سارة محمد"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="button"
                onClick={onStartJourney}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-sky-600 text-white text-sm sm:text-base font-bold hover:bg-sky-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>{completedCount > 1 ? 'متابعة التحدي' : 'ابدئي الرحلة الآن'}</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 3D Mentor Portrait Side */}
        <div className="lg:col-span-5 bg-gradient-to-br from-sky-100 via-sky-50 to-orange-50 relative min-h-[300px] lg:min-h-[420px] flex items-center justify-center border-t lg:border-t-0 lg:border-r border-slate-200">
          {!heroImgErr ? (
            <img
              src={ASSET_PATHS.mentorHero}
              alt="مرشدة تحدي الأبطال في مضمار ألعاب القوى"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgErr(true)}
              className="w-full h-full object-cover object-top lg:max-h-[460px]"
            />
          ) : (
            <div className="p-8 text-center space-y-2">
              <Sparkles className="w-10 h-10 text-sky-600 mx-auto" />
              <div className="font-bold text-slate-800">المرشدة الرياضية</div>
            </div>
          )}
        </div>
      </div>

      {/* 4-column Sequence Strip below Hero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { step: '01', name: 'الاقتراب', desc: 'جري متسارع ومنتظم نحو اللوحة', color: 'text-slate-800' },
          { step: '02', name: 'الحجلة', desc: 'ارتقاء وهبوط على نفس القدم', color: 'text-sky-700' },
          { step: '03', name: 'الخطوة', desc: 'تبديل الهبوط إلى القدم الأخرى', color: 'text-orange-600' },
          { step: '04', name: 'القفز والهبوط', desc: 'انطلاق للأمام وهبوط بكلتا القدمين', color: 'text-emerald-700' },
        ].map((item) => (
          <div
            key={item.step}
            className="glass-surface glass-surface-interactive rounded-xl p-4 space-y-1"
          >
            <div className="text-xs font-semibold text-slate-400 tabular-nums">{item.step}</div>
            <div className={`text-base font-bold ${item.color}`}>{item.name}</div>
            <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Track Overview Visual */}
      <div className="glass-surface rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            مضمار الوثب الثلاثي والمسارات الضوئية للإيقاع
          </h2>
          <span className="text-xs text-slate-500">
            السماوي: الحجلة · البرتقالي: الخطوة · الأخضر: القفز والهبوط
          </span>
        </div>
        {!trackImgErr ? (
          <img
            src={ASSET_PATHS.trackScene}
            alt="مضمار ألعاب القوى وحفرة الرمل مع المسارات الضوئية للوثب الثلاثي"
            referrerPolicy="no-referrer"
            onError={() => setTrackImgErr(true)}
            className="w-full h-64 sm:h-80 object-cover"
          />
        ) : (
          <div className="h-48 bg-sky-50 flex items-center justify-center text-sm text-sky-800">
            مضمار ألعاب القوى وحفرة الرمل
          </div>
        )}
      </div>
    </div>
  );
};

interface ConceptStationProps {
  muted?: boolean;
}

export const ConceptStation: React.FC<ConceptStationProps> = ({ muted = false }) => {
  const [compareMode, setCompareMode] = useState<'triple' | 'long'>('triple');
  const [phasesImgErr, setPhasesImgErr] = useState(false);

  return (
    <div className="space-y-6">
      {/* Interactive Concept Switcher */}
      <div className="glass-surface rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">مفهوم الوثب الثلاثي</h2>
            <p className="text-sm text-slate-600 mt-1">
              قارني بين الوثب الطويل والوثب الثلاثي لاكتشاف سر التسمية والإيقاع.
            </p>
          </div>

          <div className="inline-flex p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setCompareMode('triple')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                compareMode === 'triple'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الوثب الثلاثي
            </button>
            <button
              type="button"
              onClick={() => setCompareMode('long')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                compareMode === 'long'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الوثب الطويل
            </button>
          </div>
        </div>

        {compareMode === 'triple' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 space-y-1.5">
              <div className="text-xs font-bold text-sky-700">الوثبة الأولى</div>
              <div className="text-base font-bold text-slate-900">الحجلة (نفس القدم)</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                تنطلقين من لوحة الارتقاء وتهبطين على نفس القدم مع استمرار الاندفاع للأمام.
              </p>
            </div>
            <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-4 space-y-1.5">
              <div className="text-xs font-bold text-orange-700">الوثبة الثانية</div>
              <div className="text-base font-bold text-slate-900">الخطوة (تبديل القدم)</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                تندفعين إلى الأمام وتبدلين الهبوط على القدم الأخرى بتوازن كامل.
              </p>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-1.5">
              <div className="text-xs font-bold text-emerald-700">الوثبة الثالثة</div>
              <div className="text-base font-bold text-slate-900">القفز والهبوط</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                أقوى وثبة نحو حفرة الرمل مع الهبوط الآمن بكلتا القدمين وثني الركبتين.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
            <div className="text-base font-bold text-slate-900">
              الفرق عن الوثب الطويل
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              في <strong>الوثب الطويل</strong> تركض اللاعبة وتقفز <strong>وثبة واحدة</strong> مباشرة إلى حفرة الرمل. أما في <strong>الوثب الثلاثي</strong> فتؤدي اللاعبة <strong>ثلاث وثبات متصلة</strong> (حجلة + خطوة + قفز) قبل الهبوط في الرمل، مما يتطلب إيقاعاً وتوازناً عالياً.
            </p>
          </div>
        )}

        {/* Original sequence illustration */}
        {!phasesImgErr && (
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
            <img
              src={ASSET_PATHS.jumpPhases}
              alt="تسلسل مراحل الوثب الثلاثي الأربعة"
              referrerPolicy="no-referrer"
              onError={() => setPhasesImgErr(true)}
              className="w-full h-auto max-h-80 object-cover"
            />
          </div>
        )}
      </div>

      {/* Live interactive simulator */}
      <InteractiveTrackSim focusPhase="all" muted={muted} />
    </div>
  );
};

interface GoalsStationProps {
  muted?: boolean;
  voiceVolume?: number;
  onGoalCheckComplete?: (correctCount: number, totalCount: number) => void;
}

export const GoalsStation: React.FC<GoalsStationProps> = ({
  muted = false,
  voiceVolume,
  onGoalCheckComplete,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  const iconMap = {
    mind: Brain,
    body: Dumbbell,
    heart: Heart,
  };

  const colorMap = {
    sky: 'bg-sky-50 border-sky-200 text-sky-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };

  const handleCheck = (pillarId: string, optIdx: number, correctIdx: number) => {
    const next = { ...selectedAnswers, [pillarId]: optIdx };
    setSelectedAnswers(next);
    if (optIdx === correctIdx) playSuccessTone(muted);
    else playErrorTone(muted);

    if (Object.keys(next).length === GOAL_PILLARS.length) {
      const right = GOAL_PILLARS.filter(
        (g) => next[g.id] === g.quickCheck.correctIndex
      ).length;
      onGoalCheckComplete?.(right, GOAL_PILLARS.length);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {GOAL_PILLARS.map((pillar) => {
        const Icon = iconMap[pillar.id];
        const chosen = selectedAnswers[pillar.id];
        const isCorrect = chosen === pillar.quickCheck.correctIndex;

        return (
          <div
            key={pillar.id}
            className="glass-surface glass-surface-interactive rounded-2xl p-5 flex flex-col justify-between gap-5"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${colorMap[pillar.accentColor]}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{pillar.title}</h3>
                  <p className="text-xs text-slate-500">{pillar.subtitle}</p>
                </div>
              </div>

              <ul className="space-y-2 text-sm text-slate-700">
                {pillar.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Interactive Mini-Check */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-bold text-slate-800">
                  تحقق سريع: {pillar.quickCheck.question}
                </div>
                <VoiceReadButton
                  clipKey={`goal-q-${pillar.id}`}
                  text={pillar.quickCheck.question}
                  tone="question"
                  volume={voiceVolume}
                  label="استماع"
                />
              </div>
              <div className="space-y-1.5">
                {pillar.quickCheck.options.map((opt, idx) => {
                  const picked = chosen === idx;
                  const right = idx === pillar.quickCheck.correctIndex;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        handleCheck(pillar.id, idx, pillar.quickCheck.correctIndex)
                      }
                      className={`w-full text-right px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                        picked
                          ? right
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold'
                            : 'bg-red-50 border-red-300 text-red-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-sky-50'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {chosen !== undefined && (
                <p
                  className={`text-xs leading-relaxed ${
                    isCorrect ? 'text-emerald-700 font-medium' : 'text-orange-700'
                  }`}
                >
                  {isCorrect
                    ? pillar.quickCheck.feedback
                    : 'حاولي اختيار الإجابة الأدق من القائمة.'}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface PhaseStationProps {
  stationId: number;
  muted?: boolean;
  onCompleteSim?: () => void;
}

export const PhaseStation: React.FC<PhaseStationProps> = ({
  stationId,
  muted = false,
  onCompleteSim,
}) => {
  const phase = PHASE_DETAILS.find((p) => p.stationId === stationId);
  const focusPhase: SimFocusPhase = phase ? phase.phaseKey : 'all';

  return (
    <div className="space-y-6">
      {phase ? (
        <div className="glass-surface rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="text-xs font-semibold text-sky-700">
                المرحلة {phase.orderNumber} · {phase.englishName}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                {phase.arabicName}
              </h2>
            </div>
            <div className="text-sm font-bold text-orange-600 bg-orange-50 border border-orange-200 px-3.5 py-1.5 rounded-lg">
              الإيقاع: {phase.rhythmCue}
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-800 font-medium">
            {phase.keyRule}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {phase.bodyCues.map((cue, idx) => (
              <div
                key={cue}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-700 flex items-start gap-2.5"
              >
                <span className="font-bold text-sky-700 tabular-nums shrink-0">
                  {idx + 1}.
                </span>
                <span>{cue}</span>
              </div>
            ))}
          </div>

          <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 text-xs sm:text-sm text-sky-950 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-sky-700 shrink-0" />
            <span>
              <strong>نصيحة البطلة:</strong> {phase.commonTip}
            </span>
          </div>
        </div>
      ) : (
        <div className="glass-surface rounded-2xl p-5 sm:p-6 space-y-3">
          <h2 className="text-xl font-bold text-slate-900">
            مختبر الإيقاع الحركي الكامل (الاقتراب ← الحجلة ← الخطوة ← القفز والهبوط)
          </h2>
          <p className="text-sm text-slate-600">
            جربي تشغيل المحاكاة الكاملة، وغيري قدم البداية وسرعة الاقتراب وزاوية الارتقاء لمشاهدة أثرها على طول الوثبة الثلاثية.
          </p>
        </div>
      )}

      <InteractiveTrackSim
        focusPhase={focusPhase}
        muted={muted}
        onCompleteRun={onCompleteSim}
      />
    </div>
  );
};
