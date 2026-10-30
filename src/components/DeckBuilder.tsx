import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  Swords,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ALL_PACK_SERIES,
  BATTLE_CARDS,
  buildPlayableDeckFromPackSeries,
  CARD_BY_ID,
  cardBelongsToPackSeries,
  createStarterSavedDecks,
  deduplicateDeckIds,
  getAvailableSuitArtSets,
  isCardModified,
  PACK_SERIES_BY_ID,
  PRESET_DECKS,
} from '../data/cards';
import { shuffleArray } from '../engine/battleEngine';
import {
  CardCategory,
  type CardDefinition,
  type CardPackSeries,
  type CardRank,
  type DeckTargetSize,
  type SavedUserDeck,
  type SuitArtSetId,
} from '../types/game';
import { soundFx } from '../utils/sound';
import { CardVisual } from './CardVisual';

interface DeckBuilderProps {
  savedDecks: SavedUserDeck[];
  activeDeckId: string;
  cardsVersion: number;
  onUpdateSavedDecks: (nextDecks: SavedUserDeck[], nextActiveId: string) => void;
  onUseDeckInBattle: (deck: SavedUserDeck) => void;
  onInspectCard: (card: CardDefinition) => void;
  onEditCard: (card: CardDefinition) => void;
  onOpenCreateCard: () => void;
  onOpenCreateSuitCard?: () => void;
  onEditPackSeries?: (pack: CardPackSeries) => void;
}

const RANK_SORT_WEIGHT: Record<CardRank, number> = {
  SR: 1,
  AR: 2,
  S: 3,
  A: 4,
  B: 5,
  C: 6,
  SUPPORT: 7,
  SUIT: 8,
};

function getMinBaseRequired(targetSize: DeckTargetSize): number {
  if (targetSize <= 10) return 3;
  if (targetSize <= 15) return 4;
  if (targetSize <= 20) return 6;
  return 8;
}

