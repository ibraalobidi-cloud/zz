import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Scale, Wrench, XCircle } from 'lucide-react';
import { ERROR_CASES, RULE_SCENARIOS, RuleScenario } from '../data/lessonData';
import { playErrorTone, playSuccessTone } from '../utils/audio';
import { VoiceReadButton } from './VoiceReadButton';

interface RulesChallengeProps {
  muted?: boolean;
  voiceVolume?: number;
  onCompleteRules?: (correctCount: number, totalCount: number) => void;
}

const ScenarioDiagram: React.FC<{ type: RuleScenario['visualType'] }> = ({ type }) => {
  return (
    <div dir="ltr" className="w-full rounded-lg border border-slate-200 bg-sky-50/50 overflow-hidden">
      <svg viewBox="0 0 560 150" className="w-full h-auto block" role="img" aria-label="رسم توضيحي لحالة التحكيم">
        <rect x="0" y="0" width="560" height="106" fill="#F8FAFC" />
        <rect x="0" y="106" width="330" height="44" fill="#E05D38" />
        <rect x="330" y="106" width="230" height="44" fill="#FDE68A" stroke="#D97706" strokeWidth="1.5" />

        {/* Takeoff Board */}
        <rect x="170" y="106" width="44" height="10" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
        <rect x="214" y="106" width="8" height="10" fill="#DC2626" />
        <text x="192" y="135" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700">
          لوحة الارتقاء
        </text>
        <text x="445" y="132" textAnchor="middle" fill="#92400E" fontSize="12" fontWeight="700">
          حفرة الرمل
        </text>

        {type === 'board-clean' && (
          <g>
            <ellipse cx="192" cy="100" rx="14" ry="6" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="1.5" />
            <path d="M 192 94 Q 250 38 308 100" fill="none" stroke="#0EA5E9" strokeWidth="3.5" strokeDasharray="6 4" />
            <text x="192" y="28" textAnchor="middle" fill="#0369A1" fontSize="12" fontWeight="700">
              القدم كاملة على اللوحة قبل الخط الأحمر
            </text>
          </g>
        )}

        {type === 'board-foul' && (
          <g>
            <ellipse cx="222" cy="100" rx="15" ry="6" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1.5" />
            <line x1="218" y1="60" x2="218" y2="116" stroke="#DC2626" strokeWidth="2" strokeDasharray="4 3" />
            <text x="218" y="45" textAnchor="middle" fill="#DC2626" fontSize="12" fontWeight="700">
              تجاوز الخط الأمامي (منطقة الفاول)
            </text>
          </g>
        )}

        {type === 'pit-forward' && (
          <g>
            <circle cx="405" cy="102" r="7" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
            <path d="M 412 96 L 490 96" stroke="#059669" strokeWidth="3" markerEnd="url(#arrowGreen)" />
            <defs>
              <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#059669" />
              </marker>
            </defs>
            <text x="450" y="76" textAnchor="middle" fill="#047857" fontSize="12" fontWeight="700">
              الخروج للأمام بعد الهبوط
            </text>
          </g>
        )}

        {type === 'pit-back' && (
          <g>
            <circle cx="430" cy="102" r="7" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1.5" />
            <path d="M 422 96 L 348 96" stroke="#DC2626" strokeWidth="3" markerEnd="url(#arrowRed)" />
            <defs>
              <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#DC2626" />
              </marker>
            </defs>
            <text x="415" y="76" textAnchor="middle" fill="#B91C1C" fontSize="12" fontWeight="700">
              المشي للخلف داخل الحفرة
            </text>
          </g>
        )}

        {type === 'sequence-break' && (
          <g>
            <circle cx="192" cy="100" r="6" fill="#0EA5E9" />
            <text x="192" y="84" textAnchor="middle" fill="#0369A1" fontSize="11" fontWeight="700">
              يسار
            </text>
            <path d="M 192 98 Q 250 45 300 98" fill="none" stroke="#DC2626" strokeWidth="3" strokeDasharray="5 4" />
            <circle cx="300" cy="100" r="6" fill="#DC2626" />
            <text x="300" y="84" textAnchor="middle" fill="#B91C1C" fontSize="11" fontWeight="700">
              يمين (تبديل مبكر!)
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export const RulesChallenge: React.FC<RulesChallengeProps> = ({
  muted = false,
  voiceVolume,
  onCompleteRules,
}) => {
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [activeIdx, setActiveIdx] = useState(0);

  const scenario = RULE_SCENARIOS[activeIdx];
  const userChoice = answers[scenario.id];
  const isAnswered = userChoice !== undefined;
  const isCorrect = isAnswered && userChoice === scenario.isLegal;

  const solvedCount = Object.entries(answers).filter(([id, val]) => {
    const found = RULE_SCENARIOS.find((s) => s.id === Number(id));
    return found?.isLegal === val;
  }).length;

  const handleJudge = (choice: boolean) => {
    const next = { ...answers, [scenario.id]: choice };
    setAnswers(next);
    if (choice === scenario.isLegal) {
      playSuccessTone(muted);
    } else {
      playErrorTone(muted);
    }
    if (Object.keys(next).length === RULE_SCENARIOS.length) {
      const totalRight = Object.entries(next).filter(([id, val]) => {
        const found = RULE_SCENARIOS.find((s) => s.id === Number(id));
        return found?.isLegal === val;
      }).length;
      onCompleteRules?.(totalRight, RULE_SCENARIOS.length);
    }
  };

  return (
    <div className="glass-surface rounded-2xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <Scale className="w-5 h-5 text-sky-600" />
          <h3 className="text-lg font-bold text-slate-900">
            تحكيم الميدان: هل المحاولة قانونية أم خطأ؟
          </h3>
        </div>
        <span className="text-sm text-slate-600 tabular-nums">
          قرارات صحيحة: <strong className="text-emerald-700">{solvedCount} / {RULE_SCENARIOS.length}</strong>
        </span>
      </div>

      {/* Scenario Selector */}
      <div className="flex flex-wrap gap-2">
        {RULE_SCENARIOS.map((item, idx) => {
          const ans = answers[item.id];
          const ok = ans !== undefined && ans === item.isLegal;
          const bad = ans !== undefined && ans !== item.isLegal;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                idx === activeIdx
                  ? 'bg-sky-600 text-white border-sky-600'
                  : ok
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : bad
                      ? 'bg-red-50 text-red-800 border-red-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              الحالة {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Scenario Card */}
      <div className="space-y-4">
        <ScenarioDiagram type={scenario.visualType} />

        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-bold text-slate-900">{scenario.title}</h4>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{scenario.description}</p>
          </div>
          <VoiceReadButton
            clipKey={`rule-s-${scenario.id}`}
            text={`${scenario.title}. ${scenario.description}`}
            tone="question"
            volume={voiceVolume}
            label="استماع للحالة"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleJudge(true)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
              userChoice === true
                ? scenario.isLegal
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-red-600 text-white border-red-600'
                : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-400 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>محاولة صحيحة (قانونية)</span>
          </button>

          <button
            type="button"
            onClick={() => handleJudge(false)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
              userChoice === false
                ? !scenario.isLegal
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-red-600 text-white border-red-600'
                : 'bg-white border-slate-200 text-slate-800 hover:border-red-400 hover:bg-red-50'
            }`}
          >
            <XCircle className="w-4 h-4" />
            <span>خطأ قانوني (فاول)</span>
          </button>
        </div>

        {isAnswered && (
          <div
            className={`rounded-xl p-4 border text-sm flex items-start gap-3 ${
              isCorrect
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-orange-50 border-orange-200 text-orange-950'
            }`}
          >
            {isCorrect ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-bold">
                {isCorrect ? 'قرار تحكيمي سليم!' : 'انتبهي لقرار التحكيم:'}
              </div>
              <p className="leading-relaxed">{scenario.ruleExplanation}</p>
            </div>
          </div>
        )}
      </div>

      {/* Key Measurement Note */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
        <strong className="text-slate-900">قاعدة القياس الذهبية: </strong>
        تُقاس المسافة من الحافة الأمامية للوحة الارتقاء إلى أقرب أثر يتركه أي جزء من جسم اللاعبة في حفرة الرمل.
      </div>
    </div>
  );
};

interface ErrorsLabProps {
  muted?: boolean;
  voiceVolume?: number;
  onCompleteErrors?: (correctCount: number, totalCount: number) => void;
}

export const ErrorsLab: React.FC<ErrorsLabProps> = ({
  muted = false,
  voiceVolume,
  onCompleteErrors,
}) => {
  const [selectedFixes, setSelectedFixes] = useState<Record<number, number>>({});

  const handleSelectFix = (caseId: number, optionIdx: number, correctIdx: number) => {
    const next = { ...selectedFixes, [caseId]: optionIdx };
    setSelectedFixes(next);
    if (optionIdx === correctIdx) {
      playSuccessTone(muted);
    } else {
      playErrorTone(muted);
    }
    if (Object.keys(next).length === ERROR_CASES.length) {
      const totalRight = ERROR_CASES.filter(
        (c) => next[c.id] === c.correctOptionIndex
      ).length;
      onCompleteErrors?.(totalRight, ERROR_CASES.length);
    }
  };

  const correctCount = ERROR_CASES.filter(
    (c) => selectedFixes[c.id] === c.correctOptionIndex
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between glass-surface rounded-2xl px-5 py-3.5">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Wrench className="w-4 h-4 text-orange-600" />
          <span>مختبر تصحيح الأخطاء الفنية</span>
        </div>
        <span className="text-sm text-slate-600 tabular-nums">
          تم تصحيح: <strong className="text-emerald-700">{correctCount} / {ERROR_CASES.length}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ERROR_CASES.map((errCase) => {
          const chosen = selectedFixes[errCase.id];
          const isSolved = chosen === errCase.correctOptionIndex;

          return (
            <div
              key={errCase.id}
              className="glass-surface glass-surface-interactive rounded-2xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-sky-700">
                    المرحلة: {errCase.stageLabel}
                  </div>
                  <VoiceReadButton
                    clipKey={`error-c-${errCase.id}`}
                    text={`في مرحلة ${errCase.stageLabel}: ${errCase.wrongBehavior} ما التصحيح الفني الصحيح؟`}
                    tone="question"
                    volume={voiceVolume}
                    label="استماع"
                  />
                </div>

                <div className="bg-red-50/70 border border-red-200 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>الأداء الخاطئ:</span>
                  </div>
                  <p className="text-sm text-slate-800">{errCase.wrongBehavior}</p>
                  <p className="text-xs text-red-700">الأثر: {errCase.consequence}</p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700">اختاري التصحيح الفني الصحيح:</div>
                  {errCase.options.map((opt, idx) => {
                    const isPicked = chosen === idx;
                    const isRight = idx === errCase.correctOptionIndex;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectFix(errCase.id, idx, errCase.correctOptionIndex)}
                        className={`w-full text-right px-3.5 py-2.5 rounded-lg border text-sm transition-colors cursor-pointer ${
                          isPicked
                            ? isRight
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold'
                              : 'bg-red-50 border-red-300 text-red-900'
                            : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-sky-50 hover:border-sky-300'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {chosen !== undefined && (
                <div
                  className={`text-xs rounded-lg p-3 border ${
                    isSolved
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-orange-50 border-orange-200 text-orange-900'
                  }`}
                >
                  {isSolved
                    ? `تصحيح ممتاز! ${errCase.correctFix}`
                    : 'حاولي مرة أخرى، ابحثي عن الخيار الذي يحافظ على التوازن وحماية المفاصل.'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
