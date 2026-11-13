import React, { useState } from 'react';
import { CheckCircle2, Footprints, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { playErrorTone, playStepTone, playSuccessTone } from '../utils/audio';

type FootChoice = 'left' | 'right' | 'both';

interface FootChallenge {
  id: number;
  title: string;
  instruction: string;
  startFoot: 'left' | 'right';
}

const CHALLENGES: FootChallenge[] = [
  {
    id: 1,
    title: 'التحدي الأول: الانطلاق بالقدم اليسرى',
    instruction: 'رتبي حركة القدمين بدءاً من لوحة الارتقاء بالقدم اليسرى وصولاً إلى حفرة الرمل.',
    startFoot: 'left',
  },
  {
    id: 2,
    title: 'التحدي الثاني: الانطلاق بالقدم اليمنى',
    instruction: 'الآن ابدئي الارتقاء بالقدم اليمنى وتذكري قاعدة الحجلة والخطوة والهبوط.',
    startFoot: 'right',
  },
  {
    id: 3,
    title: 'التحدي الثالث: إتقان الإيقاع السريع',
    instruction: 'اختبار الدقة السريع! أكملي السلسلة الكاملة من الارتقاء باليسرى دون أخطاء.',
    startFoot: 'left',
  },
];

const SLOT_LABELS = [
  { key: 0, title: '١. لوحة الارتقاء', subtitle: 'بداية الحجلة', color: 'sky' },
  { key: 1, title: '٢. هبوط الحجلة', subtitle: 'نفس القدم', color: 'sky' },
  { key: 2, title: '٣. هبوط الخطوة', subtitle: 'تبديل القدم', color: 'orange' },
  { key: 3, title: '٤. حفرة الرمل', subtitle: 'الهبوط النهائي', color: 'emerald' },
] as const;

interface FootMapGameProps {
  muted?: boolean;
  savedScore: number;
  onSaveScore: (score: number) => void;
  onChallengeFeedback?: (params: {
    challengeNumber: number;
    mistakes: number;
    score: number;
  }) => void;
}

export const FootMapGame: React.FC<FootMapGameProps> = ({
  muted = false,
  savedScore,
  onSaveScore,
  onChallengeFeedback,
}) => {
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [placedFeet, setPlacedFeet] = useState<(FootChoice | null)[]>([null, null, null, null]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);

  const challenge = CHALLENGES[challengeIdx];
  const expectedSequence: FootChoice[] = [
    challenge.startFoot,
    challenge.startFoot,
    challenge.startFoot === 'left' ? 'right' : 'left',
    'both',
  ];

  const activeSlotIdx = placedFeet.findIndex((f) => f === null);
  const isChallengeDone = activeSlotIdx === -1;

  const footLabel = (f: FootChoice) => {
    if (f === 'left') return 'القدم اليسرى';
    if (f === 'right') return 'القدم اليمنى';
    return 'كلتا القدمين';
  };

  const handleSelectFoot = (choice: FootChoice) => {
    if (isChallengeDone) return;
    const expected = expectedSequence[activeSlotIdx];

    if (choice === expected) {
      const updated = [...placedFeet];
      updated[activeSlotIdx] = choice;
      setPlacedFeet(updated);
      playStepTone(activeSlotIdx, muted);

      if (activeSlotIdx === 3) {
        playSuccessTone(muted);
        const newCompleted = completedChallenges.includes(challenge.id)
          ? completedChallenges
          : [...completedChallenges, challenge.id];
        setCompletedChallenges(newCompleted);
        const newScore = Math.max(savedScore, Math.min(100, newCompleted.length * 33 + (mistakes === 0 ? 1 : 0)));
        onSaveScore(newScore);
        setFeedback({
          type: 'success',
          message: 'أحسنتِ! سلسلة قدمين مثالية: حجلة على نفس القدم، خطوة بتبديل القدم، وهبوط بكلتا القدمين في الرمل.',
        });
        onChallengeFeedback?.({
          challengeNumber: challenge.id,
          mistakes,
          score: newScore,
        });
      } else {
        const nextHint =
          activeSlotIdx === 0
            ? 'ممتاز! الآن حددي قدم الهبوط في الحجلة (تذكري: نفس القدم).'
            : activeSlotIdx === 1
              ? 'رائع! والآن في الخطوة نبدل إلى القدم الأخرى.'
              : 'بقيت الخطوة الأخيرة: كيف نهبط في حفرة الرمل؟';
        setFeedback({ type: 'info', message: nextHint });
      }
    } else {
      playErrorTone(muted);
      setMistakes((m) => m + 1);
      const hintMap: Record<number, string> = {
        0: `في هذا التحدي نبدأ الارتقاء بـ ${footLabel(expected)}.`,
        1: `في الحجلة يجب الهبوط على نفس قدم الارتقاء (${footLabel(expected)}).`,
        2: `في الخطوة نُبدّل القدم! بما أنكِ هبطتِ على ${footLabel(placedFeet[1]!)}, فالخطوة تكون على ${footLabel(expected)}.`,
        3: 'في حفرة الرمل نهبط دائماً بكلتا القدمين معاً مع ثني الركبتين.',
      };
      setFeedback({
        type: 'error',
        message: `ليست ${footLabel(choice)}! ${hintMap[activeSlotIdx]}`,
      });
    }
  };

  const handleResetChallenge = (idx = challengeIdx) => {
    setChallengeIdx(idx);
    setPlacedFeet([null, null, null, null]);
    setFeedback(null);
  };

  const handleNextChallenge = () => {
    const nextIdx = (challengeIdx + 1) % CHALLENGES.length;
    handleResetChallenge(nextIdx);
  };

  return (
    <div className="space-y-6">
      {/* Challenge Selector Tabs */}
      <div className="glass-surface rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{challenge.title}</h3>
            <p className="text-sm text-slate-600 mt-1">{challenge.instruction}</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600 tabular-nums shrink-0">
            <span>
              التحديات المكتملة:{' '}
              <strong className="text-emerald-700">{completedChallenges.length} / {CHALLENGES.length}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              أفضل نتيجة: <strong className="text-sky-700">{savedScore}%</strong>
            </span>
          </div>
        </div>

        {/* Interactive Track Sequence Map */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SLOT_LABELS.map((slot, idx) => {
              const value = placedFeet[idx];
              const isCurrent = idx === activeSlotIdx;
              const borderClass =
                value !== null
                  ? slot.color === 'sky'
                    ? 'border-sky-400 bg-sky-50/70'
                    : slot.color === 'orange'
                      ? 'border-orange-400 bg-orange-50/70'
                      : 'border-emerald-400 bg-emerald-50/70'
                  : isCurrent
                    ? 'border-sky-500 bg-white ring-2 ring-sky-200'
                    : 'border-slate-200 bg-white/70';

              return (
                <div
                  key={slot.key}
                  className={`rounded-xl border p-4 transition-all flex flex-col justify-between min-h-[116px] ${borderClass}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">{slot.title}</span>
                    <span className="text-xs text-slate-500">{slot.subtitle}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-center">
                    {value ? (
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{footLabel(value)}</span>
                      </div>
                    ) : isCurrent ? (
                      <span className="text-xs font-semibold text-sky-700">
                        اختاري الحركة من الأسفل
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">بانتظار الخطوة السابقة</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Foot Pads */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-700">
            {isChallengeDone
              ? 'اكتملت السلسلة بنجاح!'
              : `اختاري القدم المناسبة للمحطة (${SLOT_LABELS[activeSlotIdx].title}):`}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              disabled={isChallengeDone}
              onClick={() => handleSelectFoot('left')}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl border border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold transition-colors cursor-pointer"
            >
              <Footprints className="w-5 h-5 text-sky-600" />
              <span>القدم اليسرى</span>
            </button>

            <button
              type="button"
              disabled={isChallengeDone}
              onClick={() => handleSelectFoot('right')}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl border border-slate-200 bg-white hover:border-orange-400 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold transition-colors cursor-pointer"
            >
              <Footprints className="w-5 h-5 text-orange-600 -scale-x-100" />
              <span>القدم اليمنى</span>
            </button>

            <button
              type="button"
              disabled={isChallengeDone}
              onClick={() => handleSelectFoot('both')}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold transition-colors cursor-pointer"
            >
              <Footprints className="w-5 h-5 text-emerald-600" />
              <span>كلتا القدمين (في الرمل)</span>
            </button>
          </div>
        </div>

        {/* Immediate Feedback */}
        {feedback && (
          <div
            className={`rounded-xl p-4 border flex items-start gap-3 text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : feedback.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-sky-50 border-sky-200 text-sky-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <Trophy className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : feedback.type === 'error' ? (
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            )}
            <p className="leading-relaxed">{feedback.message}</p>
          </div>
        )}

        {/* Footer challenge controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {CHALLENGES.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleResetChallenge(idx)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  idx === challengeIdx
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                التحدي {idx + 1}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleResetChallenge(challengeIdx)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة</span>
            </button>
            {isChallengeDone && (
              <button
                type="button"
                onClick={handleNextChallenge}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
              >
                <span>التحدي التالي</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
