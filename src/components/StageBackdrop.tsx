import React, { useEffect, useState } from 'react';
import bgStadiumHomeWebp from '../assets/images/bg_stadium_home_1794563766721.webp';
import bgTrackSpeedWebp from '../assets/images/bg_track_speed_1794563768061.webp';
import bgSandpitJumpWebp from '../assets/images/bg_sandpit_jump_1794563769009.webp';
import bgQuizArenaWebp from '../assets/images/bg_quiz_arena_1794563769192.webp';
import bgPodiumCelebrationWebp from '../assets/images/bg_podium_celebration_1794563768705.webp';

import bgStadiumHomeJpg from '../assets/images/bg_stadium_home_1794563766721.jpg';
import bgTrackSpeedJpg from '../assets/images/bg_track_speed_1794563768061.jpg';
import bgSandpitJumpJpg from '../assets/images/bg_sandpit_jump_1794563769009.jpg';
import bgQuizArenaJpg from '../assets/images/bg_quiz_arena_1794563769192.jpg';
import bgPodiumCelebrationJpg from '../assets/images/bg_podium_celebration_1794563768705.jpg';

export type BackdropSceneId =
  | 'home'
  | 'approach'
  | 'hop'
  | 'step'
  | 'jump'
  | 'quiz'
  | 'achievement';

const SCENE_IMAGES: Record<BackdropSceneId, string> = {
  home: bgStadiumHomeWebp,
  approach: bgTrackSpeedWebp,
  hop: bgTrackSpeedWebp,
  step: bgTrackSpeedWebp,
  jump: bgSandpitJumpWebp,
  quiz: bgQuizArenaWebp,
  achievement: bgPodiumCelebrationWebp,
};

const SCENE_FALLBACK_JPG: Record<BackdropSceneId, string> = {
  home: bgStadiumHomeJpg,
  approach: bgTrackSpeedJpg,
  hop: bgTrackSpeedJpg,
  step: bgTrackSpeedJpg,
  jump: bgSandpitJumpJpg,
  quiz: bgQuizArenaJpg,
  achievement: bgPodiumCelebrationJpg,
};

export function getSceneForStation(stationId: number): BackdropSceneId {
  if (stationId <= 3) return 'home';
  if (stationId === 4) return 'approach';
  if (stationId === 5) return 'hop';
  if (stationId === 6 || stationId === 8 || stationId === 9) return 'step';
  if (stationId === 7) return 'jump';
  if (stationId >= 10 && stationId <= 14) return 'quiz';
  return 'achievement';
}

const LIGHT_PARTICLES = [
  { id: 1, top: '14%', left: '12%', size: 8, delay: '0s', color: '#FFFFFF' },
  { id: 2, top: '22%', left: '78%', size: 10, delay: '1.1s', color: '#38BDF8' },
  { id: 3, top: '38%', left: '24%', size: 7, delay: '2.3s', color: '#FFD700' },
  { id: 4, top: '45%', left: '88%', size: 9, delay: '0.7s', color: '#FFFFFF' },
  { id: 5, top: '62%', left: '10%', size: 11, delay: '1.9s', color: '#38BDF8' },
  { id: 6, top: '68%', left: '72%', size: 8, delay: '3.1s', color: '#FF8500' },
  { id: 7, top: '28%', left: '52%', size: 6, delay: '2.7s', color: '#FFFFFF' },
  { id: 8, top: '76%', left: '42%', size: 9, delay: '1.4s', color: '#38BDF8' },
  { id: 9, top: '18%', left: '36%', size: 7, delay: '3.8s', color: '#FFD700' },
  { id: 10, top: '54%', left: '92%', size: 8, delay: '0.4s', color: '#FFFFFF' },
];

interface StageBackdropProps {
  stationId: number;
  motionEnabled: boolean;
}

