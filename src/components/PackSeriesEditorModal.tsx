import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ALL_CARDS,
  ALL_PACK_SERIES,
  BATTLE_CARDS,
  BRAND_LOGOS,
  CARD_BY_ID,
  deleteCustomPackSeries,
  getCardsForPackSeries,
  isBuiltInPackSeries,
  isCardModified,
  isPackSeriesModified,
  resetPackSeriesToDefault,
  upsertPackSeries,
} from '../data/cards';
import {
  CardCategory,
  type CardDefinition,
  type CardPackSeries,
  type PackAccentTheme,
} from '../types/game';
import { soundFx } from '../utils/sound';
import { InteractiveCard3DTilt } from './Card3DShowcase';

export interface PackSeriesEditorModalProps {
  isOpen: boolean;
  initialPack: CardPackSeries | null;
  onClose: () => void;
  onSaved: (pack: CardPackSeries) => void;
  onDeleted: (packId: string) => void;
  onResetToDefault: (packId: string) => void;
}

const ACCENT_PREVIEW_BORDER: Record<PackAccentTheme, string> = {
  amber: 'border-amber-400/70',
  sky: 'border-sky-400/70',
  emerald: 'border-emerald-400/70',
  rose: 'border-rose-400/70',
};

const ACCENT_PREVIEW_TEXT: Record<PackAccentTheme, string> = {
  amber: 'text-amber-300',
  sky: 'text-sky-300',
  emerald: 'text-emerald-300',
  rose: 'text-rose-300',
};

