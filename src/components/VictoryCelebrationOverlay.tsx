import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Crown,
  Eye,
  Flame,
  RotateCcw,
  Shield,
  Swords,
  Trophy,
  Volume2,
  Zap,
} from 'lucide-react';
import { CARD_BY_ID } from '../data/cards';
import type { FullBattleState } from '../engine/battleEngine';
import type { CardDefinition } from '../types/game';
import {
  soundFx,
  useAudioState,
  type MatchCelebrationOutcome,
  type VictoryCelebrationAudioContext,
} from '../utils/sound';
import { CardVisual } from './CardVisual';

export type VictoryBadgeCategoryId =
  | 'PERFECT_WIN'
  | 'COMEBACK'
  | 'CHAIN_MASTER'
  | 'CLUTCH_FINISHER'
  | 'BLITZ_SWEEP'
  | 'LEGENDARY_FINISHER'
  | 'DOMINANT_WIN'
  | 'FIERCE_DRAW';

export interface VictoryBadgeItem {
  id: VictoryBadgeCategoryId;
  label: string;
  description: string;
  tone: 'gold' | 'crimson' | 'cyan' | 'emerald' | 'sky';
}

export function computeVictoryBadges(battleState: FullBattleState): VictoryBadgeItem[] {
  const winnerIdx = battleState.winnerIndex;
  const history = battleState.roundHistory ?? [];
  const combos = battleState.comboHistory ?? [];

  if (winnerIdx === null) return [];

  if (winnerIdx === 'DRAW') {
    const badges: VictoryBadgeItem[] = [
      {
        id: 'FIERCE_DRAW',
        label: 'Fierce Draw',
        description: 'Kedua petarung beradu kekuatan seimbang hingga akhir laga.',
        tone: 'sky',
      },
    ];
    if (combos.length > 0) {
      badges.push({
        id: 'CHAIN_MASTER',
        label: 'Chain Master',
        description: `${combos.length} rangkaian kombo Kartu Pendukung aktif selama duel.`,
        tone: 'cyan',
      });
    }
    return badges;
  }

  const loserIdx: 0 | 1 = winnerIdx === 0 ? 1 : 0;
  const winner = battleState.players[winnerIdx];
  const loser = battleState.players[loserIdx];

  const winnerRoundWins = history.filter((r) => r.winner === winnerIdx).length;
  const loserRoundWins = history.filter((r) => r.winner === loserIdx).length;

  // Detect Comeback: Did the winner ever trail in cumulative round wins at an earlier round?
  let p0Score = 0;
  let p1Score = 0;
  let winnerTrailed = false;
  let maxDeficit = 0;

  for (const rec of history) {
    if (rec.winner === 0) p0Score += 1;
    else if (rec.winner === 1) p1Score += 1;

    const myScore = winnerIdx === 0 ? p0Score : p1Score;
    const oppScore = winnerIdx === 0 ? p1Score : p0Score;
    if (oppScore > myScore) {
      winnerTrailed = true;
      maxDeficit = Math.max(maxDeficit, oppScore - myScore);
    }
  }

  const isPerfectWin =
    winnerRoundWins >= 1 && loserRoundWins === 0 && loser.winZone.length === 0;

  const winnerCombos = combos.filter((c) => c.playerIndex === winnerIdx);
  const winnerSupportsUsed = history.reduce(
    (sum, r) => sum + (winnerIdx === 0 ? r.p0Supports.length : r.p1Supports.length),
    0
  );

  const lastWonRound = [...history].reverse().find((r) => r.winner === winnerIdx) ?? null;
  const clinchingCardId = lastWonRound
    ? winnerIdx === 0
      ? lastWonRound.p0CardId
      : lastWonRound.p1CardId
    : null;
  const clinchingCard = clinchingCardId ? CARD_BY_ID[clinchingCardId] : null;

  const avgClashes =
    history.length > 0
      ? history.reduce((acc, r) => acc + r.suitClashes, 0) / history.length
      : 1;

  const isClutchFinisher =
    !isPerfectWin &&
    ((history.length >= 3 && winnerRoundWins - loserRoundWins <= 1) ||
      (lastWonRound !== null && lastWonRound.suitClashes >= 3));

  const isBlitzSweep =
    isPerfectWin && history.length >= 2 && avgClashes <= 1.6;

  const isLegendaryFinisher = Boolean(
    clinchingCard &&
      (clinchingCard.rank === 'SR' ||
        clinchingCard.rank === 'AR' ||
        clinchingCard.rank === 'S' ||
        Boolean(clinchingCard.condition))
  );

  const earned: VictoryBadgeItem[] = [];

  if (isPerfectWin) {
    earned.push({
      id: 'PERFECT_WIN',
      label: 'Perfect Win',
      description: 'Menang bersih tanpa kehilangan satu ronde pun ke lawan.',
      tone: 'gold',
    });
  }

  if (winnerTrailed) {
    earned.push({
      id: 'COMEBACK',
      label: 'Comeback',
      description:
        maxDeficit >= 2
          ? `Membalikkan keadaan secara dramatis dari ketertinggalan ${maxDeficit} ronde!`
          : 'Bangkit membalikkan skor setelah sempat tertinggal di awal laga.',
      tone: 'crimson',
    });
  }

  if (winnerCombos.length > 0 || winnerSupportsUsed >= 2) {
    earned.push({
      id: 'CHAIN_MASTER',
      label: 'Chain Master',
      description:
        winnerCombos.length > 0
          ? `Mengeksekusi ${winnerCombos.length} kombo aktivasi Kartu Pendukung penambah stats.`
          : `Mengombinasikan ${winnerSupportsUsed} Kartu Pendukung sepanjang laga.`,
      tone: 'cyan',
    });
  }

  if (isClutchFinisher) {
    earned.push({
      id: 'CLUTCH_FINISHER',
      label: 'Clutch Finisher',
      description: 'Menentukan kemenangan tipis pada ronde penentuan bertekanan tinggi.',
      tone: 'emerald',
    });
  }

  if (isBlitzSweep) {
    earned.push({
      id: 'BLITZ_SWEEP',
      label: 'Blitz Sweep',
      description: 'Menuntaskan pertandingan dalam tempo serangan cepat tanpa balas.',
      tone: 'sky',
    });
  }

  if (isLegendaryFinisher && clinchingCard) {
    earned.push({
      id: 'LEGENDARY_FINISHER',
      label: 'Legendary Finisher',
      description: `Menutup kemenangan bersama kartu elit ${clinchingCard.name}.`,
      tone: 'gold',
    });
  }

  if (earned.length === 0) {
    earned.push({
      id: 'DOMINANT_WIN',
      label: 'Dominant Win',
      description: `Mengamankan keunggulan meyakinkan untuk ${winner.name}.`,
      tone: 'gold',
    });
  }

  return earned.slice(0, 3);
}

