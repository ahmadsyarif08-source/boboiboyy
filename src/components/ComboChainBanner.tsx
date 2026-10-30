import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Shield, Swords, X, Zap } from 'lucide-react';
import { CARD_BY_ID } from '../data/cards';
import type { FullBattleState } from '../engine/battleEngine';
import type { SupportComboEvent } from '../types/game';
import { soundFx } from '../utils/sound';

const NODE_ANIM_CLASSES = [
  'animate-combo-node-1',
  'animate-combo-node-2',
  'animate-combo-node-3',
  'animate-combo-node-4',
];

export function useComboPresentation(
  battleState: FullBattleState | null,
  enabled = true
): {
  activeCombo: SupportComboEvent | null;
  dismissCombo: () => void;
} {
  const [queue, setQueue] = useState<SupportComboEvent[]>([]);
  const processedCountRef = useRef<number>(0);
  const initializedMatchRef = useRef<boolean>(false);

  const historyLen = battleState?.comboHistory?.length ?? 0;
  const round = battleState?.round ?? 0;
  const roundHistLen = battleState?.roundHistory.length ?? 0;

  useEffect(() => {
    if (!battleState) {
      processedCountRef.current = 0;
      initializedMatchRef.current = false;
      setQueue([]);
      return;
    }

    const combos = battleState.comboHistory ?? [];

    // Detect brand-new match reset
    if (
      round === 1 &&
      roundHistLen === 0 &&
      combos.length === 0 &&
      battleState.players[0].winZone.length === 0 &&
      battleState.players[1].winZone.length === 0
    ) {
      processedCountRef.current = 0;
      initializedMatchRef.current = true;
      setQueue([]);
      return;
    }

    // If mounting mid-match (e.g. joining live Multiplayer / Spectator room), skip old combos
    if (!initializedMatchRef.current) {
      initializedMatchRef.current = true;
      if (combos.length > 0 && roundHistLen > 0) {
        processedCountRef.current = combos.length;
        return;
      }
    }

    if (combos.length < processedCountRef.current) {
      processedCountRef.current = combos.length;
      return;
    }

    if (combos.length > processedCountRef.current) {
      const fresh = combos.slice(processedCountRef.current);
      processedCountRef.current = combos.length;
      if (enabled && fresh.length > 0) {
        setQueue((prev) => [...prev, ...fresh]);
      }
    }
  }, [battleState, historyLen, round, roundHistLen, enabled]);

  const activeCombo = enabled && queue.length > 0 ? queue[0] : null;
  const isCpuAuto = battleState?.mode === 'CPU_VS_CPU';

  useEffect(() => {
    if (!activeCombo) return;

    soundFx.playComboChain(activeCombo.chainCount);

    const displayDuration = isCpuAuto ? 1700 : 3200;
    const timer = window.setTimeout(() => {
      setQueue((prev) => prev.slice(1));
    }, displayDuration);

    return () => window.clearTimeout(timer);
  }, [activeCombo, isCpuAuto]);

  const dismissCombo = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  return {
    activeCombo,
    dismissCombo,
  };
}

interface ComboChainBannerProps {
  combo: SupportComboEvent | null;
  onDismiss: () => void;
  hidden?: boolean;
}

export const ComboChainBanner: React.FC<ComboChainBannerProps> = ({
  combo,
  onDismiss,
  hidden = false,
}) => {
  if (!combo || hidden) return null;

  const isChainAttack = combo.kind === 'CHAIN_ATTACK';
  const isMultiSupport = combo.kind === 'MULTI_SUPPORT';

  const frameBorderClass = isChainAttack
    ? 'border-amber-400/70 shadow-amber-500/15'
    : isMultiSupport
    ? 'border-emerald-400/70 shadow-emerald-500/15'
    : 'border-sky-400/70 shadow-sky-500/15';

  const stampBgClass = isChainAttack
    ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950'
    : isMultiSupport
    ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950'
    : 'bg-gradient-to-br from-sky-400 to-cyan-500 text-slate-950';

  const accentTitleClass = isChainAttack
    ? 'text-amber-300'
    : isMultiSupport
    ? 'text-emerald-300'
    : 'text-sky-300';

  return (
    <div
      key={combo.id}
      className="pointer-events-none absolute inset-x-3 sm:inset-x-6 top-3 z-30 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <div
        onClick={onDismiss}
        className={`animate-combo-banner pointer-events-auto cursor-pointer w-full max-w-3xl rounded-xl bg-[#0B1120]/95 backdrop-blur-md border ${frameBorderClass} shadow-2xl px-3.5 py-3 transition-colors`}
      >
        {/* Top Header Row: Chain Stamp + Title + Resulting Stats + Dismiss */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`animate-combo-counter px-2.5 py-1 rounded-lg font-display font-extrabold text-xs sm:text-sm tracking-wide tabular-nums flex items-center gap-1 shrink-0 ${stampBgClass}`}
            >
              {isChainAttack ? (
                <Swords className="w-3.5 h-3.5" />
              ) : isMultiSupport ? (
                <Zap className="w-3.5 h-3.5" />
              ) : (
                <Shield className="w-3.5 h-3.5" />
              )}
              <span>
                {isChainAttack ? `CHAIN x${combo.chainCount}` : `KOMBO x${combo.chainCount}`}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-display font-extrabold leading-tight">
                <span className={accentTitleClass}>{combo.title}</span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-white truncate">{combo.playerName}</span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">{combo.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 ml-auto shrink-0">
            <div className="text-right font-mono text-xs tabular-nums">
              <span className="text-emerald-300 font-bold">ATK {combo.finalAtk}</span>
              <span className="mx-1.5 text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-rose-300 font-bold">HP {combo.finalHp}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              aria-label="Tutup notifikasi kombo"
              className="w-6 h-6 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom Visual Activation Sequence Strip */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/90 flex items-center gap-1.5 overflow-x-auto">
          {combo.steps.map((step, idx) => {
            const cardDef = CARD_BY_ID[step.cardId];
            const nodeAnim = NODE_ANIM_CLASSES[idx] ?? 'animate-combo-node-4';
            const isStrikeStep = step.role === 'STRIKE';
            const isSupportStep = step.role === 'SUPPORT';

            return (
              <React.Fragment key={`${combo.id}-step-${idx}`}>
                {idx > 0 && (
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${
                      isStrikeStep ? 'text-amber-400' : 'text-slate-500'
                    }`}
                    aria-hidden="true"
                  />
                )}
                <div
                  className={`${nodeAnim} flex items-center gap-2 px-2.5 py-1.5 rounded-lg border shrink-0 ${
                    isStrikeStep
                      ? 'bg-amber-500/15 border-amber-400/50'
                      : isSupportStep
                      ? 'bg-emerald-500/12 border-emerald-400/40'
                      : 'bg-slate-900/90 border-slate-700/80'
                  }`}
                >
                  {cardDef?.image && (
                    <img
                      src={cardDef.image}
                      alt={step.cardName}
                      className="w-6 h-8 rounded-xs object-cover border border-slate-700 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-white truncate max-w-[120px]">
                      {step.cardName}
                    </div>
                    <div
                      className={`text-[10px] font-mono font-bold tabular-nums whitespace-nowrap ${
                        isStrikeStep
                          ? 'text-amber-300'
                          : isSupportStep
                          ? 'text-emerald-300'
                          : 'text-sky-300'
                      }`}
                    >
                      {step.effectLabel}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
