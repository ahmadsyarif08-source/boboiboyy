import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Layers, Orbit, RotateCw, Sparkles, SplitSquareHorizontal } from 'lucide-react';
import {
  BRAND_LOGOS,
  getPrimaryPackSeriesForCard,
  isCardModified,
  resolveCardHologramFinish,
} from '../data/cards';
import {
  CardCategory,
  type CardDefinition,
  type CardRank,
  type HologramFinish,
} from '../types/game';
import { soundFx } from '../utils/sound';

type TiltStep = -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5;

const PITCH_CLASS_MAP: Record<TiltStep, string> = {
  [-5]: 'tilt-rx-n5',
  [-4]: 'tilt-rx-n4',
  [-3]: 'tilt-rx-n3',
  [-2]: 'tilt-rx-n2',
  [-1]: 'tilt-rx-n1',
  [0]: 'tilt-rx-0',
  [1]: 'tilt-rx-p1',
  [2]: 'tilt-rx-p2',
  [3]: 'tilt-rx-p3',
  [4]: 'tilt-rx-p4',
  [5]: 'tilt-rx-p5',
};

const YAW_FRONT_CLASS_MAP: Record<TiltStep, string> = {
  [-5]: 'tilt-ry-n5',
  [-4]: 'tilt-ry-n4',
  [-3]: 'tilt-ry-n3',
  [-2]: 'tilt-ry-n2',
  [-1]: 'tilt-ry-n1',
  [0]: 'tilt-ry-0',
  [1]: 'tilt-ry-p1',
  [2]: 'tilt-ry-p2',
  [3]: 'tilt-ry-p3',
  [4]: 'tilt-ry-p4',
  [5]: 'tilt-ry-p5',
};

const YAW_BACK_CLASS_MAP: Record<TiltStep, string> = {
  [-5]: 'tilt-ry-flip-n5',
  [-4]: 'tilt-ry-flip-n4',
  [-3]: 'tilt-ry-flip-n3',
  [-2]: 'tilt-ry-flip-n2',
  [-1]: 'tilt-ry-flip-n1',
  [0]: 'tilt-ry-flip-0',
  [1]: 'tilt-ry-flip-p1',
  [2]: 'tilt-ry-flip-p2',
  [3]: 'tilt-ry-flip-p3',
  [4]: 'tilt-ry-flip-p4',
  [5]: 'tilt-ry-flip-p5',
};

export type FoilFinishMode = 'PRISM' | 'SOLAR' | 'FROST' | 'GALAXY' | 'OFF';
export type ShowcaseMotionMode = 'INTERACTIVE' | 'ORBIT' | 'SPIN360';

function mapHologramFinishToFoilMode(finish: HologramFinish): FoilFinishMode {
  switch (finish) {
    case 'RAINBOW_PRISM':
      return 'PRISM';
    case 'SOLAR_GOLD':
      return 'SOLAR';
    case 'CRYO_FROST':
      return 'FROST';
    case 'STARDUST_GALAXY':
      return 'GALAXY';
    default:
      return 'OFF';
  }
}

function quantizeTilt(normalizedMinusOneToOne: number): TiltStep {
  const clamped = Math.max(-1, Math.min(1, normalizedMinusOneToOne));
  const raw = Math.round(clamped * 5);
  return Math.max(-5, Math.min(5, raw)) as TiltStep;
}

