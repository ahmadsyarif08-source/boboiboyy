import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Gavel,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  Swords,
  Upload,
} from 'lucide-react';
import {
  BATTLE_CARDS,
  CARD_BY_ID,
  deduplicateDeckIds,
  getAvailableSuitArtSets,
  isCardModified,
  PRESET_DECKS,
} from '../data/cards';
import { createInitialBattleState, FullBattleState, shuffleArray } from '../engine/battleEngine';
import {
  CardCategory,
  CardDefinition,
  CpuDifficulty,
  GameMode,
  type SavedUserDeck,
  type SuitArtSetId,
} from '../types/game';
import { soundFx } from '../utils/sound';
import { AudioControlWidget } from './AudioControlPanel';
import { BattleTabletop } from './BattleArena';
import { CardVisual } from './CardVisual';

interface CustomArenaProps {
  customDeckIds: string[];
  savedDecks?: SavedUserDeck[];
  cardsVersion: number;
  onInspectCard: (card: CardDefinition) => void;
  onEditCard: (card: CardDefinition) => void;
  onOpenCreateCard: () => void;
  onOpenCreateSuitCard?: () => void;
  onOpenPhysicalHost?: () => void;
}

type CustomWinRule = 'ROUNDS_3' | 'ROUNDS_5' | 'ROUNDS_7' | 'WINS_3' | 'WINS_5';
type DeckSizeOption = 5 | 10 | 15 | 20 | 30;
type PoolFilter = 'ALL' | 'CHARACTER' | 'CONDITIONAL' | 'SUPPORT' | 'CUSTOM';

function buildUniqueSliceWithBaseGuarantee(
  sourceIds: string[],
  targetSize: number,
  excludedIds: Set<string> = new Set()
): string[] {
  const uniqueSource = deduplicateDeckIds(sourceIds).filter((id) => !excludedIds.has(id));
  const minUnconditional = Math.min(3, Math.max(1, Math.ceil(targetSize * 0.35)));

  const unconditionalInSource = uniqueSource.filter((id) => {
    const d = CARD_BY_ID[id];
    return d && d.category === CardCategory.CHARACTER && !d.condition;
  });

  const restInSource = uniqueSource.filter((id) => !unconditionalInSource.includes(id));

  const picked: string[] = [];
  const used = new Set<string>(excludedIds);

  for (const id of unconditionalInSource) {
    if (picked.length >= minUnconditional) break;
    picked.push(id);
    used.add(id);
  }

  // If source didn't have enough unconditional characters, pull from global BATTLE_CARDS
  if (picked.length < minUnconditional) {
    const globalUncond = shuffleArray(
      BATTLE_CARDS.filter(
        (c) => c.category === CardCategory.CHARACTER && !c.condition && !used.has(c.id)
      )
    );
    for (const c of globalUncond) {
      if (picked.length >= minUnconditional) break;
      picked.push(c.id);
      used.add(c.id);
    }
  }

  for (const id of [...unconditionalInSource, ...restInSource]) {
    if (picked.length >= targetSize) break;
    if (!used.has(id)) {
      picked.push(id);
      used.add(id);
    }
  }

  if (picked.length < targetSize) {
    const globalRemaining = shuffleArray(BATTLE_CARDS.filter((c) => !used.has(c.id)));
    for (const c of globalRemaining) {
      if (picked.length >= targetSize) break;
      picked.push(c.id);
      used.add(c.id);
    }
  }

  return picked.slice(0, targetSize);
}

