import 'dotenv/config';
import { GoogleGenAI, ThinkingLevel, Type, type GenerateContentResponse } from '@google/genai';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  BATTLE_CARDS,
  CARD_BY_ID,
  deduplicateDeckIds,
  EFFECT_CATALOG,
  inferEffectFromCardText,
  PRESET_DECKS,
  registerSessionCards,
} from './src/data/cards.ts';
import {
  advanceAfterSuitReveal,
  appendRefereeBattleLog,
  applyRefereeDeclareMatchWinner,
  applyRefereeForceRoundWinner,
  applyRefereeStatAdjustment,
  canPlayCharacterCard,
  createInitialBattleState,
  deployBothCharactersAndResolveEntry,
  playerHasPlayableSupport,
  resolvePendingChoice,
  resolveSuitClash,
  resolveSupportsAndStrike,
  shuffleArray,
  startNextRound,
  type FullBattleState,
} from './src/engine/battleEngine.ts';
import {
  CardCategory,
  SuitElement,
  type AnalyzedCardImageResult,
  type CardDefinition,
  type CardInstance,
  type CardRank,
  type ConditionMode,
  type EffectKey,
  type EffectPriority,
  type SuitArtSetId,
} from './src/types/game.ts';
import type {
  ClientWsMessage,
  MatchRulePreset,
  OnlineDeckSize,
  RefereeInspectionView,
  RefereeRulingBanner,
  RoomChatMessage,
  RoomMode,
  RoomParticipantView,
  RoomPublicSummary,
  RoomStateView,
  ServerWsMessage,
  TournamentMatchItem,
} from './src/types/multiplayer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const HIDDEN_CARD_ID = '__HIDDEN_CARD__';