function getRankPalette(rank: CardRank): {
  rimBorder: string;
  rimBg: string;
  pedestalRgb: [number, number, number];
  secondaryRgb: [number, number, number];
  rankText: string;
} {
  switch (rank) {
    case 'SR':
      return {
        rimBorder: 'border-amber-300/90',
        rimBg: 'bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700',
        pedestalRgb: [251, 191, 36],
        secondaryRgb: [56, 189, 248],
        rankText: 'text-amber-300',
      };
    case 'AR':
      return {
        rimBorder: 'border-rose-400/90',
        rimBg: 'bg-gradient-to-br from-rose-300 via-fuchsia-500 to-rose-700',
        pedestalRgb: [251, 113, 133],
        secondaryRgb: [232, 121, 249],
        rankText: 'text-rose-300',
      };
    case 'S':
      return {
        rimBorder: 'border-sky-300/90',
        rimBg: 'bg-gradient-to-br from-sky-300 via-cyan-400 to-blue-700',
        pedestalRgb: [56, 189, 248],
        secondaryRgb: [129, 140, 248],
        rankText: 'text-sky-300',
      };
    case 'A':
      return {
        rimBorder: 'border-emerald-400/85',
        rimBg: 'bg-gradient-to-br from-emerald-300 via-teal-500 to-emerald-800',
        pedestalRgb: [52, 211, 153],
        secondaryRgb: [56, 189, 248],
        rankText: 'text-emerald-300',
      };
    case 'SUPPORT':
      return {
        rimBorder: 'border-teal-400/85',
        rimBg: 'bg-gradient-to-br from-teal-300 via-cyan-500 to-slate-800',
        pedestalRgb: [45, 212, 191],
        secondaryRgb: [251, 191, 36],
        rankText: 'text-teal-300',
      };
    default:
      return {
        rimBorder: 'border-slate-400/75',
        rimBg: 'bg-gradient-to-br from-slate-300 via-slate-500 to-slate-800',
        pedestalRgb: [148, 163, 184],
        secondaryRgb: [56, 189, 248],
        rankText: 'text-slate-200',
      };
  }
}

interface InteractiveCard3DTiltProps {
  children: React.ReactNode;
  rank?: CardRank;
  hologramFinish?: HologramFinish;
  disabled?: boolean;
  className?: string;
}

/**
 * Lightweight 3D Pointer-Tracking Tilt & Specular Foil Wrapper for Grid / Gallery Cards.
 * Runs 0% background loops when idle; activates smooth 60fps specular sheen only while hovered.
 */
export const InteractiveCard3DTilt: React.FC<InteractiveCard3DTiltProps> = ({
  children,
  rank = 'B',
  hologramFinish,
  disabled = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ nx: number; ny: number; hovered: boolean }>({
    nx: 0.5,
    ny: 0.5,
    hovered: false,
  });
  const rafRef = useRef<number | null>(null);

  const [pitchStep, setPitchStep] = useState<TiltStep>(0);
  const [yawStep, setYawStep] = useState<TiltStep>(0);
  const [isHovered, setIsHovered] = useState(false);

  const effectiveHolo: HologramFinish =
    hologramFinish ??
    (rank === 'SR'
      ? 'RAINBOW_PRISM'
      : rank === 'AR'
      ? 'STARDUST_GALAXY'
      : rank === 'S'
      ? 'SOLAR_GOLD'
      : 'NONE');

  const drawHoverGlint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!pointerRef.current.hovered) return;

    const { nx, ny } = pointerRef.current;
    const gx = nx * w;
    const gy = ny * h;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Specular light spot
    const rad = ctx.createRadialGradient(gx, gy, 4, gx, gy, Math.max(w, h) * 0.72);
    rad.addColorStop(0, effectiveHolo !== 'NONE' ? 'rgba(255, 255, 255, 0.34)' : 'rgba(255, 255, 255, 0.22)');
    rad.addColorStop(0.45, 'rgba(255, 255, 255, 0.06)');
    rad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);

    // Dynamic holographic diagonal band ONLY for cards with an active HologramFinish
    if (effectiveHolo !== 'NONE') {
      const shift = (nx + ny) * 0.5;
      const diag = ctx.createLinearGradient(
        -w * 0.3 + shift * w * 0.6,
        0,
        w * 1.1 + shift * w * 0.4,
        h
      );
      diag.addColorStop(0, 'rgba(255,255,255,0)');
      if (effectiveHolo === 'RAINBOW_PRISM') {
        diag.addColorStop(0.28, 'rgba(56, 189, 248, 0.20)');
        diag.addColorStop(0.46, 'rgba(251, 191, 36, 0.24)');
        diag.addColorStop(0.64, 'rgba(244, 114, 182, 0.20)');
        diag.addColorStop(0.8, 'rgba(52, 211, 153, 0.16)');
      } else if (effectiveHolo === 'SOLAR_GOLD') {
        diag.addColorStop(0.35, 'rgba(245, 158, 11, 0.20)');
        diag.addColorStop(0.5, 'rgba(254, 243, 199, 0.28)');
        diag.addColorStop(0.68, 'rgba(249, 115, 22, 0.18)');
      } else if (effectiveHolo === 'CRYO_FROST') {
        diag.addColorStop(0.35, 'rgba(56, 189, 248, 0.22)');
        diag.addColorStop(0.5, 'rgba(224, 242, 254, 0.28)');
        diag.addColorStop(0.68, 'rgba(99, 102, 241, 0.18)');
      } else {
        diag.addColorStop(0.32, 'rgba(192, 132, 252, 0.22)');
        diag.addColorStop(0.5, 'rgba(244, 114, 182, 0.26)');
        diag.addColorStop(0.68, 'rgba(56, 189, 248, 0.18)');
      }
      diag.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = diag;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }, [effectiveHolo]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      drawHoverGlint();
    });
  }, [drawHoverGlint]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    pointerRef.current = { nx, ny, hovered: true };

    const nextYaw = quantizeTilt((nx - 0.5) * 2);
    const nextPitch = quantizeTilt((0.5 - ny) * 2);

    if (nextPitch !== pitchStep) setPitchStep(nextPitch);
    if (nextYaw !== yawStep) setYawStep(nextYaw);
    if (!isHovered) setIsHovered(true);
    scheduleDraw();
  };

  const handlePointerLeave = () => {
    pointerRef.current.hovered = false;
    setPitchStep(0);
    setYawStep(0);
    setIsHovered(false);
    scheduleDraw();
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`card-grid-perspective ${className}`}
    >
      <div className={`tilt-pitch-smooth ${PITCH_CLASS_MAP[pitchStep]}`}>
        <div className={`tilt-yaw-fast relative ${YAW_FRONT_CLASS_MAP[yawStep]}`}>
          {children}
          <canvas
            ref={canvasRef}
            width={180}
            height={252}
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 w-full h-full rounded-xl transition-opacity duration-150 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export interface Card3DShowcaseProps {
  card: CardDefinition;
  compact?: boolean;
}

