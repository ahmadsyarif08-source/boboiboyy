import { CARD_BY_ID } from '../data/cards';
import type { FullBattleState } from '../engine/battleEngine';
import {
  CardCategory,
  SuitElement,
  type BattleLogEntry,
  type CpuDifficulty,
  type GameMode,
  type RoundRecord,
  type SupportComboEvent,
} from '../types/game';

export const BATTLE_HISTORY_STORAGE_KEY = 'mgc_battle_history_v1';
const MAX_SAVED_MATCHES = 60;

export interface TacticalTurningPoint {
  round: number;
  title: string;
  description: string;
  tone: 'highlight' | 'p1' | 'p2' | 'warning';
}

export interface TacticalAnalysis {
  p0SuitStats: Record<SuitElement, number>;
  p1SuitStats: Record<SuitElement, number>;
  suitWinsP0: number;
  suitWinsP1: number;
  suitDraws: number;
  p0WinRateSuitPct: number;
  p1WinRateSuitPct: number;
  p0SupportsTriggered: number;
  p1SupportsTriggered: number;
  p0CombosCount: number;
  p1CombosCount: number;
  keyTurningPoints: TacticalTurningPoint[];
  tacticalCritique: string[];
}

export interface SavedBattleMatchRecord {
  id: string;
  matchId: string;
  timestamp: number;
  dateFormatted: string;
  mode: GameMode;
  difficulty: CpuDifficulty;
  targetWins: number;
  maxRounds: number | null;
  totalRounds: number;
  winnerIndex: 0 | 1 | 'DRAW';
  winnerName: string;
  winReason: string;
  p0: {
    name: string;
    isCpu: boolean;
    score: number;
    winZoneCount: number;
    winZoneCardIds: string[];
    loseZoneCardIds: string[];
    deckCardIds: string[];
    characterPicks: string[];
  };
  p1: {
    name: string;
    isCpu: boolean;
    score: number;
    winZoneCount: number;
    winZoneCardIds: string[];
    loseZoneCardIds: string[];
    deckCardIds: string[];
    characterPicks: string[];
  };
  roundHistory: RoundRecord[];
  logs: BattleLogEntry[];
  comboHistory: SupportComboEvent[];
  tacticalAnalysis: TacticalAnalysis;
}

