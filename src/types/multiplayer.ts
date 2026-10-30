import type { FullBattleState } from '../engine/battleEngine.ts';
import type { CardDefinition, CardInstance, SuitArtSetId, SuitElement } from './game.ts';

export type RoomMode = 'KING_OF_THE_HILL' | 'TOURNAMENT' | 'PHYSICAL_SIMULATION';

export type MatchRulePreset = 'ROUNDS_3' | 'ROUNDS_5' | 'WINS_3' | 'WINS_5';

export type OnlineDeckSize = 5 | 10 | 15 | 20 | 30;

export type JoinRole = 'PLAYER' | 'REFEREE' | 'SPECTATOR';

export type SeatAssignmentTarget =
  | 'FIGHTER_1'
  | 'FIGHTER_2'
  | 'REFEREE'
  | 'QUEUE'
  | 'SPECTATOR';

export interface RoomParticipantView {
  clientId: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  isReferee: boolean;
  ready: boolean;
  spectatorOnly: boolean;
  deckCount: number;
  suitArtSet: SuitArtSetId;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  points: number;
}

export interface TournamentMatchItem {
  id: string;
  label: string;
  p1ClientId: string;
  p1Name: string;
  p2ClientId: string;
  p2Name: string;
  status: 'PENDING' | 'LIVE' | 'DONE';
  winnerClientId: string | 'DRAW' | null;
}

export interface RoomChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isReferee?: boolean;
}

export interface RefereeRulingBanner {
  id: string;
  refereeName: string;
  text: string;
  timestamp: number;
}

export interface RefereeInspectionPlayerView {
  hand: CardInstance[];
  deck: CardInstance[];
  pendingCharacterDefId: string | null;
  pendingSuit: SuitElement | null;
  pendingSupportDefId: string | null | 'SKIPPED';
}

export interface RefereeInspectionView {
  players: [RefereeInspectionPlayerView, RefereeInspectionPlayerView];
}

export interface OnlineLockStatus {
  charLocked: [boolean, boolean];
  suitLocked: [boolean, boolean];
  supportLocked: [boolean, boolean];
}

export interface RoomPublicSummary {
  code: string;
  roomName: string;
  hostName: string;
  hasReferee: boolean;
  refereeName: string | null;
  roomMode: RoomMode;
  deckSize: OnlineDeckSize;
  matchRule: MatchRulePreset;
  playerCount: number;
  inBattle: boolean;
}

export interface RoomStateView {
  code: string;
  roomName: string;
  isPublic: boolean;
  roomMode: RoomMode;
  deckSize: OnlineDeckSize;
  matchRule: MatchRulePreset;
  yourClientId: string;
  yourSeat: 0 | 1 | null;
  yourRole: 'PLAYER' | 'REFEREE' | 'SPECTATOR';
  refereeClientId: string | null;
  fighters: [string | null, string | null];
  challengerQueue: string[];
  participants: RoomParticipantView[];
  tournamentMatches: TournamentMatchItem[];
  activeTournamentMatchId: string | null;
  customCards: Record<string, CardDefinition>;
  battle: FullBattleState | null;
  lockStatus: OnlineLockStatus;
  isPaused: boolean;
  pauseReason: string | null;
  pausedByName: string | null;
  latestRefereeRuling: RefereeRulingBanner | null;
  refereeInspection: RefereeInspectionView | null;
  chat: RoomChatMessage[];
}

export type RefereeCommandPayload =
  | { kind: 'PAUSE_MATCH'; reason?: string }
  | { kind: 'RESUME_MATCH' }
  | { kind: 'ADVANCE_PHASE' }
  | { kind: 'RESET_SUIT_CLASH' }
  | { kind: 'UNLOCK_CHARACTER_PICKS' }
  | { kind: 'ADJUST_HP'; target: 0 | 1; delta: number }
  | { kind: 'ADJUST_ATK'; target: 0 | 1; delta: number }
  | { kind: 'FORCE_ROUND_WINNER'; winner: 0 | 1 | 'DRAW'; reason?: string }
  | { kind: 'DECLARE_MATCH_WINNER'; winner: 0 | 1 | 'DRAW'; reason?: string }
  | { kind: 'RESTART_MATCH' }
  | { kind: 'ANNOUNCE'; text: string };

export type ClientWsMessage =
  | { type: 'lobby:subscribe'; clientId: string; name: string }
  | {
      type: 'room:create';
      clientId: string;
      name: string;
      roomName: string;
      isPublic: boolean;
      roomMode: RoomMode;
      deckSize: OnlineDeckSize;
      matchRule: MatchRulePreset;
      deckIds: string[];
      suitArtSet: SuitArtSetId;
      joinRole?: JoinRole;
      customCards?: Record<string, CardDefinition>;
    }
  | {
      type: 'room:join';
      roomCode: string;
      clientId: string;
      name: string;
      deckIds: string[];
      suitArtSet: SuitArtSetId;
      joinRole?: JoinRole;
      customCards?: Record<string, CardDefinition>;
    }
  | { type: 'room:leave' }
  | {
      type: 'room:update_loadout';
      name?: string;
      deckIds: string[];
      suitArtSet: SuitArtSetId;
      customCards?: Record<string, CardDefinition>;
    }
  | { type: 'room:toggle_ready' }
  | { type: 'room:claim_seat'; seat: 0 | 1 }
  | { type: 'room:claim_referee' }
  | { type: 'room:leave_referee'; joinQueue: boolean }
  | { type: 'room:step_down'; spectatorOnly: boolean }
  | {
      type: 'host:assign_role';
      targetClientId: string;
      role: SeatAssignmentTarget;
    }
  | { type: 'host:swap_fighters' }
  | { type: 'host:transfer_host'; targetClientId: string }
  | {
      type: 'room:update_settings';
      roomMode: RoomMode;
      deckSize: OnlineDeckSize;
      matchRule: MatchRulePreset;
      isPublic: boolean;
    }
  | { type: 'room:start_battle' }
  | { type: 'room:generate_tournament' }
  | { type: 'room:next_match' }
  | { type: 'room:return_lobby' }
  | { type: 'room:chat'; text: string }
  | { type: 'referee:command'; command: RefereeCommandPayload }
  | { type: 'battle:pick_character'; round: number; uid: string }
  | { type: 'battle:submit_choice'; round: number; selectedUids: string[] }
  | { type: 'battle:pick_suit'; round: number; suitAttempt: number; suit: SuitElement }
  | { type: 'battle:advance_suit'; round: number; suitAttempt: number }
  | { type: 'battle:pick_support'; round: number; suitAttempt: number; supportUid: string | null }
  | { type: 'battle:next_round'; round: number }
  | {
      type: 'host:sync_physical_simulation';
      battle: FullBattleState | null;
      customCards?: Record<string, CardDefinition>;
      rulingText?: string;
    };

export type ServerWsMessage =
  | { type: 'lobby:rooms'; rooms: RoomPublicSummary[] }
  | { type: 'room:state'; room: RoomStateView }
  | { type: 'room:left' }
  | { type: 'global:update'; update: any }
  | { type: 'global:announcement'; title: string; message: string }
  | { type: 'error'; message: string };
