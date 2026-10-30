import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Gift,
  Megaphone,
  Radio,
  Sparkles,
  X,
} from 'lucide-react';
import type { GlobalAppUpdate } from '../types/owner';
import { fetchGlobalUpdates } from '../utils/ownerService';
import { claimUpdateGift, loadUserWallet } from '../utils/shopStore';
import { soundFx } from '../utils/sound';

export interface GlobalUpdateBannerProps {
  onOpenShop?: () => void;
  onRefreshData?: () => void;
}

export const GlobalUpdateBanner: React.FC<GlobalUpdateBannerProps> = ({
  onOpenShop,
  onRefreshData,
}) => {
  const [updates, setUpdates] = useState<GlobalAppUpdate[]>([]);
  const [activeModalUpdate, setActiveModalUpdate] = useState<GlobalAppUpdate | null>(null);
  const [flashAlert, setFlashAlert] = useState<{ title: string; message: string } | null>(null);
  const [bannerDismissedId, setBannerDismissedId] = useState<string | null>(null);
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null);
  const [wallet, setWallet] = useState(loadUserWallet);

  useEffect(() => {
    // Initial fetch of updates from server
    const load = async () => {
      const list = await fetchGlobalUpdates();
      if (list.length > 0) {
        setUpdates(list);
      }
    };
    load();

    // Listen for custom window event dispatched by WebSocket or local owner publish
    const handleWsGlobalMessage = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      if (!data) return;

      if (data.type === 'global:announcement') {
        soundFx.playRoundWin();
        setFlashAlert({
          title: data.title || 'Pengumuman Penting',
          message: data.message || '',
        });
      } else if (data.type === 'global:update' && data.update) {
        soundFx.playRoundWin();
        setUpdates((prev) => [data.update, ...prev.filter((u) => u.id !== data.update.id)]);
        setActiveModalUpdate(data.update);
        onRefreshData?.();
      }
    };

    window.addEventListener('monsta:global_message', handleWsGlobalMessage);
    return () => window.removeEventListener('monsta:global_message', handleWsGlobalMessage);
  }, [onRefreshData]);

  const latestUpdate = updates[0] ?? null;
  const hasUnclaimedGift =
    latestUpdate &&
    latestUpdate.giftCoins &&
    latestUpdate.giftCoins > 0 &&
    !wallet.claimedUpdateGiftIds.includes(latestUpdate.id);

  const shouldShowFloatingBanner =
    latestUpdate &&
    bannerDismissedId !== latestUpdate.id &&
    (hasUnclaimedGift || latestUpdate.pinned);

  const handleClaim = (upd: GlobalAppUpdate) => {
    if (!upd.giftCoins) return;
    soundFx.playRoundWin();
    const res = claimUpdateGift(upd.id, upd.giftCoins, upd.title);
    setWallet(loadUserWallet());
    setClaimFeedback(res.message);
    onRefreshData?.();
    setTimeout(() => setClaimFeedback(null), 4000);
  };

  return (
    <>
      {/* FLOATING TOP/BOTTOM NOTIFICATION BAR */}
      {shouldShowFloatingBanner && (
        <div className="bg-gradient-to-r from-amber-500/90 via-amber-600/90 to-amber-500/90 text-slate-950 px-4 py-2 text-xs sm:text-sm font-semibold shadow-xl border-b border-amber-400 flex items-center justify-between gap-3 relative z-40 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 max-w-4xl truncate">
            <span className="p-1 rounded bg-slate-950/20 text-slate-950">
              <Megaphone className="w-4 h-4" />
            </span>
            <span className="font-mono text-slate-900 font-bold uppercase tracking-wider text-[11px] bg-amber-300/60 px-1.5 py-0.5 rounded">
              Pembaruan {latestUpdate.version}
            </span>
            <span className="truncate">
              <strong>{latestUpdate.title}:</strong> {latestUpdate.summary}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                soundFx.playCardSelect();
                setActiveModalUpdate(latestUpdate);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-950 text-amber-300 hover:bg-slate-900 text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {hasUnclaimedGift
                  ? `Klaim Hadiah (+${latestUpdate.giftCoins} Koin)`
                  : 'Lihat Detail'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBannerDismissedId(latestUpdate.id)}
              className="p-1 hover:bg-slate-950/10 rounded text-slate-900 cursor-pointer"
              title="Tutup Banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* FLASH ANNOUNCEMENT POPUP (URGENT BROADCAST) */}
      {flashAlert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border-2 border-rose-500 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/40">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold">
                  Siaran Instan Pemilik Aplikasi
                </span>
                <h3 className="text-lg font-display font-extrabold text-white">
                  {flashAlert.title}
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed bg-[#131C31] p-4 rounded-2xl border border-slate-800">
              {flashAlert.message}
            </p>

            <button
              type="button"
              onClick={() => setFlashAlert(null)}
              className="w-full py-2.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
            >
              Saya Mengerti &amp; Tutup
            </button>
          </div>
        </div>
      )}

      {/* FULL CHANGELOG / UPDATE DETAIL MODAL */}
      {activeModalUpdate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F172A] border border-amber-500/40 rounded-3xl max-w-xl w-full p-6 sm:p-7 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => setActiveModalUpdate(null)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {activeModalUpdate.version}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                    {activeModalUpdate.category}
                  </span>
                </div>
                <h3 className="text-lg font-display font-bold text-white mt-0.5">
                  {activeModalUpdate.title}
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-[#131C31] p-3.5 rounded-xl border border-slate-800">
              {activeModalUpdate.summary}
            </p>

            {activeModalUpdate.details && activeModalUpdate.details.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Rincian Pembaruan:
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300 bg-[#0B1120] p-3.5 rounded-xl border border-slate-800">
                  {activeModalUpdate.details.map((detail, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">▸</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Gift Claim Section */}
            {activeModalUpdate.giftCoins && activeModalUpdate.giftCoins > 0 ? (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Bonus Hadiah Pembaruan</div>
                    <div className="text-[11px] text-amber-300 font-mono">
                      +{activeModalUpdate.giftCoins} Koin Galaksi
                      {activeModalUpdate.giftTickets ? ` & +${activeModalUpdate.giftTickets} Tiket Pek` : ''}
                    </div>
                  </div>
                </div>

                {wallet.claimedUpdateGiftIds.includes(activeModalUpdate.id) ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sudah Diklaim</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleClaim(activeModalUpdate)}
                    className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>Klaim Hadiah</span>
                  </button>
                )}
              </div>
            ) : null}

            {claimFeedback && (
              <div className="text-xs p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-center">
                {claimFeedback}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] font-mono text-slate-500">
                Oleh {activeModalUpdate.author}
              </span>
              <button
                type="button"
                onClick={() => setActiveModalUpdate(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-xl transition-colors cursor-pointer"
              >
                Tutup Catatan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