function formatDate(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function generateTacticalAnalysis(battle: FullBattleState): TacticalAnalysis {
  const p0SuitStats: Record<SuitElement, number> = {
    [SuitElement.AIR]: 0,
    [SuitElement.API]: 0,
    [SuitElement.DAUN]: 0,
  };
  const p1SuitStats: Record<SuitElement, number> = {
    [SuitElement.AIR]: 0,
    [SuitElement.API]: 0,
    [SuitElement.DAUN]: 0,
  };

  let suitWinsP0 = 0;
  let suitWinsP1 = 0;
  let suitDraws = 0;

  for (const rec of battle.roundHistory) {
    if (rec.lastP0Suit && p0SuitStats[rec.lastP0Suit] !== undefined) {
      p0SuitStats[rec.lastP0Suit]++;
    }
    if (rec.lastP1Suit && p1SuitStats[rec.lastP1Suit] !== undefined) {
      p1SuitStats[rec.lastP1Suit]++;
    }
    if (rec.lastP0Suit && rec.lastP1Suit) {
      if (rec.lastP0Suit === rec.lastP1Suit) {
        suitDraws++;
      } else if (
        (rec.lastP0Suit === SuitElement.AIR && rec.lastP1Suit === SuitElement.API) ||
        (rec.lastP0Suit === SuitElement.API && rec.lastP1Suit === SuitElement.DAUN) ||
        (rec.lastP0Suit === SuitElement.DAUN && rec.lastP1Suit === SuitElement.AIR)
      ) {
        suitWinsP0++;
      } else {
        suitWinsP1++;
      }
    }
  }

  const totalClashes = suitWinsP0 + suitWinsP1 + suitDraws;
  const p0WinRateSuitPct = totalClashes > 0 ? Math.round((suitWinsP0 / totalClashes) * 100) : 0;
  const p1WinRateSuitPct = totalClashes > 0 ? Math.round((suitWinsP1 / totalClashes) * 100) : 0;

  let p0SupportsTriggered = 0;
  let p1SupportsTriggered = 0;
  for (const rec of battle.roundHistory) {
    p0SupportsTriggered += rec.p0Supports.length;
    p1SupportsTriggered += rec.p1Supports.length;
  }

  const p0CombosCount = (battle.comboHistory ?? []).filter((c) => c.playerIndex === 0).length;
  const p1CombosCount = (battle.comboHistory ?? []).filter((c) => c.playerIndex === 1).length;

  const keyTurningPoints: TacticalTurningPoint[] = [];

  // Extract dramatic moments from round history & logs
  for (const rec of battle.roundHistory) {
    const c0 = CARD_BY_ID[rec.p0CardId];
    const c1 = CARD_BY_ID[rec.p1CardId];
    if (rec.p0Supports.length > 0 || rec.p1Supports.length > 0) {
      const supNames = [
        ...rec.p0Supports.map((id) => CARD_BY_ID[id]?.name ?? id),
        ...rec.p1Supports.map((id) => CARD_BY_ID[id]?.name ?? id),
      ];
      keyTurningPoints.push({
        round: rec.round,
        title: `Ronde ${rec.round}: Intervensi Kartu Pendukung`,
        description: `Dukungan taktis diaktifkan (${supNames.join(', ')}). ${rec.summary}`,
        tone: rec.winner === 0 ? 'p1' : rec.winner === 1 ? 'p2' : 'highlight',
      });
    } else if (rec.suitClashes > 1) {
      keyTurningPoints.push({
        round: rec.round,
        title: `Ronde ${rec.round}: Duel Elemen Alot (${rec.suitClashes}x Suit)`,
        description: `Terjadi seri berturut-turut sebelum akhirnya dimenangkan oleh ${
          rec.winner === 0
            ? battle.players[0].name
            : rec.winner === 1
            ? battle.players[1].name
            : 'Seri'
        }.`,
        tone: 'warning',
      });
    } else if (c0?.rank === 'SR' || c1?.rank === 'SR' || c0?.rank === 'AR' || c1?.rank === 'AR') {
      const aceName = c0?.rank === 'SR' || c0?.rank === 'AR' ? c0.name : c1?.name;
      keyTurningPoints.push({
        round: rec.round,
        title: `Ronde ${rec.round}: Pengerahan Kartu Legendaris (${aceName})`,
        description: `${aceName} turun ke medan tempur dengan statistik tinggi dan efek khusus.`,
        tone: 'highlight',
      });
    }
  }

  if (keyTurningPoints.length === 0 && battle.roundHistory.length > 0) {
    const first = battle.roundHistory[0];
    keyTurningPoints.push({
      round: 1,
      title: 'Ronde 1: Benturan Awal Karakter',
      description: first.summary,
      tone: first.winner === 0 ? 'p1' : first.winner === 1 ? 'p2' : 'highlight',
    });
  }

  const tacticalCritique: string[] = [];
  const p0Name = battle.players[0].name;
  const p1Name = battle.players[1].name;

  if (p0WinRateSuitPct >= 65) {
    tacticalCritique.push(
      `Adu suit ${p0Name} sangat dominan (${p0WinRateSuitPct}% kemenangan suit), memegang kendali inisiatif serangan di sebagian besar benturan.`
    );
  } else if (p1WinRateSuitPct >= 65) {
    tacticalCritique.push(
      `Adu suit ${p1Name} mendominasi dengan tingkat kemenangan ${p1WinRateSuitPct}%. Pemilihan elemen lawan sulit diprediksi.`
    );
  } else {
    tacticalCritique.push(
      `Pertarungan suit sangat seimbang (${suitWinsP0} menang vs ${suitWinsP1} menang, ${suitDraws} seri). Pertandingan ditentukan oleh sinergi efek dan ATK.`
    );
  }

  if (p0SupportsTriggered > 0 || p1SupportsTriggered > 0) {
    tacticalCritique.push(
      `Kartu Pendukung terbukti krusial: ${p0Name} memainkan ${p0SupportsTriggered} kartu bantuan, sedangkan ${p1Name} memainkan ${p1SupportsTriggered} kartu bantuan.`
    );
  } else {
    tacticalCritique.push(
      'Kedua pemain bertarung murni mengandalkan Karakter tanpa Kartu Pendukung. Menambahkan kartu bantuan dapat meningkatkan peluang menang saat adu ATK.'
    );
  }

  if (battle.winnerIndex === 0) {
    tacticalCritique.push(
      `${p0Name} berhasil mengeksekusi strategi kemenangan dengan mengamankan ${battle.players[0].winZone.length} kemenangan ronde.`
    );
  } else if (battle.winnerIndex === 1) {
    tacticalCritique.push(
      `${p1Name} keluar sebagai pemenang dengan ${battle.players[1].winZone.length} kemenangan ronde.`
    );
  } else {
    tacticalCritique.push(
      'Duel berakhir imbang! Keduanya menunjukkan pertahanan kokoh dan keseimbangan kartu yang solid.'
    );
  }

  return {
    p0SuitStats,
    p1SuitStats,
    suitWinsP0,
    suitWinsP1,
    suitDraws,
    p0WinRateSuitPct,
    p1WinRateSuitPct,
    p0SupportsTriggered,
    p1SupportsTriggered,
    p0CombosCount,
    p1CombosCount,
    keyTurningPoints,
    tacticalCritique,
  };
}

export function loadBattleHistory(): SavedBattleMatchRecord[] {
  try {
    const raw = localStorage.getItem(BATTLE_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to load battle history:', err);
  }
  return [];
}

export function saveBattleMatch(battle: FullBattleState): SavedBattleMatchRecord | null {
  if (battle.phase !== 'GAME_OVER') return null;

  const p0 = battle.players[0];
  const p1 = battle.players[1];
  const winnerIdx = battle.winnerIndex ?? 'DRAW';
  const winnerName =
    winnerIdx === 0 ? p0.name : winnerIdx === 1 ? p1.name : 'Seri (Draw)';

  const matchId = battle.matchId || `battle-${Date.now()}`;
  const now = Date.now();

  const record: SavedBattleMatchRecord = {
    id: `rec-${now}-${Math.random().toString(36).slice(2, 6)}`,
    matchId,
    timestamp: now,
    dateFormatted: formatDate(now),
    mode: battle.mode,
    difficulty: battle.difficulty,
    targetWins: battle.targetWins,
    maxRounds: battle.maxRounds,
    totalRounds: battle.roundHistory.length > 0 ? battle.roundHistory.length : battle.round,
    winnerIndex: winnerIdx,
    winnerName,
    winReason: battle.winReason || 'Pertarungan telah usai.',
    p0: {
      name: p0.name,
      isCpu: p0.isCpu,
      score: p0.winZone.length,
      winZoneCount: p0.winZone.length,
      winZoneCardIds: p0.winZone.map((c) => c.defId),
      loseZoneCardIds: p0.loseZone.map((c) => c.defId),
      deckCardIds: [
        ...p0.winZone.map((c) => c.defId),
        ...p0.loseZone.map((c) => c.defId),
        ...p0.hand.map((c) => c.defId),
        ...p0.deck.map((c) => c.defId),
      ],
      characterPicks: battle.roundHistory.map((r) => r.p0CardId).filter(Boolean),
    },
    p1: {
      name: p1.name,
      isCpu: p1.isCpu,
      score: p1.winZone.length,
      winZoneCount: p1.winZone.length,
      winZoneCardIds: p1.winZone.map((c) => c.defId),
      loseZoneCardIds: p1.loseZone.map((c) => c.defId),
      deckCardIds: [
        ...p1.winZone.map((c) => c.defId),
        ...p1.loseZone.map((c) => c.defId),
        ...p1.hand.map((c) => c.defId),
        ...p1.deck.map((c) => c.defId),
      ],
      characterPicks: battle.roundHistory.map((r) => r.p1CardId).filter(Boolean),
    },
    roundHistory: [...battle.roundHistory],
    logs: [...battle.logs],
    comboHistory: [...(battle.comboHistory ?? [])],
    tacticalAnalysis: generateTacticalAnalysis(battle),
  };

  try {
    const existing = loadBattleHistory();
    // Prevent duplicate matches with exact same matchId within 5 seconds
    if (existing.some((m) => m.matchId === matchId && Math.abs(m.timestamp - now) < 5000)) {
      return record;
    }
    const updated = [record, ...existing].slice(0, MAX_SAVED_MATCHES);
    localStorage.setItem(BATTLE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save battle match to storage:', err);
  }

  return record;
}

export function deleteBattleMatch(id: string): void {
  try {
    const existing = loadBattleHistory();
    const filtered = existing.filter((m) => m.id !== id);
    localStorage.setItem(BATTLE_HISTORY_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete battle match:', err);
  }
}

export function clearAllBattleHistory(): void {
  try {
    localStorage.removeItem(BATTLE_HISTORY_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear battle history:', err);
  }
}

export function exportBattleHistoryJson(): string {
  const history = loadBattleHistory();
  return JSON.stringify(history, null, 2);
}

export function importBattleHistoryJson(jsonStr: string): {
  success: boolean;
  count: number;
  message: string;
} {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      return { success: false, count: 0, message: 'Format data JSON riwayat tidak valid.' };
    }
    const validItems: SavedBattleMatchRecord[] = parsed.filter(
      (item) => item && typeof item.id === 'string' && Array.isArray(item.logs)
    );
    if (validItems.length === 0) {
      return { success: false, count: 0, message: 'Tidak ada rekaman pertandingan valid dalam berkas.' };
    }
    const existing = loadBattleHistory();
    const existingIds = new Set(existing.map((m) => m.id));
    const merged = [...validItems.filter((item) => !existingIds.has(item.id)), ...existing].slice(
      0,
      MAX_SAVED_MATCHES
    );
    localStorage.setItem(BATTLE_HISTORY_STORAGE_KEY, JSON.stringify(merged));
    return {
      success: true,
      count: validItems.length,
      message: `Berhasil mengimpor ${validItems.length} rekaman riwayat duel!`,
    };
  } catch (err) {
    return {
      success: false,
      count: 0,
      message: `Gagal membaca berkas JSON: ${err instanceof Error ? err.message : 'Kesalahan parsing'}`,
    };
  }
}
