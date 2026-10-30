import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  EyeOff,
  FastForward,
  Flame,
  Gavel,
  Heart,
  History,
  Layers,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Shield,
  ShoppingBag,
  SkipForward,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import {
  ALL_PACK_SERIES,
  BRAND_LOGOS,
  buildPlayableDeckFromPackSeries,
  CARD_BY_ID,
  deduplicateDeckIds,
  getAvailableSuitArtSets,
  getSuitCardForSet,
  PRESET_DECKS,
} from '../data/cards';
import {
  advanceAfterSuitReveal,
  canPlayCharacterCard,
  createInitialBattleState,
  deployBothCharactersAndResolveEntry,
  FullBattleState,
  playerHasPlayableSupport,
  resolvePendingChoice,
  resolveSuitClash,
  resolveSupportsAndStrike,
  runSimulationToCompletion,
  selectCpuCharacterUid,
  selectCpuSuit,
  selectCpuSupportUid,
  startNextRound,
  stepSimulationOnce,
} from '../engine/battleEngine';
import {
  CardCategory,
  CardDefinition,
  CardInstance,
  CpuDifficulty,
  GameMode,
  type SavedUserDeck,
  type SuitArtSetId,
  SuitElement,
} from '../types/game';
import {
  getFighterHpVisualState,
  isLegendaryCard,
  soundFx,
  useBattleAudioDirector,
} from '../utils/sound';
import { AudioControlWidget, BattleAudioNotice } from './AudioControlPanel';
import {
  ArenaClashFx,
  CardClashAura,
  loadClashFxEnabled,
  persistClashFxEnabled,
  resolveCardElementTheme,
  SuitClashFlare,
} from './ArenaClashFx';
import { CardBack, CardVisual } from './CardVisual';
import { ComboChainBanner, useComboPresentation } from './ComboChainBanner';
import { KoBannerOverlay, useKoPresentation } from './KoOverlay';
import { VictoryCelebrationOverlay } from './VictoryCelebrationOverlay';
import { saveBattleMatch } from '../utils/battleHistoryStore';

const STAGGER_CLASSES = [
  'draw-stagger-0',
  'draw-stagger-1',
  'draw-stagger-2',
  'draw-stagger-3',
  'draw-stagger-4',
] as const;

const FlipRevealCard: React.FC<{
  flipKey: string;
  direction?: 'up' | 'down';
  backSize: 'xs' | 'sm' | 'md';
  backLabel?: string;
  children: React.ReactNode;
}> = ({ flipKey, direction = 'up', backSize, backLabel, children }) => (
  <div key={flipKey} className="card-perspective">
    <div className={direction === 'down' ? 'card-flip-reveal-down' : 'card-flip-reveal-up'}>
      <div className="card-face-front">{children}</div>
      <div className="card-face-back" aria-hidden="true">
        <CardBack size={backSize} label={backLabel} />
      </div>
    </div>
  </div>
);

export interface BattleTabletopProps {
  battleState: FullBattleState;
  setBattleState: React.Dispatch<React.SetStateAction<FullBattleState | null>>;
  onInspectCard: (card: CardDefinition) => void;
  onEditCard?: (card: CardDefinition) => void;
  onRestartMatch: () => void;
  onExitToSetup: () => void;
  onOpenHistory?: () => void;
  exitLabel?: string;
}

