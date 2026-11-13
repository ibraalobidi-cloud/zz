import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { playStepTone, playSuccessTone } from '../utils/audio';

export type SimFocusPhase = 'all' | 'approach' | 'hop' | 'step' | 'jump';

interface InteractiveTrackSimProps {
  focusPhase?: SimFocusPhase;
  muted?: boolean;
  onCompleteRun?: () => void;
}

interface Point {
  x: number;
  y: number;
}

function quadBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

export const InteractiveTrackSim: React.FC<InteractiveTrackSimProps> = ({
  focusPhase = 'all',
  muted = false,
  onCompleteRun,
}) => {
  const [startFoot, setStartFoot] = useState<'left' | 'right'>('left');
  const [speed, setSpeed] = useState<number>(6.8); // m/s
  const [takeoffAngle, setTakeoffAngle] = useState<number>(22); // degrees
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(() => {
    if (focusPhase === 'approach') return 0.14;
    if (focusPhase === 'hop') return 0.36;
    if (focusPhase === 'step') return 0.6;
    if (focusPhase === 'jump') return 0.86;
    return 0;
  });

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const triggeredMilestonesRef = useRef<Set<number>>(new Set());

  // Reset initial progress when switching phase station
  useEffect(() => {
    setIsPlaying(false);
    triggeredMilestonesRef.current.clear();
    if (focusPhase === 'approach') setProgress(0.14);
    else if (focusPhase === 'hop') setProgress(0.36);
    else if (focusPhase === 'step') setProgress(0.6);
    else if (focusPhase === 'jump') setProgress(0.86);
    else setProgress(0);
  }, [focusPhase]);

  const hopFootLabel = startFoot === 'left' ? 'يسار' : 'يمين';
  const stepFootLabel = startFoot === 'left' ? 'يمين' : 'يسار';

  // Compute simulated distance based on speed and angle
  const estimatedDistance = useMemo(() => {
    const angleFactor = 1 - Math.abs(takeoffAngle - 22) * 0.012;
    const dist = (speed * 1.15 + 0.8) * Math.max(0.75, angleFactor);
    return dist.toFixed(2);
  }, [speed, takeoffAngle]);

  // SVG coordinates (left-to-right runway geometry inside viewBox 0 0 880 280)
  const trackY = 208;
  const xStart = 44;
  const xBoard = 236;
  const hopSpan = 138 + (speed - 5) * 8;
  const xHopLand = xBoard + hopSpan;
  const stepSpan = 152 + (speed - 5) * 9;
  const xStepLand = xHopLand + stepSpan;
  const jumpSpan = 178 + (speed - 5) * 12 + (takeoffAngle - 16) * 2;
  const xJumpLand = Math.min(826, xStepLand + jumpSpan);

  const hopPeakY = trackY - (64 + (takeoffAngle - 15) * 1.2);
  const stepPeakY = trackY - (74 + (takeoffAngle - 15) * 1.4);
  const jumpPeakY = trackY - (108 + (takeoffAngle - 15) * 2.1);

  const runnerPos = useMemo<Point>(() => {
    if (progress <= 0.25) {
      const localT = progress / 0.25;
      return {
        x: xStart + (xBoard - xStart) * localT,
        y: trackY - Math.abs(Math.sin(localT * Math.PI * 6)) * 5,
      };
    }
    if (progress <= 0.5) {
      const localT = (progress - 0.25) / 0.25;
      return quadBezier(
        { x: xBoard, y: trackY },
        { x: (xBoard + xHopLand) / 2, y: hopPeakY - 34 },
        { x: xHopLand, y: trackY },
        localT
      );
    }
    if (progress <= 0.75) {
      const localT = (progress - 0.5) / 0.25;
      return quadBezier(
        { x: xHopLand, y: trackY },
        { x: (xHopLand + xStepLand) / 2, y: stepPeakY - 38 },
        { x: xStepLand, y: trackY },
        localT
      );
    }
    const localT = Math.min(1, (progress - 0.75) / 0.25);
    return quadBezier(
      { x: xStepLand, y: trackY },
      { x: (xStepLand + xJumpLand) / 2, y: jumpPeakY - 52 },
      { x: xJumpLand, y: trackY + 2 },
      localT
    );
  }, [
    progress,
    xStart,
    xBoard,
    xHopLand,
    xStepLand,
    xJumpLand,
    hopPeakY,
    stepPeakY,
    jumpPeakY,
  ]);

  const activeStageIndex =
    progress < 0.25 ? 0 : progress < 0.5 ? 1 : progress < 0.75 ? 2 : 3;

  const stageNames = [
    '١. الاقتراب: جري متسارع نحو اللوحة',
    `٢. الحجلة: ارتقاء وهبوط (${hopFootLabel} ← ${hopFootLabel})`,
    `٣. الخطوة: تبديل القدم (${hopFootLabel} ← ${stepFootLabel})`,
    '٤. القفز والهبوط: كلتا القدمين في الرمل',
  ];

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
      return;
    }

    const durationMs = Math.max(2400, 4200 - (speed - 5) * 320);

    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      setProgress((prev) => {
        const next = Math.min(1, prev + delta / durationMs);
        // Milestone sound effects
        const milestones = [0.25, 0.5, 0.75, 0.99];
        milestones.forEach((m, idx) => {
          if (next >= m && !triggeredMilestonesRef.current.has(idx)) {
            triggeredMilestonesRef.current.add(idx);
            if (idx === 3) {
              playSuccessTone(muted);
              onCompleteRun?.();
            } else {
              playStepTone(idx + 1, muted);
            }
          }
        });

        if (next >= 1) {
          setIsPlaying(false);
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, speed, muted, onCompleteRun]);

  const handleTogglePlay = () => {
    if (progress >= 0.99) {
      triggeredMilestonesRef.current.clear();
      setProgress(0);
      setIsPlaying(true);
      playStepTone(0, muted);
    } else {
      setIsPlaying((p) => !p);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    triggeredMilestonesRef.current.clear();
    setProgress(0);
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    const stops = [0.12, 0.37, 0.62, 0.88, 1];
    const nextStop = stops.find((s) => s > progress + 0.03) ?? 0.12;
    const idx = stops.indexOf(nextStop);
    playStepTone(idx, muted);
    setProgress(nextStop);
    if (nextStop >= 0.99) {
      onCompleteRun?.();
    }
  };

  return (
    <div className="glass-surface rounded-2xl overflow-hidden">
      {/* Top stage info bar */}
      <div className="px-4 sm:px-6 py-3.5 bg-white/60 border-b border-sky-200/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-900">
            {stageNames[activeStageIndex]}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-600 tabular-nums">
          <span>
            السرعة: <strong className="text-slate-900">{speed.toFixed(1)} م/ث</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            الزاوية: <strong className="text-slate-900">{takeoffAngle}°</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            المسافة المتوقعة:{' '}
            <strong className="text-emerald-700">{estimatedDistance} م</strong>
          </span>
        </div>
      </div>

      {/* Interactive SVG Track & Luminous Arcs (LTR geometry inside RTL UI so left->right motion feels natural on track) */}
      <div className="p-3 sm:p-5 bg-gradient-to-b from-sky-50/70 to-white">
        <div dir="ltr" className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
          <svg
            viewBox="0 0 880 280"
            className="w-full h-auto block"
            role="img"
            aria-label="محاكاة مضمار الوثب الثلاثي والمسارات الضوئية"
          >
            <defs>
              <linearGradient id="skyBg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F0F9FF" />
                <stop offset="100%" stopColor="#FFFFFF" />
              </linearGradient>
              <linearGradient id="sandGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="100%" stopColor="#FCD34D" />
              </linearGradient>
              <filter id="glowSoft" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Sky backdrop */}
            <rect x="0" y="0" width="880" height="208" fill="url(#skyBg)" />

            {/* Distance guide grid */}
            <g stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4">
              <line x1={xBoard} y1="36" x2={xBoard} y2={trackY} />
              <line x1={xHopLand} y1="48" x2={xHopLand} y2={trackY} />
              <line x1={xStepLand} y1="48" x2={xStepLand} y2={trackY} />
            </g>

            {/* Track surface */}
            <rect x="0" y={trackY} width="590" height="72" fill="#E05D38" />
            <rect x="0" y={trackY} width="590" height="5" fill="#F8FAFC" opacity="0.7" />
            <line x1="0" y1={trackY + 38} x2="590" y2={trackY + 38} stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="2" />

            {/* Takeoff board */}
            <rect x={xBoard - 10} y={trackY} width="20" height="10" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
            <rect x={xBoard + 10} y={trackY} width="6" height="10" fill="#DC2626" />
            <text x={xBoard} y={trackY + 26} textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700">
              لوحة الارتقاء
            </text>

            {/* Sand pit */}
            <rect x="590" y={trackY} width="272" height="44" rx="4" fill="url(#sandGrad)" stroke="#D97706" strokeWidth="2" />
            <rect x="590" y={trackY + 44} width="290" height="28" fill="#CBD5E1" />
            <text x="726" y={trackY + 27} textAnchor="middle" fill="#92400E" fontSize="13" fontWeight="700">
              حفرة الرمل
            </text>

            {/* Approach luminous line */}
            <line
              x1={xStart}
              y1={trackY - 4}
              x2={xBoard}
              y2={trackY - 4}
              stroke="#475569"
              strokeWidth={activeStageIndex === 0 ? 5 : 3}
              strokeDasharray="8 6"
              opacity={focusPhase === 'all' || focusPhase === 'approach' ? 0.95 : 0.3}
            />

            {/* Hop luminous sky-blue arc */}
            <path
              d={`M ${xBoard} ${trackY} Q ${(xBoard + xHopLand) / 2} ${hopPeakY - 34} ${xHopLand} ${trackY}`}
              fill="none"
              stroke="#0EA5E9"
              strokeWidth={activeStageIndex === 1 ? 6 : 4}
              filter="url(#glowSoft)"
              className={activeStageIndex === 1 ? 'animate-dash-flow' : ''}
              opacity={focusPhase === 'all' || focusPhase === 'hop' ? 1 : 0.25}
            />

            {/* Step luminous orange arc */}
            <path
              d={`M ${xHopLand} ${trackY} Q ${(xHopLand + xStepLand) / 2} ${stepPeakY - 38} ${xStepLand} ${trackY}`}
              fill="none"
              stroke="#F97316"
              strokeWidth={activeStageIndex === 2 ? 6 : 4}
              filter="url(#glowSoft)"
              className={activeStageIndex === 2 ? 'animate-dash-flow' : ''}
              opacity={focusPhase === 'all' || focusPhase === 'step' ? 1 : 0.25}
            />

            {/* Jump luminous emerald arc */}
            <path
              d={`M ${xStepLand} ${trackY} Q ${(xStepLand + xJumpLand) / 2} ${jumpPeakY - 52} ${xJumpLand} ${trackY + 2}`}
              fill="none"
              stroke="#10B981"
              strokeWidth={activeStageIndex === 3 ? 6 : 4}
              filter="url(#glowSoft)"
              className={activeStageIndex === 3 ? 'animate-dash-flow' : ''}
              opacity={focusPhase === 'all' || focusPhase === 'jump' ? 1 : 0.25}
            />

            {/* Phase labels */}
            <g fontSize="12" fontWeight="700" textAnchor="middle">
              <text x={(xStart + xBoard) / 2} y={trackY - 22} fill="#334155">
                ١. الاقتراب
              </text>
              <text x={(xBoard + xHopLand) / 2} y={hopPeakY - 12} fill="#0284C7">
                ٢. الحجلة ({hopFootLabel})
              </text>
              <text x={(xHopLand + xStepLand) / 2} y={stepPeakY - 16} fill="#EA580C">
                ٣. الخطوة ({stepFootLabel})
              </text>
              <text x={(xStepLand + xJumpLand) / 2} y={jumpPeakY - 24} fill="#059669">
                ٤. القفز والهبوط (كلتاهما)
              </text>
            </g>

            {/* Foot contact markers */}
            <g fontSize="11" fontWeight="600" textAnchor="middle">
              <circle cx={xBoard} cy={trackY} r="6" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx={xHopLand} cy={trackY} r="6" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="2" />
              <text x={xHopLand} y={trackY + 26} fill="#FFFFFF">
                {hopFootLabel}
              </text>

              <circle cx={xStepLand} cy={trackY} r="6" fill="#F97316" stroke="#FFFFFF" strokeWidth="2" />
              <text x={xStepLand} y={trackY + 26} fill="#FFFFFF">
                {stepFootLabel}
              </text>

              <circle cx={xJumpLand} cy={trackY + 2} r="7" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
            </g>

            {/* Animated Athlete Figure */}
            <g transform={`translate(${runnerPos.x}, ${runnerPos.y})`}>
              {/* Shadow */}
              <ellipse cx="0" cy={Math.max(4, trackY - runnerPos.y)} rx="12" ry="4" fill="#0F172A" opacity="0.18" />
              {/* Stylized athlete silhouette */}
              <g transform="translate(0, -28)">
                {/* Legs */}
                <path
                  d={
                    activeStageIndex === 3 && progress > 0.9
                      ? 'M -4 14 L 8 24 M 2 14 L 12 24'
                      : 'M -3 14 L -10 26 M 3 14 L 11 22'
                  }
                  stroke="#0F172A"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                {/* Torso (sky-blue jersey) */}
                <rect x="-7" y="-2" width="14" height="17" rx="5" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="1.5" />
                {/* Arms (orange accent) */}
                <path
                  d={activeStageIndex === 3 ? 'M 3 2 L 15 -8' : 'M -4 3 L -12 8 M 4 3 L 13 0'}
                  stroke="#F97316"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                {/* Head + white headscarf */}
                <circle cx="0" cy="-10" r="8" fill="#FFFFFF" stroke="#0284C7" strokeWidth="1.5" />
                <circle cx="2" cy="-10" r="4.5" fill="#FDBA74" />
              </g>
            </g>
          </svg>
        </div>
      </div>

      {/* Controls Deck */}
      <div className="px-4 sm:px-6 pb-5 pt-2 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-t border-slate-100">
        {/* Playback buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? 'إيقاف مؤقت' : progress >= 0.99 ? 'إعادة المحاكاة' : 'تشغيل الحركة'}</span>
          </button>

          <button
            type="button"
            onClick={handleStepForward}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-100 text-slate-800 text-sm font-medium hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <SkipForward className="w-4 h-4" />
            <span>المرحلة التالية</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة ضبط</span>
          </button>
        </div>

        {/* Parameters: Starting Foot + Speed + Angle */}
        <div className="flex flex-wrap items-center gap-5">
          {/* Foot Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">قدم البداية:</span>
            <div className="inline-flex p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setStartFoot('left')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  startFoot === 'left'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                اليسرى
              </button>
              <button
                type="button"
                onClick={() => setStartFoot('right')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  startFoot === 'right'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                اليمنى
              </button>
            </div>
          </div>

          {/* Speed Slider */}
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <span className="font-semibold whitespace-nowrap">سرعة الاقتراب:</span>
            <input
              type="range"
              min={5.0}
              max={8.5}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-24 accent-sky-600 cursor-pointer"
            />
            <span className="tabular-nums font-semibold text-slate-900 w-14">
              {speed.toFixed(1)} م/ث
            </span>
          </label>

          {/* Angle Slider */}
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <span className="font-semibold whitespace-nowrap">زاوية الارتقاء:</span>
            <input
              type="range"
              min={16}
              max={28}
              step={1}
              value={takeoffAngle}
              onChange={(e) => setTakeoffAngle(parseInt(e.target.value, 10))}
              className="w-20 accent-orange-500 cursor-pointer"
            />
            <span className="tabular-nums font-semibold text-slate-900 w-9">
              {takeoffAngle}°
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
