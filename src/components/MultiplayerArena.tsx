import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Flame,
  Gavel,
  Heart,
  Layers,
  Link2,
  LogOut,
  Megaphone,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import {
  CARD_BY_ID,
  deduplicateDeckIds,
  getAvailableSuitArtSets,
  getCustomOrEditedCardsForDeck,
  getSuitCardForSet,
  PRESET_DECKS,
  registerSessionCards,
} from '../data/cards';
import { canPlayCharacterCard } from '../engine/battleEngine';
import {
  CardCategory,
  SuitElement,
  type CardDefinition,
  type CardInstance,
  type SavedUserDeck,
  type SuitArtSetId,
} from '../types/game';
import type {
  ClientWsMessage,
  JoinRole,
  MatchRulePreset,
  OnlineDeckSize,
  RefereeCommandPayload,
  RoomMode,
  RoomPublicSummary,
  RoomStateView,
  SeatAssignmentTarget,
  ServerWsMessage,
} from '../types/multiplayer';
import {
  getFighterHpVisualState,
  isLegendaryCard,
  soundFx,
  useBattleAudioDirector,
} from '../utils/sound';
import { AudioControlWidget, BattleAudioNotice } from './AudioControlPanel';
import {
  ArenaClashFx,
  CardClashAura,
  loadClashFxEnabled,
  persistClashFxEnabled,
  resolveCardElementTheme,
  SuitClashFlare,
} from './ArenaClashFx';
import { CardBack, CardVisual } from './CardVisual';
import { ComboChainBanner, useComboPresentation } from './ComboChainBanner';
import { KoBannerOverlay, useKoPresentation } from './KoOverlay';
import { VictoryCelebrationOverlay } from './VictoryCelebrationOverlay';

const CLIENT_ID_SESSION_KEY = 'mgc_mp_device_session_id_v1';
const PLAYER_NAME_STORAGE_KEY = 'mgc_mp_player_name_v1';

const STAGGER_CLASSES = [
  'draw-stagger-0',
  'draw-stagger-1',
  'draw-stagger-2',
  'draw-stagger-3',
  'draw-stagger-4',
] as const;

const QUICK_REACTIONS = [
  'Siap bertarung!',
  'Adu Suit sengit!',
  'Waspada Efek 01!',
  'Kombo mantap!',
  'GG pertandingan seru!',
];

