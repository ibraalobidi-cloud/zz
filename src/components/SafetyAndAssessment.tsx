import React from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  XCircle,
} from 'lucide-react';
import {
  QUIZ_QUESTIONS,
  SAFETY_ITEMS,
  SELF_ASSESS_CRITERIA,
} from '../data/lessonData';
import { playErrorTone, playFanfare, playSuccessTone } from '../utils/audio';
import { VoiceReadButton } from './VoiceReadButton';

interface SafetyChecklistProps {
  checkedIds: string[];
  onToggleItem: (id: string) => void;
  muted?: boolean;
  onAllReady?: () => void;
}

export const SafetyChecklist: React.FC<SafetyChecklistProps> = ({
  checkedIds,
  onToggleItem,
  muted = false,
  onAllReady,
}) => {
  const allReady = checkedIds.length === SAFETY_ITEMS.length;

  const handleToggle = (id: string) => {
    const willCheck = !checkedIds.includes(id);
    onToggleItem(id);
    if (willCheck) {
      if (checkedIds.length + 1 === SAFETY_ITEMS.length) {
        playFanfare(muted);
        onAllReady?.();
      } else {
        playSuccessTone(muted);
      }
    }
  };

  return (
    <div className="glass-surface rounded-2xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-bold text-slate-900">
            قائمة تحقق السلامة والاستعداد الآمن
          </h3>
        </div>
        <span className="text-sm text-slate-600 tabular-nums">
          الجاهزية:{' '}
          <strong className={allReady ? 'text-emerald-700' : 'text-sky-700'}>
            {checkedIds.length} / {SAFETY_ITEMS.length}
          </strong>
        </span>
      </div>

      {/* Interactive readiness progress bar */}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${(checkedIds.length / SAFETY_ITEMS.length) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SAFETY_ITEMS.map((item) => {
          const isChecked = checkedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleToggle(item.id)}
              aria-pressed={isChecked}
              className={`text-right rounded-xl border p-4 transition-colors flex items-start gap-3 cursor-pointer ${
                isChecked
                  ? 'bg-emerald-50/70 border-emerald-300'
                  : 'bg-slate-50/60 border-slate-200 hover:bg-sky-50/60 hover:border-sky-300'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isChecked
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-slate-300'
                }`}
              >
                {isChecked && <CheckCircle2 className="w-4 h-4" />}
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-sky-700">{item.category}</span>
                </div>
                <div className="text-sm font-bold text-slate-900">{item.title}</div>
                <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>
              </div>
            </button>
          );
        })}
      </div>

      {allReady ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-sm text-emerald-900">
          <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
          <p>
            <strong>ممتاز يا بطلة!</strong> تحققتِ من جميع شروط السلامة الرياضية، وأنتِ مستعدة تماماً للتدريب بأمان وثقة.
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          اضغطي على كل بند بعد التأكد من تطبيقه لإتمام شارة الاستعداد الآمن.
        </p>
      )}
    </div>
  );
};

interface InteractiveQuizProps {
  answers: Record<number, number>;
  onSelectAnswer: (questionId: number, optionIndex: number) => void;
  onResetQuiz: () => void;
  muted?: boolean;
  voiceVolume?: number;
  onQuestionFeedback?: (params: {
    questionNumber: number;
    isCorrect: boolean;
    explanation: string;
  }) => void;
  onQuizFinish?: (correctCount: number, totalCount: number) => void;
}

