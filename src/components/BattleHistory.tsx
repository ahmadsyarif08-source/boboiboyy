import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Filter,
  Flame,
  History,
  Layers,
  RotateCcw,
  Search,
  Share2,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Upload,
  User,
  Zap,
} from 'lucide-react';
import { CARD_BY_ID } from '../data/cards';
import {
  CardCategory,
  SuitElement,
  type BattleLogEntry,
  type CardDefinition,
  type RoundRecord,
} from '../types/game';
import {
  clearAllBattleHistory,
  deleteBattleMatch,
  exportBattleHistoryJson,
  importBattleHistoryJson,
  loadBattleHistory,
  type SavedBattleMatchRecord,
  type TacticalTurningPoint,
} from '../utils/battleHistoryStore';
import { soundFx } from '../utils/sound';
import { CardVisual } from './CardVisual';

interface BattleHistoryProps {
  onInspectCard: (card: CardDefinition) => void;
  onNavigateToArena: () => void;
  onOpenCardTrialWithFighters?: (p0CardId: string, p1CardId: string) => void;
}

const SUIT_ELEMENT_LABELS: Record<SuitElement, { name: string; icon: string; color: string; bg: string }> = {
  [SuitElement.AIR]: { name: 'Air / Es', icon: '💧', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
  [SuitElement.API]: { name: 'Api / Petir', icon: '🔥', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  [SuitElement.DAUN]: { name: 'Daun / Alam', icon: '🍃', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
};

export const BattleHistory: React.FC<BattleHistoryProps> = ({
  onInspectCard,
  onNavigateToArena,
  onOpenCardTrialWithFighters,
}) => {
  const [historyList, setHistoryList] = useState<SavedBattleMatchRecord[]>(() => loadBattleHistory());
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(() =>
    historyList.length > 0 ? historyList[0].id : null
  );
  const [selectedRoundTab, setSelectedRoundTab] = useState<number>(1);
  const [logFilterRound, setLogFilterRound] = useState<number | 'ALL'>('ALL');
  const [logToneFilter, setLogToneFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<string>('ALL');
  const [filterWinner, setFilterWinner] = useState<string>('ALL');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const reloadHistory = () => {
    const list = loadBattleHistory();
    setHistoryList(list);
    if (selectedMatchId && !list.some((m) => m.id === selectedMatchId)) {
      setSelectedMatchId(list.length > 0 ? list[0].id : null);
    } else if (!selectedMatchId && list.length > 0) {
      setSelectedMatchId(list[0].id);
    }
  };

  const filteredMatches = useMemo(() => {
    return historyList.filter((m) => {
      if (filterMode !== 'ALL' && m.mode !== filterMode) return false;
      if (filterWinner === 'P0' && m.winnerIndex !== 0) return false;
      if (filterWinner === 'P1' && m.winnerIndex !== 1) return false;
      if (filterWinner === 'DRAW' && m.winnerIndex !== 'DRAW') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPlayer =
          m.p0.name.toLowerCase().includes(q) || m.p1.name.toLowerCase().includes(q);
        const matchesCard =
          m.p0.characterPicks.some((id) => (CARD_BY_ID[id]?.name || '').toLowerCase().includes(q)) ||
          m.p1.characterPicks.some((id) => (CARD_BY_ID[id]?.name || '').toLowerCase().includes(q));
        const matchesReason = (m.winReason || '').toLowerCase().includes(q);
        if (!matchesPlayer && !matchesCard && !matchesReason) return false;
      }
      return true;
    });
  }, [historyList, filterMode, filterWinner, searchQuery]);

  const activeMatch = useMemo(() => {
    if (!selectedMatchId) return filteredMatches[0] ?? null;
    return historyList.find((m) => m.id === selectedMatchId) ?? filteredMatches[0] ?? null;
  }, [historyList, selectedMatchId, filteredMatches]);

  const activeRoundRecord = useMemo(() => {
    if (!activeMatch) return null;
    return activeMatch.roundHistory.find((r) => r.round === selectedRoundTab) ?? activeMatch.roundHistory[0] ?? null;
  }, [activeMatch, selectedRoundTab]);

  const filteredLogs = useMemo(() => {
    if (!activeMatch) return [];
    return activeMatch.logs.filter((log) => {
      if (logFilterRound !== 'ALL' && log.round !== logFilterRound) return false;
      if (logToneFilter !== 'ALL' && log.tone !== logToneFilter) return false;
      return true;
    });
  }, [activeMatch, logFilterRound, logToneFilter]);

  const handleDeleteCurrent = (id: string) => {
    soundFx.playCardSelect();
    deleteBattleMatch(id);
    reloadHistory();
  };

  const handleClearAll = () => {
    soundFx.playCardSelect();
    clearAllBattleHistory();
    setShowClearConfirm(false);
    reloadHistory();
  };

  const handleExport = () => {
    soundFx.playCardSelect();
    const json = exportBattleHistoryJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monsta-galaxy-battle-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = importBattleHistoryJson(text);
      setImportStatus(res.message);
      if (res.success) {
        soundFx.playRoundWin();
        reloadHistory();
      }
      setTimeout(() => setImportStatus(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <History className="w-4 h-4" />
            <span>ARSIP ANALISIS TAKTIK MEDAN TEMPUR</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">
            Riwayat Pertarungan & Tinjauan Taktis
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Tinjau hasil pertandingan sebelumnya, rekap pertarungan ronde-demi-ronde, analisis adu suit elemen, serta catatan taktis untuk menyempurnakan strategi dek Anda.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700">
            <Upload className="w-3.5 h-3.5" />
            <span>Impor JSON</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
          </label>

          <button
            type="button"
            onClick={handleExport}
            disabled={historyList.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl transition-colors border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Data</span>
          </button>

          {historyList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-xl transition-colors border border-rose-800/60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNavigateToArena}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors shadow-lg shadow-amber-500/20"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Duel di Arena</span>
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-medium animate-pulse">
          {importStatus}
        </div>
      )}

      {/* Confirmation Modal for Clearing All */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#131C31] border border-slate-700 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Hapus Semua Riwayat Pertandingan?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tindakan ini akan menghapus seluruh rekaman {historyList.length} pertandingan dari memori lokal peramban. Data tidak dapat dipulihkan kecuali Anda telah mengekspornya.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-colors"
              >
                Ya, Bersihkan Riwayat
              </button>
            </div>
          </div>
        </div>
      )}

      {historyList.length === 0 ? (
        /* Empty State */
        <div className="bg-[#131C31] border border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto my-12 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <History className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-white">Belum Ada Riwayat Pertandingan</h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              Setiap kali Anda menyelesaikan duel 1 lawan 1 di Arena (melawan Komputer atau Pass & Play), seluruh data pertarungan, suit, dan catatan taktis akan otomatis tersimpan di sini.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                soundFx.playCardSelect();
                onNavigateToArena();
              }}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors shadow-lg shadow-amber-500/20"
            >
              <Swords className="w-4 h-4" />
              <span>Mulai Pertandingan Sekarang</span>
            </button>
          </div>
        </div>
      ) : (
        /* Main Grid: Match List (Left) + Match Details & Tactical Review (Right) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Matches List & Filter */}
          <div className="lg:col-span-4 space-y-4">
            {/* Search & Filters Card */}
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari pemain atau kartu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0B1120] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 mb-1 block">Mode Duel</label>
                  <select
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value)}
                    className="w-full bg-[#0B1120] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  >
                    <option value="ALL">Semua Mode</option>
                    <option value="VS_CPU">vs Komputer</option>
                    <option value="PASS_AND_PLAY">Pass & Play</option>
                    <option value="CPU_VS_CPU">Simulasi CPU</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-400 mb-1 block">Hasil Duel</label>
                  <select
                    value={filterWinner}
                    onChange={(e) => setFilterWinner(e.target.value)}
                    className="w-full bg-[#0B1120] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  >
                    <option value="ALL">Semua Hasil</option>
                    <option value="P0">Kemenangan P1</option>
                    <option value="P1">Kemenangan P2</option>
                    <option value="DRAW">Hasil Seri</option>
                  </select>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-500 pt-1 flex items-center justify-between">
                <span>Ditemukan: {filteredMatches.length} duel</span>
                <span>Total: {historyList.length} arsip</span>
              </div>
            </div>

            {/* List of Match Cards */}
            <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
              {filteredMatches.map((m) => {
                const isSelected = m.id === activeMatch?.id;
                const isP0Win = m.winnerIndex === 0;
                const isP1Win = m.winnerIndex === 1;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      soundFx.playCardSelect();
                      setSelectedMatchId(m.id);
                      setSelectedRoundTab(1);
                      setLogFilterRound('ALL');
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-[#18233D] border-amber-400 shadow-md shadow-amber-500/10'
                        : 'bg-[#131C31] hover:bg-[#162038] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {m.dateFormatted}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] uppercase font-bold text-slate-300">
                        {m.mode === 'VS_CPU' ? 'vs CPU' : m.mode === 'PASS_AND_PLAY' ? 'Pass & Play' : 'CPU vs CPU'}
                      </span>
                    </div>

                    {/* Match Score & Names */}
                    <div className="flex items-center justify-between gap-2 my-1">
                      <div className="truncate flex-1">
                        <div className={`text-xs font-bold truncate ${isP0Win ? 'text-amber-300' : 'text-slate-200'}`}>
                          {m.p0.name}
                        </div>
                        <div className={`text-xs font-bold truncate ${isP1Win ? 'text-sky-300' : 'text-slate-400'}`}>
                          {m.p1.name}
                        </div>
                      </div>

                      {/* Score Badge */}
                      <div className="flex flex-col items-end shrink-0 font-mono text-xs font-black tabular-nums">
                        <span className={`px-2 py-0.5 rounded ${isP0Win ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'}`}>
                          {m.p0.score}
                        </span>
                        <span className={`px-2 py-0.5 rounded mt-0.5 ${isP1Win ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400'}`}>
                          {m.p1.score}
                        </span>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 mt-2 border-t border-slate-800/80">
                      <span className="truncate max-w-[190px]">
                        🏆 Pemenang: <strong className="text-white">{m.winnerName}</strong>
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        {m.totalRounds} Ronde
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: Detailed Match Inspector */}
          {activeMatch ? (
            <div className="lg:col-span-8 space-y-6">
              {/* Match Highlight Header Card */}
              <div className="bg-[#131C31] border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
                      {activeMatch.mode === 'VS_CPU'
                        ? `VS Komputer (${activeMatch.difficulty})`
                        : activeMatch.mode === 'PASS_AND_PLAY'
                        ? 'Pass & Play (2 Pemain)'
                        : 'Simulasi CPU vs CPU'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {activeMatch.dateFormatted} · {activeMatch.totalRounds} Ronde Bertarung
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {onOpenCardTrialWithFighters && activeMatch.p0.characterPicks[0] && activeMatch.p1.characterPicks[0] && (
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playCardDeploy();
                          onOpenCardTrialWithFighters(
                            activeMatch.p0.characterPicks[0],
                            activeMatch.p1.characterPicks[0]
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sky-950/60 hover:bg-sky-900 text-sky-200 border border-sky-700/60 rounded-xl transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5 text-sky-400" />
                        <span>Uji Kartu Duel Ini</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteCurrent(activeMatch.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors border border-transparent hover:border-rose-900/40"
                      title="Hapus rekaman duel ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Fighters Confrontation Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center my-6 text-center">
                  {/* Player 0 */}
                  <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4">
                    <div className="text-[11px] font-mono text-slate-400 uppercase">Petarung 1</div>
                    <div className="text-base sm:text-lg font-bold text-white mt-0.5 truncate">
                      {activeMatch.p0.name}
                    </div>
                    <div className="text-3xl font-mono font-black text-amber-400 mt-2 tabular-nums">
                      {activeMatch.p0.score}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {activeMatch.p0.winZoneCount} Kartu Menang · {activeMatch.p0.loseZoneCardIds.length} Gugur
                    </div>
                  </div>

                  {/* VS Badge & Result */}
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 flex items-center justify-center font-black text-sm shadow-lg shadow-amber-500/20">
                      VS
                    </div>
                    <div className="pt-2 text-xs font-bold text-white">
                      {activeMatch.winnerIndex === 'DRAW' ? (
                        <span className="text-slate-300">Hasil Seri (Draw)</span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1 justify-center">
                          <Trophy className="w-3.5 h-3.5" />
                          {activeMatch.winnerName} Menang!
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 max-w-[200px] leading-tight">
                      {activeMatch.winReason}
                    </div>
                  </div>

                  {/* Player 1 */}
                  <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4">
                    <div className="text-[11px] font-mono text-slate-400 uppercase">Petarung 2</div>
                    <div className="text-base sm:text-lg font-bold text-white mt-0.5 truncate">
                      {activeMatch.p1.name}
                    </div>
                    <div className="text-3xl font-mono font-black text-sky-400 mt-2 tabular-nums">
                      {activeMatch.p1.score}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {activeMatch.p1.winZoneCount} Kartu Menang · {activeMatch.p1.loseZoneCardIds.length} Gugur
                    </div>
                  </div>
                </div>

                {/* Tactical Critique Highlights */}
                {activeMatch.tacticalAnalysis.tacticalCritique.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs space-y-1.5">
                    <div className="font-mono text-amber-300 font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>EVALUASI TAKTIK WASIT & PELATIH</span>
                    </div>
                    {activeMatch.tacticalAnalysis.tacticalCritique.map((crit, idx) => (
                      <p key={idx} className="text-slate-300 leading-relaxed pl-2 border-l-2 border-amber-400/50">
                        {crit}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* TACTICAL ANALYSIS DASHBOARD */}
              <div className="bg-[#131C31] border border-slate-800 rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Analisis Distribusi Suit Elemen</h3>
                      <p className="text-xs text-slate-400">Pola pemilihan elemen batu-gunting-kertas kedua petarung</p>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Total Benturan: {activeMatch.tacticalAnalysis.suitWinsP0 + activeMatch.tacticalAnalysis.suitWinsP1 + activeMatch.tacticalAnalysis.suitDraws}x
                  </div>
                </div>

                {/* Suit Win Rates & Elemental Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* P0 Suit Stats */}
                  <div className="bg-[#0B1120] border border-slate-800/90 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                      <span>{activeMatch.p0.name}</span>
                      <span className="font-mono text-amber-400">{activeMatch.tacticalAnalysis.p0WinRateSuitPct}% Menang Suit</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {([SuitElement.AIR, SuitElement.API, SuitElement.DAUN] as const).map((el) => (
                        <div key={el} className={`p-2 rounded-xl border ${SUIT_ELEMENT_LABELS[el].bg}`}>
                          <div className="text-base">{SUIT_ELEMENT_LABELS[el].icon}</div>
                          <div className={`font-mono font-bold mt-1 ${SUIT_ELEMENT_LABELS[el].color}`}>
                            {activeMatch.tacticalAnalysis.p0SuitStats[el]}x
                          </div>
                          <div className="text-[10px] text-slate-400">{SUIT_ELEMENT_LABELS[el].name.split('/')[0]}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* P1 Suit Stats */}
                  <div className="bg-[#0B1120] border border-slate-800/90 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                      <span>{activeMatch.p1.name}</span>
                      <span className="font-mono text-sky-400">{activeMatch.tacticalAnalysis.p1WinRateSuitPct}% Menang Suit</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {([SuitElement.AIR, SuitElement.API, SuitElement.DAUN] as const).map((el) => (
                        <div key={el} className={`p-2 rounded-xl border ${SUIT_ELEMENT_LABELS[el].bg}`}>
                          <div className="text-base">{SUIT_ELEMENT_LABELS[el].icon}</div>
                          <div className={`font-mono font-bold mt-1 ${SUIT_ELEMENT_LABELS[el].color}`}>
                            {activeMatch.tacticalAnalysis.p1SuitStats[el]}x
                          </div>
                          <div className="text-[10px] text-slate-400">{SUIT_ELEMENT_LABELS[el].name.split('/')[0]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Key Turning Points */}
                {activeMatch.tacticalAnalysis.keyTurningPoints.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wide">
                      Momen Kritis & Titik Balik Pertandingan
                    </div>
                    <div className="space-y-2">
                      {activeMatch.tacticalAnalysis.keyTurningPoints.map((tp, idx) => (
                        <div
                          key={idx}
                          className="bg-[#0B1120] border border-slate-800/90 rounded-xl p-3 flex items-start gap-3 text-xs"
                        >
                          <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-amber-400 font-bold shrink-0">
                            R{tp.round}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-200">{tp.title}</div>
                            <div className="text-slate-400 mt-0.5 text-[11px] leading-relaxed">{tp.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ROUND-BY-ROUND TACTICAL TIMELINE */}
              <div className="bg-[#131C31] border border-slate-800 rounded-3xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Tinjauan Kartu per Ronde</h3>
                    <p className="text-xs text-slate-400">Pilihan karakter, adu suit, dan intervensi bantuan di setiap ronde</p>
                  </div>

                  {/* Round Stepper Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                    {activeMatch.roundHistory.map((rec) => (
                      <button
                        key={rec.round}
                        type="button"
                        onClick={() => {
                          soundFx.playCardSelect();
                          setSelectedRoundTab(rec.round);
                          setLogFilterRound(rec.round);
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors font-mono tabular-nums ${
                          selectedRoundTab === rec.round
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        R{rec.round}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Round Detail View */}
                {activeRoundRecord && (
                  <div className="space-y-4">
                    <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400">
                            Ronde {activeRoundRecord.round}
                          </span>
                          <span className="text-xs text-slate-300">
                            Pemenang Ronde:{' '}
                            <strong className="text-white">
                              {activeRoundRecord.winner === 0
                                ? activeMatch.p0.name
                                : activeRoundRecord.winner === 1
                                ? activeMatch.p1.name
                                : 'Seri'}
                            </strong>
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {activeRoundRecord.suitClashes}x Benturan Suit
                        </span>
                      </div>

                      {/* Side by side deployed characters */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* P0 Fighter */}
                        {(() => {
                          const def0 = CARD_BY_ID[activeRoundRecord.p0CardId];
                          return (
                            <div className="p-3 bg-[#131C31] border border-slate-800 rounded-xl flex items-center gap-3">
                              {def0 ? (
                                <CardVisual
                                  card={def0}
                                  size="xs"
                                  onClick={() => onInspectCard(def0)}
                                  onInspect={onInspectCard}
                                />
                              ) : (
                                <div className="w-12 h-16 bg-slate-800 rounded flex items-center justify-center text-[10px]">
                                  Kartu
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-mono text-amber-400">{activeMatch.p0.name}</div>
                                <div className="text-xs font-bold text-white truncate">{def0?.name ?? 'Karakter'}</div>
                                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                  HP {def0?.hp ?? '-'} · ATK {def0?.atk ?? '-'}
                                </div>
                                {activeRoundRecord.lastP0Suit && (
                                  <div className="text-[10px] text-slate-300 mt-1 flex items-center gap-1">
                                    Suit:{' '}
                                    <span className="font-bold text-amber-300">
                                      {SUIT_ELEMENT_LABELS[activeRoundRecord.lastP0Suit].icon}{' '}
                                      {SUIT_ELEMENT_LABELS[activeRoundRecord.lastP0Suit].name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* P1 Fighter */}
                        {(() => {
                          const def1 = CARD_BY_ID[activeRoundRecord.p1CardId];
                          return (
                            <div className="p-3 bg-[#131C31] border border-slate-800 rounded-xl flex items-center gap-3">
                              {def1 ? (
                                <CardVisual
                                  card={def1}
                                  size="xs"
                                  onClick={() => onInspectCard(def1)}
                                  onInspect={onInspectCard}
                                />
                              ) : (
                                <div className="w-12 h-16 bg-slate-800 rounded flex items-center justify-center text-[10px]">
                                  Kartu
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-mono text-sky-400">{activeMatch.p1.name}</div>
                                <div className="text-xs font-bold text-white truncate">{def1?.name ?? 'Karakter'}</div>
                                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                  HP {def1?.hp ?? '-'} · ATK {def1?.atk ?? '-'}
                                </div>
                                {activeRoundRecord.lastP1Suit && (
                                  <div className="text-[10px] text-slate-300 mt-1 flex items-center gap-1">
                                    Suit:{' '}
                                    <span className="font-bold text-sky-300">
                                      {SUIT_ELEMENT_LABELS[activeRoundRecord.lastP1Suit].icon}{' '}
                                      {SUIT_ELEMENT_LABELS[activeRoundRecord.lastP1Suit].name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Support Cards Played in this round */}
                      {(activeRoundRecord.p0Supports.length > 0 || activeRoundRecord.p1Supports.length > 0) && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
                          <span className="text-[10px] font-mono text-slate-400 block mb-1">
                            Bantuan yang Digunakan:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {activeRoundRecord.p0Supports.map((id) => {
                              const sDef = CARD_BY_ID[id];
                              return (
                                <span
                                  key={id}
                                  onClick={() => sDef && onInspectCard(sDef)}
                                  className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-[11px] text-amber-300 cursor-pointer hover:bg-amber-500/20"
                                >
                                  {activeMatch.p0.name}: {sDef?.name ?? id}
                                </span>
                              );
                            })}
                            {activeRoundRecord.p1Supports.map((id) => {
                              const sDef = CARD_BY_ID[id];
                              return (
                                <span
                                  key={id}
                                  onClick={() => sDef && onInspectCard(sDef)}
                                  className="px-2 py-0.5 bg-sky-500/10 border border-sky-500/30 rounded text-[11px] text-sky-300 cursor-pointer hover:bg-sky-500/20"
                                >
                                  {activeMatch.p1.name}: {sDef?.name ?? id}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Summary Text */}
                      <p className="mt-3 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                        {activeRoundRecord.summary}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* TURN-BY-TURN STEP LOGS */}
              <div className="bg-[#131C31] border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Log Langkah demi Langkah</h3>
                    <p className="text-xs text-slate-400">Catatan taktis detail seluruh aksi, benturan suit, dan damage</p>
                  </div>

                  {/* Filter Log Bar */}
                  <div className="flex items-center gap-2 text-xs">
                    <select
                      value={logFilterRound}
                      onChange={(e) => setLogFilterRound(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                      className="bg-[#0B1120] border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="ALL">Semua Ronde</option>
                      {activeMatch.roundHistory.map((r) => (
                        <option key={r.round} value={r.round}>
                          Ronde {r.round}
                        </option>
                      ))}
                    </select>

                    <select
                      value={logToneFilter}
                      onChange={(e) => setLogToneFilter(e.target.value)}
                      className="bg-[#0B1120] border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="ALL">Semua Kejadian</option>
                      <option value="highlight">Sorotan Utama</option>
                      <option value="p1">Aksi {activeMatch.p0.name}</option>
                      <option value="p2">Aksi {activeMatch.p1.name}</option>
                      <option value="warning">Peringatan</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4 max-h-72 overflow-y-auto space-y-2 text-xs pr-2 font-mono">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">Tidak ada log untuk filter ini.</div>
                  ) : (
                    filteredLogs.map((log) => (
                      <div key={log.id} className="flex items-baseline gap-2 leading-relaxed">
                        <span className="text-slate-500 text-[10px] tabular-nums shrink-0">
                          [R{log.round}]
                        </span>
                        <span
                          className={
                            log.tone === 'highlight'
                              ? 'text-amber-300 font-semibold'
                              : log.tone === 'p1'
                              ? 'text-emerald-300'
                              : log.tone === 'p2'
                              ? 'text-sky-300'
                              : log.tone === 'warning'
                              ? 'text-rose-300 font-bold'
                              : 'text-slate-300'
                          }
                        >
                          {log.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-8 bg-[#131C31] border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs">
              Pilih salah satu pertandingan dari daftar sebelah kiri untuk melihat rekaman lengkap.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