function resolveChampionMvpCard(battleState: FullBattleState): CardDefinition | null {
  const winnerIdx = battleState.winnerIndex;
  const history = battleState.roundHistory ?? [];

  if (winnerIdx === 0 || winnerIdx === 1) {
    const lastWinRec = [...history].reverse().find((r) => r.winner === winnerIdx);
    if (lastWinRec) {
      const cid = winnerIdx === 0 ? lastWinRec.p0CardId : lastWinRec.p1CardId;
      if (CARD_BY_ID[cid]) return CARD_BY_ID[cid];
    }
    const p = battleState.players[winnerIdx];
    if (p.active) return p.active.def;
    const allPlayed = [...p.loseZone, ...p.winZone]
      .map((inst) => CARD_BY_ID[inst.defId])
      .filter((d): d is CardDefinition => Boolean(d));
    if (allPlayed.length > 0) {
      return allPlayed.sort((a, b) => b.hp + b.atk - (a.hp + a.atk))[0];
    }
  } else if (history.length > 0) {
    const lastRec = history[history.length - 1];
    return CARD_BY_ID[lastRec.p0CardId] ?? null;
  }

  return null;
}

interface FlareParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  hue: number;
  kind: 'spark' | 'streak';
}

interface ShockRing {
  radius: number;
  maxRadius: number;
  alpha: number;
  hue: number;
}