function getOrCreateDeviceSessionId(): string {
  try {
    const existing = sessionStorage.getItem(CLIENT_ID_SESSION_KEY);
    if (existing) return existing;
    const generated = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(CLIENT_ID_SESSION_KEY, generated);
    return generated;
  } catch {
    return `dev-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getStoredPlayerName(): string {
  try {
    const saved = localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // Ignore storage error
  }
  return `Petarung ${Math.floor(10 + Math.random() * 89)}`;
}

async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for iframe permissions
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.className = 'fixed -top-96 left-0 opacity-0 pointer-events-none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

const FlipRevealCard: React.FC<{
  flipKey: string;
  direction?: 'up' | 'down';
  backSize: 'xs' | 'sm' | 'md';
  backLabel?: string;
  children: React.ReactNode;
}> = ({ flipKey, direction = 'up', backSize, backLabel, children }) => (
  <div key={flipKey} className="card-perspective">
    <div className={direction === 'down' ? 'card-flip-reveal-down' : 'card-flip-reveal-up'}>
      <div className="card-face-front">{children}</div>
      <div className="card-face-back" aria-hidden="true">
        <CardBack size={backSize} label={backLabel} />
      </div>
    </div>
  </div>
);

interface MultiplayerArenaProps {
  customDeckIds: string[];
  savedDecks?: SavedUserDeck[];
  activeDeckId?: string;
  cardsVersion: number;
  initialRoomCode?: string | null;
  onClearInitialRoomCode?: () => void;
  onInspectCard: (card: CardDefinition) => void;
  onEditCard: (card: CardDefinition) => void;
  onOpenCreateCard: () => void;
  onOpenCreateSuitCard?: () => void;
  onOpenPhysicalHostWithBroadcast?: () => void;
  onSyncCardsFromRoom: () => void;
}

export const MultiplayerArena: React.FC<MultiplayerArenaProps> = ({
  customDeckIds,
  savedDecks,
  activeDeckId,
  cardsVersion,
  initialRoomCode,
  onClearInitialRoomCode,
  onInspectCard,
  onEditCard,
  onOpenCreateCard,
  onOpenCreateSuitCard,
  onOpenPhysicalHostWithBroadcast,
  onSyncCardsFromRoom,
}) => {
  const clientIdRef = useRef<string>(getOrCreateDeviceSessionId());
  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomCodeRef = useRef<string | null>(null);
  const autoJoinedInitialRef = useRef<boolean>(false);

  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>(() => getStoredPlayerName());
  const [selectedDeckChoice, setSelectedDeckChoice] = useState<string>(
    activeDeckId || 'custom-user-deck'
  );
  const [suitArtSet, setSuitArtSet] = useState<SuitArtSetId>(1);

  const availableSuitSets = useMemo(() => {
    void cardsVersion;
    return getAvailableSuitArtSets();
  }, [cardsVersion]);

  // Create & Join Role Settings (Fighter vs Host/Device Wasit vs Spectator)
  const [newRoomName, setNewRoomName] = useState<string>('Arena BoBoiBoy Live');
  const [isPublicRoom, setIsPublicRoom] = useState<boolean>(true);
  const [roomMode, setRoomMode] = useState<RoomMode>('KING_OF_THE_HILL');
  const [deckSize, setDeckSize] = useState<OnlineDeckSize>(10);
  const [matchRule, setMatchRule] = useState<MatchRulePreset>('ROUNDS_5');
  const [createRole, setCreateRole] = useState<JoinRole>('PLAYER');
  const [joinRole, setJoinRole] = useState<JoinRole>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('role') === 'referee') return 'REFEREE';
    } catch {
      // Ignore URL parse error
    }
    return 'PLAYER';
  });
  const [joinCodeInput, setJoinCodeInput] = useState<string>(initialRoomCode ?? '');

  // Live Server State
  const [publicRooms, setPublicRooms] = useState<RoomPublicSummary[]>([]);
  const [roomState, setRoomState] = useState<RoomStateView | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Live Battle & Device Wasit Console Interaction State
  const [selectedHandUid, setSelectedHandUid] = useState<string | null>(null);
  const [choiceSelection, setChoiceSelection] = useState<string[]>([]);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [clashFxEnabled, setClashFxEnabled] = useState<boolean>(() => loadClashFxEnabled());
  const [refereeConsoleOpen, setRefereeConsoleOpen] = useState<boolean>(true);
  const [refereeInspectMode, setRefereeInspectMode] = useState<boolean>(false);
  const [pauseReasonInput, setPauseReasonInput] = useState<string>('');
  const [refereeAnnounceInput, setRefereeAnnounceInput] = useState<string>('');
  const [dismissedRulingId, setDismissedRulingId] = useState<string | null>(null);
  const [pendingVerdictConfirm, setPendingVerdictConfirm] = useState<{
    label: string;
    command: RefereeCommandPayload;
  } | null>(null);
  const [zoneInspectModal, setZoneInspectModal] = useState<{
    title: string;
    cards: CardInstance[];
  } | null>(null);

  const deckOptions = useMemo(() => {
    void cardsVersion;
    const list: Array<{ id: string; name: string; cardIds: string[] }> = [];

    if (savedDecks && savedDecks.length > 0) {
      for (const slot of savedDecks) {
        const cleanIds = deduplicateDeckIds(slot.cardIds, slot.targetSize);
        if (cleanIds.length < 5) continue;
        list.push({
          id: slot.id,
          name: `${slot.id === activeDeckId ? 'Dek Aktif: ' : 'Slot: '}${slot.name} (${
            cleanIds.length
          } Unik)`,
          cardIds: cleanIds,
        });
      }
    } else {
      const uniqueCustom = deduplicateDeckIds(customDeckIds);
      if (uniqueCustom.length >= 5) {
        list.push({
          id: 'custom-user-deck',
          name: `Dek Kustom Anda (${uniqueCustom.length} Kartu Unik)`,
          cardIds: uniqueCustom,
        });
      }
    }

    for (const d of PRESET_DECKS) {
      list.push({
        id: d.id,
        name: d.name,
        cardIds: deduplicateDeckIds(d.cardIds),
      });
    }
    return list;
  }, [customDeckIds, savedDecks, activeDeckId, cardsVersion]);

  const currentChosenDeckIds = useMemo(() => {
    const found = deckOptions.find((d) => d.id === selectedDeckChoice) ?? deckOptions[0];
    return found.cardIds;
  }, [deckOptions, selectedDeckChoice]);

  const loadoutRef = useRef({
    playerName,
    deckIds: currentChosenDeckIds,
    suitArtSet,
  });
  useEffect(() => {
    loadoutRef.current = {
      playerName,
      deckIds: currentChosenDeckIds,
      suitArtSet,
    };
  }, [playerName, currentChosenDeckIds, suitArtSet]);

  const sendWs = useCallback((payload: ClientWsMessage) => {
    const sock = wsRef.current;
    if (sock && sock.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify(payload));
    } else {
      setErrorBanner('Sedang menghubungkan ke server multiplayer... Coba lagi sesaat.');
    }
  }, []);

  // Track battle phase transitions for audio cues across devices
  const prevBattleSnapRef = useRef<{
    phase: string | null;
    round: number;
    suitAttempt: number;
  }>({ phase: null, round: 0, suitAttempt: 0 });

  // Establish persistent WebSocket connection with auto-reconnect
  useEffect(() => {
    let unmounted = false;
    let reconnectTimer: number | undefined;
    let attempt = 0;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (unmounted) {
          socket.close();
          return;
        }
        attempt = 0;
        setWsConnected(true);
        setErrorBanner(null);

        const { playerName: curName, deckIds: curDeck, suitArtSet: curSuit } = loadoutRef.current;
        const customMap = getCustomOrEditedCardsForDeck(curDeck, curSuit);

        if (activeRoomCodeRef.current) {
          socket.send(
            JSON.stringify({
              type: 'room:join',
              roomCode: activeRoomCodeRef.current,
              clientId: clientIdRef.current,
              name: curName,
              deckIds: curDeck,
              suitArtSet: curSuit,
              customCards: customMap,
            } satisfies ClientWsMessage)
          );
        } else if (initialRoomCode && !autoJoinedInitialRef.current) {
          autoJoinedInitialRef.current = true;
          let initialRole: JoinRole = 'PLAYER';
          try {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('role') === 'referee') {
              initialRole = 'REFEREE';
            }
          } catch {
            // Ignore URL parse error
          }
          socket.send(
            JSON.stringify({
              type: 'room:join',
              roomCode: initialRoomCode.trim().toUpperCase(),
              clientId: clientIdRef.current,
              name: curName,
              deckIds: curDeck,
              suitArtSet: curSuit,
              joinRole: initialRole,
              customCards: customMap,
            } satisfies ClientWsMessage)
          );
          onClearInitialRoomCode?.();
        } else {
          socket.send(
            JSON.stringify({
              type: 'lobby:subscribe',
              clientId: clientIdRef.current,
              name: curName,
            } satisfies ClientWsMessage)
          );
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerWsMessage | { type: string };
          if (msg.type === 'global:update' || msg.type === 'global:announcement') {
            window.dispatchEvent(new CustomEvent('monsta:global_message', { detail: msg }));
            return;
          }
          if (msg.type === 'lobby:rooms') {
            setPublicRooms(msg.rooms);
          } else if (msg.type === 'room:state') {
            if (msg.room.customCards && Object.keys(msg.room.customCards).length > 0) {
              registerSessionCards(msg.room.customCards);
              onSyncCardsFromRoom();
            }

            activeRoomCodeRef.current = msg.room.code;
            setErrorBanner(null);

            const nextB = msg.room.battle;
            const prevB = prevBattleSnapRef.current;
            if (nextB) {
              if (prevB.phase === null || (prevB.phase === 'P1_PICK_CHARACTER' && nextB.phase !== 'P1_PICK_CHARACTER')) {
                soundFx.playCardDeploy();
              } else if (nextB.phase === 'SUIT_REVEAL' && prevB.phase !== 'SUIT_REVEAL') {
                soundFx.playSuitClash(nextB.lastSuitWinner === 'DRAW' ? 'draw' : 'win');
              } else if (
                (nextB.phase === 'ROUND_END' || nextB.phase === 'GAME_OVER') &&
                prevB.phase !== nextB.phase
              ) {
                soundFx.playRoundWin();
              }
              prevBattleSnapRef.current = {
                phase: nextB.phase,
                round: nextB.round,
                suitAttempt: nextB.suitAttemptInRound,
              };
            } else {
              prevBattleSnapRef.current = { phase: null, round: 0, suitAttempt: 0 };
            }

            setRoomState(msg.room);
          } else if (msg.type === 'room:left') {
            activeRoomCodeRef.current = null;
            setRoomState(null);
            setSelectedHandUid(null);
            setChoiceSelection([]);
          } else if (msg.type === 'error') {
            setErrorBanner(msg.message);
          }
        } catch {
          // Ignore malformed frame
        }
      };

      socket.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        const delay = Math.min(3500, 700 + attempt * 600);
        attempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [initialRoomCode, onClearInitialRoomCode, onSyncCardsFromRoom]);

  // Save player name locally
  const handleNameChange = (val: string) => {
    setPlayerName(val);
    try {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, val);
    } catch {
      // Ignore
    }
  };

  // Sync updated loadout to server when inside room lobby
  const handleSyncLoadoutToRoom = (
    nextDeckChoice: string,
    nextSuit: SuitArtSetId,
    nextName?: string
  ) => {
    const deckObj = deckOptions.find((d) => d.id === nextDeckChoice) ?? deckOptions[0];
    const customMap = getCustomOrEditedCardsForDeck(deckObj.cardIds, nextSuit);
    sendWs({
      type: 'room:update_loadout',
      name: nextName ?? playerName,
      deckIds: deckObj.cardIds,
      suitArtSet: nextSuit,
      customCards: customMap,
    });
  };

  const handleCreateRoom = () => {
    setErrorBanner(null);
    const customMap = getCustomOrEditedCardsForDeck(currentChosenDeckIds, suitArtSet);
    sendWs({
      type: 'room:create',
      clientId: clientIdRef.current,
      name: playerName,
      roomName: newRoomName,
      isPublic: isPublicRoom,
      roomMode,
      deckSize,
      matchRule,
      deckIds: currentChosenDeckIds,
      suitArtSet,
      joinRole: createRole,
      customCards: customMap,
    });
  };

  const handleJoinRoomByCode = (codeToJoin: string, roleOverride?: JoinRole) => {
    const clean = codeToJoin.trim().toUpperCase();
    if (!clean) {
      setErrorBanner('Masukkan Kode Room terlebih dahulu.');
      return;
    }
    setErrorBanner(null);
    const customMap = getCustomOrEditedCardsForDeck(currentChosenDeckIds, suitArtSet);
    sendWs({
      type: 'room:join',
      roomCode: clean,
      clientId: clientIdRef.current,
      name: playerName,
      deckIds: currentChosenDeckIds,
      suitArtSet,
      joinRole: roleOverride ?? joinRole,
      customCards: customMap,
    });
  };

  const handleCopyInvite = async (mode: 'code' | 'link' | 'referee_link') => {
    if (!roomState) return;
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const text =
      mode === 'code'
        ? roomState.code
        : mode === 'referee_link'
        ? `${baseUrl}?room=${roomState.code}&role=referee`
        : `${baseUrl}?room=${roomState.code}`;
    const ok = await copyTextSafe(text);
    setCopyFeedback(
      ok
        ? mode === 'code'
          ? `Kode ${roomState.code} tersalin!`
          : mode === 'referee_link'
          ? 'Link khusus Device Wasit berhasil disalin! Buka di tablet/HP pengadil.'
          : 'Link undangan pemain berhasil disalin! Kirim ke perangkat lain.'
        : `Bagikan kode: ${roomState.code}`
    );
    window.setTimeout(() => setCopyFeedback(null), 2800);
  };

  const sendRefereeCommand = useCallback(
    (command: RefereeCommandPayload) => {
      sendWs({ type: 'referee:command', command });
      setPendingVerdictConfirm(null);
    },
    [sendWs]
  );

  // Combat HP delta & Deck pulse animations for Live Online Battle
  const battle = roomState?.battle ?? null;
  const { activeKo, koShaking, dismissKo } = useKoPresentation(battle, clashFxEnabled);
  const { activeCombo, dismissCombo } = useComboPresentation(battle, clashFxEnabled);
  const mySeat = roomState?.yourSeat ?? null;
  const myViewIdx: 0 | 1 = mySeat === 1 ? 1 : 0;
  const oppViewIdx: 0 | 1 = myViewIdx === 0 ? 1 : 0;

  const audioDirector = useBattleAudioDirector(battle, {
    perspectiveIndex: myViewIdx,
    isSpectator: mySeat === null,
  });

  const myBattlePlayer = battle ? battle.players[myViewIdx] : null;
  const oppBattlePlayer = battle ? battle.players[oppViewIdx] : null;

  const prevHpRef = useRef<{
    myUid: string | null;
    myHp: number;
    oppUid: string | null;
    oppHp: number;
  }>({ myUid: null, myHp: 0, oppUid: null, oppHp: 0 });

  const [combatFx, setCombatFx] = useState<{
    id: number;
    myDelta: number | null;
    oppDelta: number | null;
    attackerSide: 'me' | 'opp' | null;
  } | null>(null);

  useEffect(() => {
    const curMyUid = myBattlePlayer?.active?.instance.uid ?? null;
    const curMyHp = myBattlePlayer?.active?.currentHp ?? 0;
    const curOppUid = oppBattlePlayer?.active?.instance.uid ?? null;
    const curOppHp = oppBattlePlayer?.active?.currentHp ?? 0;

    const prev = prevHpRef.current;
    const myDelta =
      curMyUid && curMyUid === prev.myUid && curMyHp !== prev.myHp ? curMyHp - prev.myHp : null;
    const oppDelta =
      curOppUid && curOppUid === prev.oppUid && curOppHp !== prev.oppHp
        ? curOppHp - prev.oppHp
        : null;

    prevHpRef.current = {
      myUid: curMyUid,
      myHp: curMyHp,
      oppUid: curOppUid,
      oppHp: curOppHp,
    };

    if (myDelta !== null || oppDelta !== null) {
      if ((myDelta ?? 0) < 0 || (oppDelta ?? 0) < 0) {
        soundFx.playHit();
      }
      const attackerSide: 'me' | 'opp' | null =
        oppDelta !== null && oppDelta < 0 && !(myDelta !== null && myDelta < 0)
          ? 'me'
          : myDelta !== null && myDelta < 0 && !(oppDelta !== null && oppDelta < 0)
          ? 'opp'
          : null;

      const fxId = Date.now();
      setCombatFx({ id: fxId, myDelta, oppDelta, attackerSide });
      const timer = window.setTimeout(() => {
        setCombatFx((c) => (c?.id === fxId ? null : c));
      }, 650);
      return () => window.clearTimeout(timer);
    }
  }, [
    myBattlePlayer?.active?.instance.uid,
    myBattlePlayer?.active?.currentHp,
    oppBattlePlayer?.active?.instance.uid,
    oppBattlePlayer?.active?.currentHp,
  ]);

  const toggleClashFx = () => {
    setClashFxEnabled((prev) => {
      const next = !prev;
      persistClashFxEnabled(next);
      return next;
    });
  };

  const mpCombatSignal = useMemo(
    () =>
      combatFx
        ? {
            id: combatFx.id,
            attackerSide:
              combatFx.attackerSide === 'me'
                ? ('left' as const)
                : combatFx.attackerSide === 'opp'
                ? ('right' as const)
                : null,
            leftDelta: combatFx.myDelta,
            rightDelta: combatFx.oppDelta,
          }
        : null,
    [combatFx]
  );

  const handleSendChat = (textToSend?: string) => {
    const msgText = (textToSend ?? chatInput).trim();
    if (!msgText) return;
    sendWs({ type: 'room:chat', text: msgText });
    if (!textToSend) setChatInput('');
  };

  // =========================================================================
  // VIEW 1: MULTIPLAYER LOBBY (CREATE / JOIN / BROWSE PUBLIC ROOMS)
  // =========================================================================
  if (!roomState) {
    return (
      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="text-xs font-mono text-amber-400">
              WebSocket Real-Time · Mendukung 2, 3, 4 hingga Banyak Perangkat Sekaligus
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-display font-extrabold text-white">
              Multiplayer Online Lintas Perangkat
            </h1>
            <p className="mt-1.5 text-sm text-slate-400 max-w-2xl leading-relaxed">
              Mainkan duel kartu 1 vs 1 dari 2 HP/laptop berbeda secara serentak, atau undang 3+ perangkat untuk bermain dalam mode <strong className="text-slate-200">Raja Arena (Antrean Penantang)</strong> maupun <strong className="text-slate-200">Turnamen Multi-Perangkat</strong> dengan penonton live!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-300">
            <div>
              Status Server:{' '}
              <span className={wsConnected ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                {wsConnected ? 'Terhubung Live' : 'Menghubungkan...'}
              </span>
            </div>
            <AudioControlWidget />
          </div>
        </div>

        {errorBanner && (
          <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs sm:text-sm text-rose-200 flex items-center justify-between gap-3">
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-rose-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Cols: Identity, Loadout, Create Room & Join by Code */}
          <div className="lg:col-span-7 space-y-6">
            {/* Player Identity & Unique Deck Selection */}
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-display font-bold text-white">
                  1. Profil Perangkat &amp; Dek Unik Anda
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {onOpenCreateSuitCard && (
                    <button
                      type="button"
                      onClick={onOpenCreateSuitCard}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Upload Kartu Suit</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenCreateCard}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Kartu Kustom</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nama Pemain di Perangkat Ini
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    maxLength={24}
                    placeholder="Contoh: BoBoiBoy Pemain 1"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Seri Kartu Suit (Ikut Tersinkron ke Lawan)
                  </label>
                  <select
                    value={suitArtSet}
                    onChange={(e) => setSuitArtSet(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    {availableSuitSets.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Pilih Dek Unik (Kartu Kustom/Diedit ikut tersinkron otomatis ke lawan!)
                </label>
                <select
                  value={selectedDeckChoice}
                  onChange={(e) => setSelectedDeckChoice(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  {deckOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Join Room by Code */}
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-display font-bold text-white">
                  2. Gabung ke Room Perangkat Lain
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Masukkan Kode 6 Karakter dari temanmu. Anda dapat masuk sebagai Petarung, mengambil peran <strong className="text-emerald-300">Device Wasit (Pengadil)</strong>, atau menjadi Penonton Live.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Peran Perangkat Saat Masuk Room
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setJoinRole('PLAYER')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                      joinRole === 'PLAYER'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>Petarung / Antre</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinRole('REFEREE')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                      joinRole === 'REFEREE'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    <span>Device Wasit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinRole('SPECTATOR')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                      joinRole === 'SPECTATOR'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Penonton Live</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoinRoomByCode(joinCodeInput);
                  }}
                  maxLength={8}
                  placeholder="KODE ROOM (misal: BF82KA)"
                  className="flex-1 px-4 py-3 text-base font-mono font-bold tracking-widest uppercase bg-[#0B1120] border border-slate-700 rounded-xl text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  disabled={!wsConnected}
                  onClick={() => handleJoinRoomByCode(joinCodeInput)}
                  className={`px-6 py-3 text-sm font-bold disabled:bg-slate-800 disabled:text-slate-500 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                    joinRole === 'REFEREE'
                      ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {joinRole === 'REFEREE' ? 'Masuk Jadi Wasit' : 'Gabung Room'}
                </button>
              </div>
            </div>

            {/* Create New Multi-Device Room */}
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-lg font-display font-bold text-white">
                  3. Buat Room Multiplayer Baru (Host Pemain atau Host Wasit)
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Pilih apakah perangkat ini ikut bertarung sebagai Petarung 1 atau bertugas khusus sebagai <strong className="text-emerald-300">Host &amp; Device Wasit (Layar Pengadil / Meja Tengah)</strong> untuk 2+ perangkat pemain lain.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Peran Perangkat Host Pembuat Room
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-[#0B1120] border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCreateRole('PLAYER')}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${
                      createRole === 'PLAYER'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Swords className="w-4 h-4" />
                    <span>Host &amp; Petarung 1 (Ikut Main)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateRole('REFEREE')}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${
                      createRole === 'REFEREE'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Gavel className="w-4 h-4" />
                    <span>Host &amp; Device Wasit (Layar Meja)</span>
                  </button>
                </div>
                {createRole === 'REFEREE' && (
                  <p className="mt-2 text-xs text-emerald-300/90 leading-relaxed">
                    Mode Device Wasit aktif: Kursi Petarung 1 &amp; 2 akan dikosongkan untuk 2 perangkat pemain. Perangkat Anda memegang kendali Jeda/Time-Out, Inspeksi Kartu Rahasia, Koreksi HP/ATK, dan Keputusan Ronde.
                  </p>
                )}
                {onOpenPhysicalHostWithBroadcast && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="text-xs text-slate-400">
                      Ingin memimpin duel 2 pemain yang memakai <strong className="text-slate-200">kartu fisik asli</strong> di meja nyata + siaran layar penonton?
                    </span>
                    <button
                      type="button"
                      onClick={onOpenPhysicalHostWithBroadcast}
                      className="px-3.5 py-2 text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      <span>Buka Host Kartu Asli + Siaran Live</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nama Room
                  </label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    maxLength={28}
                    className="w-full px-3.5 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Visibilitas Room
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setIsPublicRoom(true)}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                        isPublicRoom ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Publik (Lobi)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPublicRoom(false)}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                        !isPublicRoom ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Privat (Kode)
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Sistem Multi-Perangkat (2 hingga 8+ Perangkat)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRoomMode('KING_OF_THE_HILL')}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      roomMode === 'KING_OF_THE_HILL'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Duel &amp; Raja Arena (Pemenang Bertahan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomMode('TOURNAMENT')}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      roomMode === 'TOURNAMENT'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Turnamen Liga Multi-Perangkat
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Ukuran Dek Unik (1x Pakai)
                  </label>
                  <div className="grid grid-cols-5 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                    {([5, 10, 15, 20, 30] as OnlineDeckSize[]).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setDeckSize(sz)}
                        className={`py-2 px-1 text-xs font-mono font-semibold rounded-lg transition-colors tabular-nums whitespace-nowrap shrink-0 ${
                          deckSize === sz
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target Kemenangan
                  </label>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                    {[
                      { id: 'ROUNDS_3' as MatchRulePreset, label: '3 Rnd' },
                      { id: 'ROUNDS_5' as MatchRulePreset, label: '5 Rnd' },
                      { id: 'WINS_3' as MatchRulePreset, label: '3 Mng' },
                      { id: 'WINS_5' as MatchRulePreset, label: '5 Mng' },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setMatchRule(r.id)}
                        className={`py-2 px-1 text-xs font-mono font-semibold rounded-lg transition-colors tabular-nums whitespace-nowrap shrink-0 ${
                          matchRule === r.id
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!wsConnected}
                onClick={handleCreateRoom}
                className={`w-full py-3.5 px-6 text-sm font-bold disabled:bg-slate-800 disabled:text-slate-500 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-lg ${
                  createRole === 'REFEREE'
                    ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {createRole === 'REFEREE' ? (
                  <>
                    <Gavel className="w-4 h-4" />
                    <span>Buka Room sebagai Host &amp; Device Wasit</span>
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    <span>Buat Room &amp; Dapatkan Link Undangan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right 5 Cols: Live Public Rooms Discovery */}
          <div className="lg:col-span-5 bg-[#131C31] border border-slate-800 rounded-2xl p-6 space-y-5 sticky top-20">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-display font-bold text-white">
                  Daftar Room Publik Aktif
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Klik Gabung untuk bertanding atau masuk sebagai Device Wasit bila kursi pengadil kosong.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  sendWs({
                    type: 'lobby:subscribe',
                    clientId: clientIdRef.current,
                    name: playerName,
                  })
                }
                aria-label="Segarkan daftar room"
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {publicRooms.length === 0 ? (
              <div className="py-14 px-4 text-center space-y-2">
                <Users className="w-9 h-9 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-300">
                  Belum ada Room Publik yang sedang terbuka.
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Buat Room baru di sebelah kiri sebagai Pemain maupun Device Wasit, lalu bagikan Link Undangan ke perangkat lain!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 max-h-[480px] overflow-y-auto pr-1">
                {publicRooms.map((rm) => (
                  <div
                    key={rm.code}
                    className="py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-display font-bold text-white truncate">
                        {rm.roomName}
                      </div>
                      <div className="mt-0.5 text-xs font-mono text-slate-400 tabular-nums">
                        <span className="text-amber-300 font-semibold">{rm.code}</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>{rm.playerCount} Perangkat</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>
                          {rm.roomMode === 'PHYSICAL_SIMULATION'
                            ? 'Simulasi Kartu Asli'
                            : `${rm.deckSize} Kartu`}
                        </span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span className={rm.hasReferee ? 'text-emerald-300' : 'text-slate-400'}>
                          {rm.roomMode === 'PHYSICAL_SIMULATION'
                            ? 'Siaran Meja Fisik'
                            : rm.hasReferee
                            ? `Wasit: ${rm.refereeName}`
                            : 'Tanpa Wasit'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Host: {rm.hostName} ·{' '}
                        {rm.inBattle ? 'Sedang Tanding Live' : 'Menunggu di Lobi'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!rm.hasReferee && rm.roomMode !== 'PHYSICAL_SIMULATION' && (
                        <button
                          type="button"
                          onClick={() => handleJoinRoomByCode(rm.code, 'REFEREE')}
                          className="px-3 py-2 text-xs font-bold bg-slate-800 hover:bg-emerald-400 hover:text-slate-950 text-emerald-300 border border-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
                        >
                          Jadi Wasit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          handleJoinRoomByCode(
                            rm.code,
                            rm.roomMode === 'PHYSICAL_SIMULATION' ? 'SPECTATOR' : undefined
                          )
                        }
                        className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        {rm.roomMode === 'PHYSICAL_SIMULATION' ? 'Tonton Live' : 'Gabung'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Derived Room Helpers
  const meParticipant = roomState.participants.find((p) => p.clientId === roomState.yourClientId);
  const isHost = Boolean(meParticipant?.isHost);
  const isReferee = roomState.yourRole === 'REFEREE';
  const refereePart = roomState.refereeClientId
    ? roomState.participants.find((p) => p.clientId === roomState.refereeClientId)
    : undefined;
  const hasConnectedReferee = Boolean(refereePart && refereePart.connected);
  const canManageRoom = isHost || isReferee;
  const canActAsMatchOfficial = isReferee || (isHost && !hasConnectedReferee);

  const seat0Part = roomState.fighters[0]
    ? roomState.participants.find((p) => p.clientId === roomState.fighters[0])
    : undefined;
  const seat1Part = roomState.fighters[1]
    ? roomState.participants.find((p) => p.clientId === roomState.fighters[1])
    : undefined;
  const activeContendersCount = roomState.participants.filter(
    (p) => p.connected && !p.spectatorOnly && !p.isReferee
  ).length;
  const queuePosition = roomState.challengerQueue.indexOf(roomState.yourClientId);

  const matchRuleLabel =
    roomState.matchRule === 'ROUNDS_3'
      ? '3 Ronde'
      : roomState.matchRule === 'ROUNDS_5'
      ? '5 Ronde'
      : roomState.matchRule === 'WINS_3'
      ? 'Target 3 Menang'
      : 'Target 5 Menang';

  // =========================================================================
  // VIEW 2: ACTIVE LIVE BATTLE ACROSS 2+ DEVICES (FIGHTERS + SPECTATORS)
  // =========================================================================
  if (battle && myBattlePlayer && oppBattlePlayer) {
    const { phase, round, targetWins: winGoal } = battle;
    const isSpectator = mySeat === null;
    const activeChoice = battle.choiceQueue[0] ?? null;
    const isMyChoiceTurn = !isSpectator && activeChoice?.playerIndex === mySeat;

    const myCharLocked = !isSpectator ? roomState.lockStatus.charLocked[mySeat] : false;
    const oppCharLocked = !isSpectator
      ? roomState.lockStatus.charLocked[mySeat === 0 ? 1 : 0]
      : false;

    const mySuitLocked = !isSpectator ? roomState.lockStatus.suitLocked[mySeat] : false;
    const oppSuitLocked = !isSpectator
      ? roomState.lockStatus.suitLocked[mySeat === 0 ? 1 : 0]
      : false;

    const mySupLocked = !isSpectator ? roomState.lockStatus.supportLocked[mySeat] : false;
    const oppSupLocked = !isSpectator
      ? roomState.lockStatus.supportLocked[mySeat === 0 ? 1 : 0]
      : false;

    const selectedHandDef =
      !isSpectator && selectedHandUid
        ? CARD_BY_ID[myBattlePlayer.hand.find((c) => c.uid === selectedHandUid)?.defId ?? '']
        : null;

    const getOnlineHeadline = (): { title: string; detail: string } => {
      if (phase === 'P1_PICK_CHARACTER') {
        if (isSpectator) {
          return {
            title: `Ronde ${round} — Kedua Petarung Sedang Memilih Karakter`,
            detail: `Status kunci kartu: ${battle.players[0].name} (${
              roomState.lockStatus.charLocked[0] ? 'Sudah Kunci' : 'Memilih...'
            }) · ${battle.players[1].name} (${
              roomState.lockStatus.charLocked[1] ? 'Sudah Kunci' : 'Memilih...'
            })`,
          };
        }
        if (myCharLocked) {
          return {
            title: 'Kartu Karakter Anda Sudah Dikunci!',
            detail: `Menunggu ${oppBattlePlayer.name} mengunci Kartu Karakter di perangkatnya...`,
          };
        }
        return {
          title: `Ronde ${round} — Pilih Kartu Karakter Unik Anda`,
          detail: oppCharLocked
            ? `${oppBattlePlayer.name} sudah siap mengunci kartu! Pilih 1 Karakter dari tanganmu untuk membuka duel.`
            : 'Kedua perangkat memilih secara bersamaan. Klik 1 Kartu Karakter di tangan bawah.',
        };
      }

      if (phase === 'INTERACTIVE_CHOICE' && activeChoice) {
        const chooserName = battle.players[activeChoice.playerIndex].name;
        return {
          title: `Resolusi Efek Kartu · ${chooserName}`,
          detail: isMyChoiceTurn
            ? activeChoice.subtitle
            : `Menunggu ${chooserName} memilih target efek kartu di perangkatnya...`,
        };
      }

      if (phase === 'P1_PICK_SUIT') {
        if (isSpectator) {
          return {
            title: `Adu Suit #${battle.suitAttemptInRound} — Penentuan Serangan`,
            detail: `${battle.players[0].name} (${
              roomState.lockStatus.suitLocked[0] ? 'Siap' : 'Memilih...'
            }) vs ${battle.players[1].name} (${
              roomState.lockStatus.suitLocked[1] ? 'Siap' : 'Memilih...'
            })`,
          };
        }
        if (mySuitLocked) {
          return {
            title: `Suit Anda Terkunci (${myBattlePlayer.selectedSuit ?? 'Rahasia'})`,
            detail: `Menunggu ${oppBattlePlayer.name} memilih Suit di perangkatnya...`,
          };
        }
        return {
          title: `Adu Suit #${battle.suitAttemptInRound} — Pilih Air, Api, atau Daun!`,
          detail: oppSuitLocked
            ? `${oppBattlePlayer.name} sudah mengunci Suit! Pilih elemenmu sekarang untuk membuka aduan.`
            : 'Pilih elemen Suit secara serentak dari perangkat masing-masing.',
        };
      }

      if (phase === 'SUIT_REVEAL') {
        return {
          title:
            battle.lastSuitWinner === 'DRAW'
              ? 'Hasil Adu Suit: SERI!'
              : `${battle.players[battle.lastSuitWinner ?? 0].name} Memenangkan Adu Suit!`,
          detail: isSpectator
            ? 'Menunggu petarung melanjutkan ke jendela Kartu Pendukung / Serangan.'
            : 'Klik tombol Lanjutkan untuk masuk ke tahap Kartu Pendukung atau melancarkan serangan.',
        };
      }

      if (phase === 'P1_PICK_SUPPORT' || phase === 'P2_PICK_SUPPORT') {
        if (isSpectator) {
          return {
            title: 'Jendela Kartu Pendukung Sebelum Serangan',
            detail: 'Petarung yang memegang Kartu Pendukung sedang memutuskan aktivasi efek.',
          };
        }
        if (mySupLocked) {
          return {
            title: 'Keputusan Pendukung Terkunci',
            detail: `Menunggu ${oppBattlePlayer.name} menyelesaikan opsi Kartu Pendukung...`,
          };
        }
        return {
          title: 'Jendela Kartu Pendukung Anda!',
          detail: oppSupLocked
            ? 'Klik Kartu Pendukung di tangan bawah untuk mengaktifkannya sekarang, atau klik Lewati & Serang.'
            : 'Kedua petarung memiliki Kartu Pendukung — pilih atau lewati sekarang.',
        };
      }

      if (phase === 'ROUND_END') {
        return {
          title: `Ronde ${round} Selesai`,
          detail: battle.roundSummaryText ?? 'Siap melangkah ke ronde berikutnya.',
        };
      }

      return {
        title:
          battle.winnerIndex === 'DRAW'
            ? 'Pertandingan Selesai — Hasil Seri!'
            : `Pertandingan Selesai — ${
                battle.players[battle.winnerIndex === 1 ? 1 : 0].name
              } Menang!`,
        detail: battle.winReason ?? '',
      };
    };

    const headline = getOnlineHeadline();
    const myWonLastSuit = battle.lastSuitWinner === myViewIdx;
    const oppWonLastSuit = battle.lastSuitWinner === oppViewIdx;
    const refInspection = isReferee && refereeInspectMode ? roomState.refereeInspection : null;
    const topInspectedData = refInspection ? refInspection.players[oppViewIdx] : null;
    const bottomInspectedData = refInspection ? refInspection.players[myViewIdx] : null;
    const activeRulingBanner =
      roomState.latestRefereeRuling &&
      roomState.latestRefereeRuling.id !== dismissedRulingId
        ? roomState.latestRefereeRuling
        : null;

    return (
      <section className="max-w-[1420px] mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* Top Online Room Status & Multi-Device Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#131C31] border border-slate-800 rounded-xl">
          <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-mono tabular-nums">
            <span className="font-bold text-amber-400">Room {roomState.code}</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-white font-semibold">
              Ronde {round}
              {battle.maxRounds ? `/${battle.maxRounds}` : ''}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-slate-300">
              {roomState.participants.filter((p) => p.connected).length} Perangkat Live
            </span>
            {refereePart && (
              <>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-emerald-300 font-semibold">
                  Wasit: {refereePart.name}
                  {isReferee ? ' (Perangkat Anda)' : ''}
                </span>
              </>
            )}
            {isSpectator && !isReferee && (
              <>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-sky-300 font-semibold">
                  {queuePosition >= 0
                    ? `Antrean Penantang #${queuePosition + 1}`
                    : 'Mode Penonton Live'}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSpectator && !isReferee && !hasConnectedReferee && (
              <button
                type="button"
                onClick={() => sendWs({ type: 'room:claim_referee' })}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Gavel className="w-3.5 h-3.5" />
                <span>Jadi Device Wasit</span>
              </button>
            )}

            {canActAsMatchOfficial && (
              <button
                type="button"
                onClick={() => setRefereeConsoleOpen((prev) => !prev)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  refereeConsoleOpen
                    ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-300'
                }`}
              >
                <Gavel className="w-3.5 h-3.5" />
                <span>{refereeConsoleOpen ? 'Tutup Konsol Wasit' : 'Buka Konsol Wasit'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleCopyInvite('link')}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Undang Perangkat</span>
            </button>

            <button
              type="button"
              onClick={toggleClashFx}
              aria-label={clashFxEnabled ? 'Matikan efek partikel' : 'Nyalakan efek partikel'}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                clashFxEnabled
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {clashFxEnabled ? 'Partikel' : 'Partikel Mati'}
              </span>
            </button>

            <AudioControlWidget compact />

            {(canManageRoom || !isSpectator) && (
              <button
                type="button"
                onClick={() => sendWs({ type: 'room:return_lobby' })}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Lobi Room
              </button>
            )}

            <button
              type="button"
              onClick={() => sendWs({ type: 'room:leave' })}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        <BattleAudioNotice
          isCriticalPhase={audioDirector.isCriticalPhase}
          hasLegendaryActive={audioDirector.hasLegendaryActive}
          criticalNames={audioDirector.criticalNames}
          legendaryNames={audioDirector.legendaryNames}
        />

        {copyFeedback && (
          <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 text-center">
            {copyFeedback}
          </div>
        )}

        {errorBanner && (
          <div className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-3">
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-rose-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ARENA-WIDE REFEREE PAUSE BANNER */}
        {roomState.isPaused && (
          <div className="px-4 py-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <Pause className="w-5 h-5 text-amber-300 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <div className="text-sm font-display font-bold text-amber-200">
                  Pertandingan Dijeda oleh Wasit {roomState.pausedByName ? `(${roomState.pausedByName})` : ''}
                </div>
                <p className="text-xs text-slate-200 mt-0.5">
                  {roomState.pauseReason ?? 'Seluruh aksi kartu petarung dikunci sementara hingga Wasit melanjutkan laga.'}
                </p>
              </div>
            </div>
            {canActAsMatchOfficial && (
              <button
                type="button"
                onClick={() => sendRefereeCommand({ kind: 'RESUME_MATCH' })}
                className="px-4 py-2 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Lanjutkan Pertandingan</span>
              </button>
            )}
          </div>
        )}

        {/* ARENA-WIDE OFFICIAL REFEREE ANNOUNCEMENT BANNER */}
        {activeRulingBanner && (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm min-w-0">
              <Megaphone className="w-4 h-4 text-emerald-300 shrink-0" />
              <div className="truncate sm:whitespace-normal">
                <span className="font-bold text-emerald-300">
                  Pengumuman Wasit {activeRulingBanner.refereeName}:{' '}
                </span>
                <span className="text-white">{activeRulingBanner.text}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedRulingId(activeRulingBanner.id)}
              aria-label="Tutup pengumuman wasit"
              className="text-slate-400 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* AUTHORITATIVE DEVICE WASIT / HOST LIVE CONSOLE */}
        {canActAsMatchOfficial && refereeConsoleOpen && (
          <div className="bg-[#101C2E] border border-emerald-500/40 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Gavel className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h2 className="text-sm sm:text-base font-display font-bold text-white">
                    {isReferee
                      ? 'Konsol Device Wasit · Pengadil Resmi Pertandingan'
                      : 'Konsol Host Pertandingan (Tanpa Wasit Terpisah)'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {isReferee
                      ? 'Gunakan Mode Layar Meja bila tablet ditaruh di tengah pemain, atau Mode Inspeksi Penuh bila dipegang khusus Wasit.'
                      : 'Anda memegang kontrol jeda, laju ronde, dan pengumuman pertandingan.'}
                  </p>
                </div>
              </div>

              {isReferee && (
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRefereeInspectMode(false)}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                      !refereeInspectMode
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Mode Layar Meja (Rahasia Aman)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefereeInspectMode(true)}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                      refereeInspectMode
                        ? 'bg-emerald-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspeksi Penuh Wasit</span>
                  </button>
                </div>
              )}
            </div>

            {/* Row 1: Pause/Resume & Phase Ruling Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              <div className="lg:col-span-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {!roomState.isPaused ? (
                  <>
                    <input
                      type="text"
                      value={pauseReasonInput}
                      onChange={(e) => setPauseReasonInput(e.target.value)}
                      maxLength={100}
                      placeholder="Alasan jeda / cek syarat kartu (opsional)..."
                      className="flex-1 px-3 py-2 text-xs bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      disabled={phase === 'GAME_OVER'}
                      onClick={() => {
                        sendRefereeCommand({
                          kind: 'PAUSE_MATCH',
                          reason: pauseReasonInput.trim() || undefined,
                        });
                        setPauseReasonInput('');
                      }}
                      className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Jeda Laga</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendRefereeCommand({ kind: 'RESUME_MATCH' })}
                    className="w-full py-2 px-4 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Lanjutkan Pertandingan Sekarang</span>
                  </button>
                )}
              </div>

              <div className="lg:col-span-6 flex flex-wrap items-center lg:justify-end gap-2">
                {phase === 'P1_PICK_CHARACTER' &&
                  (roomState.lockStatus.charLocked[0] || roomState.lockStatus.charLocked[1]) && (
                    <button
                      type="button"
                      onClick={() => sendRefereeCommand({ kind: 'UNLOCK_CHARACTER_PICKS' })}
                      className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Buka Kunci Karakter</span>
                    </button>
                  )}

                {(phase === 'SUIT_REVEAL' || phase === 'ROUND_END') && (
                  <button
                    type="button"
                    onClick={() => sendRefereeCommand({ kind: 'ADVANCE_PHASE' })}
                    className="px-3.5 py-2 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {phase === 'SUIT_REVEAL'
                        ? 'Lanjut Fase Suit'
                        : `Mulai Ronde ${round + 1}`}
                    </span>
                  </button>
                )}

                {(phase === 'P1_PICK_SUIT' ||
                  phase === 'SUIT_REVEAL' ||
                  phase === 'P1_PICK_SUPPORT' ||
                  phase === 'P2_PICK_SUPPORT') && (
                  <button
                    type="button"
                    onClick={() => sendRefereeCommand({ kind: 'RESET_SUIT_CLASH' })}
                    className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ulangi Adu Suit</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setPendingVerdictConfirm({
                      label: 'Ulangi pertandingan ini dari Ronde 1?',
                      command: { kind: 'RESTART_MATCH' },
                    })
                  }
                  className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ulangi Duel R1</span>
                </button>
              </div>
            </div>

            {/* Row 2: Dedicated Referee Stat Corrections & Secret Card Verification (Only for Dedicated Device Wasit) */}
            {isReferee && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([0, 1] as const).map((pIdx) => {
                  const pState = battle.players[pIdx];
                  const insp = roomState.refereeInspection?.players[pIdx] ?? null;
                  const lockedCharDef =
                    insp?.pendingCharacterDefId ? CARD_BY_ID[insp.pendingCharacterDefId] : null;
                  const lockedSupDef =
                    insp?.pendingSupportDefId && insp.pendingSupportDefId !== 'SKIPPED'
                      ? CARD_BY_ID[insp.pendingSupportDefId]
                      : null;

                  return (
                    <div
                      key={pIdx}
                      className="bg-[#0B1120] border border-slate-800 rounded-xl p-3.5 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-display font-bold text-white">
                          <span className={pIdx === 0 ? 'text-amber-300' : 'text-sky-300'}>
                            P{pIdx + 1} · {pState.name}
                          </span>
                          <span className="ml-2 font-mono text-slate-400 tabular-nums">
                            {pState.active
                              ? `HP ${pState.active.currentHp}/${pState.active.maxHp} · ATK ${pState.active.currentAtk}`
                              : 'Belum Turun Karakter'}
                          </span>
                        </div>

                        {refereeInspectMode && insp && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setZoneInspectModal({
                                  title: `Inspeksi Wasit · Tangan ${pState.name} (${insp.hand.length} Kartu)`,
                                  cards: insp.hand,
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg transition-colors tabular-nums whitespace-nowrap shrink-0"
                            >
                              Tangan ({insp.hand.length})
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setZoneInspectModal({
                                  title: `Inspeksi Wasit · Dek ${pState.name} (${insp.deck.length} Kartu)`,
                                  cards: insp.deck,
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors tabular-nums whitespace-nowrap shrink-0"
                            >
                              Dek ({insp.deck.length})
                            </button>
                          </div>
                        )}
                      </div>

                      {refereeInspectMode && insp && (
                        <div className="text-[11px] font-mono text-slate-300 bg-[#131C31] border border-slate-800/80 rounded-lg px-2.5 py-1.5">
                          <span>
                            Kunci Karakter:{' '}
                            <strong className="text-white">
                              {lockedCharDef
                                ? lockedCharDef.name
                                : pState.active
                                ? pState.active.def.name
                                : 'Belum'}
                            </strong>
                          </span>
                          <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
                          <span>
                            Suit:{' '}
                            <strong className="text-amber-300">
                              {insp.pendingSuit ?? 'Belum'}
                            </strong>
                          </span>
                          <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
                          <span>
                            Pendukung:{' '}
                            <strong className="text-sky-300">
                              {insp.pendingSupportDefId === 'SKIPPED'
                                ? 'Lewati'
                                : lockedSupDef
                                ? lockedSupDef.name
                                : 'Belum'}
                            </strong>
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5">
                        {[-100, -20, 20, 100].map((delta) => (
                          <button
                            key={`hp-${delta}`}
                            type="button"
                            disabled={!pState.active || phase === 'GAME_OVER' || phase === 'ROUND_END'}
                            onClick={() =>
                              sendRefereeCommand({ kind: 'ADJUST_HP', target: pIdx, delta })
                            }
                            className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-lg transition-colors tabular-nums whitespace-nowrap shrink-0 disabled:opacity-40 ${
                              delta < 0
                                ? 'bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {delta > 0 ? `+${delta}` : delta} HP
                          </button>
                        ))}
                        {[-20, 20, 40].map((delta) => (
                          <button
                            key={`atk-${delta}`}
                            type="button"
                            disabled={!pState.active || phase === 'GAME_OVER' || phase === 'ROUND_END'}
                            onClick={() =>
                              sendRefereeCommand({ kind: 'ADJUST_ATK', target: pIdx, delta })
                            }
                            className="px-2 py-1 text-[11px] font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg transition-colors tabular-nums whitespace-nowrap shrink-0 disabled:opacity-40"
                          >
                            {delta > 0 ? `+${delta}` : delta} ATK
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Row 3: Round / Match Verdicts & Official Broadcast */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
              <div className="lg:col-span-6 flex flex-wrap items-center gap-1.5">
                {isReferee && phase !== 'GAME_OVER' && phase !== 'ROUND_END' && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingVerdictConfirm({
                          label: `Menangkan Ronde ${round} untuk ${battle.players[0].name}?`,
                          command: { kind: 'FORCE_ROUND_WINNER', winner: 0 },
                        })
                      }
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Ronde → {battle.players[0].name}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingVerdictConfirm({
                          label: `Nyatakan Ronde ${round} berakhir SERI?`,
                          command: { kind: 'FORCE_ROUND_WINNER', winner: 'DRAW' },
                        })
                      }
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Ronde Seri
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingVerdictConfirm({
                          label: `Menangkan Ronde ${round} untuk ${battle.players[1].name}?`,
                          command: { kind: 'FORCE_ROUND_WINNER', winner: 1 },
                        })
                      }
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-sky-400 hover:text-slate-950 text-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Ronde → {battle.players[1].name}
                    </button>
                  </>
                )}

                {phase !== 'GAME_OVER' && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingVerdictConfirm({
                          label: `Putuskan ${battle.players[0].name} MENANG pertandingan ini?`,
                          command: {
                            kind: 'DECLARE_MATCH_WINNER',
                            winner: 0,
                            reason: 'Keputusan Wasit',
                          },
                        })
                      }
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Menangkan {battle.players[0].name}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingVerdictConfirm({
                          label: `Putuskan ${battle.players[1].name} MENANG pertandingan ini?`,
                          command: {
                            kind: 'DECLARE_MATCH_WINNER',
                            winner: 1,
                            reason: 'Keputusan Wasit',
                          },
                        })
                      }
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-sky-500/15 hover:bg-sky-400 hover:text-slate-950 text-sky-300 border border-sky-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Menangkan {battle.players[1].name}
                    </button>
                  </>
                )}
              </div>

              <div className="lg:col-span-6 flex items-center gap-2">
                <input
                  type="text"
                  value={refereeAnnounceInput}
                  onChange={(e) => setRefereeAnnounceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && refereeAnnounceInput.trim()) {
                      sendRefereeCommand({ kind: 'ANNOUNCE', text: refereeAnnounceInput.trim() });
                      setRefereeAnnounceInput('');
                    }
                  }}
                  maxLength={140}
                  placeholder="Kirim pengumuman / peringatan resmi Wasit..."
                  className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!refereeAnnounceInput.trim()) return;
                    sendRefereeCommand({ kind: 'ANNOUNCE', text: refereeAnnounceInput.trim() });
                    setRefereeAnnounceInput('');
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>Umumkan</span>
                </button>
              </div>
            </div>

            {pendingVerdictConfirm && (
              <div className="px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-400/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-semibold text-amber-200">
                  Konfirmasi Keputusan Wasit: {pendingVerdictConfirm.label}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => sendRefereeCommand(pendingVerdictConfirm.command)}
                    className="px-3.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Ya, Sahkan Keputusan
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingVerdictConfirm(null)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Main 9-Col Live Tabletop */}
          <div className="xl:col-span-9 space-y-4">
            {/* OPPONENT / TOP FIGHTER BAR */}
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center justify-between lg:justify-start gap-5">
                <div>
                  <div className="text-xs text-slate-400">
                    {isReferee
                      ? 'Petarung 2 · Sisi Atas Meja'
                      : isSpectator
                      ? 'Petarung 2'
                      : 'Lawan di Perangkat Seberang'}
                  </div>
                  <div className="text-base font-display font-bold text-white">
                    {oppBattlePlayer.name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400 truncate max-w-[260px]">
                    {oppBattlePlayer.usedCharacterTags.length > 0
                      ? `Pernah Turun: ${oppBattlePlayer.usedCharacterTags.slice(-4).join(' · ')}`
                      : 'Belum ada Karakter yang pernah turun'}
                  </div>
                </div>

                {topInspectedData ? (
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {topInspectedData.hand.length === 0 ? (
                      <span className="text-xs text-slate-500 font-mono">0 Kartu Tangan</span>
                    ) : (
                      topInspectedData.hand.map((inst) => {
                        const def = CARD_BY_ID[inst.defId];
                        if (!def) return null;
                        return (
                          <div key={inst.uid} className="shrink-0">
                            <CardVisual
                              card={def}
                              size="xs"
                              onClick={() => onInspectCard(def)}
                              onInspect={onInspectCard}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="flex items-center -space-x-6 sm:-space-x-5 pl-2">
                    {oppBattlePlayer.hand.length === 0 ? (
                      <span className="text-xs text-slate-500 font-mono">0 Kartu Tangan</span>
                    ) : (
                      oppBattlePlayer.hand.slice(0, 6).map((inst) => (
                        <div
                          key={inst.uid}
                          className="animate-opponent-draw transition-transform duration-150 hover:-translate-y-1"
                        >
                          <CardBack size="xs" />
                        </div>
                      ))
                    )}
                    {oppBattlePlayer.hand.length > 6 && (
                      <span className="pl-7 text-xs font-mono text-slate-300 tabular-nums">
                        +{oppBattlePlayer.hand.length - 6}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
                {topInspectedData ? (
                  <button
                    type="button"
                    onClick={() =>
                      setZoneInspectModal({
                        title: `Inspeksi Wasit · Dek ${oppBattlePlayer.name} (${topInspectedData.deck.length})`,
                        cards: topInspectedData.deck,
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Dek: {oppBattlePlayer.deck.length}</span>
                  </button>
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-[#0B1120] border border-slate-800 text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>Dek: {oppBattlePlayer.deck.length}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setZoneInspectModal({
                      title: `Zona Menang — ${oppBattlePlayer.name} (${oppBattlePlayer.winZone.length})`,
                      cards: oppBattlePlayer.winZone,
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 border border-slate-700 text-amber-300 font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>
                    Menang: {oppBattlePlayer.winZone.length}
                    {!battle.maxRounds ? `/${winGoal}` : ''}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setZoneInspectModal({
                      title: `Habis Dipakai — ${oppBattlePlayer.name} (${oppBattlePlayer.loseZone.length})`,
                      cards: oppBattlePlayer.loseZone,
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Habis: {oppBattlePlayer.loseZone.length}</span>
                </button>
              </div>
            </div>

            {/* CENTER ARENA MAT */}
            <div
              className={`relative overflow-hidden bg-[#11192C] border border-slate-800 rounded-2xl p-4 sm:p-6 ${
                koShaking ? 'animate-ko-arena-shake' : ''
              }`}
            >
              <ArenaClashFx
                phase={phase}
                round={round}
                suitAttempt={battle.suitAttemptInRound}
                leftFighter={myBattlePlayer.active}
                rightFighter={oppBattlePlayer.active}
                leftSuit={myBattlePlayer.selectedSuit}
                rightSuit={oppBattlePlayer.selectedSuit}
                suitWinner={
                  myWonLastSuit
                    ? 'left'
                    : oppWonLastSuit
                    ? 'right'
                    : battle.lastSuitWinner === 'DRAW'
                    ? 'draw'
                    : null
                }
                leftSupportCard={myBattlePlayer.playedSupportCard}
                rightSupportCard={oppBattlePlayer.playedSupportCard}
                combatSignal={mpCombatSignal}
                enabled={clashFxEnabled}
              />

              <KoBannerOverlay
                ko={activeKo}
                onDismiss={dismissKo}
                swapSides={myViewIdx === 1}
              />
              <ComboChainBanner
                combo={activeCombo}
                onDismiss={dismissCombo}
                hidden={Boolean(activeKo)}
              />

              <div className="relative z-10 text-center pb-5 border-b border-slate-800/80">
                <h2 className="text-lg sm:text-xl font-display font-bold text-white">
                  {headline.title}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-300">{headline.detail}</p>
                {statusFeedback && (
                  <p className="mt-2 text-xs font-medium text-amber-300">{statusFeedback}</p>
                )}
              </div>

              <div className="relative z-10 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Left Active Zone (Me or Fighter 1) */}
                <div className="lg:col-span-4 flex flex-col items-center">
                  <div className="text-xs font-semibold text-amber-300 mb-2 text-center">
                    {isSpectator
                      ? `Zona Aktif · ${myBattlePlayer.name}`
                      : `Zona Aktif Anda · ${myBattlePlayer.name}`}
                    {myBattlePlayer.active
                      ? ` · ${resolveCardElementTheme(myBattlePlayer.active.def).label}`
                      : ''}
                    {myBattlePlayer.active && isLegendaryCard(myBattlePlayer.active.def)
                      ? ` · Legendaris ${myBattlePlayer.active.def.rank}`
                      : ''}
                  </div>

                  {myBattlePlayer.active ? (
                    <div className="relative flex flex-col items-center w-full max-w-[230px]">
                      {combatFx?.myDelta !== null && combatFx?.myDelta !== undefined && (
                        <div
                          key={`my-dmg-${combatFx.id}`}
                          className={`animate-damage-pop pointer-events-none absolute -top-3 z-30 px-2.5 py-0.5 rounded-md font-mono text-xs font-extrabold tabular-nums shadow-lg ${
                            combatFx.myDelta < 0
                              ? 'bg-rose-500 text-white'
                              : 'bg-emerald-400 text-slate-950'
                          }`}
                        >
                          {combatFx.myDelta > 0
                            ? `+${combatFx.myDelta} HP`
                            : `${combatFx.myDelta} HP`}
                        </div>
                      )}

                      <div
                        key={`my-motion-${combatFx?.id ?? 0}`}
                        className={`relative ${
                          combatFx?.attackerSide === 'me'
                            ? 'animate-strike-right'
                            : (combatFx?.myDelta ?? 0) < 0
                            ? 'animate-hit-shake'
                            : ''
                        }`}
                      >
                        <CardClashAura
                          card={myBattlePlayer.active.def}
                          opponentCard={oppBattlePlayer.active?.def ?? null}
                          activeClash={Boolean(myBattlePlayer.active && oppBattlePlayer.active)}
                          isAttacking={combatFx?.attackerSide === 'me'}
                          isHit={(combatFx?.myDelta ?? 0) < 0}
                          enabled={clashFxEnabled}
                          burstKey={combatFx?.id}
                        />
                        <div className="relative z-10">
                          <FlipRevealCard
                            flipKey={`mp-left-${round}-${myBattlePlayer.active.instance.uid}`}
                            direction="up"
                            backSize="md"
                            backLabel={myBattlePlayer.name}
                          >
                            <CardVisual
                              card={myBattlePlayer.active.def}
                              size="md"
                              activeFighter={myBattlePlayer.active}
                              onClick={() => onInspectCard(myBattlePlayer.active!.def)}
                              onInspect={onInspectCard}
                            />
                          </FlipRevealCard>
                        </div>
                      </div>

                      {myBattlePlayer.playedSupportCard && (
                        <button
                          type="button"
                          onClick={() => onInspectCard(myBattlePlayer.playedSupportCard!)}
                          className="animate-support-pop mt-2 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-[11px] font-medium text-amber-200 whitespace-nowrap shrink-0 max-w-full truncate"
                        >
                          Pendukung: {myBattlePlayer.playedSupportCard.name}
                        </button>
                      )}

                      {(() => {
                        const myHpVis = getFighterHpVisualState(myBattlePlayer.active, 'emerald');
                        return (
                          <div className="mt-3 w-full">
                            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                              <span className={`flex items-center gap-1 font-bold ${myHpVis.labelClass}`}>
                                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                                <span>
                                  HP {myBattlePlayer.active.currentHp}/{myBattlePlayer.active.maxHp}
                                  {myHpVis.isCritical ? ' · KRITIS' : ''}
                                </span>
                              </span>
                              <span className="text-emerald-300 font-bold">
                                ATK {myBattlePlayer.active.currentAtk}
                              </span>
                            </div>
                            <svg
                              viewBox="0 0 100 8"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                              className="mt-1.5 h-2 w-full rounded-sm bg-slate-800 overflow-hidden"
                            >
                              <rect
                                x="0"
                                y="0"
                                width={
                                  Math.max(
                                    0,
                                    Math.min(
                                      1,
                                      myBattlePlayer.active.currentHp /
                                        Math.max(1, myBattlePlayer.active.maxHp)
                                    )
                                  ) * 100
                                }
                                height="8"
                                className={myHpVis.barFillClass}
                              />
                            </svg>
                            {myBattlePlayer.active.statusNotes.length > 0 && (
                              <div className="mt-2 text-[11px] text-amber-200 text-center">
                                {myBattlePlayer.active.statusNotes.join(' · ')}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : roomState.lockStatus.charLocked[myViewIdx] ? (
                    <div className="animate-card-lock flex flex-col items-center">
                      <CardBack size="md" label="Terkunci Siap" />
                      <span className="mt-2 text-xs text-emerald-300">
                        {myBattlePlayer.name} sudah mengunci kartu
                      </span>
                    </div>
                  ) : (
                    <div className="w-36 sm:w-44 aspect-[5/7] rounded-xl border border-dashed border-slate-700 bg-[#0B1120]/60 flex flex-col items-center justify-center p-4 text-center">
                      <Swords className="w-6 h-6 text-slate-600 mb-2" />
                      <span className="text-xs text-slate-500">Menunggu Karakter</span>
                    </div>
                  )}
                </div>

                {/* Center Action / Suit Stage */}
                <div className="lg:col-span-4 flex flex-col items-center justify-center min-h-[250px] bg-[#0B1120] border border-slate-800/90 rounded-2xl p-5">
                  {phase === 'P1_PICK_CHARACTER' && (
                    <div className="w-full flex flex-col items-center text-center">
                      <Flame className="w-7 h-7 text-amber-400 mb-2" />
                      <div className="text-sm font-display font-bold text-white">
                        Kunci Karakter Serentak — Ronde {round}
                      </div>
                      <p className="mt-1 text-xs text-slate-400 max-w-xs">
                        {isSpectator
                          ? 'Menunggu kedua petarung mengunci Kartu Karakter dari perangkat masing-masing.'
                          : myCharLocked
                          ? `Menunggu ${oppBattlePlayer.name} memilih kartu...`
                          : 'Pilih 1 Kartu Karakter unik di tangan bawah untuk diturunkan.'}
                      </p>
                      {!isSpectator && !myCharLocked && selectedHandDef && (
                        <button
                          type="button"
                          disabled={roomState.isPaused}
                          onClick={() => {
                            if (!selectedHandUid || roomState.isPaused) return;
                            soundFx.playCardDeploy();
                            sendWs({
                              type: 'battle:pick_character',
                              round,
                              uid: selectedHandUid,
                            });
                            setSelectedHandUid(null);
                            setStatusFeedback(null);
                          }}
                          className="mt-4 px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <Check className="w-4 h-4" />
                          <span>Kunci {selectedHandDef.name}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {phase === 'P1_PICK_SUIT' && (
                    <div className="w-full flex flex-col items-center">
                      {!isSpectator && !mySuitLocked ? (
                        <>
                          <div className="text-xs font-mono text-slate-400 mb-3 text-center">
                            Pilih Suit Anda · Air &gt; Api &gt; Daun &gt; Air
                          </div>
                          <div className="flex items-center justify-center gap-3">
                            {[SuitElement.AIR, SuitElement.API, SuitElement.DAUN].map((el, idx) => {
                              const suitCard = getSuitCardForSet(el, myBattlePlayer.suitArtSet);
                              return (
                                <div
                                  key={el}
                                  className={`animate-card-draw ${
                                    STAGGER_CLASSES[idx] ?? 'draw-stagger-0'
                                  } flex flex-col items-center`}
                                >
                                  <CardVisual
                                    card={suitCard}
                                    size="xs"
                                    disabled={roomState.isPaused}
                                    onClick={() => {
                                      if (roomState.isPaused) return;
                                      soundFx.playCardSelect();
                                      sendWs({
                                        type: 'battle:pick_suit',
                                        round,
                                        suitAttempt: battle.suitAttemptInRound,
                                        suit: el,
                                      });
                                    }}
                                    onInspect={onInspectCard}
                                  />
                                  <button
                                    type="button"
                                    disabled={roomState.isPaused}
                                    onClick={() => {
                                      if (roomState.isPaused) return;
                                      soundFx.playCardSelect();
                                      sendWs({
                                        type: 'battle:pick_suit',
                                        round,
                                        suitAttempt: battle.suitAttemptInRound,
                                        suit: el,
                                      });
                                    }}
                                    className="mt-2 px-3 py-1 text-xs font-bold bg-slate-800 hover:bg-amber-500 hover:text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 whitespace-nowrap shrink-0"
                                  >
                                    {el}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-center">
                          <CardBack
                            size="xs"
                            label={isSpectator ? 'Adu Suit' : myBattlePlayer.selectedSuit ?? 'Siap'}
                          />
                          <p className="mt-3 text-xs text-slate-300">
                            {isSpectator
                              ? 'Kedua petarung sedang mengunci pilihan Kartu Suit secara rahasia...'
                              : `Suit terkunci! Menunggu ${oppBattlePlayer.name} memilih Suit...`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {phase === 'SUIT_REVEAL' &&
                    myBattlePlayer.selectedSuit &&
                    oppBattlePlayer.selectedSuit && (
                      <div className="w-full flex flex-col items-center">
                        <div className="flex items-center justify-center gap-4">
                          <div
                            className={`flex flex-col items-center transition-transform duration-200 ${
                              myWonLastSuit
                                ? 'scale-105'
                                : oppWonLastSuit
                                ? 'scale-95 opacity-80'
                                : ''
                            }`}
                          >
                            <span className="text-[11px] text-amber-300 font-semibold mb-1.5">
                              {myBattlePlayer.name}
                            </span>
                            <FlipRevealCard
                              flipKey={`mp-suit-me-${round}-${battle.suitAttemptInRound}`}
                              direction="up"
                              backSize="xs"
                            >
                              <CardVisual
                                card={getSuitCardForSet(
                                  myBattlePlayer.selectedSuit,
                                  myBattlePlayer.suitArtSet
                                )}
                                size="xs"
                                selected={myWonLastSuit}
                              />
                            </FlipRevealCard>
                          </div>

                          <SuitClashFlare
                            leftSuit={myBattlePlayer.selectedSuit}
                            rightSuit={oppBattlePlayer.selectedSuit}
                            winner={
                              myWonLastSuit
                                ? 'left'
                                : oppWonLastSuit
                                ? 'right'
                                : 'draw'
                            }
                            clashKey={`mp-suit-vs-${round}-${battle.suitAttemptInRound}`}
                            enabled={clashFxEnabled}
                          />

                          <div
                            className={`flex flex-col items-center transition-transform duration-200 ${
                              oppWonLastSuit
                                ? 'scale-105'
                                : myWonLastSuit
                                ? 'scale-95 opacity-80'
                                : ''
                            }`}
                          >
                            <span className="text-[11px] text-sky-300 font-semibold mb-1.5">
                              {oppBattlePlayer.name}
                            </span>
                            <FlipRevealCard
                              flipKey={`mp-suit-opp-${round}-${battle.suitAttemptInRound}`}
                              direction="down"
                              backSize="xs"
                            >
                              <CardVisual
                                card={getSuitCardForSet(
                                  oppBattlePlayer.selectedSuit,
                                  oppBattlePlayer.suitArtSet
                                )}
                                size="xs"
                                selected={oppWonLastSuit}
                              />
                            </FlipRevealCard>
                          </div>
                        </div>

                        {(!isSpectator || isReferee) && (
                          <button
                            type="button"
                            disabled={roomState.isPaused && !isReferee}
                            onClick={() =>
                              isReferee
                                ? sendRefereeCommand({ kind: 'ADVANCE_PHASE' })
                                : sendWs({
                                    type: 'battle:advance_suit',
                                    round,
                                    suitAttempt: battle.suitAttemptInRound,
                                  })
                            }
                            className="mt-5 px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-all duration-150 hover:scale-[1.03] active:scale-[0.98] whitespace-nowrap shrink-0"
                          >
                            {battle.lastSuitWinner === 'DRAW'
                              ? 'Seri! Adu Suit Ulang'
                              : 'Lanjutkan Serangan / Pendukung'}
                          </button>
                        )}
                      </div>
                    )}

                  {(phase === 'P1_PICK_SUPPORT' || phase === 'P2_PICK_SUPPORT') && (
                    <div className="w-full flex flex-col items-center text-center">
                      <Shield className="w-7 h-7 text-amber-400 mb-2" />
                      <div className="text-sm font-display font-bold text-white">
                        Jendela Kartu Pendukung
                      </div>
                      <p className="mt-1 text-xs text-slate-400 max-w-xs">
                        {isSpectator
                          ? 'Menunggu keputusan Kartu Pendukung sebelum serangan dihantamkan.'
                          : mySupLocked
                          ? `Menunggu ${oppBattlePlayer.name} memutuskan Kartu Pendukung...`
                          : 'Klik Kartu Pendukung di tangan bawah untuk memakainya, atau lewati untuk langsung menyerang!'}
                      </p>
                      {!isSpectator && !mySupLocked && (
                        <button
                          type="button"
                          disabled={roomState.isPaused}
                          onClick={() =>
                            sendWs({
                              type: 'battle:pick_support',
                              round,
                              suitAttempt: battle.suitAttemptInRound,
                              supportUid: null,
                            })
                          }
                          className="mt-4 px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
                        >
                          Lewati &amp; Lancarkan Serangan
                        </button>
                      )}
                    </div>
                  )}

                  {phase === 'ROUND_END' && (
                    <div className="w-full flex flex-col items-center text-center">
                      <Trophy className="w-8 h-8 text-amber-400 mb-2" />
                      <div className="text-base font-display font-bold text-white">
                        Ronde {round} Tuntas
                      </div>
                      <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                        {battle.roundSummaryText}
                      </p>
                      {(!isSpectator || isReferee) && (
                        <button
                          type="button"
                          disabled={roomState.isPaused && !isReferee}
                          onClick={() =>
                            isReferee
                              ? sendRefereeCommand({ kind: 'ADVANCE_PHASE' })
                              : sendWs({ type: 'battle:next_round', round })
                          }
                          className="mt-4 px-5 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
                        >
                          Mulai Ronde {round + 1}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Active Zone (Opponent or Fighter 2) */}
                <div className="lg:col-span-4 flex flex-col items-center">
                  <div className="text-xs font-semibold text-sky-300 mb-2 text-center">
                    {isSpectator
                      ? `Zona Aktif · ${oppBattlePlayer.name}`
                      : `Zona Aktif Lawan · ${oppBattlePlayer.name}`}
                    {oppBattlePlayer.active
                      ? ` · ${resolveCardElementTheme(oppBattlePlayer.active.def).label}`
                      : ''}
                    {oppBattlePlayer.active && isLegendaryCard(oppBattlePlayer.active.def)
                      ? ` · Legendaris ${oppBattlePlayer.active.def.rank}`
                      : ''}
                  </div>

                  {oppBattlePlayer.active ? (
                    <div className="relative flex flex-col items-center w-full max-w-[230px]">
                      {combatFx?.oppDelta !== null && combatFx?.oppDelta !== undefined && (
                        <div
                          key={`opp-dmg-${combatFx.id}`}
                          className={`animate-damage-pop pointer-events-none absolute -top-3 z-30 px-2.5 py-0.5 rounded-md font-mono text-xs font-extrabold tabular-nums shadow-lg ${
                            combatFx.oppDelta < 0
                              ? 'bg-rose-500 text-white'
                              : 'bg-emerald-400 text-slate-950'
                          }`}
                        >
                          {combatFx.oppDelta > 0
                            ? `+${combatFx.oppDelta} HP`
                            : `${combatFx.oppDelta} HP`}
                        </div>
                      )}

                      <div
                        key={`opp-motion-${combatFx?.id ?? 0}`}
                        className={`relative ${
                          combatFx?.attackerSide === 'opp'
                            ? 'animate-strike-left'
                            : (combatFx?.oppDelta ?? 0) < 0
                            ? 'animate-hit-shake'
                            : ''
                        }`}
                      >
                        <CardClashAura
                          card={oppBattlePlayer.active.def}
                          opponentCard={myBattlePlayer.active?.def ?? null}
                          activeClash={Boolean(myBattlePlayer.active && oppBattlePlayer.active)}
                          isAttacking={combatFx?.attackerSide === 'opp'}
                          isHit={(combatFx?.oppDelta ?? 0) < 0}
                          enabled={clashFxEnabled}
                          burstKey={combatFx?.id}
                        />
                        <div className="relative z-10">
                          <FlipRevealCard
                            flipKey={`mp-right-${round}-${oppBattlePlayer.active.instance.uid}`}
                            direction="down"
                            backSize="md"
                            backLabel={oppBattlePlayer.name}
                          >
                            <CardVisual
                              card={oppBattlePlayer.active.def}
                              size="md"
                              activeFighter={oppBattlePlayer.active}
                              onClick={() => onInspectCard(oppBattlePlayer.active!.def)}
                              onInspect={onInspectCard}
                            />
                          </FlipRevealCard>
                        </div>
                      </div>

                      {oppBattlePlayer.playedSupportCard && (
                        <button
                          type="button"
                          onClick={() => onInspectCard(oppBattlePlayer.playedSupportCard!)}
                          className="animate-support-pop mt-2 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-400/40 text-[11px] font-medium text-sky-200 whitespace-nowrap shrink-0 max-w-full truncate"
                        >
                          Pendukung: {oppBattlePlayer.playedSupportCard.name}
                        </button>
                      )}

                      {(() => {
                        const oppHpVis = getFighterHpVisualState(oppBattlePlayer.active, 'sky');
                        return (
                          <div className="mt-3 w-full">
                            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                              <span className={`flex items-center gap-1 font-bold ${oppHpVis.labelClass}`}>
                                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                                <span>
                                  HP {oppBattlePlayer.active.currentHp}/{oppBattlePlayer.active.maxHp}
                                  {oppHpVis.isCritical ? ' · KRITIS' : ''}
                                </span>
                              </span>
                              <span className="text-emerald-300 font-bold">
                                ATK {oppBattlePlayer.active.currentAtk}
                              </span>
                            </div>
                            <svg
                              viewBox="0 0 100 8"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                              className="mt-1.5 h-2 w-full rounded-sm bg-slate-800 overflow-hidden"
                            >
                              <rect
                                x="0"
                                y="0"
                                width={
                                  Math.max(
                                    0,
                                    Math.min(
                                      1,
                                      oppBattlePlayer.active.currentHp /
                                        Math.max(1, oppBattlePlayer.active.maxHp)
                                    )
                                  ) * 100
                                }
                                height="8"
                                className={oppHpVis.barFillClass}
                              />
                            </svg>
                            {oppBattlePlayer.active.statusNotes.length > 0 && (
                              <div className="mt-2 text-[11px] text-sky-200 text-center">
                                {oppBattlePlayer.active.statusNotes.join(' · ')}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : roomState.lockStatus.charLocked[oppViewIdx] ? (
                    <div className="animate-card-lock flex flex-col items-center">
                      <CardBack size="md" label="Terkunci Siap" />
                      <span className="mt-2 text-xs text-sky-300">
                        {oppBattlePlayer.name} sudah mengunci kartu
                      </span>
                    </div>
                  ) : (
                    <div className="w-36 sm:w-44 aspect-[5/7] rounded-xl border border-dashed border-slate-700 bg-[#0B1120]/60 flex flex-col items-center justify-center p-4 text-center">
                      <Swords className="w-6 h-6 text-slate-600 mb-2" />
                      <span className="text-xs text-slate-500">Menunggu Karakter Lawan</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BOTTOM PLAYER HAND (OR SPECTATOR / DEVICE WASIT PANEL) */}
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="text-sm font-display font-bold text-white">
                    {isReferee
                      ? bottomInspectedData
                        ? `Inspeksi Wasit · Tangan ${myBattlePlayer.name} (${bottomInspectedData.hand.length} Kartu)`
                        : `Petarung 1 · ${myBattlePlayer.name} (${myBattlePlayer.hand.length} Kartu Rahasia — Mode Layar Meja)`
                      : isSpectator
                      ? `Tangan ${myBattlePlayer.name} (${myBattlePlayer.hand.length} Kartu Rahasia)`
                      : `Tangan Anda · ${myBattlePlayer.name} (${myBattlePlayer.hand.length} Kartu Unik)`}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {myBattlePlayer.usedCharacterTags.length > 0
                      ? `Sudah Pernah Turun: ${myBattlePlayer.usedCharacterTags.join(' · ')}`
                      : 'Belum ada Karakter yang pernah diturunkan'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
                  {bottomInspectedData ? (
                    <button
                      type="button"
                      onClick={() =>
                        setZoneInspectModal({
                          title: `Inspeksi Wasit · Dek ${myBattlePlayer.name} (${bottomInspectedData.deck.length})`,
                          cards: bottomInspectedData.deck,
                        })
                      }
                      className="px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Dek: {myBattlePlayer.deck.length}</span>
                    </button>
                  ) : (
                    <div className="px-3 py-2 rounded-xl bg-[#0B1120] border border-slate-800 text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>Dek: {myBattlePlayer.deck.length}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setZoneInspectModal({
                        title: `Zona Menang — ${myBattlePlayer.name} (${myBattlePlayer.winZone.length})`,
                        cards: myBattlePlayer.winZone,
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 border border-slate-700 text-amber-300 font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>
                      Menang: {myBattlePlayer.winZone.length}
                      {!battle.maxRounds ? `/${winGoal}` : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setZoneInspectModal({
                        title: `Habis Dipakai — ${myBattlePlayer.name} (${myBattlePlayer.loseZone.length})`,
                        cards: myBattlePlayer.loseZone,
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Habis: {myBattlePlayer.loseZone.length}</span>
                  </button>
                </div>
              </div>

              {isSpectator ? (
                bottomInspectedData ? (
                  <div className="mt-4 flex flex-wrap items-start justify-center gap-3">
                    {bottomInspectedData.hand.length === 0 ? (
                      <div className="py-4 text-xs text-slate-400">
                        Tangan {myBattlePlayer.name} kosong.
                      </div>
                    ) : (
                      bottomInspectedData.hand.map((inst) => {
                        const def = CARD_BY_ID[inst.defId];
                        if (!def) return null;
                        const charCheck = canPlayCharacterCard(
                          def,
                          myBattlePlayer.usedCharacterTags
                        );
                        return (
                          <div key={inst.uid} className="flex flex-col items-center w-24 sm:w-28">
                            <CardVisual
                              card={def}
                              size="xs"
                              conditionalReady={Boolean(def.condition) && charCheck.playable}
                              onClick={() => onInspectCard(def)}
                              onInspect={onInspectCard}
                            />
                            <div className="mt-1 text-[10px] font-semibold text-slate-200 truncate w-full text-center">
                              {def.name}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 py-3">
                    <div className="flex items-center -space-x-5 pl-2">
                      {myBattlePlayer.hand.map((inst) => (
                        <div key={inst.uid} className="animate-opponent-draw">
                          <CardBack size="xs" />
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-slate-300 text-center sm:text-right">
                      {isReferee ? (
                        <span>
                          Perangkat ini bertugas sebagai{' '}
                          <strong className="text-emerald-300">
                            Device Wasit (Mode Layar Meja)
                          </strong>
                          . Aktifkan <em>Inspeksi Penuh Wasit</em> di atas bila ingin memeriksa kartu tangan pemain.
                        </span>
                      ) : queuePosition >= 0 ? (
                        <span>
                          Anda berada di{' '}
                          <strong className="text-amber-300">
                            Antrean Penantang #{queuePosition + 1}
                          </strong>
                          . Pemenang partai ini akan langsung menghadapi Anda!
                        </span>
                      ) : (
                        <span>Anda sedang menonton jalannya pertarungan secara real-time.</span>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div className="mt-5 flex flex-wrap items-start justify-center gap-3 sm:gap-4">
                  {myBattlePlayer.hand.length === 0 ? (
                    <div className="py-6 text-sm text-slate-400">
                      Tidak ada kartu tersisa di tangan.
                    </div>
                  ) : (
                    myBattlePlayer.hand.map((inst, handIdx) => {
                      const def = CARD_BY_ID[inst.defId];
                      if (!def) return null;

                      const isCharPhase =
                        !roomState.isPaused && phase === 'P1_PICK_CHARACTER' && !myCharLocked;
                      const isSupPhase =
                        !roomState.isPaused &&
                        (phase === 'P1_PICK_SUPPORT' || phase === 'P2_PICK_SUPPORT') &&
                        !mySupLocked;
                      const charCheck = canPlayCharacterCard(def, myBattlePlayer.usedCharacterTags);
                      const isSupportLocked = Boolean(oppBattlePlayer.active?.blockEnemySupport);
                      const isPlayableNow = isCharPhase
                        ? charCheck.playable
                        : isSupPhase
                        ? def.category === CardCategory.SUPPORT && !isSupportLocked
                        : false;

                      const isSelected = selectedHandUid === inst.uid;
                      const staggerClass =
                        round === 1 && myBattlePlayer.usedCharacterTags.length === 0
                          ? (STAGGER_CLASSES[handIdx] ?? '')
                          : '';

                      return (
                        <div
                          key={inst.uid}
                          className={`animate-card-draw ${staggerClass} flex flex-col items-center w-28 sm:w-32`}
                        >
                          <CardVisual
                            card={def}
                            size="sm"
                            selected={isSelected}
                            disabled={
                              roomState.isPaused || ((isCharPhase || isSupPhase) && !isPlayableNow)
                            }
                            disabledReason={
                              roomState.isPaused
                                ? 'Pertandingan sedang dijeda Wasit'
                                : isSupPhase && isSupportLocked
                                ? 'Kartu Pendukung dikunci oleh efek lawan'
                                : charCheck.reason
                            }
                            conditionalReady={Boolean(def.condition) && charCheck.playable}
                            onInspect={onInspectCard}
                            onClick={() => {
                              if (roomState.isPaused) {
                                setStatusFeedback(
                                  'Pertandingan sedang dijeda oleh Wasit — tunggu hingga dilanjutkan.'
                                );
                                return;
                              }
                              if (isCharPhase) {
                                if (!charCheck.playable) {
                                  setStatusFeedback(
                                    charCheck.reason ?? 'Syarat kartu belum terpenuhi.'
                                  );
                                  return;
                                }
                                if (selectedHandUid === inst.uid) {
                                  soundFx.playCardDeploy();
                                  sendWs({
                                    type: 'battle:pick_character',
                                    round,
                                    uid: inst.uid,
                                  });
                                  setSelectedHandUid(null);
                                  setStatusFeedback(null);
                                } else {
                                  soundFx.playCardSelect();
                                  setSelectedHandUid(inst.uid);
                                  setStatusFeedback(
                                    `${def.name} dipilih — klik sekali lagi atau tekan tombol Kunci untuk mengonfirmasi.`
                                  );
                                }
                              } else if (isSupPhase) {
                                if (isSupportLocked) {
                                  setStatusFeedback(
                                    'Kartu Pendukung tidak dapat digunakan karena efek karakter lawan!'
                                  );
                                } else if (def.category === CardCategory.SUPPORT) {
                                  soundFx.playCardDeploy();
                                  sendWs({
                                    type: 'battle:pick_support',
                                    round,
                                    suitAttempt: battle.suitAttemptInRound,
                                    supportUid: inst.uid,
                                  });
                                  setStatusFeedback(null);
                                } else {
                                  setStatusFeedback(
                                    'Hanya Kartu Pendukung yang bisa diaktifkan pada fase ini.'
                                  );
                                }
                              } else {
                                onInspectCard(def);
                              }
                            }}
                          />
                          <div className="mt-1.5 text-center w-full">
                            <div className="text-[11px] font-semibold text-slate-200 truncate">
                              {def.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                              {def.category === CardCategory.CHARACTER
                                ? `${def.hp}/${def.atk} · 0${def.effectPriority ?? 3}`
                                : `Pendukung · 0${def.effectPriority ?? 2}`}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right 3-Col Sidebar: Multi-Device Queue, Leaderboard, Logs & Live Chat */}
          <div className="xl:col-span-3 space-y-4">
            {/* Multi-Device Leaderboard & Queue */}
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Klasemen &amp; Perangkat ({roomState.participants.length})</span>
                <span className="font-mono text-amber-400">{roomState.code}</span>
              </div>
              <div className="divide-y divide-slate-800/80 text-xs max-h-44 overflow-y-auto">
                {roomState.participants.map((p) => {
                  const pIsFighter =
                    roomState.fighters[0] === p.clientId || roomState.fighters[1] === p.clientId;
                  const qIdx = roomState.challengerQueue.indexOf(p.clientId);
                  return (
                    <div key={p.clientId} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-100 truncate">
                          {p.name}
                          {p.clientId === roomState.yourClientId ? ' (Anda)' : ''}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {p.isReferee ? (
                            <span className="text-emerald-300 font-semibold">Device Wasit</span>
                          ) : pIsFighter ? (
                            'Sedang Bertarung'
                          ) : qIdx >= 0 ? (
                            `Antrean #${qIdx + 1}`
                          ) : (
                            'Penonton'
                          )}
                          {' · '}
                          {p.connected ? 'Online' : 'Reconnecting'}
                        </div>
                      </div>
                      <div className="font-mono text-right tabular-nums shrink-0">
                        <div className="font-bold text-amber-300">{p.points} Poin</div>
                        <div className="text-[10px] text-slate-400">
                          {p.wins}M-{p.losses}K
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Battle Logs */}
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="text-xs font-semibold text-slate-300">Catatan Pertarungan Live</div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs pr-1">
                {battle.logs.slice(-18).map((entry) => (
                  <div key={entry.id} className="leading-relaxed">
                    <span className="font-mono text-[10px] text-slate-500 mr-1.5 tabular-nums">
                      [R{entry.round}]
                    </span>
                    <span
                      className={
                        entry.tone === 'highlight'
                          ? 'text-amber-300 font-semibold'
                          : entry.tone === 'warning'
                          ? 'text-rose-300'
                          : 'text-slate-300'
                      }
                    >
                      {entry.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Room Chat & Quick Reactions */}
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Pesan &amp; Reaksi Antar-Perangkat</span>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs pr-1">
                {roomState.chat.slice(-15).map((c) => (
                  <div key={c.id} className="leading-snug">
                    {c.isSystem ? (
                      <span className="text-amber-300/90">{c.text}</span>
                    ) : c.isReferee ? (
                      <>
                        <span className="font-bold text-emerald-300">[{c.senderName}]: </span>
                        <span className="text-emerald-100 font-medium">{c.text}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-sky-300">{c.senderName}: </span>
                        <span className="text-slate-200">{c.text}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_REACTIONS.slice(0, 3).map((rx) => (
                  <button
                    key={rx}
                    type="button"
                    onClick={() => handleSendChat(rx)}
                    className="px-2 py-1 text-[11px] bg-[#0B1120] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {rx}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendChat();
                  }}
                  placeholder="Kirim pesan..."
                  maxLength={120}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-[#0B1120] border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => handleSendChat()}
                  aria-label="Kirim pesan"
                  className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* INTERACTIVE CHOICE MODAL (ONLY SHOWN TO THE CHOOSING FIGHTER'S DEVICE) */}
        {phase === 'INTERACTIVE_CHOICE' && activeChoice && isMyChoiceTurn && (
          <div className="fixed inset-0 z-40 bg-slate-950/88 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#131C31] border border-slate-700 rounded-2xl p-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono text-amber-400">
                    Pilihan Efek Kartu Anda
                  </div>
                  <h3 className="text-lg sm:text-xl font-display font-bold text-white">
                    {activeChoice.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{activeChoice.subtitle}</p>
                </div>
                <div className="font-mono text-xs text-slate-300 tabular-nums shrink-0">
                  Terpilih: {choiceSelection.length}/{activeChoice.maxSelect}
                </div>
              </div>

              <div className="my-5 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 justify-items-center py-2">
                {activeChoice.candidates.map((cand, idx) => {
                  const isPicked = choiceSelection.includes(cand.uid);
                  const togglePick = () => {
                    soundFx.playCardSelect();
                    setChoiceSelection((prev) => {
                      if (prev.includes(cand.uid)) {
                        return prev.filter((id) => id !== cand.uid);
                      }
                      if (activeChoice.maxSelect === 1) return [cand.uid];
                      if (prev.length >= activeChoice.maxSelect) return prev;
                      return [...prev, cand.uid];
                    });
                  };

                  const def = CARD_BY_ID[cand.defId];
                  if (activeChoice.concealCandidates || !def) {
                    return (
                      <button
                        key={cand.uid}
                        type="button"
                        onClick={togglePick}
                        className={`group flex flex-col items-center rounded-xl transition-transform cursor-pointer ${
                          isPicked
                            ? '-translate-y-2.5 scale-[1.05]'
                            : 'hover:-translate-y-2 hover:scale-[1.03]'
                        }`}
                      >
                        <div
                          className={`rounded-xl ${
                            isPicked ? 'ring-2 ring-amber-400 shadow-xl' : ''
                          }`}
                        >
                          <CardBack size="sm" label={`#${idx + 1}`} />
                        </div>
                        <span className="mt-2 text-xs font-semibold text-slate-200">
                          Kartu Tertutup #{idx + 1}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <CardVisual
                      key={cand.uid}
                      card={def}
                      size="sm"
                      showCaption
                      selected={isPicked}
                      onInspect={onInspectCard}
                      onClick={togglePick}
                    />
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const autoIds = activeChoice.candidates
                      .slice(0, activeChoice.maxSelect)
                      .map((c) => c.uid);
                    setChoiceSelection([]);
                    soundFx.playCardDeploy();
                    sendWs({ type: 'battle:submit_choice', round, selectedUids: autoIds });
                  }}
                  className="px-4 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Pilih Otomatis
                </button>
                <button
                  type="button"
                  disabled={choiceSelection.length < activeChoice.minSelect}
                  onClick={() => {
                    const chosen = [...choiceSelection];
                    setChoiceSelection([]);
                    soundFx.playCardDeploy();
                    sendWs({ type: 'battle:submit_choice', round, selectedUids: chosen });
                  }}
                  className="px-6 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Konfirmasi Pilihan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ZONE INSPECT MODAL */}
        {zoneInspectModal && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setZoneInspectModal(null)}
          >
            <div
              className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#131C31] border border-slate-700 rounded-2xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h3 className="text-lg font-display font-bold text-white">
                  {zoneInspectModal.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setZoneInspectModal(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {zoneInspectModal.cards.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Belum ada kartu di zona ini.
                </div>
              ) : (
                <div className="mt-5 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center py-2">
                  {zoneInspectModal.cards.map((inst) => {
                    const def = CARD_BY_ID[inst.defId];
                    if (!def) return null;
                    return (
                      <CardVisual
                        key={inst.uid}
                        card={def}
                        size="sm"
                        showCaption
                        onClick={() => onInspectCard(def)}
                        onInspect={onInspectCard}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MULTI-DEVICE VICTORY CELEBRATION OVERLAY */}
        <VictoryCelebrationOverlay
          battleState={battle}
          viewerSeat={roomState.roomMode === 'PHYSICAL_SIMULATION' ? null : mySeat}
          holdForKo={Boolean(activeKo)}
          clashFxEnabled={clashFxEnabled}
          contextLabel="Partai Multiplayer Selesai"
          onInspectCard={onInspectCard}
          extraNotice={
            roomState.challengerQueue.length > 0 && roomState.roomMode === 'KING_OF_THE_HILL'
              ? 'Penantang berikutnya di antrean siap masuk ke Kursi Petarung!'
              : null
          }
          primaryAction={
            canManageRoom || !isSpectator
              ? {
                  label:
                    roomState.roomMode === 'TOURNAMENT'
                      ? 'Partai Turnamen Berikutnya'
                      : roomState.challengerQueue.length > 0
                      ? 'Rotasi Penantang Berikutnya'
                      : 'Tanding Ulang (Rematch)',
                  onClick: () => sendWs({ type: 'room:next_match' }),
                }
              : null
          }
          secondaryAction={
            canManageRoom || !isSpectator
              ? {
                  label: 'Ke Lobi Room',
                  onClick: () => sendWs({ type: 'room:return_lobby' }),
                }
              : null
          }
          waitingNotice={
            isSpectator && !canManageRoom
              ? 'Menunggu Device Wasit / Host / Petarung memulai partai berikutnya...'
              : null
          }
        />
      </section>
    );
  }

  // =========================================================================
  // VIEW 3: INSIDE ROOM LOBBY (P1, DEVICE WASIT / HOST, P2 + QUEUE + TOURNAMENT)
  // =========================================================================
  return (
    <section className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Room Invite Header */}
      <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="text-xs font-mono text-amber-400 tabular-nums">
            <span>Kode Room: {roomState.code}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>{roomState.participants.filter((p) => p.connected).length} Perangkat Terhubung</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>
              {roomState.roomMode === 'PHYSICAL_SIMULATION'
                ? 'Mode Siaran Simulasi Kartu Asli'
                : roomState.roomMode === 'TOURNAMENT'
                ? 'Mode Turnamen Liga'
                : 'Mode Duel & Raja Arena'}
            </span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className={refereePart ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
              {roomState.roomMode === 'PHYSICAL_SIMULATION'
                ? `Host Meja: ${refereePart?.name || 'Host'}`
                : refereePart
                ? `Wasit: ${refereePart.name}`
                : 'Slot Wasit Terbuka'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-display font-extrabold text-white">
            {roomState.roomName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Aturan: {roomState.deckSize} Kartu Unik Sekali Pakai · {matchRuleLabel} ·{' '}
            {roomState.isPublic ? 'Room Publik' : 'Room Privat'} · Peran Anda:{' '}
            <strong className="text-white">
              {isReferee
                ? isHost
                  ? 'Host & Device Wasit'
                  : 'Device Wasit'
                : mySeat !== null
                ? `${isHost ? 'Host & ' : ''}Petarung ${mySeat + 1}`
                : isHost
                ? 'Host & Penonton'
                : queuePosition >= 0
                ? `Antrean Penantang #${queuePosition + 1}`
                : 'Penonton'}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AudioControlWidget compact />

          <button
            type="button"
            onClick={() => handleCopyInvite('code')}
            className="px-3.5 py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 font-mono"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Kode: {roomState.code}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopyInvite('link')}
            className="px-4 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Link Pemain</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopyInvite('referee_link')}
            className="px-3.5 py-2.5 text-xs font-bold bg-emerald-400/15 hover:bg-emerald-400 hover:text-slate-950 text-emerald-300 border border-emerald-400/40 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Gavel className="w-3.5 h-3.5" />
            <span>Link Device Wasit</span>
          </button>

          <button
            type="button"
            onClick={() => sendWs({ type: 'room:leave' })}
            className="px-3.5 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {copyFeedback && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs sm:text-sm text-emerald-300">
          {copyFeedback}
        </div>
      )}

      {errorBanner && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs sm:text-sm text-rose-200 flex items-center justify-between gap-3">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-rose-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 8 Cols: 3 Official Arena Stations (P1, Device Wasit, P2) & Controls */}
        <div className="lg:col-span-8 space-y-6">
          {roomState.roomMode === 'PHYSICAL_SIMULATION' ? (
            <div className="bg-[#131C31] border border-emerald-500/40 rounded-2xl p-6 space-y-3">
              <div className="text-xs font-mono text-emerald-400">
                Siaran Live Meja Kartu Asli · Menunggu Ronde Dimulai
              </div>
              <h2 className="text-xl font-display font-bold text-white">
                Terhubung ke Meja Simulasi Kartu Asli ({roomState.roomName})
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Pertandingan ini dimainkan menggunakan kartu fisik asli di meja nyata dan diinput langsung oleh Host Meja ({refereePart?.name || 'Host'}). Begitu Host menekan <strong className="text-white">Mulai Simulasi Kartu Asli</strong>, layar Anda otomatis menampilkan Arena 3D, Adu Suit, Efek Kartu, dan K.O. secara langsung.
              </p>
            </div>
          ) : (
            <>
              {/* Three Official Arena Stations: Fighter 1 · Device Wasit · Fighter 2 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Station 1: Seat 0 */}
                <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono text-amber-400">Kursi Petarung 1</div>
                    {seat0Part ? (
                      <>
                        <div className="mt-1 text-lg font-display font-bold text-white flex items-center gap-2">
                          <span className="truncate">{seat0Part.name}</span>
                          {seat0Part.isHost && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                        </div>
                        <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                          <span>{seat0Part.deckCount} Kartu</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>Suit S{seat0Part.suitArtSet}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{seat0Part.streak}x</span>
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-xs text-slate-400 leading-relaxed">
                        Kursi kosong — menunggu perangkat Petarung 1 duduk.
                      </div>
                    )}
                  </div>

                  <div>
                    {!seat0Part ? (
                      <button
                        type="button"
                        onClick={() => sendWs({ type: 'room:claim_seat', seat: 0 })}
                        className="w-full py-2.5 px-3 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        Duduk di Kursi P1
                      </button>
                    ) : seat0Part.clientId === roomState.yourClientId ? (
                      <button
                        type="button"
                        onClick={() => sendWs({ type: 'room:step_down', spectatorOnly: false })}
                        className="w-full py-2 px-3 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        Turun dari Kursi P1
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Station 2 (Center): Official Device Wasit / Host Referee */}
                <div className="bg-[#101D2F] border border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                      <Gavel className="w-3.5 h-3.5" />
                      <span>Stasiun Device Wasit</span>
                    </div>
                    {refereePart ? (
                      <>
                        <div className="mt-1 text-lg font-display font-bold text-white flex items-center gap-2">
                          <span className="truncate">{refereePart.name}</span>
                          {refereePart.isHost && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                        </div>
                        <div className="mt-1 text-xs text-emerald-300/90 leading-snug">
                          Pengadil Resmi · Kontrol Jeda, Skor, &amp; Inspeksi Kartu
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-xs text-slate-400 leading-relaxed">
                        Opsional — Jadikan perangkat ke-3 (HP/tablet) sebagai Wasit atau Layar Meja Tengah.
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {!refereePart || (!refereePart.connected && !isReferee) ? (
                      <button
                        type="button"
                        onClick={() => sendWs({ type: 'room:claim_referee' })}
                        className="w-full py-2.5 px-3 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Gavel className="w-3.5 h-3.5" />
                        <span>Jadi Device Wasit</span>
                      </button>
                    ) : isReferee ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => sendWs({ type: 'room:leave_referee', joinQueue: true })}
                          className="py-2 px-2 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
                        >
                          Jadi Petarung
                        </button>
                        <button
                          type="button"
                          onClick={() => sendWs({ type: 'room:leave_referee', joinQueue: false })}
                          className="py-2 px-2 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
                        >
                          Jadi Penonton
                        </button>
                      </div>
                    ) : isHost ? (
                      <button
                        type="button"
                        onClick={() => sendWs({ type: 'room:claim_referee' })}
                        className="w-full py-2 px-3 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        Ambil Alih Wasit
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Station 3: Seat 1 */}
                <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono text-sky-400">Kursi Petarung 2</div>
                    {seat1Part ? (
                      <>
                        <div className="mt-1 text-lg font-display font-bold text-white flex items-center gap-2">
                          <span className="truncate">{seat1Part.name}</span>
                          {seat1Part.isHost && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                        </div>
                        <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                          <span>{seat1Part.deckCount} Kartu</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>Suit S{seat1Part.suitArtSet}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{seat1Part.streak}x</span>
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-xs text-slate-400 leading-relaxed">
                        Menunggu perangkat lawan masuk menggunakan Kode / Link Pemain.
                      </div>
                    )}
                  </div>

                  <div>
                    {!seat1Part ? (
                      <button
                        type="button"
                        onClick={() => sendWs({ type: 'room:claim_seat', seat: 1 })}
                        className="w-full py-2.5 px-3 text-xs font-bold bg-sky-400 hover:bg-sky-300 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        Duduk di Kursi P2
                      </button>
                    ) : seat1Part.clientId === roomState.yourClientId ? (
                      <button
                        type="button"
                        onClick={() => sendWs({ type: 'room:step_down', spectatorOnly: false })}
                        className="w-full py-2 px-3 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        Turun dari Kursi P2
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Launch Battle & Multi-Device Tournament Controls */}
              <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-display font-bold text-white">
                    {seat0Part && seat1Part
                      ? `Siap Tanding: ${seat0Part.name} vs ${seat1Part.name}${
                          refereePart ? ` (Wasit: ${refereePart.name})` : ''
                        }`
                      : 'Menunggu Kursi Petarung 1 & Petarung 2 Terisi'}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {isReferee
                      ? 'Anda bertugas sebagai Device Wasit. Begitu kedua kursi petarung terisi, tekan Mulai Pertarungan untuk memimpin laga!'
                      : roomState.participants.length >= 3
                      ? `${roomState.participants.length} perangkat terhubung! Wasit, antrean penantang, dan penonton tersinkron real-time.`
                      : 'Bagikan Link Pemain ke lawan tanding atau Link Device Wasit ke HP/tablet pengadil.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canManageRoom && (seat0Part || seat1Part) && (
                    <button
                      type="button"
                      onClick={() => sendWs({ type: 'host:swap_fighters' })}
                      className="px-3.5 py-3 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Tukar P1 ↔ P2</span>
                    </button>
                  )}

                  {canManageRoom && activeContendersCount >= 2 && roomState.participants.length >= 3 && (
                    <button
                      type="button"
                      onClick={() => sendWs({ type: 'room:generate_tournament' })}
                      className="px-4 py-3 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
                    >
                      Buat Turnamen ({activeContendersCount} Petarung)
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!seat0Part || !seat1Part || (!canManageRoom && mySeat === null)}
                    onClick={() => sendWs({ type: 'room:start_battle' })}
                    className={`px-6 py-3 text-sm font-bold disabled:bg-slate-800 disabled:text-slate-500 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-lg ${
                      isReferee
                        ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    {isReferee ? <Gavel className="w-4 h-4" /> : <Swords className="w-4 h-4" />}
                    <span>{isReferee ? 'Mulai & Pimpin Laga' : 'Mulai Pertarungan Live'}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* My Device Loadout Switcher inside Room */}
          <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-display font-bold text-white">
                Pengaturan Dek &amp; Peran Perangkat Anda
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {!isReferee && (!refereePart || !refereePart.connected) && (
                  <button
                    type="button"
                    onClick={() => sendWs({ type: 'room:claim_referee' })}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-400/15 hover:bg-emerald-400 hover:text-slate-950 text-emerald-300 border border-emerald-400/40 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    <span>Beralih Jadi Device Wasit</span>
                  </button>
                )}
                {mySeat === null && !isReferee && meParticipant && (
                  <button
                    type="button"
                    onClick={() =>
                      sendWs({
                        type: 'room:step_down',
                        spectatorOnly: !meParticipant.spectatorOnly,
                      })
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {meParticipant.spectatorOnly
                      ? 'Masuk ke Antrean Penantang'
                      : 'Ubah Jadi Penonton Saja'}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-400 mb-1">
                  {isReferee ? 'Nama Wasit / Perangkat' : 'Nama Anda'}
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={() => handleSyncLoadoutToRoom(selectedDeckChoice, suitArtSet, playerName)}
                  maxLength={24}
                  className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-xs text-slate-400 mb-1">
                  Dek Unik (Cadangan Bila Ikut Tanding)
                </label>
                <select
                  value={selectedDeckChoice}
                  onChange={(e) => {
                    setSelectedDeckChoice(e.target.value);
                    handleSyncLoadoutToRoom(e.target.value, suitArtSet);
                  }}
                  className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  {deckOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <label className="block text-xs text-slate-400">Seri Kartu Suit</label>
                  {onOpenCreateSuitCard && (
                    <button
                      type="button"
                      onClick={onOpenCreateSuitCard}
                      className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 whitespace-nowrap shrink-0"
                    >
                      + Upload
                    </button>
                  )}
                </div>
                <select
                  value={suitArtSet}
                  onChange={(e) => {
                    const nextS = Math.max(1, Number(e.target.value) || 1);
                    setSuitArtSet(nextS);
                    handleSyncLoadoutToRoom(selectedDeckChoice, nextS);
                  }}
                  className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  {availableSuitSets.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.shortLabel}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Host & Device Wasit Room Format Adjustments */}
          {canManageRoom && (
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-display font-bold text-white">
                  Pengaturan Format Room (Host &amp; Device Wasit)
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    sendWs({
                      type: 'room:update_settings',
                      roomMode: roomState.roomMode,
                      deckSize: roomState.deckSize,
                      matchRule: roomState.matchRule,
                      isPublic: !roomState.isPublic,
                    })
                  }
                  className="px-3 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {roomState.isPublic ? 'Ubah ke Privat' : 'Ubah ke Publik'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Mode Room</label>
                  <select
                    value={roomState.roomMode}
                    onChange={(e) =>
                      sendWs({
                        type: 'room:update_settings',
                        roomMode: e.target.value as RoomMode,
                        deckSize: roomState.deckSize,
                        matchRule: roomState.matchRule,
                        isPublic: roomState.isPublic,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white"
                  >
                    <option value="KING_OF_THE_HILL">Duel &amp; Raja Arena</option>
                    <option value="TOURNAMENT">Turnamen Liga</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ukuran Dek Unik</label>
                  <select
                    value={roomState.deckSize}
                    onChange={(e) =>
                      sendWs({
                        type: 'room:update_settings',
                        roomMode: roomState.roomMode,
                        deckSize: Number(e.target.value) as OnlineDeckSize,
                        matchRule: roomState.matchRule,
                        isPublic: roomState.isPublic,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white"
                  >
                    {[5, 10, 15, 20, 30].map((sz) => (
                      <option key={sz} value={sz}>
                        {sz} Kartu Unik
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Target Menang</label>
                  <select
                    value={roomState.matchRule}
                    onChange={(e) =>
                      sendWs({
                        type: 'room:update_settings',
                        roomMode: roomState.roomMode,
                        deckSize: roomState.deckSize,
                        matchRule: e.target.value as MatchRulePreset,
                        isPublic: roomState.isPublic,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white"
                  >
                    <option value="ROUNDS_3">3 Ronde</option>
                    <option value="ROUNDS_5">5 Ronde</option>
                    <option value="WINS_3">3 Kartu Menang</option>
                    <option value="WINS_5">5 Kartu Menang</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Tournament Schedule Table when active */}
          {roomState.tournamentMatches.length > 0 && (
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-base font-display font-bold text-white">
                Jadwal Turnamen Multi-Perangkat
              </h2>
              <div className="divide-y divide-slate-800/80 text-xs">
                {roomState.tournamentMatches.map((tm) => (
                  <div key={tm.id} className="py-2.5 flex items-center justify-between gap-3">
                    <span className="font-mono text-slate-400 shrink-0">{tm.label}</span>
                    <span className="font-semibold text-white flex-1 truncate">
                      {tm.p1Name} <span className="text-slate-500">vs</span> {tm.p2Name}
                    </span>
                    <span className="font-mono tabular-nums text-amber-300 shrink-0">
                      {tm.status === 'DONE'
                        ? tm.winnerClientId === 'DRAW'
                          ? 'Seri'
                          : `Menang: ${
                              tm.winnerClientId === tm.p1ClientId ? tm.p1Name : tm.p2Name
                            }`
                        : tm.status === 'LIVE'
                        ? 'Giliran Main'
                        : 'Menunggu'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Cols: All Connected Devices, Host/Wasit Seat Assignment, Leaderboard & Chat */}
        <div className="lg:col-span-4 space-y-6">
          {/* Connected Devices & Host/Referee Seat Assignment */}
          <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-display font-bold text-white">
                Perangkat di Room ({roomState.participants.length})
              </h2>
              <span className="text-xs font-mono text-slate-400">
                {canManageRoom ? 'Kelola Kursi & Poin' : 'Klasemen Poin'}
              </span>
            </div>

            <div className="divide-y divide-slate-800/80 text-xs max-h-80 overflow-y-auto pr-1">
              {roomState.participants.map((p, idx) => {
                const roleLabel = p.isReferee
                  ? 'Device Wasit'
                  : roomState.fighters[0] === p.clientId
                  ? 'Petarung 1'
                  : roomState.fighters[1] === p.clientId
                  ? 'Petarung 2'
                  : roomState.challengerQueue.includes(p.clientId)
                  ? `Antrean Penantang #${roomState.challengerQueue.indexOf(p.clientId) + 1}`
                  : 'Penonton';

                const assignRole = (role: SeatAssignmentTarget) =>
                  sendWs({ type: 'host:assign_role', targetClientId: p.clientId, role });

                return (
                  <div key={p.clientId} className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate flex items-center gap-1.5">
                          <span className="font-mono text-slate-500 tabular-nums">{idx + 1}.</span>
                          <span className="truncate">{p.name}</span>
                          {p.isHost && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          {p.isReferee && (
                            <Gavel className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          {p.clientId === roomState.yourClientId && (
                            <span className="text-slate-400 font-normal">(Anda)</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          <span className={p.isReferee ? 'text-emerald-300 font-semibold' : ''}>
                            {roleLabel}
                          </span>
                          {' · '}
                          <span>{p.connected ? 'Terhubung' : 'Terputus'}</span>
                        </div>
                      </div>

                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div className="font-bold text-amber-300">{p.points} Poin</div>
                        <div className="text-[11px] text-slate-400">
                          {p.wins}M · {p.losses}K · {p.draws}S
                        </div>
                      </div>
                    </div>

                    {canManageRoom && (
                      <div className="flex flex-wrap items-center gap-1">
                        {roomState.fighters[0] !== p.clientId && (
                          <button
                            type="button"
                            onClick={() => assignRole('FIGHTER_1')}
                            className="px-2 py-0.5 text-[10px] font-semibold bg-[#0B1120] hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            Set P1
                          </button>
                        )}
                        {roomState.fighters[1] !== p.clientId && (
                          <button
                            type="button"
                            onClick={() => assignRole('FIGHTER_2')}
                            className="px-2 py-0.5 text-[10px] font-semibold bg-[#0B1120] hover:bg-sky-400 hover:text-slate-950 text-sky-300 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            Set P2
                          </button>
                        )}
                        {!p.isReferee && (
                          <button
                            type="button"
                            onClick={() => assignRole('REFEREE')}
                            className="px-2 py-0.5 text-[10px] font-semibold bg-[#0B1120] hover:bg-emerald-400 hover:text-slate-950 text-emerald-300 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            Set Wasit
                          </button>
                        )}
                        {!roomState.challengerQueue.includes(p.clientId) &&
                          (p.isReferee ||
                            roomState.fighters[0] === p.clientId ||
                            roomState.fighters[1] === p.clientId ||
                            p.spectatorOnly) && (
                            <button
                              type="button"
                              onClick={() => assignRole('QUEUE')}
                              className="px-2 py-0.5 text-[10px] font-semibold bg-[#0B1120] hover:bg-slate-700 text-slate-300 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                            >
                              Ke Antrean
                            </button>
                          )}
                        {!p.spectatorOnly && (
                          <button
                            type="button"
                            onClick={() => assignRole('SPECTATOR')}
                            className="px-2 py-0.5 text-[10px] font-semibold bg-[#0B1120] hover:bg-slate-700 text-slate-400 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            Penonton
                          </button>
                        )}
                        {isHost && p.clientId !== roomState.yourClientId && p.connected && (
                          <button
                            type="button"
                            onClick={() =>
                              sendWs({ type: 'host:transfer_host', targetClientId: p.clientId })
                            }
                            className="px-2 py-0.5 text-[10px] font-semibold bg-[#0B1120] hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            Oper Host
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Room Chat */}
          <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-display font-bold text-white">
              Obrolan Room Lintas Perangkat
            </h2>

            <div className="h-48 overflow-y-auto space-y-2 text-xs pr-1 bg-[#0B1120] border border-slate-800/90 rounded-xl p-3">
              {roomState.chat.map((c) => (
                <div key={c.id} className="leading-relaxed">
                  {c.isSystem ? (
                    <span className="text-amber-300">{c.text}</span>
                  ) : c.isReferee ? (
                    <>
                      <span className="font-bold text-emerald-300">[{c.senderName}]: </span>
                      <span className="text-emerald-100 font-medium">{c.text}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-sky-300">{c.senderName}: </span>
                      <span className="text-slate-200">{c.text}</span>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_REACTIONS.map((rx) => (
                <button
                  key={rx}
                  type="button"
                  onClick={() => handleSendChat(rx)}
                  className="px-2.5 py-1 text-[11px] bg-[#0B1120] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {rx}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendChat();
                }}
                placeholder="Ketik pesan ke semua perangkat..."
                maxLength={140}
                className="flex-1 min-w-0 px-3 py-2 text-xs bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => handleSendChat()}
                className="px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
