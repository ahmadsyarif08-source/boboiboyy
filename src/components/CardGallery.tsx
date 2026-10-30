import React, { useMemo, useState } from 'react';
import { Box, Eye, Grid3X3, Layers, Pencil, Plus, Search, Sparkles, Upload } from 'lucide-react';
import {
  ALL_CARDS,
  ALL_PACK_SERIES,
  CARD_BY_ID,
  cardBelongsToPackSeries,
  cycleCardHologramFinish,
  getHologramFinishMeta,
  getPrimaryPackSeriesForCard,
  isCardHolographic,
  isCardModified,
  PACK_SERIES_BY_ID,
  resolveCardHologramFinish,
} from '../data/cards';
import { CardCategory, CardDefinition, type CardPackSeries } from '../types/game';
import { soundFx } from '../utils/sound';
import { Card3DShowcase } from './Card3DShowcase';
import { CardVisual } from './CardVisual';

type GalleryFilter =
  | 'ALL'
  | 'HOLOGRAM'
  | 'CHARACTER'
  | 'CONDITIONAL'
  | 'SUPPORT'
  | 'SUIT'
  | 'CUSTOM';

interface CardGalleryProps {
  cardsVersion: number;
  onInspectCard: (card: CardDefinition) => void;
  onEditCard: (card: CardDefinition) => void;
  onOpenCreateCard: () => void;
  onOpenCreateSuitCard?: () => void;
  onEditPackSeries: (pack: CardPackSeries) => void;
  onOpenCreateSeries: () => void;
  onOpenAlbum?: () => void;
  onCardsMutated?: () => void;
}

