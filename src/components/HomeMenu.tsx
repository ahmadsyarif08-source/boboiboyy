import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Gavel,
  Grid3X3,
  History,
  Layers,
  Music,
  Package,
  Play,
  Plus,
  Settings2,
  ShoppingBag,
  Sparkles,
  Swords,
  Users,
  Wand2,
} from 'lucide-react';
import {
  ALL_CARDS,
  ALL_PACK_SERIES,
  BRAND_LOGOS,
  CARD_BY_ID,
  deduplicateDeckIds,
  isCardHolographic,
  PRESET_DECKS,
} from '../data/cards';
import type { CardDefinition, SavedUserDeck } from '../types/game';
import { soundFx } from '../utils/sound';
import { AudioControlWidget } from './AudioControlPanel';
import { CardVisual } from './CardVisual';

export type MainMenuDestination =
  | 'arena'
  | 'history'
  | 'trial'
  | 'physical'
  | 'multiplayer'
  | 'shop'
  | 'custom'
  | 'album'
  | 'gallery'
  | 'deck'
  | 'packs'
  | 'rules';

export interface HomeMenuProps {
  cardsVersion: number;
  savedDecks: SavedUserDeck[];
  activeDeckId: string;
  onNavigate: (destination: MainMenuDestination) => void;
  onQuickStartDuel: () => void;
  onInspectCard: (card: CardDefinition) => void;
  onEditCard: (card: CardDefinition) => void;
  onOpenCreateCard: () => void;
}