async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for iframe permissions
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.className = 'fixed -top-96 left-0 opacity-0 pointer-events-none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({
  savedDecks,
  activeDeckId,
  cardsVersion,
  onUpdateSavedDecks,
  onUseDeckInBattle,
  onInspectCard,
  onEditCard,
  onOpenCreateCard,
  onOpenCreateSuitCard,
  onEditPackSeries,
}) => {
  const safeDecks = useMemo(
    () => (Array.isArray(savedDecks) && savedDecks.length > 0 ? savedDecks : createStarterSavedDecks()),
    [savedDecks]
  );
  const [editingDeckId, setEditingDeckId] = useState<string>(activeDeckId || safeDecks[0].id);

  useEffect(() => {
    if (activeDeckId && safeDecks.some((d) => d.id === activeDeckId)) {
      setEditingDeckId(activeDeckId);
    }
  }, [activeDeckId, safeDecks]);

  const currentSavedDeck = useMemo(
    () => safeDecks.find((d) => d.id === editingDeckId) ?? safeDecks[0],
    [safeDecks, editingDeckId]
  );

  const [deckName, setDeckName] = useState<string>(() => currentSavedDeck?.name ?? 'Dek Utama');
  const [targetSize, setTargetSize] = useState<DeckTargetSize>(
    () => currentSavedDeck?.targetSize ?? 30
  );
  const [suitArtSet, setSuitArtSet] = useState<SuitArtSetId>(
    () => currentSavedDeck?.suitArtSet ?? 1
  );
  const [draftIds, setDraftIds] = useState<string[]>(() =>
    deduplicateDeckIds(currentSavedDeck?.cardIds ?? [], currentSavedDeck?.targetSize ?? 30)
  );

  const availableSuitSets = useMemo(() => {
    void cardsVersion;
    return getAvailableSuitArtSets();
  }, [cardsVersion]);

  const [categoryTab, setCategoryTab] = useState<'ALL' | 'CHARACTER' | 'SUPPORT' | 'CUSTOM'>('ALL');
  const [rankFilter, setRankFilter] = useState<'ALL' | 'HIGH' | 'MID' | 'BASE' | 'CONDITIONAL'>(
    'ALL'
  );
  const [packFilter, setPackFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<boolean>(false);

  // Import / Export Modal State
  const [codeModalOpen, setCodeModalOpen] = useState<boolean>(false);
  const [importCodeText, setImportCodeText] = useState<string>('');
  const [codeModalError, setCodeModalError] = useState<string | null>(null);

  // Sync draft state when switching between saved deck slots
  useEffect(() => {
    if (!currentSavedDeck) return;
    setEditingDeckId(currentSavedDeck.id);
    setDeckName(currentSavedDeck.name);
    setTargetSize(currentSavedDeck.targetSize);
    setSuitArtSet(currentSavedDeck.suitArtSet);
    setDraftIds(deduplicateDeckIds(currentSavedDeck.cardIds, currentSavedDeck.targetSize));
    setConfirmDeleteSlot(false);
  }, [currentSavedDeck?.id]);

  // Clean out any deleted custom cards if cardsVersion updates
  useEffect(() => {
    setDraftIds((prev) => deduplicateDeckIds(prev, targetSize));
  }, [cardsVersion, targetSize]);

  const selectedSet = useMemo(() => new Set(draftIds), [draftIds]);
  const minBaseRequired = getMinBaseRequired(targetSize);

  const deckEntries = useMemo(() => {
    void cardsVersion;
    return draftIds
      .map((id) => CARD_BY_ID[id])
      .filter((def): def is CardDefinition => Boolean(def));
  }, [draftIds, cardsVersion]);

  const unconditionalCharCount = useMemo(
    () =>
      deckEntries.filter((d) => d.category === CardCategory.CHARACTER && !d.condition).length,
    [deckEntries]
  );

  const conditionalCharCount = useMemo(
    () => deckEntries.filter((d) => Boolean(d.condition)).length,
    [deckEntries]
  );

  const supportCount = useMemo(
    () => deckEntries.filter((d) => d.category === CardCategory.SUPPORT).length,
    [deckEntries]
  );

  const avgStats = useMemo(() => {
    const chars = deckEntries.filter((d) => d.category === CardCategory.CHARACTER);
    if (chars.length === 0) return { hp: 0, atk: 0 };
    const hpSum = chars.reduce((acc, c) => acc + c.hp, 0);
    const atkSum = chars.reduce((acc, c) => acc + c.atk, 0);
    return {
      hp: Math.round(hpSum / chars.length),
      atk: Math.round(atkSum / chars.length),
    };
  }, [deckEntries]);

  // Check Prerequisite Coverage for Conditional Cards in Deck
  const missingPrerequisites = useMemo(() => {
    const availableTags = new Set<string>();
    for (const def of deckEntries) {
      for (const t of def.characterTags) {
        availableTags.add(t);
      }
    }

    const warnings: Array<{
      conditionalCard: CardDefinition;
      missingTag: string;
      suggestedCard: CardDefinition | null;
    }> = [];

    for (const def of deckEntries) {
      if (!def.condition) continue;
      const { mode, requiredTags } = def.condition;
      if (mode === 'ALL') {
        for (const reqTag of requiredTags) {
          if (!availableTags.has(reqTag)) {
            const candidate =
              BATTLE_CARDS.find(
                (c) =>
                  !selectedSet.has(c.id) &&
                  c.characterTags.includes(reqTag) &&
                  !c.condition
              ) ??
              BATTLE_CARDS.find(
                (c) => !selectedSet.has(c.id) && c.characterTags.includes(reqTag)
              ) ??
              null;
            warnings.push({
              conditionalCard: def,
              missingTag: reqTag,
              suggestedCard: candidate,
            });
          }
        }
      } else {
        const hasAny = requiredTags.some((t) => availableTags.has(t));
        if (!hasAny && requiredTags.length > 0) {
          const firstTag = requiredTags[0];
          const candidate =
            BATTLE_CARDS.find(
              (c) =>
                !selectedSet.has(c.id) &&
                requiredTags.some((rt) => c.characterTags.includes(rt)) &&
                !c.condition
            ) ?? null;
          warnings.push({
            conditionalCard: def,
            missingTag: requiredTags.join(' / '),
            suggestedCard: candidate,
          });
          void firstTag;
        }
      }
    }

    return warnings;
  }, [deckEntries, selectedSet]);

  const isDeckValid = draftIds.length === targetSize && unconditionalCharCount >= minBaseRequired;

  const buildDraftPayload = (overrideIds?: string[]): SavedUserDeck => {
    const cleanIds = deduplicateDeckIds(overrideIds ?? draftIds, targetSize);
    return {
      id: currentSavedDeck.id,
      name: deckName.trim() || 'Dek Kustom Pemain',
      targetSize,
      suitArtSet,
      cardIds: cleanIds,
      updatedAt: Date.now(),
    };
  };

  const commitDraftToSavedDecks = (
    overridePayload?: SavedUserDeck,
    makeActive = false,
    noticeMessage?: string
  ) => {
    const payload = overridePayload ?? buildDraftPayload();
    const exists = safeDecks.some((d) => d.id === payload.id);
    const nextDecks = exists
      ? safeDecks.map((d) => (d.id === payload.id ? payload : d))
      : [...safeDecks, payload];
    const nextActive = makeActive ? payload.id : activeDeckId || payload.id;
    onUpdateSavedDecks(nextDecks, nextActive);
    if (noticeMessage) {
      setSavedNotice(noticeMessage);
    }
  };

  const handleSelectSlot = (slot: SavedUserDeck) => {
    soundFx.playCardSelect();
    setEditingDeckId(slot.id);
    setDeckName(slot.name);
    setTargetSize(slot.targetSize);
    setSuitArtSet(slot.suitArtSet);
    setDraftIds(deduplicateDeckIds(slot.cardIds, slot.targetSize));
    setSavedNotice(null);
    setConfirmDeleteSlot(false);
  };

  const handleCreateNewDeckSlot = () => {
    soundFx.playCardSelect();
    const newIndex = safeDecks.length + 1;
    const starterIds = buildPlayableDeckFromPackSeries('pek-blazing-frost', 20);
    const newSlot: SavedUserDeck = {
      id: `user-deck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Dek Kustom #${newIndex}`,
      targetSize: 20,
      suitArtSet: 1,
      cardIds: starterIds,
      updatedAt: Date.now(),
    };
    const nextDecks = [...safeDecks, newSlot];
    onUpdateSavedDecks(nextDecks, newSlot.id);
    handleSelectSlot(newSlot);
    setSavedNotice(`Slot "${newSlot.name}" dibuat dan dipilih sebagai dek aktif.`);
  };

  const handleDuplicateDeckSlot = () => {
    soundFx.playCardSelect();
    const currentPayload = buildDraftPayload();
    const copySlot: SavedUserDeck = {
      ...currentPayload,
      id: `user-deck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${currentPayload.name} (Salinan)`.slice(0, 36),
      updatedAt: Date.now(),
    };
    const nextDecks = [...safeDecks, copySlot];
    onUpdateSavedDecks(nextDecks, activeDeckId || copySlot.id);
    handleSelectSlot(copySlot);
    setSavedNotice(`Dek berhasil digandakan menjadi "${copySlot.name}".`);
  };

  const handleDeleteCurrentSlot = () => {
    if (safeDecks.length <= 1) return;
    const remaining = safeDecks.filter((d) => d.id !== currentSavedDeck.id);
    const nextActive =
      activeDeckId === currentSavedDeck.id ? remaining[0].id : activeDeckId;
    onUpdateSavedDecks(remaining, nextActive);
    handleSelectSlot(remaining[0]);
    setSavedNotice('Slot dek telah dihapus.');
  };

  const handleChangeTargetSize = (nextSize: DeckTargetSize) => {
    setTargetSize(nextSize);
    setDraftIds((prev) => deduplicateDeckIds(prev, nextSize));
    setSavedNotice(
      `Ukuran target dek diatur ke ${nextSize} kartu unik (minimal ${getMinBaseRequired(
        nextSize
      )} Karakter Dasar).`
    );
  };

  const toggleCard = (cardId: string) => {
    setSavedNotice(null);
    if (selectedSet.has(cardId)) {
      setDraftIds((prev) => prev.filter((id) => id !== cardId));
      return;
    }
    if (draftIds.length >= targetSize) {
      setSavedNotice(
        `Dek sudah mencapai batas ${targetSize} kartu unik. Lepas 1 kartu terlebih dulu atau naikkan ukuran target dek.`
      );
      return;
    }
    soundFx.playCardSelect();
    setDraftIds((prev) => deduplicateDeckIds([...prev, cardId], targetSize));
  };

  const moveCardInDeck = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= draftIds.length) return;
    setDraftIds((prev) => {
      const copy = [...prev];
      [copy[index], copy[targetIdx]] = [copy[targetIdx], copy[index]];
      return copy;
    });
  };

  const sortDraftDeck = (by: 'RANK' | 'ATK' | 'NUMBER') => {
    setDraftIds((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const da = CARD_BY_ID[a];
        const db = CARD_BY_ID[b];
        if (!da || !db) return 0;
        if (by === 'RANK') {
          const rw = RANK_SORT_WEIGHT[da.rank] - RANK_SORT_WEIGHT[db.rank];
          if (rw !== 0) return rw;
          return db.atk + db.hp - (da.atk + da.hp);
        }
        if (by === 'ATK') {
          return db.atk - da.atk || db.hp - da.hp;
        }
        return da.id.localeCompare(db.id);
      });
      return sorted;
    });
    setSavedNotice(
      by === 'RANK'
        ? 'Urutan dek dirapikan berdasarkan Rank tertinggi.'
        : by === 'ATK'
        ? 'Urutan dek dirapikan berdasarkan nilai ATK tertinggi.'
        : 'Urutan dek dirapikan berdasarkan nomor kartu.'
    );
  };

  const handleAutoCompleteUnique = (prioritizePackId?: string) => {
    const used = new Set(draftIds);
    const next = [...draftIds];
    const currentUncond = next.filter((id) => {
      const d = CARD_BY_ID[id];
      return d && d.category === CardCategory.CHARACTER && !d.condition;
    }).length;
    const neededUncond = Math.max(0, minBaseRequired - currentUncond);

    const targetPack =
      prioritizePackId ?? (packFilter !== 'ALL' ? packFilter : undefined);

    const orderedPool = targetPack
      ? [
          ...shuffleArray(BATTLE_CARDS.filter((c) => cardBelongsToPackSeries(c, targetPack))),
          ...shuffleArray(BATTLE_CARDS.filter((c) => !cardBelongsToPackSeries(c, targetPack))),
        ]
      : shuffleArray([...BATTLE_CARDS]);

    if (neededUncond > 0) {
      let addedBase = 0;
      for (const c of orderedPool) {
        if (next.length >= targetSize || addedBase >= neededUncond) break;
        if (!used.has(c.id) && c.category === CardCategory.CHARACTER && !c.condition) {
          next.push(c.id);
          used.add(c.id);
          addedBase += 1;
        }
      }
    }

    for (const c of orderedPool) {
      if (next.length >= targetSize) break;
      if (!used.has(c.id)) {
        next.push(c.id);
        used.add(c.id);
      }
    }

    const finalIds = deduplicateDeckIds(next, targetSize);
    setDraftIds(finalIds);
    const packLabel = targetPack ? PACK_SERIES_BY_ID[targetPack]?.name : null;
    setSavedNotice(
      packLabel
        ? `Dek dilengkapi menjadi ${finalIds.length} kartu unik dengan prioritas seri ${packLabel}.`
        : `Dek dilengkapi otomatis menjadi ${finalIds.length} kartu unik siap tanding.`
    );
  };

  const exportedDeckJson = useMemo(() => {
    const payload = {
      name: deckName.trim() || 'Dek Monsta',
      targetSize,
      suitArtSet,
      cardIds: draftIds,
    };
    return JSON.stringify(payload);
  }, [deckName, targetSize, suitArtSet, draftIds]);

  const handleImportDeckJson = () => {
    setCodeModalError(null);
    const trimmed = importCodeText.trim();
    if (!trimmed) {
      setCodeModalError('Tempelkan kode JSON dek terlebih dahulu.');
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      const rawIds: string[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.cardIds)
        ? parsed.cardIds
        : [];
      const validSize: DeckTargetSize =
        parsed.targetSize === 10 ||
        parsed.targetSize === 15 ||
        parsed.targetSize === 20 ||
        parsed.targetSize === 30
          ? parsed.targetSize
          : 30;
      const cleanedIds = deduplicateDeckIds(rawIds, validSize);
      if (cleanedIds.length === 0) {
        setCodeModalError('Tidak ada ID kartu yang dikenali di dalam kode dek tersebut.');
        return;
      }
      if (typeof parsed.name === 'string' && parsed.name.trim()) {
        setDeckName(parsed.name.trim().slice(0, 36));
      }
      setTargetSize(validSize);
      if (
        typeof parsed.suitArtSet === 'number' &&
        Number.isFinite(parsed.suitArtSet) &&
        Math.floor(parsed.suitArtSet) >= 1
      ) {
        setSuitArtSet(Math.floor(parsed.suitArtSet));
      }
      setDraftIds(cleanedIds);
      setCodeModalOpen(false);
      setImportCodeText('');
      setSavedNotice(`Berhasil mengimpor ${cleanedIds.length} kartu unik ke slot dek ini.`);
    } catch {
      setCodeModalError('Format kode dek tidak valid. Pastikan menyalin kode JSON secara utuh.');
    }
  };

  const charTotal = useMemo(() => {
    void cardsVersion;
    return BATTLE_CARDS.filter((c) => c.category === CardCategory.CHARACTER).length;
  }, [cardsVersion]);

  const supportTotal = useMemo(() => {
    void cardsVersion;
    return BATTLE_CARDS.filter((c) => c.category === CardCategory.SUPPORT).length;
  }, [cardsVersion]);

  const customTotal = useMemo(() => {
    void cardsVersion;
    return BATTLE_CARDS.filter((c) => c.isCustom || isCardModified(c.id)).length;
  }, [cardsVersion]);

  const visiblePool = useMemo(() => {
    void cardsVersion;
    const q = searchQuery.trim().toLowerCase();
    return BATTLE_CARDS.filter((c) => {
      if (packFilter !== 'ALL' && !cardBelongsToPackSeries(c, packFilter)) return false;
      if (categoryTab === 'CHARACTER' && c.category !== CardCategory.CHARACTER) return false;
      if (categoryTab === 'SUPPORT' && c.category !== CardCategory.SUPPORT) return false;
      if (categoryTab === 'CUSTOM' && !c.isCustom && !isCardModified(c.id)) return false;

      if (rankFilter === 'HIGH' && c.rank !== 'SR' && c.rank !== 'AR' && c.rank !== 'S') {
        return false;
      }
      if (rankFilter === 'MID' && c.rank !== 'A') return false;
      if (rankFilter === 'BASE' && c.rank !== 'B' && c.rank !== 'C') return false;
      if (rankFilter === 'CONDITIONAL' && !c.condition) return false;

      if (q) {
        const inTags = c.characterTags.some((t) => t.toLowerCase().includes(q));
        return (
          c.name.toLowerCase().includes(q) ||
          c.effectText.toLowerCase().includes(q) ||
          c.numberLabel.toLowerCase().includes(q) ||
          inTags
        );
      }
      return true;
    });
  }, [categoryTab, rankFilter, packFilter, searchQuery, cardsVersion]);

  return (
    <section className="max-w-[1380px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header & Global Deck Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="text-xs font-mono text-amber-400">
            Studio Atur Dek Multi-Slot · Singleton 1x Unik &amp; Seri Kartu Suit Kustom
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-display font-extrabold text-white">
            Manajer Atur Dek &amp; Kartu Suit
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Kelola beberapa slot dek sekaligus, atur target ukuran dek (10–30 kartu unik), periksa rantai prasyarat evolusi, dan pasang Seri Kartu Suit resmi maupun upload kustommu sendiri.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCreateNewDeckSlot}
            className="px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Slot Dek Baru</span>
          </button>

          <button
            type="button"
            onClick={handleDuplicateDeckSlot}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Gandakan Dek</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCodeModalError(null);
              setCodeModalOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor / Impor</span>
          </button>

          {onOpenCreateSuitCard && (
            <button
              type="button"
              onClick={onOpenCreateSuitCard}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/35 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Suit Baru</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCreateCard}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/35 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Kartu</span>
          </button>
        </div>
      </div>

      {/* Multi-Slot Saved Decks Bar */}
      <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-mono text-slate-400 tabular-nums">
            Slot Dek Tersimpan ({safeDecks.length} Dek) · Klik slot untuk berpindah dek
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_DECKS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  const loaded = deduplicateDeckIds(preset.cardIds, targetSize);
                  setDraftIds(loaded);
                  setSavedNotice(
                    `Memuat templat "${preset.name.split('(')[0].trim()}" (${loaded.length}/${targetSize} kartu).`
                  );
                }}
                className="px-2.5 py-1 text-[11px] font-medium bg-[#0B1120] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Templat: {preset.name.split('(')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {safeDecks.map((slot) => {
            const isEditing = slot.id === currentSavedDeck.id;
            const isPrimaryActive = slot.id === activeDeckId;
            const slotSuitMeta = availableSuitSets.find((s) => s.id === slot.suitArtSet);

            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => handleSelectSlot(slot)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                  isEditing
                    ? 'bg-[#0B1120] border-amber-400 ring-1 ring-amber-400/50'
                    : 'bg-[#0B1120]/70 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-display font-bold text-sm text-white truncate">
                    {slot.name}
                  </div>
                  <span
                    className={`font-mono text-[11px] tabular-nums shrink-0 ${
                      isPrimaryActive ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {isPrimaryActive ? 'Dek Aktif' : 'Slot'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 tabular-nums truncate">
                  <span>
                    {slot.cardIds.length}/{slot.targetSize} Kartu
                  </span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span className={slotSuitMeta?.isCustom ? 'text-sky-300' : ''}>
                    {slotSuitMeta?.shortLabel ?? `Suit #${slot.suitArtSet}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Slot Configuration Controls */}
        <div className="pt-4 border-t border-slate-800/90 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nama Slot Dek Ini
            </label>
            <input
              type="text"
              maxLength={36}
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="Masukkan nama dek..."
              className="w-full px-3.5 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Ukuran Target Dek Unik
            </label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
              {([10, 15, 20, 30] as DeckTargetSize[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleChangeTargetSize(sz)}
                  className={`py-1.5 text-xs font-mono font-semibold rounded-lg transition-colors tabular-nums ${
                    targetSize === sz
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Seri Kartu Suit (Air · Api · Daun)
            </label>
            <div className="flex items-center gap-2">
              <select
                value={suitArtSet}
                onChange={(e) => setSuitArtSet(Math.max(1, Number(e.target.value) || 1))}
                className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
              >
                {availableSuitSets.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {onOpenCreateSuitCard && (
                <button
                  type="button"
                  onClick={onOpenCreateSuitCard}
                  className="px-3 py-2 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-sky-300 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Suit Baru</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 8 Columns: Card Pool Browser */}
        <div className="lg:col-span-8 space-y-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#131C31] border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCategoryTab('ALL')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    categoryTab === 'ALL'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Semua ({BATTLE_CARDS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryTab('CHARACTER')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    categoryTab === 'CHARACTER'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Karakter ({charTotal})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryTab('SUPPORT')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    categoryTab === 'SUPPORT'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Pendukung ({supportTotal})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryTab('CUSTOM')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    categoryTab === 'CUSTOM'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Kustom ({customTotal})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={rankFilter}
                  onChange={(e) =>
                    setRankFilter(
                      e.target.value as 'ALL' | 'HIGH' | 'MID' | 'BASE' | 'CONDITIONAL'
                    )
                  }
                  aria-label="Filter berdasarkan Rank"
                  className="px-3 py-1.5 text-xs font-medium bg-[#131C31] border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">Semua Rank</option>
                  <option value="HIGH">Langka (SR / AR / S)</option>
                  <option value="MID">Menengah (Rank A)</option>
                  <option value="BASE">Dasar (Rank B &amp; C)</option>
                  <option value="CONDITIONAL">Khusus Bersyarat</option>
                </select>

                <select
                  value={packFilter}
                  onChange={(e) => setPackFilter(e.target.value)}
                  aria-label="Filter kolam kartu berdasarkan Seri Pek"
                  className="px-3 py-1.5 text-xs font-medium bg-[#131C31] border border-slate-800 rounded-xl text-amber-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">Semua Seri Pek</option>
                  {ALL_PACK_SERIES.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name} ({pack.codePrefix})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama karakter, efek kartu, atau tag prasyarat..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-[#131C31] border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {packFilter !== 'ALL' && (
                <div className="flex items-center gap-2 shrink-0">
                  {onEditPackSeries && PACK_SERIES_BY_ID[packFilter] && (
                    <button
                      type="button"
                      onClick={() => onEditPackSeries(PACK_SERIES_BY_ID[packFilter])}
                      className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Seri</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const packDeck = buildPlayableDeckFromPackSeries(packFilter, targetSize);
                      setDraftIds(packDeck);
                      const pName = PACK_SERIES_BY_ID[packFilter]?.name ?? 'Seri Pek';
                      setSavedNotice(
                        `Dek ${targetSize} kartu unik disusun penuh dari ${pName}.`
                      );
                    }}
                    className="px-3.5 py-2 text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    Rakit {targetSize} Kartu dari Seri Ini
                  </button>
                </div>
              )}
            </div>
          </div>

          {visiblePool.length === 0 ? (
            <div className="py-16 text-center bg-[#131C31] border border-slate-800 rounded-2xl space-y-3">
              <p className="text-sm text-slate-300">
                Tidak ada kartu yang cocok dengan filter pencarian saat ini.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCategoryTab('ALL');
                  setRankFilter('ALL');
                  setPackFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter Pencarian</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 justify-items-center">
              {visiblePool.map((card) => {
                const isSelected = selectedSet.has(card.id);
                const deckFull = !isSelected && draftIds.length >= targetSize;

                return (
                  <div key={card.id} className="flex flex-col items-center w-full max-w-[168px]">
                    <CardVisual
                      card={card}
                      size="sm"
                      selected={isSelected}
                      onClick={() => toggleCard(card.id)}
                      onInspect={onInspectCard}
                      onEdit={onEditCard}
                    />
                    <div className="mt-2 w-full text-center">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {card.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                        {card.category === CardCategory.CHARACTER
                          ? `${card.rank} · ${card.hp}/${card.atk}`
                          : `Pendukung · 0${card.effectPriority ?? 2}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={deckFull}
                      onClick={() => toggleCard(card.id)}
                      className={`mt-2 w-full py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Di Dek (1x)</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Masukkan</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 4 Columns: Active Deck Inspector, Prerequisite Checker & Ordering */}
        <div className="lg:col-span-4 bg-[#131C31] border border-slate-800 rounded-2xl p-5 sticky top-20 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-800">
            <div className="min-w-0">
              <h2 className="text-lg font-display font-bold text-white truncate">
                {deckName.trim() || 'Dek Tanpa Nama'}
              </h2>
              <div className="mt-0.5 text-xs text-slate-400 font-mono tabular-nums">
                <span>Dasar {unconditionalCharCount}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>Bersyarat {conditionalCharCount}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>Pendukung {supportCount}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                Rata-rata Karakter: HP {avgStats.hp} · ATK {avgStats.atk}
              </div>
            </div>
            <div
              className={`font-mono text-base font-bold tabular-nums shrink-0 ${
                draftIds.length === targetSize ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {draftIds.length}/{targetSize}
            </div>
          </div>

          {unconditionalCharCount < minBaseRequired && (
            <p className="text-xs text-rose-300 leading-relaxed">
              Butuh minimal {minBaseRequired} Karakter Dasar (tanpa syarat) untuk dek {targetSize}{' '}
              kartu agar tangan awal selalu siap bertarung (saat ini: {unconditionalCharCount}).
            </p>
          )}

          {/* Prerequisite Chain Warnings with 1-Click Fix */}
          {missingPrerequisites.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
              <div className="text-xs font-semibold text-rose-200">
                Peringatan Prasyarat Kartu Bersyarat ({missingPrerequisites.length})
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {missingPrerequisites.map((warn, idx) => (
                  <div
                    key={`${warn.conditionalCard.id}-${warn.missingTag}-${idx}`}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="text-slate-300 truncate">
                      <strong className="text-white">{warn.conditionalCard.name}</strong> butuh{' '}
                      <span className="text-amber-300">{warn.missingTag}</span>
                    </span>
                    {warn.suggestedCard && draftIds.length < targetSize && (
                      <button
                        type="button"
                        onClick={() => toggleCard(warn.suggestedCard!.id)}
                        className="px-2 py-0.5 font-semibold rounded bg-amber-500 hover:bg-amber-400 text-slate-950 whitespace-nowrap shrink-0"
                      >
                        + {warn.suggestedCard.name.replace('BoBoiBoy ', '')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {savedNotice && <p className="text-xs text-emerald-300 leading-relaxed">{savedNotice}</p>}

          {/* Deck Sorting & Quick Ordering Controls */}
          {deckEntries.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
              <span className="text-slate-400 font-mono">Urutkan Dek:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => sortDraftDeck('RANK')}
                  className="px-2 py-1 rounded bg-[#0B1120] hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                >
                  Rank
                </button>
                <button
                  type="button"
                  onClick={() => sortDraftDeck('ATK')}
                  className="px-2 py-1 rounded bg-[#0B1120] hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                >
                  ATK
                </button>
                <button
                  type="button"
                  onClick={() => sortDraftDeck('NUMBER')}
                  className="px-2 py-1 rounded bg-[#0B1120] hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                >
                  Nomor
                </button>
              </div>
            </div>
          )}

          {/* Ordered Card List in Current Deck */}
          <div className="max-h-[340px] overflow-y-auto pr-1 divide-y divide-slate-800/80">
            {deckEntries.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Dek masih kosong. Pilih {targetSize} kartu unik di sebelah kiri atau gunakan tombol Isi Otomatis.
              </div>
            ) : (
              deckEntries.map((def, idx) => {
                return (
                  <div key={def.id} className="py-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectCard(def)}
                      className="text-left min-w-0 flex-1 hover:text-amber-300 transition-colors"
                    >
                      <div className="text-xs sm:text-sm font-medium text-slate-100 truncate">
                        <span className="font-mono text-[11px] text-slate-500 mr-1.5 tabular-nums">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        {def.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        <span>{def.numberLabel}</span>
                        <span className="mx-1" aria-hidden="true">·</span>
                        <span>
                          {def.category === CardCategory.CHARACTER
                            ? `${def.rank} (${def.hp}/${def.atk})`
                            : 'Pendukung'}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveCardInDeck(idx, -1)}
                        aria-label={`Geser naik ${def.name}`}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 flex items-center justify-center"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === deckEntries.length - 1}
                        onClick={() => moveCardInDeck(idx, 1)}
                        aria-label={`Geser turun ${def.name}`}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 flex items-center justify-center"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditCard(def)}
                        aria-label={`Edit ${def.name}`}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 flex items-center justify-center"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCard(def.id)}
                        className="px-2 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition-colors whitespace-nowrap shrink-0"
                      >
                        Lepas
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Save, Activate, Delete & Launch Battle Footer */}
          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftIds([]);
                  setSavedNotice(null);
                }}
                className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kosongkan</span>
              </button>

              {draftIds.length < targetSize ? (
                <button
                  type="button"
                  onClick={() => handleAutoCompleteUnique()}
                  className="flex-1 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Lengkapi {targetSize} Unik</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!isDeckValid}
                  onClick={() => {
                    soundFx.playCardSelect();
                    commitDraftToSavedDecks(
                      undefined,
                      true,
                      `Dek "${deckName.trim() || 'Dek Kustom'}" disimpan & dijadikan Dek Aktif!`
                    );
                  }}
                  className="flex-1 px-3 py-2 text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 text-emerald-300 border border-emerald-500/40 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Simpan &amp; Jadikan Aktif</span>
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={!isDeckValid}
              onClick={() => {
                const payload = buildDraftPayload();
                commitDraftToSavedDecks(payload, true);
                onUseDeckInBattle(payload);
              }}
              className="w-full px-4 py-3 text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <Swords className="w-4 h-4" />
              <span>Simpan &amp; Mainkan di Arena Duel</span>
            </button>

            {safeDecks.length > 1 && (
              <div className="pt-1 flex items-center justify-end">
                {!confirmDeleteSlot ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteSlot(true)}
                    className="text-[11px] font-medium text-slate-500 hover:text-rose-300 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Slot Dek Ini</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-rose-300">Hapus slot &quot;{deckName}&quot;?</span>
                    <button
                      type="button"
                      onClick={handleDeleteCurrentSlot}
                      className="px-2.5 py-1 rounded bg-rose-500 text-white font-semibold"
                    >
                      Ya, Hapus
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSlot(false)}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-300"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export / Import Deck Code Modal */}
      {codeModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/88 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setCodeModalOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-[#131C31] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="text-xs font-mono text-amber-400">Bagikan &amp; Cadangkan Dek</div>
                <h3 className="text-lg font-display font-bold text-white">
                  Ekspor / Impor Kode Dek
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCodeModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Kode Dek Saat Ini ({draftIds.length} Kartu)
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyTextSafe(exportedDeckJson);
                    setSavedNotice(
                      ok
                        ? 'Kode JSON dek berhasil disalin ke papan klip!'
                        : 'Gagal menyalin otomatis — silakan salin teks kode secara manual.'
                    );
                  }}
                  className="px-3 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin Kode</span>
                </button>
              </div>
              <textarea
                readOnly
                rows={3}
                value={exportedDeckJson}
                className="w-full p-3 text-xs font-mono bg-[#0B1120] border border-slate-800 rounded-xl text-slate-300 focus:outline-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Impor Kode Dek dari Teman / Cadangan
              </label>
              {codeModalError && <p className="text-xs text-rose-300">{codeModalError}</p>}
              <textarea
                rows={3}
                value={importCodeText}
                onChange={(e) => setImportCodeText(e.target.value)}
                placeholder='Tempelkan kode JSON dek di sini, lalu klik "Muat Kode Dek"...'
                className="w-full p-3 text-xs font-mono bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCodeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleImportDeckJson}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl"
                >
                  Muat Kode Dek
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