const VictoryFlareCanvas: React.FC<{
  outcome: MatchCelebrationOutcome;
  enabled: boolean;
}> = ({ outcome, enabled }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraw = outcome === 'DRAW';
  const isDefeat = outcome === 'DEFEAT';

  useEffect(() => {
    if (!enabled) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const syncSize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = Math.max(320, rect.width || window.innerWidth);
      height = Math.max(320, rect.height || window.innerHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    syncSize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncSize) : null;
    ro?.observe(canvas);

    const palette = isDefeat
      ? [348, 215, 355]
      : isDraw
      ? [195, 210, 42]
      : [42, 34, 188, 155];
    const particles: FlareParticle[] = [];
    const rings: ShockRing[] = [
      {
        radius: 24,
        maxRadius: Math.min(width, height) * 0.62,
        alpha: isDefeat ? 0.45 : 0.75,
        hue: isDefeat ? 350 : isDraw ? 198 : 42,
      },
      {
        radius: 8,
        maxRadius: Math.min(width, height) * 0.45,
        alpha: isDefeat ? 0.3 : 0.55,
        hue: isDefeat ? 215 : 190,
      },
    ];

    const spawnBurst = (cx: number, cy: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
        const speed = 75 + Math.random() * 230;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 25,
          size: 2 + Math.random() * 3.6,
          life: 0,
          maxLife: 1.1 + Math.random() * 1.15,
          hue: palette[i % palette.length],
          kind: i % 3 === 0 ? 'streak' : 'spark',
        });
      }
    };

    spawnBurst(width * 0.5, height * 0.36, 44);

    let rafId = 0;
    let lastTs = performance.now();
    let elapsed = 0;
    let nextPulseAt = 2.4;

    const render = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      elapsed += dt;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const cx = width * 0.5;
      const cy = height * 0.36;

      // 1. Central radial golden/cyan core flare
      const corePulse = 1 + Math.sin(elapsed * 2.6) * 0.08;
      const coreRadius = Math.min(width, height) * 0.38 * corePulse;
      const coreGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, coreRadius);
      if (isDefeat) {
        coreGrad.addColorStop(0, 'rgba(244, 63, 94, 0.20)');
        coreGrad.addColorStop(0.45, 'rgba(30, 41, 59, 0.08)');
        coreGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else if (isDraw) {
        coreGrad.addColorStop(0, 'rgba(125, 211, 252, 0.28)');
        coreGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.09)');
        coreGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else {
        coreGrad.addColorStop(0, 'rgba(251, 191, 36, 0.32)');
        coreGrad.addColorStop(0.42, 'rgba(245, 158, 11, 0.11)');
        coreGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      }
      ctx.fillStyle = coreGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Rotating sweeping anamorphic light rays
      const rayCount = 6;
      for (let i = 0; i < rayCount; i++) {
        const angle = elapsed * 0.22 + (i * Math.PI) / rayCount;
        const rayLen = Math.min(width, height) * (i % 2 === 0 ? 0.52 : 0.36);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        const rayGrad = ctx.createLinearGradient(-rayLen, 0, rayLen, 0);
        rayGrad.addColorStop(0, 'rgba(251, 191, 36, 0)');
        rayGrad.addColorStop(
          0.5,
          isDraw ? 'rgba(125, 211, 252, 0.14)' : 'rgba(253, 224, 71, 0.16)'
        );
        rayGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = rayGrad;
        ctx.fillRect(-rayLen, -3, rayLen * 2, 6);
        ctx.restore();
      }

      // 3. Sharp horizontal lens flare bar near top crest
      const streakHalfW = Math.min(width * 0.44, 460);
      const flareY = Math.max(90, height * 0.19);
      const hGrad = ctx.createLinearGradient(cx - streakHalfW, flareY, cx + streakHalfW, flareY);
      hGrad.addColorStop(0, 'rgba(251, 191, 36, 0)');
      hGrad.addColorStop(0.5, isDraw ? 'rgba(186, 230, 253, 0.48)' : 'rgba(254, 240, 138, 0.52)');
      hGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = hGrad;
      ctx.fillRect(cx - streakHalfW, flareY - 2, streakHalfW * 2, 4);

      // 4. Periodic gentle celebratory secondary flare ring & sparks
      if (elapsed >= nextPulseAt) {
        nextPulseAt = elapsed + 2.8;
        rings.push({
          radius: 18,
          maxRadius: Math.min(width, height) * 0.5,
          alpha: 0.45,
          hue: palette[Math.floor(Math.random() * palette.length)],
        });
        spawnBurst(
          cx + (Math.random() - 0.5) * 180,
          cy + (Math.random() - 0.5) * 90,
          18
        );
      }

      // Ambient rising golden motes
      if (particles.length < 75 && Math.random() < 0.55) {
        particles.push({
          x: Math.random() * width,
          y: height + 10,
          vx: (Math.random() - 0.5) * 28,
          vy: -(45 + Math.random() * 75),
          size: 1.6 + Math.random() * 2.6,
          life: 0,
          maxLife: 2.2 + Math.random() * 1.8,
          hue: palette[Math.floor(Math.random() * palette.length)],
          kind: 'spark',
        });
      }

      // 5. Update & draw shockwave rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.radius += (r.maxRadius - r.radius) * Math.min(1, dt * 3.4);
        r.alpha -= dt * 0.52;
        if (r.alpha <= 0.01) {
          rings.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(cx, cy, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${r.hue}, 95%, 68%, ${r.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 6. Update & draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'streak') {
          p.vx *= 0.96;
          p.vy = p.vy * 0.96 + 38 * dt;
        }

        const progress = p.life / p.maxLife;
        const alpha = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;

        if (p.kind === 'streak') {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          ctx.strokeStyle = `hsla(${p.hue}, 96%, 72%, ${alpha * 0.85})`;
          ctx.lineWidth = p.size * 0.85;
          ctx.lineCap = 'round';
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 96%, 74%, ${alpha * 0.85})`;
          ctx.fill();
        }
      }

      ctx.restore();
      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro?.disconnect();
    };
  }, [isDraw, isDefeat, enabled]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full"
    />
  );
};

function renderBadgeIcon(id: VictoryBadgeCategoryId) {
  switch (id) {
    case 'PERFECT_WIN':
      return <Crown className="w-5 h-5 text-amber-300" />;
    case 'COMEBACK':
      return <Flame className="w-5 h-5 text-rose-300" />;
    case 'CHAIN_MASTER':
      return <Zap className="w-5 h-5 text-cyan-300" />;
    case 'CLUTCH_FINISHER':
      return <Shield className="w-5 h-5 text-emerald-300" />;
    case 'BLITZ_SWEEP':
    case 'FIERCE_DRAW':
      return <Swords className="w-5 h-5 text-sky-300" />;
    case 'LEGENDARY_FINISHER':
      return <Award className="w-5 h-5 text-amber-300" />;
    case 'DOMINANT_WIN':
    default:
      return <Trophy className="w-5 h-5 text-amber-300" />;
  }
}

function getBadgeToneClasses(tone: VictoryBadgeItem['tone']): {
  card: string;
  medallion: string;
  title: string;
} {
  switch (tone) {
    case 'crimson':
      return {
        card: 'bg-rose-950/35 border-rose-400/45',
        medallion: 'bg-rose-500/20 border-rose-400/50',
        title: 'text-rose-200',
      };
    case 'cyan':
      return {
        card: 'bg-cyan-950/35 border-cyan-400/45',
        medallion: 'bg-cyan-500/20 border-cyan-400/50',
        title: 'text-cyan-200',
      };
    case 'emerald':
      return {
        card: 'bg-emerald-950/35 border-emerald-400/45',
        medallion: 'bg-emerald-500/20 border-emerald-400/50',
        title: 'text-emerald-200',
      };
    case 'sky':
      return {
        card: 'bg-sky-950/35 border-sky-400/45',
        medallion: 'bg-sky-500/20 border-sky-400/50',
        title: 'text-sky-200',
      };
    case 'gold':
    default:
      return {
        card: 'bg-amber-950/30 border-amber-400/50',
        medallion: 'bg-amber-500/20 border-amber-400/50',
        title: 'text-amber-200',
      };
  }
}

const BADGE_ANIM_CLASSES = [
  'animate-victory-badge-1',
  'animate-victory-badge-2',
  'animate-victory-badge-3',
];

export interface VictoryCelebrationOverlayProps {
  battleState: FullBattleState;
  viewerSeat?: 0 | 1 | null;
  holdForKo?: boolean;
  clashFxEnabled?: boolean;
  contextLabel?: string;
  extraNotice?: string | null;
  waitingNotice?: string | null;
  primaryAction?: {
    label: string;
    onClick: () => void;
  } | null;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  } | null;
  onInspectCard?: (card: CardDefinition) => void;
}

export const VictoryCelebrationOverlay: React.FC<VictoryCelebrationOverlayProps> = ({
  battleState,
  viewerSeat = null,
  holdForKo = false,
  clashFxEnabled = true,
  contextLabel = 'Pertarungan Selesai',
  extraNotice = null,
  waitingNotice = null,
  primaryAction = null,
  secondaryAction = null,
  onInspectCard,
}) => {
  const audio = useAudioState();
  const [minimized, setMinimized] = useState(false);
  const fanfarePlayedKeyRef = useRef<string | null>(null);

  const isGameOver =
    battleState.phase === 'GAME_OVER' && battleState.winnerIndex !== null;

  const matchIdentityKey = `${battleState.round}-${battleState.winnerIndex}-${battleState.roundHistory.length}`;

  const badges = useMemo(() => computeVictoryBadges(battleState), [battleState]);
  const mvpCard = useMemo(() => resolveChampionMvpCard(battleState), [battleState]);

  const outcome = useMemo<MatchCelebrationOutcome>(() => {
    if (battleState.winnerIndex === 'DRAW') return 'DRAW';
    if (viewerSeat === 0 || viewerSeat === 1) {
      return battleState.winnerIndex === viewerSeat ? 'VICTORY' : 'DEFEAT';
    }
    if (battleState.mode === 'VS_CPU') {
      return battleState.winnerIndex === 0 ? 'VICTORY' : 'DEFEAT';
    }
    return 'VICTORY';
  }, [battleState.winnerIndex, battleState.mode, viewerSeat]);

  const celebrationContext = useMemo<VictoryCelebrationAudioContext>(() => {
    const winnerCombos =
      battleState.winnerIndex === 0 || battleState.winnerIndex === 1
        ? (battleState.comboHistory ?? []).filter(
            (c) => c.playerIndex === battleState.winnerIndex
          ).length
        : 0;
    return {
      outcome,
      isPerfectWin: badges.some((b) => b.id === 'PERFECT_WIN'),
      isComeback: badges.some((b) => b.id === 'COMEBACK'),
      isLegendaryFinisher: badges.some((b) => b.id === 'LEGENDARY_FINISHER'),
      comboCount: winnerCombos,
      winnerName:
        battleState.winnerIndex === 0 || battleState.winnerIndex === 1
          ? battleState.players[battleState.winnerIndex].name
          : undefined,
    };
  }, [outcome, badges, battleState.comboHistory, battleState.winnerIndex, battleState.players]);

  useEffect(() => {
    setMinimized(false);
  }, [matchIdentityKey]);

  useEffect(() => {
    if (!isGameOver || holdForKo) return;
    if (fanfarePlayedKeyRef.current === matchIdentityKey) return;
    fanfarePlayedKeyRef.current = matchIdentityKey;
    soundFx.playVictoryCelebration(celebrationContext);
  }, [isGameOver, holdForKo, matchIdentityKey, celebrationContext]);

  if (!isGameOver || holdForKo) return null;

  const isDraw = battleState.winnerIndex === 'DRAW';
  const isDefeat = outcome === 'DEFEAT';
  const p0 = battleState.players[0];
  const p1 = battleState.players[1];
  const p0RoundWins = battleState.roundHistory.filter((r) => r.winner === 0).length;
  const p1RoundWins = battleState.roundHistory.filter((r) => r.winner === 1).length;
  const totalCombos = battleState.comboHistory?.length ?? 0;

  const calloutDisplayLabel = celebrationContext.isPerfectWin
    ? '"Perfect Victory!"'
    : celebrationContext.isComeback
    ? '"Comeback Victory!"'
    : celebrationContext.isLegendaryFinisher
    ? '"Legendary Victory!"'
    : '"Victory!"';

  const headline = isDraw
    ? 'Pertandingan Seri!'
    : `${battleState.players[battleState.winnerIndex as 0 | 1].name} Menang!`;

  if (minimized) {
    return (
      <div className="fixed bottom-5 right-5 z-40 flex flex-wrap items-center gap-2.5 bg-[#131C31]/95 backdrop-blur-md border border-amber-400/50 rounded-2xl p-3 shadow-2xl">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="px-4 py-2.5 text-xs sm:text-sm font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/35 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>{isDefeat ? 'Buka Ringkasan Hasil' : 'Buka Perayaan Kemenangan'}</span>
        </button>

        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="px-4 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{primaryAction.label}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="animate-victory-backdrop fixed inset-0 z-40 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Victory Celebration"
    >
      <VictoryFlareCanvas outcome={outcome} enabled={clashFxEnabled} />

      <div
        className={`animate-victory-stage relative z-10 w-full max-w-3xl my-auto bg-[#131C31]/95 border rounded-2xl p-6 sm:p-8 shadow-2xl ${
          isDefeat ? 'border-slate-700' : 'border-amber-400/45'
        }`}
      >
        {/* Top Metadata, Celebration Audio Replay & Inspect Board Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/90">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-amber-300 tabular-nums">
            <span>{contextLabel}</span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span>{battleState.round} Ronde</span>
            {totalCombos > 0 && (
              <>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-cyan-300">{totalCombos} Kombo Aktif</span>
              </>
            )}
            {outcome === 'VICTORY' && !audio.muted && (
              <>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-emerald-300">
                  {audio.celebrationCrowdEnabled ? 'Sorakan Penonton' : 'Fanfare'}
                  {audio.celebrationVoiceEnabled ? ` + ${calloutDisplayLabel}` : ''}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {outcome === 'VICTORY' && (
              <button
                type="button"
                onClick={() => {
                  if (audio.muted) {
                    soundFx.toggleMute();
                  }
                  soundFx.playVictoryCelebration(celebrationContext);
                }}
                title="Putar ulang sorakan penonton dan suara Victory!"
                className="px-3 py-1.5 text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/40 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Putar Sorakan</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Lihat Papan Arena</span>
            </button>
          </div>
        </div>

        {/* Champion Headline */}
        <div className="mt-5 text-center">
          <div
            className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl border mb-3 ${
              isDefeat
                ? 'bg-slate-800/80 border-slate-600'
                : 'bg-amber-500/15 border-amber-400/45'
            }`}
          >
            {isDefeat ? (
              <Shield className="w-8 h-8 text-slate-300" />
            ) : (
              <Trophy className="w-8 h-8 text-amber-400" />
            )}
          </div>
          <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-white tracking-wide">
            {headline}
          </h2>
          {battleState.winReason && (
            <p className="mt-2 text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
              {battleState.winReason}
            </p>
          )}
        </div>

        {/* Main Celebration Grid: MVP Card Showcase + Victory Category Badges */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {mvpCard && (
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="text-xs font-mono text-slate-400 mb-2">
                {isDraw ? 'Kartu Penutup Laga' : 'Kartu Penentu Kemenangan'}
              </div>
              <CardVisual
                card={mvpCard}
                size="sm"
                selected={!isDraw}
                onClick={onInspectCard ? () => onInspectCard(mvpCard) : undefined}
                onInspect={onInspectCard}
              />
              <div className="mt-2 text-xs font-semibold text-slate-200 text-center">
                {mvpCard.name}
              </div>
            </div>
          )}

          <div
            className={`${
              mvpCard ? 'md:col-span-7' : 'md:col-span-12'
            } space-y-4`}
          >
            {/* Victory Category Badges Section */}
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-2.5">
                Badge Kategori Kemenangan
              </div>
              <div className="space-y-2.5">
                {badges.map((badge, idx) => {
                  const toneStyles = getBadgeToneClasses(badge.tone);
                  const animCls = BADGE_ANIM_CLASSES[idx] ?? 'animate-victory-badge-3';
                  return (
                    <div
                      key={badge.id}
                      className={`${animCls} rounded-xl border ${toneStyles.card} p-3 flex items-center gap-3.5`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg border ${toneStyles.medallion} flex items-center justify-center shrink-0`}
                      >
                        {renderBadgeIcon(badge.id)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-sm font-display font-extrabold ${toneStyles.title}`}
                        >
                          {badge.label}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {badge.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Comparative Tabular Scoreboard */}
            <div className="py-3.5 px-4 bg-[#0B1120] border border-slate-800 rounded-xl grid grid-cols-2 gap-4 font-mono tabular-nums">
              <div>
                <div className="text-xs text-slate-400 truncate">{p0.name}</div>
                <div className="mt-1 text-lg sm:text-xl font-bold text-amber-300">
                  {battleState.maxRounds
                    ? `${p0RoundWins} Ronde`
                    : `${p0.winZone.length} / ${battleState.targetWins}`}
                </div>
                <div className="text-[11px] text-slate-500">
                  Zona Menang: {p0.winZone.length} · Kombo:{' '}
                  {(battleState.comboHistory ?? []).filter((c) => c.playerIndex === 0).length}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 truncate">{p1.name}</div>
                <div className="mt-1 text-lg sm:text-xl font-bold text-sky-300">
                  {battleState.maxRounds
                    ? `${p1RoundWins} Ronde`
                    : `${p1.winZone.length} / ${battleState.targetWins}`}
                </div>
                <div className="text-[11px] text-slate-500">
                  Zona Menang: {p1.winZone.length} · Kombo:{' '}
                  {(battleState.comboHistory ?? []).filter((c) => c.playerIndex === 1).length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {extraNotice && (
          <p className="mt-4 text-center text-xs font-medium text-amber-300">{extraNotice}</p>
        )}

        {/* Footer Actions */}
        <div className="mt-6 pt-5 border-t border-slate-800/90 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="flex-1 py-3 px-5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              {primaryAction.label}
            </button>
          )}

          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="py-3 px-5 text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              {secondaryAction.label}
            </button>
          )}

          {waitingNotice && !primaryAction && !secondaryAction && (
            <p className="w-full text-center text-xs text-slate-400 py-2">{waitingNotice}</p>
          )}
        </div>
      </div>
    </div>
  );
};