export const StageBackdrop: React.FC<StageBackdropProps> = ({
  stationId,
  motionEnabled,
}) => {
  const sceneId = getSceneForStation(stationId);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [fallbackUsed, setFallbackUsed] = useState<Record<string, boolean>>({});

  // Preload WebP backdrops so stage switches are smooth and instant
  useEffect(() => {
    const uniqueUrls = Array.from(new Set(Object.values(SCENE_IMAGES)));
    uniqueUrls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  // Gentle desktop pointer & scroll parallax (automatically disabled if motionEnabled=false)
  useEffect(() => {
    if (!motionEnabled) {
      setParallax({ x: 0, y: 0 });
      return;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let rafId: number | null = null;
    let targetX = 0;
    let targetY = 0;

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        setParallax({ x: targetX, y: targetY });
        rafId = null;
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const nx = (e.clientX / window.innerWidth - 0.5) * -14;
      const ny = (e.clientY / window.innerHeight - 0.5) * -10;
      targetX = nx;
      targetY = ny;
      scheduleUpdate();
    };

    const onScroll = () => {
      const sy = Math.min(20, window.scrollY * -0.025);
      targetY = sy;
      scheduleUpdate();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [motionEnabled]);

  const imgSrc = fallbackUsed[sceneId]
    ? SCENE_FALLBACK_JPG[sceneId]
    : SCENE_IMAGES[sceneId];

  return (
    <div
      aria-hidden="true"
      className={`no-print fixed inset-0 z-0 pointer-events-none overflow-hidden select-none ${
        motionEnabled ? '' : 'reduce-bg-motion'
      }`}
    >
      {/* Base sky & stadium color foundation */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-50" />

      {/* 3D Cartoon Stadium Layer with subtle parallax & smooth scene cross-fade */}
      <div
        className="absolute -inset-6 transition-transform duration-300 ease-out"
        style={{
          transform: motionEnabled
            ? `translate3d(${parallax.x}px, ${parallax.y}px, 0) scale(1.04)`
            : 'translate3d(0, 0, 0) scale(1.02)',
        }}
      >
        <img
          key={sceneId}
          src={imgSrc}
          alt=""
          referrerPolicy="no-referrer"
          onError={() =>
            setFallbackUsed((prev) => ({ ...prev, [sceneId]: true }))
          }
          className="w-full h-full object-cover object-center transition-opacity duration-700"
        />
      </div>

      {/* Soft Drifting Clouds Layer */}
      <svg
        viewBox="0 0 1440 320"
        className="absolute top-0 left-0 w-full h-56 sm:h-72 opacity-50 animate-cloud-drift"
        preserveAspectRatio="none"
      >
        <g fill="#FFFFFF">
          <ellipse cx="220" cy="78" rx="110" ry="30" opacity="0.7" />
          <ellipse cx="265" cy="64" rx="70" ry="28" opacity="0.8" />
          <ellipse cx="740" cy="54" rx="135" ry="32" opacity="0.6" />
          <ellipse cx="790" cy="44" rx="85" ry="26" opacity="0.75" />
          <ellipse cx="1210" cy="88" rx="120" ry="30" opacity="0.65" />
          <ellipse cx="1260" cy="72" rx="75" ry="24" opacity="0.75" />
        </g>
      </svg>

      {/* Stage-specific luminous track overlays */}
      <svg
        viewBox="0 0 1440 800"
        className="absolute inset-0 w-full h-full opacity-55"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="backdropGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Animated luminous track lanes (Approach / Home / Step) */}
        {(sceneId === 'home' || sceneId === 'approach' || sceneId === 'step') && (
          <g fill="none" filter="url(#backdropGlow)">
            <path
              d="M -60 660 Q 420 560 1500 470"
              stroke="#FFFFFF"
              strokeWidth="3"
              className="animate-track-gleam"
            />
            <path
              d="M -60 720 Q 460 605 1500 510"
              stroke="#38BDF8"
              strokeWidth="4"
              className="animate-track-gleam"
              style={{ animationDelay: '1.2s' }}
            />
          </g>
        )}

        {/* Luminous Footprints for Hop stage */}
        {sceneId === 'hop' && (
          <g fill="#38BDF8" filter="url(#backdropGlow)" opacity="0.65">
            <ellipse cx="260" cy="670" rx="26" ry="11" transform="rotate(-12 260 670)" />
            <ellipse cx="560" cy="610" rx="26" ry="11" transform="rotate(-10 560 610)" />
            <ellipse cx="890" cy="555" rx="26" ry="11" transform="rotate(-8 890 555)" />
            <path
              d="M 260 670 Q 410 540 560 610 Q 725 490 890 555"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="4"
              className="animate-track-gleam"
            />
          </g>
        )}

        {/* Dual-color step transition arcs for Step & Footmap */}
        {sceneId === 'step' && (
          <g fill="none" filter="url(#backdropGlow)">
            <path
              d="M 180 650 Q 480 460 760 580"
              stroke="#38BDF8"
              strokeWidth="4.5"
              className="animate-track-gleam"
            />
            <path
              d="M 760 580 Q 1040 430 1320 540"
              stroke="#FF8500"
              strokeWidth="4.5"
              className="animate-track-gleam"
              style={{ animationDelay: '0.8s' }}
            />
          </g>
        )}

        {/* Twinkling Golden Stars for Quiz & Achievement Podium */}
        {(sceneId === 'quiz' || sceneId === 'achievement') && (
          <g fill="#FFD700" filter="url(#backdropGlow)">
            <circle cx="160" cy="180" r="6" className="animate-star-twinkle" />
            <circle
              cx="1280"
              cy="190"
              r="7"
              className="animate-star-twinkle"
              style={{ animationDelay: '1.1s' }}
            />
            <circle
              cx="320"
              cy="120"
              r="5"
              className="animate-star-twinkle"
              style={{ animationDelay: '2.2s' }}
            />
            <circle
              cx="1120"
              cy="130"
              r="5.5"
              className="animate-star-twinkle"
              style={{ animationDelay: '0.6s' }}
            />
          </g>
        )}
      </svg>

      {/* Calm Floating Light Particles */}
      <div className="absolute inset-0">
        {LIGHT_PARTICLES.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full animate-particle-float"
            style={{
              top: p.top,
              left: p.left,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              animationDelay: p.delay,
              boxShadow: `0 0 12px ${p.color}`,
            }}
          />
        ))}
      </div>

      {/* Balanced Daylight Contrast Scrim so Arabic text over glass cards remains razor-sharp */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50/48 via-slate-50/40 to-slate-900/20" />
    </div>
  );
};