export const BattleTabletop: React.FC<BattleTabletopProps> = ({
  battleState,
  setBattleState,
  onInspectCard,
  onEditCard,
  onRestartMatch,
  onExitToSetup,
  onOpenHistory,
  exitLabel = 'Ganti Dek / Mode',
}) => {
  const [selectedHandUid, setSelectedHandUid] = useState<string | null>(null);
  const [choiceSelection, setChoiceSelection] = useState<string[]>([]);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [clashFxEnabled, setClashFxEnabled] = useState<boolean>(() => loadClashFxEnabled());
  const { activeKo, koShaking, dismissKo } = useKoPresentation(battleState, clashFxEnabled);
  const { activeCombo, dismissCombo } = useComboPresentation(battleState, clashFxEnabled);
  const [autoPlaying, setAutoPlaying] = useState<boolean>(false);
  const [autoSpeed, setAutoSpeed] = useState<1 | 2>(1);
  const [zoneInspectModal, setZoneInspectModal] = useState<{
    title: string;
    cards: CardInstance[];
  } | null>(null);

  const isAutoMode = battleState.mode === 'CPU_VS_CPU';
  const lastSavedMatchIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (battleState.phase === 'GAME_OVER') {
      const matchId =
        battleState.matchId ||
        `match-${battleState.round}-${battleState.players[0].winZone.length}-${battleState.players[1].winZone.length}`;
      if (lastSavedMatchIdRef.current !== matchId) {
        lastSavedMatchIdRef.current = matchId;
        saveBattleMatch(battleState);
      }
    }
  }, [battleState]);

  const playAutoStepSound = useCallback((prev: FullBattleState, next: FullBattleState) => {
    if (next.phase === 'ROUND_END') {
      soundFx.playRoundWin();
    } else if (next.phase === 'GAME_OVER') {
      // Handled dynamically by KoOverlay & VictoryCelebrationOverlay
      return;
    } else if (prev.phase === 'P1_PICK_CHARACTER') {
      soundFx.playCardDeploy();
    } else if (next.phase === 'SUIT_REVEAL') {
      soundFx.playSuitClash(next.lastSuitWinner === 'DRAW' ? 'draw' : 'win');
    } else if (prev.phase === 'SUIT_REVEAL' && next.lastSuitWinner !== 'DRAW') {
      soundFx.playHit();
    } else {
      soundFx.playCardSelect();
    }
  }, []);

  useEffect(() => {
    if (!isAutoMode || !autoPlaying) return;
    if (battleState.phase === 'GAME_OVER') {
      setAutoPlaying(false);
      return;
    }
    const delay = autoSpeed === 2 ? 480 : 1000;
    const timer = window.setTimeout(() => {
      setBattleState((prev) => {
        if (!prev || prev.phase === 'GAME_OVER') return prev;
        const next = stepSimulationOnce(prev);
        playAutoStepSound(prev, next);
        if (next.phase === 'GAME_OVER') setAutoPlaying(false);
        return next;
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [isAutoMode, autoPlaying, autoSpeed, battleState, setBattleState, playAutoStepSound]);

  const toggleClashFx = () => {
    setClashFxEnabled((prev) => {
      const next = !prev;
      persistClashFxEnabled(next);
      return next;
    });
  };

  const { phase, players, round, targetWins: winGoal } = battleState;
  const p0 = players[0];
  const p1 = players[1];

  const isP2TurnInPassPlay =
    battleState.mode === 'PASS_AND_PLAY' &&
    (phase === 'P2_PICK_CHARACTER' || phase === 'P2_PICK_SUIT' || phase === 'P2_PICK_SUPPORT');

  const bottomPlayerIndex: 0 | 1 = isP2TurnInPassPlay ? 1 : 0;
  const topPlayerIndex: 0 | 1 = bottomPlayerIndex === 0 ? 1 : 0;
  const bottomPlayer = players[bottomPlayerIndex];
  const topPlayer = players[topPlayerIndex];

  const audioDirector = useBattleAudioDirector(battleState, {
    perspectiveIndex: bottomPlayerIndex,
  });

  const prevHpRef = useRef<{
    p0Uid: string | null;
    p0Hp: number;
    p1Uid: string | null;
    p1Hp: number;
  }>({
    p0Uid: p0.active?.instance.uid ?? null,
    p0Hp: p0.active?.currentHp ?? 0,
    p1Uid: p1.active?.instance.uid ?? null,
    p1Hp: p1.active?.currentHp ?? 0,
  });

  const [combatFx, setCombatFx] = useState<{
    id: number;
    p0Delta: number | null;
    p1Delta: number | null;
    attacker: 0 | 1 | null;
  } | null>(null);

  useEffect(() => {
    const curP0Uid = p0.active?.instance.uid ?? null;
    const curP0Hp = p0.active?.currentHp ?? 0;
    const curP1Uid = p1.active?.instance.uid ?? null;
    const curP1Hp = p1.active?.currentHp ?? 0;

    const prev = prevHpRef.current;
    const p0Delta = curP0Uid && curP0Uid === prev.p0Uid && curP0Hp !== prev.p0Hp ? curP0Hp - prev.p0Hp : null;
    const p1Delta = curP1Uid && curP1Uid === prev.p1Uid && curP1Hp !== prev.p1Hp ? curP1Hp - prev.p1Hp : null;

    prevHpRef.current = {
      p0Uid: curP0Uid,
      p0Hp: curP0Hp,
      p1Uid: curP1Uid,
      p1Hp: curP1Hp,
    };

    if (p0Delta !== null || p1Delta !== null) {
      const attacker: 0 | 1 | null =
        p1Delta !== null && p1Delta < 0 && !(p0Delta !== null && p0Delta < 0)
          ? 0
          : p0Delta !== null && p0Delta < 0 && !(p1Delta !== null && p1Delta < 0)
          ? 1
          : null;

      const fxId = Date.now();
      setCombatFx({ id: fxId, p0Delta, p1Delta, attacker });
      const timer = window.setTimeout(() => {
        setCombatFx((current) => (current?.id === fxId ? null : current));
      }, 650);
      return () => window.clearTimeout(timer);
    }
  }, [p0.active?.instance.uid, p0.active?.currentHp, p1.active?.instance.uid, p1.active?.currentHp]);

  const prevDeckLenRef = useRef<{ p0: number; p1: number }>({
    p0: p0.deck.length,
    p1: p1.deck.length,
  });
  const [deckPulse, setDeckPulse] = useState<{ p0: number; p1: number }>({ p0: 0, p1: 0 });

  useEffect(() => {
    const prev = prevDeckLenRef.current;
    const p0Drew = p0.deck.length < prev.p0;
    const p1Drew = p1.deck.length < prev.p1;
    prevDeckLenRef.current = { p0: p0.deck.length, p1: p1.deck.length };

    if (p0Drew || p1Drew) {
      setDeckPulse((cur) => ({
        p0: p0Drew ? cur.p0 + 1 : cur.p0,
        p1: p1Drew ? cur.p1 + 1 : cur.p1,
      }));
    }
  }, [p0.deck.length, p1.deck.length]);

  const handleConfirmCharacter = (uid: string) => {
    if (isAutoMode) return;
    setStatusFeedback(null);
    setSelectedHandUid(null);
    soundFx.playCardDeploy();

    if (phase === 'P1_PICK_CHARACTER') {
      if (battleState.mode === 'VS_CPU') {
        const cpuUid = selectCpuCharacterUid(p1, p0, battleState.difficulty);
        setBattleState((prev) =>
          prev ? deployBothCharactersAndResolveEntry(prev, uid, cpuUid) : prev
        );
      } else {
        setBattleState((prev) =>
          prev
            ? {
                ...prev,
                phase: 'P2_PRIVACY_CHARACTER',
                players: [{ ...prev.players[0], pendingCharacterUid: uid }, prev.players[1]],
              }
            : prev
        );
      }
    } else if (phase === 'P2_PICK_CHARACTER') {
      const p0Uid = p0.pendingCharacterUid ?? p0.hand[0]?.uid;
      if (p0Uid) {
        setBattleState((prev) =>
          prev ? deployBothCharactersAndResolveEntry(prev, p0Uid, uid) : prev
        );
      }
    }
  };

  const handleSelectSuit = (suit: SuitElement) => {
    if (isAutoMode) return;
    setStatusFeedback(null);
    if (phase === 'P1_PICK_SUIT') {
      if (battleState.mode === 'VS_CPU') {
        const cpuSuit = selectCpuSuit(battleState.difficulty);
        const next = resolveSuitClash(battleState, suit, cpuSuit);
        if (next.lastSuitWinner === 0) soundFx.playSuitClash('win');
        else if (next.lastSuitWinner === 1) soundFx.playSuitClash('lose');
        else soundFx.playSuitClash('draw');
        setBattleState(next);
      } else {
        soundFx.playCardSelect();
        setBattleState((prev) =>
          prev
            ? {
                ...prev,
                phase: 'P2_PRIVACY_SUIT',
                players: [{ ...prev.players[0], selectedSuit: suit }, prev.players[1]],
              }
            : prev
        );
      }
    } else if (phase === 'P2_PICK_SUIT') {
      const p0Suit = p0.selectedSuit ?? SuitElement.API;
      const next = resolveSuitClash(battleState, p0Suit, suit);
      soundFx.playSuitClash(next.lastSuitWinner === 'DRAW' ? 'draw' : 'win');
      setBattleState(next);
    }
  };

  const handlePlayOrSkipSupport = (supportUid: string | null) => {
    if (isAutoMode) return;
    setSelectedHandUid(null);
    setStatusFeedback(null);

    if (phase === 'P1_PICK_SUPPORT') {
      if (battleState.mode === 'VS_CPU') {
        const cpuSup =
          battleState.lastSuitWinner === 0 || battleState.lastSuitWinner === 1
            ? selectCpuSupportUid(p1, p0, battleState.lastSuitWinner, battleState.difficulty)
            : null;
        const next = resolveSupportsAndStrike(battleState, supportUid, cpuSup);
        if (next.phase === 'ROUND_END') soundFx.playRoundWin();
        else if (next.phase !== 'GAME_OVER') soundFx.playHit();
        setBattleState(next);
      } else {
        const p2HasSup = playerHasPlayableSupport(p1, p0);
        if (p2HasSup) {
          soundFx.playCardSelect();
          setBattleState((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'P2_PRIVACY_SUPPORT',
                  players: [{ ...prev.players[0], pendingSupportUid: supportUid }, prev.players[1]],
                }
              : prev
          );
        } else {
          const next = resolveSupportsAndStrike(battleState, supportUid, null);
          if (next.phase === 'ROUND_END') soundFx.playRoundWin();
          else if (next.phase !== 'GAME_OVER') soundFx.playHit();
          setBattleState(next);
        }
      }
    } else if (phase === 'P2_PICK_SUPPORT') {
      const next = resolveSupportsAndStrike(battleState, p0.pendingSupportUid, supportUid);
      if (next.phase === 'ROUND_END') soundFx.playRoundWin();
      else if (next.phase !== 'GAME_OVER') soundFx.playHit();
      setBattleState(next);
    }
  };

  const handleAdvanceSuitReveal = () => {
    const next = advanceAfterSuitReveal(battleState);
    if (
      battleState.lastSuitWinner !== 'DRAW' &&
      (next.phase === 'P1_PICK_SUIT' || next.phase === 'ROUND_END' || next.phase === 'GAME_OVER')
    ) {
      if (next.phase === 'ROUND_END') soundFx.playRoundWin();
      else if (next.phase !== 'GAME_OVER') soundFx.playHit();
    } else {
      soundFx.playCardSelect();
    }
    setBattleState(next);
  };

  const getPhaseHeadline = (): { title: string; detail: string } => {
    if (isAutoMode && phase !== 'GAME_OVER') {
      return {
        title: `Pertarungan Otomatis · Ronde ${round}${battleState.maxRounds ? `/${battleState.maxRounds}` : ''}`,
        detail:
          'Gunakan tombol Mulai Otomatis, Langkah, atau Selesai Instan pada bilah kontrol di atas.',
      };
    }

    switch (phase) {
      case 'P1_PICK_CHARACTER':
        return {
          title: `Giliran ${p0.name}: Pilih Kartu Karakter Unik`,
          detail: 'Klik 1 Kartu Karakter dari tangan untuk diturunkan ke Zona Aktif (hanya bisa dipakai 1 kali).',
        };
      case 'P2_PICK_CHARACTER':
        return {
          title: `Giliran ${p1.name}: Pilih Kartu Karakter Unik`,
          detail: 'Klik 1 Kartu Karakter dari tangan untuk menghadapi lawan di Zona Aktif.',
        };
      case 'P1_PICK_SUIT':
        return {
          title: `Adu Suit #${battleState.suitAttemptInRound} — ${p0.name} Pilih Elemen`,
          detail: 'Pilih Kartu Suit Air, Api, atau Daun untuk menentukan siapa yang melancarkan serangan.',
        };
      case 'P2_PICK_SUIT':
        return {
          title: `Adu Suit #${battleState.suitAttemptInRound} — ${p1.name} Pilih Elemen`,
          detail: 'Pilih Kartu Suit Air, Api, atau Daun untuk diadu secara serentak.',
        };
      case 'SUIT_REVEAL':
        return {
          title:
            battleState.lastSuitWinner === 'DRAW'
              ? 'Hasil Suit: SERI!'
              : `${players[battleState.lastSuitWinner ?? 0].name} Memenangkan Adu Suit!`,
          detail:
            battleState.lastSuitWinner === 'DRAW'
              ? 'Elemen sama! Klik tombol Adu Suit Ulang untuk menentukan penyerang.'
              : 'Lanjutkan untuk menggunakan Kartu Pendukung (jika ada) atau langsung melancarkan serangan ATK.',
        };
      case 'P1_PICK_SUPPORT':
        return {
          title: `${p0.name}: Opsi Kartu Pendukung`,
          detail: 'Pilih 1 Kartu Pendukung di tangan untuk diaktifkan sekarang, atau lewati untuk langsung lanjut.',
        };
      case 'P2_PICK_SUPPORT':
        return {
          title: `${p1.name}: Opsi Kartu Pendukung`,
          detail: 'Pilih 1 Kartu Pendukung di tangan untuk diaktifkan sekarang, atau lewati untuk menyelesaikan serangan.',
        };
      case 'ROUND_END':
        return {
          title: `Ronde ${round} Selesai`,
          detail: battleState.roundSummaryText ?? 'Satu kartu telah tumbang. Siap menuju ronde berikutnya.',
        };
      case 'GAME_OVER':
        return {
          title:
            battleState.winnerIndex === 'DRAW'
              ? 'Pertandingan Selesai — Hasil Seri!'
              : `Pertandingan Selesai — ${
                  players[battleState.winnerIndex === 1 ? 1 : 0].name
                } Menang!`,
          detail: battleState.winReason ?? '',
        };
      default:
        return {
          title: 'Resolusi Efek Kartu',
          detail: 'Selesaikan pilihan efek kartu yang sedang aktif.',
        };
    }
  };

  const phaseHeadline = getPhaseHeadline();
  const activeChoice = battleState.choiceQueue[0] ?? null;
  const selectedHandCardDef = selectedHandUid
    ? CARD_BY_ID[bottomPlayer.hand.find((c) => c.uid === selectedHandUid)?.defId ?? '']
    : null;

  const bothActiveFaceOff =
    Boolean(p0.active && p1.active) &&
    phase !== 'P2_PRIVACY_CHARACTER' &&
    phase !== 'P2_PRIVACY_SUIT' &&
    phase !== 'P2_PRIVACY_SUPPORT';

  const combatSignal = useMemo(
    () =>
      combatFx
        ? {
            id: combatFx.id,
            attackerSide:
              combatFx.attacker === 0
                ? ('left' as const)
                : combatFx.attacker === 1
                ? ('right' as const)
                : null,
            leftDelta: combatFx.p0Delta,
            rightDelta: combatFx.p1Delta,
          }
        : null,
    [combatFx]
  );

  return (
    <section className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 space-y-4">
      {/* Compact Match Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#131C31] border border-slate-800 rounded-xl">
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-mono tabular-nums">
          <span className="font-bold text-amber-400">
            Ronde {round}
            {battleState.maxRounds ? `/${battleState.maxRounds}` : ''}
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="text-slate-300">
            {battleState.maxRounds
              ? `Format ${battleState.maxRounds} Ronde`
              : `Target Menang: ${winGoal} Kartu`}
          </span>
          <span className="hidden sm:inline text-slate-600" aria-hidden="true">·</span>
          <span className="hidden sm:inline text-slate-400">
            Zona Menang: {p0.name} {p0.winZone.length} - {p1.winZone.length} {p1.name}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAutoMode && phase !== 'GAME_OVER' && (
            <>
              <button
                type="button"
                onClick={() => setAutoPlaying((prev) => !prev)}
                className="px-3.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {autoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{autoPlaying ? 'Jeda' : 'Mulai Otomatis'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAutoPlaying(false);
                  setBattleState((prev) => {
                    if (!prev || prev.phase === 'GAME_OVER') return prev;
                    const next = stepSimulationOnce(prev);
                    playAutoStepSound(prev, next);
                    return next;
                  });
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Langkah</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAutoPlaying(false);
                  setBattleState((prev) => (prev ? runSimulationToCompletion(prev) : prev));
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Selesai Instan</span>
              </button>
              <button
                type="button"
                onClick={() => setAutoSpeed((s) => (s === 1 ? 2 : 1))}
                className="px-2.5 py-1.5 text-xs font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors tabular-nums whitespace-nowrap shrink-0"
              >
                {autoSpeed}x
              </button>
            </>
          )}

          <button
            type="button"
            onClick={toggleClashFx}
            aria-label={clashFxEnabled ? 'Matikan efek partikel' : 'Nyalakan efek partikel'}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              clashFxEnabled
                ? 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {clashFxEnabled ? 'Partikel Aktif' : 'Partikel Mati'}
            </span>
          </button>

          <AudioControlWidget />

          <button
            type="button"
            onClick={() => {
              setAutoPlaying(false);
              onExitToSetup();
            }}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{exitLabel}</span>
          </button>
        </div>
      </div>

      <BattleAudioNotice
        isCriticalPhase={audioDirector.isCriticalPhase}
        hasLegendaryActive={audioDirector.hasLegendaryActive}
        criticalNames={audioDirector.criticalNames}
        legendaryNames={audioDirector.legendaryNames}
      />

      {/* OPPONENT / TOP PLAYER BAR */}
      <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center justify-between lg:justify-start gap-5">
          <div>
            <div className="text-xs text-slate-400">Pihak Lawan</div>
            <div className="text-base font-display font-bold text-white">{topPlayer.name}</div>
            <div className="mt-0.5 text-xs text-slate-400 truncate max-w-[280px]">
              {topPlayer.usedCharacterTags.length > 0
                ? `Pernah Dipakai: ${topPlayer.usedCharacterTags.slice(-4).join(' · ')}`
                : 'Belum ada kartu yang dipakai'}
            </div>
          </div>

          <div className="flex items-center -space-x-6 sm:-space-x-5 pl-2">
            {topPlayer.hand.length === 0 ? (
              <span className="text-xs text-slate-500 font-mono">0 Kartu Tangan</span>
            ) : (
              topPlayer.hand.slice(0, 6).map((inst) => (
                <div
                  key={inst.uid}
                  className="animate-opponent-draw transition-transform duration-150 hover:-translate-y-1"
                >
                  <CardBack size="xs" />
                </div>
              ))
            )}
            {topPlayer.hand.length > 6 && (
              <span className="pl-7 text-xs font-mono text-slate-300 tabular-nums">
                +{topPlayer.hand.length - 6}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono tabular-nums">
          <div
            key={`top-deck-${topPlayerIndex}-${topPlayerIndex === 0 ? deckPulse.p0 : deckPulse.p1}`}
            className="animate-deck-draw px-3 py-2 rounded-xl bg-[#0B1120] border border-slate-800 text-slate-300 flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Sisa Dek Unik: {topPlayer.deck.length}</span>
          </div>

          <button
            type="button"
            onClick={() =>
              setZoneInspectModal({
                title: `Zona Menang — ${topPlayer.name} (${topPlayer.winZone.length})`,
                cards: topPlayer.winZone,
              })
            }
            className="px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 border border-slate-700 text-amber-300 font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>
              Zona Menang: {topPlayer.winZone.length}
              {!battleState.maxRounds ? `/${winGoal}` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setZoneInspectModal({
                title: `Zona Kalah (Habis Dipakai) — ${topPlayer.name} (${topPlayer.loseZone.length})`,
                cards: topPlayer.loseZone,
              })
            }
            className="px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <span>Habis Dipakai: {topPlayer.loseZone.length}</span>
          </button>
        </div>
      </div>

      {/* CENTER ARENA MAT (ACTIVE ZONE & SUIT STAGE) */}
      <div
        className={`relative overflow-hidden bg-[#11192C] border border-slate-800 rounded-2xl p-4 sm:p-6 ${
          koShaking ? 'animate-ko-arena-shake' : ''
        }`}
      >
        <ArenaClashFx
          phase={phase}
          round={round}
          suitAttempt={battleState.suitAttemptInRound}
          leftFighter={p0.active}
          rightFighter={p1.active}
          leftSuit={p0.selectedSuit}
          rightSuit={p1.selectedSuit}
          suitWinner={
            battleState.lastSuitWinner === 0
              ? 'left'
              : battleState.lastSuitWinner === 1
              ? 'right'
              : battleState.lastSuitWinner === 'DRAW'
              ? 'draw'
              : null
          }
          leftSupportCard={p0.playedSupportCard}
          rightSupportCard={p1.playedSupportCard}
          combatSignal={combatSignal}
          enabled={clashFxEnabled}
        />

        <KoBannerOverlay ko={activeKo} onDismiss={dismissKo} />
        <ComboChainBanner
          combo={activeCombo}
          onDismiss={dismissCombo}
          hidden={Boolean(activeKo)}
        />

        <div className="relative z-10 text-center pb-5 border-b border-slate-800/80">
          <h2 className="text-lg sm:text-xl font-display font-bold text-white">
            {phaseHeadline.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-300">{phaseHeadline.detail}</p>
          {statusFeedback && (
            <p className="mt-2 text-xs font-medium text-amber-300">{statusFeedback}</p>
          )}
        </div>

        <div className="relative z-10 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Player 1 Active Zone */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="text-xs font-semibold text-amber-300 mb-2 text-center">
              Zona Aktif · {p0.name}
              {p0.active ? ` · ${resolveCardElementTheme(p0.active.def).label}` : ''}
              {p0.active && isLegendaryCard(p0.active.def) ? ` · Legendaris ${p0.active.def.rank}` : ''}
            </div>

            {p0.active ? (
              <div className="relative flex flex-col items-center w-full max-w-[240px]">
                {combatFx?.p0Delta !== null && combatFx?.p0Delta !== undefined && (
                  <div
                    key={`p0-dmg-${combatFx.id}`}
                    className={`animate-damage-pop pointer-events-none absolute -top-3 z-30 px-2.5 py-0.5 rounded-md font-mono text-xs font-extrabold tabular-nums shadow-lg ${
                      combatFx.p0Delta < 0
                        ? 'bg-rose-500 text-white'
                        : 'bg-emerald-400 text-slate-950'
                    }`}
                  >
                    {combatFx.p0Delta > 0 ? `+${combatFx.p0Delta} HP` : `${combatFx.p0Delta} HP`}
                  </div>
                )}

                <div
                  key={`p0-motion-${combatFx?.id ?? 0}`}
                  className={`relative ${
                    combatFx?.attacker === 0
                      ? 'animate-strike-right'
                      : (combatFx?.p0Delta ?? 0) < 0
                      ? 'animate-hit-shake'
                      : ''
                  }`}
                >
                  <CardClashAura
                    card={p0.active.def}
                    opponentCard={p1.active?.def ?? null}
                    activeClash={bothActiveFaceOff}
                    isAttacking={combatFx?.attacker === 0}
                    isHit={(combatFx?.p0Delta ?? 0) < 0}
                    enabled={clashFxEnabled}
                    burstKey={combatFx?.id}
                  />
                  <div className="relative z-10">
                    <FlipRevealCard
                      flipKey={`p0-active-${round}-${p0.active.instance.uid}`}
                      direction="up"
                      backSize="md"
                      backLabel={p0.name}
                    >
                      <CardVisual
                        card={p0.active.def}
                        size="md"
                        activeFighter={p0.active}
                        onClick={() => onInspectCard(p0.active!.def)}
                        onInspect={onInspectCard}
                        onEdit={onEditCard}
                      />
                    </FlipRevealCard>
                  </div>
                </div>

                {p0.playedSupportCard && (
                  <button
                    key={`p0-sup-${round}-${p0.playedSupportCard.id}`}
                    type="button"
                    onClick={() => onInspectCard(p0.playedSupportCard!)}
                    className="animate-support-pop mt-2 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-[11px] font-medium text-amber-200 transition-colors whitespace-nowrap shrink-0 max-w-full truncate"
                  >
                    Pendukung Aktif: {p0.playedSupportCard.name}
                  </button>
                )}

                {(() => {
                  const p0HpVis = getFighterHpVisualState(p0.active, 'emerald');
                  return (
                    <div className="mt-3 w-full">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className={`flex items-center gap-1 font-bold ${p0HpVis.labelClass}`}>
                          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                          <span>
                            HP {p0.active.currentHp}/{p0.active.maxHp}
                            {p0HpVis.isCritical ? ' · KRITIS' : ''}
                          </span>
                        </span>
                        <span className="text-emerald-300 font-bold">ATK {p0.active.currentAtk}</span>
                      </div>
                      <svg
                        viewBox="0 0 100 8"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        className="mt-1.5 h-2 w-full rounded-sm bg-slate-800 overflow-hidden"
                      >
                        <rect
                          x="0"
                          y="0"
                          width={
                            Math.max(
                              0,
                              Math.min(1, p0.active.currentHp / Math.max(1, p0.active.maxHp))
                            ) * 100
                          }
                          height="8"
                          className={p0HpVis.barFillClass}
                        />
                      </svg>
                      {p0.active.statusNotes.length > 0 && (
                        <div className="mt-2 text-[11px] text-amber-200 text-center">
                          {p0.active.statusNotes.join(' · ')}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : p0.pendingCharacterUid ? (
              <div className="animate-card-lock flex flex-col items-center">
                <CardBack size="md" label="Siap Bertarung" />
                <span className="mt-2 text-xs text-slate-400">{p0.name} sudah mengunci kartu</span>
              </div>
            ) : (
              <div className="w-36 sm:w-44 aspect-[5/7] rounded-xl border border-dashed border-slate-700 bg-[#0B1120]/60 flex flex-col items-center justify-center p-4 text-center">
                <Swords className="w-6 h-6 text-slate-600 mb-2" />
                <span className="text-xs text-slate-500">Menunggu Kartu Karakter</span>
              </div>
            )}
          </div>

          {/* Center Suit / Action Clash Stage */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center min-h-[250px] bg-[#0B1120] border border-slate-800/90 rounded-2xl p-5">
            {!isAutoMode && (phase === 'P1_PICK_SUIT' || phase === 'P2_PICK_SUIT') && (
              <div className="w-full flex flex-col items-center">
                <div className="text-xs font-mono text-slate-400 mb-3 text-center">
                  Pilih Kartu Suit ({bottomPlayer.name}) · Air &gt; Api &gt; Daun &gt; Air
                </div>
                <div className="flex items-center justify-center gap-3">
                  {[SuitElement.AIR, SuitElement.API, SuitElement.DAUN].map((el, idx) => {
                    const suitCard = getSuitCardForSet(el, bottomPlayer.suitArtSet);
                    return (
                      <div
                        key={el}
                        className={`animate-card-draw ${STAGGER_CLASSES[idx] ?? 'draw-stagger-0'} flex flex-col items-center`}
                      >
                        <CardVisual
                          card={suitCard}
                          size="xs"
                          onClick={() => handleSelectSuit(el)}
                          onInspect={onInspectCard}
                        />
                        <button
                          type="button"
                          onClick={() => handleSelectSuit(el)}
                          className="mt-2 px-3 py-1 text-xs font-bold bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-100 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 whitespace-nowrap shrink-0"
                        >
                          {el}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isAutoMode && (phase === 'P1_PICK_SUIT' || phase === 'P1_PICK_CHARACTER') && (
              <div className="w-full flex flex-col items-center text-center">
                <Flame className="w-7 h-7 text-amber-400 mb-2" />
                <div className="text-sm font-display font-bold text-white tabular-nums">
                  {phase === 'P1_PICK_CHARACTER'
                    ? `Siap Menurunkan Karakter Ronde ${round}`
                    : `Siap Adu Suit #${battleState.suitAttemptInRound}`}
                </div>
                <p className="mt-1 text-xs text-slate-400 max-w-xs">
                  Tekan Mulai Otomatis atau Langkah pada bilah kontrol untuk melanjutkan aksi AI.
                </p>
              </div>
            )}

            {phase === 'SUIT_REVEAL' && p0.selectedSuit && p1.selectedSuit && (
              <div className="w-full flex flex-col items-center">
                <div className="flex items-center justify-center gap-4">
                  <div
                    className={`flex flex-col items-center transition-transform duration-200 ${
                      battleState.lastSuitWinner === 0
                        ? 'scale-105'
                        : battleState.lastSuitWinner === 1
                        ? 'scale-95 opacity-80'
                        : ''
                    }`}
                  >
                    <span className="text-[11px] text-amber-300 font-semibold mb-1.5">
                      {p0.name}
                    </span>
                    <FlipRevealCard
                      flipKey={`suit-p0-${round}-${battleState.suitAttemptInRound}`}
                      direction="up"
                      backSize="xs"
                    >
                      <CardVisual
                        card={getSuitCardForSet(p0.selectedSuit, p0.suitArtSet)}
                        size="xs"
                        selected={battleState.lastSuitWinner === 0}
                      />
                    </FlipRevealCard>
                  </div>
                  <SuitClashFlare
                    leftSuit={p0.selectedSuit}
                    rightSuit={p1.selectedSuit}
                    winner={
                      battleState.lastSuitWinner === 0
                        ? 'left'
                        : battleState.lastSuitWinner === 1
                        ? 'right'
                        : 'draw'
                    }
                    clashKey={`suit-vs-${round}-${battleState.suitAttemptInRound}`}
                    enabled={clashFxEnabled}
                  />
                  <div
                    className={`flex flex-col items-center transition-transform duration-200 ${
                      battleState.lastSuitWinner === 1
                        ? 'scale-105'
                        : battleState.lastSuitWinner === 0
                        ? 'scale-95 opacity-80'
                        : ''
                    }`}
                  >
                    <span className="text-[11px] text-sky-300 font-semibold mb-1.5">
                      {p1.name}
                    </span>
                    <FlipRevealCard
                      flipKey={`suit-p1-${round}-${battleState.suitAttemptInRound}`}
                      direction="down"
                      backSize="xs"
                    >
                      <CardVisual
                        card={getSuitCardForSet(p1.selectedSuit, p1.suitArtSet)}
                        size="xs"
                        selected={battleState.lastSuitWinner === 1}
                      />
                    </FlipRevealCard>
                  </div>
                </div>

                {!isAutoMode && (
                  <button
                    type="button"
                    onClick={handleAdvanceSuitReveal}
                    className="mt-5 px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-all duration-150 hover:scale-[1.03] active:scale-[0.98] whitespace-nowrap shrink-0"
                  >
                    {battleState.lastSuitWinner === 'DRAW'
                      ? 'Seri! Adu Suit Ulang'
                      : 'Lanjutkan Serangan / Pendukung'}
                  </button>
                )}
              </div>
            )}

            {!isAutoMode && (phase === 'P1_PICK_SUPPORT' || phase === 'P2_PICK_SUPPORT') && (
              <div className="w-full flex flex-col items-center text-center">
                <Shield className="w-7 h-7 text-amber-400 mb-2" />
                <div className="text-sm font-display font-bold text-white">
                  Jendela Kartu Pendukung ({bottomPlayer.name})
                </div>
                <p className="mt-1 text-xs text-slate-400 max-w-xs">
                  Pemenang Suit saat ini:{' '}
                  <strong className="text-slate-200">
                    {players[battleState.lastSuitWinner === 1 ? 1 : 0].name}
                  </strong>
                  . Klik Kartu Pendukung di tangan bawah bila ingin memakainya, atau lewati.
                </p>
                <button
                  type="button"
                  onClick={() => handlePlayOrSkipSupport(null)}
                  className="mt-4 px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Lewati &amp; Lancarkan Serangan
                </button>
              </div>
            )}

            {!isAutoMode && (phase === 'P1_PICK_CHARACTER' || phase === 'P2_PICK_CHARACTER') && (
              <div className="w-full flex flex-col items-center text-center">
                <Flame className="w-7 h-7 text-amber-400 mb-2" />
                <div className="text-sm font-display font-bold text-white">
                  Persiapan Zona Aktif — Ronde {round}
                </div>
                <p className="mt-1 text-xs text-slate-400 max-w-xs">
                  Pilih 1 Kartu Karakter unik dari tanganmu di bawah. Setiap kartu hanya bisa diturunkan sekali selama pertandingan.
                </p>
                {selectedHandCardDef && (
                  <button
                    type="button"
                    onClick={() => selectedHandUid && handleConfirmCharacter(selectedHandUid)}
                    className="mt-4 px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Check className="w-4 h-4" />
                    Turunkan {selectedHandCardDef.name}
                  </button>
                )}
              </div>
            )}

            {phase === 'ROUND_END' && (
              <div className="w-full flex flex-col items-center text-center">
                <Trophy className="w-8 h-8 text-amber-400 mb-2" />
                <div className="text-base font-display font-bold text-white">Ronde {round} Tuntas</div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  {battleState.roundSummaryText}
                </p>
                {!isAutoMode && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playCardDeploy();
                      setBattleState((prev) => (prev ? startNextRound(prev) : prev));
                    }}
                    className="mt-4 px-5 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    Mulai Ronde {round + 1}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Player 2 / CPU Active Zone */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="text-xs font-semibold text-sky-300 mb-2 text-center">
              Zona Aktif · {p1.name}
              {p1.active ? ` · ${resolveCardElementTheme(p1.active.def).label}` : ''}
              {p1.active && isLegendaryCard(p1.active.def) ? ` · Legendaris ${p1.active.def.rank}` : ''}
            </div>

            {p1.active ? (
              <div className="relative flex flex-col items-center w-full max-w-[240px]">
                {combatFx?.p1Delta !== null && combatFx?.p1Delta !== undefined && (
                  <div
                    key={`p1-dmg-${combatFx.id}`}
                    className={`animate-damage-pop pointer-events-none absolute -top-3 z-30 px-2.5 py-0.5 rounded-md font-mono text-xs font-extrabold tabular-nums shadow-lg ${
                      combatFx.p1Delta < 0
                        ? 'bg-rose-500 text-white'
                        : 'bg-emerald-400 text-slate-950'
                    }`}
                  >
                    {combatFx.p1Delta > 0 ? `+${combatFx.p1Delta} HP` : `${combatFx.p1Delta} HP`}
                  </div>
                )}

                <div
                  key={`p1-motion-${combatFx?.id ?? 0}`}
                  className={`relative ${
                    combatFx?.attacker === 1
                      ? 'animate-strike-left'
                      : (combatFx?.p1Delta ?? 0) < 0
                      ? 'animate-hit-shake'
                      : ''
                  }`}
                >
                  <CardClashAura
                    card={p1.active.def}
                    opponentCard={p0.active?.def ?? null}
                    activeClash={bothActiveFaceOff}
                    isAttacking={combatFx?.attacker === 1}
                    isHit={(combatFx?.p1Delta ?? 0) < 0}
                    enabled={clashFxEnabled}
                    burstKey={combatFx?.id}
                  />
                  <div className="relative z-10">
                    <FlipRevealCard
                      flipKey={`p1-active-${round}-${p1.active.instance.uid}`}
                      direction="down"
                      backSize="md"
                      backLabel={p1.name}
                    >
                      <CardVisual
                        card={p1.active.def}
                        size="md"
                        activeFighter={p1.active}
                        onClick={() => onInspectCard(p1.active!.def)}
                        onInspect={onInspectCard}
                        onEdit={onEditCard}
                      />
                    </FlipRevealCard>
                  </div>
                </div>

                {p1.playedSupportCard && (
                  <button
                    key={`p1-sup-${round}-${p1.playedSupportCard.id}`}
                    type="button"
                    onClick={() => onInspectCard(p1.playedSupportCard!)}
                    className="animate-support-pop mt-2 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-[11px] font-medium text-sky-200 transition-colors whitespace-nowrap shrink-0 max-w-full truncate"
                  >
                    Pendukung Aktif: {p1.playedSupportCard.name}
                  </button>
                )}

                {(() => {
                  const p1HpVis = getFighterHpVisualState(p1.active, 'sky');
                  return (
                    <div className="mt-3 w-full">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className={`flex items-center gap-1 font-bold ${p1HpVis.labelClass}`}>
                          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                          <span>
                            HP {p1.active.currentHp}/{p1.active.maxHp}
                            {p1HpVis.isCritical ? ' · KRITIS' : ''}
                          </span>
                        </span>
                        <span className="text-emerald-300 font-bold">ATK {p1.active.currentAtk}</span>
                      </div>
                      <svg
                        viewBox="0 0 100 8"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        className="mt-1.5 h-2 w-full rounded-sm bg-slate-800 overflow-hidden"
                      >
                        <rect
                          x="0"
                          y="0"
                          width={
                            Math.max(
                              0,
                              Math.min(1, p1.active.currentHp / Math.max(1, p1.active.maxHp))
                            ) * 100
                          }
                          height="8"
                          className={p1HpVis.barFillClass}
                        />
                      </svg>
                      {p1.active.statusNotes.length > 0 && (
                        <div className="mt-2 text-[11px] text-sky-200 text-center">
                          {p1.active.statusNotes.join(' · ')}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="w-36 sm:w-44 aspect-[5/7] rounded-xl border border-dashed border-slate-700 bg-[#0B1120]/60 flex flex-col items-center justify-center p-4 text-center">
                <Swords className="w-6 h-6 text-slate-600 mb-2" />
                <span className="text-xs text-slate-500">Menunggu Kartu Lawan</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM ACTIVE PLAYER HAND & ZONES */}
      <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="text-sm font-display font-bold text-white">
              Tangan {bottomPlayer.name} ({bottomPlayer.hand.length} Kartu Unik)
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              {bottomPlayer.usedCharacterTags.length > 0
                ? `Karakter Sudah Dipakai Sekali: ${bottomPlayer.usedCharacterTags.join(' · ')}`
                : 'Belum ada Karakter yang pernah diturunkan'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono tabular-nums">
            <div
              key={`bottom-deck-${bottomPlayerIndex}-${
                bottomPlayerIndex === 0 ? deckPulse.p0 : deckPulse.p1
              }`}
              className="animate-deck-draw px-3 py-2 rounded-xl bg-[#0B1120] border border-slate-800 text-slate-300 flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Sisa Dek Unik: {bottomPlayer.deck.length}</span>
            </div>

            <button
              type="button"
              onClick={() =>
                setZoneInspectModal({
                  title: `Zona Menang — ${bottomPlayer.name} (${bottomPlayer.winZone.length})`,
                  cards: bottomPlayer.winZone,
                })
              }
              className="px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 border border-slate-700 text-amber-300 font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>
                Zona Menang: {bottomPlayer.winZone.length}
                {!battleState.maxRounds ? `/${winGoal}` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setZoneInspectModal({
                  title: `Zona Kalah (Habis Dipakai) — ${bottomPlayer.name} (${bottomPlayer.loseZone.length})`,
                  cards: bottomPlayer.loseZone,
                })
              }
              className="px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Habis Dipakai: {bottomPlayer.loseZone.length}</span>
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-start justify-center gap-3 sm:gap-4">
          {bottomPlayer.hand.length === 0 ? (
            <div className="py-8 text-sm text-slate-400">Tidak ada kartu di tangan saat ini.</div>
          ) : (
            bottomPlayer.hand.map((inst, handIdx) => {
              const def = CARD_BY_ID[inst.defId];
              if (!def) return null;
              const isCharacterPhase =
                !isAutoMode && (phase === 'P1_PICK_CHARACTER' || phase === 'P2_PICK_CHARACTER');
              const isSupportPhase =
                !isAutoMode && (phase === 'P1_PICK_SUPPORT' || phase === 'P2_PICK_SUPPORT');

              const charCheck = canPlayCharacterCard(def, bottomPlayer.usedCharacterTags);
              const isSupportLocked = Boolean(topPlayer.active?.blockEnemySupport);
              const isPlayableNow = isCharacterPhase
                ? charCheck.playable
                : isSupportPhase
                ? def.category === CardCategory.SUPPORT && !isSupportLocked
                : false;

              const isSelected = selectedHandUid === inst.uid;
              const isReadyConditional = Boolean(def.condition) && charCheck.playable;
              const staggerClass =
                round === 1 && bottomPlayer.usedCharacterTags.length === 0
                  ? (STAGGER_CLASSES[handIdx] ?? '')
                  : '';

              return (
                <div
                  key={inst.uid}
                  className={`animate-card-draw ${staggerClass} flex flex-col items-center w-28 sm:w-32`}
                >
                  <CardVisual
                    card={def}
                    size="sm"
                    selected={isSelected}
                    disabled={(isCharacterPhase || isSupportPhase) && !isPlayableNow}
                    disabledReason={
                      isSupportPhase && isSupportLocked
                        ? 'Kartu Pendukung dikunci oleh efek lawan'
                        : charCheck.reason
                    }
                    conditionalReady={isReadyConditional}
                    onInspect={onInspectCard}
                    onEdit={onEditCard}
                    onClick={() => {
                      if (isCharacterPhase) {
                        if (!charCheck.playable) {
                          setStatusFeedback(charCheck.reason ?? 'Kartu ini belum dapat digunakan.');
                          return;
                        }
                        if (selectedHandUid === inst.uid) {
                          handleConfirmCharacter(inst.uid);
                        } else {
                          soundFx.playCardSelect();
                          setSelectedHandUid(inst.uid);
                          setStatusFeedback(
                            `${def.name} dipilih — klik sekali lagi atau tekan tombol Turunkan untuk mengonfirmasi.`
                          );
                        }
                      } else if (isSupportPhase) {
                        if (isSupportLocked) {
                          setStatusFeedback(
                            'Kartu Pendukung tidak dapat digunakan karena efek karakter lawan!'
                          );
                        } else if (def.category === CardCategory.SUPPORT) {
                          handlePlayOrSkipSupport(inst.uid);
                        } else {
                          setStatusFeedback('Hanya Kartu Pendukung yang bisa digunakan pada fase ini.');
                        }
                      } else {
                        onInspectCard(def);
                      }
                    }}
                  />
                  <div className="mt-1.5 text-center w-full">
                    <div className="text-[11px] font-semibold text-slate-200 truncate">{def.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                      {def.category === CardCategory.CHARACTER
                        ? `${def.hp}/${def.atk} · 0${def.effectPriority ?? 3}`
                        : `Pendukung · 0${def.effectPriority ?? 2}`}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ROUND HISTORY RECAP & BATTLE LOG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {battleState.roundHistory.length > 0 && (
          <div className="lg:col-span-6 bg-[#131C31] border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-semibold text-slate-400 mb-2">
              Riwayat Ronde (Kartu Sekali Pakai)
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-800/80 text-xs">
              {battleState.roundHistory.map((rec) => {
                const c0 = CARD_BY_ID[rec.p0CardId];
                const c1 = CARD_BY_ID[rec.p1CardId];
                return (
                  <div key={rec.round} className="py-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-slate-400 tabular-nums shrink-0">
                      R{rec.round}
                    </span>
                    <span className="truncate text-slate-200 flex-1">
                      {c0?.name ?? rec.p0CardId} <span className="text-slate-500">vs</span>{' '}
                      {c1?.name ?? rec.p1CardId}
                    </span>
                    <span
                      className={`font-mono font-semibold shrink-0 ${
                        rec.winner === 0
                          ? 'text-amber-300'
                          : rec.winner === 1
                          ? 'text-sky-300'
                          : 'text-slate-400'
                      }`}
                    >
                      {rec.winner === 0 ? p0.name : rec.winner === 1 ? p1.name : 'Seri'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div
          className={`${
            battleState.roundHistory.length > 0 ? 'lg:col-span-6' : 'lg:col-span-12'
          } bg-[#131C31] border border-slate-800 rounded-2xl p-4`}
        >
          <div className="text-xs font-semibold text-slate-400 mb-2">
            Catatan Jalannya Pertarungan
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2 text-xs">
            {battleState.logs.map((entry) => (
              <div key={entry.id} className="flex items-baseline gap-2.5 leading-relaxed">
                <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                  [R{entry.round}]
                </span>
                <span
                  className={
                    entry.tone === 'highlight'
                      ? 'text-amber-300 font-semibold'
                      : entry.tone === 'p1'
                      ? 'text-emerald-200'
                      : entry.tone === 'p2'
                      ? 'text-sky-200'
                      : entry.tone === 'warning'
                      ? 'text-rose-300'
                      : 'text-slate-300'
                  }
                >
                  {entry.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PASS-AND-PLAY PRIVACY OVERLAY */}
      {(phase === 'P2_PRIVACY_CHARACTER' ||
        phase === 'P2_PRIVACY_SUIT' ||
        phase === 'P2_PRIVACY_SUPPORT') && (
        <div className="fixed inset-0 z-40 bg-slate-950/95 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#131C31] border border-slate-700 rounded-2xl p-8 text-center shadow-2xl">
            <EyeOff className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-xl font-display font-bold text-white">Layar Privasi 2 Pemain</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              {p0.name} telah mengunci pilihannya. Serahkan perangkat kepada{' '}
              <strong className="text-white">{p1.name}</strong> sebelum membuka kartu tangan.
            </p>
            <button
              type="button"
              onClick={() => {
                soundFx.playCardSelect();
                setBattleState((prev) => {
                  if (!prev) return prev;
                  const nextPhase =
                    prev.phase === 'P2_PRIVACY_CHARACTER'
                      ? 'P2_PICK_CHARACTER'
                      : prev.phase === 'P2_PRIVACY_SUIT'
                      ? 'P2_PICK_SUIT'
                      : 'P2_PICK_SUPPORT';
                  return { ...prev, phase: nextPhase };
                });
              }}
              className="mt-6 w-full py-3 px-5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              Saya {p1.name} — Buka Giliran
            </button>
          </div>
        </div>
      )}

      {/* INTERACTIVE EFFECT CARD PICKER MODAL */}
      {phase === 'INTERACTIVE_CHOICE' && activeChoice && (
        <div className="fixed inset-0 z-40 bg-slate-950/88 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#131C31] border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <div className="text-xs font-mono text-amber-400">
                  Pilihan Efek Kartu · {players[activeChoice.playerIndex].name}
                </div>
                <h3 className="text-lg sm:text-xl font-display font-bold text-white">
                  {activeChoice.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{activeChoice.subtitle}</p>
              </div>
              <div className="font-mono text-xs text-slate-300 tabular-nums shrink-0">
                Terpilih: {choiceSelection.length}/{activeChoice.maxSelect}
              </div>
            </div>

            <div className="my-5 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 justify-items-center py-2">
              {activeChoice.candidates.map((cand, idx) => {
                const isPicked = choiceSelection.includes(cand.uid);
                const togglePick = () => {
                  soundFx.playCardSelect();
                  setChoiceSelection((prev) => {
                    if (prev.includes(cand.uid)) {
                      return prev.filter((id) => id !== cand.uid);
                    }
                    if (activeChoice.maxSelect === 1) {
                      return [cand.uid];
                    }
                    if (prev.length >= activeChoice.maxSelect) {
                      return prev;
                    }
                    return [...prev, cand.uid];
                  });
                };

                if (activeChoice.concealCandidates) {
                  return (
                    <button
                      key={cand.uid}
                      type="button"
                      onClick={togglePick}
                      className={`group flex flex-col items-center rounded-xl transition-transform cursor-pointer ${
                        isPicked
                          ? '-translate-y-2.5 scale-[1.05]'
                          : 'hover:-translate-y-2 hover:scale-[1.03]'
                      }`}
                    >
                      <div
                        className={`rounded-xl ${
                          isPicked ? 'ring-2 ring-amber-400 shadow-xl' : ''
                        }`}
                      >
                        <CardBack size="sm" label={`#${idx + 1}`} />
                      </div>
                      <span className="mt-2 text-xs font-semibold text-slate-200">
                        Kartu Tertutup #{idx + 1}
                      </span>
                    </button>
                  );
                }

                const def = CARD_BY_ID[cand.defId];
                if (!def) return null;
                return (
                  <CardVisual
                    key={cand.uid}
                    card={def}
                    size="sm"
                    showCaption
                    selected={isPicked}
                    onInspect={onInspectCard}
                    onClick={togglePick}
                  />
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  const autoIds = activeChoice.candidates
                    .slice(0, activeChoice.maxSelect)
                    .map((c) => c.uid);
                  setChoiceSelection([]);
                  soundFx.playCardDeploy();
                  setBattleState((prev) => (prev ? resolvePendingChoice(prev, autoIds) : prev));
                }}
                className="px-4 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Pilih Otomatis
              </button>
              <button
                type="button"
                disabled={choiceSelection.length < activeChoice.minSelect}
                onClick={() => {
                  const chosen = [...choiceSelection];
                  setChoiceSelection([]);
                  soundFx.playCardDeploy();
                  setBattleState((prev) => (prev ? resolvePendingChoice(prev, chosen) : prev));
                }}
                className="px-6 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Konfirmasi Pilihan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZONE INSPECTOR MODAL */}
      {zoneInspectModal && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setZoneInspectModal(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#131C31] border border-slate-700 rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-display font-bold text-white">{zoneInspectModal.title}</h3>
              <button
                type="button"
                onClick={() => setZoneInspectModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {zoneInspectModal.cards.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Belum ada kartu di zona ini.
              </div>
            ) : (
              <div className="mt-5 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center py-2">
                {zoneInspectModal.cards.map((inst) => {
                  const def = CARD_BY_ID[inst.defId];
                  if (!def) return null;
                  return (
                    <CardVisual
                      key={inst.uid}
                      card={def}
                      size="sm"
                      showCaption
                      onClick={() => onInspectCard(def)}
                      onInspect={onInspectCard}
                      onEdit={onEditCard}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VICTORY CELEBRATION OVERLAY WITH FLARE & CATEGORY BADGES */}
      <VictoryCelebrationOverlay
        battleState={battleState}
        holdForKo={Boolean(activeKo)}
        clashFxEnabled={clashFxEnabled}
        contextLabel="Pertarungan Selesai"
        onInspectCard={onInspectCard}
        primaryAction={{
          label: 'Main Lagi',
          onClick: onRestartMatch,
        }}
        secondaryAction={{
          label: 'Kembali ke Pengaturan',
          onClick: onExitToSetup,
        }}
      />
    </section>
  );
};

interface BattleArenaProps {
  battleState: FullBattleState | null;
  setBattleState: React.Dispatch<React.SetStateAction<FullBattleState | null>>;
  customDeckIds: string[];
  savedDecks?: SavedUserDeck[];
  activeDeckId?: string;
  cardsVersion: number;
  onInspectCard: (card: CardDefinition) => void;
  onEditCard: (card: CardDefinition) => void;
  onOpenCreateCard: () => void;
  onOpenCreateSuitCard?: () => void;
  onOpenDeckBuilder: () => void;
  onOpenCustomArena: () => void;
  onOpenMultiplayer?: () => void;
  onOpenPhysicalHost?: () => void;
  onOpenPackSeries?: () => void;
  onOpenAlbum?: () => void;
  onOpenHistory?: () => void;
  onOpenCardTrial?: () => void;
  onOpenShop?: () => void;
}

type MatchFormatOption = 'ROUNDS_5' | 'WINS_5' | 'WINS_3';

interface ArenaDeckOption {
  id: string;
  name: string;
  subtitle: string;
  featuredCardId: string;
  cardIds: string[];
  suitArtSet?: SuitArtSetId;
}

export const BattleArena: React.FC<BattleArenaProps> = ({
  battleState,
  setBattleState,
  customDeckIds,
  savedDecks,
  activeDeckId,
  cardsVersion,
  onInspectCard,
  onEditCard,
  onOpenCreateCard,
  onOpenCreateSuitCard,
  onOpenDeckBuilder,
  onOpenCustomArena,
  onOpenMultiplayer,
  onOpenPhysicalHost,
  onOpenPackSeries,
  onOpenAlbum,
  onOpenHistory,
  onOpenCardTrial,
  onOpenShop,
}) => {
  const [mode, setMode] = useState<'VS_CPU' | 'PASS_AND_PLAY'>('VS_CPU');
  const [difficulty, setDifficulty] = useState<CpuDifficulty>('STANDAR');
  const [matchFormat, setMatchFormat] = useState<MatchFormatOption>('ROUNDS_5');
  const [p1DeckChoice, setP1DeckChoice] = useState<string>(activeDeckId || PRESET_DECKS[0].id);
  const [p2DeckChoice, setP2DeckChoice] = useState<string>(PRESET_DECKS[1].id);
  const [p1SuitSet, setP1SuitSet] = useState<SuitArtSetId>(1);
  const [p2SuitSet, setP2SuitSet] = useState<SuitArtSetId>(3);
  const [logoError, setLogoError] = useState(false);

  const availableSuitSets = useMemo(() => {
    void cardsVersion;
    return getAvailableSuitArtSets();
  }, [cardsVersion]);

  const deckOptions = useMemo<ArenaDeckOption[]>(() => {
    void cardsVersion;
    const list: ArenaDeckOption[] = [];

    if (savedDecks && savedDecks.length > 0) {
      for (const slot of savedDecks) {
        const cleanIds = deduplicateDeckIds(slot.cardIds, slot.targetSize);
        if (cleanIds.length < 10) continue;
        const isPrimary = slot.id === activeDeckId;
        list.push({
          id: slot.id,
          name: `${isPrimary ? 'Dek Aktif: ' : 'Slot Dek: '}${slot.name} (${cleanIds.length} Unik)`,
          subtitle: `Susunan dek kustom dari menu Atur Dek · Suit #${slot.suitArtSet}.`,
          featuredCardId: cleanIds[0] ?? 'bf-31-boboiboy-nova',
          cardIds: cleanIds,
          suitArtSet: slot.suitArtSet,
        });
      }
    } else {
      const uniqueCustom = deduplicateDeckIds(customDeckIds);
      if (uniqueCustom.length >= 10) {
        list.push({
          id: 'custom-user-deck',
          name: `Dek Kustom Pemain (${uniqueCustom.length} Kartu Unik)`,
          subtitle: 'Susunan dek unik tanpa kartu kembar dari menu Atur Dek.',
          featuredCardId: uniqueCustom[0] ?? 'bf-31-boboiboy-nova',
          cardIds: uniqueCustom,
        });
      }
    }

    for (const d of PRESET_DECKS) {
      const cleanIds = deduplicateDeckIds(d.cardIds);
      list.push({
        id: d.id,
        name: d.name,
        subtitle: d.subtitle,
        featuredCardId: d.featuredCardId,
        cardIds: cleanIds,
      });
    }

    for (const pack of ALL_PACK_SERIES) {
      if (!pack.isBuiltIn || pack.id !== 'pek-blazing-frost') {
        const packDeck = buildPlayableDeckFromPackSeries(pack.id, 20);
        if (packDeck.length >= 10) {
          list.push({
            id: `pack-series-${pack.id}`,
            name: `Seri Pek: ${pack.name} (${pack.codePrefix} · ${packDeck.length} Kartu)`,
            subtitle: pack.description,
            featuredCardId: pack.coverCardId,
            cardIds: packDeck,
          });
        }
      }
    }

    return list;
  }, [customDeckIds, savedDecks, activeDeckId, cardsVersion]);

  useEffect(() => {
    if (activeDeckId && deckOptions.some((d) => d.id === activeDeckId)) {
      setP1DeckChoice(activeDeckId);
      const found = deckOptions.find((d) => d.id === activeDeckId);
      if (found?.suitArtSet) {
        setP1SuitSet(found.suitArtSet);
      }
    }
  }, [activeDeckId, deckOptions]);

  const handleStartMatch = () => {
    const d1 = deckOptions.find((d) => d.id === p1DeckChoice) ?? deckOptions[0];
    const d2 = deckOptions.find((d) => d.id === p2DeckChoice) ?? deckOptions[1] ?? deckOptions[0];

    soundFx.playCardDeploy();
    const isFiveRounds = matchFormat === 'ROUNDS_5';
    const computedTargetWins = matchFormat === 'WINS_3' ? 3 : isFiveRounds ? 99 : 5;

    const initial = createInitialBattleState({
      mode,
      difficulty,
      targetWins: computedTargetWins,
      maxRounds: isFiveRounds ? 5 : null,
      p1Name: 'Pemain 1',
      p2Name: mode === 'VS_CPU' ? `CPU (${difficulty})` : 'Pemain 2',
      p1DeckIds: d1.cardIds,
      p2DeckIds: d2.cardIds,
      p1SuitSet,
      p2SuitSet,
    });
    setBattleState(initial);
  };

  if (battleState) {
    return (
      <BattleTabletop
        battleState={battleState}
        setBattleState={setBattleState}
        onInspectCard={onInspectCard}
        onEditCard={onEditCard}
        onRestartMatch={handleStartMatch}
        onExitToSetup={() => setBattleState(null)}
        onOpenHistory={onOpenHistory}
        exitLabel="Ganti Dek / Mode"
      />
    );
  }

  const activeP1Deck = deckOptions.find((d) => d.id === p1DeckChoice) ?? deckOptions[0];
  const activeP2Deck = deckOptions.find((d) => d.id === p2DeckChoice) ?? deckOptions[1] ?? deckOptions[0];
  const featuredCard =
    CARD_BY_ID[activeP1Deck.featuredCardId] ?? CARD_BY_ID['bf-31-boboiboy-nova'];

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 bg-[#131C31] border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {!logoError && (
                  <img
                    src={BRAND_LOGOS.indonesia}
                    alt="Monsta Galaxy Card Indonesia"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                    className="h-12 sm:h-14 w-auto object-contain"
                  />
                )}
                <div>
                  <div className="text-xs font-mono text-amber-400">
                    Pek Blazing Frost · Aturan Dek Unik Sekali Pakai
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
                    Pengaturan Duel 1 vs 1
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onOpenHistory && (
                  <button
                    type="button"
                    onClick={onOpenHistory}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-lg transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Riwayat Duel</span>
                  </button>
                )}
                {onOpenCardTrial && (
                  <button
                    type="button"
                    onClick={onOpenCardTrial}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-sky-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Uji Coba Kartu</span>
                  </button>
                )}
                {onOpenShop && (
                  <button
                    type="button"
                    onClick={onOpenShop}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-lg transition-colors cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Toko Kartu</span>
                  </button>
                )}
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-xl">
              Setiap kartu di dalam dek bersifat unik (tidak boleh ada kartu yang sama) dan hanya dapat dipakai satu kali selama pertandingan berlangsung.
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Mode Pertandingan
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setMode('VS_CPU')}
                    className={`py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      mode === 'VS_CPU'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    1 vs CPU (Bot Taktis)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('PASS_AND_PLAY')}
                    className={`py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      mode === 'PASS_AND_PLAY'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    1 vs 1 Lokal (2 Pemain)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Format Kemenangan
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setMatchFormat('ROUNDS_5')}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                        matchFormat === 'ROUNDS_5'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      5 Ronde
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchFormat('WINS_5')}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                        matchFormat === 'WINS_5'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      5 Kartu
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchFormat('WINS_3')}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                        matchFormat === 'WINS_3'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      3 Kartu
                    </button>
                  </div>
                </div>

                {mode === 'VS_CPU' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Tingkat Kecerdasan CPU
                    </label>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                      {(['MUDAH', 'STANDAR', 'MASTER'] as CpuDifficulty[]).map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          onClick={() => setDifficulty(lv)}
                          className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                            difficulty === lv
                              ? 'bg-slate-700 text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {lv === 'MUDAH' ? 'Mudah' : lv === 'STANDAR' ? 'Standar' : 'Master'}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Seri Kartu Suit Pemain 2
                    </label>
                    <select
                      value={p2SuitSet}
                      onChange={(e) => setP2SuitSet(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                    >
                      {availableSuitSets.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.shortLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Seri Kartu Suit Pemain 1 (Air · Api · Daun)
                  </label>
                  {onOpenCreateSuitCard && (
                    <button
                      type="button"
                      onClick={onOpenCreateSuitCard}
                      className="text-xs font-semibold text-sky-300 hover:text-sky-200 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Upload Kartu Suit</span>
                    </button>
                  )}
                </div>
                <select
                  value={p1SuitSet}
                  onChange={(e) => setP1SuitSet(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  {availableSuitSets.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <button
              type="button"
              onClick={handleStartMatch}
              className="w-full py-3.5 px-6 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-lg"
            >
              <Swords className="w-4 h-4" />
              <span>Mulai Pertarungan 1 vs 1</span>
            </button>
          </div>
        </div>

        {/* Right Column: Deck Matchup Preview */}
        <div className="lg:col-span-5 bg-[#131C31] border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-display font-bold text-white">Pilihan Dek Unik</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Setiap kartu unik hanya dapat diturunkan satu kali per pertandingan.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenDeckBuilder}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Atur Dek
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                Dek Pemain 1 ({activeP1Deck.cardIds.length} Kartu Unik)
              </label>
              <select
                value={p1DeckChoice}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setP1DeckChoice(nextId);
                  const chosen = deckOptions.find((d) => d.id === nextId);
                  if (chosen?.suitArtSet) {
                    setP1SuitSet(chosen.suitArtSet);
                  }
                }}
                className="w-full px-3.5 py-2.5 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
              >
                {deckOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{activeP1Deck.subtitle}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-sky-300 mb-1.5">
                Dek {mode === 'VS_CPU' ? 'Lawan (CPU)' : 'Pemain 2'} ({activeP2Deck.cardIds.length} Kartu Unik)
              </label>
              <select
                value={p2DeckChoice}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setP2DeckChoice(nextId);
                  const chosen = deckOptions.find((d) => d.id === nextId);
                  if (mode === 'PASS_AND_PLAY' && chosen?.suitArtSet) {
                    setP2SuitSet(chosen.suitArtSet);
                  }
                }}
                className="w-full px-3.5 py-2.5 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
              >
                {deckOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{activeP2Deck.subtitle}</p>
            </div>
          </div>

          {featuredCard && (
            <div className="pt-5 border-t border-slate-800 flex items-center gap-5">
              <CardVisual
                card={featuredCard}
                size="sm"
                conditionalReady
                onClick={() => onInspectCard(featuredCard)}
                onInspect={onInspectCard}
                onEdit={onEditCard}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono text-amber-400">Kartu Andalan Dek Pemain 1</div>
                <div className="mt-0.5 text-base font-display font-bold text-white truncate">
                  {featuredCard.name}
                </div>
                <div className="mt-1 text-xs font-mono text-slate-300 tabular-nums">
                  Rank {featuredCard.rank} · HP {featuredCard.hp} · ATK {featuredCard.atk}
                </div>
                <p className="mt-2 text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {featuredCard.effectText}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