export const InteractiveQuiz: React.FC<InteractiveQuizProps> = ({
  answers,
  onSelectAnswer,
  onResetQuiz,
  muted = false,
  voiceVolume,
  onQuestionFeedback,
  onQuizFinish,
}) => {
  const answeredCount = Object.keys(answers).length;
  const correctCount = QUIZ_QUESTIONS.filter(
    (q) => answers[q.id] === q.correctIndex
  ).length;
  const scorePercent = Math.round((correctCount / QUIZ_QUESTIONS.length) * 100);
  const allAnswered = answeredCount === QUIZ_QUESTIONS.length;

  const handlePick = (qId: number, optIdx: number, correctIdx: number) => {
    if (answers[qId] !== undefined) return;
    const isCorrect = optIdx === correctIdx;
    const nextCorrect = correctCount + (isCorrect ? 1 : 0);
    const nextAnswered = answeredCount + 1;
    const qObj = QUIZ_QUESTIONS.find((item) => item.id === qId);
    const qIdx = QUIZ_QUESTIONS.findIndex((item) => item.id === qId) + 1;

    onSelectAnswer(qId, optIdx);
    if (isCorrect) {
      if (nextAnswered === QUIZ_QUESTIONS.length && nextCorrect >= 5) {
        playFanfare(muted);
      } else {
        playSuccessTone(muted);
      }
    } else {
      playErrorTone(muted);
    }

    if (nextAnswered === QUIZ_QUESTIONS.length) {
      onQuizFinish?.(nextCorrect, QUIZ_QUESTIONS.length);
    } else if (qObj) {
      onQuestionFeedback?.({
        questionNumber: qIdx,
        isCorrect,
        explanation: qObj.explanation,
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="glass-surface rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <ClipboardCheck className="w-5 h-5 text-sky-600" />
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              اختبار الأبطال في الوثب الثلاثي
            </h3>
            <p className="text-xs text-slate-500">
              أجيبي عن جميع الأسئلة مع تغذية راجعة فورية لكل سؤال
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-700 tabular-nums">
            النتيجة:{' '}
            <strong className="text-emerald-700">
              {correctCount} / {QUIZ_QUESTIONS.length} ({scorePercent}%)
            </strong>
          </div>
          {answeredCount > 0 && (
            <button
              type="button"
              onClick={onResetQuiz}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة الاختبار</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {QUIZ_QUESTIONS.map((q, qIdx) => {
          const picked = answers[q.id];
          const isAnswered = picked !== undefined;
          const isRight = picked === q.correctIndex;

          return (
            <div
              key={q.id}
              className="glass-surface rounded-2xl p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                  <span className="text-sky-700 ml-1.5 tabular-nums">{qIdx + 1}.</span>
                  {q.question}
                </h4>
                <VoiceReadButton
                  clipKey={`quiz-q-${q.id}`}
                  text={q.question}
                  tone="question"
                  volume={voiceVolume}
                  label="استماع للسؤال"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {q.options.map((opt, optIdx) => {
                  const isSelected = picked === optIdx;
                  const isCorrectOption = optIdx === q.correctIndex;

                  let btnClass =
                    'bg-slate-50 border-slate-200 text-slate-800 hover:bg-sky-50 hover:border-sky-300';
                  if (isAnswered) {
                    if (isCorrectOption) {
                      btnClass = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold';
                    } else if (isSelected) {
                      btnClass = 'bg-red-50 border-red-300 text-red-900';
                    } else {
                      btnClass = 'bg-slate-50 border-slate-200 text-slate-400';
                    }
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => handlePick(q.id, optIdx, q.correctIndex)}
                      className={`text-right px-4 py-3 rounded-xl border text-sm transition-colors cursor-pointer disabled:cursor-default ${btnClass}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div
                  className={`rounded-lg p-3 border text-xs sm:text-sm flex items-start gap-2.5 ${
                    isRight
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-orange-50 border-orange-200 text-orange-950'
                  }`}
                >
                  {isRight ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  )}
                  <p>{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allAnswered && (
        <div
          className={`rounded-xl p-5 border text-sm sm:text-base ${
            scorePercent >= 80
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-sky-50 border-sky-200 text-sky-950'
          }`}
        >
          <strong>
            {scorePercent >= 80
              ? 'أداء متميز يا بطلة!'
              : 'محاولة جيدة جداً!'}
          </strong>{' '}
          حصلتِ على <span className="tabular-nums font-bold">{scorePercent}%</span> في اختبار الوثب الثلاثي. يمكنكِ الآن الانتقال إلى التقييم الذاتي ثم استلام شهادتكِ.
        </div>
      )}
    </div>
  );
};

interface SelfAssessmentProps {
  ratings: Record<string, 1 | 2 | 3>;
  onRate: (id: string, level: 1 | 2 | 3) => void;
  muted?: boolean;
}

const LEVELS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: 'أحتاج لتدريب إضافي' },
  { value: 2, label: 'جيد جداً' },
  { value: 3, label: 'أتقنها بامتياز' },
];

export const SelfAssessment: React.FC<SelfAssessmentProps> = ({
  ratings,
  onRate,
  muted = false,
}) => {
  const completedCount = Object.keys(ratings).length;
  const totalStars = Object.values(ratings).reduce((sum, v) => sum + v, 0);
  const maxStars = SELF_ASSESS_CRITERIA.length * 3;

  return (
    <div className="glass-surface rounded-2xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4">
        <div className="flex items-center gap-2.5">
          <Star className="w-5 h-5 text-orange-500 fill-orange-400" />
          <h3 className="text-lg font-bold text-slate-900">
            التقييم الذاتي لمهاراتي في الوثب الثلاثي
          </h3>
        </div>
        <div className="text-sm text-slate-600 tabular-nums">
          التقدير الذاتي:{' '}
          <strong className="text-orange-600">
            {totalStars} / {maxStars} نجوم
          </strong>
        </div>
      </div>

      <div className="space-y-3">
        {SELF_ASSESS_CRITERIA.map((criterion) => {
          const current = ratings[criterion.id];
          return (
            <div
              key={criterion.id}
              className="rounded-xl border border-slate-200/80 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/75 backdrop-blur-xs"
            >
              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-900">{criterion.label}</div>
                <p className="text-xs text-slate-600">{criterion.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {LEVELS.map((lvl) => {
                  const active = current === lvl.value;
                  return (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => {
                        onRate(criterion.id, lvl.value);
                        playSuccessTone(muted);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? lvl.value === 3
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : lvl.value === 2
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <span>{lvl.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {completedCount === SELF_ASSESS_CRITERIA.length && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm text-sky-950">
          <strong>تأمل رائع يا بطلة!</strong> لقد قيّمتِ جميع مهاراتكِ بوعي ومسؤولية، وأصبحتِ جاهزة لمحطة التتويج واستلام شهادة الإنجاز.
        </div>
      )}
    </div>
  );
};
