import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Crown,
  Gift,
  KeyRound,
  Lock,
  LogOut,
  Megaphone,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { GlobalAppUpdate, OwnerSession, UpdateCategory } from '../types/owner';
import {
  broadcastImmediateAnnouncement,
  clearOwnerSession,
  deleteGlobalUpdate,
  fetchGlobalUpdates,
  getStoredOwnerSession,
  loginAsOwner,
  OWNER_EMAIL_DEFAULT,
  publishGlobalUpdate,
  saveOwnerSession,
} from '../utils/ownerService';
import { soundFx } from '../utils/sound';

export interface OwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateBroadcasted?: (update: GlobalAppUpdate) => void;
}

export const OwnerModal: React.FC<OwnerModalProps> = ({
  isOpen,
  onClose,
  onUpdateBroadcasted,
}) => {
  const [session, setSession] = useState<OwnerSession | null>(getStoredOwnerSession);
  const [activeTab, setActiveTab] = useState<'BROADCAST_UPDATE' | 'FLASH_ALERT' | 'UPDATE_LIST' | 'PROMO_INFO'>('BROADCAST_UPDATE');

  // Login form state
  const [emailInput, setEmailInput] = useState(OWNER_EMAIL_DEFAULT);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // New Update form state
  const [updVersion, setUpdVersion] = useState('v1.4.0');
  const [updTitle, setUpdTitle] = useState('');
  const [updCategory, setUpdCategory] = useState<UpdateCategory>('NEW_CARDS');
  const [updSummary, setUpdSummary] = useState('');
  const [updDetails, setUpdDetails] = useState<string[]>(['']);
  const [updGiftCoins, setUpdGiftCoins] = useState<number>(500);
  const [updGiftTickets, setUpdGiftTickets] = useState<number>(1);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Instant Flash Broadcast state
  const [flashTitle, setFlashTitle] = useState('Pengumuman Pemilik Aplikasi');
  const [flashMessage, setFlashMessage] = useState('');
  const [flashLoading, setFlashLoading] = useState(false);
  const [flashFeedback, setFlashFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active updates list
  const [updatesList, setUpdatesList] = useState<GlobalAppUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSession(getStoredOwnerSession());
      loadUpdates();
    }
  }, [isOpen]);

  const loadUpdates = async () => {
    setLoadingUpdates(true);
    const list = await fetchGlobalUpdates();
    setUpdatesList(list);
    setLoadingUpdates(false);
  };

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    const res = await loginAsOwner(emailInput, passkeyInput);
    setLoginLoading(false);

    if (res.success && res.session) {
      soundFx.playRoundWin();
      setSession(res.session);
      loadUpdates();
    } else {
      soundFx.playSuitDraw();
      setLoginError(res.message);
    }
  };

  const handleLogout = () => {
    soundFx.playCardSelect();
    clearOwnerSession();
    setSession(null);
    setPasskeyInput('');
  };

  const handleAddDetailItem = () => {
    setUpdDetails([...updDetails, '']);
  };

  const handleDetailChange = (index: number, val: string) => {
    const next = [...updDetails];
    next[index] = val;
    setUpdDetails(next);
  };

  const handleRemoveDetailItem = (index: number) => {
    setUpdDetails(updDetails.filter((_, i) => i !== index));
  };

  const handlePublishUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.token) return;
    if (!updTitle.trim() || !updSummary.trim()) {
      setPublishFeedback({ type: 'error', message: 'Judul dan ringkasan pembaruan harus diisi!' });
      return;
    }

    setPublishLoading(true);
    setPublishFeedback(null);

    const filteredDetails = updDetails.map((d) => d.trim()).filter(Boolean);

    const res = await publishGlobalUpdate(session.token, {
      version: updVersion,
      title: updTitle,
      category: updCategory,
      summary: updSummary,
      details: filteredDetails.length > 0 ? filteredDetails : [updSummary.trim()],
      giftCoins: updGiftCoins,
      giftTickets: updGiftTickets,
    });

    setPublishLoading(false);

    if (res.success && res.update) {
      soundFx.playRoundWin();
      setPublishFeedback({ type: 'success', message: res.message });
      setUpdTitle('');
      setUpdSummary('');
      setUpdDetails(['']);
      loadUpdates();
      onUpdateBroadcasted?.(res.update);
    } else {
      soundFx.playSuitDraw();
      setPublishFeedback({ type: 'error', message: res.message });
    }
  };

  const handleSendFlashBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.token || !flashMessage.trim()) return;

    setFlashLoading(true);
    setFlashFeedback(null);

    const res = await broadcastImmediateAnnouncement(
      session.token,
      flashTitle.trim() || 'Pengumuman Resmi',
      flashMessage.trim()
    );

    setFlashLoading(false);

    if (res.success) {
      soundFx.playRoundWin();
      setFlashFeedback({ type: 'success', message: res.message });
      setFlashMessage('');
    } else {
      soundFx.playSuitDraw();
      setFlashFeedback({ type: 'error', message: res.message });
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    if (!session?.token) return;
    if (!confirm('Yakin ingin menghapus catatan pembaruan ini?')) return;

    soundFx.playCardSelect();
    const res = await deleteGlobalUpdate(session.token, updateId);
    if (res.success) {
      loadUpdates();
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0D1527] border border-amber-500/40 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white">
                Panel Pemilik Aplikasi
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 border border-amber-500/40 text-amber-300">
                Owner Access
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Kelola rilis pembaruan, siarkan pengumuman ke seluruh layar pengguna secara langsung.
            </p>
          </div>
        </div>

        {/* AUTHENTICATION VIEW IF NOT LOGGED IN */}
        {!session ? (
          <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-sky-500/10 border border-sky-500/30 text-sky-300">
                <Lock className="w-3.5 h-3.5" />
                <span>Otentikasi Pemilik Aplikasi</span>
              </div>
              <h3 className="text-lg font-display font-bold text-white">
                Masuk sebagai Pemilik (Ahmad Syarif)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Halaman ini khusus untuk pemilik aplikasi. Masukkan email pemilik dan kata sandi untuk mengakses siaran pembaruan.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Akun Pemilik
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="ahmadsyarif08@admin.sd.belajar.id"
                  className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kata Sandi / Kunci Akses Pemilik
                </label>
                <input
                  type="password"
                  value={passkeyInput}
                  onChange={(e) => setPasskeyInput(e.target.value)}
                  placeholder="Masukkan kata sandi pemilik..."
                  className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
                <div className="mt-1.5 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Kata sandi default: <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">boboiboy-owner-2026</code></span>
                  <button
                    type="button"
                    onClick={() => setPasskeyInput('boboiboy-owner-2026')}
                    className="text-amber-400 hover:underline text-[10px]"
                  >
                    Pakai Default
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="text-xs p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Masuk ke Panel Pemilik</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED OWNER DASHBOARD */
          <div className="space-y-6">
            {/* Owner Profile Banner */}
            <div className="bg-[#131C31] border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-base font-display">
                  AS
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{session.name}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-full font-mono">
                      ONLINE
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">{session.email}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Akun</span>
              </button>
            </div>

            {/* Dashboard Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
              {[
                {
                  id: 'BROADCAST_UPDATE',
                  label: 'Publikasi Pembaruan',
                  icon: <Megaphone className="w-4 h-4" />,
                },
                {
                  id: 'FLASH_ALERT',
                  label: 'Siaran Flash Instan',
                  icon: <Radio className="w-4 h-4" />,
                },
                {
                  id: 'UPDATE_LIST',
                  label: `Daftar Pembaruan (${updatesList.length})`,
                  icon: <Bell className="w-4 h-4" />,
                },
                {
                  id: 'PROMO_INFO',
                  label: 'Kode Hadiah',
                  icon: <Gift className="w-4 h-4" />,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    soundFx.playCardSelect();
                    setActiveTab(tab.id as typeof activeTab);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                      : 'bg-[#131C31] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* TAB 1: BROADCAST NEW UPDATE */}
            {activeTab === 'BROADCAST_UPDATE' && (
              <form onSubmit={handlePublishUpdate} className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-amber-400" />
                    <span>Publikasikan Rilis Pembaruan Aplikasi</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pembaruan ini akan otomatis disiarkan secara waktu nyata melalui WebSocket ke seluruh perangkat pengguna yang sedang aktif.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Nomor Versi</label>
                    <input
                      type="text"
                      value={updVersion}
                      onChange={(e) => setUpdVersion(e.target.value)}
                      placeholder="v1.4.0"
                      className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-300 mb-1">Kategori Pembaruan</label>
                    <select
                      value={updCategory}
                      onChange={(e) => setUpdCategory(e.target.value as UpdateCategory)}
                      className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="NEW_CARDS">Kartu Baru &amp; Ekspansi (NEW_CARDS)</option>
                      <option value="PATCH">Pembaruan Sistem / Patch Keseimbangan (PATCH)</option>
                      <option value="EVENT">Acara Spesial &amp; Turnamen (EVENT)</option>
                      <option value="ANNOUNCEMENT">Pengumuman Penting (ANNOUNCEMENT)</option>
                      <option value="MAINTENANCE">Pemeliharaan Server (MAINTENANCE)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Judul Pembaruan</label>
                  <input
                    type="text"
                    value={updTitle}
                    onChange={(e) => setUpdTitle(e.target.value)}
                    placeholder="Contoh: Rilis Toko Kartu Galaksi & Fitur Hadiah Harian!"
                    className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Ringkasan Singkat</label>
                  <textarea
                    rows={2}
                    value={updSummary}
                    onChange={(e) => setUpdSummary(e.target.value)}
                    placeholder="Deskripsi singkat yang tampil pada banner pengumuman..."
                    className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                {/* Details bullet points */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-300 font-semibold">
                      Poin-Poin Perubahan (Patch Notes):
                    </label>
                    <button
                      type="button"
                      onClick={handleAddDetailItem}
                      className="text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Poin</span>
                    </button>
                  </div>

                  {updDetails.map((detail, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500 w-5 text-right">{idx + 1}.</span>
                      <input
                        type="text"
                        value={detail}
                        onChange={(e) => handleDetailChange(idx, e.target.value)}
                        placeholder="Contoh: Penambahan Pek Booster Kuasa Elemental..."
                        className="flex-1 bg-[#0B1120] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600"
                      />
                      {updDetails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDetailItem(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Gift reward attached to update */}
                <div className="bg-[#0B1120] border border-amber-500/30 rounded-xl p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <Gift className="w-4 h-4" />
                    <span>Hadiah Klaim Gratis untuk Seluruh Pengguna:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Bonus Koin</label>
                      <input
                        type="number"
                        value={updGiftCoins}
                        onChange={(e) => setUpdGiftCoins(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-[#131C31] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Bonus Tiket Pek</label>
                      <input
                        type="number"
                        value={updGiftTickets}
                        onChange={(e) => setUpdGiftTickets(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-[#131C31] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-sky-300 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {publishFeedback && (
                  <div
                    className={`text-xs p-3 rounded-xl border flex items-center gap-2 ${
                      publishFeedback.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                    }`}
                  >
                    {publishFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{publishFeedback.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={publishLoading}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {publishLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Siarkan Pembaruan ke Seluruh Pengguna Sekarang</span>
                </button>
              </form>
            )}

            {/* TAB 2: FLASH BROADCAST */}
            {activeTab === 'FLASH_ALERT' && (
              <form onSubmit={handleSendFlashBroadcast} className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                    <span>Kirim Pesan Siaran Instan (Flash Alert)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pesan darurat atau pengumuman penting ini akan langsung muncul sebagai notifikasi pop-up di layar semua pemain yang sedang terkoneksi.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Judul Pengumuman</label>
                  <input
                    type="text"
                    value={flashTitle}
                    onChange={(e) => setFlashTitle(e.target.value)}
                    placeholder="Pengumuman Penting dari Pemilik"
                    className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Isi Pesan Pengumuman</label>
                  <textarea
                    rows={4}
                    value={flashMessage}
                    onChange={(e) => setFlashMessage(e.target.value)}
                    placeholder="Contoh: Halo semua petarung! Server akan melakukan sinkronisasi kartu baru dalam 5 menit..."
                    className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    required
                  />
                </div>

                {flashFeedback && (
                  <div
                    className={`text-xs p-3 rounded-xl border flex items-center gap-2 ${
                      flashFeedback.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                    }`}
                  >
                    {flashFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{flashFeedback.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={flashLoading}
                  className="w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {flashLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Kirim Flash Alert ke Semua Layar Sekarang</span>
                </button>
              </form>
            )}

            {/* TAB 3: UPDATE LIST */}
            {activeTab === 'UPDATE_LIST' && (
              <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <span>Daftar Pembaruan Aktif di Server</span>
                  </h3>
                  <button
                    type="button"
                    onClick={loadUpdates}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingUpdates ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {updatesList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Belum ada riwayat pembaruan yang dipublikasikan.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {updatesList.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#0B1120] border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-amber-300">{item.version}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">
                                {item.category}
                              </span>
                            </div>
                            <div className="font-display font-bold text-white text-sm">
                              {item.title}
                            </div>
                            <p className="text-slate-400 leading-relaxed">{item.summary}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteUpdate(item.id)}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                            title="Hapus Pembaruan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {item.details && item.details.length > 0 && (
                          <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] pl-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                            {item.details.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800 font-mono">
                          <span>
                            Dibuat: {new Date(item.timestamp).toLocaleDateString('id-ID')}
                          </span>
                          {item.giftCoins ? (
                            <span className="text-amber-400">Bonus: +{item.giftCoins} Koin</span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PROMO CODES */}
            {activeTab === 'PROMO_INFO' && (
              <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
                    <Gift className="w-4 h-4 text-amber-400" />
                    <span>Daftar Kode Promo &amp; Hadiah Pemain</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pemain dapat menukarkan kode-kode berikut di Toko Kartu untuk mengklaim koin dan tiket booster secara cuma-cuma.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { code: 'BOBOIBOY2026', desc: 'Bonus Selamat Datang', reward: '500 Koin + 1 Tiket' },
                    { code: 'PEMILIKAPP', desc: 'Hadiah Spesial Ahmad Syarif', reward: '1000 Koin + 2 Tiket' },
                    { code: 'BLAZINGFROST', desc: 'Hadiah Rilis Pek Utama', reward: '350 Koin' },
                    { code: 'KUASA7', desc: 'Bonus 7 Elemen Galaksi', reward: '700 Koin + 1 Tiket' },
                  ].map((p) => (
                    <div key={p.code} className="bg-[#0B1120] border border-slate-800 rounded-xl p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-300 text-xs tracking-wider">
                          {p.code}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400">{p.reward}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