/**
 * Full Interactive 3D Card Display Stage with:
 * - Pointer & touch 3D tilt physics (nested preserve-3d pitch & yaw wrappers)
 * - Autonomous 3D Showroom Orbit & 360° Turntable Spin modes
 * - True 180° Front / Back card inspection with physical slab rim thickness
 * - 60fps HTML5 Canvas Holographic Prism / Solar Gold / Frost Crystal foil shader
 * - Floating 3D Parallax tactical badge overlay & 3D perspective energy pedestal
 */
export const Card3DShowcase: React.FC<Card3DShowcaseProps> = ({
  card,
  compact = false,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const foilCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pedestalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const resolvedCardHolo = resolveCardHologramFinish(card);

  const [motionMode, setMotionMode] = useState<ShowcaseMotionMode>('INTERACTIVE');
  const [showBackFace, setShowBackFace] = useState<boolean>(false);
  const [foilMode, setFoilMode] = useState<FoilFinishMode>(() =>
    mapHologramFinishToFoilMode(resolvedCardHolo)
  );
  const [showParallaxHud, setShowParallaxHud] = useState<boolean>(true);
  const [pitchStep, setPitchStep] = useState<TiltStep>(1);
  const [yawStep, setYawStep] = useState<TiltStep>(-2);

  const pointerStateRef = useRef<{ nx: number; ny: number; active: boolean }>({
    nx: 0.35,
    ny: 0.32,
    active: false,
  });

  // Reset flip state when switching inspected card, sync foil finish to card's hologram setting
  useEffect(() => {
    setShowBackFace(false);
    setFoilMode(mapHologramFinishToFoilMode(resolvedCardHolo));
  }, [card.id, resolvedCardHolo]);

  const palette = getRankPalette(card.rank);
  const packSeries = getPrimaryPackSeriesForCard(card);
  const modifiedBuiltIn = !card.isCustom && isCardModified(card.id);
  const showCustomOverlay = Boolean(card.isCustom && card.showCustomOverlay !== false);

  // 60fps Holographic Foil Shader + 3D Energy Pedestal Canvas Loop
  useEffect(() => {
    let rafId = 0;
    const sparkles = Array.from({ length: 18 }, (_, idx) => ({
      x: ((idx * 37) % 94) / 100 + 0.03,
      y: ((idx * 53) % 92) / 100 + 0.04,
      phase: idx * 0.7,
      size: 1.6 + (idx % 3) * 0.9,
    }));

    const renderFrame = (now: number) => {
      const t = now * 0.001;

      // 1. Render Holographic Foil & Specular Glare on Card Front
      const foilCanvas = foilCanvasRef.current;
      if (foilCanvas) {
        const ctx = foilCanvas.getContext('2d');
        if (ctx) {
          const w = foilCanvas.width;
          const h = foilCanvas.height;
          ctx.clearRect(0, 0, w, h);

          if (foilMode !== 'OFF') {
            const p = pointerStateRef.current;
            const nx =
              motionMode === 'INTERACTIVE' && p.active
                ? p.nx
                : 0.5 + Math.sin(t * 1.35) * 0.34;
            const ny =
              motionMode === 'INTERACTIVE' && p.active
                ? p.ny
                : 0.45 + Math.cos(t * 1.05) * 0.28;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            // Primary dynamic specular spotlight
            const gx = nx * w;
            const gy = ny * h;
            const spot = ctx.createRadialGradient(gx, gy, 6, gx, gy, Math.max(w, h) * 0.78);
            spot.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
            spot.addColorStop(0.28, 'rgba(255, 255, 255, 0.11)');
            spot.addColorStop(1, 'rgba(15, 23, 42, 0)');
            ctx.fillStyle = spot;
            ctx.fillRect(0, 0, w, h);

            // Diagonal Foil Sheen Bands
            const bandOffset = (nx - 0.5) * w * 1.1 + (ny - 0.5) * h * 0.5;
            const foilGrad = ctx.createLinearGradient(
              -w * 0.45 + bandOffset,
              0,
              w * 1.25 + bandOffset * 0.55,
              h
            );

            if (foilMode === 'PRISM') {
              foilGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
              foilGrad.addColorStop(0.22, 'rgba(56, 189, 248, 0.16)');
              foilGrad.addColorStop(0.38, 'rgba(251, 191, 36, 0.22)');
              foilGrad.addColorStop(0.52, 'rgba(244, 114, 182, 0.20)');
              foilGrad.addColorStop(0.68, 'rgba(52, 211, 153, 0.16)');
              foilGrad.addColorStop(0.84, 'rgba(129, 140, 248, 0.14)');
              foilGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            } else if (foilMode === 'SOLAR') {
              foilGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
              foilGrad.addColorStop(0.35, 'rgba(245, 158, 11, 0.14)');
              foilGrad.addColorStop(0.5, 'rgba(254, 243, 199, 0.26)');
              foilGrad.addColorStop(0.65, 'rgba(251, 191, 36, 0.14)');
              foilGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            } else if (foilMode === 'FROST') {
              foilGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
              foilGrad.addColorStop(0.35, 'rgba(56, 189, 248, 0.18)');
              foilGrad.addColorStop(0.5, 'rgba(224, 242, 254, 0.30)');
              foilGrad.addColorStop(0.65, 'rgba(129, 140, 248, 0.16)');
              foilGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            } else {
              foilGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
              foilGrad.addColorStop(0.28, 'rgba(192, 132, 252, 0.22)');
              foilGrad.addColorStop(0.48, 'rgba(244, 114, 182, 0.26)');
              foilGrad.addColorStop(0.68, 'rgba(99, 102, 241, 0.20)');
              foilGrad.addColorStop(0.85, 'rgba(56, 189, 248, 0.16)');
              foilGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            }

            ctx.fillStyle = foilGrad;
            ctx.fillRect(0, 0, w, h);

            // Micro holographic star glints reactive to tilt angle
            for (const sp of sparkles) {
              const dist = Math.hypot(sp.x - nx, sp.y - ny);
              const shimmer =
                Math.max(0, 1 - dist * 1.85) *
                (0.45 + 0.55 * Math.sin(t * 3.4 + sp.phase + nx * 6));
              if (shimmer > 0.12) {
                const sx = sp.x * w;
                const sy = sp.y * h;
                const r = sp.size * (0.8 + shimmer * 0.9);
                ctx.fillStyle = `rgba(255, 255, 255, ${(shimmer * 0.65).toFixed(3)})`;
                ctx.beginPath();
                ctx.moveTo(sx, sy - r * 2.2);
                ctx.lineTo(sx + r * 0.55, sy - r * 0.55);
                ctx.lineTo(sx + r * 2.2, sy);
                ctx.lineTo(sx + r * 0.55, sy + r * 0.55);
                ctx.lineTo(sx, sy + r * 2.2);
                ctx.lineTo(sx - r * 0.55, sy + r * 0.55);
                ctx.lineTo(sx - r * 2.2, sy);
                ctx.lineTo(sx - r * 0.55, sy - r * 0.55);
                ctx.closePath();
                ctx.fill();
              }
            }

            ctx.restore();
          }
        }
      }

      // 2. Render 3D Holographic Energy Pedestal Base
      const pedCanvas = pedestalCanvasRef.current;
      if (pedCanvas) {
        const pctx = pedCanvas.getContext('2d');
        if (pctx) {
          const pw = pedCanvas.width;
          const ph = pedCanvas.height;
          pctx.clearRect(0, 0, pw, ph);

          const cx = pw * 0.5;
          const cy = ph * 0.58;
          const [r1, g1, b1] = palette.pedestalRgb;
          const [r2, g2, b2] = palette.secondaryRgb;

          pctx.save();
          pctx.globalCompositeOperation = 'lighter';

          // Soft floor glow
          const glow = pctx.createRadialGradient(cx, cy, 6, cx, cy, pw * 0.44);
          glow.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, 0.34)`);
          glow.addColorStop(0.5, `rgba(${r2}, ${g2}, ${b2}, 0.14)`);
          glow.addColorStop(1, 'rgba(11, 17, 32, 0)');
          pctx.fillStyle = glow;
          pctx.fillRect(0, 0, pw, ph);

          // Outer perspective ellipse ring
          pctx.strokeStyle = `rgba(${r1}, ${g1}, ${b1}, 0.52)`;
          pctx.lineWidth = 1.6;
          pctx.beginPath();
          pctx.ellipse(cx, cy, pw * 0.36, ph * 0.24, 0, 0, Math.PI * 2);
          pctx.stroke();

          // Inner rotating dash ring
          pctx.save();
          pctx.translate(cx, cy);
          pctx.scale(1, 0.32);
          pctx.rotate(t * 0.75);
          pctx.setLineDash([12, 10]);
          pctx.strokeStyle = `rgba(${r2}, ${g2}, ${b2}, 0.65)`;
          pctx.lineWidth = 2;
          pctx.beginPath();
          pctx.arc(0, 0, pw * 0.25, 0, Math.PI * 2);
          pctx.stroke();
          pctx.restore();

          pctx.restore();
        }
      }

      rafId = window.requestAnimationFrame(renderFrame);
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(rafId);
  }, [foilMode, motionMode, palette.pedestalRgb, palette.secondaryRgb]);

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    pointerStateRef.current = { nx, ny, active: true };

    if (motionMode !== 'INTERACTIVE') return;

    const nextYaw = quantizeTilt((nx - 0.5) * 2);
    const nextPitch = quantizeTilt((0.5 - ny) * 2);
    if (nextPitch !== pitchStep) setPitchStep(nextPitch);
    if (nextYaw !== yawStep) setYawStep(nextYaw);
  };

  const handleStagePointerLeave = () => {
    pointerStateRef.current.active = false;
    if (motionMode === 'INTERACTIVE') {
      setPitchStep(1);
      setYawStep(-1);
    }
  };

  const cycleFoilMode = () => {
    soundFx.playCardSelect();
    setFoilMode((prev) => {
      if (prev === 'PRISM') return 'SOLAR';
      if (prev === 'SOLAR') return 'FROST';
      if (prev === 'FROST') return 'GALAXY';
      if (prev === 'GALAXY') return 'OFF';
      return 'PRISM';
    });
  };

  const foilLabelMap: Record<FoilFinishMode, string> = {
    PRISM: 'Foil: Prisma',
    SOLAR: 'Foil: Emas Solar',
    FROST: 'Foil: Kristal Es',
    GALAXY: 'Foil: Galaksi',
    OFF: 'Foil: Standar',
  };

  const cardSizeClass = compact
    ? 'w-44 sm:w-48 aspect-[5/7]'
    : 'w-52 sm:w-60 aspect-[5/7]';

  const activeYawClass = showBackFace
    ? YAW_BACK_CLASS_MAP[yawStep]
    : YAW_FRONT_CLASS_MAP[yawStep];

  const motionWrapperClass =
    motionMode === 'ORBIT'
      ? 'animate-3d-orbit'
      : motionMode === 'SPIN360'
      ? 'animate-3d-spin-360'
      : `tilt-pitch-smooth ${PITCH_CLASS_MAP[pitchStep]}`;

  const innerYawWrapperClass =
    motionMode === 'INTERACTIVE'
      ? `tilt-yaw-smooth ${activeYawClass}`
      : showBackFace && motionMode === 'ORBIT'
      ? 'preserve-3d tilt-ry-flip-0'
      : 'preserve-3d';

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* Interactive 3D Viewport Stage */}
      <div
        ref={stageRef}
        onPointerMove={handleStagePointerMove}
        onPointerLeave={handleStagePointerLeave}
        className={`relative w-full ${
          compact ? 'py-4' : 'py-6'
        } px-3 rounded-2xl bg-[#090F1D] border border-slate-800/90 flex flex-col items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing stage-3d-perspective`}
      >
        {/* Subtle top studio status readout */}
        <div className="w-full flex items-center justify-between gap-2 px-1 mb-3 text-[11px] font-mono text-slate-400 tabular-nums">
          <span>
            Display 3D ·{' '}
            {motionMode === 'INTERACTIVE'
              ? 'Gerak Kursor'
              : motionMode === 'ORBIT'
              ? 'Orbit Showroom'
              : 'Putar 360°'}
          </span>
          <span className={palette.rankText}>
            {showBackFace ? 'Sisi Belakang' : `Sisi Depan · ${card.rank}`}
          </span>
        </div>

        {/* 3D Card Body with Multi-Layer Physical Slab & Parallax */}
        <div className={`relative z-10 ${motionWrapperClass}`}>
          <div className={`relative ${cardSizeClass} ${innerYawWrapperClass}`}>
            {/* Physical Metallic Card Slab Thickness Layers */}
            <div
              aria-hidden="true"
              className={`absolute inset-0 rounded-2xl ${palette.rimBg} opacity-75 layer-3d-rim-back shadow-2xl`}
            />
            <div
              aria-hidden="true"
              className={`absolute inset-0 rounded-2xl bg-slate-900 border-2 ${palette.rimBorder} layer-3d-rim-mid`}
            />
            <div
              aria-hidden="true"
              className={`absolute inset-0 rounded-2xl bg-slate-950 border ${palette.rimBorder} layer-3d-rim-core`}
            />

            {/* Front Card Face (Z +4px) */}
            <div
              className={`absolute inset-0 rounded-2xl overflow-hidden bg-slate-900 border-2 ${palette.rimBorder} shadow-2xl layer-3d-front`}
            >
              <img
                src={card.image}
                alt={card.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover pointer-events-none"
              />

              {/* Custom Uploaded Card Stat Frame */}
              {showCustomOverlay && (
                <>
                  <div className="absolute inset-x-0 top-0 p-2.5 bg-gradient-to-b from-slate-950/90 via-slate-950/45 to-transparent flex items-start justify-between gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-display font-extrabold text-[10px] leading-none">
                      {card.category === CardCategory.SUIT
                        ? `SUIT ${card.suitElement ?? ''}`.trim()
                        : card.category === CardCategory.SUPPORT
                        ? 'SUP'
                        : card.rank}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950/85 text-amber-300 font-mono text-[10px] leading-none">
                      {card.numberLabel}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-2.5 pt-7 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent">
                    <div className="text-xs font-display font-bold text-white truncate">
                      {card.name}
                    </div>
                    {card.category === CardCategory.CHARACTER && (
                      <div className="mt-1 flex items-center justify-between text-[11px] font-mono font-bold tabular-nums">
                        <span className="text-emerald-300">HP {card.hp}</span>
                        <span className="text-amber-300">ATK {card.atk}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Real-Time 60fps Holographic Foil & Specular Glare Canvas (Z +6px) */}
            <canvas
              ref={foilCanvasRef}
              width={260}
              height={364}
              aria-hidden="true"
              className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none layer-3d-foil"
            />

            {/* Floating 3D Parallax Depth Overlay (Z +24px) */}
            {showParallaxHud && (
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2.5 layer-3d-parallax">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/85 border border-slate-700/90 text-[10px] font-mono font-bold text-amber-300 shadow-lg tabular-nums">
                    {packSeries.codePrefix} · {card.numberLabel}
                  </span>
                  {(card.isCustom || modifiedBuiltIn) && (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[9px] font-mono font-extrabold shadow-lg">
                      {card.isCustom ? 'KUSTOM' : 'EDIT'}
                    </span>
                  )}
                </div>

                {card.category === CardCategory.CHARACTER && (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/88 border border-slate-700/90 shadow-xl text-xs font-mono font-bold tabular-nums">
                    <span className="text-emerald-400">HP {card.hp}</span>
                    <span className={palette.rankText}>RANK {card.rank}</span>
                    <span className="text-amber-300">ATK {card.atk}</span>
                  </div>
                )}
              </div>
            )}

            {/* Official Monsta Galaxy Card Back Face (Rotated 180deg, Z +5px) */}
            <div
              className={`absolute inset-0 rounded-2xl overflow-hidden bg-gradient-to-br from-[#16223D] via-[#0E172A] to-[#090E1A] border-2 ${palette.rimBorder} flex flex-col items-center justify-between p-4 shadow-2xl layer-3d-back`}
            >
              <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                <span>MGC OFFICIAL</span>
                <span className="text-amber-300">{packSeries.codePrefix}</span>
              </div>

              <div className="w-full py-5 px-3 rounded-xl border border-amber-400/25 bg-slate-950/55 flex flex-col items-center gap-2.5">
                <img
                  src={BRAND_LOGOS.indonesia}
                  alt="Monsta Galaxy Card"
                  referrerPolicy="no-referrer"
                  className="w-4/5 h-auto object-contain drop-shadow"
                />
                <div className="text-[10px] font-mono tracking-wider text-slate-300 text-center">
                  {packSeries.name}
                </div>
              </div>

              <div className="text-[10px] font-mono text-amber-400/90 tracking-widest uppercase">
                Arena 1 vs 1 Edition
              </div>
            </div>
          </div>
        </div>

        {/* 3D Perspective Energy Pedestal Floor */}
        <canvas
          ref={pedestalCanvasRef}
          width={320}
          height={68}
          aria-hidden="true"
          className="w-64 sm:w-72 h-14 -mt-3 pointer-events-none"
        />

        <div className="mt-1 text-[11px] text-slate-400 text-center">
          Arahkan kursor atau sentuh kartu untuk memiringkan sudut pandang 3D
        </div>
      </div>

      {/* Interactive 3D Display Control Bar */}
      <div className="mt-3 w-full grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            soundFx.playCardSelect();
            setMotionMode((prev) => (prev === 'ORBIT' ? 'INTERACTIVE' : 'ORBIT'));
          }}
          className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            motionMode === 'ORBIT'
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
              : 'bg-[#0B1120] hover:bg-slate-800 text-slate-200 border-slate-700'
          }`}
        >
          <Orbit className="w-3.5 h-3.5" />
          <span>{motionMode === 'ORBIT' ? 'Orbit Aktif' : 'Orbit 3D'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playCardSelect();
            setMotionMode((prev) => (prev === 'SPIN360' ? 'INTERACTIVE' : 'SPIN360'));
          }}
          className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            motionMode === 'SPIN360'
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
              : 'bg-[#0B1120] hover:bg-slate-800 text-slate-200 border-slate-700'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>{motionMode === 'SPIN360' ? '360° Aktif' : 'Putar 360°'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playSuitClash('draw');
            if (motionMode === 'SPIN360') setMotionMode('INTERACTIVE');
            setShowBackFace((prev) => !prev);
          }}
          className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            showBackFace
              ? 'bg-sky-500/20 text-sky-300 border-sky-400/60'
              : 'bg-[#0B1120] hover:bg-slate-800 text-slate-200 border-slate-700'
          }`}
        >
          <SplitSquareHorizontal className="w-3.5 h-3.5" />
          <span>{showBackFace ? 'Lihat Depan' : 'Balik Sisi'}</span>
        </button>

        <button
          type="button"
          onClick={cycleFoilMode}
          className="px-3 py-2 text-xs font-semibold rounded-xl bg-[#0B1120] hover:bg-slate-800 text-amber-300 border border-slate-700 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{foilLabelMap[foilMode]}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playCardSelect();
            setShowParallaxHud((prev) => !prev);
          }}
          className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            showParallaxHud
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/45'
              : 'bg-[#0B1120] hover:bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{showParallaxHud ? 'Parallax: Aktif' : 'Parallax: Mati'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playCardSelect();
            setMotionMode('INTERACTIVE');
            setShowBackFace(false);
            setPitchStep(0);
            setYawStep(0);
          }}
          className="px-3 py-2 text-xs font-semibold rounded-xl bg-[#0B1120] hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Reset Sudut</span>
        </button>
      </div>
    </div>
  );
};
