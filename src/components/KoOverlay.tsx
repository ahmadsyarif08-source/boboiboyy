import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, ShieldAlert, Swords, Trophy } from 'lucide-react';
import { CARD_BY_ID } from '../data/cards';
import type { FullBattleState } from '../engine/battleEngine';
import type { CardDefinition } from '../types/game';
import { soundFx } from '../utils/sound';

export type KoBannerKind = 'KO' | 'DOUBLE_KO' | 'FINAL_KO';

export interface ActiveKoEvent {
  id: number;
  kind: KoBannerKind;
  round: number;
  winner: 0 | 1 | 'DRAW';
  p0Name: string;
  p1Name: string;
  p0Card: CardDefinition | null;
  p1Card: CardDefinition | null;
  headline: string;
  subheadline: string;
  summary: string;
}

export function useKoPresentation(
  battleState: FullBattleState | null,
  enabled = true
): {
  activeKo: ActiveKoEvent | null;
  koShaking: boolean;
  dismissKo: () => void;
} {
  const [activeKo, setActiveKo] = useState<ActiveKoEvent | null>(null);
  const [koShaking, setKoShaking] = useState(false);

  const prevRoundCountRef = useRef<number>(battleState?.roundHistory.length ?? 0);
  const prevGameOverRef = useRef<boolean>(battleState?.phase === 'GAME_OVER');
  const seqRef = useRef<number>(0);

  const dismissKo = useCallback(() => {
    setActiveKo(null);
  }, []);

  useEffect(() => {
    if (!battleState) {
      prevRoundCountRef.current = 0;
      prevGameOverRef.current = false;
      setActiveKo(null);
      setKoShaking(false);
      return;
    }

    const roundLen = battleState.roundHistory.length;
    const isGameOver = battleState.phase === 'GAME_OVER';

    // Reset tracking when a fresh match starts
    if (roundLen < prevRoundCountRef.current || (roundLen === 0 && battleState.round === 1 && !isGameOver)) {
      prevRoundCountRef.current = roundLen;
      prevGameOverRef.current = isGameOver;
      setActiveKo(null);
      setKoShaking(false);
      return;
    }

    // Auto-clear banner when player advances into the next round's active phases
    if (
      activeKo &&
      battleState.phase !== 'ROUND_END' &&
      battleState.phase !== 'GAME_OVER'
    ) {
      setActiveKo(null);
    }

    let triggeredEvent: ActiveKoEvent | null = null;

    if (roundLen > prevRoundCountRef.current) {
      const latest = battleState.roundHistory[roundLen - 1];
      if (latest && enabled) {
        const kind: KoBannerKind = isGameOver
          ? 'FINAL_KO'
          : latest.winner === 'DRAW'
          ? 'DOUBLE_KO'
          : 'KO';

        const p0Name = battleState.players[0].name;
        const p1Name = battleState.players[1].name;
        const headline =
          kind === 'FINAL_KO'
            ? 'FINAL K.O.!'
            : kind === 'DOUBLE_KO'
            ? 'DOUBLE K.O.!'
            : 'K.O.!';

        const subheadline =
          latest.winner === 0
            ? `${p0Name} Menumbangkan Lawan!`
            : latest.winner === 1
            ? `${p1Name} Menumbangkan Lawan!`
            : 'Kedua Karakter Tumbang Bersamaan!';

        seqRef.current += 1;
        triggeredEvent = {
          id: seqRef.current,
          kind,
          round: latest.round,
          winner: latest.winner,
          p0Name,
          p1Name,
          p0Card: CARD_BY_ID[latest.p0CardId] ?? null,
          p1Card: CARD_BY_ID[latest.p1CardId] ?? null,
          headline,
          subheadline,
          summary: latest.summary,
        };
      }
      prevRoundCountRef.current = roundLen;
      prevGameOverRef.current = isGameOver;
    } else if (isGameOver && !prevGameOverRef.current) {
      // Match ended directly (e.g., Referee ruling or deck exhaustion)
      if (enabled) {
        const p0Name = battleState.players[0].name;
        const p1Name = battleState.players[1].name;
        const w = battleState.winnerIndex ?? 'DRAW';
        const subheadline =
          w === 0
            ? `${p0Name} Memenangkan Pertandingan!`
            : w === 1
            ? `${p1Name} Memenangkan Pertandingan!`
            : 'Pertandingan Berakhir Seri!';

        seqRef.current += 1;
        triggeredEvent = {
          id: seqRef.current,
          kind: 'FINAL_KO',
          round: battleState.round,
          winner: w,
          p0Name,
          p1Name,
          p0Card:
            (battleState.currentRoundP0CardId
              ? CARD_BY_ID[battleState.currentRoundP0CardId]
              : battleState.players[0].active?.def) ?? null,
          p1Card:
            (battleState.currentRoundP1CardId
              ? CARD_BY_ID[battleState.currentRoundP1CardId]
              : battleState.players[1].active?.def) ?? null,
          headline: 'FINAL K.O.!',
          subheadline,
          summary: battleState.winReason ?? 'Pertarungan selesai!',
        };
      }
      prevGameOverRef.current = true;
    }

    if (!triggeredEvent) return;

    soundFx.playKnockout(triggeredEvent.kind === 'FINAL_KO');
    setActiveKo(triggeredEvent);
    setKoShaking(true);

    const shakeTimer = window.setTimeout(() => {
      setKoShaking(false);
    }, 460);

    const bannerDuration = battleState.mode === 'CPU_VS_CPU' ? 1150 : 1950;
    const hideTimer = window.setTimeout(() => {
      setActiveKo((curr) => (curr?.id === triggeredEvent?.id ? null : curr));
    }, bannerDuration);

    return () => {
      window.clearTimeout(shakeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [battleState, enabled]);

  return { activeKo, koShaking, dismissKo };
}

interface KoBannerOverlayProps {
  ko: ActiveKoEvent | null;
  onDismiss: () => void;
  swapSides?: boolean;
}

export const KoBannerOverlay: React.FC<KoBannerOverlayProps> = ({
  ko,
  onDismiss,
  swapSides = false,
}) => {
  if (!ko) return null;

  const leftIdx: 0 | 1 = swapSides ? 1 : 0;
  const rightIdx: 0 | 1 = swapSides ? 0 : 1;

  const leftCard = leftIdx === 0 ? ko.p0Card : ko.p1Card;
  const rightCard = rightIdx === 0 ? ko.p0Card : ko.p1Card;
  const leftName = leftIdx === 0 ? ko.p0Name : ko.p1Name;
  const rightName = rightIdx === 0 ? ko.p0Name : ko.p1Name;

  const leftKnockedOut = ko.winner === 'DRAW' || ko.winner === rightIdx;
  const rightKnockedOut = ko.winner === 'DRAW' || ko.winner === leftIdx;

  const isFinal = ko.kind === 'FINAL_KO';
  const isDouble = ko.kind === 'DOUBLE_KO';

  return (
    <div
      key={ko.id}
      role="status"
      aria-live="assertive"
      onClick={onDismiss}
      className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-slate-950/68 backdrop-blur-[2px] overflow-hidden cursor-pointer select-none"
    >
      {/* Radial Impact Burst Flash */}
      <div
        className={`pointer-events-none absolute inset-0 animate-ko-flash ${
          isFinal
            ? 'bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.55)_0%,rgba(244,63,94,0.32)_42%,transparent_72%)]'
            : 'bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.52)_0%,rgba(245,158,11,0.28)_40%,transparent_72%)]'
        }`}
      />

      {/* Crossed Diagonal Energy Slashes */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-gradient-to-r from-transparent via-amber-300/80 to-transparent animate-ko-slash-left" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-transparent via-rose-500/85 to-transparent animate-ko-slash-right" />

      {/* Center Arcade K.O. Impact Card */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border-2 border-amber-400/75 bg-gradient-to-b from-[#1A1025]/96 via-[#111827]/96 to-[#0B1120]/98 px-4 py-4 sm:px-6 sm:py-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] animate-ko-slam text-center">
        {/* Top Tag */}
        <div className="inline-flex items-center justify-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-amber-300 mb-1">
          {isFinal ? (
            <>
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>PENENTUAN AKHIR · RONDE {ko.round}</span>
            </>
          ) : isDouble ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>BENTROKAN SERI · RONDE {ko.round}</span>
            </>
          ) : (
            <>
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>KNOCKOUT · RONDE {ko.round}</span>
            </>
          )}
        </div>

        {/* Giant Arcade K.O.! Headline */}
        <div
          className={`font-display font-black tracking-tighter leading-none ${
            isDouble ? 'text-4xl sm:text-6xl' : 'text-5xl sm:text-7xl'
          } ${
            isFinal
              ? 'bg-gradient-to-b from-amber-100 via-amber-400 to-rose-500 bg-clip-text text-transparent drop-shadow-[0_6px_24px_rgba(251,191,36,0.55)]'
              : 'bg-gradient-to-b from-white via-amber-300 to-rose-600 bg-clip-text text-transparent drop-shadow-[0_6px_24px_rgba(244,63,94,0.65)]'
          }`}
        >
          {ko.headline}
        </div>

        <div className="mt-1.5 text-xs sm:text-sm font-display font-bold text-white">
          {ko.subheadline}
        </div>

        {/* Fighter Thumbnails: Victor vs Defeated (TUMBANG) */}
        {(leftCard || rightCard) && (
          <div className="mt-3.5 flex items-center justify-center gap-3 sm:gap-5">
            {/* Left Fighter */}
            <div className="flex flex-col items-center max-w-[136px]">
              <div
                className={`relative w-16 h-22 sm:w-20 sm:h-28 rounded-xl overflow-hidden border-2 transition-transform ${
                  leftKnockedOut
                    ? 'border-rose-500/80 -rotate-3 grayscale contrast-125 opacity-80'
                    : 'border-amber-400 scale-105 shadow-[0_0_20px_rgba(251,191,36,0.45)]'
                }`}
              >
                {leftCard ? (
                  <img
                    src={leftCard.image}
                    alt={leftCard.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[10px] font-mono text-slate-500">
                    KARTU
                  </div>
                )}

                {leftKnockedOut ? (
                  <div className="absolute inset-0 bg-rose-950/45 flex items-center justify-center">
                    <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-mono font-black tracking-wider bg-rose-600 text-white border border-rose-200/80 rounded-sm shadow-md animate-ko-stamp">
                      K.O.
                    </span>
                  </div>
                ) : (
                  <div className="absolute bottom-1 inset-x-1 bg-amber-500/95 text-slate-950 text-[9px] font-mono font-black uppercase rounded-sm py-0.5">
                    MENANG
                  </div>
                )}
              </div>
              <div className="mt-1 text-[10px] font-semibold text-slate-300 truncate max-w-[120px]">
                {leftName}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center text-amber-400 shrink-0">
              <Swords className="w-5 h-5" />
              <span className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">VS</span>
            </div>

            {/* Right Fighter */}
            <div className="flex flex-col items-center max-w-[136px]">
              <div
                className={`relative w-16 h-22 sm:w-20 sm:h-28 rounded-xl overflow-hidden border-2 transition-transform ${
                  rightKnockedOut
                    ? 'border-rose-500/80 rotate-3 grayscale contrast-125 opacity-80'
                    : 'border-amber-400 scale-105 shadow-[0_0_20px_rgba(251,191,36,0.45)]'
                }`}
              >
                {rightCard ? (
                  <img
                    src={rightCard.image}
                    alt={rightCard.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[10px] font-mono text-slate-500">
                    KARTU
                  </div>
                )}

                {rightKnockedOut ? (
                  <div className="absolute inset-0 bg-rose-950/45 flex items-center justify-center">
                    <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-mono font-black tracking-wider bg-rose-600 text-white border border-rose-200/80 rounded-sm shadow-md animate-ko-stamp">
                      K.O.
                    </span>
                  </div>
                ) : (
                  <div className="absolute bottom-1 inset-x-1 bg-amber-500/95 text-slate-950 text-[9px] font-mono font-black uppercase rounded-sm py-0.5">
                    MENANG
                  </div>
                )}
              </div>
              <div className="mt-1 text-[10px] font-semibold text-slate-300 truncate max-w-[120px]">
                {rightName}
              </div>
            </div>
          </div>
        )}

        <p className="mt-3 text-[11px] sm:text-xs text-slate-300 line-clamp-2 max-w-md mx-auto">
          {ko.summary}
        </p>
        <div className="mt-2 text-[10px] font-mono text-slate-500">
          Klik di mana saja untuk lanjut
        </div>
      </div>
    </div>
  );
};
