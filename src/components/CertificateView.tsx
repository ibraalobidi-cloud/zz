import React, { useState } from 'react';
import { Award, Printer } from 'lucide-react';
import { ASSET_PATHS } from '../data/lessonData';

interface CertificateViewProps {
  studentName: string;
  onChangeName: (name: string) => void;
  completedStationsCount: number;
  quizScorePercent: number;
  footMapScore: number;
}

export const CertificateView: React.FC<CertificateViewProps> = ({
  studentName,
  onChangeName,
  completedStationsCount,
  quizScorePercent,
  footMapScore,
}) => {
  const [emblemError, setEmblemError] = useState(false);

  const formattedDate = new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const displayName = studentName.trim() || 'البطلة المتميزة';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Controls bar (hidden in print) */}
      <div className="no-print glass-surface rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <label htmlFor="cert-name-input" className="text-sm font-bold text-slate-800 whitespace-nowrap">
            اسم الطالبة في الشهادة:
          </label>
          <input
            id="cert-name-input"
            type="text"
            value={studentName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="اكتبي اسمكِ الثلاثي هنا..."
            className="w-full sm:max-w-xs px-3.5 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة الشهادة / حفظ PDF</span>
        </button>
      </div>

      {/* Printable Certificate Canvas */}
      <div className="print-only-area glass-surface border-2 border-amber-400/70 rounded-2xl p-6 sm:p-10 relative overflow-hidden">
        {/* Clean corner accent lines */}
        <div className="border border-orange-300 rounded-xl p-6 sm:p-10 bg-gradient-to-b from-sky-50/40 via-white to-emerald-50/30">
          <div className="flex flex-col items-center text-center space-y-5">
            {/* Emblem */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center p-1">
              {!emblemError ? (
                <img
                  src={ASSET_PATHS.certificateEmblem}
                  alt="وسام التميز الرياضي"
                  referrerPolicy="no-referrer"
                  onError={() => setEmblemError(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Award className="w-12 h-12 text-orange-500" />
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs sm:text-sm font-semibold text-sky-700">
                التربية البدنية والدفاع عن النفس · الصف السادس الابتدائي
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-slate-900">
                شهادة إتمام تحدي الأبطال
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                في مهارة الوثب الثلاثي ومسابقات ألعاب القوى
              </p>
            </div>

            <div className="w-24 h-0.5 bg-orange-400" />

            <div className="space-y-2 max-w-2xl">
              <p className="text-sm sm:text-base text-slate-700">
                تُمنح هذه الشهادة بكل فخر وتقدير إلى البطلة:
              </p>
              <div className="text-2xl sm:text-3xl font-bold text-sky-700 py-2 px-6 border-b-2 border-sky-200 inline-block">
                {displayName}
              </div>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed pt-2">
                تقديراً لإتمامها الرحلة التعليمية التفاعلية لمهارة{' '}
                <strong className="text-slate-900">الوثب الثلاثي</strong>{' '}
                (الاقتراب ← الحجلة ← الخطوة ← القفز والهبوط)، والتزامها بقوانين الميدان والسلامة الرياضية.
              </p>
            </div>

            {/* Achievement Metrics Summary */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 w-full max-w-xl pt-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
                <div className="text-xs text-slate-500">المحطات المنجزة</div>
                <div className="text-lg sm:text-xl font-bold text-sky-700 tabular-nums mt-1">
                  {completedStationsCount} / 15
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
                <div className="text-xs text-slate-500">خريطة الأقدام</div>
                <div className="text-lg sm:text-xl font-bold text-orange-600 tabular-nums mt-1">
                  {footMapScore}%
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
                <div className="text-xs text-slate-500">الاختبار التفاعلي</div>
                <div className="text-lg sm:text-xl font-bold text-emerald-700 tabular-nums mt-1">
                  {quizScorePercent}%
                </div>
              </div>
            </div>

            {/* Signatures & Date */}
            <div className="w-full max-w-2xl pt-6 border-t border-slate-200 grid grid-cols-2 gap-6 text-xs sm:text-sm text-slate-600">
              <div>
                <div className="font-bold text-slate-800">التاريخ</div>
                <div className="mt-1">{formattedDate}</div>
              </div>
              <div>
                <div className="font-bold text-slate-800">إشراف معلمة التربية البدنية</div>
                <div className="mt-1 text-sky-700 font-bold">المعلمة: عزيزة العنزي</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
