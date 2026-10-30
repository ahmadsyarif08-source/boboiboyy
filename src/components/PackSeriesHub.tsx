import React, { useMemo, useState } from 'react';
import {
  Eye,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Swords,
  Unlock,
  Upload,
} from 'lucide-react';
import {
  ALL_PACK_SERIES,
  BRAND_LOGOS,
  buildPlayableDeckFromPackSeries,
  CARD_BY_ID,
  getCardsForPackSeries,
  getUnlockedCollectionIds,
  isPackSeriesModified,
  openBoosterPack,
  PACK_SERIES_BY_ID,
  resetUnlockedCollection,
  unlockAllCollectionCards,
} from '../data/cards';
import {
  CardCategory,
  type CardDefinition,
  type CardPackSeries,
  type PackAccentTheme,
} from '../types/game';
import { soundFx } from '../utils/sound';
import { InteractiveCard3DTilt } from './Card3DShowcase';
import { CardBack, CardVisual } from './CardVisual';

interface PackSeriesHubProps {
  cardsVersion: number;
  onInspectCard: (card: CardDefinition) => void;
  onEditCard: (card: CardDefinition) => void;
  onOpenCreateCardInPack: (packSeriesId: string) => void;
  onOpenCreateSeries: () => void;
  onOpenEditSeries: (pack: CardPackSeries) => void;
  onUsePackInBattle: (deckIds: string[], packId?: string) => void;
  onLoadPackIntoDeckBuilder: (deckIds: string[], packId?: string, packName?: string) => void;
}

interface PulledBoosterItem {
  slotKey: string;
  card: CardDefinition;
  isNewUnlock: boolean;
  revealed: boolean;
}

const ACCENT_BORDER_MAP: Record<PackAccentTheme, string> = {
  amber: 'border-amber-500/45 hover:border-amber-400',
  sky: 'border-sky-500/45 hover:border-sky-400',
  emerald: 'border-emerald-500/45 hover:border-emerald-400',
  rose: 'border-rose-500/45 hover:border-rose-400',
};

const ACCENT_ACTIVE_RING: Record<PackAccentTheme, string> = {
  amber: 'border-amber-400 ring-2 ring-amber-400/50',
  sky: 'border-sky-400 ring-2 ring-sky-400/50',
  emerald: 'border-emerald-400 ring-2 ring-emerald-400/50',
  rose: 'border-rose-400 ring-2 ring-rose-400/50',
};

const ACCENT_TEXT_MAP: Record<PackAccentTheme, string> = {
  amber: 'text-amber-300',
  sky: 'text-sky-300',
  emerald: 'text-emerald-300',
  rose: 'text-rose-300',
};

const STAGGER_CLASSES = [
  'draw-stagger-0',
  'draw-stagger-1',
  'draw-stagger-2',
  'draw-stagger-3',
  'draw-stagger-4',
] as const;