export const CustomArena: React.FC<CustomArenaProps> = ({
  customDeckIds,
  savedDecks,
  cardsVersion,
  onInspectCard,
  onEditCard,
  onOpenCreateCard,
  onOpenCreateSuitCard,
  onOpenPhysicalHost,
}) => {
  const [customBattleState, setCustomBattleState] = useState<FullBattleState | null>(null);

  const [mode, setMode] = useState<GameMode>('VS_CPU');
  const [deckSize, setDeckSize] = useState<DeckSizeOption>(10);
  const [winRule, setWinRule] = useState<CustomWinRule>('ROUNDS_5');
  const [handSize, setHandSize] = useState<3 | 4 | 5>(4);
  const [exclusiveDraft, setExclusiveDraft] = useState<boolean>(false);

  const [p1Name, setP1Name] = useState<string>('Petarung 1');
  const [p2Name, setP2Name] = useState<string>('Petarung 2');
  const [p1Difficulty, setP1Difficulty] = useState<CpuDifficulty>('STANDAR');
  const [p2Difficulty, setP2Difficulty] = useState<CpuDifficulty>('STANDAR');
  const [p1SuitSet, setP1SuitSet] = useState<SuitArtSetId>(1);
  const [p2SuitSet, setP2SuitSet] = useState<SuitArtSetId>(3);

  const availableSuitSets = useMemo(() => {
    void cardsVersion;
    return getAvailableSuitArtSets();
  }, [cardsVersion]);

  const [editingFighter, setEditingFighter] = useState<0 | 1>(0);
  const [poolFilter, setPoolFilter] = useState<PoolFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  const [p1Ids, setP1Ids] = useState<string[]>(() =>
    buildUniqueSliceWithBaseGuarantee(PRESET_DECKS[0].cardIds, 10)
  );
  const [p2Ids, setP2Ids] = useState<string[]>(() =>
    buildUniqueSliceWithBaseGuarantee(PRESET_DECKS[1].cardIds, 10)
  );

  // Clean out any deleted custom cards if cardsVersion updates
  useEffect(() => {
    setP1Ids((prev) => deduplicateDeckIds(prev, deckSize));
    setP2Ids((prev) => deduplicateDeckIds(prev, deckSize));
  }, [cardsVersion, deckSize]);

  const handleChangeDeckSize = (nextSize: DeckSizeOption) => {
    setDeckSize(nextSize);
    setNotice(null);
    if (handSize > nextSize) {
      setHandSize(Math.min(5, nextSize) as 3 | 4 | 5);
    }
    const nextP1 = buildUniqueSliceWithBaseGuarantee(p1Ids, nextSize);
    const excludedForP2 = exclusiveDraft ? new Set(nextP1) : new Set<string>();
    const nextP2 = buildUniqueSliceWithBaseGuarantee(p2Ids, nextSize, excludedForP2);
    setP1Ids(nextP1);
    setP2Ids(nextP2);
  };

  const handleToggleExclusiveDraft = () => {
    const nextVal = !exclusiveDraft;
    setExclusiveDraft(nextVal);
    if (nextVal) {
      const p1Set = new Set(p1Ids);
      const filteredP2 = p2Ids.filter((id) => !p1Set.has(id));
      setP2Ids(filteredUniqueFill(filteredP2, deckSize, p1Set));
      setNotice('Mode Draft Silang Unik aktif: Petarung 1 & 2 tidak memakai kartu yang sama.');
    } else {
      setNotice('Tiap dek tetap wajib unik (1x per kartu), namun P1 & P2 boleh membawa kartu yang sama.');
    }
  };

  function filteredUniqueFill(
    current: string[],
    target: number,
    excluded: Set<string>
  ): string[] {
    return buildUniqueSliceWithBaseGuarantee(current, target, excluded);
  }

  const activeDeckIds = editingFighter === 0 ? p1Ids : p2Ids;
  const otherDeckIds = editingFighter === 0 ? p2Ids : p1Ids;

  const setActiveDeckIds = (updater: (prev: string[]) => string[]) => {
    if (editingFighter === 0) {
      setP1Ids(updater);
    } else {
      setP2Ids(updater);
    }
  };

  const toggleCardInActiveDeck = (cardId: string) => {
    setNotice(null);
    const exists = activeDeckIds.includes(cardId);
    if (exists) {
      setActiveDeckIds((prev) => prev.filter((id) => id !== cardId));
      return;
    }
    if (exclusiveDraft && otherDeckIds.includes(cardId)) {
      setNotice('Kartu ini sudah dipakai oleh lawan (Mode Draft Silang Unik sedang aktif).');
      return;
    }
    if (activeDeckIds.length >= deckSize) {
      setNotice(`Dek Petarung ${editingFighter + 1} sudah penuh (${deckSize}/${deckSize} kartu unik). Lepas 1 kartu terlebih dulu.`);
      return;
    }
    setActiveDeckIds((prev) => deduplicateDeckIds([...prev, cardId], deckSize));
  };

  const handleRandomFillActive = () => {
    const excluded = exclusiveDraft ? new Set(otherDeckIds) : new Set<string>();
    const randomized = buildUniqueSliceWithBaseGuarantee(
      shuffleArray(BATTLE_CARDS.map((c) => c.id)),
      deckSize,
      excluded
    );
    setActiveDeckIds(() => randomized);
    setNotice(`Dek unik Petarung ${editingFighter + 1} diisi acak (${randomized.length} kartu tanpa kembar).`);
  };

  const handleFillRemainingActive = () => {
    const excluded = exclusiveDraft ? new Set(otherDeckIds) : new Set<string>();
    const filled = buildUniqueSliceWithBaseGuarantee(activeDeckIds, deckSize, excluded);
    setActiveDeckIds(() => filled);
    setNotice(`Sisa slot Petarung ${editingFighter + 1} dilengkapi otomatis.`);
  };

  const handleLoadPresetToActive = (cardIds: string[], label: string) => {
    const excluded = exclusiveDraft ? new Set(otherDeckIds) : new Set<string>();
    const next = buildUniqueSliceWithBaseGuarantee(cardIds, deckSize, excluded);
    setActiveDeckIds(() => next);
    setNotice(`Memuat ${label} (${next.length} kartu unik) ke Petarung ${editingFighter + 1}.`);
  };

  const countUnconditional = (ids: string[]) =>
    ids.filter((id) => {
      const c = CARD_BY_ID[id];
      return c && c.category === CardCategory.CHARACTER && !c.condition;
    }).length;

  const p1Uncond = useMemo(() => countUnconditional(p1Ids), [p1Ids, cardsVersion]);
  const p2Uncond = useMemo(() => countUnconditional(p2Ids), [p2Ids, cardsVersion]);

  const minRequiredBase = Math.min(2, deckSize);
  const canStartMatch =
    p1Ids.length === deckSize &&
    p2Ids.length === deckSize &&
    p1Uncond >= minRequiredBase &&
    p2Uncond >= minRequiredBase;

  const visiblePool = useMemo(() => {
    void cardsVersion;
    return BATTLE_CARDS.filter((card) => {
      if (poolFilter === 'CHARACTER' && card.category !== CardCategory.CHARACTER) return false;
      if (poolFilter === 'CONDITIONAL' && !card.condition) return false;
      if (poolFilter === 'SUPPORT' && card.category !== CardCategory.SUPPORT) return false;
      if (poolFilter === 'CUSTOM' && !card.isCustom && !isCardModified(card.id)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          card.name.toLowerCase().includes(q) ||
          card.effectText.toLowerCase().includes(q) ||
          card.numberLabel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [poolFilter, searchQuery, cardsVersion]);

  const customOrEditedCount = useMemo(() => {
    void cardsVersion;
    return BATTLE_CARDS.filter((c) => c.isCustom || isCardModified(c.id)).length;
  }, [cardsVersion]);

  const startCustomBattle = () => {
    if (!canStartMatch) return;
    soundFx.playCardDeploy();

    const maxRoundsMap: Record<CustomWinRule, number | null> = {
      ROUNDS_3: 3,
      ROUNDS_5: 5,
      ROUNDS_7: 7,
      WINS_3: null,
      WINS_5: null,
    };

    const targetWinsMap: Record<CustomWinRule, number> = {
      ROUNDS_3: 99,
      ROUNDS_5: 99,
      ROUNDS_7: 99,
      WINS_3: 3,
      WINS_5: 5,
    };

    const effectiveHandSize = Math.min(handSize, deckSize);
    const resolvedP1Name =
      p1Name.trim() || (mode === 'CPU_VS_CPU' ? `CPU 1 (${p1Difficulty})` : 'Petarung 1');
    const resolvedP2Name =
      p2Name.trim() ||
      (mode === 'VS_CPU'
        ? `CPU (${p2Difficulty})`
        : mode === 'CPU_VS_CPU'
        ? `CPU 2 (${p2Difficulty})`
        : 'Petarung 2');

    setCustomBattleState(
      createInitialBattleState({
        mode,
        difficulty: p2Difficulty,
        p0Difficulty: p1Difficulty,
        p1IsCpu: mode === 'CPU_VS_CPU',
        targetWins: targetWinsMap[winRule],
        maxRounds: maxRoundsMap[winRule],
        initialHandSize: effectiveHandSize,
        p1Name: resolvedP1Name,
        p2Name: resolvedP2Name,
        p1DeckIds: deduplicateDeckIds(p1Ids, deckSize),
        p2DeckIds: deduplicateDeckIds(p2Ids, deckSize),
        p1SuitSet,
        p2SuitSet,
      })
    );
  };

  if (customBattleState) {
    return (
      <BattleTabletop
        battleState={customBattleState}
        setBattleState={setCustomBattleState}
        onInspectCard={onInspectCard}
        onEditCard={onEditCard}
        onRestartMatch={startCustomBattle}
        onExitToSetup={() => setCustomBattleState(null)}
        exitLabel="Atur Ulang Arena Custom"
      />
    );
  }

  return (
    <section className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-slate-800">
        <div>
          <div className="text-xs font-mono text-amber-400">
            Aturan Dek Unik Sekali Pakai · Tanpa Kartu Kembar
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-display font-extrabold text-white">
            Arena 1 vs 1 Custom
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Atur bebas jumlah kartu dek unik (5–30 kartu), jumlah ronde, tangan awal, mode kendali, dan pilih langsung barisan kartu unik untuk kedua petarung. Setiap kartu hanya bisa dipakai satu kali!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AudioControlWidget />

          {onOpenPhysicalHost && (
            <button
              type="button"
              onClick={onOpenPhysicalHost}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Gavel className="w-4 h-4" />
              <span>Host Kartu Asli</span>
            </button>
          )}

          {onOpenCreateSuitCard && (
            <button
              type="button"
              onClick={onOpenCreateSuitCard}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold bg-[#131C31] hover:bg-slate-800 text-sky-300 border border-slate-700 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Kartu Suit</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCreateCard}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold bg-[#131C31] hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Upload / Tambah Kartu</span>
          </button>

          <button
            type="button"
            disabled={!canStartMatch}
            onClick={startCustomBattle}
            className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 shadow-lg"
          >
            <Swords className="w-4 h-4" />
            <span>Mulai Arena 1 vs 1 Custom</span>
          </button>
        </div>
      </div>

      {/* Custom Rules Configuration Panel */}
      <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* Control Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Mode Kendali Pertandingan
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
              {[
                { id: 'VS_CPU' as GameMode, label: '1 vs CPU' },
                { id: 'PASS_AND_PLAY' as GameMode, label: '2 Pemain' },
                { id: 'CPU_VS_CPU' as GameMode, label: 'CPU vs CPU' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    mode === m.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Unique Deck Size */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Ukuran Dek Unik (1x Pakai)
            </label>
            <div className="grid grid-cols-5 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
              {([5, 10, 15, 20, 30] as DeckSizeOption[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleChangeDeckSize(sz)}
                  className={`py-2 px-1.5 text-xs font-mono font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    deckSize === sz
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Win Rule */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Target / Jumlah Ronde
            </label>
            <div className="grid grid-cols-5 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
              {[
                { id: 'ROUNDS_3' as CustomWinRule, label: '3 Rnd' },
                { id: 'ROUNDS_5' as CustomWinRule, label: '5 Rnd' },
                { id: 'ROUNDS_7' as CustomWinRule, label: '7 Rnd' },
                { id: 'WINS_3' as CustomWinRule, label: '3 Mng' },
                { id: 'WINS_5' as CustomWinRule, label: '5 Mng' },
              ].map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWinRule(w.id)}
                  className={`py-2 px-1 text-xs font-mono font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    winRule === w.id
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Starting Hand Size */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Kartu Tangan Awal
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
              {([3, 4, 5] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHandSize(h)}
                  className={`py-2 px-2 text-xs font-mono font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    handSize === h
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {h} Kartu
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fighter Names, AI Difficulty & Suit Sets */}
        <div className="pt-5 border-t border-slate-800/90 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className={mode === 'CPU_VS_CPU' ? 'sm:col-span-5' : 'sm:col-span-7'}>
              <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                Nama Petarung 1 {mode === 'CPU_VS_CPU' ? '(CPU 1)' : ''}
              </label>
              <input
                type="text"
                value={p1Name}
                onChange={(e) => setP1Name(e.target.value)}
                maxLength={28}
                className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            {mode === 'CPU_VS_CPU' && (
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  AI Petarung 1
                </label>
                <select
                  value={p1Difficulty}
                  onChange={(e) => setP1Difficulty(e.target.value as CpuDifficulty)}
                  className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="MUDAH">Mudah</option>
                  <option value="STANDAR">Standar</option>
                  <option value="MASTER">Master</option>
                </select>
              </div>
            )}
            <div className={mode === 'CPU_VS_CPU' ? 'sm:col-span-4' : 'sm:col-span-5'}>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Suit Petarung 1
              </label>
              <select
                value={p1SuitSet}
                onChange={(e) => setP1SuitSet(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
              >
                {availableSuitSets.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.shortLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className={mode !== 'PASS_AND_PLAY' ? 'sm:col-span-5' : 'sm:col-span-7'}>
              <label className="block text-xs font-semibold text-sky-300 mb-1.5">
                Nama Petarung 2 {mode !== 'PASS_AND_PLAY' ? '(CPU)' : ''}
              </label>
              <input
                type="text"
                value={p2Name}
                onChange={(e) => setP2Name(e.target.value)}
                maxLength={28}
                className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            {mode !== 'PASS_AND_PLAY' && (
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  AI Petarung 2
                </label>
                <select
                  value={p2Difficulty}
                  onChange={(e) => setP2Difficulty(e.target.value as CpuDifficulty)}
                  className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="MUDAH">Mudah</option>
                  <option value="STANDAR">Standar</option>
                  <option value="MASTER">Master</option>
                </select>
              </div>
            )}
            <div className={mode !== 'PASS_AND_PLAY' ? 'sm:col-span-4' : 'sm:col-span-5'}>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Suit Petarung 2
              </label>
              <select
                value={p2SuitSet}
                onChange={(e) => setP2SuitSet(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
              >
                {availableSuitSets.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.shortLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Dual Fighter Unique Deck Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 8 cols: Card Pool Selector */}
        <div className="lg:col-span-8 space-y-5">
          {/* Active Fighter Switcher + Cross-Deck Exclusivity */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#131C31] border border-slate-800 rounded-2xl p-3.5">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setEditingFighter(0)}
                className={`py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  editingFighter === 0
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Dek {p1Name.trim() || 'Petarung 1'} ({p1Ids.length}/{deckSize})
              </button>
              <button
                type="button"
                onClick={() => setEditingFighter(1)}
                className={`py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  editingFighter === 1
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Dek {p2Name.trim() || 'Petarung 2'} ({p2Ids.length}/{deckSize})
              </button>
            </div>

            <button
              type="button"
              onClick={handleToggleExclusiveDraft}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                exclusiveDraft
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                  : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Check className={`w-3.5 h-3.5 ${exclusiveDraft ? 'opacity-100' : 'opacity-30'}`} />
              <span>Draft Silang Unik (P1 & P2 Beda Kartu)</span>
            </button>
          </div>

          {/* Quick Load Templates & Filter Bar */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {savedDecks && savedDecks.length > 0 ? (
                savedDecks.map((slot) =>
                  slot.cardIds.length >= 5 ? (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleLoadPresetToActive(slot.cardIds, slot.name)}
                      className="px-3 py-1.5 text-xs font-medium bg-[#131C31] hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Slot: {slot.name}
                    </button>
                  ) : null
                )
              ) : deduplicateDeckIds(customDeckIds).length >= 5 ? (
                <button
                  type="button"
                  onClick={() => handleLoadPresetToActive(customDeckIds, 'Dek Kustom Utama')}
                  className="px-3 py-1.5 text-xs font-medium bg-[#131C31] hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Muat Dek Kustom Utama
                </button>
              ) : null}
              {PRESET_DECKS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    handleLoadPresetToActive(preset.cardIds, preset.name.split('(')[0].trim())
                  }
                  className="px-3 py-1.5 text-xs font-medium bg-[#131C31] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {preset.name.split('(')[0].trim()}
                </button>
              ))}
              <button
                type="button"
                onClick={handleRandomFillActive}
                className="px-3 py-1.5 text-xs font-medium bg-[#131C31] hover:bg-slate-800 text-sky-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Acak {deckSize} Kartu Unik</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#131C31] border border-slate-800 rounded-xl">
                {[
                  { id: 'ALL' as PoolFilter, label: `Semua (${BATTLE_CARDS.length})` },
                  { id: 'CHARACTER' as PoolFilter, label: 'Karakter' },
                  { id: 'CONDITIONAL' as PoolFilter, label: 'Bersyarat' },
                  { id: 'SUPPORT' as PoolFilter, label: 'Pendukung' },
                  { id: 'CUSTOM' as PoolFilter, label: `Kustom/Edit (${customOrEditedCount})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPoolFilter(f.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      poolFilter === f.id
                        ? 'bg-slate-700 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau efek..."
                  className="w-full sm:w-52 pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-[#131C31] border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {notice && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2.5">
              {notice}
            </p>
          )}

          {/* Card Pool Grid */}
          {visiblePool.length === 0 ? (
            <div className="py-14 px-4 text-center bg-[#131C31] border border-slate-800 rounded-2xl space-y-3">
              <p className="text-sm text-slate-300">
                {poolFilter === 'CUSTOM'
                  ? 'Belum ada kartu yang diupload atau diedit.'
                  : 'Tidak ada kartu yang cocok dengan filter ini.'}
              </p>
              <div className="flex items-center justify-center gap-3">
                {poolFilter === 'CUSTOM' ? (
                  <button
                    type="button"
                    onClick={onOpenCreateCard}
                    className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload / Buat Kartu Sekarang</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPoolFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Tampilkan Semua Kartu
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 justify-items-center">
              {visiblePool.map((card) => {
                const inActive = activeDeckIds.includes(card.id);
                const lockedByOther = exclusiveDraft && otherDeckIds.includes(card.id);
                const deckFull = !inActive && activeDeckIds.length >= deckSize;

                return (
                  <div key={card.id} className="flex flex-col items-center w-full max-w-[168px]">
                    <CardVisual
                      card={card}
                      size="sm"
                      selected={inActive}
                      disabled={lockedByOther}
                      disabledReason={
                        lockedByOther
                          ? `Dipakai oleh Petarung ${editingFighter === 0 ? '2' : '1'}`
                          : undefined
                      }
                      onClick={() => toggleCardInActiveDeck(card.id)}
                      onInspect={onInspectCard}
                      onEdit={onEditCard}
                    />
                    <div className="mt-2 w-full text-center">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {card.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 tabular-nums truncate">
                        {card.category === CardCategory.CHARACTER
                          ? `${card.rank} · ${card.hp}/${card.atk}`
                          : `Pendukung · 0${card.effectPriority ?? 2}`}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={lockedByOther || deckFull}
                      onClick={() => toggleCardInActiveDeck(card.id)}
                      className={`mt-2 w-full py-1.5 px-2.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                        inActive
                          ? editingFighter === 0
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-sky-400 text-slate-950'
                          : lockedByOther
                          ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                          : 'bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200'
                      }`}
                    >
                      {inActive ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Terpilih (1x)</span>
                        </>
                      ) : lockedByOther ? (
                        <span>Dipakai Lawan</span>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Pilih Kartu</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 4 cols: Dual Unique Lineup Summary & Launch */}
        <div className="lg:col-span-4 bg-[#131C31] border border-slate-800 rounded-2xl p-5 sticky top-20 space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
            <div>
              <h2 className="text-base font-display font-bold text-white">
                Dek Unik {editingFighter === 0 ? p1Name || 'Petarung 1' : p2Name || 'Petarung 2'}
              </h2>
              <div className="mt-0.5 text-xs text-slate-400 font-mono tabular-nums">
                <span>Tanpa Syarat {editingFighter === 0 ? p1Uncond : p2Uncond}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>Maks 1x per kartu</span>
              </div>
            </div>
            <div
              className={`font-mono text-base font-bold tabular-nums ${
                activeDeckIds.length === deckSize ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {activeDeckIds.length}/{deckSize}
            </div>
          </div>

          {/* Readiness summary for both fighters */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
            <button
              type="button"
              onClick={() => setEditingFighter(0)}
              className={`p-2.5 rounded-xl border text-left transition-colors ${
                editingFighter === 0
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="truncate font-sans font-semibold text-white">
                {p1Name.trim() || 'Petarung 1'}
              </div>
              <div className="mt-0.5">
                {p1Ids.length}/{deckSize} unik · Dasar {p1Uncond}
              </div>
              <div className="mt-0.5 text-[11px] truncate text-slate-300">
                {availableSuitSets.find((s) => s.id === p1SuitSet)?.shortLabel ?? `Suit #${p1SuitSet}`}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setEditingFighter(1)}
              className={`p-2.5 rounded-xl border text-left transition-colors ${
                editingFighter === 1
                  ? 'bg-sky-500/10 border-sky-400/40 text-sky-200'
                  : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="truncate font-sans font-semibold text-white">
                {p2Name.trim() || 'Petarung 2'}
              </div>
              <div className="mt-0.5">
                {p2Ids.length}/{deckSize} unik · Dasar {p2Uncond}
              </div>
              <div className="mt-0.5 text-[11px] truncate text-slate-300">
                {availableSuitSets.find((s) => s.id === p2SuitSet)?.shortLabel ?? `Suit #${p2SuitSet}`}
              </div>
            </button>
          </div>

          {(p1Uncond < minRequiredBase || p2Uncond < minRequiredBase) && (
            <p className="text-xs text-rose-300">
              Setiap petarung wajib membawa minimal {minRequiredBase} Karakter tanpa syarat agar dapat turun di ronde pembuka.
            </p>
          )}

          {/* Active Fighter Selected Unique Card List */}
          <div className="max-h-[320px] overflow-y-auto pr-1 divide-y divide-slate-800/80">
            {activeDeckIds.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Belum ada kartu terpilih untuk petarung ini. Klik kartu di sebelah kiri atau gunakan tombol Acak.
              </div>
            ) : (
              activeDeckIds.map((id, index) => {
                const def = CARD_BY_ID[id];
                if (!def) return null;
                return (
                  <div key={id} className="py-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectCard(def)}
                      className="text-left min-w-0 flex-1 hover:text-amber-300 transition-colors"
                    >
                      <div className="text-xs sm:text-sm font-medium text-slate-100 truncate">
                        <span className="font-mono text-xs text-slate-500 mr-1.5 tabular-nums">
                          {String(index + 1).padStart(2, '0')}.
                        </span>
                        {def.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {def.category === CardCategory.CHARACTER
                          ? `Rank ${def.rank} · HP ${def.hp} · ATK ${def.atk}`
                          : `Pendukung · Efek 0${def.effectPriority ?? 2}`}
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditCard(def)}
                        aria-label={`Edit ${def.name}`}
                        className="w-7 h-7 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 flex items-center justify-center transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCardInActiveDeck(def.id)}
                        className="px-2 py-1 text-[11px] font-semibold rounded-md bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition-colors whitespace-nowrap shrink-0"
                      >
                        Lepas
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveDeckIds(() => []);
                  setNotice(null);
                }}
                className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kosongkan</span>
              </button>

              {activeDeckIds.length < deckSize && (
                <button
                  type="button"
                  onClick={handleFillRemainingActive}
                  className="flex-1 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Lengkapi Sisa ({deckSize - activeDeckIds.length})
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={!canStartMatch}
              onClick={startCustomBattle}
              className="w-full py-3 px-4 text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <Swords className="w-4 h-4" />
              <span>
                {canStartMatch
                  ? 'Mulai Pertarungan Custom 1v1'
                  : `Lengkapi Dek (${p1Ids.length}/${deckSize} & ${p2Ids.length}/${deckSize})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
