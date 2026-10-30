import React, { useEffect, useId, useRef } from 'react';
import {
  SuitElement,
  type ActiveFighter,
  type BattlePhase,
  type CardDefinition,
} from '../types/game.ts';

export type ElementalThemeId =
  | 'FIRE'
  | 'WATER_ICE'
  | 'LEAF_WIND'
  | 'LIGHTNING_SOLAR'
  | 'GRAVITY_SHADOW'
  | 'EARTH_QUAKE';

export type ParticleShapeKind = 'flame' | 'crystal' | 'leaf' | 'bolt' | 'shard';

export interface ElementalPalette {
  id: ElementalThemeId;
  label: string;
  coreHex: string;
  primaryHex: string;
  secondaryHex: string;
  glowHex: string;
  particleKind: ParticleShapeKind;
}

const ELEMENTAL_PALETTES: Record<ElementalThemeId, ElementalPalette> = {
  FIRE: {
    id: 'FIRE',
    label: 'Bara Api',
    coreHex: '#FFF7D6',
    primaryHex: '#FF5A1F',
    secondaryHex: '#FFB703',
    glowHex: '#EA580C',
    particleKind: 'flame',
  },
  WATER_ICE: {
    id: 'WATER_ICE',
    label: 'Ais & Air',
    coreHex: '#F0FDFF',
    primaryHex: '#00C8FF',
    secondaryHex: '#60A5FA',
    glowHex: '#0284C7',
    particleKind: 'crystal',
  },
  LEAF_WIND: {
    id: 'LEAF_WIND',
    label: 'Daun & Taufan',
    coreHex: '#ECFDF5',
    primaryHex: '#10B981',
    secondaryHex: '#84CC16',
    glowHex: '#059669',
    particleKind: 'leaf',
  },
  LIGHTNING_SOLAR: {
    id: 'LIGHTNING_SOLAR',
    label: 'Halilintar & Solar',
    coreHex: '#FEFCE8',
    primaryHex: '#FACC15',
    secondaryHex: '#FB923C',
    glowHex: '#EAB308',
    particleKind: 'bolt',
  },
  GRAVITY_SHADOW: {
    id: 'GRAVITY_SHADOW',
    label: 'Bayang & Graviti',
    coreHex: '#FAF5FF',
    primaryHex: '#C084FC',
    secondaryHex: '#F43F5E',
    glowHex: '#9333EA',
    particleKind: 'shard',
  },
  EARTH_QUAKE: {
    id: 'EARTH_QUAKE',
    label: 'Gempa & Kosmik',
    coreHex: '#FFFBEB',
    primaryHex: '#F59E0B',
    secondaryHex: '#38BDF8',
    glowHex: '#D97706',
    particleKind: 'shard',
  },
};

const CLASH_FX_STORAGE_KEY = 'choki_tcg_clash_fx_v1';

export function loadClashFxEnabled(): boolean {
  try {
    const raw = window.localStorage.getItem(CLASH_FX_STORAGE_KEY);
    if (raw === '0') return false;
    return true;
  } catch {
    return true;
  }
}