export const CardGallery: React.FC<CardGalleryProps> = ({
  cardsVersion,
  onInspectCard,
  onEditCard,
  onOpenCreateCard,
  onOpenCreateSuitCard,
  onEditPackSeries,
  onOpenCreateSeries,
  onOpenAlbum,
  onCardsMutated,
}) => {
  const [filter, setFilter] = useState<GalleryFilter>('ALL');
  const [packFilter, setPackFilter] = useState<string>('ALL');
  const [rankFilter, setRankFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [showStage3D, setShowStage3D] = useState<boolean>(true);
  const [showcaseCardId, setShowcaseCardId] = useState<string>('bf-32-sr-boboiboy-sopan');

  const customOrEditedCount = useMemo(() => {
    void cardsVersion;
    return ALL_CARDS.filter((c) => c.isCustom || isCardModified(c.id)).length;
  }, [cardsVersion]);

  const hologramCount = useMemo(() => {
    void cardsVersion;
    return ALL_CARDS.filter((c) => isCardHolographic(c)).length;
  }, [cardsVersion]);

  const filteredCards = useMemo(() => {
    void cardsVersion;
    return ALL_CARDS.filter((card) => {
      if (packFilter !== 'ALL' && !cardBelongsToPackSeries(card, packFilter)) return false;
      if (filter === 'HOLOGRAM' && !isCardHolographic(card)) return false;
      if (filter === 'CHARACTER' && card.category !== CardCategory.CHARACTER) return false;
      if (filter === 'CONDITIONAL' && !card.condition) return false;
      if (filter === 'SUPPORT' && card.category !== CardCategory.SUPPORT) return false;
      if (filter === 'SUIT' && card.category !== CardCategory.SUIT) return false;
      if (filter === 'CUSTOM' && !card.isCustom && !isCardModified(card.id)) return false;

      if (rankFilter !== 'ALL' && card.rank !== rankFilter) return false;

      if (query.trim()) {
        const q = query.toLowerCase();
        const inName = card.name.toLowerCase().includes(q);
        const inText = card.effectText.toLowerCase().includes(q);
        const inNum = card.numberLabel.toLowerCase().includes(q);
        return inName || inText || inNum;
      }
      return true;
    });
  }, [filter, packFilter, rankFilter, query, cardsVersion]);

  const activeShowcaseCard = useMemo(() => {
    void cardsVersion;
    return (
      CARD_BY_ID[showcaseCardId] ??
      filteredCards[0] ??
      ALL_CARDS[0]
    );
  }, [showcaseCardId, filteredCards, cardsVersion]);

  const activeShowcaseSeries = useMemo(
    () => getPrimaryPackSeriesForCard(activeShowcaseCard),
    [activeShowcaseCard]
  );

  const selectedFilterSeries = useMemo(() => {
    void cardsVersion;
    if (packFilter !== 'ALL' && PACK_SERIES_BY_ID[packFilter]) {
      return PACK_SERIES_BY_ID[packFilter];
    }
    return activeShowcaseSeries;
  }, [packFilter, activeShowcaseSeries, cardsVersion]);

  const filterButtons: { id: GalleryFilter; label: string }[] = [
    { id: 'ALL', label: `Semua (${ALL_CARDS.length})` },
    { id: 'HOLOGRAM', label: `Hologram (${hologramCount})` },
    { id: 'CHARACTER', label: 'Karakter' },
    { id: 'CONDITIONAL', label: 'Bersyarat' },
    { id: 'SUPPORT', label: 'Pendukung' },
    { id: 'SUIT', label: 'Kartu Suit' },
    { id: 'CUSTOM', label: `Kustom / Edit (${customOrEditedCount})` },
  ];

  const ranks = ['ALL', 'SR', 'AR', 'S', 'A', 'B', 'C'];

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="text-xs font-mono text-amber-400">
            Panggung Display 3D Hologram · Studio Kartu &amp; Edit Seri
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-display font-bold text-white">
            Koleksi &amp; Display Kartu 3D
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 max-w-2xl">
            Arahkan kursor ke kartu untuk melihat efek kemiringan 3D &amp; kilau hologram, tampilkan kartu di Panggung Display 3D interaktif, atau edit kartu dan seri pek kapan saja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenAlbum && (
            <button
              type="button"
              onClick={() => {
                soundFx.playCardSelect();
                onOpenAlbum();
              }}
              className="px-3.5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-400/50 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Grid3X3 className="w-4 h-4" />
              <span>Album Poster 3x3</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              soundFx.playCardSelect();
              setShowStage3D((prev) => !prev);
            }}
            className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
              showStage3D
                ? 'bg-sky-500/20 text-sky-300 border-sky-400/50'
                : 'bg-[#131C31] hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>{showStage3D ? 'Tutup Panggung 3D' : 'Buka Panggung 3D'}</span>
          </button>

          <button
            type="button"
            onClick={() => onEditPackSeries(selectedFilterSeries)}
            className="px-3.5 py-2.5 text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/35 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Pencil className="w-4 h-4" />
            <span>Edit Seri {selectedFilterSeries.codePrefix}</span>
          </button>

          {onOpenCreateSuitCard && (
            <button
              type="button"
              onClick={onOpenCreateSuitCard}
              className="px-3.5 py-2.5 text-xs sm:text-sm font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/50 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Kartu Suit</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCreateCard}
            className="px-4 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Upload / Tambah Kartu</span>
          </button>
        </div>
      </div>

      {/* Interactive 3D Card Showcase Stage */}
      {showStage3D && activeShowcaseCard && (
        <div className="mt-6 bg-[#131C31] border border-slate-800 rounded-2xl p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 flex justify-center">
            <Card3DShowcase card={activeShowcaseCard} compact />
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-amber-400 tabular-nums">
                  Panggung Display 3D Aktif · [{activeShowcaseSeries.codePrefix}]{' '}
                  {activeShowcaseSeries.name} · No. {activeShowcaseCard.numberLabel}
                </div>
                <h2 className="mt-1 text-xl sm:text-2xl font-display font-extrabold text-white">
                  {activeShowcaseCard.name}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playCardSelect();
                    cycleCardHologramFinish(activeShowcaseCard.id);
                    onCardsMutated?.();
                  }}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    isCardHolographic(activeShowcaseCard)
                      ? 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border-sky-400/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    Hologram:{' '}
                    {getHologramFinishMeta(resolveCardHologramFinish(activeShowcaseCard)).shortLabel}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onInspectCard(activeShowcaseCard)}
                  className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Layar Penuh</span>
                </button>

                <button
                  type="button"
                  onClick={() => onEditCard(activeShowcaseCard)}
                  className="px-3 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Kartu</span>
                </button>

                <button
                  type="button"
                  onClick={() => onEditPackSeries(activeShowcaseSeries)}
                  className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/35 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Edit Seri {activeShowcaseSeries.codePrefix}</span>
                </button>
              </div>
            </div>

            {activeShowcaseCard.category === CardCategory.CHARACTER && (
              <div className="flex flex-wrap items-center gap-5 py-2.5 border-y border-slate-800 font-mono text-sm tabular-nums">
                <div>
                  <span className="text-slate-400">Rank: </span>
                  <span className="font-bold text-amber-300">{activeShowcaseCard.rank}</span>
                </div>
                <div>
                  <span className="text-slate-400">HP: </span>
                  <span className="font-bold text-rose-300">{activeShowcaseCard.hp}</span>
                </div>
                <div>
                  <span className="text-slate-400">ATK: </span>
                  <span className="font-bold text-emerald-300">{activeShowcaseCard.atk}</span>
                </div>
                {activeShowcaseCard.effectPriority && (
                  <div>
                    <span className="text-slate-400">Prioritas: </span>
                    <span className="font-bold text-sky-300">
                      Efek 0{activeShowcaseCard.effectPriority}
                    </span>
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-slate-200 leading-relaxed">
              {activeShowcaseCard.effectText}
            </p>

            {/* Quick 3D Stage Card Switcher Strip */}
            <div className="pt-1 space-y-2">
              <div className="text-xs font-mono text-slate-400">
                Pilih cepat kartu untuk dipajang di Panggung 3D (atau klik kartu di galeri bawah):
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {filteredCards.slice(0, 10).map((c) => {
                  const selected = c.id === activeShowcaseCard.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        soundFx.playCardSelect();
                        setShowcaseCardId(c.id);
                      }}
                      className={`p-1.5 rounded-xl border flex items-center gap-2 transition-colors shrink-0 ${
                        selected
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-[#0B1120] border-slate-800 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      <img
                        src={c.image}
                        alt={c.name}
                        referrerPolicy="no-referrer"
                        className="w-7 h-10 rounded object-cover"
                      />
                      <div className="text-left pr-1">
                        <div className="text-xs font-semibold max-w-[110px] truncate">
                          {c.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                          {c.rank} · {c.numberLabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Filter Toolbar */}
      <div className="mt-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#131C31] border border-slate-800 rounded-xl">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilter(btn.id)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                filter === btn.id
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <select
              value={packFilter}
              onChange={(e) => setPackFilter(e.target.value)}
              aria-label="Filter berdasarkan Seri Pek Kartu"
              className="px-3 py-2 text-xs font-medium bg-[#131C31] border border-slate-800 rounded-xl text-amber-300 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">Semua Seri Pek</option>
              {ALL_PACK_SERIES.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name} ({pack.codePrefix})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onOpenCreateSeries}
              title="Buat Seri Pek Baru"
              className="px-2.5 py-2 text-xs font-semibold bg-[#131C31] hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Seri</span>
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#131C31] border border-slate-800 rounded-xl overflow-x-auto">
            {ranks.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRankFilter(r)}
                className={`px-2.5 py-1.5 text-xs font-mono rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  rankFilter === r
                    ? 'bg-slate-700 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r === 'ALL' ? 'Semua Rank' : r}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau efek..."
              className="w-full sm:w-48 pl-9 pr-3 py-2 text-sm bg-[#131C31] border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Card Grid */}
      {filteredCards.length === 0 ? (
        <div className="mt-12 py-16 text-center bg-[#131C31] border border-slate-800 rounded-2xl space-y-4">
          <p className="text-base font-medium text-slate-300">
            {filter === 'CUSTOM'
              ? 'Belum ada kartu yang diupload atau diedit.'
              : 'Tidak ada kartu yang cocok dengan pencarian.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {filter === 'CUSTOM' ? (
              <button
                type="button"
                onClick={onOpenCreateCard}
                className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload / Buat Kartu Pertama</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFilter('ALL');
                  setPackFilter('ALL');
                  setRankFilter('ALL');
                  setQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Atur Ulang Filter
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-7 justify-items-center">
          {filteredCards.map((card) => (
            <CardVisual
              key={card.id}
              card={card}
              size="md"
              enable3DTilt
              selected={showStage3D && card.id === activeShowcaseCard?.id}
              showCaption
              onClick={() => {
                if (showStage3D) {
                  soundFx.playCardSelect();
                  setShowcaseCardId(card.id);
                } else {
                  onInspectCard(card);
                }
              }}
              onInspect={onInspectCard}
              onEdit={onEditCard}
            />
          ))}
        </div>
      )}
    </section>
  );
};