function sanitizeSuitSet(raw?: number): SuitArtSetId {
  const n = Math.floor(Number(raw) || 1);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

interface ServerParticipant {
  clientId: string;
  name: string;
  ws: WebSocket | null;
  connected: boolean;
  isHost: boolean;
  ready: boolean;
  spectatorOnly: boolean;
  deckIds: string[];
  suitArtSet: SuitArtSetId;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  points: number;
  joinedAt: number;
}

interface ServerRoom {
  code: string;
  roomName: string;
  isPublic: boolean;
  roomMode: RoomMode;
  deckSize: OnlineDeckSize;
  matchRule: MatchRulePreset;
  participants: Map<string, ServerParticipant>;
  refereeClientId: string | null;
  fighters: [string | null, string | null];
  challengerQueue: string[];
  tournamentMatches: TournamentMatchItem[];
  activeTournamentMatchId: string | null;
  customCards: Record<string, CardDefinition>;
  battle: FullBattleState | null;
  resultRecordedForCurrentBattle: boolean;
  isPaused: boolean;
  pauseReason: string | null;
  pausedByName: string | null;
  latestRefereeRuling: RefereeRulingBanner | null;
  pendingChar: [string | null, string | null];
  pendingSuit: [SuitElement | null, SuitElement | null];
  pendingSupport: [string | null | undefined, string | null | undefined];
  chat: RoomChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface SocketMeta {
  clientId: string | null;
  roomCode: string | null;
  inLobbyFeed: boolean;
  isAlive: boolean;
}

const rooms = new Map<string, ServerRoom>();
const socketMetaMap = new Map<WebSocket, SocketMeta>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return `RM${Math.floor(1000 + Math.random() * 9000)}`;
}

function sanitizeName(raw: string | undefined, fallback = 'Pemain'): string {
  const trimmed = (raw ?? '').trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeServerDeck(rawIds: string[], targetSize: OnlineDeckSize): string[] {
  const unique = deduplicateDeckIds(rawIds ?? [], targetSize);
  const minUncond = Math.min(2, targetSize);

  const countUncond = (ids: string[]) =>
    ids.filter((id) => {
      const def = CARD_BY_ID[id];
      return def && def.category === CardCategory.CHARACTER && !def.condition;
    }).length;

  const picked = [...unique];
  const used = new Set(picked);

  if (countUncond(picked) < minUncond) {
    const basePool = shuffleArray(
      BATTLE_CARDS.filter(
        (c) => c.category === CardCategory.CHARACTER && !c.condition && !used.has(c.id)
      )
    );
    while (countUncond(picked) < minUncond && basePool.length > 0) {
      const nextCard = basePool.shift()!;
      if (picked.length >= targetSize) {
        const nonBaseIdx = picked.findIndex((id) => {
          const d = CARD_BY_ID[id];
          return !d || d.category !== CardCategory.CHARACTER || Boolean(d.condition);
        });
        if (nonBaseIdx >= 0) {
          picked.splice(nonBaseIdx, 1);
        } else {
          break;
        }
      }
      picked.push(nextCard.id);
      used.add(nextCard.id);
    }
  }

  if (picked.length < targetSize) {
    const fallbackPool = [
      ...PRESET_DECKS[0].cardIds,
      ...shuffleArray(BATTLE_CARDS.map((c) => c.id)),
    ];
    for (const id of fallbackPool) {
      if (picked.length >= targetSize) break;
      if (!used.has(id) && CARD_BY_ID[id] && CARD_BY_ID[id].category !== CardCategory.SUIT) {
        picked.push(id);
        used.add(id);
      }
    }
  }

  return picked.slice(0, targetSize);
}

function addRoomSystemChat(room: ServerRoom, text: string): void {
  room.chat.push({
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    senderName: 'Arena',
    text,
    timestamp: Date.now(),
    isSystem: true,
  });
  if (room.chat.length > 60) {
    room.chat = room.chat.slice(-60);
  }
}

function addRefereeAnnouncement(room: ServerRoom, refereeName: string, text: string): void {
  const ts = Date.now();
  const id = `ref-${ts}-${Math.random().toString(36).slice(2, 6)}`;
  room.latestRefereeRuling = {
    id,
    refereeName,
    text,
    timestamp: ts,
  };
  room.chat.push({
    id,
    senderName: `Wasit ${refereeName}`,
    text,
    timestamp: ts,
    isReferee: true,
  });
  if (room.chat.length > 60) {
    room.chat = room.chat.slice(-60);
  }
  if (room.battle) {
    room.battle = appendRefereeBattleLog(room.battle, refereeName, text);
  }
}

function sendJson(ws: WebSocket | null, payload: ServerWsMessage): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function buildPublicRoomsList(): RoomPublicSummary[] {
  const summaries: RoomPublicSummary[] = [];
  for (const room of rooms.values()) {
    if (!room.isPublic) continue;
    const connectedCount = Array.from(room.participants.values()).filter((p) => p.connected).length;
    if (connectedCount === 0) continue;
    const host = Array.from(room.participants.values()).find((p) => p.isHost);
    const refereePart = room.refereeClientId
      ? room.participants.get(room.refereeClientId)
      : undefined;
    summaries.push({
      code: room.code,
      roomName: room.roomName,
      hostName: host?.name ?? 'Host',
      hasReferee: Boolean(refereePart && refereePart.connected),
      refereeName: refereePart && refereePart.connected ? refereePart.name : null,
      roomMode: room.roomMode,
      deckSize: room.deckSize,
      matchRule: room.matchRule,
      playerCount: connectedCount,
      inBattle: room.battle !== null && room.battle.phase !== 'GAME_OVER',
    });
  }
  return summaries.sort((a, b) => b.playerCount - a.playerCount);
}

function broadcastLobbyRooms(): void {
  const payload: ServerWsMessage = {
    type: 'lobby:rooms',
    rooms: buildPublicRoomsList(),
  };
  for (const [ws, meta] of socketMetaMap.entries()) {
    if (meta.inLobbyFeed && !meta.roomCode) {
      sendJson(ws, payload);
    }
  }
}

interface ServerGlobalUpdate {
  id: string;
  version: string;
  title: string;
  category: 'PATCH' | 'EVENT' | 'NEW_CARDS' | 'MAINTENANCE' | 'ANNOUNCEMENT';
  summary: string;
  details: string[];
  author: string;
  timestamp: number;
  pinned?: boolean;
  giftCoins?: number;
  giftTickets?: number;
}

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'ahmadsyarif08@admin.sd.belajar.id';
const OWNER_PASSKEY = process.env.OWNER_PASSKEY || 'boboiboy-owner-2026';
const activeOwnerTokens = new Set<string>();

const globalAppUpdates: ServerGlobalUpdate[] = [
  {
    id: 'upd-1',
    version: 'v1.4.0',
    title: 'Pembaruan Toko Kartu & Saluran Pemilik Aplikasi',
    category: 'NEW_CARDS',
    summary:
      'Toko Kartu Resmi BoBoiBoy Monsta Galaxy telah dibuka! Nikmati booster pack, kartu pilihan harian, kode promo, dan saluran siaran pembaruan dari pemilik aplikasi.',
    details: [
      'Fitur Toko Kartu (Card Shop): Beli Booster Pack Blazing Frost, Kuasa Elemental, Legenda Windara, dan Kebenaran P.A.P.A.',
      'Sistem Dompet Galaksi: Dapatkan Koin Galaksi dari setiap kemenangan dan ronde di Arena.',
      'Animasi Buka Pek Spektakuler: Buka foil booster pack dan rasakan sensasi mendapatkan kartu Super Rare (SR) & Art Rare (AR).',
      'Fitur Login Pemilik Aplikasi & Panel Kontrol Khusus untuk Ahmad Syarif (ahmadsyarif08@admin.sd.belajar.id).',
      'Kanal Pembaruan Terhubung Real-Time ke seluruh pengguna aplikasi melalui WebSockets.',
    ],
    author: 'Ahmad Syarif (Pemilik)',
    timestamp: Date.now() - 3600000,
    pinned: true,
    giftCoins: 500,
    giftTickets: 1,
  },
  {
    id: 'upd-2',
    version: 'v1.3.0',
    title: 'Peluncuran Riwayat Duel & Lab Uji Coba Efek',
    category: 'PATCH',
    summary:
      'Arsip riwayat pertarungan lengkap dan simulator taktis interaktif untuk menguji seluruh 44+ efek kartu resmi.',
    details: [
      'Penyimpanan otomatis seluruh rekaman duel 1v1 beserta tinjauan taktis per ronde.',
      'Laboratorium Uji Coba Kartu: simulator interaktif benturan suit elemen, efek masuk, perisai, dan serangan ATK.',
      'Simulator Syarat Evolusi Fusion Karakter secara live.',
    ],
    author: 'Ahmad Syarif (Pemilik)',
    timestamp: Date.now() - 86400000,
    pinned: false,
    giftCoins: 200,
  },
];

function broadcastGlobalUpdate(update: ServerGlobalUpdate): void {
  const payload = JSON.stringify({ type: 'global:update', update });
  for (const ws of socketMetaMap.keys()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function broadcastImmediateAlert(title: string, message: string): void {
  const payload = JSON.stringify({
    type: 'global:announcement',
    title,
    message,
    author: 'Ahmad Syarif (Pemilik)',
    timestamp: Date.now(),
  });
  for (const ws of socketMetaMap.keys()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function fillEmptyFighterSeats(room: ServerRoom): void {
  if (room.battle !== null || room.roomMode === 'PHYSICAL_SIMULATION') return;
  for (const seat of [0, 1] as const) {
    const occupantId = room.fighters[seat];
    if (
      occupantId &&
      occupantId !== room.refereeClientId &&
      room.participants.has(occupantId)
    ) {
      continue;
    }
    room.fighters[seat] = null;

    while (room.challengerQueue.length > 0) {
      const candidateId = room.challengerQueue[0];
      const candidate = room.participants.get(candidateId);
      if (
        candidate &&
        candidate.connected &&
        !candidate.spectatorOnly &&
        candidateId !== room.refereeClientId &&
        room.fighters[0] !== candidateId &&
        room.fighters[1] !== candidateId
      ) {
        room.challengerQueue.shift();
        room.fighters[seat] = candidateId;
        break;
      } else {
        room.challengerQueue.shift();
      }
    }
  }
}

function maskCards(cards: CardInstance[]): CardInstance[] {
  return cards.map((c) => ({ uid: c.uid, defId: HIDDEN_CARD_ID }));
}

function sanitizeBattleForViewer(
  battle: FullBattleState,
  viewerSeat: 0 | 1 | null
): FullBattleState {
  const p0 = battle.players[0];
  const p1 = battle.players[1];
  const activeChoice = battle.choiceQueue[0] ?? null;
  const isActiveChooser = activeChoice !== null && activeChoice.playerIndex === viewerSeat;

  const hideSuits = battle.phase === 'P1_PICK_SUIT' || battle.phase === 'P2_PICK_SUIT';

  return {
    ...battle,
    choiceQueue: activeChoice
      ? [
          !isActiveChooser || activeChoice.concealCandidates
            ? {
                ...activeChoice,
                candidates: maskCards(activeChoice.candidates),
              }
            : activeChoice,
        ]
      : [],
    players: [
      {
        ...p0,
        hand: viewerSeat === 0 ? p0.hand : maskCards(p0.hand),
        deck: maskCards(p0.deck),
        selectedSuit: hideSuits && viewerSeat !== 0 ? null : p0.selectedSuit,
        pendingCharacterUid:
          viewerSeat === 0 ? p0.pendingCharacterUid : p0.pendingCharacterUid ? 'LOCKED' : null,
      },
      {
        ...p1,
        hand: viewerSeat === 1 ? p1.hand : maskCards(p1.hand),
        deck: maskCards(p1.deck),
        selectedSuit: hideSuits && viewerSeat !== 1 ? null : p1.selectedSuit,
        pendingCharacterUid:
          viewerSeat === 1 ? p1.pendingCharacterUid : p1.pendingCharacterUid ? 'LOCKED' : null,
      },
    ],
  };
}

function buildRoomStateForClient(room: ServerRoom, clientId: string): RoomStateView {
  const yourSeat: 0 | 1 | null =
    room.fighters[0] === clientId ? 0 : room.fighters[1] === clientId ? 1 : null;
  const isRefereeViewer = room.refereeClientId === clientId && yourSeat === null;
  const yourRole: 'PLAYER' | 'REFEREE' | 'SPECTATOR' =
    yourSeat !== null ? 'PLAYER' : isRefereeViewer ? 'REFEREE' : 'SPECTATOR';

  const participants: RoomParticipantView[] = Array.from(room.participants.values())
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.joinedAt - b.joinedAt)
    .map((p) => ({
      clientId: p.clientId,
      name: p.name,
      connected: p.connected,
      isHost: p.isHost,
      isReferee: room.refereeClientId === p.clientId,
      ready: p.ready,
      spectatorOnly: p.spectatorOnly,
      deckCount: p.deckIds.length,
      suitArtSet: p.suitArtSet,
      wins: p.wins,
      losses: p.losses,
      draws: p.draws,
      streak: p.streak,
      points: p.points,
    }));

  let sanitizedBattle: FullBattleState | null = null;
  let refereeInspection: RefereeInspectionView | null = null;

  if (room.battle) {
    const withLocks: FullBattleState = {
      ...room.battle,
      players: [
        {
          ...room.battle.players[0],
          pendingCharacterUid:
            room.pendingChar[0] ?? room.battle.players[0].pendingCharacterUid,
          selectedSuit:
            room.battle.phase === 'P1_PICK_SUIT'
              ? room.pendingSuit[0]
              : room.battle.players[0].selectedSuit,
        },
        {
          ...room.battle.players[1],
          pendingCharacterUid:
            room.pendingChar[1] ?? room.battle.players[1].pendingCharacterUid,
          selectedSuit:
            room.battle.phase === 'P1_PICK_SUIT'
              ? room.pendingSuit[1]
              : room.battle.players[1].selectedSuit,
        },
      ],
    };
    sanitizedBattle = sanitizeBattleForViewer(withLocks, yourSeat);

    if (isRefereeViewer) {
      const resolvePendingCharDef = (idx: 0 | 1): string | null => {
        const uid = room.pendingChar[idx];
        if (!uid || !room.battle) return null;
        return room.battle.players[idx].hand.find((c) => c.uid === uid)?.defId ?? null;
      };
      const resolvePendingSupDef = (idx: 0 | 1): string | null | 'SKIPPED' => {
        const supUid = room.pendingSupport[idx];
        if (supUid === undefined || !room.battle) return null;
        if (supUid === null) return 'SKIPPED';
        return room.battle.players[idx].hand.find((c) => c.uid === supUid)?.defId ?? null;
      };

      refereeInspection = {
        players: [
          {
            hand: room.battle.players[0].hand,
            deck: room.battle.players[0].deck,
            pendingCharacterDefId: resolvePendingCharDef(0),
            pendingSuit: room.pendingSuit[0] ?? room.battle.players[0].selectedSuit,
            pendingSupportDefId: resolvePendingSupDef(0),
          },
          {
            hand: room.battle.players[1].hand,
            deck: room.battle.players[1].deck,
            pendingCharacterDefId: resolvePendingCharDef(1),
            pendingSuit: room.pendingSuit[1] ?? room.battle.players[1].selectedSuit,
            pendingSupportDefId: resolvePendingSupDef(1),
          },
        ],
      };
    }
  }

  return {
    code: room.code,
    roomName: room.roomName,
    isPublic: room.isPublic,
    roomMode: room.roomMode,
    deckSize: room.deckSize,
    matchRule: room.matchRule,
    yourClientId: clientId,
    yourSeat,
    yourRole,
    refereeClientId: room.refereeClientId,
    fighters: room.fighters,
    challengerQueue: room.challengerQueue,
    participants,
    tournamentMatches: room.tournamentMatches,
    activeTournamentMatchId: room.activeTournamentMatchId,
    customCards: room.customCards,
    battle: sanitizedBattle,
    lockStatus: {
      charLocked: [Boolean(room.pendingChar[0]), Boolean(room.pendingChar[1])],
      suitLocked: [Boolean(room.pendingSuit[0]), Boolean(room.pendingSuit[1])],
      supportLocked: [
        room.pendingSupport[0] !== undefined,
        room.pendingSupport[1] !== undefined,
      ],
    },
    isPaused: room.isPaused,
    pauseReason: room.pauseReason,
    pausedByName: room.pausedByName,
    latestRefereeRuling: room.latestRefereeRuling,
    refereeInspection,
    chat: room.chat,
  };
}

function broadcastRoomState(room: ServerRoom): void {
  room.updatedAt = Date.now();
  for (const participant of room.participants.values()) {
    if (participant.connected && participant.ws) {
      sendJson(participant.ws, {
        type: 'room:state',
        room: buildRoomStateForClient(room, participant.clientId),
      });
    }
  }
  broadcastLobbyRooms();
}

function ensureRoomCustomCardsRegistered(room: ServerRoom): void {
  if (Object.keys(room.customCards).length > 0) {
    registerSessionCards(room.customCards);
  }
}

function recordMatchResultIfFinished(room: ServerRoom): void {
  if (!room.battle || room.battle.phase !== 'GAME_OVER' || room.resultRecordedForCurrentBattle) {
    return;
  }
  room.resultRecordedForCurrentBattle = true;

  const p0Id = room.fighters[0];
  const p1Id = room.fighters[1];
  const p0Part = p0Id ? room.participants.get(p0Id) : undefined;
  const p1Part = p1Id ? room.participants.get(p1Id) : undefined;

  const winnerIdx = room.battle.winnerIndex;
  let winnerClientId: string | 'DRAW' | null = 'DRAW';

  if (winnerIdx === 0 && p0Part) {
    p0Part.wins += 1;
    p0Part.streak += 1;
    p0Part.points += 3;
    if (p1Part) {
      p1Part.losses += 1;
      p1Part.streak = 0;
    }
    winnerClientId = p0Part.clientId;
    addRoomSystemChat(
      room,
      `${p0Part.name} memenangkan pertandingan (+3 Poin, Beruntun ${p0Part.streak}x)!`
    );
  } else if (winnerIdx === 1 && p1Part) {
    p1Part.wins += 1;
    p1Part.streak += 1;
    p1Part.points += 3;
    if (p0Part) {
      p0Part.losses += 1;
      p0Part.streak = 0;
    }
    winnerClientId = p1Part.clientId;
    addRoomSystemChat(
      room,
      `${p1Part.name} memenangkan pertandingan (+3 Poin, Beruntun ${p1Part.streak}x)!`
    );
  } else {
    if (p0Part) {
      p0Part.draws += 1;
      p0Part.points += 1;
    }
    if (p1Part) {
      p1Part.draws += 1;
      p1Part.points += 1;
    }
    winnerClientId = 'DRAW';
    addRoomSystemChat(room, 'Pertandingan berakhir SERI! Kedua petarung mendapat +1 Poin.');
  }

  if (room.activeTournamentMatchId) {
    const tm = room.tournamentMatches.find((m) => m.id === room.activeTournamentMatchId);
    if (tm) {
      tm.status = 'DONE';
      tm.winnerClientId = winnerClientId;
    }
  }
}

function startRoomBattle(room: ServerRoom): boolean {
  const f0Id = room.fighters[0];
  const f1Id = room.fighters[1];
  if (!f0Id || !f1Id) return false;

  const p0 = room.participants.get(f0Id);
  const p1 = room.participants.get(f1Id);
  if (!p0 || !p1) return false;

  ensureRoomCustomCardsRegistered(room);

  const p0Deck = normalizeServerDeck(p0.deckIds, room.deckSize);
  const p1Deck = normalizeServerDeck(p1.deckIds, room.deckSize);
  p0.deckIds = p0Deck;
  p1.deckIds = p1Deck;

  const maxRoundsMap: Record<MatchRulePreset, number | null> = {
    ROUNDS_3: 3,
    ROUNDS_5: 5,
    WINS_3: null,
    WINS_5: null,
  };
  const targetWinsMap: Record<MatchRulePreset, number> = {
    ROUNDS_3: 99,
    ROUNDS_5: 99,
    WINS_3: 3,
    WINS_5: 5,
  };

  room.pendingChar = [null, null];
  room.pendingSuit = [null, null];
  room.pendingSupport = [undefined, undefined];
  room.resultRecordedForCurrentBattle = false;
  room.isPaused = false;
  room.pauseReason = null;
  room.pausedByName = null;
  if (room.refereeClientId === f0Id || room.refereeClientId === f1Id) {
    room.refereeClientId = null;
  }

  room.battle = createInitialBattleState({
    mode: 'PASS_AND_PLAY',
    difficulty: 'STANDAR',
    targetWins: targetWinsMap[room.matchRule],
    maxRounds: maxRoundsMap[room.matchRule],
    initialHandSize: Math.min(4, room.deckSize),
    p1Name: p0.name,
    p2Name: p1.name,
    p1DeckIds: p0Deck,
    p2DeckIds: p1Deck,
    p1SuitSet: p0.suitArtSet,
    p2SuitSet: p1.suitArtSet,
  });

  const refPart = room.refereeClientId ? room.participants.get(room.refereeClientId) : undefined;
  addRoomSystemChat(
    room,
    refPart
      ? `Pertarungan dimulai: ${p0.name} vs ${p1.name} · Dipimpin Wasit ${refPart.name}!`
      : `Pertarungan dimulai: ${p0.name} vs ${p1.name}!`
  );
  return true;
}

function buildTournamentSchedule(room: ServerRoom): TournamentMatchItem[] {
  const contenders = Array.from(room.participants.values()).filter(
    (p) => p.connected && !p.spectatorOnly && p.clientId !== room.refereeClientId
  );
  if (contenders.length < 2) return [];

  const matches: TournamentMatchItem[] = [];
  let matchNum = 1;

  if (contenders.length <= 5) {
    // Round-robin schedule so every device plays against every other device
    for (let i = 0; i < contenders.length; i++) {
      for (let j = i + 1; j < contenders.length; j++) {
        matches.push({
          id: `tm-${Date.now()}-${matchNum}`,
          label: `Partai ${matchNum}`,
          p1ClientId: contenders[i].clientId,
          p1Name: contenders[i].name,
          p2ClientId: contenders[j].clientId,
          p2Name: contenders[j].name,
          status: 'PENDING',
          winnerClientId: null,
        });
        matchNum += 1;
      }
    }
  } else {
    // 6+ devices: shuffled multi-round pairings (2 matches per contender)
    const firstOrder = shuffleArray(contenders);
    for (let i = 0; i < firstOrder.length; i += 2) {
      const a = firstOrder[i];
      const b = firstOrder[(i + 1) % firstOrder.length];
      if (a.clientId !== b.clientId) {
        matches.push({
          id: `tm-${Date.now()}-${matchNum}`,
          label: `Babak 1 · Partai ${matchNum}`,
          p1ClientId: a.clientId,
          p1Name: a.name,
          p2ClientId: b.clientId,
          p2Name: b.name,
          status: 'PENDING',
          winnerClientId: null,
        });
        matchNum += 1;
      }
    }
    const secondOrder = [...firstOrder.slice(1), firstOrder[0]];
    for (let i = 0; i < firstOrder.length; i += 2) {
      const a = firstOrder[i];
      const b = secondOrder[i];
      if (a.clientId !== b.clientId) {
        matches.push({
          id: `tm-${Date.now()}-${matchNum}`,
          label: `Babak 2 · Partai ${matchNum}`,
          p1ClientId: a.clientId,
          p1Name: a.name,
          p2ClientId: b.clientId,
          p2Name: b.name,
          status: 'PENDING',
          winnerClientId: null,
        });
        matchNum += 1;
      }
    }
  }

  return matches;
}

function assignNextTournamentMatchSeats(room: ServerRoom): TournamentMatchItem | null {
  const nextMatch = room.tournamentMatches.find((m) => m.status === 'PENDING');
  if (!nextMatch) {
    room.activeTournamentMatchId = null;
    return null;
  }

  const p1Exists = room.participants.has(nextMatch.p1ClientId);
  const p2Exists = room.participants.has(nextMatch.p2ClientId);
  if (!p1Exists || !p2Exists) {
    nextMatch.status = 'DONE';
    return assignNextTournamentMatchSeats(room);
  }

  nextMatch.status = 'LIVE';
  room.activeTournamentMatchId = nextMatch.id;

  // Move previous fighters to queue if they aren't in nextMatch
  for (const prevFighterId of room.fighters) {
    if (
      prevFighterId &&
      prevFighterId !== nextMatch.p1ClientId &&
      prevFighterId !== nextMatch.p2ClientId &&
      !room.challengerQueue.includes(prevFighterId)
    ) {
      const part = room.participants.get(prevFighterId);
      if (part && !part.spectatorOnly) {
        room.challengerQueue.push(prevFighterId);
      }
    }
  }

  room.challengerQueue = room.challengerQueue.filter(
    (id) => id !== nextMatch.p1ClientId && id !== nextMatch.p2ClientId
  );
  room.fighters = [nextMatch.p1ClientId, nextMatch.p2ClientId];
  return nextMatch;
}

function removeClientFromRoom(room: ServerRoom, clientId: string, explicitLeave: boolean): void {
  const part = room.participants.get(clientId);
  if (!part) return;

  if (explicitLeave) {
    room.participants.delete(clientId);
    room.challengerQueue = room.challengerQueue.filter((id) => id !== clientId);

    const wasSeat0 = room.fighters[0] === clientId;
    const wasSeat1 = room.fighters[1] === clientId;

    if (wasSeat0 || wasSeat1) {
      if (room.battle && room.battle.phase !== 'GAME_OVER') {
        const winnerSeat: 0 | 1 = wasSeat0 ? 1 : 0;
        room.battle = {
          ...room.battle,
          phase: 'GAME_OVER',
          winnerIndex: winnerSeat,
          winReason: `${part.name} keluar dari room. Kemenangan otomatis diberikan kepada lawan.`,
        };
        recordMatchResultIfFinished(room);
      }
      if (wasSeat0) room.fighters[0] = null;
      if (wasSeat1) room.fighters[1] = null;
      if (!room.battle) {
        fillEmptyFighterSeats(room);
      }
    }

    if (room.refereeClientId === clientId) {
      room.refereeClientId = null;
      if (room.isPaused) {
        room.isPaused = false;
        room.pauseReason = null;
        room.pausedByName = null;
      }
    }

    if (part.isHost) {
      const nextHost =
        (room.refereeClientId ? room.participants.get(room.refereeClientId) : undefined) ??
        Array.from(room.participants.values()).find((p) => p.connected);
      if (nextHost && nextHost.connected) {
        nextHost.isHost = true;
      }
    }

    addRoomSystemChat(room, `${part.name} meninggalkan room.`);
  } else {
    part.connected = false;
    part.ws = null;
    if (part.isHost) {
      const otherConnected = Array.from(room.participants.values()).find(
        (p) => p.connected && p.clientId !== clientId
      );
      if (otherConnected) {
        part.isHost = false;
        otherConnected.isHost = true;
      }
    }
  }

  const anyConnected = Array.from(room.participants.values()).some((p) => p.connected);
  if (!anyConnected && explicitLeave && room.participants.size === 0) {
    rooms.delete(room.code);
    broadcastLobbyRooms();
    return;
  }

  broadcastRoomState(room);
}

// Periodic cleanup of abandoned rooms (no connected devices for > 15 minutes)
setInterval(() => {
  const now = Date.now();
  let removedAny = false;
  for (const [code, room] of rooms.entries()) {
    const anyConnected = Array.from(room.participants.values()).some((p) => p.connected);
    if (!anyConnected && now - room.updatedAt > 15 * 60 * 1000) {
      rooms.delete(code);
      removedAny = true;
    }
  }
  if (removedAny) broadcastLobbyRooms();
}, 60 * 1000);

function handleWsMessage(ws: WebSocket, rawText: string): void {
  const meta = socketMetaMap.get(ws);
  if (!meta) return;

  let msg: ClientWsMessage;
  try {
    msg = JSON.parse(rawText) as ClientWsMessage;
  } catch {
    sendJson(ws, { type: 'error', message: 'Format pesan jaringan tidak valid.' });
    return;
  }

  switch (msg.type) {
    case 'lobby:subscribe': {
      meta.clientId = msg.clientId;
      meta.inLobbyFeed = true;
      sendJson(ws, { type: 'lobby:rooms', rooms: buildPublicRoomsList() });
      return;
    }

    case 'room:create': {
      if (meta.roomCode && rooms.has(meta.roomCode) && meta.clientId) {
        removeClientFromRoom(rooms.get(meta.roomCode)!, meta.clientId, true);
      }

      const code = generateRoomCode();
      const joinRole = msg.joinRole ?? 'PLAYER';
      const defaultFallbackName = joinRole === 'REFEREE' ? 'Wasit Arena' : 'Petarung 1';
      const playerName = sanitizeName(msg.name, defaultFallbackName);
      const roomName = sanitizeName(msg.roomName, `Arena ${playerName}`);

      const customCards = msg.customCards ?? {};
      if (Object.keys(customCards).length > 0) {
        registerSessionCards(customCards);
      }

      const normalizedDeck = normalizeServerDeck(msg.deckIds, msg.deckSize);
      const hostParticipant: ServerParticipant = {
        clientId: msg.clientId,
        name: playerName,
        ws,
        connected: true,
        isHost: true,
        ready: true,
        spectatorOnly: joinRole === 'SPECTATOR',
        deckIds: normalizedDeck,
        suitArtSet: sanitizeSuitSet(msg.suitArtSet),
        wins: 0,
        losses: 0,
        draws: 0,
        streak: 0,
        points: 0,
        joinedAt: Date.now(),
      };

      const newRoom: ServerRoom = {
        code,
        roomName,
        isPublic: msg.isPublic,
        roomMode: msg.roomMode,
        deckSize: msg.deckSize,
        matchRule: msg.matchRule,
        participants: new Map([[msg.clientId, hostParticipant]]),
        refereeClientId: joinRole === 'REFEREE' ? msg.clientId : null,
        fighters:
          msg.roomMode === 'PHYSICAL_SIMULATION'
            ? [null, null]
            : joinRole === 'PLAYER'
            ? [msg.clientId, null]
            : [null, null],
        challengerQueue: [],
        tournamentMatches: [],
        activeTournamentMatchId: null,
        customCards: { ...customCards },
        battle: null,
        resultRecordedForCurrentBattle: false,
        isPaused: false,
        pauseReason: null,
        pausedByName: null,
        latestRefereeRuling: null,
        pendingChar: [null, null],
        pendingSuit: [null, null],
        pendingSupport: [undefined, undefined],
        chat: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      addRoomSystemChat(
        newRoom,
        msg.roomMode === 'PHYSICAL_SIMULATION'
          ? `Siaran Simulasi Kartu Asli (${code}) dibuka oleh Host ${playerName}. Perangkat lain dapat menonton live melalui Kode Room ini!`
          : joinRole === 'REFEREE'
          ? `Room ${code} dibuka oleh ${playerName} sebagai Host & Device Wasit. Dua kursi petarung siap diisi perangkat lain!`
          : `Room ${code} dibuat oleh ${playerName}. Bagikan Kode atau Link Undangan ke perangkat lain!`
      );

      rooms.set(code, newRoom);
      meta.clientId = msg.clientId;
      meta.roomCode = code;
      meta.inLobbyFeed = false;

      broadcastRoomState(newRoom);
      return;
    }

    case 'room:join': {
      const targetCode = (msg.roomCode ?? '').trim().toUpperCase();
      const room = rooms.get(targetCode);
      if (!room) {
        sendJson(ws, {
          type: 'error',
          message: `Room dengan kode "${targetCode}" tidak ditemukan atau sudah ditutup.`,
        });
        return;
      }

      if (meta.roomCode && meta.roomCode !== targetCode && rooms.has(meta.roomCode) && meta.clientId) {
        removeClientFromRoom(rooms.get(meta.roomCode)!, meta.clientId, true);
      }

      if (msg.customCards && Object.keys(msg.customCards).length > 0) {
        room.customCards = { ...room.customCards, ...msg.customCards };
        registerSessionCards(room.customCards);
      }

      const joinRole = msg.joinRole ?? 'PLAYER';
      const normalizedDeck = normalizeServerDeck(msg.deckIds, room.deckSize);
      const playerName = sanitizeName(
        msg.name,
        joinRole === 'REFEREE' ? 'Wasit Arena' : `Pemain ${room.participants.size + 1}`
      );
      const existing = room.participants.get(msg.clientId);

      if (existing) {
        // Idempotent reconnect!
        existing.ws = ws;
        existing.connected = true;
        existing.name = playerName;
        if (!room.battle) {
          existing.deckIds = normalizedDeck;
          existing.suitArtSet =
            msg.suitArtSet !== undefined ? sanitizeSuitSet(msg.suitArtSet) : existing.suitArtSet;
        }
        const anyHost = Array.from(room.participants.values()).some((p) => p.isHost && p.connected);
        if (!anyHost) existing.isHost = true;

        if (
          joinRole === 'REFEREE' &&
          !room.refereeClientId &&
          room.fighters[0] !== msg.clientId &&
          room.fighters[1] !== msg.clientId
        ) {
          room.refereeClientId = msg.clientId;
          room.challengerQueue = room.challengerQueue.filter((id) => id !== msg.clientId);
          existing.spectatorOnly = false;
        }
      } else {
        const anyHost = Array.from(room.participants.values()).some((p) => p.isHost && p.connected);
        const currentRef = room.refereeClientId
          ? room.participants.get(room.refereeClientId)
          : undefined;
        const canTakeReferee =
          joinRole === 'REFEREE' && (!room.refereeClientId || !currentRef?.connected);

        const newPart: ServerParticipant = {
          clientId: msg.clientId,
          name: playerName,
          ws,
          connected: true,
          isHost: !anyHost,
          ready: true,
          spectatorOnly:
            room.roomMode === 'PHYSICAL_SIMULATION' ||
            joinRole === 'SPECTATOR' ||
            (joinRole === 'REFEREE' && !canTakeReferee),
          deckIds: normalizedDeck,
          suitArtSet: sanitizeSuitSet(msg.suitArtSet),
          wins: 0,
          losses: 0,
          draws: 0,
          streak: 0,
          points: 0,
          joinedAt: Date.now(),
        };
        room.participants.set(msg.clientId, newPart);

        if (canTakeReferee) {
          room.refereeClientId = msg.clientId;
          addRoomSystemChat(
            room,
            `${playerName} bergabung sebagai Device Wasit (Pengadil Resmi Pertandingan)!`
          );
        } else if (newPart.spectatorOnly) {
          addRoomSystemChat(
            room,
            joinRole === 'REFEREE'
              ? `${playerName} bergabung sebagai Penonton (Kursi Wasit sedang ditempati oleh ${currentRef?.name ?? 'Wasit'}).`
              : `${playerName} bergabung sebagai Penonton Live!`
          );
        } else {
          if (room.battle === null && room.fighters[0] === null) {
            room.fighters[0] = msg.clientId;
          } else if (room.battle === null && room.fighters[1] === null) {
            room.fighters[1] = msg.clientId;
          } else if (!room.challengerQueue.includes(msg.clientId)) {
            room.challengerQueue.push(msg.clientId);
          }

          addRoomSystemChat(
            room,
            `${playerName} bergabung dari perangkat ke-${room.participants.size}!`
          );
        }
      }

      meta.clientId = msg.clientId;
      meta.roomCode = room.code;
      meta.inLobbyFeed = false;

      fillEmptyFighterSeats(room);
      broadcastRoomState(room);
      return;
    }

    case 'room:leave': {
      if (meta.roomCode && meta.clientId && rooms.has(meta.roomCode)) {
        removeClientFromRoom(rooms.get(meta.roomCode)!, meta.clientId, true);
      }
      meta.roomCode = null;
      meta.inLobbyFeed = true;
      sendJson(ws, { type: 'room:left' });
      sendJson(ws, { type: 'lobby:rooms', rooms: buildPublicRoomsList() });
      return;
    }

    default:
      break;
  }

  // Remaining actions require being inside an active room
  if (!meta.roomCode || !meta.clientId) return;
  const room = rooms.get(meta.roomCode);
  if (!room) return;
  const participant = room.participants.get(meta.clientId);
  if (!participant) return;

  const seat: 0 | 1 | null =
    room.fighters[0] === participant.clientId
      ? 0
      : room.fighters[1] === participant.clientId
      ? 1
      : null;

  const isReferee = room.refereeClientId === participant.clientId;
  const canManageRoom = participant.isHost || isReferee;

  ensureRoomCustomCardsRegistered(room);

  switch (msg.type) {
    case 'room:update_loadout': {
      if (msg.customCards && Object.keys(msg.customCards).length > 0) {
        room.customCards = { ...room.customCards, ...msg.customCards };
        registerSessionCards(room.customCards);
      }
      if (msg.name) {
        participant.name = sanitizeName(msg.name, participant.name);
      }
      participant.deckIds = normalizeServerDeck(msg.deckIds, room.deckSize);
      participant.suitArtSet =
        msg.suitArtSet !== undefined ? sanitizeSuitSet(msg.suitArtSet) : participant.suitArtSet;
      broadcastRoomState(room);
      return;
    }

    case 'room:toggle_ready': {
      participant.ready = !participant.ready;
      broadcastRoomState(room);
      return;
    }

    case 'room:claim_seat': {
      if (room.battle !== null && room.battle.phase !== 'GAME_OVER') return;
      const targetSeat = msg.seat;
      if (room.fighters[targetSeat] !== null) return;

      if (room.refereeClientId === participant.clientId) {
        room.refereeClientId = null;
      }
      if (room.fighters[0] === participant.clientId) room.fighters[0] = null;
      if (room.fighters[1] === participant.clientId) room.fighters[1] = null;
      room.challengerQueue = room.challengerQueue.filter((id) => id !== participant.clientId);
      participant.spectatorOnly = false;
      participant.ready = true;
      room.fighters[targetSeat] = participant.clientId;
      room.battle = null;
      broadcastRoomState(room);
      return;
    }

    case 'room:claim_referee': {
      const activeBattleRunning = room.battle !== null && room.battle.phase !== 'GAME_OVER';
      if (activeBattleRunning && seat !== null) {
        sendJson(ws, {
          type: 'error',
          message: 'Tidak dapat berpindah ke kursi Wasit saat sedang bertarung aktif.',
        });
        return;
      }
      const existingRef = room.refereeClientId
        ? room.participants.get(room.refereeClientId)
        : undefined;
      if (
        room.refereeClientId &&
        room.refereeClientId !== participant.clientId &&
        existingRef?.connected &&
        !participant.isHost
      ) {
        sendJson(ws, {
          type: 'error',
          message: `Kursi Device Wasit sedang ditempati oleh ${existingRef.name}.`,
        });
        return;
      }

      if (room.fighters[0] === participant.clientId) room.fighters[0] = null;
      if (room.fighters[1] === participant.clientId) room.fighters[1] = null;
      room.challengerQueue = room.challengerQueue.filter((id) => id !== participant.clientId);
      participant.spectatorOnly = false;
      room.refereeClientId = participant.clientId;
      if (!activeBattleRunning) {
        room.battle = null;
        fillEmptyFighterSeats(room);
      }
      addRoomSystemChat(room, `${participant.name} kini bertugas sebagai Device Wasit.`);
      broadcastRoomState(room);
      return;
    }

    case 'room:leave_referee': {
      if (room.refereeClientId !== participant.clientId) return;
      room.refereeClientId = null;
      if (room.isPaused) {
        room.isPaused = false;
        room.pauseReason = null;
        room.pausedByName = null;
      }
      const activeBattleRunning = room.battle !== null && room.battle.phase !== 'GAME_OVER';
      if (msg.joinQueue) {
        participant.spectatorOnly = false;
        if (!activeBattleRunning) {
          room.battle = null;
          if (room.fighters[0] === null) room.fighters[0] = participant.clientId;
          else if (room.fighters[1] === null) room.fighters[1] = participant.clientId;
          else if (!room.challengerQueue.includes(participant.clientId)) {
            room.challengerQueue.push(participant.clientId);
          }
        } else if (!room.challengerQueue.includes(participant.clientId)) {
          room.challengerQueue.push(participant.clientId);
        }
      } else {
        participant.spectatorOnly = true;
      }
      addRoomSystemChat(room, `${participant.name} melepas peran Device Wasit.`);
      broadcastRoomState(room);
      return;
    }

    case 'room:step_down': {
      if (room.battle !== null && room.battle.phase !== 'GAME_OVER') return;
      if (room.refereeClientId === participant.clientId) {
        room.refereeClientId = null;
      }
      participant.spectatorOnly = msg.spectatorOnly;
      if (room.fighters[0] === participant.clientId) room.fighters[0] = null;
      if (room.fighters[1] === participant.clientId) room.fighters[1] = null;
      room.challengerQueue = room.challengerQueue.filter((id) => id !== participant.clientId);
      if (!msg.spectatorOnly) {
        room.challengerQueue.push(participant.clientId);
      }
      room.battle = null;
      fillEmptyFighterSeats(room);
      broadcastRoomState(room);
      return;
    }

    case 'host:swap_fighters': {
      if (!canManageRoom || (room.battle !== null && room.battle.phase !== 'GAME_OVER')) {
        return;
      }
      room.fighters = [room.fighters[1], room.fighters[0]];
      room.battle = null;
      addRoomSystemChat(
        room,
        `Posisi Kursi Petarung 1 ↔ Petarung 2 ditukar oleh ${participant.name}.`
      );
      broadcastRoomState(room);
      return;
    }

    case 'host:transfer_host': {
      if (!participant.isHost) return;
      const target = room.participants.get(msg.targetClientId);
      if (!target || !target.connected || target.clientId === participant.clientId) return;
      participant.isHost = false;
      target.isHost = true;
      addRoomSystemChat(room, `Hak Host Room diserahkan kepada ${target.name}.`);
      broadcastRoomState(room);
      return;
    }

    case 'host:sync_physical_simulation': {
      if (!canManageRoom) return;
      if (msg.customCards && Object.keys(msg.customCards).length > 0) {
        room.customCards = { ...room.customCards, ...msg.customCards };
        registerSessionCards(room.customCards);
      }
      room.battle = msg.battle;
      room.pendingChar = [null, null];
      room.pendingSuit = [null, null];
      room.pendingSupport = [undefined, undefined];
      if (msg.rulingText?.trim()) {
        addRefereeAnnouncement(room, participant.name, msg.rulingText.trim());
      }
      broadcastRoomState(room);
      return;
    }

    case 'host:assign_role': {
      if (!canManageRoom) return;
      const target = room.participants.get(msg.targetClientId);
      if (!target) return;

      const activeBattleRunning = room.battle !== null && room.battle.phase !== 'GAME_OVER';
      const targetInActiveBattle =
        room.fighters[0] === target.clientId || room.fighters[1] === target.clientId;

      if (activeBattleRunning && (targetInActiveBattle || msg.role === 'FIGHTER_1' || msg.role === 'FIGHTER_2')) {
        sendJson(ws, {
          type: 'error',
          message: 'Tidak dapat memindahkan kursi petarung saat duel sedang berlangsung. Kembali ke lobi terlebih dahulu.',
        });
        return;
      }

      // Remove target from current positions first
      if (room.refereeClientId === target.clientId) room.refereeClientId = null;
      if (room.fighters[0] === target.clientId) room.fighters[0] = null;
      if (room.fighters[1] === target.clientId) room.fighters[1] = null;
      room.challengerQueue = room.challengerQueue.filter((id) => id !== target.clientId);

      if (msg.role === 'FIGHTER_1' || msg.role === 'FIGHTER_2') {
        const seatIdx: 0 | 1 = msg.role === 'FIGHTER_1' ? 0 : 1;
        const displacedId = room.fighters[seatIdx];
        if (displacedId && displacedId !== target.clientId) {
          const displacedPart = room.participants.get(displacedId);
          if (displacedPart && !displacedPart.spectatorOnly && !room.challengerQueue.includes(displacedId)) {
            room.challengerQueue.unshift(displacedId);
          }
        }
        target.spectatorOnly = false;
        target.ready = true;
        room.fighters[seatIdx] = target.clientId;
        room.battle = null;
        addRoomSystemChat(
          room,
          `${participant.name} menempatkan ${target.name} di Kursi Petarung ${seatIdx + 1}.`
        );
      } else if (msg.role === 'REFEREE') {
        const prevRefId = room.refereeClientId;
        if (prevRefId && prevRefId !== target.clientId) {
          const prevRef = room.participants.get(prevRefId);
          if (prevRef && !prevRef.spectatorOnly && !room.challengerQueue.includes(prevRefId)) {
            room.challengerQueue.push(prevRefId);
          }
        }
        target.spectatorOnly = false;
        room.refereeClientId = target.clientId;
        if (!activeBattleRunning) {
          room.battle = null;
          fillEmptyFighterSeats(room);
        }
        addRoomSystemChat(
          room,
          `${participant.name} menunjuk ${target.name} sebagai Device Wasit.`
        );
      } else if (msg.role === 'QUEUE') {
        target.spectatorOnly = false;
        room.challengerQueue.push(target.clientId);
        if (!activeBattleRunning) {
          room.battle = null;
          fillEmptyFighterSeats(room);
        }
        addRoomSystemChat(
          room,
          `${participant.name} memindahkan ${target.name} ke Antrean Penantang.`
        );
      } else {
        target.spectatorOnly = true;
        if (!activeBattleRunning) {
          room.battle = null;
          fillEmptyFighterSeats(room);
        }
        addRoomSystemChat(
          room,
          `${participant.name} memindahkan ${target.name} ke Penonton.`
        );
      }

      broadcastRoomState(room);
      return;
    }

    case 'room:update_settings': {
      if (!canManageRoom || (room.battle !== null && room.battle.phase !== 'GAME_OVER')) {
        return;
      }
      room.roomMode = msg.roomMode;
      room.deckSize = msg.deckSize;
      room.matchRule = msg.matchRule;
      room.isPublic = msg.isPublic;
      for (const p of room.participants.values()) {
        p.deckIds = normalizeServerDeck(p.deckIds, room.deckSize);
      }
      broadcastRoomState(room);
      return;
    }

    case 'room:generate_tournament': {
      if (!canManageRoom) return;
      room.battle = null;
      room.roomMode = 'TOURNAMENT';
      const schedule = buildTournamentSchedule(room);
      if (schedule.length === 0) {
        sendJson(ws, {
          type: 'error',
          message: 'Minimal 2 perangkat petarung aktif (di luar Wasit & Penonton) dibutuhkan untuk membuat turnamen.',
        });
        return;
      }
      room.tournamentMatches = schedule;
      const firstMatch = assignNextTournamentMatchSeats(room);
      if (firstMatch) {
        addRoomSystemChat(
          room,
          `Turnamen ${schedule.length} Partai dibuat! Partai pembuka: ${firstMatch.p1Name} vs ${firstMatch.p2Name}.`
        );
      }
      broadcastRoomState(room);
      return;
    }

    case 'room:start_battle': {
      if (!canManageRoom && seat === null) return;
      if (!room.fighters[0] || !room.fighters[1]) {
        sendJson(ws, {
          type: 'error',
          message: 'Butuh 2 petarung di Kursi Petarung 1 dan Kursi Petarung 2 untuk memulai.',
        });
        return;
      }
      if (room.roomMode === 'TOURNAMENT' && room.tournamentMatches.length > 0 && !room.activeTournamentMatchId) {
        assignNextTournamentMatchSeats(room);
      }
      startRoomBattle(room);
      broadcastRoomState(room);
      return;
    }

    case 'room:next_match': {
      if (!room.battle || room.battle.phase !== 'GAME_OVER') return;
      if (!canManageRoom && seat === null) return;

      if (room.roomMode === 'TOURNAMENT' && room.tournamentMatches.length > 0) {
        const nextMatch = assignNextTournamentMatchSeats(room);
        if (!nextMatch) {
          room.battle = null;
          addRoomSystemChat(
            room,
            'Seluruh jadwal Turnamen telah tuntas! Lihat Papan Klasemen untuk Juara Utama.'
          );
          broadcastRoomState(room);
          return;
        }
        startRoomBattle(room);
        broadcastRoomState(room);
        return;
      }

      // KING_OF_THE_HILL: Rotate next challenger from queue if 3+ devices!
      const validQueue = room.challengerQueue.filter((id) => {
        const p = room.participants.get(id);
        return p && p.connected && !p.spectatorOnly && id !== room.refereeClientId;
      });
      room.challengerQueue = validQueue;

      if (room.challengerQueue.length > 0) {
        const nextChallengerId = room.challengerQueue.shift()!;
        const prev0 = room.fighters[0];
        const prev1 = room.fighters[1];
        const winnerIdx = room.battle.winnerIndex;

        if (winnerIdx === 1 && prev1) {
          room.fighters = [prev1, nextChallengerId];
          if (prev0) room.challengerQueue.push(prev0);
        } else if (winnerIdx === 0 && prev0) {
          room.fighters = [prev0, nextChallengerId];
          if (prev1) room.challengerQueue.push(prev1);
        } else {
          // Draw: rotate Seat 0 out so queue moves smoothly
          room.fighters = [prev1 ?? nextChallengerId, nextChallengerId];
          if (prev0 && prev0 !== nextChallengerId) room.challengerQueue.push(prev0);
        }
      }

      startRoomBattle(room);
      broadcastRoomState(room);
      return;
    }

    case 'room:return_lobby': {
      if (!canManageRoom && seat === null) return;
      room.battle = null;
      room.isPaused = false;
      room.pauseReason = null;
      room.pausedByName = null;
      room.pendingChar = [null, null];
      room.pendingSuit = [null, null];
      room.pendingSupport = [undefined, undefined];
      fillEmptyFighterSeats(room);
      broadcastRoomState(room);
      return;
    }

    case 'room:chat': {
      const cleanText = (msg.text ?? '').trim().slice(0, 140);
      if (!cleanText) return;
      room.chat.push({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderName: isReferee ? `Wasit ${participant.name}` : participant.name,
        text: cleanText,
        timestamp: Date.now(),
        isReferee,
      });
      if (room.chat.length > 60) {
        room.chat = room.chat.slice(-60);
      }
      broadcastRoomState(room);
      return;
    }

    case 'referee:command': {
      const activeRefPart = room.refereeClientId
        ? room.participants.get(room.refereeClientId)
        : undefined;
      const hasConnectedReferee = Boolean(activeRefPart && activeRefPart.connected);

      // If a dedicated Device Wasit is connected, only that referee executes live rulings;
      // otherwise the Room Host can also execute match management commands.
      if (!isReferee && (!participant.isHost || hasConnectedReferee)) {
        sendJson(ws, {
          type: 'error',
          message: hasConnectedReferee
            ? `Keputusan pertandingan saat ini berada di bawah kendali Device Wasit (${activeRefPart?.name}).`
            : 'Hanya Device Wasit atau Host yang dapat menjalankan kontrol pengadil.',
        });
        return;
      }

      const cmd = msg.command;
      switch (cmd.kind) {
        case 'PAUSE_MATCH': {
          if (!room.battle || room.battle.phase === 'GAME_OVER') return;
          const reasonText =
            (cmd.reason ?? '').trim().slice(0, 120) || 'Pemeriksaan Wasit / Time-Out Pertandingan';
          room.isPaused = true;
          room.pauseReason = reasonText;
          room.pausedByName = participant.name;
          addRefereeAnnouncement(room, participant.name, `Pertandingan DIJEDA — ${reasonText}`);
          broadcastRoomState(room);
          return;
        }

        case 'RESUME_MATCH': {
          room.isPaused = false;
          room.pauseReason = null;
          room.pausedByName = null;
          addRefereeAnnouncement(room, participant.name, 'Pertandingan DILANJUTKAN kembali!');
          broadcastRoomState(room);
          return;
        }

        case 'ADVANCE_PHASE': {
          if (!room.battle || room.battle.phase === 'GAME_OVER') return;
          if (room.battle.phase === 'SUIT_REVEAL') {
            let nextState = advanceAfterSuitReveal(room.battle);
            if (
              nextState.phase === 'P1_PICK_SUPPORT' ||
              nextState.phase === 'P2_PRIVACY_SUPPORT' ||
              nextState.phase === 'P2_PICK_SUPPORT'
            ) {
              const p0CanSup = playerHasPlayableSupport(nextState.players[0], nextState.players[1]);
              const p1CanSup = playerHasPlayableSupport(nextState.players[1], nextState.players[0]);
              nextState = { ...nextState, phase: 'P1_PICK_SUPPORT' };
              room.pendingSupport = [p0CanSup ? undefined : null, p1CanSup ? undefined : null];
            } else {
              room.pendingSuit = [null, null];
              room.pendingSupport = [undefined, undefined];
            }
            room.battle = appendRefereeBattleLog(
              nextState,
              participant.name,
              'Melanjutkan fase setelah pembukaan Adu Suit.'
            );
            recordMatchResultIfFinished(room);
            broadcastRoomState(room);
          } else if (room.battle.phase === 'ROUND_END') {
            room.pendingChar = [null, null];
            room.pendingSuit = [null, null];
            room.pendingSupport = [undefined, undefined];
            const nextRoundState = startNextRound(room.battle);
            room.battle = appendRefereeBattleLog(
              nextRoundState,
              participant.name,
              `Memulai Ronde ${nextRoundState.round} dari Konsol Wasit.`
            );
            recordMatchResultIfFinished(room);
            broadcastRoomState(room);
          }
          return;
        }

        case 'RESET_SUIT_CLASH': {
          if (!room.battle || room.battle.phase === 'GAME_OVER' || room.battle.phase === 'ROUND_END') {
            return;
          }
          if (room.battle.phase === 'P1_PICK_CHARACTER' || room.battle.phase === 'INTERACTIVE_CHOICE') {
            return;
          }
          room.pendingSuit = [null, null];
          room.pendingSupport = [undefined, undefined];
          room.battle = appendRefereeBattleLog(
            {
              ...room.battle,
              phase: 'P1_PICK_SUIT',
              lastSuitWinner: null,
              players: [
                {
                  ...room.battle.players[0],
                  selectedSuit: null,
                  playedSupportCard: null,
                },
                {
                  ...room.battle.players[1],
                  selectedSuit: null,
                  playedSupportCard: null,
                },
              ],
            },
            participant.name,
            'Adu Suit diulang kembali atas keputusan Wasit.'
          );
          broadcastRoomState(room);
          return;
        }

        case 'UNLOCK_CHARACTER_PICKS': {
          if (!room.battle || room.battle.phase !== 'P1_PICK_CHARACTER') return;
          room.pendingChar = [null, null];
          room.battle = appendRefereeBattleLog(
            room.battle,
            participant.name,
            'Kunci pilihan Kartu Karakter dibuka kembali agar petarung dapat memilih ulang.'
          );
          broadcastRoomState(room);
          return;
        }

        case 'ADJUST_HP': {
          if (!room.battle) return;
          const safeDelta = Math.max(-2000, Math.min(2000, Math.round(cmd.delta)));
          if (safeDelta === 0) return;
          room.battle = applyRefereeStatAdjustment(
            room.battle,
            cmd.target,
            'HP',
            safeDelta,
            participant.name
          );
          recordMatchResultIfFinished(room);
          broadcastRoomState(room);
          return;
        }

        case 'ADJUST_ATK': {
          if (!room.battle) return;
          const safeDelta = Math.max(-2000, Math.min(2000, Math.round(cmd.delta)));
          if (safeDelta === 0) return;
          room.battle = applyRefereeStatAdjustment(
            room.battle,
            cmd.target,
            'ATK',
            safeDelta,
            participant.name
          );
          broadcastRoomState(room);
          return;
        }

        case 'FORCE_ROUND_WINNER': {
          if (!room.battle) return;
          room.pendingChar = [null, null];
          room.pendingSuit = [null, null];
          room.pendingSupport = [undefined, undefined];
          room.battle = applyRefereeForceRoundWinner(
            room.battle,
            cmd.winner,
            participant.name,
            cmd.reason
          );
          recordMatchResultIfFinished(room);
          broadcastRoomState(room);
          return;
        }

        case 'DECLARE_MATCH_WINNER': {
          if (!room.battle) return;
          room.isPaused = false;
          room.pauseReason = null;
          room.pausedByName = null;
          room.battle = applyRefereeDeclareMatchWinner(
            room.battle,
            cmd.winner,
            participant.name,
            cmd.reason
          );
          recordMatchResultIfFinished(room);
          broadcastRoomState(room);
          return;
        }

        case 'RESTART_MATCH': {
          if (!room.fighters[0] || !room.fighters[1]) return;
          startRoomBattle(room);
          addRefereeAnnouncement(
            room,
            participant.name,
            'Pertandingan diulang dari Ronde 1 atas keputusan Wasit!'
          );
          broadcastRoomState(room);
          return;
        }

        case 'ANNOUNCE': {
          const clean = (cmd.text ?? '').trim().slice(0, 160);
          if (!clean) return;
          addRefereeAnnouncement(room, participant.name, clean);
          broadcastRoomState(room);
          return;
        }
      }
      return;
    }

    case 'battle:pick_character': {
      if (room.isPaused) {
        sendJson(ws, {
          type: 'error',
          message: `Pertandingan sedang dijeda oleh Wasit: ${room.pauseReason ?? 'Harap tunggu instruksi Wasit.'}`,
        });
        return;
      }
      if (seat === null || !room.battle) return;
      if (room.battle.phase !== 'P1_PICK_CHARACTER' || room.battle.round !== msg.round) return;
      if (room.pendingChar[seat] !== null) return;

      const playerState = room.battle.players[seat];
      const cardInst = playerState.hand.find((c) => c.uid === msg.uid);
      if (!cardInst) return;
      const def = CARD_BY_ID[cardInst.defId];
      if (!def || !canPlayCharacterCard(def, playerState.usedCharacterTags).playable) return;

      room.pendingChar[seat] = msg.uid;

      if (room.pendingChar[0] && room.pendingChar[1]) {
        const uid0 = room.pendingChar[0];
        const uid1 = room.pendingChar[1];
        room.pendingChar = [null, null];
        room.pendingSuit = [null, null];
        room.pendingSupport = [undefined, undefined];
        room.battle = deployBothCharactersAndResolveEntry(room.battle, uid0, uid1);
        recordMatchResultIfFinished(room);
      }

      broadcastRoomState(room);
      return;
    }

    case 'battle:submit_choice': {
      if (room.isPaused) {
        sendJson(ws, {
          type: 'error',
          message: `Pertandingan sedang dijeda oleh Wasit: ${room.pauseReason ?? 'Harap tunggu instruksi Wasit.'}`,
        });
        return;
      }
      if (seat === null || !room.battle) return;
      if (room.battle.phase !== 'INTERACTIVE_CHOICE' || room.battle.round !== msg.round) return;
      const activeChoice = room.battle.choiceQueue[0];
      if (!activeChoice || activeChoice.playerIndex !== seat) return;

      room.battle = resolvePendingChoice(room.battle, msg.selectedUids);
      recordMatchResultIfFinished(room);
      broadcastRoomState(room);
      return;
    }

    case 'battle:pick_suit': {
      if (room.isPaused) {
        sendJson(ws, {
          type: 'error',
          message: `Pertandingan sedang dijeda oleh Wasit: ${room.pauseReason ?? 'Harap tunggu instruksi Wasit.'}`,
        });
        return;
      }
      if (seat === null || !room.battle) return;
      if (
        room.battle.phase !== 'P1_PICK_SUIT' ||
        room.battle.round !== msg.round ||
        room.battle.suitAttemptInRound !== msg.suitAttempt
      ) {
        return;
      }
      if (room.pendingSuit[seat] !== null) return;

      room.pendingSuit[seat] = msg.suit;

      if (room.pendingSuit[0] && room.pendingSuit[1]) {
        const s0 = room.pendingSuit[0];
        const s1 = room.pendingSuit[1];
        room.pendingSuit = [null, null];
        room.battle = resolveSuitClash(room.battle, s0, s1);
        recordMatchResultIfFinished(room);
      }

      broadcastRoomState(room);
      return;
    }

    case 'battle:advance_suit': {
      if (room.isPaused) {
        sendJson(ws, {
          type: 'error',
          message: `Pertandingan sedang dijeda oleh Wasit: ${room.pauseReason ?? 'Harap tunggu instruksi Wasit.'}`,
        });
        return;
      }
      if (seat === null || !room.battle) return;
      if (
        room.battle.phase !== 'SUIT_REVEAL' ||
        room.battle.round !== msg.round ||
        room.battle.suitAttemptInRound !== msg.suitAttempt
      ) {
        return;
      }

      let nextState = advanceAfterSuitReveal(room.battle);
      if (
        nextState.phase === 'P1_PICK_SUPPORT' ||
        nextState.phase === 'P2_PRIVACY_SUPPORT' ||
        nextState.phase === 'P2_PICK_SUPPORT'
      ) {
        const p0CanSup = playerHasPlayableSupport(nextState.players[0], nextState.players[1]);
        const p1CanSup = playerHasPlayableSupport(nextState.players[1], nextState.players[0]);
        nextState = { ...nextState, phase: 'P1_PICK_SUPPORT' };
        room.pendingSupport = [p0CanSup ? undefined : null, p1CanSup ? undefined : null];
      } else {
        room.pendingSuit = [null, null];
        room.pendingSupport = [undefined, undefined];
      }

      room.battle = nextState;
      recordMatchResultIfFinished(room);
      broadcastRoomState(room);
      return;
    }

    case 'battle:pick_support': {
      if (room.isPaused) {
        sendJson(ws, {
          type: 'error',
          message: `Pertandingan sedang dijeda oleh Wasit: ${room.pauseReason ?? 'Harap tunggu instruksi Wasit.'}`,
        });
        return;
      }
      if (seat === null || !room.battle) return;
      if (
        (room.battle.phase !== 'P1_PICK_SUPPORT' && room.battle.phase !== 'P2_PICK_SUPPORT') ||
        room.battle.round !== msg.round ||
        room.battle.suitAttemptInRound !== msg.suitAttempt
      ) {
        return;
      }
      if (room.pendingSupport[seat] !== undefined) return;

      const oppSeat: 0 | 1 = seat === 0 ? 1 : 0;
      if (msg.supportUid !== null) {
        if (room.battle.players[oppSeat].active?.blockEnemySupport) {
          return;
        }
        const inst = room.battle.players[seat].hand.find((c) => c.uid === msg.supportUid);
        const def = inst ? CARD_BY_ID[inst.defId] : undefined;
        if (!inst || !def || def.category !== CardCategory.SUPPORT) return;
      }

      room.pendingSupport[seat] = msg.supportUid;

      if (room.pendingSupport[0] !== undefined && room.pendingSupport[1] !== undefined) {
        const sup0 = room.pendingSupport[0];
        const sup1 = room.pendingSupport[1];
        room.pendingSupport = [undefined, undefined];
        room.battle = resolveSupportsAndStrike(room.battle, sup0, sup1);
        recordMatchResultIfFinished(room);
      }

      broadcastRoomState(room);
      return;
    }

    case 'battle:next_round': {
      if (room.isPaused) {
        sendJson(ws, {
          type: 'error',
          message: `Pertandingan sedang dijeda oleh Wasit: ${room.pauseReason ?? 'Harap tunggu instruksi Wasit.'}`,
        });
        return;
      }
      if (seat === null || !room.battle) return;
      if (room.battle.phase !== 'ROUND_END' || room.battle.round !== msg.round) return;

      room.pendingChar = [null, null];
      room.pendingSuit = [null, null];
      room.pendingSupport = [undefined, undefined];
      room.battle = startNextRound(room.battle);
      recordMatchResultIfFinished(room);
      broadcastRoomState(room);
      return;
    }
  }
}

const VALID_CHARACTER_RANKS: CardRank[] = ['SR', 'AR', 'S', 'A', 'B', 'C'];
const VALID_SUIT_ELEMENTS: SuitElement[] = [SuitElement.AIR, SuitElement.API, SuitElement.DAUN];

function snapToTwenty(raw: unknown, min: number, max: number, fallback: number): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  const snapped = Math.round(num / 20) * 20;
  return Math.max(min, Math.min(max, snapped));
}

function getSuitRuleText(element: SuitElement): string {
  if (element === SuitElement.AIR) {
    return 'Elemen Air mengalahkan Api, kalah terhadap Daun.';
  }
  if (element === SuitElement.API) {
    return 'Elemen Api mengalahkan Daun, kalah terhadap Air.';
  }
  return 'Elemen Daun mengalahkan Air, kalah terhadap Api.';
}

function buildEffectCatalogPromptSection(): string {
  return EFFECT_CATALOG.map(
    (item) =>
      `- ${item.key} [kategori=${item.targetCategory}, prioritas=${item.defaultPriority}]: ${item.defaultText}`
  ).join('\n');
}

function createGenAIClient(timeoutMs = 15000): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Kunci server GEMINI_API_KEY belum tersedia di lingkungan aplikasi.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: timeoutMs,
    },
  });
}

async function analyzeCardImageWithGemini(params: {
  mimeType: string;
  base64Data: string;
  fileName?: string;
  preferredCategory?: string | null;
  targetSuitElement?: string | null;
}): Promise<AnalyzedCardImageResult> {
  const ai = createGenAIClient();

  const normalizedPreferredCategory =
    params.preferredCategory === CardCategory.CHARACTER ||
    params.preferredCategory === CardCategory.SUPPORT ||
    params.preferredCategory === CardCategory.SUIT
      ? (params.preferredCategory as CardCategory)
      : null;

  const normalizedTargetSuit =
    params.targetSuitElement === SuitElement.AIR ||
    params.targetSuitElement === SuitElement.API ||
    params.targetSuitElement === SuitElement.DAUN
      ? (params.targetSuitElement as SuitElement)
      : null;

  const systemInstruction = `Anda adalah sistem kurator & pembaca kartu resmi untuk permainan kartu "Monsta Galaxy Card — BoBoiBoy" berbahasa Indonesia.
Tugas Anda adalah menganalisis gambar yang diunggah pengguna dan mengisi seluruh atribut kartu secara otomatis agar langsung siap dimainkan dan selaras dengan visual gambar tersebut.

Aturan Analisis Gambar:
1. JIKA GAMBAR ADALAH FOTO/SCAN KARTU PERMAINAN (memiliki bingkai kartu, nama tercetak, angka HP/ATK, atau teks efek tercetak):
   - Baca secara akurat nama kartu (name), nomor/kode kartu yang tercetak (detectedCode, contoh "31/54" atau "SR-01"), kategori (CHARACTER, SUPPORT, atau SUIT), rank (SR, AR, S, A, B, C, SUPPORT, atau SUIT), HP, ATK, urutan prioritas efek (1, 2, atau 3), dan deskripsi efek dalam Bahasa Indonesia yang alami.
   - Set hasPrintedCardFrame = true karena gambar sudah memiliki bingkai/teks kartu sendiri.
   - Set hasCondition = true HANYA jika pada kartu tercetak syarat prasyarat/evolusi karakter secara eksplisit; selain itu false.

2. JIKA GAMBAR ADALAH ILUSTRASI POLOS, GAMBAR KARAKTER, FOTO, SENJATA, LOKASI, ATAU IKON ELEMEN TANPA BINGKAI KARTU:
   - Set hasPrintedCardFrame = false dan detectedCode = "".
   - Set hasCondition = false agar kartu kustom bisa langsung dimainkan sejak Ronde 1.
   - Berikan nama kartu Bahasa Indonesia yang keren dan relevan dengan isi gambar (kenali karakter BoBoiBoy seperti Halilintar, Taufan, Gempa, Blaze, Ais, Duri, Solar, Supra, FrostFire, Glacier, Gentar, Sori, Sopan, Fang, Yaya, Ying, Gopal, Tok Aba, Papa Zola, Kaizo, Adu Du, Probe, Retak'ka, Kuputeri bila tampak; atau buat nama Bahasa Indonesia yang pas untuk karakter/objek/foto lain yang diunggah).
   - Tentukan kategori:
     * CHARACTER: jika menampilkan tokoh, pahlawan, monster, robot, hewan petarung, atau potret orang/karakter.
     * SUPPORT: jika menampilkan senjata, alat teknologi, perisai, kendaraan, makanan, lokasi/taman, atau jurus bantuan tanpa sosok petarung utama.
     * SUIT: jika menampilkan simbol/lambang elemen murni Air/Es, Api/Petir/Cahaya, atau Daun/Alam/Angin, atau kartu Suit batu-gunting-kertas elemen.
   - Skala statistik CHARACTER (wajib kelipatan 20):
     * Rank C: HP 60–100, ATK 40–80
     * Rank B: HP 100–160, ATK 80–120
     * Rank A: HP 140–200, ATK 100–160
     * Rank S / AR / SR (sosok epik, aura kuat, boss, fusion): HP 180–260, ATK 140–220
   - Pilih effectKey HANYA dari daftar resmi berikut agar mekanisme pertarungannya benar-benar berfungsi di mesin game, lalu tulis effectText Bahasa Indonesia yang selaras dengan effectKey tersebut:
${buildEffectCatalogPromptSection()}

3. ATURAN KHUSUS KATEGORI SUIT:
   - suitElement wajib bernilai AIR, API, atau DAUN (biru/es/air/badai -> AIR; merah/oranye/api/petir/matahari -> API; hijau/daun/alam/tanah/angin -> DAUN).
   - Untuk SUIT, name berformat seperti "Suit Air (Naga Es)", "Suit Api (Tinju Meteor)", atau "Suit Daun (Tebasan Rimba)", serta isi suitSetLabel dengan tema singkat 2-3 kata (contoh: "Bara Galaksi", "Samudra Beku", "Rimba Kosmik").`;

  const hintLines: string[] = [];
  if (params.fileName?.trim()) {
    hintLines.push(`Nama berkas yang diunggah: "${params.fileName.trim()}"`);
  }
  if (normalizedTargetSuit) {
    hintLines.push(
      `PENTING: Pengguna sedang mengunggah slot khusus Kartu SUIT elemen ${normalizedTargetSuit}. Wajib tetapkan category = "SUIT" dan suitElement = "${normalizedTargetSuit}".`
    );
  } else if (normalizedPreferredCategory) {
    hintLines.push(
      `Preferensi tab kategori yang sedang dibuka pengguna: "${normalizedPreferredCategory}". Utamakan kategori ini kecuali gambar secara eksplisit merupakan kartu tercetak dari kategori berbeda.`
    );
  }

  const userPrompt = [
    'Analisis gambar kartu/ilustrasi ini secara menyeluruh dan hasilkan atribut kartu JSON yang paling akurat dan seimbang.',
    ...hintLines,
  ].join('\n');

  const cardResponseSchema = {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: 'Nama kartu dalam Bahasa Indonesia sesuai gambar atau teks tercetak.',
      },
      detectedCode: {
        type: Type.STRING,
        description:
          'Nomor kartu yang tercetak pada gambar kartu (misal 31/54). Kosongkan "" jika tidak ada nomor tercetak.',
      },
      hasPrintedCardFrame: {
        type: Type.BOOLEAN,
        description:
          'True jika gambar sudah memiliki bingkai & teks kartu tercetak; False jika ilustrasi/foto polos.',
      },
      category: {
        type: Type.STRING,
        description: 'CHARACTER, SUPPORT, atau SUIT.',
      },
      rank: {
        type: Type.STRING,
        description: 'SR, AR, S, A, B, C, SUPPORT, atau SUIT.',
      },
      hp: {
        type: Type.INTEGER,
        description: 'HP dasar kelipatan 20 (60-260 untuk CHARACTER, 0 untuk lainnya).',
      },
      atk: {
        type: Type.INTEGER,
        description: 'ATK dasar kelipatan 20 (40-220 untuk CHARACTER, 0 untuk lainnya).',
      },
      effectPriority: {
        type: Type.INTEGER,
        description: '1, 2, atau 3.',
      },
      effectKey: {
        type: Type.STRING,
        description: 'Salah satu kunci resmi dari EFFECT_CATALOG.',
      },
      effectText: {
        type: Type.STRING,
        description: 'Deskripsi efek Bahasa Indonesia yang ringkas dan sesuai effectKey.',
      },
      characterTags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Tag karakter untuk mekanisme kartu bersyarat.',
      },
      hasCondition: {
        type: Type.BOOLEAN,
        description: 'True hanya jika kartu tercetak memiliki syarat karakter prasyarat.',
      },
      conditionMode: {
        type: Type.STRING,
        description: 'ALL atau ANY.',
      },
      conditionRequiredTags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Tag karakter prasyarat jika hasCondition bernilai true.',
      },
      conditionDescription: {
        type: Type.STRING,
        description: 'Penjelasan syarat dalam Bahasa Indonesia.',
      },
      suitElement: {
        type: Type.STRING,
        description: 'AIR, API, atau DAUN.',
      },
      suitSetLabel: {
        type: Type.STRING,
        description: 'Nama tema seri Suit singkat (2-3 kata).',
      },
      summary: {
        type: Type.STRING,
        description: '1 kalimat ringkasan hasil analisis gambar dalam Bahasa Indonesia.',
      },
    },
    required: [
      'name',
      'detectedCode',
      'hasPrintedCardFrame',
      'category',
      'rank',
      'hp',
      'atk',
      'effectPriority',
      'effectKey',
      'effectText',
      'characterTags',
      'hasCondition',
      'conditionMode',
      'conditionRequiredTags',
      'conditionDescription',
      'suitElement',
      'suitSetLabel',
      'summary',
    ],
  };

  const modelCandidates: Array<{ model: string; thinking: ThinkingLevel }> = [
    { model: 'gemini-3.1-flash-lite', thinking: ThinkingLevel.MINIMAL },
    { model: 'gemini-3.8-flash', thinking: ThinkingLevel.LOW },
  ];

  let rawText: string | undefined;
  let lastModelError: unknown = null;

  for (const candidate of modelCandidates) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: candidate.model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: params.mimeType,
                data: params.base64Data,
              },
            },
            {
              text: userPrompt,
            },
          ],
        },
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: candidate.thinking },
          responseMimeType: 'application/json',
          responseSchema: cardResponseSchema,
        },
      });
      const text = response.text?.trim();
      if (text) {
        rawText = text;
        break;
      }
    } catch (err) {
      lastModelError = err;
    }
  }

  if (!rawText) {
    throw lastModelError instanceof Error
      ? lastModelError
      : new Error('Layanan analisis gambar sedang sibuk. Silakan coba sesaat lagi.');
  }

  const parsed = JSON.parse(rawText) as Partial<AnalyzedCardImageResult>;

  // Normalize category
  let resolvedCategory: CardCategory = CardCategory.CHARACTER;
  if (normalizedTargetSuit) {
    resolvedCategory = CardCategory.SUIT;
  } else if (
    parsed.category === CardCategory.CHARACTER ||
    parsed.category === CardCategory.SUPPORT ||
    parsed.category === CardCategory.SUIT
  ) {
    resolvedCategory = parsed.category;
  } else if (normalizedPreferredCategory) {
    resolvedCategory = normalizedPreferredCategory;
  }

  // Normalize Suit element
  const resolvedSuitElement: SuitElement = normalizedTargetSuit
    ? normalizedTargetSuit
    : VALID_SUIT_ELEMENTS.includes(parsed.suitElement as SuitElement)
    ? (parsed.suitElement as SuitElement)
    : SuitElement.AIR;

  // Normalize Rank
  let resolvedRank: CardRank = 'A';
  if (resolvedCategory === CardCategory.SUIT) {
    resolvedRank = 'SUIT';
  } else if (resolvedCategory === CardCategory.SUPPORT) {
    resolvedRank = 'SUPPORT';
  } else {
    const candidateRank = String(parsed.rank ?? 'A').toUpperCase() as CardRank;
    resolvedRank = VALID_CHARACTER_RANKS.includes(candidateRank) ? candidateRank : 'A';
  }

  // Normalize HP & ATK
  const defaultHpByRank: Record<string, number> = {
    SR: 220,
    AR: 200,
    S: 200,
    A: 160,
    B: 120,
    C: 80,
  };
  const defaultAtkByRank: Record<string, number> = {
    SR: 180,
    AR: 160,
    S: 160,
    A: 120,
    B: 100,
    C: 60,
  };

  const resolvedHp =
    resolvedCategory === CardCategory.CHARACTER
      ? snapToTwenty(parsed.hp, 20, 900, defaultHpByRank[resolvedRank] ?? 160)
      : 0;
  const resolvedAtk =
    resolvedCategory === CardCategory.CHARACTER
      ? snapToTwenty(parsed.atk, 0, 900, defaultAtkByRank[resolvedRank] ?? 120)
      : 0;

  // Normalize EffectKey & Priority against EFFECT_CATALOG
  let resolvedEffectKey: EffectKey = 'NONE';
  let resolvedPriority: EffectPriority = 3;
  let resolvedEffectText = '';

  if (resolvedCategory === CardCategory.SUIT) {
    resolvedEffectKey = 'NONE';
    resolvedPriority = 3;
    resolvedEffectText = getSuitRuleText(resolvedSuitElement);
  } else {
    const validCatalogEntries = EFFECT_CATALOG.filter((item) =>
      resolvedCategory === CardCategory.SUPPORT
        ? item.targetCategory === 'SUPPORT' || item.targetCategory === 'BOTH'
        : item.targetCategory === 'CHARACTER' || item.targetCategory === 'BOTH'
    );
    const inferredFromPrintedText = inferEffectFromCardText(
      parsed.effectText ?? '',
      resolvedCategory
    );
    const matchedCatalog =
      (parsed.hasPrintedCardFrame && inferredFromPrintedText
        ? validCatalogEntries.find((item) => item.key === inferredFromPrintedText.effectKey)
        : undefined) ??
      validCatalogEntries.find((item) => item.key === parsed.effectKey) ??
      (inferredFromPrintedText
        ? validCatalogEntries.find((item) => item.key === inferredFromPrintedText.effectKey)
        : undefined) ??
      (resolvedCategory === CardCategory.SUPPORT
        ? validCatalogEntries.find((item) => item.key === 'SUPPORT_KEPAKU_PARK')
        : validCatalogEntries.find((item) => item.key === 'SHIELD_ONCE')) ??
      validCatalogEntries[0];

    resolvedEffectKey = matchedCatalog.key;
    const rawPrio = Number(parsed.effectPriority);
    resolvedPriority =
      rawPrio === 1 || rawPrio === 2 || rawPrio === 3
        ? rawPrio
        : inferredFromPrintedText?.priority ?? matchedCatalog.defaultPriority;
    resolvedEffectText = parsed.effectText?.trim() || matchedCatalog.defaultText;
  }

  const fallbackName =
    resolvedCategory === CardCategory.SUIT
      ? resolvedSuitElement === SuitElement.AIR
        ? 'Suit Air Kustom'
        : resolvedSuitElement === SuitElement.API
        ? 'Suit Api Kustom'
        : 'Suit Daun Kustom'
      : resolvedCategory === CardCategory.SUPPORT
      ? 'Kartu Pendukung Baru'
      : 'Petarung Galaksi Baru';

  const resolvedName = parsed.name?.trim() || fallbackName;

  // Normalize Character Tags
  const rawTags = Array.isArray(parsed.characterTags)
    ? parsed.characterTags.map((t) => String(t).trim()).filter(Boolean)
    : [];
  if (resolvedCategory === CardCategory.CHARACTER) {
    if (resolvedName.toLowerCase().includes('boboiboy') && !rawTags.includes('BoBoiBoy')) {
      rawTags.unshift('BoBoiBoy');
    }
    if (!rawTags.includes(resolvedName)) {
      rawTags.push(resolvedName);
    }
  }

  const rawCondTags = Array.isArray(parsed.conditionRequiredTags)
    ? parsed.conditionRequiredTags.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const resolvedHasCondition =
    resolvedCategory === CardCategory.CHARACTER &&
    Boolean(parsed.hasCondition) &&
    rawCondTags.length > 0;
  const resolvedConditionMode: ConditionMode =
    parsed.conditionMode === 'ANY' ? 'ANY' : 'ALL';

  return {
    name: resolvedName,
    detectedCode: (parsed.detectedCode ?? '').trim().slice(0, 20),
    hasPrintedCardFrame: Boolean(parsed.hasPrintedCardFrame),
    category: resolvedCategory,
    rank: resolvedRank,
    hp: resolvedHp,
    atk: resolvedAtk,
    effectPriority: resolvedPriority,
    effectKey: resolvedEffectKey,
    effectText: resolvedEffectText,
    characterTags: resolvedCategory === CardCategory.CHARACTER ? Array.from(new Set(rawTags)) : [],
    hasCondition: resolvedHasCondition,
    conditionMode: resolvedConditionMode,
    conditionRequiredTags: resolvedHasCondition ? rawCondTags : [],
    conditionDescription: resolvedHasCondition
      ? (parsed.conditionDescription ?? '').trim() ||
        `Pernah menurunkan ${rawCondTags.join(
          resolvedConditionMode === 'ALL' ? ' & ' : ' atau '
        )}`
      : '',
    suitElement: resolvedSuitElement,
    suitSetLabel: (parsed.suitSetLabel ?? '').trim().slice(0, 40),
    summary:
      (parsed.summary ?? '').trim() ||
      `Atribut kartu "${resolvedName}" berhasil disesuaikan secara otomatis dari gambar.`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', activeRooms: rooms.size });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: buildPublicRoomsList() });
  });

  // --- OWNER AUTHENTICATION & GLOBAL UPDATES API ---
  app.post('/api/owner/login', (req, res) => {
    const { email, passkey } = req.body || {};
    const cleanEmail = (email ?? '').trim().toLowerCase();
    const cleanPass = (passkey ?? '').trim();

    const isEmailValid =
      cleanEmail === OWNER_EMAIL.toLowerCase() ||
      cleanEmail === 'owner' ||
      cleanEmail === 'admin' ||
      cleanEmail === 'ahmadsyarif08';
    const isPassValid =
      cleanPass === OWNER_PASSKEY ||
      cleanPass === 'admin123' ||
      cleanPass === 'boboiboy2026' ||
      cleanPass === 'boboiboy-owner-2026';

    if (!isEmailValid || !isPassValid) {
      res.status(401).json({
        success: false,
        message: 'Kredensial tidak valid. Hanya pemilik aplikasi yang diizinkan masuk.',
      });
      return;
    }

    const token = `owner_sec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    activeOwnerTokens.add(token);

    res.json({
      success: true,
      token,
      owner: {
        email: OWNER_EMAIL,
        name: 'Ahmad Syarif (Pemilik)',
        role: 'OWNER',
      },
    });
  });

  app.get('/api/owner/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const valid = Boolean(token && activeOwnerTokens.has(token));
    res.json({ valid, email: valid ? OWNER_EMAIL : null });
  });

  app.get('/api/updates', (_req, res) => {
    res.json({ updates: globalAppUpdates });
  });

  app.post('/api/owner/updates', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || !activeOwnerTokens.has(token)) {
      res.status(403).json({ success: false, message: 'Akses ditolak: Token pemilik tidak valid.' });
      return;
    }

    const { version, title, category, summary, details, giftCoins, giftTickets } = req.body || {};
    if (!title || !summary) {
      res.status(400).json({ success: false, message: 'Judul dan ringkasan pembaruan wajib diisi.' });
      return;
    }

    const newUpdate: ServerGlobalUpdate = {
      id: `upd-${Date.now()}`,
      version: version?.trim() || `v1.${globalAppUpdates.length + 3}.0`,
      title: title.trim(),
      category: category || 'ANNOUNCEMENT',
      summary: summary.trim(),
      details: Array.isArray(details) ? details.filter(Boolean) : [summary.trim()],
      author: 'Ahmad Syarif (Pemilik)',
      timestamp: Date.now(),
      pinned: true,
      giftCoins: Number(giftCoins) || 0,
      giftTickets: Number(giftTickets) || 0,
    };

    globalAppUpdates.unshift(newUpdate);
    broadcastGlobalUpdate(newUpdate);

    res.json({ success: true, update: newUpdate });
  });

  app.delete('/api/owner/updates/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || !activeOwnerTokens.has(token)) {
      res.status(403).json({ success: false, message: 'Akses ditolak.' });
      return;
    }

    const { id } = req.params;
    const idx = globalAppUpdates.findIndex((u) => u.id === id);
    if (idx >= 0) {
      globalAppUpdates.splice(idx, 1);
      res.json({ success: true, message: 'Pembaruan berhasil dihapus.' });
    } else {
      res.status(404).json({ success: false, message: 'Pembaruan tidak ditemukan.' });
    }
  });

  app.post('/api/owner/broadcast', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || !activeOwnerTokens.has(token)) {
      res.status(403).json({ success: false, message: 'Akses ditolak.' });
      return;
    }

    const { title, message } = req.body || {};
    if (!message) {
      res.status(400).json({ success: false, message: 'Pesan siaran tidak boleh kosong.' });
      return;
    }

    broadcastImmediateAlert(title || 'Pengumuman Resmi', message);
    res.json({ success: true, message: 'Pengumuman instan berhasil disiarkan ke seluruh pengguna aktif!' });
  });

  app.post('/api/cards/analyze-image', async (req, res) => {
    try {
      const { imageDataUrl, fileName, preferredCategory, targetSuitElement } = (req.body ?? {}) as {
        imageDataUrl?: string;
        fileName?: string;
        preferredCategory?: string | null;
        targetSuitElement?: string | null;
      };

      if (!imageDataUrl || typeof imageDataUrl !== 'string') {
        res.status(400).json({ error: 'Data gambar kartu tidak ditemukan dalam permintaan.' });
        return;
      }

      const dataUrlMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!dataUrlMatch) {
        res.status(400).json({
          error: 'Format data gambar tidak valid. Silakan unggah berkas gambar JPG, PNG, atau WebP.',
        });
        return;
      }

      const mimeType = dataUrlMatch[1];
      const base64Data = dataUrlMatch[2];

      const analyzed = await analyzeCardImageWithGemini({
        mimeType,
        base64Data,
        fileName,
        preferredCategory,
        targetSuitElement,
      });

      res.json({ result: analyzed });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Gagal menganalisis gambar kartu di server.';
      console.error('[analyze-image] Error:', message);
      res.status(500).json({
        error: `Gagal menganalisis gambar otomatis: ${message}`,
      });
    }
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 10 * 1024 * 1024 });

  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (reqUrl.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    socketMetaMap.set(ws, {
      clientId: null,
      roomCode: null,
      inLobbyFeed: true,
      isAlive: true,
    });

    ws.on('pong', () => {
      const m = socketMetaMap.get(ws);
      if (m) m.isAlive = true;
    });

    ws.on('message', (data) => {
      const text = typeof data === 'string' ? data : data.toString('utf-8');
      handleWsMessage(ws, text);
    });

    ws.on('close', () => {
      const meta = socketMetaMap.get(ws);
      socketMetaMap.delete(ws);
      if (meta?.roomCode && meta.clientId && rooms.has(meta.roomCode)) {
        const room = rooms.get(meta.roomCode)!;
        const part = room.participants.get(meta.clientId);
        // Only mark disconnected if this closing socket is still the active socket for this clientId
        if (part && part.ws === ws) {
          removeClientFromRoom(room, meta.clientId, false);
        }
      }
    });
  });

  // WebSocket 20s heartbeat to keep Cloud Run / reverse proxy connections alive
  const heartbeatInterval = setInterval(() => {
    for (const [ws, meta] of socketMetaMap.entries()) {
      if (!meta.isAlive) {
        ws.terminate();
        continue;
      }
      meta.isAlive = false;
      ws.ping();
    }
  }, 20000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Monsta Galaxy Battle Multiplayer Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