export function persistClashFxEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(CLASH_FX_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

export function resolveSuitElementTheme(suit: SuitElement | null | undefined): ElementalPalette {
  if (suit === SuitElement.API) return ELEMENTAL_PALETTES.FIRE;
  if (suit === SuitElement.AIR) return ELEMENTAL_PALETTES.WATER_ICE;
  if (suit === SuitElement.DAUN) return ELEMENTAL_PALETTES.LEAF_WIND;
  return ELEMENTAL_PALETTES.EARTH_QUAKE;
}

export function resolveCardElementTheme(card: CardDefinition | null | undefined): ElementalPalette {
  if (!card) return ELEMENTAL_PALETTES.EARTH_QUAKE;
  if (card.suitElement) return resolveSuitElementTheme(card.suitElement);

  const haystack = `${card.name} ${card.characterTags.join(' ')} ${card.effectText}`.toLowerCase();

  if (
    haystack.includes('blaze') ||
    haystack.includes('bara') ||
    haystack.includes('nova') ||
    haystack.includes('frostfire') ||
    haystack.includes('pyro') ||
    haystack.includes('rosaksa') ||
    haystack.includes('api') ||
    haystack.includes('magma')
  ) {
    return ELEMENTAL_PALETTES.FIRE;
  }

  if (
    haystack.includes('ais') ||
    haystack.includes('blizzard') ||
    haystack.includes('glacier') ||
    haystack.includes('beku') ||
    haystack.includes('artik') ||
    haystack.includes('salju') ||
    haystack.includes('air')
  ) {
    return ELEMENTAL_PALETTES.WATER_ICE;
  }

  if (
    haystack.includes('duri') ||
    haystack.includes('daun') ||
    haystack.includes('rimba') ||
    haystack.includes('taufan') ||
    haystack.includes('beliung') ||
    haystack.includes('angin') ||
    haystack.includes('sori') ||
    haystack.includes('kuputeri') ||
    haystack.includes('maripos') ||
    haystack.includes('balakung') ||
    haystack.includes('tumbosaur')
  ) {
    return ELEMENTAL_PALETTES.LEAF_WIND;
  }

  if (
    haystack.includes('halilintar') ||
    haystack.includes('solar') ||
    haystack.includes('supra') ||
    haystack.includes('sopan') ||
    haystack.includes('gentar') ||
    haystack.includes('voltra') ||
    haystack.includes('kilat') ||
    haystack.includes('petir') ||
    haystack.includes('ying')
  ) {
    return ELEMENTAL_PALETTES.LIGHTNING_SOLAR;
  }

  if (
    haystack.includes('fang') ||
    haystack.includes('yaya') ||
    haystack.includes('graviti') ||
    haystack.includes('bayang') ||
    haystack.includes('adu du') ||
    haystack.includes('probe') ||
    haystack.includes('retak') ||
    haystack.includes('bora') ||
    haystack.includes('vargoba') ||
    haystack.includes('ejo jo')
  ) {
    return ELEMENTAL_PALETTES.GRAVITY_SHADOW;
  }

  return ELEMENTAL_PALETTES.EARTH_QUAKE;
}

interface CardClashAuraProps {
  card: CardDefinition;
  opponentCard?: CardDefinition | null;
  activeClash: boolean;
  isAttacking?: boolean;
  isHit?: boolean;
  enabled?: boolean;
  burstKey?: string | number;
}

export const CardClashAura: React.FC<CardClashAuraProps> = ({
  card,
  opponentCard,
  activeClash,
  isAttacking = false,
  isHit = false,
  enabled = true,
  burstKey,
}) => {
  const rawUid = useId();
  const safeId = rawUid.replace(/[^a-zA-Z0-9_-]/g, '');

  if (!enabled) return null;

  const myTheme = resolveCardElementTheme(card);
  const strikeTheme = isHit && opponentCard ? resolveCardElementTheme(opponentCard) : myTheme;
  const highRank = card.rank === 'SR' || card.rank === 'AR' || card.rank === 'S';

  return (
    <>
      {/* Ambient + Burst Elemental Aura Behind Card */}
      {(activeClash || isAttacking || isHit) && (
        <svg
          key={`aura-${safeId}-${isAttacking ? `atk-${burstKey}` : activeClash ? 'clash' : 'idle'}`}
          viewBox="0 0 240 320"
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-5 sm:-inset-7 z-0 h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)] sm:h-[calc(100%+3.5rem)] sm:w-[calc(100%+3.5rem)] overflow-visible ${
            isAttacking ? 'animate-flare-burst' : 'animate-aura-breathe'
          }`}
        >
          <defs>
            <radialGradient id={`halo-${safeId}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={myTheme.coreHex} stopOpacity={isAttacking ? '0.68' : '0.32'} />
              <stop
                offset="38%"
                stopColor={myTheme.primaryHex}
                stopOpacity={isAttacking ? '0.52' : highRank ? '0.30' : '0.22'}
              />
              <stop offset="72%" stopColor={myTheme.secondaryHex} stopOpacity="0.10" />
              <stop offset="100%" stopColor={myTheme.glowHex} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`ray-${safeId}`} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor={myTheme.primaryHex} stopOpacity="0" />
              <stop offset="50%" stopColor={myTheme.coreHex} stopOpacity="0.85" />
              <stop offset="100%" stopColor={myTheme.secondaryHex} stopOpacity="0" />
            </linearGradient>
          </defs>

          <ellipse cx="120" cy="160" rx="112" ry="148" fill={`url(#halo-${safeId})`} />

          {(isAttacking || highRank) && (
            <g opacity={isAttacking ? '0.92' : '0.45'}>
              <polygon points="120,4 126,154 120,316 114,154" fill={`url(#ray-${safeId})`} />
              <polygon points="6,160 116,154 234,160 116,166" fill={`url(#ray-${safeId})`} />
              <polygon points="34,42 123,156 206,278 117,164" fill={`url(#ray-${safeId})`} opacity="0.65" />
              <polygon points="206,42 123,164 34,278 117,156" fill={`url(#ray-${safeId})`} opacity="0.65" />
            </g>
          )}
        </svg>
      )}

      {/* Elemental Slash Flash Over Card When Struck */}
      {isHit && (
        <svg
          key={`slash-${safeId}-${burstKey ?? 'hit'}`}
          viewBox="0 0 200 280"
          aria-hidden="true"
          className="animate-slash-impact pointer-events-none absolute -inset-3 z-20 h-[calc(100%+1.5rem)] w-[calc(100%+1.5rem)] overflow-visible"
        >
          <defs>
            <linearGradient id={`slash-grad-${safeId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={strikeTheme.secondaryHex} stopOpacity="0" />
              <stop offset="45%" stopColor={strikeTheme.coreHex} stopOpacity="0.98" />
              <stop offset="60%" stopColor={strikeTheme.primaryHex} stopOpacity="0.92" />
              <stop offset="100%" stopColor={strikeTheme.glowHex} stopOpacity="0" />
            </linearGradient>
            <radialGradient id={`hit-core-${safeId}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={strikeTheme.coreHex} stopOpacity="0.95" />
              <stop offset="45%" stopColor={strikeTheme.primaryHex} stopOpacity="0.55" />
              <stop offset="100%" stopColor={strikeTheme.glowHex} stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="100" cy="140" r="68" fill={`url(#hit-core-${safeId})`} />
          <polygon points="12,32 106,132 188,248 94,148" fill={`url(#slash-grad-${safeId})`} />
          <polygon
            points="184,52 104,144 16,228 96,136"
            fill={`url(#slash-grad-${safeId})`}
            opacity="0.82"
          />
        </svg>
      )}
    </>
  );
};

