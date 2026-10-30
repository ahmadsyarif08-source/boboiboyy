import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Gift,
  HelpCircle,
  History,
  Layers,
  Package,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Ticket,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { ALL_CARDS, CARD_BY_ID, isCardHolographic } from '../data/cards';
import type { CardDefinition } from '../types/game';
import type { ShopProduct, UserWallet } from '../types/owner';
import {
  claimDailyReward,
  DEFAULT_PROMO_CODES,
  DEFAULT_SHOP_PRODUCTS,
  executeBuyBoosterPack,
  executeBuySingleCard,
  loadUserWallet,
  redeemPromoCode,
} from '../utils/shopStore';
import { soundFx } from '../utils/sound';
import { CardVisual } from './CardVisual';

export interface CardShopProps {
  onInspectCard?: (card: CardDefinition) => void;
  onNavigateToCollection?: () => void;
  onDeckUpdated?: () => void;
}

export const CardShop: React.FC<CardShopProps> = ({
  onInspectCard,
  onNavigateToCollection,
  onDeckUpdated,
}) => {
  const [wallet, setWallet] = useState<UserWallet>(loadUserWallet);
  const [selectedTab, setSelectedTab] = useState<'ALL' | 'PACKS' | 'SINGLES' | 'HISTORY'>('ALL');
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoFeedback, setPromoFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Daily reward notification feedback
  const [dailyFeedback, setDailyFeedback] = useState<{
    show: boolean;
    success: boolean;
    message: string;
  } | null>(null);

  // Pack opening interactive reveal modal
  const [openedPackResult, setOpenedPackResult] = useState<{
    packTitle: string;
    product: ShopProduct;
    cards: CardDefinition[];
    newlyUnlockedIds: string[];
    revealedIndices: number[];
  } | null>(null);

  // Single card purchase modal
  const [singlePurchaseTarget, setSinglePurchaseTarget] = useState<ShopProduct | null>(null);
  const [singleFeedback, setSingleFeedback] = useState<string | null>(null);

  // Refresh wallet state whenever component mounts or window gains focus
  useEffect(() => {
    const refresh = () => setWallet(loadUserWallet());
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  const boosterPacks = useMemo(
    () => DEFAULT_SHOP_PRODUCTS.filter((p) => p.category === 'BOOSTER_PACK'),
    []
  );

  const singleCards = useMemo(
    () => DEFAULT_SHOP_PRODUCTS.filter((p) => p.category === 'SINGLE_CARD'),
    []
  );

  const handleClaimDaily = () => {
    soundFx.playCardSelect();
    const res = claimDailyReward();
    setWallet(loadUserWallet());
    setDailyFeedback({
      show: true,
      success: res.success,
      message: res.message,
    });
    if (res.success) {
      soundFx.playRoundWin();
    } else {
      soundFx.playSuitDraw();
    }
    setTimeout(() => setDailyFeedback(null), 5000);
  };

  const handleOpenPromoModal = () => {
    soundFx.playCardSelect();
    setPromoFeedback(null);
    setPromoInput('');
    setPromoModalOpen(true);
  };

  const handleRedeemPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;

    soundFx.playCardSelect();
    const res = redeemPromoCode(promoInput);
    setWallet(loadUserWallet());

    if (res.success) {
      soundFx.playRoundWin();
      setPromoFeedback({ type: 'success', message: res.message });
      setPromoInput('');
    } else {
      soundFx.playSuitDraw();
      setPromoFeedback({ type: 'error', message: res.message });
    }
  };

  const handleBuyBooster = (product: ShopProduct, useTicket: boolean) => {
    soundFx.playCardSelect();
    const res = executeBuyBoosterPack(product, useTicket);
    setWallet(loadUserWallet());

    if (!res.success) {
      soundFx.playSuitDraw();
      alert(res.error || 'Pembelian gagal dilakukan.');
      return;
    }

    soundFx.playCardDeploy();
    setOpenedPackResult({
      packTitle: product.name,
      product,
      cards: res.openedCards,
      newlyUnlockedIds: res.newlyUnlockedIds,
      revealedIndices: [0], // Start with first card revealed
    });
    onDeckUpdated?.();
  };

  const handleRevealNextCard = () => {
    if (!openedPackResult) return;
    soundFx.playCardSelect();
    const currentLen = openedPackResult.revealedIndices.length;
    if (currentLen < openedPackResult.cards.length) {
      setOpenedPackResult({
        ...openedPackResult,
        revealedIndices: [...openedPackResult.revealedIndices, currentLen],
      });
      // Sound accent on rare/holo reveal
      const nextCard = openedPackResult.cards[currentLen];
      if (nextCard && (isCardHolographic(nextCard) || nextCard.rank === 'SR' || nextCard.rank === 'AR')) {
        soundFx.playRoundWin();
      }
    }
  };

  const handleRevealAllCards = () => {
    if (!openedPackResult) return;
    soundFx.playRoundWin();
    const all = openedPackResult.cards.map((_, i) => i);
    setOpenedPackResult({
      ...openedPackResult,
      revealedIndices: all,
    });
  };

  const handleConfirmSinglePurchase = () => {
    if (!singlePurchaseTarget) return;
    soundFx.playCardSelect();

    const res = executeBuySingleCard(singlePurchaseTarget);
    setWallet(loadUserWallet());

    if (!res.success) {
      soundFx.playSuitDraw();
      setSingleFeedback(res.error || 'Gagal membeli kartu.');
      return;
    }

    soundFx.playRoundWin();
    setSingleFeedback(`Berhasil menambahkan ${res.card?.name} ke koleksi Anda!`);
    onDeckUpdated?.();
    setTimeout(() => {
      setSinglePurchaseTarget(null);
      setSingleFeedback(null);
    }, 1800);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      {/* Shop Banner & Wallet Header */}
      <section className="bg-gradient-to-br from-[#131C31] via-[#10172A] to-[#0A0F1D] border border-amber-500/20 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs font-semibold text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Toko Resmi Monsta Galaxy Card</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
              Toko Kartu &amp; Pek Booster Galaksi
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              Kumpulkan Koin Galaksi dari setiap kemenangan di Arena Duel, tukarkan kode hadiah, atau buka Pek Booster eksklusif untuk melengkapi seri Blazing Frost dan kartu legendaris BoBoiBoy.
            </p>
          </div>

          {/* User Wallet Balance Pod */}
          <div className="bg-[#0B1120]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 min-w-[280px] shadow-lg">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Saldo Dompet Petarung</span>
              <button
                type="button"
                onClick={handleOpenPromoModal}
                className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline transition-colors flex items-center gap-1"
              >
                <Gift className="w-3 h-3" />
                <span>Kode Hadiah</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-[#131C31] border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Koin Galaksi</div>
                  <div className="text-lg font-mono font-extrabold text-amber-300 tabular-nums">
                    {wallet.coins.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="bg-[#131C31] border border-sky-500/30 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Tiket Booster</div>
                  <div className="text-lg font-mono font-extrabold text-sky-300 tabular-nums">
                    {wallet.tickets}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClaimDaily}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Gift className="w-4 h-4" />
              <span>Klaim Hadiah Harian (+250 Koin)</span>
            </button>

            {dailyFeedback && (
              <div
                className={`text-xs p-2.5 rounded-lg border flex items-center gap-2 ${
                  dailyFeedback.success
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                }`}
              >
                {dailyFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>{dailyFeedback.message}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'ALL', label: 'Semua Produk', icon: <ShoppingBag className="w-4 h-4" /> },
            { id: 'PACKS', label: 'Pek Booster (6 Kartu)', icon: <Package className="w-4 h-4" /> },
            { id: 'SINGLES', label: 'Kartu Lepasan (Single)', icon: <Sparkles className="w-4 h-4" /> },
            { id: 'HISTORY', label: 'Riwayat Transaksi', icon: <History className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundFx.playCardSelect();
                setSelectedTab(tab.id as typeof selectedTab);
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                selectedTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'bg-[#131C31] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Menang di Arena Duel: </span>
          <span className="font-mono text-amber-300 font-bold">+150 Koin</span>
          <span className="text-slate-600">·</span>
          <span>Seri / Kalah: </span>
          <span className="font-mono text-slate-300">+60 Koin</span>
        </div>
      </div>

      {/* BOOSTER PACKS SECTION */}
      {(selectedTab === 'ALL' || selectedTab === 'PACKS') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-display font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <span>Pek Booster Resmi Galaksi</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Tiap pek berisi 6 kartu acak dengan jaminan kartu foil Langka atau Hologram spektrum.
              </p>
            </div>
            {wallet.tickets > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 border border-sky-500/30 rounded-lg text-xs font-mono text-sky-300">
                <Ticket className="w-3.5 h-3.5" />
                <span>{wallet.tickets} Tiket Siap Pakai</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {boosterPacks.map((pack) => {
              const canAffordCoins = wallet.coins >= pack.priceCoins;
              const hasTicket = wallet.tickets > 0;

              return (
                <div
                  key={pack.id}
                  className="bg-[#131C31] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between gap-5 transition-all shadow-md relative group"
                >
                  {pack.badge && (
                    <span className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 border border-amber-500/40 text-amber-300">
                      {pack.badge}
                    </span>
                  )}

                  <div className="space-y-3">
                    {/* Visual Pack Foil Art Frame */}
                    <div className="h-44 rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-700/60 relative overflow-hidden flex flex-col items-center justify-center text-center p-4">
                      <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                      <Package className="w-12 h-12 text-amber-400/80 mb-2 drop-shadow" />
                      <div className="text-sm font-display font-black text-white tracking-wide uppercase px-2">
                        {pack.name.replace(/\(.*\)/, '')}
                      </div>
                      <div className="text-[11px] font-mono text-amber-300/80 mt-1">
                        6 KARTU · {pack.guaranteedRarity ? `MIN. ${pack.guaranteedRarity}` : 'FOIL'}
                      </div>

                      {/* Featured mini cards preview */}
                      {pack.featuredCardIds && (
                        <div className="flex items-center gap-1 mt-3">
                          {pack.featuredCardIds.slice(0, 3).map((fId) => {
                            const c = CARD_BY_ID[fId];
                            if (!c) return null;
                            return (
                              <span
                                key={fId}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-black/60 border border-slate-700 text-slate-300 max-w-[85px] truncate"
                              >
                                {c.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-display font-bold text-white group-hover:text-amber-300 transition-colors">
                        {pack.name}
                      </h3>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">
                        {pack.subtitle}
                      </div>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {pack.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                      <span>Harga Pek:</span>
                      <span className="text-amber-300 font-bold flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5" />
                        <span>{pack.priceCoins} Koin</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleBuyBooster(pack, false)}
                        disabled={!canAffordCoins}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                          canAffordCoins
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md cursor-pointer'
                            : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                        }`}
                      >
                        <Coins className="w-4 h-4" />
                        <span>
                          {canAffordCoins
                            ? `Beli (${pack.priceCoins} Koin)`
                            : `Koin Kurang (${wallet.coins}/${pack.priceCoins})`}
                        </span>
                      </button>

                      {hasTicket && (
                        <button
                          type="button"
                          onClick={() => handleBuyBooster(pack, true)}
                          className="w-full py-2 px-3 bg-[#0B1120] hover:bg-sky-950 border border-sky-500/40 text-sky-300 hover:text-sky-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          <span>Gunakan 1 Tiket Booster</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SINGLE CARDS SHELF */}
      {(selectedTab === 'ALL' || selectedTab === 'SINGLES') && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-display font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-400" />
                <span>Kartu Lepasan Resmi (Singles Shelf)</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Beli kartu legendaris incaran langsung tanpa sistem gacha acak.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {singleCards.map((product) => {
              const cardDef = product.cardId ? CARD_BY_ID[product.cardId] : undefined;
              const canAfford = wallet.coins >= product.priceCoins;

              return (
                <div
                  key={product.id}
                  className="bg-[#131C31] border border-slate-800 hover:border-sky-500/40 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all shadow-md group"
                >
                  {product.badge && (
                    <span className="self-start px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-500/20 border border-sky-500/40 text-sky-300">
                      {product.badge}
                    </span>
                  )}

                  {cardDef ? (
                    <div className="flex flex-col items-center py-2">
                      <CardVisual
                        card={cardDef}
                        size="sm"
                        enable3DTilt
                        onClick={() => onInspectCard?.(cardDef)}
                      />
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <h3 className="text-base font-display font-bold text-white group-hover:text-sky-300 transition-colors">
                      {product.name}
                    </h3>
                    <div className="text-xs text-slate-400 leading-relaxed">
                      {product.description}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                      <span>Harga Tunggal:</span>
                      <span className="text-amber-300 font-bold flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5" />
                        <span>{product.priceCoins} Koin</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSinglePurchaseTarget(product)}
                      disabled={!canAfford}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        canAfford
                          ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                      }`}
                    >
                      <span>
                        {canAfford
                          ? `Beli Kartu Ini (${product.priceCoins} Koin)`
                          : `Koin Kurang (${wallet.coins}/${product.priceCoins})`}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TRANSACTION HISTORY TAB */}
      {selectedTab === 'HISTORY' && (
        <section className="bg-[#131C31] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              <span>Riwayat Transaksi Dompet Petarung</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">
              Total {wallet.transactionHistory.length} Transaksi Terakhir
            </span>
          </div>

          {wallet.transactionHistory.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              Belum ada transaksi di akun Anda. Bertarunglah di Arena atau klaim hadiah harian!
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {wallet.transactionHistory.map((tx) => {
                const isPositive = tx.amount >= 0;
                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-200">{tx.label}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {new Date(tx.timestamp).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </div>
                    </div>
                    <div
                      className={`font-mono font-bold text-sm tabular-nums ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? `+${tx.amount}` : tx.amount} Koin
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* INTERACTIVE PACK OPENING MODAL */}
      {openedPackResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F172A] border border-amber-500/40 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setOpenedPackResult(null)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-xs font-mono text-amber-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Hasil Pembukaan Pek</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white">
                {openedPackResult.packTitle}
              </h3>
              <p className="text-xs text-slate-400">
                Terbuka {openedPackResult.revealedIndices.length} dari {openedPackResult.cards.length} kartu
              </p>
            </div>

            {/* Cards Grid Reveal */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 py-2">
              {openedPackResult.cards.map((card, idx) => {
                const isRevealed = openedPackResult.revealedIndices.includes(idx);
                const isNew = openedPackResult.newlyUnlockedIds.includes(card.id);
                const isHolo = isCardHolographic(card);

                return (
                  <div
                    key={`${card.id}-${idx}`}
                    onClick={() => {
                      if (!isRevealed) {
                        handleRevealNextCard();
                      } else {
                        onInspectCard?.(card);
                      }
                    }}
                    className={`cursor-pointer transition-all duration-300 transform flex flex-col items-center ${
                      !isRevealed ? 'hover:scale-105' : ''
                    }`}
                  >
                    {isRevealed ? (
                      <div className="space-y-2 relative flex flex-col items-center">
                        {isNew && (
                          <span className="absolute -top-2 z-20 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-md animate-bounce">
                            BARU!
                          </span>
                        )}
                        <CardVisual
                          card={card}
                          size="xs"
                          enable3DTilt
                          onClick={() => onInspectCard?.(card)}
                        />
                        <div className="text-center w-full">
                          <div className="text-[11px] font-semibold text-white truncate max-w-[110px]">
                            {card.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            Rank {card.rank} {isHolo && '✨'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-[110px] h-[154px] rounded-xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border-2 border-dashed border-amber-500/50 flex flex-col items-center justify-center p-3 text-center gap-2 shadow-inner group">
                        <Sparkles className="w-6 h-6 text-amber-400/70 group-hover:text-amber-300 transition-colors animate-pulse" />
                        <span className="text-[10px] font-mono font-bold text-slate-300">
                          Klik Buka
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2">
                {openedPackResult.revealedIndices.length < openedPackResult.cards.length ? (
                  <button
                    type="button"
                    onClick={handleRevealAllCards}
                    className="px-4 py-2 bg-[#1E293B] hover:bg-slate-700 text-xs font-semibold text-amber-300 rounded-xl transition-colors border border-amber-500/30"
                  >
                    Buka Semua Sekaligus
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenedPackResult(null);
                      onNavigateToCollection?.();
                    }}
                    className="px-4 py-2 bg-[#1E293B] hover:bg-slate-700 text-xs font-semibold text-sky-300 rounded-xl transition-colors"
                  >
                    Lihat di Galeri Koleksi →
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const prod = openedPackResult.product;
                    handleBuyBooster(prod, false);
                  }}
                  disabled={wallet.coins < openedPackResult.product.priceCoins}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-md"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Buka Pek Lagi ({openedPackResult.product.priceCoins} Koin)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenedPackResult(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-xl transition-colors"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE CARD PURCHASE CONFIRMATION MODAL */}
      {singlePurchaseTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => {
                setSinglePurchaseTarget(null);
                setSingleFeedback(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-display font-bold text-white">
                Konfirmasi Beli Kartu Lepasan
              </h3>
              <p className="text-xs text-slate-400">
                Kartu akan langsung terbuka dan siap dimasukkan ke dalam dek Anda.
              </p>
            </div>

            {singlePurchaseTarget.cardId && CARD_BY_ID[singlePurchaseTarget.cardId] && (
              <div className="flex flex-col items-center py-2">
                <CardVisual
                  card={CARD_BY_ID[singlePurchaseTarget.cardId]!}
                  size="sm"
                  enable3DTilt
                />
              </div>
            )}

            <div className="bg-[#131C31] border border-slate-800 rounded-xl p-3.5 space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Nama Kartu:</span>
                <strong className="text-white">{singlePurchaseTarget.name}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Harga Koin:</span>
                <strong className="text-amber-300 font-mono">
                  {singlePurchaseTarget.priceCoins} Koin
                </strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Sisa Saldo Anda:</span>
                <span className="font-mono text-slate-400">
                  {(wallet.coins - singlePurchaseTarget.priceCoins).toLocaleString()} Koin
                </span>
              </div>
            </div>

            {singleFeedback && (
              <div className="text-xs p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-center">
                {singleFeedback}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSinglePurchaseTarget(null)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSinglePurchase}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5"
              >
                <Coins className="w-4 h-4" />
                <span>Beli Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROMO CODE REDEEM MODAL */}
      {promoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => setPromoModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300">
                <Gift className="w-3 h-3" />
                <span>Kupon Hadiah</span>
              </div>
              <h3 className="text-lg font-display font-bold text-white">
                Tukarkan Kode Promo Hadiah
              </h3>
              <p className="text-xs text-slate-400">
                Masukkan kode kupon resmi untuk mendapatkan Koin Galaksi dan Tiket Pek gratis.
              </p>
            </div>

            <form onSubmit={handleRedeemPromo} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Contoh: BOBOIBOY2026"
                  className="w-full bg-[#131C31] border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 tracking-wider uppercase"
                />
              </div>

              {promoFeedback && (
                <div
                  className={`text-xs p-3 rounded-xl border flex items-center gap-2 ${
                    promoFeedback.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                  }`}
                >
                  {promoFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{promoFeedback.message}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Kode Tersedia untuk Dicoba:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(DEFAULT_PROMO_CODES).map(([code, meta]) => {
                    const alreadyRedeemed = wallet.redeemedCodeIds.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setPromoInput(code)}
                        className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                          alreadyRedeemed
                            ? 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                            : 'bg-[#131C31] border-slate-700 text-amber-300 hover:border-amber-500/50'
                        }`}
                      >
                        <span>{code}</span>
                        <span className="text-[10px] text-slate-400">(+{meta.coins})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPromoModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-md"
                >
                  Tukarkan Kode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