export const PackSeriesHub: React.FC<PackSeriesHubProps> = ({
  cardsVersion,
  onInspectCard,
  onEditCard,
  onOpenCreateCardInPack,
  onOpenCreateSeries,
  onOpenEditSeries,
  onUsePackInBattle,
  onLoadPackIntoDeckBuilder,
}) => {
  const [selectedPackId, setSelectedPackId] = useState<string>('pek-blazing-frost');
  const [pulledItems, setPulledItems] = useState<PulledBoosterItem[]>([]);
  const [pullGeneration, setPullGeneration] = useState<number>(0);
  const [albumVersion, setAlbumVersion] = useState<number>(0);
  const [seriesCardFilter, setSeriesCardFilter] = useState<
    'ALL' | 'CHARACTER' | 'SUPPORT' | 'SUIT' | 'LOCKED'
  >('ALL');
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const unlockedSet = useMemo(() => {
    void cardsVersion;
    void albumVersion;
    return getUnlockedCollectionIds();
  }, [cardsVersion, albumVersion]);

  const activePack = useMemo(() => {
    void cardsVersion;
    return PACK_SERIES_BY_ID[selectedPackId] ?? ALL_PACK_SERIES[0];
  }, [selectedPackId, cardsVersion]);

  const activePackAllCards = useMemo(() => {
    void cardsVersion;
    return getCardsForPackSeries(activePack.id, true);
  }, [activePack.id, cardsVersion]);

  const activePackBattleCards = useMemo(() => {
    void cardsVersion;
    return getCardsForPackSeries(activePack.id, false);
  }, [activePack.id, cardsVersion]);

  const raritySummary = useMemo(() => {
    const counts = { SR: 0, AR: 0, S: 0, A: 0, B: 0, C: 0, SUPPORT: 0, SUIT: 0 };
    for (const c of activePackAllCards) {
      counts[c.rank] = (counts[c.rank] ?? 0) + 1;
    }
    return counts;
  }, [activePackAllCards]);

  const filteredSeriesCards = useMemo(() => {
    return activePackAllCards.filter((c) => {
      if (seriesCardFilter === 'CHARACTER') return c.category === CardCategory.CHARACTER;
      if (seriesCardFilter === 'SUPPORT') return c.category === CardCategory.SUPPORT;
      if (seriesCardFilter === 'SUIT') return c.category === CardCategory.SUIT;
      if (seriesCardFilter === 'LOCKED') return !unlockedSet.has(c.id);
      return true;
    });
  }, [activePackAllCards, seriesCardFilter, unlockedSet]);

  const handleOpenBooster = (boosterCount: number) => {
    if (activePackBattleCards.length === 0) {
      setFeedbackNotice(
        'Seri pek ini belum memiliki kartu pertarungan. Tambahkan atau upload kartu terlebih dahulu.'
      );
      return;
    }
    soundFx.playCardDeploy();
    const { cards, newlyUnlockedIds } = openBoosterPack(activePack.id, boosterCount);
    const newSet = new Set(newlyUnlockedIds);
    const items: PulledBoosterItem[] = cards.map((card, index) => ({
      slotKey: `pull-${Date.now()}-${index}-${card.id}`,
      card,
      isNewUnlock: newSet.has(card.id),
      revealed: false,
    }));
    setPullGeneration((g) => g + 1);
    setPulledItems(items);
    setAlbumVersion((v) => v + 1);
    setFeedbackNotice(
      `Booster ${activePack.name} siap dibuka (${items.length} kartu di meja). Klik masing-masing kartu atau tekan Buka Semua Kartu!`
    );
  };

  const handleRevealSinglePull = (slotKey: string) => {
    setPulledItems((prev) =>
      prev.map((item) => {
        if (item.slotKey !== slotKey || item.revealed) return item;
        if (item.card.rank === 'SR' || item.card.rank === 'AR' || item.card.rank === 'S') {
          soundFx.playRoundWin();
        } else {
          soundFx.playSuitClash('win');
        }
        return { ...item, revealed: true };
      })
    );
  };

  const handleRevealAllPulls = () => {
    soundFx.playSuitClash('win');
    setPulledItems((prev) => prev.map((item) => ({ ...item, revealed: true })));
  };

  const unrevealedCount = pulledItems.filter((i) => !i.revealed).length;

  return (
    <section className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Header & Primary Pack Series Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="text-xs font-mono text-amber-400">
            Edisi Resmi &amp; Ekspansi Kustom · Display 3D, Edit Seri &amp; Buka Booster
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-display font-extrabold text-white">
            Katalog &amp; Studio Seri Pek Kartu
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Pilih seri pek kartu untuk membuka Booster Pek beranimasi 3D, edit nama/sampul/daftar kartu pada seri apa pun, upload Kartu Suit baru, atau rancang Seri Pek Kustom buatanmu sendiri.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenCreateSeries}
            className="px-4 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Seri Pek Baru</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenEditSeries(activePack)}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/35 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Pencil className="w-4 h-4" />
            <span>Edit Seri {activePack.codePrefix}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCreateCardInPack(activePack.id)}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Kartu ke {activePack.codePrefix}</span>
          </button>
        </div>
      </div>

      {/* Pack Series Selector Shelf */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
        {ALL_PACK_SERIES.map((pack) => {
          const isSelected = pack.id === activePack.id;
          const packCards = getCardsForPackSeries(pack.id, true);
          const unlockedInPack = packCards.filter((c) => unlockedSet.has(c.id)).length;
          const showcaseDefs = (
            pack.showcaseCardIds.length > 0
              ? pack.showcaseCardIds
              : packCards.slice(0, 3).map((c) => c.id)
          )
            .map((id) => CARD_BY_ID[id])
            .filter((d): d is CardDefinition => Boolean(d))
            .slice(0, 3);

          return (
            <div
              key={pack.id}
              onClick={() => {
                soundFx.playCardSelect();
                setSelectedPackId(pack.id);
                setFeedbackNotice(null);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedPackId(pack.id);
                }
              }}
              className={`bg-[#131C31] border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all cursor-pointer ${
                isSelected ? ACCENT_ACTIVE_RING[pack.accentTheme] : ACCENT_BORDER_MAP[pack.accentTheme]
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-slate-400 tabular-nums">
                      <span>Kode {pack.codePrefix}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{pack.editionLabel}</span>
                      {isPackSeriesModified(pack.id) && (
                        <>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="text-amber-300">Diedit</span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-1 text-lg font-display font-bold text-white truncate">
                      {pack.name}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEditSeries(pack);
                    }}
                    aria-label={`Edit seri pek ${pack.name}`}
                    title={`Edit Seri ${pack.name}`}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700/80 flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Seri</span>
                  </button>
                </div>

                {/* Interactive 3D Fanned 3-Card Foil Pack Art Showcase */}
                <div className="mt-4">
                  <InteractiveCard3DTilt rank="SR">
                    <div className="group h-38 rounded-xl bg-[#0B1120] border border-slate-800/90 flex items-center justify-center relative overflow-hidden px-4 stage-3d-perspective">
                      {pack.customCoverImage ? (
                        <img
                          src={pack.customCoverImage}
                          alt={pack.name}
                          referrerPolicy="no-referrer"
                          className="h-30 w-auto rounded-lg object-cover border border-slate-700 shadow-lg"
                        />
                      ) : showcaseDefs.length > 0 ? (
                        <div className="flex items-center justify-center -space-x-5 preserve-3d">
                          {showcaseDefs.map((def, idx) => (
                            <img
                              key={def.id}
                              src={def.image}
                              alt={def.name}
                              referrerPolicy="no-referrer"
                              className={`w-20 aspect-[5/7] object-cover rounded-lg border shadow-lg ${
                                idx === 0
                                  ? 'border-slate-600 pack-fan-left-3d'
                                  : idx === 1
                                  ? 'z-10 border-amber-400/75 pack-fan-center-3d'
                                  : 'border-slate-600 pack-fan-right-3d'
                              }`}
                            />
                          ))}
                        </div>
                      ) : (
                        <img
                          src={BRAND_LOGOS.indonesia}
                          alt={pack.name}
                          referrerPolicy="no-referrer"
                          className="h-14 w-auto object-contain opacity-80"
                        />
                      )}
                    </div>
                  </InteractiveCard3DTilt>
                </div>

                <p className="mt-3.5 text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {pack.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/90 flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                <div className="text-slate-400">
                  <span className={ACCENT_TEXT_MAP[pack.accentTheme]}>
                    {packCards.length} Kartu
                  </span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>
                    Album {unlockedInPack}/{packCards.length}
                  </span>
                </div>
                <span className="font-semibold text-white whitespace-nowrap shrink-0">
                  {isSelected ? 'Seri Aktif' : 'Pilih Seri →'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Pack Spotlight & Interactive 3D Booster Opener */}
      <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-1.5">
            <div className="text-xs font-mono text-amber-400 tabular-nums">
              <span>Seri Terpilih: {activePack.codePrefix}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{activePack.cardsPerBooster} Kartu Unik per Booster</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>
                SR {raritySummary.SR} / AR {raritySummary.AR} / S {raritySummary.S} / A{' '}
                {raritySummary.A} / B-C {raritySummary.B + raritySummary.C}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white">
              Meja Buka Booster — {activePack.name}
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              {activePack.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenBooster(1)}
              className="px-5 py-3 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 shadow-lg"
            >
              <Layers className="w-4 h-4" />
              <span>Buka 1 Booster ({activePack.cardsPerBooster} Kartu)</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenBooster(3)}
              className="px-4 py-3 text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/35 rounded-xl transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              Buka 3 Pek ({activePack.cardsPerBooster * 3} Kartu)
            </button>

            <button
              type="button"
              onClick={() => {
                const deck30 = buildPlayableDeckFromPackSeries(activePack.id, 30);
                onUsePackInBattle(deck30, activePack.id);
              }}
              className="px-4 py-3 text-xs sm:text-sm font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Swords className="w-4 h-4" />
              <span>Duel Pakai Seri Ini</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const deck30 = buildPlayableDeckFromPackSeries(activePack.id, 30);
                onLoadPackIntoDeckBuilder(deck30, activePack.id, activePack.name);
              }}
              className="px-4 py-3 text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              Muat ke Atur Dek
            </button>

            <button
              type="button"
              onClick={() => onOpenEditSeries(activePack)}
              className="px-4 py-3 text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit Seri Ini</span>
            </button>
          </div>
        </div>

        {feedbackNotice && (
          <div className="text-xs font-medium text-amber-300">{feedbackNotice}</div>
        )}

        {/* Interactive Booster Pull Reveal Mat */}
        {pulledItems.length > 0 ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-mono text-slate-300 tabular-nums">
                <span>Hasil Tarikan Booster: {pulledItems.length} Kartu</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>
                  Terbuka {pulledItems.length - unrevealedCount}/{pulledItems.length}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {unrevealedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRevealAllPulls}
                    className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Buka Semua Kartu ({unrevealedCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPulledItems([])}
                  className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Bersihkan Meja
                </button>
              </div>
            </div>

            <div
              key={pullGeneration}
              className="p-5 sm:p-6 rounded-2xl bg-[#0B1120] border border-slate-800 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-5 justify-items-center"
            >
              {pulledItems.map((item, idx) => {
                const stagger = STAGGER_CLASSES[idx % STAGGER_CLASSES.length];
                const isHighHit =
                  item.card.rank === 'SR' ||
                  item.card.rank === 'AR' ||
                  item.card.rank === 'S';

                return (
                  <div
                    key={item.slotKey}
                    className={`animate-card-draw ${stagger} flex flex-col items-center`}
                  >
                    {!item.revealed ? (
                      <button
                        type="button"
                        onClick={() => handleRevealSinglePull(item.slotKey)}
                        className="card-hover-motion hover:-translate-y-2.5 hover:scale-[1.05] active:scale-[0.98] cursor-pointer focus:outline-none"
                        title="Klik untuk membalik dan membuka kartu ini"
                      >
                        <CardBack size="sm" label={`Klik Buka #${idx + 1}`} />
                      </button>
                    ) : (
                      <div className="card-perspective">
                        <div className="card-flip-reveal-up">
                          <div className="card-face-front">
                            <CardVisual
                              card={item.card}
                              size="sm"
                              enable3DTilt
                              conditionalReady={isHighHit}
                              showCaption
                              onClick={() => onInspectCard(item.card)}
                              onInspect={onInspectCard}
                              onEdit={onEditCard}
                            />
                          </div>
                          <div className="card-face-back" aria-hidden="true">
                            <CardBack size="sm" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-1.5 h-4 text-[11px] font-mono tabular-nums text-center">
                      {item.revealed ? (
                        item.isNewUnlock ? (
                          <span className="text-emerald-400 font-semibold">Baru di Album!</span>
                        ) : isHighHit ? (
                          <span className="text-amber-300 font-semibold">
                            Kartu Langka ({item.card.rank})
                          </span>
                        ) : (
                          <span className="text-slate-500">{item.card.numberLabel}</span>
                        )
                      ) : (
                        <span className="text-slate-500">Tertutup</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-10 px-4 rounded-2xl bg-[#0B1120] border border-slate-800/90 text-center space-y-3">
            <p className="text-sm text-slate-300">
              Belum ada Booster Pek yang dibuka di meja saat ini.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tekan tombol <strong className="text-slate-300">Buka 1 Booster</strong> di atas untuk menarik {activePack.cardsPerBooster} kartu unik dari <strong className="text-amber-300">{activePack.name}</strong> lengkap dengan efek balik kartu 3D.
            </p>
          </div>
        )}
      </div>

      {/* Complete Card List & Collection Album for Selected Pack Series */}
      <div className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-display font-bold text-white">
              Daftar Kartu Seri — {activePack.name}
            </h3>
            <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
              <span>Total {activePackAllCards.length} Kartu dalam Seri</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>
                Terkumpul di Album:{' '}
                {activePackAllCards.filter((c) => unlockedSet.has(c.id)).length}/
                {activePackAllCards.length}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#131C31] border border-slate-800 rounded-xl">
              {[
                { id: 'ALL' as const, label: `Semua (${activePackAllCards.length})` },
                { id: 'CHARACTER' as const, label: 'Karakter' },
                { id: 'SUPPORT' as const, label: 'Pendukung' },
                { id: 'SUIT' as const, label: 'Kartu Suit' },
                {
                  id: 'LOCKED' as const,
                  label: `Belum di Album (${
                    activePackAllCards.filter((c) => !unlockedSet.has(c.id)).length
                  })`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSeriesCardFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    seriesCardFilter === tab.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                unlockAllCollectionCards();
                setAlbumVersion((v) => v + 1);
                setFeedbackNotice('Seluruh kartu di Album Koleksi telah dibuka penuh.');
              }}
              className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Buka Semua Album</span>
            </button>

            <button
              type="button"
              onClick={() => {
                resetUnlockedCollection();
                setAlbumVersion((v) => v + 1);
                setFeedbackNotice('Progres Album Koleksi direset untuk simulasi gacha dari awal.');
              }}
              className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Album</span>
            </button>
          </div>
        </div>

        {filteredSeriesCards.length === 0 ? (
          <div className="py-14 px-4 bg-[#131C31] border border-slate-800 rounded-2xl text-center space-y-3">
            <p className="text-sm text-slate-300">
              {seriesCardFilter === 'LOCKED'
                ? 'Selamat! Seluruh kartu pada seri pek ini sudah terbuka di Album Koleksimu.'
                : 'Belum ada kartu dalam kategori ini pada seri pek terpilih.'}
            </p>
            <button
              type="button"
              onClick={() => onOpenCreateCardInPack(activePack.id)}
              className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah / Upload Kartu ke {activePack.name}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-7 justify-items-center">
            {filteredSeriesCards.map((card) => {
              const isUnlocked = unlockedSet.has(card.id);
              return (
                <div key={card.id} className="flex flex-col items-center">
                  <div className={isUnlocked ? '' : 'opacity-70'}>
                    <CardVisual
                      card={card}
                      size="md"
                      showCaption
                      onClick={() => onInspectCard(card)}
                      onInspect={onInspectCard}
                      onEdit={onEditCard}
                    />
                  </div>
                  <div className="mt-1 text-[11px] font-mono tabular-nums">
                    {isUnlocked ? (
                      <span className="text-emerald-400">Terkumpul</span>
                    ) : (
                      <span className="text-slate-500">Belum Ditarik</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