interface SuitClashFlareProps {
  leftSuit: SuitElement;
  rightSuit: SuitElement;
  winner: 'left' | 'right' | 'draw';
  clashKey: string;
  enabled?: boolean;
}

export const SuitClashFlare: React.FC<SuitClashFlareProps> = ({
  leftSuit,
  rightSuit,
  winner,
  clashKey,
  enabled = true,
}) => {
  const rawUid = useId();
  const safeId = rawUid.replace(/[^a-zA-Z0-9_-]/g, '');

  if (!enabled) {
    return <div className="font-display font-extrabold text-lg text-slate-400">VS</div>;
  }

  const dominantTheme =
    winner === 'left'
      ? resolveSuitElementTheme(leftSuit)
      : winner === 'right'
      ? resolveSuitElementTheme(rightSuit)
      : ELEMENTAL_PALETTES.LIGHTNING_SOLAR;

  return (
    <div key={clashKey} className="animate-vs-clash-pop relative flex items-center justify-center px-1">
      <svg
        viewBox="0 0 120 120"
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 h-20 w-20 overflow-visible"
      >
        <defs>
          <radialGradient id={`vs-flare-${safeId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={dominantTheme.coreHex} stopOpacity="0.95" />
            <stop offset="42%" stopColor={dominantTheme.primaryHex} stopOpacity="0.58" />
            <stop offset="100%" stopColor={dominantTheme.glowHex} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="46" fill={`url(#vs-flare-${safeId})`} />
        <polygon
          points="60,4 64,56 60,116 56,56"
          fill={dominantTheme.coreHex}
          opacity="0.85"
        />
        <polygon
          points="4,60 56,56 116,60 56,64"
          fill={dominantTheme.primaryHex}
          opacity="0.85"
        />
        <polygon
          points="20,20 62,58 100,100 58,62"
          fill={dominantTheme.secondaryHex}
          opacity="0.65"
        />
        <polygon
          points="100,20 62,62 20,100 58,58"
          fill={dominantTheme.secondaryHex}
          opacity="0.65"
        />
      </svg>
      <span className="relative z-10 font-display font-extrabold text-lg text-white drop-shadow">
        VS
      </span>
    </div>
  );
};

interface CanvasParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  drag: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  coreColor: string;
  kind: ParticleShapeKind;
  rotation: number;
  spin: number;
}

interface CanvasShockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  lineWidth: number;
  life: number;
  maxLife: number;
  color: string;
}

interface CanvasFlare {
  x: number;
  y: number;
  rx: number;
  ry: number;
  angle: number;
  life: number;
  maxLife: number;
  coreColor: string;
  glowColor: string;
}

interface CanvasBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
  width: number;
  coreColor: string;
  glowColor: string;
  jagged: boolean;
  seed: number;
}

export interface CombatClashSignal {
  id: number;
  attackerSide: 'left' | 'right' | null;
  leftDelta: number | null;
  rightDelta: number | null;
}

export interface ArenaClashFxProps {
  phase: BattlePhase;
  round: number;
  suitAttempt: number;
  leftFighter: ActiveFighter | null;
  rightFighter: ActiveFighter | null;
  leftSuit: SuitElement | null;
  rightSuit: SuitElement | null;
  suitWinner: 'left' | 'right' | 'draw' | null;
  leftSupportCard?: CardDefinition | null;
  rightSupportCard?: CardDefinition | null;
  combatSignal: CombatClashSignal | null;
  enabled?: boolean;
}

const MAX_PARTICLES = 220;