export const HomeMenu: React.FC<HomeMenuProps> = ({
  cardsVersion,
  savedDecks,
  activeDeckId,
  onNavigate,
  onQuickStartDuel,
  onInspectCard,
  onEditCard,
  onOpenCreateCard,
}) => {
  const [logoError, setLogoError] = useState(false);
  const [showcaseIndex, setShowcaseIndex] = useState(0);

  const collectionSummary = useMemo(() => {
    void cardsVersion;
    const totalCards = ALL_CARDS.length;
    const holoCards = ALL_CARDS.filter((c) => isCardHolographic(c)).length;
    const totalSeries = ALL_PACK_SERIES.length;
    return { totalCards, holoCards, totalSeries };
  }, [cardsVersion]);

  const activeDeck = useMemo(() => {
    return savedDecks.find((d) => d.id === activeDeckId) ?? savedDecks[0] ?? null;
  }, [savedDecks, activeDeckId]);

  const showcaseCards = useMemo<CardDefinition[]>(() => {
    void cardsVersion;
    const sourceIds = activeDeck
      ? deduplicateDeckIds(activeDeck.cardIds, activeDeck.targetSize)
      : PRESET_DECKS[0].cardIds;
    const resolved = sourceIds
      .map((id) => CARD_BY_ID[id])
      .filter((c): c is CardDefinition => Boolean(c));

    const prioritized = [...resolved].sort((a, b) => {
      const holoDiff = Number(isCardHolographic(b)) - Number(isCardHolographic(a));
      if (holoDiff !== 0) return holoDiff;
      return b.hp + b.atk - (a.hp + a.atk);
    });

    return prioritized.slice(0, 3);
  }, [activeDeck, cardsVersion]);

  const safeShowcaseIdx =
    showcaseCards.length > 0 ? Math.min(showcaseIndex, showcaseCards.length - 1) : 0;
  const currentShowcaseCard =
    showcaseCards[safeShowcaseIdx] ?? CARD_BY_ID['bf-31-boboiboy-nova'] ?? ALL_CARDS[0];

  const activeDeckCardCount = activeDeck
    ? deduplicateDeckIds(activeDeck.cardIds, activeDeck.targetSize).length
    : 30;

  const battleMenuCards: {
    id: MainMenuDestination;
    title: string;
    description: string;
    meta: string;
    icon: React.ReactNode;
    accentText: string;
  }[] = [
    {
      id: 'arena',
      title: 'Arena Duel 1 vs 1',
      description: 'Tanding melawan Bot CPU taktis atau 2 pemain lokal dalam satu perangkat.',
      meta: 'VS CPU · 2 Pemain',
      icon: <Swords className="w-5 h-5" />,
      accentText: 'text-amber-400',
    },
    {
      id: 'physical',
      title: 'Host Kartu Asli',
      description: 'Meja wasit digital untuk menghitung HP, ATK, efek kombo, dan layar penonton.',
      meta: 'Simulasi Fisik · Siaran',
      icon: <Gavel className="w-5 h-5" />,
      accentText: 'text-emerald-400',
    },
    {
      id: 'multiplayer',
      title: 'Multiplayer Online',
      description: 'Buat room atau gabung kode pertandingan 1 vs 1 antar perangkat waktu nyata.',
      meta: 'Kode Room · 2+ Perangkat',
      icon: <Users className="w-5 h-5" />,
      accentText: 'text-sky-400',
    },
    {
      id: 'custom',
      title: 'Simulasi Custom',
      description: 'Uji coba bebas susunan kartu pilihan atau tonton pertarungan otomatis.',
      meta: 'Eksperimen · Bot vs Bot',
      icon: <Settings2 className="w-5 h-5" />,
      accentText: 'text-purple-300',
    },
    {
      id: 'history',
      title: 'Riwayat Duel',
      description: 'Tinjau rekaman pertandingan, statistik suit elemen, momen titik balik, dan evaluasi taktis.',
      meta: 'Arsip Duel · Analisis',
      icon: <History className="w-5 h-5" />,
      accentText: 'text-amber-300',
    },
    {
      id: 'trial',
      title: 'Uji Coba Kartu & Efek',
      description: 'Laboratorium interaktif untuk menguji eksekusi efek kartu, adu suit, serangan, dan syarat evolusi.',
      meta: 'Sandbox · 44+ Efek',
      icon: <Wand2 className="w-5 h-5" />,
      accentText: 'text-sky-300',
    },
  ];

  const collectionMenuCards: {
    id: MainMenuDestination;
    title: string;
    description: string;
    meta: string;
    icon: React.ReactNode;
    accentText: string;
  }[] = [
    {
      id: 'shop',
      title: 'Toko Kartu Galaksi',
      description: 'Beli Pek Booster 6 kartu, kartu lepasan foil SR & AR, serta klaim hadiah harian & kode promo.',
      meta: 'Pek Booster · Belanja Koin',
      icon: <ShoppingBag className="w-5 h-5" />,
      accentText: 'text-amber-400',
    },
    {
      id: 'album',
      title: 'Album Poster 3×3',
      description: 'Susun poster pameran 3×3, tumpuk kartu per kantong binder, dan ekspor PNG.',
      meta: 'Fitur Timpa · Ekspor PNG',
      icon: <Grid3X3 className="w-5 h-5" />,
      accentText: 'text-sky-400',
    },
    {
      id: 'gallery',
      title: 'Koleksi & Panggung 3D',
      description: 'Inspeksi seluruh kartu dengan sudut putar 3D interaktif dan efek foil hologram.',
      meta: `${collectionSummary.totalCards} Kartu · ${collectionSummary.holoCards} Hologram`,
      icon: <Sparkles className="w-5 h-5" />,
      accentText: 'text-indigo-400',
    },
    {
      id: 'deck',
      title: 'Susun Dek Unik',
      description: 'Rakit dan simpan beberapa slot dek 10–30 kartu dengan aturan unik sekali pakai.',
      meta: `${savedDecks.length} Slot Dek Tersimpan`,
      icon: <Layers className="w-5 h-5" />,
      accentText: 'text-emerald-400',
    },
    {
      id: 'packs',
      title: 'Seri Pek Kartu',
      description: 'Jelajahi seri Blazing Frost maupun seri kreasi kustom beserta daftar kartunya.',
      meta: `${collectionSummary.totalSeries} Seri Pek Aktif`,
      icon: <Package className="w-5 h-5" />,
      accentText: 'text-rose-300',
    },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
      {/* Hero Launchpad */}
      <section className="bg-[#131C31] border border-slate-800 rounded-2xl p-6 sm:p-8 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left 7 Cols: Brand Identity, Active Deck Status & Primary Launch CTA */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {!logoError && (
                  <img
                    src={BRAND_LOGOS.indonesia}
                    alt="Monsta Galaxy Card"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                    className="h-12 sm:h-14 w-auto object-contain shrink-0"
                  />
                )}
                <div className="text-xs font-mono text-slate-400 tabular-nums">
                  <span className="text-amber-400 font-semibold">Monsta Galaxy Card</span>
                  <span className="mx-2 text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <span>{collectionSummary.totalCards} Kartu</span>
                  <span className="mx-2 text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <span>{collectionSummary.holoCards} Hologram</span>
                </div>
              </div>

              <AudioControlWidget compact />
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl sm:text-4xl font-display font-extrabold text-white tracking-tight text-balance leading-tight">
                Arena Pertarungan 1 vs 1 &amp; Studio Koleksi Kartu
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                Mainkan duel taktis dengan aturan dek unik sekali pakai, gunakan mode wasit untuk simulasi kartu fisik, atau pamerkan kartu hologram terbaikmu di dalam Album Poster 3×3.
              </p>
            </div>

            {/* Clean Hairline Active Deck Summary */}
            <div className="pt-4 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="text-slate-300 tabular-nums">
                <span className="text-slate-400">Dek Siap Tanding: </span>
                <strong className="text-white font-semibold">
                  {activeDeck ? activeDeck.name : 'Dek Bawaan Blazing Frost'}
                </strong>
                <span className="mx-2 text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-amber-300">{activeDeckCardCount} Kartu Unik</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFx.playCardSelect();
                  onNavigate('deck');
                }}
                className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Ganti / Edit Dek
              </button>
            </div>

            {/* Single Focal Anchor CTA + Clean Secondary Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onQuickStartDuel}
                className="px-6 py-3.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 shadow-lg"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Mulai Duel Cepat</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playCardSelect();
                  onNavigate('arena');
                }}
                className="px-5 py-3.5 text-sm font-semibold bg-[#0B1120] hover:bg-slate-800 text-slate-100 border border-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Pengaturan Pertandingan
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playCardSelect();
                  onOpenCreateCard();
                }}
                className="px-4 py-3.5 text-sm font-semibold bg-[#0B1120] hover:bg-slate-800 text-amber-300 border border-slate-800 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Kartu Baru</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playCardSelect();
                  soundFx.openBgmStudio();
                }}
                className="px-4 py-3.5 text-sm font-semibold bg-[#0B1120] hover:bg-slate-800 text-sky-300 border border-slate-800 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Music className="w-4 h-4" />
                <span>Edit Studio BGM</span>
              </button>
            </div>
          </div>

          {/* Right 5 Cols: Featured Signature Card Spotlight */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center lg:border-l lg:border-slate-800/90 lg:pl-8">
            {currentShowcaseCard && (
              <div className="flex flex-col items-center text-center">
                <div className="text-xs font-mono text-amber-400 mb-3">
                  Kartu Unggulan Dek Aktif
                </div>

                <CardVisual
                  card={currentShowcaseCard}
                  size="md"
                  enable3DTilt
                  conditionalReady
                  onClick={() => onInspectCard(currentShowcaseCard)}
                  onInspect={onInspectCard}
                  onEdit={onEditCard}
                />

                <div className="mt-3 text-base font-display font-bold text-white">
                  {currentShowcaseCard.name}
                </div>
                <div className="mt-0.5 text-xs font-mono text-slate-400 tabular-nums">
                  {currentShowcaseCard.numberLabel}
                  <span className="mx-1.5 text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  Rank {currentShowcaseCard.rank}
                  <span className="mx-1.5 text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  HP {currentShowcaseCard.hp} / ATK {currentShowcaseCard.atk}
                </div>

                {showcaseCards.length > 1 && (
                  <div className="mt-4 flex items-center gap-1.5 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                    {showcaseCards.map((c, idx) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          soundFx.playCardSelect();
                          setShowcaseIndex(idx);
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 max-w-[120px] truncate ${
                          safeShowcaseIdx === idx
                            ? 'bg-slate-700 text-white font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Menu Group 1: Mode Pertarungan */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-white">
              01. Mode Pertarungan
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Pilih cara bertanding sesuai kebutuhan: melawan CPU, lokal, kartu fisik asli, atau online.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFx.playCardSelect();
              onNavigate('rules');
            }}
            className="text-xs font-semibold text-slate-300 hover:text-amber-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Baca Panduan Resmi Pertarungan</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {battleMenuCards.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundFx.playCardSelect();
                onNavigate(item.id);
              }}
              className="group bg-[#131C31] hover:bg-[#17223B] border border-slate-800 hover:border-slate-600 rounded-2xl p-5 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl bg-[#0B1120] border border-slate-800 flex items-center justify-center ${item.accentText}`}
                  >
                    {item.icon}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {item.meta}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-display font-bold text-white group-hover:text-amber-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                Buka Mode →
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Menu Group 2: Koleksi, Album 3x3 & Studio Dek */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg sm:text-xl font-display font-bold text-white">
            02. Koleksi, Album 3×3 &amp; Studio Dek
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Kelola lembar binder 3×3, atur efek foil hologram pada kartu pilihan, dan susun dek terbaikmu.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {collectionMenuCards.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundFx.playCardSelect();
                onNavigate(item.id);
              }}
              className="group bg-[#131C31] hover:bg-[#17223B] border border-slate-800 hover:border-slate-600 rounded-2xl p-5 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl bg-[#0B1120] border border-slate-800 flex items-center justify-center ${item.accentText}`}
                  >
                    {item.icon}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {item.meta}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-display font-bold text-white group-hover:text-amber-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                Buka Studio →
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