function compressCoverUpload(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar sampul.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung.'));
      img.onload = () => {
        const maxWidth = 420;
        const maxHeight = 588;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#0B1120';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const PackSeriesEditorModal: React.FC<PackSeriesEditorModalProps> = ({
  isOpen,
  initialPack,
  onClose,
  onSaved,
  onDeleted,
  onResetToDefault,
}) => {
  const coverFileRef = useRef<HTMLInputElement | null>(null);

  const [packName, setPackName] = useState<string>('');
  const [packPrefix, setPackPrefix] = useState<string>('PKB');
  const [packEdition, setPackEdition] = useState<string>('Seri Kustom · Edisi Spesial');
  const [packDesc, setPackDesc] = useState<string>('');
  const [packAccent, setPackAccent] = useState<PackAccentTheme>('amber');
  const [packBoosterSize, setPackBoosterSize] = useState<number>(6);
  const [packCoverCardId, setPackCoverCardId] = useState<string>('bf-31-boboiboy-nova');
  const [packCustomCover, setPackCustomCover] = useState<string>('');
  const [showcaseIds, setShowcaseIds] = useState<string[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  const [cardFilter, setCardFilter] = useState<
    'ALL' | 'SELECTED' | 'CHARACTER' | 'SUPPORT' | 'SUIT' | 'CUSTOM'
  >('ALL');
  const [cardQuery, setCardQuery] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEditorError(null);
    setConfirmDelete(false);
    setCardFilter('ALL');
    setCardQuery('');

    if (initialPack) {
      setPackName(initialPack.name);
      setPackPrefix(initialPack.codePrefix);
      setPackEdition(initialPack.editionLabel);
      setPackDesc(initialPack.description);
      setPackAccent(initialPack.accentTheme);
      setPackBoosterSize(initialPack.cardsPerBooster || 6);
      setPackCoverCardId(
        initialPack.coverCardId || BATTLE_CARDS[0]?.id || 'bf-31-boboiboy-nova'
      );
      setPackCustomCover(initialPack.customCoverImage ?? '');
      setShowcaseIds(
        initialPack.showcaseCardIds?.length
          ? initialPack.showcaseCardIds.slice(0, 3)
          : [initialPack.coverCardId].filter(Boolean)
      );

      const currentCards =
        initialPack.cardIds && initialPack.cardIds.length > 0
          ? initialPack.cardIds
          : getCardsForPackSeries(initialPack.id, true).map((c) => c.id);
      setSelectedCardIds(Array.from(new Set(currentCards)));
    } else {
      const nextIdx = ALL_PACK_SERIES.filter((p) => !p.isBuiltIn).length + 1;
      const starterCards = BATTLE_CARDS.filter((c) => c.isCustom)
        .slice(0, 12)
        .map((c) => c.id);
      const fallbackCards =
        starterCards.length > 0
          ? starterCards
          : BATTLE_CARDS.slice(0, 12).map((c) => c.id);

      setPackName('');
      setPackPrefix(`PK${nextIdx}`);
      setPackEdition(`Seri Ekspansi Kustom 0${nextIdx}`);
      setPackDesc('');
      setPackAccent('amber');
      setPackBoosterSize(6);
      setPackCoverCardId(fallbackCards[0] ?? BATTLE_CARDS[0]?.id ?? 'bf-31-boboiboy-nova');
      setPackCustomCover('');
      setShowcaseIds(fallbackCards.slice(0, 3));
      setSelectedCardIds(fallbackCards);
    }
  }, [isOpen, initialPack]);

  const selectedSet = useMemo(() => new Set(selectedCardIds), [selectedCardIds]);

  const filteredPool = useMemo(() => {
    const q = cardQuery.trim().toLowerCase();
    return ALL_CARDS.filter((card) => {
      if (cardFilter === 'SELECTED' && !selectedSet.has(card.id)) return false;
      if (cardFilter === 'CHARACTER' && card.category !== CardCategory.CHARACTER) return false;
      if (cardFilter === 'SUPPORT' && card.category !== CardCategory.SUPPORT) return false;
      if (cardFilter === 'SUIT' && card.category !== CardCategory.SUIT) return false;
      if (cardFilter === 'CUSTOM' && !card.isCustom && !isCardModified(card.id)) return false;

      if (q) {
        return (
          card.name.toLowerCase().includes(q) ||
          card.numberLabel.toLowerCase().includes(q) ||
          card.rank.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cardFilter, cardQuery, selectedSet]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialPack);
  const builtIn = initialPack ? isBuiltInPackSeries(initialPack.id) : false;
  const modifiedBuiltIn = initialPack ? isPackSeriesModified(initialPack.id) : false;

  const resolvedShowcaseDefs = (
    showcaseIds.length > 0
      ? showcaseIds
      : [packCoverCardId, ...selectedCardIds.slice(0, 3)]
  )
    .map((id) => CARD_BY_ID[id])
    .filter((d): d is CardDefinition => Boolean(d))
    .slice(0, 3);

  const toggleCardMembership = (cardId: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const updateShowcaseSlot = (slotIdx: number, cardId: string) => {
    setShowcaseIds((prev) => {
      const base = [
        prev[0] ?? packCoverCardId,
        prev[1] ?? BATTLE_CARDS[1]?.id ?? packCoverCardId,
        prev[2] ?? BATTLE_CARDS[2]?.id ?? packCoverCardId,
      ];
      base[slotIdx] = cardId;
      return base;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!packName.trim()) {
      setEditorError('Nama Seri Pek wajib diisi.');
      return;
    }

    const cleanPrefix = (
      packPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PKB'
    ).slice(0, 6);

    const id =
      initialPack?.id ??
      `pek-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const cleanShowcase = Array.from(
      new Set(
        showcaseIds.filter((cid) => Boolean(CARD_BY_ID[cid])).length > 0
          ? showcaseIds.filter((cid) => Boolean(CARD_BY_ID[cid]))
          : [packCoverCardId, ...selectedCardIds.slice(0, 3)]
      )
    ).slice(0, 3);

    const payload: CardPackSeries = {
      id,
      codePrefix: cleanPrefix,
      name: packName.trim(),
      editionLabel: packEdition.trim() || 'Seri Pek Kartu',
      description:
        packDesc.trim() ||
        `Seri pek kartu bertanda ${cleanPrefix} dengan koleksi kartu pilihan siap bertarung.`,
      coverCardId: packCoverCardId,
      showcaseCardIds: cleanShowcase,
      customCoverImage: packCustomCover.trim() || undefined,
      accentTheme: packAccent,
      cardsPerBooster: packBoosterSize,
      cardIds: selectedCardIds,
      isBuiltIn: builtIn,
    };

    const res = upsertPackSeries(payload);
    if (!res.ok) {
      setEditorError(res.error ?? 'Gagal menyimpan perubahan Seri Pek.');
      return;
    }

    soundFx.playCardDeploy();
    onSaved(payload);
  };

  const handleResetBuiltIn = () => {
    if (!initialPack || !builtIn) return;
    resetPackSeriesToDefault(initialPack.id);
    soundFx.playCardSelect();
    onResetToDefault(initialPack.id);
  };

  const handleDeleteCustom = () => {
    if (!initialPack || builtIn) return;
    deleteCustomPackSeries(initialPack.id);
    soundFx.playCardSelect();
    onDeleted(initialPack.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/88 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#131C31] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800">
          <div>
            <div className="text-xs font-mono text-amber-400">
              {isEditing
                ? builtIn
                  ? 'Studio Seri Pek · Edit Seri Resmi (Dapat Direset ke Bawaan)'
                  : 'Studio Seri Pek · Edit Seri Kustom'
                : 'Studio Seri Pek · Buat Seri Pek Kartu Baru'}
            </div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-white">
              {isEditing ? `Edit Seri: ${initialPack?.name}` : 'Rancang Seri Pek Kartu Baru'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup studio seri pek"
            className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Live 3D Series Showcase Preview & Cover Controls */}
            <div className="lg:col-span-4 space-y-4">
              <div
                className={`bg-[#0B1120] border ${ACCENT_PREVIEW_BORDER[packAccent]} rounded-2xl p-4 space-y-3.5`}
              >
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
                  <span>Pratinjau 3D Seri</span>
                  <span className={ACCENT_PREVIEW_TEXT[packAccent]}>
                    [{packPrefix || 'PKB'}] · {packBoosterSize} Kartu/Pek
                  </span>
                </div>

                {/* Interactive 3D Fanned Pack Preview */}
                <InteractiveCard3DTilt rank="SR">
                  <div className="group h-44 rounded-xl bg-[#131C31] border border-slate-800 flex items-center justify-center relative overflow-hidden px-4 stage-3d-perspective">
                    {packCustomCover ? (
                      <img
                        src={packCustomCover}
                        alt={packName || 'Sampul Seri'}
                        referrerPolicy="no-referrer"
                        className="h-36 w-auto rounded-lg object-cover border border-slate-600 shadow-xl"
                      />
                    ) : resolvedShowcaseDefs.length > 0 ? (
                      <div className="flex items-center justify-center -space-x-5 preserve-3d">
                        {resolvedShowcaseDefs.map((def, idx) => (
                          <img
                            key={`${def.id}-${idx}`}
                            src={def.image}
                            alt={def.name}
                            referrerPolicy="no-referrer"
                            className={`w-22 aspect-[5/7] object-cover rounded-lg border shadow-xl ${
                              idx === 0
                                ? 'border-slate-600 pack-fan-left-3d'
                                : idx === 1
                                ? 'z-10 border-amber-400/80 pack-fan-center-3d'
                                : 'border-slate-600 pack-fan-right-3d'
                            }`}
                          />
                        ))}
                      </div>
                    ) : (
                      <img
                        src={BRAND_LOGOS.indonesia}
                        alt="Monsta Galaxy Card"
                        referrerPolicy="no-referrer"
                        className="h-14 w-auto object-contain opacity-80"
                      />
                    )}
                  </div>
                </InteractiveCard3DTilt>

                <div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {packEdition || 'Label Edisi Seri'}
                  </div>
                  <div className="text-base font-display font-bold text-white truncate">
                    {packName || 'Nama Seri Pek Kartu'}
                  </div>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {packDesc || 'Deskripsi singkat seri pek kartu akan tampil di sini.'}
                  </p>
                </div>
              </div>

              {/* Cover Upload & 3 Showcase Slots */}
              <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-200">
                  Sampul Pek &amp; 3 Kartu Pameran
                </div>

                <input
                  ref={coverFileRef}
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await compressCoverUpload(file);
                      setPackCustomCover(dataUrl);
                    } catch (err) {
                      setEditorError(
                        err instanceof Error ? err.message : 'Gagal memproses gambar sampul.'
                      );
                    } finally {
                      if (coverFileRef.current) coverFileRef.current.value = '';
                    }
                  }}
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => coverFileRef.current?.click()}
                    className="flex-1 py-2 px-3 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{packCustomCover ? 'Ganti Gambar Sampul' : 'Upload Sampul Kustom'}</span>
                  </button>
                  {packCustomCover && (
                    <button
                      type="button"
                      onClick={() => setPackCustomCover('')}
                      className="py-2 px-2.5 text-xs font-semibold bg-slate-800 hover:bg-rose-500/20 text-rose-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  {[0, 1, 2].map((slotIdx) => (
                    <div key={slotIdx}>
                      <label className="block text-[11px] font-mono text-slate-400 mb-0.5">
                        Kartu Pameran #{slotIdx + 1}{' '}
                        {slotIdx === 1 ? '(Tengah Utama)' : slotIdx === 0 ? '(Kiri)' : '(Kanan)'}
                      </label>
                      <select
                        value={showcaseIds[slotIdx] ?? packCoverCardId}
                        onChange={(e) => {
                          updateShowcaseSlot(slotIdx, e.target.value);
                          if (slotIdx === 1) setPackCoverCardId(e.target.value);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-[#131C31] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        {BATTLE_CARDS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.numberLabel} — {c.name} ({c.rank})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Series Metadata, Synergy Effect, and Card Membership */}
            <div className="lg:col-span-8 space-y-5">
              {editorError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
                  {editorError}
                </div>
              )}

              {/* Identity & Theme */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nama Seri Pek Kartu *
                  </label>
                  <input
                    type="text"
                    required
                    value={packName}
                    onChange={(e) => setPackName(e.target.value)}
                    placeholder="Contoh: Pek Blazing Frost Supra"
                    className="w-full px-3.5 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Kode Prefix
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={packPrefix}
                    onChange={(e) => setPackPrefix(e.target.value.toUpperCase())}
                    placeholder="BF"
                    className="w-full px-3.5 py-2 text-sm font-mono bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Isi per Booster
                  </label>
                  <select
                    value={packBoosterSize}
                    onChange={(e) => setPackBoosterSize(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value={4}>4 Kartu / Pek</option>
                    <option value={5}>5 Kartu / Pek</option>
                    <option value={6}>6 Kartu / Pek</option>
                    <option value={8}>8 Kartu / Pek</option>
                    <option value={10}>10 Kartu / Pek</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-7">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Label Edisi / Subjudul Seri
                  </label>
                  <input
                    type="text"
                    value={packEdition}
                    onChange={(e) => setPackEdition(e.target.value)}
                    placeholder="Seri Utama · Edisi Spesial"
                    className="w-full px-3.5 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Warna Aksen Seri
                  </label>
                  <select
                    value={packAccent}
                    onChange={(e) => setPackAccent(e.target.value as PackAccentTheme)}
                    className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="amber">Emas Solar (Amber)</option>
                    <option value="sky">Biru Blizzard (Sky)</option>
                    <option value="emerald">Hijau Windara (Emerald)</option>
                    <option value="rose">Merah Nova (Rose)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Deskripsi Seri Pek
                </label>
                <textarea
                  rows={2}
                  value={packDesc}
                  onChange={(e) => setPackDesc(e.target.value)}
                  placeholder="Jelaskan tema karakter, kombo andalan, atau ciri khas seri pek ini..."
                  className="w-full px-3.5 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Card Membership Multi-Select */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-200 tabular-nums">
                    Daftar Kartu Anggota Seri ({selectedCardIds.length} Kartu Terpilih)
                  </label>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedCardIds(BATTLE_CARDS.map((c) => c.id))}
                      className="text-amber-300 hover:underline whitespace-nowrap shrink-0"
                    >
                      Pilih Semua Pertarungan
                    </button>
                    <span className="text-slate-600">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCardIds(ALL_CARDS.map((c) => c.id))}
                      className="text-sky-300 hover:underline whitespace-nowrap shrink-0"
                    >
                      Semua + Suit
                    </button>
                    <span className="text-slate-600">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCardIds([])}
                      className="text-slate-400 hover:text-white whitespace-nowrap shrink-0"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                    {[
                      { id: 'ALL' as const, label: 'Semua' },
                      { id: 'SELECTED' as const, label: `Terpilih (${selectedCardIds.length})` },
                      { id: 'CHARACTER' as const, label: 'Karakter' },
                      { id: 'SUPPORT' as const, label: 'Pendukung' },
                      { id: 'SUIT' as const, label: 'Suit' },
                      { id: 'CUSTOM' as const, label: 'Kustom/Edit' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCardFilter(tab.id)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                          cardFilter === tab.id
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={cardQuery}
                      onChange={(e) => setCardQuery(e.target.value)}
                      placeholder="Cari kartu..."
                      className="w-full sm:w-44 pl-8 pr-3 py-1.5 text-xs bg-[#0B1120] border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto p-2.5 rounded-xl bg-[#0B1120] border border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {filteredPool.map((card) => {
                    const checked = selectedSet.has(card.id);
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => toggleCardMembership(card.id)}
                        className={`p-2 rounded-lg border text-left flex items-center gap-2.5 transition-colors ${
                          checked
                            ? 'bg-amber-500/15 border-amber-400/70 text-white'
                            : 'bg-[#131C31] border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <img
                          src={card.image}
                          alt={card.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-11 rounded object-cover border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold truncate">{card.name}</div>
                          <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                            {card.numberLabel} · {card.rank}
                          </div>
                        </div>
                        {checked && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {isEditing && builtIn && modifiedBuiltIn && (
                <button
                  type="button"
                  onClick={handleResetBuiltIn}
                  className="px-3.5 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/35 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Kembalikan Seri ke Bawaan</span>
                </button>
              )}

              {isEditing && !builtIn && !confirmDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3.5 py-2.5 text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Seri Kustom</span>
                </button>
              )}

              {isEditing && !builtIn && confirmDelete && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteCustom}
                    className="px-3.5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    Ya, Hapus Seri Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    Urungkan
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Check className="w-4 h-4" />
                <span>{isEditing ? 'Simpan Perubahan Seri' : 'Buat Seri Pek'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