export const ArenaClashFx: React.FC<ArenaClashFxProps> = ({
  phase,
  round,
  suitAttempt,
  leftFighter,
  rightFighter,
  leftSuit,
  rightSuit,
  suitWinner,
  leftSupportCard,
  rightSupportCard,
  combatSignal,
  enabled = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const particlesRef = useRef<CanvasParticle[]>([]);
  const ringsRef = useRef<CanvasShockwave[]>([]);
  const flaresRef = useRef<CanvasFlare[]>([]);
  const beamsRef = useRef<CanvasBeam[]>([]);

  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const ambientAccumRef = useRef<number>(0);

  const reducedMotionRef = useRef<boolean>(false);

  const activeStateRef = useRef({
    enabled,
    phase,
    leftFighter,
    rightFighter,
  });
  activeStateRef.current = {
    enabled,
    phase,
    leftFighter,
    rightFighter,
  };

  const getStageAnchors = () => {
    const { w, h } = sizeRef.current;
    const isDesktop = window.innerWidth >= 1024 && w >= 720;
    if (isDesktop) {
      return {
        left: { x: w * 0.175, y: h * 0.57 },
        center: { x: w * 0.5, y: h * 0.57 },
        right: { x: w * 0.825, y: h * 0.57 },
      };
    }
    return {
      left: { x: w * 0.5, y: h * 0.28 },
      center: { x: w * 0.5, y: h * 0.55 },
      right: { x: w * 0.5, y: h * 0.82 },
    };
  };

  const pushParticle = (p: CanvasParticle) => {
    const list = particlesRef.current;
    if (list.length >= MAX_PARTICLES) {
      list.shift();
    }
    list.push(p);
  };

  const spawnBurst = (
    x: number,
    y: number,
    palette: ElementalPalette,
    count: number,
    speedMin: number,
    speedMax: number,
    biasVx = 0,
    biasVy = 0,
    sizeScale = 1
  ) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const usePrimary = Math.random() > 0.36;
      const isFlame = palette.particleKind === 'flame';

      pushParticle({
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 18,
        vx: Math.cos(angle) * speed + biasVx,
        vy: Math.sin(angle) * speed + biasVy,
        ax: 0,
        ay: isFlame ? -135 : palette.particleKind === 'leaf' ? -35 : 95,
        drag: palette.particleKind === 'bolt' ? 0.9 : 0.94,
        size: (3.2 + Math.random() * 5.2) * sizeScale,
        life: 0,
        maxLife: 0.34 + Math.random() * 0.42,
        color: usePrimary ? palette.primaryHex : palette.secondaryHex,
        coreColor: palette.coreHex,
        kind: palette.particleKind,
        rotation: angle,
        spin: (Math.random() - 0.5) * 9,
      });
    }
  };

  const spawnAnamorphicFlare = (
    x: number,
    y: number,
    palette: ElementalPalette,
    scale = 1,
    duration = 0.42
  ) => {
    flaresRef.current.push(
      {
        x,
        y,
        rx: 135 * scale,
        ry: 16 * scale,
        angle: 0,
        life: 0,
        maxLife: duration,
        coreColor: palette.coreHex,
        glowColor: palette.primaryHex,
      },
      {
        x,
        y,
        rx: 68 * scale,
        ry: 11 * scale,
        angle: Math.PI / 2,
        life: 0,
        maxLife: duration * 0.88,
        coreColor: palette.coreHex,
        glowColor: palette.secondaryHex,
      }
    );
  };

  const spawnShockwave = (
    x: number,
    y: number,
    color: string,
    maxRadius: number,
    duration = 0.46,
    lineWidth = 4.5
  ) => {
    ringsRef.current.push({
      x,
      y,
      radius: 10,
      maxRadius,
      lineWidth,
      life: 0,
      maxLife: duration,
      color,
    });
  };

  const ensureLoopRunning = useRef<() => void>(() => {});

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      sizeRef.current = { w, h };
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    ro.observe(canvas);

    const drawParticleShape = (p: CanvasParticle, alpha: number) => {
      ctx.save();
      ctx.translate(p.x, p.y);

      if (p.kind === 'bolt') {
        const velAngle = Math.atan2(p.vy, p.vx);
        ctx.rotate(velAngle);
        const streakLen = Math.max(p.size * 2.4, Math.hypot(p.vx, p.vy) * 0.042);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(streakLen, 0);
        ctx.lineTo(-streakLen * 0.4, p.size * 0.55);
        ctx.lineTo(-streakLen, 0);
        ctx.lineTo(-streakLen * 0.4, -p.size * 0.55);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = p.coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'flame') {
        const flameAngle = Math.atan2(p.vy, p.vx) - Math.PI / 2;
        ctx.rotate(flameAngle);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, p.size * 1.65);
        ctx.quadraticCurveTo(p.size * 1.05, p.size * 0.2, 0, -p.size * 1.15);
        ctx.quadraticCurveTo(-p.size * 1.05, p.size * 0.2, 0, p.size * 1.65);
        ctx.fill();

        ctx.fillStyle = p.coreColor;
        ctx.beginPath();
        ctx.arc(0, p.size * 0.18, p.size * 0.48, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'crystal') {
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 1.5);
        ctx.lineTo(p.size * 0.9, 0);
        ctx.lineTo(0, p.size * 1.5);
        ctx.lineTo(-p.size * 0.9, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = p.coreColor;
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 0.72);
        ctx.lineTo(p.size * 0.42, 0);
        ctx.lineTo(0, p.size * 0.72);
        ctx.lineTo(-p.size * 0.42, 0);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'leaf') {
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.size * 1.35, 0);
        ctx.quadraticCurveTo(0, -p.size * 1.15, p.size * 1.35, 0);
        ctx.quadraticCurveTo(0, p.size * 0.45, -p.size * 1.35, 0);
        ctx.fill();

        ctx.fillStyle = p.coreColor;
        ctx.beginPath();
        ctx.arc(0, -p.size * 0.15, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 1.25);
        ctx.lineTo(p.size * 1.1, p.size * 0.55);
        ctx.lineTo(-p.size * 0.4, p.size * 1.15);
        ctx.lineTo(-p.size * 1.15, -p.size * 0.35);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = p.coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const tick = (ts: number) => {
      const { w, h } = sizeRef.current;
      const dt = lastTsRef.current ? Math.min(0.05, (ts - lastTsRef.current) / 1000) : 0.016;
      lastTsRef.current = ts;

      ctx.clearRect(0, 0, w, h);

      const cur = activeStateRef.current;
      if (!cur.enabled || reducedMotionRef.current) {
        particlesRef.current.length = 0;
        ringsRef.current.length = 0;
        flaresRef.current.length = 0;
        beamsRef.current.length = 0;
        rafIdRef.current = null;
        return;
      }

      // Ambient elemental embers when both cards are actively clashing on the mat
      const bothActive =
        Boolean(cur.leftFighter && cur.rightFighter) &&
        cur.phase !== 'ROUND_END' &&
        cur.phase !== 'GAME_OVER' &&
        cur.phase !== 'P2_PRIVACY_CHARACTER' &&
        cur.phase !== 'P2_PRIVACY_SUIT' &&
        cur.phase !== 'P2_PRIVACY_SUPPORT';

      if (bothActive && cur.leftFighter && cur.rightFighter && w > 40) {
        ambientAccumRef.current += dt;
        if (ambientAccumRef.current >= 0.085) {
          ambientAccumRef.current = 0;
          const anchors = getStageAnchors();
          const leftTheme = resolveCardElementTheme(cur.leftFighter.def);
          const rightTheme = resolveCardElementTheme(cur.rightFighter.def);

          pushParticle({
            x: anchors.left.x + (Math.random() - 0.5) * 125,
            y: anchors.left.y + (Math.random() - 0.5) * 145,
            vx: 18 + Math.random() * 42,
            vy: -26 - Math.random() * 44,
            ax: 0,
            ay: -18,
            drag: 0.985,
            size: 2.2 + Math.random() * 2.6,
            life: 0,
            maxLife: 0.75 + Math.random() * 0.55,
            color: Math.random() > 0.4 ? leftTheme.primaryHex : leftTheme.secondaryHex,
            coreColor: leftTheme.coreHex,
            kind: leftTheme.particleKind,
            rotation: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 4,
          });

          pushParticle({
            x: anchors.right.x + (Math.random() - 0.5) * 125,
            y: anchors.right.y + (Math.random() - 0.5) * 145,
            vx: -18 - Math.random() * 42,
            vy: -26 - Math.random() * 44,
            ax: 0,
            ay: -18,
            drag: 0.985,
            size: 2.2 + Math.random() * 2.6,
            life: 0,
            maxLife: 0.75 + Math.random() * 0.55,
            color: Math.random() > 0.4 ? rightTheme.primaryHex : rightTheme.secondaryHex,
            coreColor: rightTheme.coreHex,
            kind: rightTheme.particleKind,
            rotation: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 4,
          });
        }
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // 1. Shockwave rings
      const rings = ringsRef.current;
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life += dt;
        if (r.life >= r.maxLife) {
          rings.splice(i, 1);
          continue;
        }
        const t = r.life / r.maxLife;
        const easeOut = 1 - Math.pow(1 - t, 3);
        const curRad = r.radius + (r.maxRadius - r.radius) * easeOut;
        const alpha = (1 - t) * 0.82;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = Math.max(0.8, r.lineWidth * (1 - t * 0.72));
        ctx.beginPath();
        ctx.arc(r.x, r.y, curRad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 2. Energy Beams & Lightning Arcs
      const beams = beamsRef.current;
      for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i];
        b.life += dt;
        if (b.life >= b.maxLife) {
          beams.splice(i, 1);
          continue;
        }
        const t = b.life / b.maxLife;
        const alpha = Math.sin(Math.min(1, t) * Math.PI);

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const drawBeamPath = () => {
          ctx.beginPath();
          ctx.moveTo(b.x1, b.y1);
          if (b.jagged) {
            const steps = 7;
            const dx = b.x2 - b.x1;
            const dy = b.y2 - b.y1;
            const perpX = -dy / Math.max(1, Math.hypot(dx, dy));
            const perpY = dx / Math.max(1, Math.hypot(dx, dy));
            for (let s = 1; s < steps; s++) {
              const frac = s / steps;
              const jitter = Math.sin(b.seed + s * 3.7 + b.life * 45) * 20;
              ctx.lineTo(b.x1 + dx * frac + perpX * jitter, b.y1 + dy * frac + perpY * jitter);
            }
          } else {
            const midX = (b.x1 + b.x2) * 0.5;
            const midY = (b.y1 + b.y2) * 0.5 - 24;
            ctx.quadraticCurveTo(midX, midY, b.x2, b.y2);
          }
          ctx.lineTo(b.x2, b.y2);
        };

        ctx.globalAlpha = alpha * 0.55;
        ctx.strokeStyle = b.glowColor;
        ctx.lineWidth = b.width * 2.4 * (1 - t * 0.4);
        drawBeamPath();
        ctx.stroke();

        ctx.globalAlpha = alpha * 0.95;
        ctx.strokeStyle = b.coreColor;
        ctx.lineWidth = Math.max(1.5, b.width * 0.72 * (1 - t * 0.4));
        drawBeamPath();
        ctx.stroke();

        ctx.restore();
      }

      // 3. Anamorphic & Star Lens Flares
      const flares = flaresRef.current;
      for (let i = flares.length - 1; i >= 0; i--) {
        const f = flares[i];
        f.life += dt;
        if (f.life >= f.maxLife) {
          flares.splice(i, 1);
          continue;
        }
        const t = f.life / f.maxLife;
        const pulse = t < 0.22 ? t / 0.22 : 1 - (t - 0.22) / 0.78;
        const scale = 0.65 + Math.sin(t * Math.PI) * 0.55;

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.angle);
        ctx.scale(scale, scale);

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, f.rx);
        grad.addColorStop(0, f.coreColor);
        grad.addColorStop(0.32, f.glowColor);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.globalAlpha = Math.max(0, pulse * 0.9);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.rx, f.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Elemental Particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        const damp = Math.pow(p.drag, dt * 60);
        p.vx = (p.vx + p.ax * dt) * damp;
        p.vy = (p.vy + p.ay * dt) * damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;

        const t = p.life / p.maxLife;
        const alpha = t < 0.12 ? t / 0.12 : 1 - Math.pow((t - 0.12) / 0.88, 1.4);
        drawParticleShape(p, Math.max(0, alpha));
      }

      ctx.restore();

      const hasWork =
        bothActive ||
        particlesRef.current.length > 0 ||
        ringsRef.current.length > 0 ||
        flaresRef.current.length > 0 ||
        beamsRef.current.length > 0;

      if (hasWork) {
        rafIdRef.current = window.requestAnimationFrame(tick);
      } else {
        lastTsRef.current = 0;
        rafIdRef.current = null;
      }
    };

    ensureLoopRunning.current = () => {
      if (rafIdRef.current === null && !reducedMotionRef.current) {
        lastTsRef.current = 0;
        rafIdRef.current = window.requestAnimationFrame(tick);
      }
    };

    ensureLoopRunning.current();

    return () => {
      ro.disconnect();
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // Re-kick animation loop when fighters enter or visual FX is toggled on
  useEffect(() => {
    if (enabled && leftFighter && rightFighter) {
      ensureLoopRunning.current();
    }
  }, [enabled, leftFighter, rightFighter, phase]);

  // EVENT 1: Dual Card Clash Burst when two fighters face off in the Arena
  const prevClashPairRef = useRef<string>('');
  useEffect(() => {
    if (!enabled || reducedMotionRef.current) return;
    if (!leftFighter || !rightFighter) {
      if (!leftFighter && !rightFighter) {
        prevClashPairRef.current = '';
      }
      return;
    }
    if (
      phase === 'P2_PRIVACY_CHARACTER' ||
      phase === 'P2_PRIVACY_SUIT' ||
      phase === 'P2_PRIVACY_SUPPORT'
    ) {
      return;
    }

    const pairKey = `${round}:${leftFighter.instance.uid}:${rightFighter.instance.uid}`;
    if (pairKey === prevClashPairRef.current) return;
    prevClashPairRef.current = pairKey;

    const { left, center, right } = getStageAnchors();
    if (sizeRef.current.w <= 10) return;

    const leftTheme = resolveCardElementTheme(leftFighter.def);
    const rightTheme = resolveCardElementTheme(rightFighter.def);

    // Streams rushing from both fighters to center clash point
    beamsRef.current.push(
      {
        x1: left.x,
        y1: left.y,
        x2: center.x,
        y2: center.y,
        life: 0,
        maxLife: 0.34,
        width: 7,
        coreColor: leftTheme.coreHex,
        glowColor: leftTheme.primaryHex,
        jagged: leftTheme.particleKind === 'bolt',
        seed: Math.random() * 20,
      },
      {
        x1: right.x,
        y1: right.y,
        x2: center.x,
        y2: center.y,
        life: 0,
        maxLife: 0.34,
        width: 7,
        coreColor: rightTheme.coreHex,
        glowColor: rightTheme.primaryHex,
        jagged: rightTheme.particleKind === 'bolt',
        seed: Math.random() * 20,
      }
    );

    spawnBurst(left.x, left.y, leftTheme, 20, 70, 210, 95, -20, 1.05);
    spawnBurst(right.x, right.y, rightTheme, 20, 70, 210, -95, -20, 1.05);

    // Center collision flare & shockwave
    spawnBurst(center.x, center.y, leftTheme, 24, 90, 290, -30, -25, 1.15);
    spawnBurst(center.x, center.y, rightTheme, 24, 90, 290, 30, -25, 1.15);
    spawnAnamorphicFlare(center.x, center.y, leftTheme, 1.25, 0.48);
    spawnAnamorphicFlare(center.x, center.y, rightTheme, 1.05, 0.44);
    spawnShockwave(center.x, center.y, leftTheme.primaryHex, 145, 0.48, 5);
    spawnShockwave(center.x, center.y, rightTheme.primaryHex, 110, 0.4, 3.5);

    ensureLoopRunning.current();
  }, [enabled, round, phase, leftFighter, rightFighter]);

  // EVENT 2: Elemental Suit Clash Burst on SUIT_REVEAL
  const prevSuitKeyRef = useRef<string>('');
  useEffect(() => {
    if (!enabled || reducedMotionRef.current) return;
    if (phase !== 'SUIT_REVEAL' || !leftSuit || !rightSuit) return;

    const key = `${round}:${suitAttempt}:${leftSuit}:${rightSuit}`;
    if (key === prevSuitKeyRef.current) return;
    prevSuitKeyRef.current = key;

    const { center } = getStageAnchors();
    if (sizeRef.current.w <= 10) return;

    const leftSuitTheme = resolveSuitElementTheme(leftSuit);
    const rightSuitTheme = resolveSuitElementTheme(rightSuit);

    spawnBurst(center.x - 42, center.y, leftSuitTheme, 22, 65, 220, 80, -15, 1.05);
    spawnBurst(center.x + 42, center.y, rightSuitTheme, 22, 65, 220, -80, -15, 1.05);

    if (suitWinner === 'left') {
      spawnBurst(center.x, center.y, leftSuitTheme, 34, 110, 320, 110, -20, 1.25);
      spawnAnamorphicFlare(center.x, center.y, leftSuitTheme, 1.35, 0.5);
      spawnShockwave(center.x, center.y, leftSuitTheme.primaryHex, 155, 0.48, 5.5);
    } else if (suitWinner === 'right') {
      spawnBurst(center.x, center.y, rightSuitTheme, 34, 110, 320, -110, -20, 1.25);
      spawnAnamorphicFlare(center.x, center.y, rightSuitTheme, 1.35, 0.5);
      spawnShockwave(center.x, center.y, rightSuitTheme.primaryHex, 155, 0.48, 5.5);
    } else {
      spawnAnamorphicFlare(center.x, center.y, ELEMENTAL_PALETTES.LIGHTNING_SOLAR, 1.2, 0.44);
      spawnShockwave(center.x, center.y, leftSuitTheme.primaryHex, 125, 0.44, 4);
      spawnShockwave(center.x, center.y, rightSuitTheme.primaryHex, 95, 0.38, 3.5);
    }

    ensureLoopRunning.current();
  }, [enabled, phase, round, suitAttempt, leftSuit, rightSuit, suitWinner]);

  // EVENT 3: Support Card Empowerment Flare
  const prevSupRef = useRef<{ leftId: string | null; rightId: string | null }>({
    leftId: null,
    rightId: null,
  });
  useEffect(() => {
    const lId = leftSupportCard ? `${round}:${leftSupportCard.id}` : null;
    const rId = rightSupportCard ? `${round}:${rightSupportCard.id}` : null;
    const prev = prevSupRef.current;

    if (enabled && !reducedMotionRef.current && sizeRef.current.w > 10) {
      const anchors = getStageAnchors();
      if (lId && lId !== prev.leftId) {
        const theme = resolveCardElementTheme(leftSupportCard);
        spawnBurst(anchors.left.x, anchors.left.y, theme, 24, 55, 185, 0, -65, 1);
        spawnAnamorphicFlare(anchors.left.x, anchors.left.y, theme, 0.9, 0.38);
        spawnShockwave(anchors.left.x, anchors.left.y, theme.secondaryHex, 95, 0.4, 3.5);
        ensureLoopRunning.current();
      }
      if (rId && rId !== prev.rightId) {
        const theme = resolveCardElementTheme(rightSupportCard);
        spawnBurst(anchors.right.x, anchors.right.y, theme, 24, 55, 185, 0, -65, 1);
        spawnAnamorphicFlare(anchors.right.x, anchors.right.y, theme, 0.9, 0.38);
        spawnShockwave(anchors.right.x, anchors.right.y, theme.secondaryHex, 95, 0.4, 3.5);
        ensureLoopRunning.current();
      }
    }

    prevSupRef.current = { leftId: lId, rightId: rId };
  }, [enabled, round, leftSupportCard, rightSupportCard]);

  // EVENT 4: Attack Beam, Elemental Slash & Damage Detonation
  const prevSignalIdRef = useRef<number>(0);
  useEffect(() => {
    if (!enabled || reducedMotionRef.current || !combatSignal) return;
    if (combatSignal.id === prevSignalIdRef.current) return;
    prevSignalIdRef.current = combatSignal.id;

    if (sizeRef.current.w <= 10) return;
    const { left, right } = getStageAnchors();

    const { attackerSide, leftDelta, rightDelta } = combatSignal;

    if (attackerSide === 'left' && leftFighter) {
      const atkTheme = leftSuit
        ? resolveSuitElementTheme(leftSuit)
        : resolveCardElementTheme(leftFighter.def);
      const charTheme = resolveCardElementTheme(leftFighter.def);
      const dmg = Math.abs(rightDelta ?? 60);
      const heavyHit = dmg >= 100;

      beamsRef.current.push({
        x1: left.x,
        y1: left.y,
        x2: right.x,
        y2: right.y,
        life: 0,
        maxLife: 0.32,
        width: heavyHit ? 10 : 7.5,
        coreColor: charTheme.coreHex,
        glowColor: charTheme.primaryHex,
        jagged: charTheme.particleKind === 'bolt' || heavyHit,
        seed: Math.random() * 30,
      });

      spawnBurst(left.x, left.y, charTheme, 18, 60, 190, 90, -10, 0.95);
      spawnBurst(right.x, right.y, charTheme, heavyHit ? 54 : 38, 95, heavyHit ? 370 : 290, 45, -25, heavyHit ? 1.3 : 1.1);
      if (atkTheme.id !== charTheme.id) {
        spawnBurst(right.x, right.y, atkTheme, 20, 80, 260, 30, -20, 1.05);
      }
      spawnAnamorphicFlare(right.x, right.y, charTheme, heavyHit ? 1.45 : 1.15, 0.46);
      spawnShockwave(right.x, right.y, charTheme.primaryHex, heavyHit ? 165 : 125, 0.46, heavyHit ? 6 : 4.5);
      if (heavyHit) {
        spawnShockwave(right.x, right.y, charTheme.coreHex, 110, 0.34, 3.5);
      }
    } else if (attackerSide === 'right' && rightFighter) {
      const atkTheme = rightSuit
        ? resolveSuitElementTheme(rightSuit)
        : resolveCardElementTheme(rightFighter.def);
      const charTheme = resolveCardElementTheme(rightFighter.def);
      const dmg = Math.abs(leftDelta ?? 60);
      const heavyHit = dmg >= 100;

      beamsRef.current.push({
        x1: right.x,
        y1: right.y,
        x2: left.x,
        y2: left.y,
        life: 0,
        maxLife: 0.32,
        width: heavyHit ? 10 : 7.5,
        coreColor: charTheme.coreHex,
        glowColor: charTheme.primaryHex,
        jagged: charTheme.particleKind === 'bolt' || heavyHit,
        seed: Math.random() * 30,
      });

      spawnBurst(right.x, right.y, charTheme, 18, 60, 190, -90, -10, 0.95);
      spawnBurst(left.x, left.y, charTheme, heavyHit ? 54 : 38, 95, heavyHit ? 370 : 290, -45, -25, heavyHit ? 1.3 : 1.1);
      if (atkTheme.id !== charTheme.id) {
        spawnBurst(left.x, left.y, atkTheme, 20, 80, 260, -30, -20, 1.05);
      }
      spawnAnamorphicFlare(left.x, left.y, charTheme, heavyHit ? 1.45 : 1.15, 0.46);
      spawnShockwave(left.x, left.y, charTheme.primaryHex, heavyHit ? 165 : 125, 0.46, heavyHit ? 6 : 4.5);
      if (heavyHit) {
        spawnShockwave(left.x, left.y, charTheme.coreHex, 110, 0.34, 3.5);
      }
    } else {
      if ((leftDelta ?? 0) < 0) {
        const hitTheme = rightFighter
          ? resolveCardElementTheme(rightFighter.def)
          : ELEMENTAL_PALETTES.FIRE;
        spawnBurst(left.x, left.y, hitTheme, 32, 85, 260, 0, -20, 1.1);
        spawnAnamorphicFlare(left.x, left.y, hitTheme, 1.1, 0.42);
        spawnShockwave(left.x, left.y, hitTheme.primaryHex, 120, 0.42, 4.5);
      }
      if ((rightDelta ?? 0) < 0) {
        const hitTheme = leftFighter
          ? resolveCardElementTheme(leftFighter.def)
          : ELEMENTAL_PALETTES.FIRE;
        spawnBurst(right.x, right.y, hitTheme, 32, 85, 260, 0, -20, 1.1);
        spawnAnamorphicFlare(right.x, right.y, hitTheme, 1.1, 0.42);
        spawnShockwave(right.x, right.y, hitTheme.primaryHex, 120, 0.42, 4.5);
      }
    }

    // Recovery / HP Boost Shimmer
    if ((leftDelta ?? 0) > 0) {
      spawnBurst(left.x, left.y, ELEMENTAL_PALETTES.LEAF_WIND, 24, 45, 165, 0, -75, 0.95);
      spawnShockwave(left.x, left.y, '#34D399', 95, 0.4, 3.5);
    }
    if ((rightDelta ?? 0) > 0) {
      spawnBurst(right.x, right.y, ELEMENTAL_PALETTES.LEAF_WIND, 24, 45, 165, 0, -75, 0.95);
      spawnShockwave(right.x, right.y, '#34D399', 95, 0.4, 3.5);
    }

    ensureLoopRunning.current();
  }, [enabled, combatSignal, leftFighter, rightFighter, leftSuit, rightSuit]);

  // EVENT 5: Knockout (K.O. / FINAL K.O.) Explosive Shockwave & Ember Burst
  const prevKoPhaseKeyRef = useRef<string>('');
  useEffect(() => {
    if (!enabled || reducedMotionRef.current) return;
    if (phase !== 'ROUND_END' && phase !== 'GAME_OVER') {
      if (phase === 'P1_PICK_CHARACTER' || phase === 'SETUP') {
        prevKoPhaseKeyRef.current = '';
      }
      return;
    }

    const koKey = `${round}:${phase}`;
    if (koKey === prevKoPhaseKeyRef.current) return;
    prevKoPhaseKeyRef.current = koKey;

    if (sizeRef.current.w <= 10) return;
    const { left, center, right } = getStageAnchors();
    const fireTheme = ELEMENTAL_PALETTES.FIRE;
    const goldTheme = ELEMENTAL_PALETTES.LIGHTNING_SOLAR;
    const isFinal = phase === 'GAME_OVER';

    spawnBurst(center.x, center.y, fireTheme, isFinal ? 68 : 48, 120, isFinal ? 430 : 350, 0, -25, isFinal ? 1.45 : 1.25);
    spawnBurst(center.x, center.y, goldTheme, isFinal ? 46 : 30, 95, 320, 0, -20, 1.2);
    spawnBurst(left.x, left.y, fireTheme, 22, 70, 230, -35, -20, 1.05);
    spawnBurst(right.x, right.y, fireTheme, 22, 70, 230, 35, -20, 1.05);

    spawnAnamorphicFlare(center.x, center.y, fireTheme, isFinal ? 1.75 : 1.45, 0.58);
    spawnAnamorphicFlare(center.x, center.y, goldTheme, isFinal ? 1.45 : 1.15, 0.5);
    spawnShockwave(center.x, center.y, fireTheme.primaryHex, isFinal ? 230 : 185, 0.56, 7);
    spawnShockwave(center.x, center.y, goldTheme.primaryHex, isFinal ? 175 : 135, 0.46, 5);

    ensureLoopRunning.current();
  }, [enabled, round, phase]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
    />
  );
};
