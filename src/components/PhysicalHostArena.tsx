import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Eye,
  EyeOff,
  Flame,
  Gavel,
  Heart,
  Layers,
  Link2,
  Loader2,
  Megaphone,
  Minus,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import {
  BATTLE_CARDS,
  CARD_BY_ID,
  getAvailableSuitArtSets,
  getCustomOrEditedCardsForDeck,
  getSuitCardForSet,
  isCardModified,
  PRESET_DECKS,
  upsertCardDefinition,
} from '../data/cards';
import {
  addHostAnnouncement,
  adjustPhysicalFighterStat,
  adjustPhysicalHandCount,
  checkPhysicalCardPlayability,
  createPhysicalSimSession,
  declarePhysicalMatchWinner,
  deployPhysicalCharacters,
  forcePhysicalRoundWinner,
  type PhysicalPromptResolution,
  type PhysicalSimSession,
  type PhysicalWinRule,
  recordPhysicalCardToZone,
  resolvePhysicalSuitClash,
  resolvePhysicalSupportsAndStrike,
  resolvePhysicalTablePrompt,
  startNextPhysicalRound,
  togglePhysicalRule,
} from '../engine/physicalSimEngine';
import { compareSuitElements } from '../engine/battleEngine';
import {
  type AnalyzedCardImageResult,
  CardCategory,
  type CardDefinition,
  type CardInstance,
  SuitElement,
  type SuitArtSetId,
} from '../types/game';
import type { ClientWsMessage, MatchRulePreset, ServerWsMessage } from '../types/multiplayer';
import {
  getFighterHpVisualState,
  isLegendaryCard,
  soundFx,
  useBattleAudioDirector,
} from '../utils/sound';
import {
  ArenaClashFx,
  CardClashAura,
  loadClashFxEnabled,
  persistClashFxEnabled,
  resolveCardElementTheme,
  SuitClashFlare,
} from './ArenaClashFx';
import { AudioControlWidget, BattleAudioNotice } from './AudioControlPanel';
import { CardBack, CardVisual } from './CardVisual';
import { ComboChainBanner, useComboPresentation } from './ComboChainBanner';
import { KoBannerOverlay, useKoPresentation } from './KoOverlay';
import { VictoryCelebrationOverlay } from './VictoryCelebrationOverlay';

interface PhysicalHostArenaProps {
  cardsVersion: number;
  initialBroadcastEnabled?: boolean;
  onInspectCard: (card: CardDefinition) => void;
  onEditCard: (card: CardDefinition) => void;
  onOpenCreateCard: () => void;
  onOpenCreateSuitCard?: () => void;
  onCardsMutated: () => void;
  onBackToDigitalArena?: () => void;
}

type CharacterFilterTab = 'ALL' | 'READY' | 'BASE' | 'CONDITIONAL' | 'CUSTOM';

const HOST_SESSION_ID_KEY = 'mgc_phys_host_client_id_v1';

function getOrCreateHostClientId(): string {
  try {
    const saved = sessionStorage.getItem(HOST_SESSION_ID_KEY);
    if (saved) return saved;
    const next = `phost-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem(HOST_SESSION_ID_KEY, next);
    return next;
  } catch {
    return `phost-${Math.random().toString(36).slice(2, 9)}`;
  }
}

async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
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

function compressPhysicalPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas foto kartu.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung.'));
      img.onload = () => {
        const maxWidth = 520;
        const maxHeight = 728;
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
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function findMatchingCatalogCard(
  analyzed: AnalyzedCardImageResult,
  targetCategory: CardCategory
): CardDefinition | null {
  const pool = BATTLE_CARDS.filter((c) => c.category === targetCategory);
  const codeRaw = analyzed.detectedCode.trim().toLowerCase();
  if (codeRaw) {
    const numMatch = codeRaw.match(/^0*(\d{1,3})/);
    if (numMatch) {
      const padded = numMatch[1].padStart(2, '0');
      const byCode = pool.find((c) => {
        const cMatch = c.numberLabel.trim().match(/^0*(\d{1,3})/);
        return cMatch && cMatch[1].padStart(2, '0') === padded;
      });
      if (byCode) return byCode;
    }
  }

  const normName = analyzed.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normName.length >= 3) {
    const exact = pool.find(
      (c) =>
        c.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() === normName
    );
    if (exact) return exact;

    const partial = pool.find((c) => {
      const cand = c.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return cand.includes(normName) || normName.includes(cand);
    });
    if (partial) return partial;
  }

  return null;
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

export const PhysicalHostArena: React.FC<PhysicalHostArenaProps> = ({
  cardsVersion,
  initialBroadcastEnabled = false,
  onInspectCard,
  onEditCard,
  onOpenCreateCard,
  onOpenCreateSuitCard,
  onCardsMutated,
  onBackToDigitalArena,
}) => {
  // Setup Configuration State
  const [hostName, setHostName] = useState<string>('Host Meja');
  const [p0Name, setP0Name] = useState<string>('Pemain 1');
  const [p1Name, setP1Name] = useState<string>('Pemain 2');
  const [winRule, setWinRule] = useState<PhysicalWinRule>('ROUNDS_5');
  const [initialHandCount, setInitialHandCount] = useState<number>(4);
  const [p0SuitSet, setP0SuitSet] = useState<SuitArtSetId>(1);
  const [p1SuitSet, setP1SuitSet] = useState<SuitArtSetId>(3);
  const [enforceUniqueCards, setEnforceUniqueCards] = useState<boolean>(true);
  const [enforceConditions, setEnforceConditions] = useState<boolean>(true);
  const [broadcastEnabled, setBroadcastEnabled] = useState<boolean>(initialBroadcastEnabled);

  // Active Simulation & Undo History
  const [session, setSession] = useState<PhysicalSimSession | null>(null);
  const [undoStack, setUndoStack] = useState<PhysicalSimSession[]>([]);

  // Host Console Step Inputs
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [pickedCharIds, setPickedCharIds] = useState<[string | null, string | null]>([null, null]);
  const [charSearch, setCharSearch] = useState<string>('');
  const [charFilter, setCharFilter] = useState<CharacterFilterTab>('ALL');
  const [allowOverrideThisTurn, setAllowOverrideThisTurn] = useState<boolean>(false);

  const [pickedSuits, setPickedSuits] = useState<[SuitElement | null, SuitElement | null]>([
    null,
    null,
  ]);
  const [pickedSupports, setPickedSupports] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [promptSearch, setPromptSearch] = useState<string>('');
  const [selectedWinZoneUids, setSelectedWinZoneUids] = useState<string[]>([]);

  // Presentation & Referee Drawer Controls
  const [projectorCleanMode, setProjectorCleanMode] = useState<boolean>(false);
  const [refereeDrawerOpen, setRefereeDrawerOpen] = useState<boolean>(false);
  const [announcementInput, setAnnouncementInput] = useState<string>('');
  const [manualZonePlayer, setManualZonePlayer] = useState<0 | 1>(0);
  const [manualZoneType, setManualZoneType] = useState<'LOSE' | 'WIN'>('LOSE');
  const [manualZoneCardId, setManualZoneCardId] = useState<string>('bf-01-probe');
  const [clashFxEnabled, setClashFxEnabled] = useState<boolean>(() => loadClashFxEnabled());
  const [zoneInspectModal, setZoneInspectModal] = useState<{
    title: string;
    cards: CardInstance[];
  } | null>(null);

  // Camera / Photo Physical Card Scanner Modal State
  const [scannerState, setScannerState] = useState<{
    open: boolean;
    targetPlayer: 0 | 1;
    targetCategory: CardCategory;
  }>({ open: false, targetPlayer: 0, targetCategory: CardCategory.CHARACTER });
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [scanLoading, setScanLoading] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [scanResultInfo, setScanResultInfo] = useState<{
    analyzed: AnalyzedCardImageResult;
    matchedCard: CardDefinition | null;
    imageDataUrl: string;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live Multi-Screen Broadcast WebSocket State
  const wsRef = useRef<WebSocket | null>(null);
  const hostClientIdRef = useRef<string>(getOrCreateHostClientId());
  const [broadcastRoomCode, setBroadcastRoomCode] = useState<string | null>(null);
  const [broadcastViewerCount, setBroadcastViewerCount] = useState<number>(0);
  const [broadcastCopyMsg, setBroadcastCopyMsg] = useState<string | null>(null);
  const latestSessionRef = useRef<PhysicalSimSession | null>(null);
  latestSessionRef.current = session;

  const availableSuitSets = useMemo(() => {
    void cardsVersion;
    return getAvailableSuitArtSets();
  }, [cardsVersion]);

  // Audio Director & K.O. Overlay
  const audioDirector = useBattleAudioDirector(session?.battle ?? null, { isSpectator: true });
  const { activeKo, koShaking, dismissKo } = useKoPresentation(
    session?.battle ?? null,
    clashFxEnabled
  );
  const { activeCombo, dismissCombo } = useComboPresentation(
    session?.battle ?? null,
    clashFxEnabled
  );

  // Combat HP Delta Animation Tracker
  const p0Active = session?.battle.players[0].active ?? null;
  const p1Active = session?.battle.players[1].active ?? null;
  const prevHpRef = useRef<{
    p0Uid: string | null;
    p0Hp: number;
    p1Uid: string | null;
    p1Hp: number;
  }>({
    p0Uid: null,
    p0Hp: 0,
    p1Uid: null,
    p1Hp: 0,
  });
  const [combatFx, setCombatFx] = useState<{
    id: number;
    p0Delta: number | null;
    p1Delta: number | null;
    attacker: 0 | 1 | null;
  } | null>(null);

  useEffect(() => {
    const curP0Uid = p0Active?.instance.uid ?? null;
    const curP0Hp = p0Active?.currentHp ?? 0;
    const curP1Uid = p1Active?.instance.uid ?? null;
    const curP1Hp = p1Active?.currentHp ?? 0;

    const prev = prevHpRef.current;
    const p0Delta =
      curP0Uid && curP0Uid === prev.p0Uid && curP0Hp !== prev.p0Hp ? curP0Hp - prev.p0Hp : null;
    const p1Delta =
      curP1Uid && curP1Uid === prev.p1Uid && curP1Hp !== prev.p1Hp ? curP1Hp - prev.p1Hp : null;

    prevHpRef.current = {
      p0Uid: curP0Uid,
      p0Hp: curP0Hp,
      p1Uid: curP1Uid,
      p1Hp: curP1Hp,
    };

    if (p0Delta !== null || p1Delta !== null) {
      const attacker: 0 | 1 | null =
        p1Delta !== null && p1Delta < 0 && !(p0Delta !== null && p0Delta < 0)
          ? 0
          : p0Delta !== null && p0Delta < 0 && !(p1Delta !== null && p1Delta < 0)
          ? 1
          : null;

      if ((p0Delta !== null && p0Delta < 0) || (p1Delta !== null && p1Delta < 0)) {
        soundFx.playHit();
      } else {
        soundFx.playShieldBlock();
      }

      const fxId = Date.now();
      setCombatFx({ id: fxId, p0Delta, p1Delta, attacker });
      const timer = window.setTimeout(() => {
        setCombatFx((cur) => (cur?.id === fxId ? null : cur));
      }, 650);
      return () => window.clearTimeout(timer);
    }
  }, [p0Active?.instance.uid, p0Active?.currentHp, p1Active?.instance.uid, p1Active?.currentHp]);

  // Sync Broadcast Room via WebSocket when broadcastEnabled is true
  const pushBattleToBroadcastRoom = useCallback(
    (targetSession: PhysicalSimSession | null, rulingText?: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !broadcastRoomCode) return;

      const allReferencedIds = targetSession
        ? [
            ...targetSession.usedCardIds[0],
            ...targetSession.usedCardIds[1],
            ...(targetSession.battle.players[0].active
              ? [targetSession.battle.players[0].active.def.id]
              : []),
            ...(targetSession.battle.players[1].active
              ? [targetSession.battle.players[1].active.def.id]
              : []),
          ]
        : [];

      const customCards = {
        ...getCustomOrEditedCardsForDeck(allReferencedIds, p0SuitSet),
        ...getCustomOrEditedCardsForDeck(allReferencedIds, p1SuitSet),
      };

      const msg: ClientWsMessage = {
        type: 'host:sync_physical_simulation',
        battle: targetSession ? targetSession.battle : null,
        customCards,
        rulingText,
      };
      ws.send(JSON.stringify(msg));
    },
    [broadcastRoomCode, p0SuitSet, p1SuitSet]
  );

  useEffect(() => {
    if (!broadcastEnabled) {
      if (wsRef.current) {
        try {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
          }
          wsRef.current.close();
        } catch {
          // Ignore close errors
        }
        wsRef.current = null;
      }
      setBroadcastRoomCode(null);
      setBroadcastViewerCount(0);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    const mappedRule: MatchRulePreset =
      winRule === 'ROUNDS_3'
        ? 'ROUNDS_3'
        : winRule === 'WINS_3'
        ? 'WINS_3'
        : winRule === 'WINS_5'
        ? 'WINS_5'
        : 'ROUNDS_5';

    ws.onopen = () => {
      const createMsg: ClientWsMessage = {
        type: 'room:create',
        clientId: hostClientIdRef.current,
        name: hostName.trim() || 'Host Kartu Asli',
        roomName: `Simulasi Fisik: ${p0Name.trim() || 'P1'} vs ${p1Name.trim() || 'P2'}`.slice(
          0,
          28
        ),
        isPublic: true,
        roomMode: 'PHYSICAL_SIMULATION',
        deckSize: 10,
        matchRule: mappedRule,
        deckIds: PRESET_DECKS[0].cardIds.slice(0, 10),
        suitArtSet: p0SuitSet,
        joinRole: 'REFEREE',
      };
      ws.send(JSON.stringify(createMsg));
    };

    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(String(ev.data)) as ServerWsMessage;
        if (payload.type === 'room:state') {
          setBroadcastRoomCode(payload.room.code);
          const others = payload.room.participants.filter(
            (p) => p.connected && p.clientId !== hostClientIdRef.current
          ).length;
          setBroadcastViewerCount(others);
        }
      } catch {
        // Ignore malformed frame
      }
    };

    ws.onclose = () => {
      setBroadcastRoomCode(null);
    };

    return () => {
      try {
        ws.close();
      } catch {
        // Ignore
      }
      wsRef.current = null;
    };
  }, [broadcastEnabled]);

  useEffect(() => {
    if (broadcastEnabled && broadcastRoomCode) {
      pushBattleToBroadcastRoom(session);
    }
  }, [session, broadcastEnabled, broadcastRoomCode, pushBattleToBroadcastRoom]);

  // Stop camera stream helper
  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Apply state transition with Undo stack
  const commitNextSession = useCallback(
    (updater: (current: PhysicalSimSession) => PhysicalSimSession) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        if (next === prev) return prev;
        setUndoStack((stack) => [...stack.slice(-24), prev]);
        return next;
      });
    },
    []
  );

  const handleUndoStep = () => {
    if (undoStack.length === 0) return;
    soundFx.playCardSelect();
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setSession(previous);
    setPickedSuits([null, null]);
    setPickedSupports([null, null]);
  };

  const handleStartSimulation = () => {
    soundFx.playCardDeploy();
    const fresh = createPhysicalSimSession({
      hostName,
      p0Name,
      p1Name,
      winRule,
      initialHandCount,
      p0SuitSet,
      p1SuitSet,
      enforceUniqueCards,
      enforceConditions,
    });
    setUndoStack([]);
    setPickedCharIds([null, null]);
    setPickedSuits([null, null]);
    setPickedSupports([null, null]);
    setActiveSlot(0);
    setAllowOverrideThisTurn(false);
    setProjectorCleanMode(false);
    setSession(fresh);
  };

  // Character Pool for Step 1
  const characterCards = useMemo(() => {
    void cardsVersion;
    const allChars = BATTLE_CARDS.filter((c) => c.category === CardCategory.CHARACTER);
    return allChars.filter((card) => {
      if (charFilter === 'BASE' && card.condition) return false;
      if (charFilter === 'CONDITIONAL' && !card.condition) return false;
      if (charFilter === 'CUSTOM' && !card.isCustom && !isCardModified(card.id)) return false;
      if (charFilter === 'READY' && session) {
        const check = checkPhysicalCardPlayability(session, activeSlot, card);
        if (!check.playable) return false;
      }

      if (charSearch.trim()) {
        const q = charSearch.toLowerCase().trim();
        return (
          card.name.toLowerCase().includes(q) ||
          card.numberLabel.toLowerCase().includes(q) ||
          card.rank.toLowerCase() === q ||
          card.effectText.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cardsVersion, charFilter, charSearch, session, activeSlot]);

  const supportCards = useMemo(() => {
    void cardsVersion;
    return BATTLE_CARDS.filter((c) => c.category === CardCategory.SUPPORT);
  }, [cardsVersion]);

  const handlePickCharacterForSlot = (card: CardDefinition, targetIdx: 0 | 1 = activeSlot) => {
    if (!session) return;
    const check = checkPhysicalCardPlayability(session, targetIdx, card);
    if (!check.playable && !allowOverrideThisTurn) return;

    soundFx.playCardSelect();
    setPickedCharIds((prev) => {
      const next: [string | null, string | null] = [prev[0], prev[1]];
      next[targetIdx] = next[targetIdx] === card.id ? null : card.id;
      if (targetIdx === 0 && next[0] && !next[1]) {
        setActiveSlot(1);
      } else if (targetIdx === 1 && next[1] && !next[0]) {
        setActiveSlot(0);
      }
      return next;
    });
  };

  const handleDeployPickedCharacters = () => {
    if (!session || !pickedCharIds[0] || !pickedCharIds[1]) return;
    soundFx.playCardDeploy();
    const id0 = pickedCharIds[0];
    const id1 = pickedCharIds[1];
    commitNextSession((cur) => deployPhysicalCharacters(cur, id0, id1));
    setPickedCharIds([null, null]);
    setPickedSuits([null, null]);
    setPickedSupports([null, null]);
    setAllowOverrideThisTurn(false);
    setActiveSlot(0);
  };

  const handleExecuteSuitClash = useCallback(() => {
    if (!session || session.step !== 'PICK_SUITS') return;
    if (!pickedSuits[0] || !pickedSuits[1]) return;
    const s0 = pickedSuits[0];
    const s1 = pickedSuits[1];
    const outcome = compareSuitElements(s0, s1);
    soundFx.playSuitClash(outcome === 'DRAW' ? 'draw' : 'win');
    commitNextSession((cur) => resolvePhysicalSuitClash(cur, s0, s1));
    setPickedSuits([null, null]);
    setPickedSupports([null, null]);
  }, [session, pickedSuits, commitNextSession]);

  // Keyboard shortcuts during PICK_SUITS (Q/W/E for P1 Air/Api/Daun, I/O/P for P2 Air/Api/Daun, Enter to clash)
  useEffect(() => {
    if (!session || session.step !== 'PICK_SUITS') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = e.key.toLowerCase();
      if (key === 'q') setPickedSuits((p) => [SuitElement.AIR, p[1]]);
      else if (key === 'w') setPickedSuits((p) => [SuitElement.API, p[1]]);
      else if (key === 'e') setPickedSuits((p) => [SuitElement.DAUN, p[1]]);
      else if (key === 'i') setPickedSuits((p) => [p[0], SuitElement.AIR]);
      else if (key === 'o') setPickedSuits((p) => [p[0], SuitElement.API]);
      else if (key === 'p') setPickedSuits((p) => [p[0], SuitElement.DAUN]);
      else if (key === 'enter' && pickedSuits[0] && pickedSuits[1]) {
        e.preventDefault();
        handleExecuteSuitClash();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, pickedSuits, handleExecuteSuitClash]);

  const handleExecuteSupportsAndStrike = () => {
    if (!session || session.step !== 'PICK_SUPPORTS_AND_STRIKE') return;
    commitNextSession((cur) =>
      resolvePhysicalSupportsAndStrike(cur, pickedSupports[0], pickedSupports[1])
    );
    setPickedSupports([null, null]);
  };

  const handleNextRound = () => {
    if (!session || session.step !== 'ROUND_END') return;
    soundFx.playCardDeploy();
    commitNextSession((cur) => startNextPhysicalRound(cur));
    setPickedCharIds([null, null]);
    setPickedSuits([null, null]);
    setPickedSupports([null, null]);
    setActiveSlot(0);
  };

  const handleResolvePrompt = (res: PhysicalPromptResolution) => {
    soundFx.playShieldBlock();
    commitNextSession((cur) => resolvePhysicalTablePrompt(cur, res));
    setPromptSearch('');
    setSelectedWinZoneUids([]);
  };

  const handleSendHostAnnouncement = () => {
    if (!session || !announcementInput.trim()) return;
    const text = announcementInput.trim();
    soundFx.playCardDeploy();
    commitNextSession((cur) => addHostAnnouncement(cur, text));
    if (broadcastEnabled && broadcastRoomCode) {
      pushBattleToBroadcastRoom(latestSessionRef.current, text);
    }
    setAnnouncementInput('');
  };

  // Camera & Photo Scan Handlers
  const openPhysicalCardScanner = (targetPlayer: 0 | 1, targetCategory: CardCategory) => {
    stopCameraStream();
    setScanError(null);
    setScanPreviewUrl(null);
    setScanResultInfo(null);
    setScannerState({ open: true, targetPlayer, targetCategory });
  };

  const closePhysicalCardScanner = () => {
    stopCameraStream();
    setScannerState((prev) => ({ ...prev, open: false }));
    setScanError(null);
    setScanResultInfo(null);
  };

  const startLiveCamera = async () => {
    setScanError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanError(
        'Kamera langsung tidak tersedia di peramban ini. Gunakan tombol Pilih / Ambil Foto Kartu di sebelah kanan.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setScanError(
        'Izin kamera ditolak atau dibatasi iframe. Gunakan tombol Ambil / Unggah Foto Kartu untuk memindai.'
      );
    }
  };

  const analyzeDataUrlForPhysicalPlay = async (imageDataUrl: string, fileName?: string) => {
    setScanLoading(true);
    setScanError(null);
    setScanPreviewUrl(imageDataUrl);
    setScanResultInfo(null);

    try {
      const response = await fetch('/api/cards/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          fileName,
          preferredCategory: scannerState.targetCategory,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { result?: AnalyzedCardImageResult; error?: string }
        | null;
      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error || 'Gagal mengenali kartu fisik dari foto.');
      }

      const analyzed = payload.result;
      const matched = findMatchingCatalogCard(analyzed, scannerState.targetCategory);
      setScanResultInfo({ analyzed, matchedCard: matched, imageDataUrl });
      soundFx.playCardSelect();
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Terjadi kendala saat menganalisis foto kartu fisik.'
      );
    } finally {
      setScanLoading(false);
    }
  };

  const captureFromVideoAndAnalyze = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const maxWidth = 520;
    const maxHeight = 728;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > maxWidth || h > maxHeight) {
      const ratio = Math.min(maxWidth / w, maxHeight / h);
      w = Math.max(1, Math.round(w * ratio));
      h = Math.max(1, Math.round(h * ratio));
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCameraStream();
    void analyzeDataUrlForPhysicalPlay(dataUrl, 'kamera-kartu-fisik.jpg');
  };

  const handleApplyScannedCard = (registerAsNewCard: boolean) => {
    if (!scanResultInfo) return;
    const { analyzed, matchedCard, imageDataUrl } = scanResultInfo;
    let chosenCard: CardDefinition | null = !registerAsNewCard ? matchedCard : null;

    if (!chosenCard) {
      const newCardId = `phys-scan-${Date.now().toString(36)}`;
      const createdCard: CardDefinition = {
        id: newCardId,
        numberLabel: analyzed.detectedCode || 'FISIK',
        name: analyzed.name,
        category: scannerState.targetCategory,
        rank:
          scannerState.targetCategory === CardCategory.SUPPORT
            ? 'SUPPORT'
            : analyzed.rank === 'SUPPORT' || analyzed.rank === 'SUIT'
            ? 'A'
            : analyzed.rank,
        image: imageDataUrl,
        hp: scannerState.targetCategory === CardCategory.CHARACTER ? analyzed.hp || 140 : 0,
        atk: scannerState.targetCategory === CardCategory.CHARACTER ? analyzed.atk || 100 : 0,
        effectPriority: analyzed.effectPriority,
        effectText: analyzed.effectText,
        characterTags: analyzed.characterTags,
        condition:
          analyzed.hasCondition && analyzed.conditionRequiredTags.length > 0
            ? {
                mode: analyzed.conditionMode,
                requiredTags: analyzed.conditionRequiredTags,
                description: analyzed.conditionDescription,
              }
            : undefined,
        effectKey: analyzed.effectKey,
        packSeriesId: 'pek-kreasi-pemain',
        isCustom: true,
        showCustomOverlay: !analyzed.hasPrintedCardFrame,
      };
      upsertCardDefinition(createdCard);
      onCardsMutated();
      chosenCard = CARD_BY_ID[createdCard.id] ?? createdCard;
    }

    if (chosenCard && session) {
      const targetIdx = scannerState.targetPlayer;
      if (scannerState.targetCategory === CardCategory.CHARACTER) {
        setAllowOverrideThisTurn(true);
        setPickedCharIds((prev) => {
          const next: [string | null, string | null] = [prev[0], prev[1]];
          next[targetIdx] = chosenCard!.id;
          return next;
        });
      } else if (scannerState.targetCategory === CardCategory.SUPPORT) {
        setPickedSupports((prev) => {
          const next: [string | null, string | null] = [prev[0], prev[1]];
          next[targetIdx] = chosenCard!.id;
          return next;
        });
      }
      soundFx.playCardSelect();
    }

    closePhysicalCardScanner();
  };

  const handleCopyBroadcastInvite = async (mode: 'code' | 'link') => {
    if (!broadcastRoomCode) return;
    const text =
      mode === 'code'
        ? broadcastRoomCode
        : `${window.location.origin}${window.location.pathname}?room=${broadcastRoomCode}`;
    const ok = await copyTextSafe(text);
    setBroadcastCopyMsg(
      ok
        ? mode === 'code'
          ? `Kode Siaran ${broadcastRoomCode} disalin!`
          : `Link Layar Penonton (${broadcastRoomCode}) disalin!`
        : `Kode Room Siaran: ${broadcastRoomCode}`
    );
    window.setTimeout(() => setBroadcastCopyMsg(null), 2800);
  };

  // ============================================================================
  // VIEW 1: SETUP SCREEN FOR HOST SIMULASI KARTU ASLI
  // ============================================================================
  if (!session) {
    return (
      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-slate-800">
          <div>
            <div className="text-xs font-mono text-amber-400">
              Mode Meja Turnamen &amp; Rumahan · Integrasi Kartu Cetak Fisik
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-display font-extrabold text-white">
              Host Simulasi Kartu Asli
            </h1>
            <p className="mt-1.5 text-sm text-slate-300 max-w-2xl leading-relaxed">
              Kedua pemain memegang, mengocok, dan menurunkan <strong>kartu asli (fisik)</strong> di atas meja nyata. Perangkat Host ini menghitung seluruh efek kartu otomatis, menampilkan arena 3D, partikel bentrokan elemen, BGM adaptif, hingga efek K.O.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <AudioControlWidget />

            {onOpenCreateSuitCard && (
              <button
                type="button"
                onClick={onOpenCreateSuitCard}
                className="px-3.5 py-2.5 text-xs font-semibold bg-[#131C31] hover:bg-slate-800 text-sky-300 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Suit</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenCreateCard}
              className="px-3.5 py-2.5 text-xs font-semibold bg-[#131C31] hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Daftarkan Kartu Fisik</span>
            </button>

            {onBackToDigitalArena && (
              <button
                type="button"
                onClick={onBackToDigitalArena}
                className="px-3.5 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Ke Arena Digital
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left 7 Cols: Host & Physical Match Settings */}
          <div className="lg:col-span-7 bg-[#131C31] border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <h2 className="text-lg font-display font-bold text-white">
                Pengaturan Meja &amp; Pemain Kartu Asli
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-emerald-300 mb-1.5">
                    Nama Host / Pengadil
                  </label>
                  <input
                    type="text"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    maxLength={24}
                    placeholder="Host Meja"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                    Nama Pemain 1 (Kiri)
                  </label>
                  <input
                    type="text"
                    value={p0Name}
                    onChange={(e) => setP0Name(e.target.value)}
                    maxLength={24}
                    placeholder="Pemain 1"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sky-300 mb-1.5">
                    Nama Pemain 2 (Kanan)
                  </label>
                  <input
                    type="text"
                    value={p1Name}
                    onChange={(e) => setP1Name(e.target.value)}
                    maxLength={24}
                    placeholder="Pemain 2"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Format Kemenangan Pertandingan
                  </label>
                  <div className="grid grid-cols-5 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                    {[
                      { id: 'ROUNDS_3' as PhysicalWinRule, label: '3 Rnd' },
                      { id: 'ROUNDS_5' as PhysicalWinRule, label: '5 Rnd' },
                      { id: 'ROUNDS_7' as PhysicalWinRule, label: '7 Rnd' },
                      { id: 'WINS_3' as PhysicalWinRule, label: '3 Mng' },
                      { id: 'WINS_5' as PhysicalWinRule, label: '5 Mng' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setWinRule(opt.id)}
                        className={`py-2 px-1 text-xs font-mono font-semibold rounded-lg transition-colors tabular-nums whitespace-nowrap shrink-0 ${
                          winRule === opt.id
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Jumlah Kartu Tangan Fisik Awal
                  </label>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                    {[3, 4, 5, 6].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setInitialHandCount(cnt)}
                        className={`py-2 px-2 text-xs font-mono font-semibold rounded-lg transition-colors tabular-nums whitespace-nowrap shrink-0 ${
                          initialHandCount === cnt
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cnt} Kartu
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Visual Kartu Suit {p0Name.trim() || 'Pemain 1'}
                  </label>
                  <select
                    value={p0SuitSet}
                    onChange={(e) => setP0SuitSet(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    {availableSuitSets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Visual Kartu Suit {p1Name.trim() || 'Pemain 2'}
                  </label>
                  <select
                    value={p1SuitSet}
                    onChange={(e) => setP1SuitSet(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    {availableSuitSets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Physical Rule Toggles & Live Broadcast Switch */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEnforceUniqueCards((v) => !v)}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      enforceUniqueCards
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                        : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-bold">
                      <span>Validasi Kartu Unik (1x Pakai)</span>
                      <span className="font-mono">{enforceUniqueCards ? 'AKTIF' : 'BEBAS'}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                      Menandai kartu fisik yang sudah pernah diturunkan pemain agar tidak dipakai dua kali.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnforceConditions((v) => !v)}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      enforceConditions
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                        : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-bold">
                      <span>Validasi Syarat Evolusi Kartu</span>
                      <span className="font-mono">{enforceConditions ? 'AKTIF' : 'BEBAS'}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                      Memeriksa syarat kartu kombo/fusion (seperti Sori, Sopan, Super Papa) secara otomatis.
                    </p>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setBroadcastEnabled((v) => !v)}
                  className={`w-full p-3.5 rounded-xl border text-left transition-colors flex items-center justify-between gap-4 ${
                    broadcastEnabled
                      ? 'bg-sky-500/15 border-sky-400/50 text-sky-200'
                      : 'bg-[#0B1120] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
                      <Radio className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>Siarkan Arena ke Layar Lain / TV / HP Penonton (Opsional)</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {broadcastRoomCode
                        ? `Room Siaran Aktif (${broadcastRoomCode}) · ${broadcastViewerCount} layar penonton terhubung.`
                        : 'Membuka Kode Room 6-digit agar layar TV atau HP pemain ikut menampilkan animasi Arena secara live.'}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-slate-900/90 text-xs font-mono font-bold shrink-0">
                    {broadcastEnabled ? 'LIVE ON' : 'OFFLINE'}
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleStartSimulation}
                className="w-full py-4 px-6 text-sm sm:text-base font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-2.5 shadow-lg whitespace-nowrap shrink-0"
              >
                <Gavel className="w-5 h-5" />
                <span>Buka Konsol Host &amp; Mulai Simulasi Kartu Asli</span>
              </button>
            </div>
          </div>

          {/* Right 5 Cols: Physical Table Workflow Guide */}
          <div className="lg:col-span-5 bg-[#131C31] border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div>
                <div className="text-xs font-mono text-emerald-400">Panduan Meja Fisik</div>
                <h2 className="mt-1 text-lg font-display font-bold text-white">
                  Cara Bermain dengan Kartu Asli
                </h2>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Tidak perlu menyusun dek digital terlebih dahulu. Pemain langsung memakai tumpukan kartu asli di tangan masing-masing:
                </p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800/90">
                  <div className="font-display font-bold text-amber-300">
                    01. Kocok Dek Fisik &amp; Buka Karakter
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Kedua pemain mengambil {initialHandCount} kartu tangan dari Dek Fisik, meletakkan 1 Kartu Karakter tertutup di meja, lalu membukanya bersamaan. Host memilih atau memfoto kartu tersebut di layar.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800/90">
                  <div className="font-display font-bold text-emerald-300">
                    02. Resolusi Efek Masuk &amp; Instruksi Meja
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Sistem menghitung prioritas Efek 01 → 02 → 03 secara akurat dan memberikan <strong>Instruksi Meja Fisik</strong> (misal: tarik 2 kartu dek fisik, buang kartu tangan, atau konfirmasi Kuputeri).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800/90">
                  <div className="font-display font-bold text-sky-300">
                    03. Adu Kartu Suit &amp; Kartu Pendukung Asli
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Pemain membuka Kartu Suit fisik (Air / Api / Daun). Host menekan elemen kedua pemain (atau tombol cepat Q/W/E &amp; I/O/P), menginput Kartu Pendukung fisik bila ada, lalu mengeksekusi serangan!
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800/90">
                  <div className="font-display font-bold text-rose-300">
                    04. Pemindaian Kamera Kartu Fisik Baru
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Punya kartu fisik dari seri baru yang belum terdaftar? Gunakan fitur <strong>Scan / Foto Kartu Asli</strong> langsung saat giliran berlangsung untuk mengenali atribut kartu secara otomatis.
                  </p>
                </div>
              </div>
            </div>

            {broadcastEnabled && broadcastRoomCode && (
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-sky-300 font-bold">
                    Kode Room Siaran Siap: {broadcastRoomCode}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Buka menu Multiplayer di TV/HP lain lalu masukkan kode ini.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyBroadcastInvite('link')}
                  className="px-3 py-2 text-xs font-bold bg-sky-400 hover:bg-sky-300 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Salin Link
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ============================================================================
  // VIEW 2: LIVE PHYSICAL CARD HOST SIMULATION CONSOLE & 3D ARENA
  // ============================================================================
  const { battle, step, physicalHandCount, tableNotices, pendingPrompts } = session;
  const p0 = battle.players[0];
  const p1 = battle.players[1];
  const round = battle.round;
  const bothActiveFaceOff = Boolean(p0.active && p1.active);
  const activePrompt = pendingPrompts[0] ?? null;

  const pickedP0CharDef = pickedCharIds[0] ? CARD_BY_ID[pickedCharIds[0]] ?? null : null;
  const pickedP1CharDef = pickedCharIds[1] ? CARD_BY_ID[pickedCharIds[1]] ?? null : null;

  return (
    <section
      className={`max-w-[1420px] mx-auto px-3 sm:px-6 py-4 space-y-4 ${
        koShaking ? 'animate-ko-screen-shake' : ''
      }`}
    >
      {/* Top Host Simulation Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#131C31] border border-slate-800 rounded-xl">
        <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-mono tabular-nums">
          <span className="font-bold text-amber-400">Host Kartu Asli · Ronde {round}</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="text-slate-200">
            {p0.name} <strong className="text-amber-300">{p0.winZone.length}</strong> -{' '}
            <strong className="text-sky-300">{p1.winZone.length}</strong> {p1.name}
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="text-slate-400">
            {battle.maxRounds
              ? `Format ${battle.maxRounds} Ronde`
              : `Target ${battle.targetWins} Menang`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={undoStack.length === 0}
            onClick={handleUndoStep}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 tabular-nums"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo ({undoStack.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setRefereeDrawerOpen((v) => !v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              refereeDrawerOpen
                ? 'bg-emerald-400 text-slate-950 border-emerald-400 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
            }`}
          >
            <Gavel className="w-3.5 h-3.5" />
            <span>Alat Wasit</span>
          </button>

          <button
            type="button"
            onClick={() => setProjectorCleanMode((v) => !v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              projectorCleanMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {projectorCleanMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{projectorCleanMode ? 'Tampilkan Konsol Host' : 'Mode Layar Meja'}</span>
          </button>

          <button
            type="button"
            onClick={() => setBroadcastEnabled((v) => !v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 tabular-nums ${
              broadcastEnabled
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>
              {broadcastEnabled
                ? broadcastRoomCode
                  ? `Live: ${broadcastRoomCode} (${broadcastViewerCount})`
                  : 'Menyiapkan Room...'
                : 'Siarkan Live'}
            </span>
          </button>

          {broadcastEnabled && broadcastRoomCode && (
            <button
              type="button"
              onClick={() => handleCopyBroadcastInvite('link')}
              className="px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Link Penonton</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setClashFxEnabled((prev) => {
                const next = !prev;
                persistClashFxEnabled(next);
                return next;
              });
            }}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
              clashFxEnabled
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>FX</span>
          </button>

          <AudioControlWidget compact />

          <button
            type="button"
            onClick={() => setSession(null)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Pengaturan Meja
          </button>
        </div>
      </div>

      {broadcastCopyMsg && (
        <div className="px-4 py-2 rounded-xl bg-sky-500/15 border border-sky-400/40 text-xs text-sky-200 flex items-center justify-between">
          <span>{broadcastCopyMsg}</span>
          <button
            type="button"
            onClick={() => handleCopyBroadcastInvite('code')}
            className="font-mono font-bold underline"
          >
            Salin Kode Saja
          </button>
        </div>
      )}

      {/* Adaptive BGM Transition Banner */}
      <BattleAudioNotice
        isCriticalPhase={audioDirector.isCriticalPhase}
        hasLegendaryActive={audioDirector.hasLegendaryActive}
        criticalNames={audioDirector.criticalNames}
        legendaryNames={audioDirector.legendaryNames}
      />

      {/* Host Announcement Banner */}
      {session.latestHostAnnouncement && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs sm:text-sm text-emerald-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Megaphone className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="truncate">
              <strong className="text-emerald-300">
                Pengumuman {session.latestHostAnnouncement.hostName}:
              </strong>{' '}
              {session.latestHostAnnouncement.text}
            </span>
          </div>
        </div>
      )}

      {/* Collapsible Host / Referee Override Tools Drawer */}
      {refereeDrawerOpen && (
        <div className="bg-[#101D2F] border border-emerald-500/40 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="text-xs font-mono text-emerald-400">
                Panel Kendali Wasit &amp; Sinkronisasi Meja Fisik
              </div>
              <h3 className="text-sm sm:text-base font-display font-bold text-white">
                Koreksi Cepat HP, ATK, Kartu Tangan Fisik, Zona, &amp; Keputusan Ronde
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => commitNextSession((c) => togglePhysicalRule(c, 'enforceUniqueCards'))}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  session.enforceUniqueCards
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                Unik 1x: {session.enforceUniqueCards ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => commitNextSession((c) => togglePhysicalRule(c, 'enforceConditions'))}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  session.enforceConditions
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                Syarat Evolusi: {session.enforceConditions ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* P1 Physical Controls */}
            <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                <span>{p0.name} (Kiri)</span>
                <span className="font-mono tabular-nums">
                  Tangan Fisik: {physicalHandCount[0]} Kartu
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => commitNextSession((c) => adjustPhysicalHandCount(c, 0, -1))}
                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1"
                >
                  <Minus className="w-3 h-3" /> Tangan
                </button>
                <button
                  type="button"
                  onClick={() => commitNextSession((c) => adjustPhysicalHandCount(c, 0, 1))}
                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tangan
                </button>
                {p0.active && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        commitNextSession((c) => adjustPhysicalFighterStat(c, 0, 'HP', -20))
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-lg tabular-nums"
                    >
                      -20 HP
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        commitNextSession((c) => adjustPhysicalFighterStat(c, 0, 'HP', 20))
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-lg tabular-nums"
                    >
                      +20 HP
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        commitNextSession((c) => adjustPhysicalFighterStat(c, 0, 'ATK', -20))
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg tabular-nums"
                    >
                      -20 ATK
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        commitNextSession((c) => adjustPhysicalFighterStat(c, 0, 'ATK', 20))
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg tabular-nums"
                    >
                      +20 ATK
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* P2 Physical Controls */}
            <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                <span>{p1.name} (Kanan)</span>
                <span className="font-mono tabular-nums">
                  Tangan Fisik: {physicalHandCount[1]} Kartu
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => commitNextSession((c) => adjustPhysicalHandCount(c, 1, -1))}
                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1"
                >
                  <Minus className="w-3 h-3" /> Tangan
                </button>
                <button
                  type="button"
                  onClick={() => commitNextSession((c) => adjustPhysicalHandCount(c, 1, 1))}
                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tangan
                </button>
                {p1.active && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        commitNextSession((c) => adjustPhysicalFighterStat(c, 1, 'HP', -20))
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-lg tabular-nums"
                    >
                      -20 HP
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        commitNextSession((c) => adjustPhysicalFighterStat(c, 1, 'HP', 20))
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-lg tabular-nums"
                    >
                      +20 HP
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        commitNextSession((c) => adjustPhysicalFighterStat(c, 1, 'ATK', -20))
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg tabular-nums"
                    >
                      -20 ATK
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        commitNextSession((c) => adjustPhysicalFighterStat(c, 1, 'ATK', 20))
                      }
                      className="px-2.5 py-1.5 text-xs font-mono bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 rounded-lg tabular-nums"
                    >
                      +20 ATK
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Manual Zone Log & Round Verdicts */}
            <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-slate-200">
                Keputusan Cepat Ronde &amp; Catat Zona Fisik
              </div>
              {step !== 'ROUND_END' && step !== 'GAME_OVER' && (
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      commitNextSession((c) => forcePhysicalRoundWinner(c, 0, 'Keputusan Host'))
                    }
                    className="py-1.5 px-2 text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg truncate"
                  >
                    Ronde → {p0.name}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitNextSession((c) =>
                        forcePhysicalRoundWinner(c, 'DRAW', 'Keputusan Host')
                      )
                    }
                    className="py-1.5 px-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                  >
                    Ronde Seri
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitNextSession((c) => forcePhysicalRoundWinner(c, 1, 'Keputusan Host'))
                    }
                    className="py-1.5 px-2 text-xs font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 rounded-lg truncate"
                  >
                    Ronde → {p1.name}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <select
                  value={manualZonePlayer}
                  onChange={(e) => setManualZonePlayer(Number(e.target.value) as 0 | 1)}
                  className="px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  <option value={0}>{p0.name}</option>
                  <option value={1}>{p1.name}</option>
                </select>
                <select
                  value={manualZoneType}
                  onChange={(e) => setManualZoneType(e.target.value as 'LOSE' | 'WIN')}
                  className="px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  <option value="LOSE">+ Zona Kalah</option>
                  <option value="WIN">+ Zona Menang</option>
                </select>
                <select
                  value={manualZoneCardId}
                  onChange={(e) => setManualZoneCardId(e.target.value)}
                  className="min-w-0 flex-1 px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  {BATTLE_CARDS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.numberLabel} · {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playCardSelect();
                    commitNextSession((c) =>
                      recordPhysicalCardToZone(c, manualZonePlayer, manualZoneType, manualZoneCardId)
                    );
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-lg whitespace-nowrap shrink-0"
                >
                  Catat
                </button>
              </div>
            </div>
          </div>

          {/* Host Broadcast Announcement Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-800/80">
            <input
              type="text"
              value={announcementInput}
              onChange={(e) => setAnnouncementInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendHostAnnouncement();
              }}
              placeholder="Tulis pengumuman resmi Host untuk layar arena & penonton..."
              className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={handleSendHostAnnouncement}
              className="px-4 py-2 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Tampilkan Pengumuman</span>
            </button>
            {step !== 'GAME_OVER' && (
              <button
                type="button"
                onClick={() =>
                  commitNextSession((c) =>
                    declarePhysicalMatchWinner(
                      c,
                      p0.winZone.length > p1.winZone.length
                        ? 0
                        : p1.winZone.length > p0.winZone.length
                        ? 1
                        : 'DRAW',
                      'Pertandingan diselesaikan oleh Host'
                    )
                  )
                }
                className="px-3.5 py-2 text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Akhiri Pertandingan
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MAIN 3D ARENA STAGE (ALWAYS VISIBLE FOR TABLETOP & PROJECTOR DISPLAY) */}
      {/* ==================================================================== */}
      <div
        className={`relative overflow-hidden bg-gradient-to-b from-[#111A2E] via-[#0E1628] to-[#111A2E] border border-slate-800 rounded-2xl p-4 sm:p-6 ${
          koShaking ? 'animate-ko-arena-shake' : ''
        }`}
      >
        <ArenaClashFx
          phase={battle.phase}
          round={round}
          suitAttempt={battle.suitAttemptInRound}
          leftFighter={p0.active}
          rightFighter={p1.active}
          leftSuit={p0.selectedSuit}
          rightSuit={p1.selectedSuit}
          suitWinner={
            battle.lastSuitWinner === 0
              ? 'left'
              : battle.lastSuitWinner === 1
              ? 'right'
              : battle.lastSuitWinner === 'DRAW'
              ? 'draw'
              : null
          }
          leftSupportCard={p0.playedSupportCard}
          rightSupportCard={p1.playedSupportCard}
          combatSignal={
            combatFx
              ? {
                  id: combatFx.id,
                  attackerSide:
                    combatFx.attacker === 0
                      ? 'left'
                      : combatFx.attacker === 1
                      ? 'right'
                      : null,
                  leftDelta: combatFx.p0Delta,
                  rightDelta: combatFx.p1Delta,
                }
              : null
          }
          enabled={clashFxEnabled}
        />

        <KoBannerOverlay ko={activeKo} onDismiss={dismissKo} />
        <ComboChainBanner
          combo={activeCombo}
          onDismiss={dismissCombo}
          hidden={Boolean(activeKo)}
        />

        {/* Physical Player Zone Counters Strip */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-800/80 text-xs font-mono tabular-nums">
          <div className="flex flex-wrap items-center gap-2 text-amber-200">
            <span className="font-sans font-bold text-sm text-amber-300">{p0.name}</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>Tangan Fisik: {physicalHandCount[0]}</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() =>
                setZoneInspectModal({
                  title: `Zona Menang · ${p0.name} (${p0.winZone.length})`,
                  cards: p0.winZone,
                })
              }
              className="hover:text-white underline underline-offset-4"
            >
              Zona Menang: {p0.winZone.length}
            </button>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() =>
                setZoneInspectModal({
                  title: `Zona Kalah · ${p0.name} (${p0.loseZone.length})`,
                  cards: p0.loseZone,
                })
              }
              className="text-slate-400 hover:text-white underline underline-offset-4"
            >
              Zona Kalah: {p0.loseZone.length}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sky-200">
            <button
              type="button"
              onClick={() =>
                setZoneInspectModal({
                  title: `Zona Kalah · ${p1.name} (${p1.loseZone.length})`,
                  cards: p1.loseZone,
                })
              }
              className="text-slate-400 hover:text-white underline underline-offset-4"
            >
              Zona Kalah: {p1.loseZone.length}
            </button>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() =>
                setZoneInspectModal({
                  title: `Zona Menang · ${p1.name} (${p1.winZone.length})`,
                  cards: p1.winZone,
                })
              }
              className="hover:text-white underline underline-offset-4"
            >
              Zona Menang: {p1.winZone.length}
            </button>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>Tangan Fisik: {physicalHandCount[1]}</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="font-sans font-bold text-sm text-sky-300">{p1.name}</span>
          </div>
        </div>

        {/* 3-Column Active Combat Tabletop */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Fighter: Pemain 1 */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="text-xs font-semibold text-amber-300 mb-2 text-center">
              Zona Aktif · {p0.name}
              {p0.active ? ` · ${resolveCardElementTheme(p0.active.def).label}` : ''}
              {p0.active && isLegendaryCard(p0.active.def)
                ? ` · Legendaris ${p0.active.def.rank}`
                : ''}
            </div>

            {p0.active ? (
              <div className="relative flex flex-col items-center w-full max-w-[240px]">
                {combatFx?.p0Delta !== null && combatFx?.p0Delta !== undefined && (
                  <div
                    key={`psim-p0-dmg-${combatFx.id}`}
                    className={`animate-damage-pop pointer-events-none absolute -top-3 z-30 px-2.5 py-0.5 rounded-md font-mono text-xs font-extrabold tabular-nums shadow-lg ${
                      combatFx.p0Delta < 0
                        ? 'bg-rose-500 text-white'
                        : 'bg-emerald-400 text-slate-950'
                    }`}
                  >
                    {combatFx.p0Delta > 0 ? `+${combatFx.p0Delta} HP` : `${combatFx.p0Delta} HP`}
                  </div>
                )}

                <div
                  key={`psim-p0-motion-${combatFx?.id ?? 0}`}
                  className={`relative ${
                    combatFx?.attacker === 0
                      ? 'animate-strike-right'
                      : (combatFx?.p0Delta ?? 0) < 0
                      ? 'animate-hit-shake'
                      : ''
                  }`}
                >
                  <CardClashAura
                    card={p0.active.def}
                    opponentCard={p1.active?.def ?? null}
                    activeClash={bothActiveFaceOff}
                    isAttacking={combatFx?.attacker === 0}
                    isHit={(combatFx?.p0Delta ?? 0) < 0}
                    enabled={clashFxEnabled}
                    burstKey={combatFx?.id}
                  />
                  <div className="relative z-10">
                    <FlipRevealCard
                      flipKey={`psim-p0-${round}-${p0.active.instance.uid}`}
                      direction="up"
                      backSize="md"
                      backLabel={p0.name}
                    >
                      <CardVisual
                        card={p0.active.def}
                        size="md"
                        activeFighter={p0.active}
                        onClick={() => onInspectCard(p0.active!.def)}
                        onInspect={onInspectCard}
                        onEdit={onEditCard}
                      />
                    </FlipRevealCard>
                  </div>
                </div>

                {p0.playedSupportCard && (
                  <button
                    type="button"
                    onClick={() => onInspectCard(p0.playedSupportCard!)}
                    className="animate-support-pop mt-2 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-[11px] font-medium text-amber-200 transition-colors whitespace-nowrap shrink-0 max-w-full truncate"
                  >
                    Pendukung Fisik: {p0.playedSupportCard.name}
                  </button>
                )}

                {(() => {
                  const hpVis = getFighterHpVisualState(p0.active, 'emerald');
                  return (
                    <div className="mt-3 w-full">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className={`flex items-center gap-1 font-bold ${hpVis.labelClass}`}>
                          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                          <span>
                            HP {p0.active.currentHp}/{p0.active.maxHp}
                            {hpVis.isCritical ? ' · KRITIS' : ''}
                          </span>
                        </span>
                        <span className="text-emerald-300 font-bold">
                          ATK {p0.active.currentAtk}
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
                              Math.min(1, p0.active.currentHp / Math.max(1, p0.active.maxHp))
                            ) * 100
                          }
                          height="8"
                          className={hpVis.barFillClass}
                        />
                      </svg>
                      {p0.active.statusNotes.length > 0 && (
                        <div className="mt-2 text-[11px] text-amber-200 text-center">
                          {p0.active.statusNotes.join(' · ')}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : pickedP0CharDef ? (
              <div className="flex flex-col items-center">
                <CardVisual
                  card={pickedP0CharDef}
                  size="sm"
                  selected
                  onClick={() => onInspectCard(pickedP0CharDef)}
                  onInspect={onInspectCard}
                />
                <div className="mt-2 text-xs font-semibold text-amber-300">
                  Siap Dibuka: {pickedP0CharDef.name}
                </div>
              </div>
            ) : (
              <div className="w-40 sm:w-44 aspect-[5/7] rounded-xl border border-dashed border-slate-700 bg-[#0B1120]/70 flex flex-col items-center justify-center p-4 text-center">
                <Layers className="w-6 h-6 text-amber-400/60 mb-2" />
                <span className="text-xs font-medium text-slate-300">
                  Kartu Karakter {p0.name}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  Pilih atau Scan Kartu Asli di konsol bawah
                </span>
              </div>
            )}
          </div>

          {/* Center Clash Zone */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center py-2">
            {p0.selectedSuit && p1.selectedSuit ? (
              <div className="w-full flex flex-col items-center text-center">
                <div className="text-xs font-mono text-amber-300 mb-3 tabular-nums">
                  {battle.lastSuitWinner === 'DRAW'
                    ? `Adu Suit SERI! (${p0.selectedSuit} vs ${p1.selectedSuit})`
                    : `${
                        battle.players[battle.lastSuitWinner ?? 0].name
                      } Menang Adu Suit!`}
                </div>
                <div className="relative flex items-center justify-center gap-4 py-1">
                  <SuitClashFlare
                    leftSuit={p0.selectedSuit}
                    rightSuit={p1.selectedSuit}
                    winner={
                      battle.lastSuitWinner === 0
                        ? 'left'
                        : battle.lastSuitWinner === 1
                        ? 'right'
                        : 'draw'
                    }
                    clashKey={`psim-flare-${round}-${battle.currentRoundSuitClashes}`}
                    enabled={clashFxEnabled}
                  />
                  <div
                    className={`relative z-10 flex flex-col items-center ${
                      battle.lastSuitWinner === 0
                        ? 'scale-105'
                        : battle.lastSuitWinner === 1
                        ? 'opacity-65'
                        : ''
                    }`}
                  >
                    <span className="text-[11px] text-amber-300 font-semibold mb-1">
                      {p0.name}
                    </span>
                    <FlipRevealCard
                      flipKey={`psim-s0-${round}-${battle.currentRoundSuitClashes}`}
                      direction="up"
                      backSize="xs"
                    >
                      <CardVisual
                        card={getSuitCardForSet(p0.selectedSuit, p0.suitArtSet)}
                        size="xs"
                        selected={battle.lastSuitWinner === 0}
                      />
                    </FlipRevealCard>
                  </div>

                  <span className="relative z-10 font-display font-black text-base text-slate-400">
                    VS
                  </span>

                  <div
                    className={`relative z-10 flex flex-col items-center ${
                      battle.lastSuitWinner === 1
                        ? 'scale-105'
                        : battle.lastSuitWinner === 0
                        ? 'opacity-65'
                        : ''
                    }`}
                  >
                    <span className="text-[11px] text-sky-300 font-semibold mb-1">
                      {p1.name}
                    </span>
                    <FlipRevealCard
                      flipKey={`psim-s1-${round}-${battle.currentRoundSuitClashes}`}
                      direction="down"
                      backSize="xs"
                    >
                      <CardVisual
                        card={getSuitCardForSet(p1.selectedSuit, p1.suitArtSet)}
                        size="xs"
                        selected={battle.lastSuitWinner === 1}
                      />
                    </FlipRevealCard>
                  </div>
                </div>
              </div>
            ) : step === 'ROUND_END' ? (
              <div className="text-center space-y-3 max-w-xs">
                <Trophy className="w-9 h-9 text-amber-400 mx-auto" />
                <div className="text-base font-display font-bold text-white">
                  Ronde {round} Selesai
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {battle.roundSummaryText}
                </p>
                <button
                  type="button"
                  onClick={handleNextRound}
                  className="px-5 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Mulai Ronde {round + 1}
                </button>
              </div>
            ) : (
              <div className="text-center space-y-2 max-w-xs">
                {step === 'PICK_CHARACTERS' ? (
                  <Flame className="w-8 h-8 text-amber-400 mx-auto" />
                ) : step === 'PICK_SUITS' ? (
                  <Swords className="w-8 h-8 text-amber-400 mx-auto" />
                ) : (
                  <Shield className="w-8 h-8 text-emerald-400 mx-auto" />
                )}
                <div className="text-sm sm:text-base font-display font-bold text-white">
                  {step === 'PICK_CHARACTERS'
                    ? `Ronde ${round} — Pembukaan Karakter Fisik`
                    : step === 'TABLE_PROMPT'
                    ? 'Menunggu Konfirmasi Efek Meja Fisik'
                    : step === 'PICK_SUITS'
                    ? `Adu Suit Kartu Asli #${battle.suitAttemptInRound}`
                    : 'Jendela Kartu Pendukung & Serangan'}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {step === 'PICK_CHARACTERS'
                    ? 'Kedua pemain meletakkan Kartu Karakter asli di meja lalu membukanya bersamaan.'
                    : step === 'PICK_SUITS'
                    ? 'Kedua pemain membuka Kartu Suit fisik (Air / Api / Daun) di meja.'
                    : 'Selesaikan langkah pada Konsol Host di bawah arena.'}
                </p>
              </div>
            )}
          </div>

          {/* Right Fighter: Pemain 2 */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="text-xs font-semibold text-sky-300 mb-2 text-center">
              Zona Aktif · {p1.name}
              {p1.active ? ` · ${resolveCardElementTheme(p1.active.def).label}` : ''}
              {p1.active && isLegendaryCard(p1.active.def)
                ? ` · Legendaris ${p1.active.def.rank}`
                : ''}
            </div>

            {p1.active ? (
              <div className="relative flex flex-col items-center w-full max-w-[240px]">
                {combatFx?.p1Delta !== null && combatFx?.p1Delta !== undefined && (
                  <div
                    key={`psim-p1-dmg-${combatFx.id}`}
                    className={`animate-damage-pop pointer-events-none absolute -top-3 z-30 px-2.5 py-0.5 rounded-md font-mono text-xs font-extrabold tabular-nums shadow-lg ${
                      combatFx.p1Delta < 0
                        ? 'bg-rose-500 text-white'
                        : 'bg-emerald-400 text-slate-950'
                    }`}
                  >
                    {combatFx.p1Delta > 0 ? `+${combatFx.p1Delta} HP` : `${combatFx.p1Delta} HP`}
                  </div>
                )}

                <div
                  key={`psim-p1-motion-${combatFx?.id ?? 0}`}
                  className={`relative ${
                    combatFx?.attacker === 1
                      ? 'animate-strike-left'
                      : (combatFx?.p1Delta ?? 0) < 0
                      ? 'animate-hit-shake'
                      : ''
                  }`}
                >
                  <CardClashAura
                    card={p1.active.def}
                    opponentCard={p0.active?.def ?? null}
                    activeClash={bothActiveFaceOff}
                    isAttacking={combatFx?.attacker === 1}
                    isHit={(combatFx?.p1Delta ?? 0) < 0}
                    enabled={clashFxEnabled}
                    burstKey={combatFx?.id}
                  />
                  <div className="relative z-10">
                    <FlipRevealCard
                      flipKey={`psim-p1-${round}-${p1.active.instance.uid}`}
                      direction="down"
                      backSize="md"
                      backLabel={p1.name}
                    >
                      <CardVisual
                        card={p1.active.def}
                        size="md"
                        activeFighter={p1.active}
                        onClick={() => onInspectCard(p1.active!.def)}
                        onInspect={onInspectCard}
                        onEdit={onEditCard}
                      />
                    </FlipRevealCard>
                  </div>
                </div>

                {p1.playedSupportCard && (
                  <button
                    type="button"
                    onClick={() => onInspectCard(p1.playedSupportCard!)}
                    className="animate-support-pop mt-2 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-[11px] font-medium text-sky-200 transition-colors whitespace-nowrap shrink-0 max-w-full truncate"
                  >
                    Pendukung Fisik: {p1.playedSupportCard.name}
                  </button>
                )}

                {(() => {
                  const hpVis = getFighterHpVisualState(p1.active, 'sky');
                  return (
                    <div className="mt-3 w-full">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className={`flex items-center gap-1 font-bold ${hpVis.labelClass}`}>
                          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                          <span>
                            HP {p1.active.currentHp}/{p1.active.maxHp}
                            {hpVis.isCritical ? ' · KRITIS' : ''}
                          </span>
                        </span>
                        <span className="text-emerald-300 font-bold">
                          ATK {p1.active.currentAtk}
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
                              Math.min(1, p1.active.currentHp / Math.max(1, p1.active.maxHp))
                            ) * 100
                          }
                          height="8"
                          className={hpVis.barFillClass}
                        />
                      </svg>
                      {p1.active.statusNotes.length > 0 && (
                        <div className="mt-2 text-[11px] text-sky-200 text-center">
                          {p1.active.statusNotes.join(' · ')}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : pickedP1CharDef ? (
              <div className="flex flex-col items-center">
                <CardVisual
                  card={pickedP1CharDef}
                  size="sm"
                  selected
                  onClick={() => onInspectCard(pickedP1CharDef)}
                  onInspect={onInspectCard}
                />
                <div className="mt-2 text-xs font-semibold text-sky-300">
                  Siap Dibuka: {pickedP1CharDef.name}
                </div>
              </div>
            ) : (
              <div className="w-40 sm:w-44 aspect-[5/7] rounded-xl border border-dashed border-slate-700 bg-[#0B1120]/70 flex flex-col items-center justify-center p-4 text-center">
                <Layers className="w-6 h-6 text-sky-400/60 mb-2" />
                <span className="text-xs font-medium text-slate-300">
                  Kartu Karakter {p1.name}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  Pilih atau Scan Kartu Asli di konsol bawah
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Physical Table Action Instructions Callout */}
      {tableNotices.length > 0 && (
        <div className="bg-[#131C31] border border-amber-500/35 rounded-xl px-4 py-3 space-y-1.5">
          <div className="text-[11px] font-mono font-bold text-amber-400">
            Instruksi Meja Kartu Asli (Bacakan / Terapkan di Meja Fisik)
          </div>
          {tableNotices.map((nt) => (
            <p
              key={nt.id}
              className={`text-xs sm:text-sm leading-relaxed ${
                nt.tone === 'warning'
                  ? 'text-rose-200 font-medium'
                  : nt.tone === 'p1'
                  ? 'text-amber-100'
                  : nt.tone === 'p2'
                  ? 'text-sky-100'
                  : 'text-slate-200'
              }`}
            >
              {nt.text}
            </p>
          ))}
        </div>
      )}

      {/* ==================================================================== */}
      {/* INTERACTIVE HOST CONSOLE (HIDDEN WHEN IN CLEAN TABLE PROJECTOR MODE) */}
      {/* ==================================================================== */}
      {!projectorCleanMode && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 8 Cols: Active Step Input Console */}
          <div className="lg:col-span-8 bg-[#131C31] border border-slate-800 rounded-2xl p-5 space-y-5">
            {/* STEP 1: PICK PHYSICAL CHARACTERS */}
            {step === 'PICK_CHARACTERS' && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-mono text-amber-400">
                      Tahap 1 · Ronde {round}
                    </div>
                    <h2 className="text-lg font-display font-bold text-white">
                      Input Kartu Karakter Asli Kedua Pemain
                    </h2>
                  </div>

                  <button
                    type="button"
                    disabled={!pickedCharIds[0] || !pickedCharIds[1]}
                    onClick={handleDeployPickedCharacters}
                    className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-lg"
                  >
                    <Swords className="w-4 h-4" />
                    <span>Buka &amp; Adu Kedua Karakter!</span>
                  </button>
                </div>

                {/* Dual Slot Switcher + Camera Scan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([0, 1] as const).map((idx) => {
                    const pl = battle.players[idx];
                    const pickedDef = idx === 0 ? pickedP0CharDef : pickedP1CharDef;
                    const isFocused = activeSlot === idx;

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-colors ${
                          isFocused
                            ? idx === 0
                              ? 'bg-amber-500/10 border-amber-400/60'
                              : 'bg-sky-500/10 border-sky-400/60'
                            : 'bg-[#0B1120] border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveSlot(idx)}
                            className="text-left min-w-0 flex-1"
                          >
                            <div
                              className={`text-xs font-bold ${
                                idx === 0 ? 'text-amber-300' : 'text-sky-300'
                              }`}
                            >
                              Slot Kartu {pl.name} {isFocused ? '· Sedang Dipilih' : ''}
                            </div>
                            <div className="mt-0.5 text-sm font-display font-bold text-white truncate">
                              {pickedDef
                                ? `${pickedDef.numberLabel} · ${pickedDef.name}`
                                : 'Klik untuk memilih dari daftar di bawah...'}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => openPhysicalCardScanner(idx, CardCategory.CHARACTER)}
                            className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Camera className="w-3.5 h-3.5 text-amber-400" />
                            <span>Scan / Foto</span>
                          </button>
                        </div>

                        {pl.usedCharacterTags.length > 0 && (
                          <div className="mt-2 text-[11px] text-slate-400 truncate">
                            Riwayat Tag Evolusi: {pl.usedCharacterTags.join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Search, Filter Tabs & Override Toggle */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                    {[
                      { id: 'ALL' as CharacterFilterTab, label: 'Semua' },
                      { id: 'READY' as CharacterFilterTab, label: 'Siap Turun' },
                      { id: 'BASE' as CharacterFilterTab, label: 'Tanpa Syarat' },
                      { id: 'CONDITIONAL' as CharacterFilterTab, label: 'Evolusi/Syarat' },
                      { id: 'CUSTOM' as CharacterFilterTab, label: 'Kustom/Scan' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCharFilter(tab.id)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          charFilter === tab.id
                            ? 'bg-slate-700 text-white font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-52">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={charSearch}
                        onChange={(e) => setCharSearch(e.target.value)}
                        placeholder="Ketik nomor (31) / nama..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setAllowOverrideThisTurn((v) => !v)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                        allowOverrideThisTurn
                          ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                          : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Override Host: {allowOverrideThisTurn ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                {/* Fast Visual Character Picker Grid */}
                <div className="max-h-[410px] overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 justify-items-center">
                  {characterCards.map((card) => {
                    const check = checkPhysicalCardPlayability(session, activeSlot, card);
                    const isPickedP0 = pickedCharIds[0] === card.id;
                    const isPickedP1 = pickedCharIds[1] === card.id;
                    const isPickedActive = pickedCharIds[activeSlot] === card.id;
                    const blocked = !check.playable && !allowOverrideThisTurn;

                    return (
                      <div
                        key={card.id}
                        className="flex flex-col items-center w-full max-w-[156px]"
                      >
                        <CardVisual
                          card={card}
                          size="xs"
                          selected={isPickedActive}
                          disabled={blocked}
                          disabledReason={blocked ? check.warning : undefined}
                          onClick={() => handlePickCharacterForSlot(card, activeSlot)}
                          onInspect={onInspectCard}
                        />
                        <div className="mt-1.5 w-full text-center">
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {card.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 tabular-nums truncate">
                            {card.numberLabel} · {card.rank} · {card.hp}/{card.atk}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={blocked}
                          onClick={() => handlePickCharacterForSlot(card, activeSlot)}
                          className={`mt-1.5 w-full py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 truncate ${
                            isPickedP0 && isPickedP1
                              ? 'bg-emerald-400 text-slate-950'
                              : isPickedP0
                              ? 'bg-amber-500 text-slate-950'
                              : isPickedP1
                              ? 'bg-sky-400 text-slate-950'
                              : blocked
                              ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          {isPickedP0 && isPickedP1
                            ? 'Dipilih P1 & P2'
                            : isPickedP0
                            ? `Kartu ${p0.name}`
                            : isPickedP1
                            ? `Kartu ${p1.name}`
                            : blocked
                            ? check.warning?.includes('Sudah dipakai')
                              ? 'Sudah Dipakai'
                              : 'Syarat Belum Siap'
                            : `Pilih untuk ${battle.players[activeSlot].name}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* STEP 2: INTERACTIVE PHYSICAL TABLE PROMPT */}
            {step === 'TABLE_PROMPT' && activePrompt && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-800">
                  <div className="text-xs font-mono text-amber-400">
                    Konfirmasi Interaksi Kartu Fisik di Meja
                  </div>
                  <h2 className="mt-0.5 text-lg font-display font-bold text-white">
                    {activePrompt.title}
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {activePrompt.instruction}
                  </p>
                </div>

                {activePrompt.kind === 'CONFIRM_KUPUTERI_IN_HAND' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleResolvePrompt({
                          kind: 'CONFIRM_KUPUTERI_IN_HAND',
                          hasKuputeri: true,
                        })
                      }
                      className="px-5 py-3 text-sm font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
                    >
                      Ya, Memegang Kartu Fisik Kuputeri (+60 HP &amp; +60 ATK)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleResolvePrompt({
                          kind: 'CONFIRM_KUPUTERI_IN_HAND',
                          hasKuputeri: false,
                        })
                      }
                      className="px-5 py-3 text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                    >
                      Tidak Ada Kuputeri di Tangan
                    </button>
                  </div>
                )}

                {activePrompt.kind === 'RETURN_ENEMY_WIN_2' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
                      {battle.players[activePrompt.ownerIndex === 0 ? 1 : 0].winZone.map((inst) => {
                        const def = CARD_BY_ID[inst.defId];
                        if (!def) return null;
                        const chosen = selectedWinZoneUids.includes(inst.uid);
                        return (
                          <CardVisual
                            key={inst.uid}
                            card={def}
                            size="xs"
                            showCaption
                            selected={chosen}
                            onClick={() => {
                              setSelectedWinZoneUids((prev) =>
                                prev.includes(inst.uid)
                                  ? prev.filter((u) => u !== inst.uid)
                                  : prev.length < 2
                                  ? [...prev, inst.uid]
                                  : prev
                              );
                            }}
                          />
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={selectedWinZoneUids.length !== 2}
                      onClick={() =>
                        handleResolvePrompt({
                          kind: 'PICK_WIN_ZONE_UIDS',
                          uids: selectedWinZoneUids,
                        })
                      }
                      className="px-5 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0"
                    >
                      Kembalikan 2 Kartu ke Dek Lawan ({selectedWinZoneUids.length}/2)
                    </button>
                  </div>
                )}

                {(activePrompt.kind === 'RECORD_DISCARD_ENEMY_HAND_1' ||
                  activePrompt.kind === 'SWAP_CONDITIONAL_FROM_PHYSICAL_DECK' ||
                  activePrompt.kind === 'COPY_ENEMY_DECK_SUPPORT' ||
                  activePrompt.kind === 'COPY_ENEMY_DECK_EFFECT' ||
                  activePrompt.kind === 'COPY_ENEMY_DECK_STATS') && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <input
                        type="text"
                        value={promptSearch}
                        onChange={(e) => setPromptSearch(e.target.value)}
                        placeholder="Cari nama atau nomor kartu fisik..."
                        className="w-full sm:w-64 px-3.5 py-2 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleResolvePrompt({ kind: 'PICK_CARD_ID', cardId: null })}
                        className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        {activePrompt.kind === 'RECORD_DISCARD_ENEMY_HAND_1'
                          ? 'Catat Umum (Tanpa Spesifik Kartu)'
                          : 'Tidak Ada Kartu Cocok di Dek Fisik'}
                      </button>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-3 justify-items-center pr-1">
                      {BATTLE_CARDS.filter((c) => {
                        if (
                          activePrompt.kind === 'SWAP_CONDITIONAL_FROM_PHYSICAL_DECK' &&
                          (c.category !== CardCategory.CHARACTER || !c.condition)
                        ) {
                          return false;
                        }
                        if (
                          activePrompt.kind === 'COPY_ENEMY_DECK_SUPPORT' &&
                          c.category !== CardCategory.SUPPORT
                        ) {
                          return false;
                        }
                        if (
                          activePrompt.kind === 'COPY_ENEMY_DECK_EFFECT' &&
                          (c.effectKey === 'NONE' ||
                            c.effectKey === 'ROSAKSA_COPY_ENEMY_DECK_EFFECT')
                        ) {
                          return false;
                        }
                        if (
                          activePrompt.kind === 'COPY_ENEMY_DECK_STATS' &&
                          c.category !== CardCategory.CHARACTER
                        ) {
                          return false;
                        }
                        if (promptSearch.trim()) {
                          const q = promptSearch.toLowerCase();
                          return (
                            c.name.toLowerCase().includes(q) ||
                            c.numberLabel.toLowerCase().includes(q)
                          );
                        }
                        return true;
                      }).map((c) => (
                        <div key={c.id} className="flex flex-col items-center w-full max-w-[148px]">
                          <CardVisual
                            card={c}
                            size="xs"
                            onClick={() =>
                              handleResolvePrompt({ kind: 'PICK_CARD_ID', cardId: c.id })
                            }
                            onInspect={onInspectCard}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleResolvePrompt({ kind: 'PICK_CARD_ID', cardId: c.id })
                            }
                            className="mt-1.5 w-full py-1 px-2 text-[11px] font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg truncate"
                          >
                            Pilih {c.name}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: INPUT PHYSICAL SUIT CLASH */}
            {step === 'PICK_SUITS' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-mono text-amber-400 tabular-nums">
                      Tahap Adu Suit Kartu Asli #{battle.suitAttemptInRound} · Pintasan Q/W/E &amp; I/O/P
                    </div>
                    <h2 className="text-lg font-display font-bold text-white">
                      Input Kartu Suit Fisik yang Dibuka Kedua Pemain
                    </h2>
                  </div>

                  <button
                    type="button"
                    disabled={!pickedSuits[0] || !pickedSuits[1]}
                    onClick={handleExecuteSuitClash}
                    className="px-6 py-3 text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-lg"
                  >
                    <Swords className="w-4 h-4" />
                    <span>Adu Suit Sekarang!</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {([0, 1] as const).map((idx) => {
                    const pl = battle.players[idx];
                    const chosenSuit = pickedSuits[idx];
                    const shortcuts = idx === 0 ? ['Q', 'W', 'E'] : ['I', 'O', 'P'];
                    const elements = [SuitElement.AIR, SuitElement.API, SuitElement.DAUN];

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold ${
                              idx === 0 ? 'text-amber-300' : 'text-sky-300'
                            }`}
                          >
                            Kartu Suit {pl.name}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {chosenSuit ? `Terpilih: ${chosenSuit}` : 'Belum dipilih'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 justify-items-center">
                          {elements.map((el, sIdx) => {
                            const suitCard = getSuitCardForSet(el, pl.suitArtSet);
                            const isSelected = chosenSuit === el;
                            return (
                              <div key={el} className="flex flex-col items-center w-full">
                                <CardVisual
                                  card={suitCard}
                                  size="xs"
                                  selected={isSelected}
                                  onClick={() => {
                                    soundFx.playCardSelect();
                                    setPickedSuits((prev) => {
                                      const next: [SuitElement | null, SuitElement | null] = [
                                        prev[0],
                                        prev[1],
                                      ];
                                      next[idx] = el;
                                      return next;
                                    });
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    soundFx.playCardSelect();
                                    setPickedSuits((prev) => {
                                      const next: [SuitElement | null, SuitElement | null] = [
                                        prev[0],
                                        prev[1],
                                      ];
                                      next[idx] = el;
                                      return next;
                                    });
                                  }}
                                  className={`mt-2 w-full py-1.5 px-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                                    isSelected
                                      ? idx === 0
                                        ? 'bg-amber-500 text-slate-950'
                                        : 'bg-sky-400 text-slate-950'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                  }`}
                                >
                                  {el} ({shortcuts[sIdx]})
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 4: INPUT OPTIONAL PHYSICAL SUPPORT CARDS & EXECUTE STRIKE */}
            {step === 'PICK_SUPPORTS_AND_STRIKE' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-mono text-emerald-400">
                      Pemenang Suit:{' '}
                      {battle.players[battle.lastSuitWinner === 1 ? 1 : 0].name} · Siap Menyerang
                    </div>
                    <h2 className="text-lg font-display font-bold text-white">
                      Kartu Pendukung Fisik (Opsional) &amp; Eksekusi Serangan
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteSupportsAndStrike}
                    className="px-6 py-3 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-lg"
                  >
                    <Swords className="w-4 h-4" />
                    <span>
                      {pickedSupports[0] || pickedSupports[1]
                        ? 'Aktifkan Pendukung & Serang!'
                        : 'Tanpa Pendukung · Serang Langsung!'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {([0, 1] as const).map((idx) => {
                    const pl = battle.players[idx];
                    const opp = battle.players[idx === 0 ? 1 : 0];
                    const lockedBySuperPapa = Boolean(opp.active?.blockEnemySupport);
                    const selectedSupId = pickedSupports[idx];
                    const selectedSupDef = selectedSupId ? CARD_BY_ID[selectedSupId] ?? null : null;

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-bold ${
                              idx === 0 ? 'text-amber-300' : 'text-sky-300'
                            }`}
                          >
                            Kartu Pendukung Fisik {pl.name}
                          </span>
                          {!lockedBySuperPapa && (
                            <button
                              type="button"
                              onClick={() => openPhysicalCardScanner(idx, CardCategory.SUPPORT)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <Camera className="w-3 h-3 text-amber-400" />
                              <span>Scan Pendukung</span>
                            </button>
                          )}
                        </div>

                        {lockedBySuperPapa ? (
                          <p className="text-xs text-rose-300 py-3">
                            Dikunci oleh efek Super Papa lawan — {pl.name} tidak dapat memainkan Kartu Pendukung fisik.
                          </p>
                        ) : (
                          <>
                            <select
                              value={selectedSupId ?? ''}
                              onChange={(e) => {
                                const val = e.target.value || null;
                                soundFx.playCardSelect();
                                setPickedSupports((prev) => {
                                  const next: [string | null, string | null] = [prev[0], prev[1]];
                                  next[idx] = val;
                                  return next;
                                });
                              }}
                              className="w-full px-3 py-2.5 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                            >
                              <option value="">— Tidak Memakai Kartu Pendukung —</option>
                              {supportCards.map((sc) => {
                                const used = session.usedCardIds[idx].includes(sc.id);
                                return (
                                  <option
                                    key={sc.id}
                                    value={sc.id}
                                    disabled={used && session.enforceUniqueCards}
                                  >
                                    {sc.numberLabel} · {sc.name} (Efek 0{sc.effectPriority ?? 2})
                                    {used ? ' [Sudah Dipakai]' : ''}
                                  </option>
                                );
                              })}
                            </select>

                            {selectedSupDef && (
                              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center gap-3">
                                <CardVisual
                                  card={selectedSupDef}
                                  size="xs"
                                  onClick={() => onInspectCard(selectedSupDef)}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-white truncate">
                                    {selectedSupDef.name}
                                  </div>
                                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                                    {selectedSupDef.effectText}
                                  </p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 5: ROUND END */}
            {step === 'ROUND_END' && (
              <div className="py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-amber-400">Ronde {round} Selesai</div>
                  <h3 className="mt-0.5 text-lg font-display font-bold text-white">
                    Siap Melangkah ke Ronde {round + 1}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Pastikan kedua pemain sudah memindahkan kartu fisik ke Zona Menang / Zona Kalah dan melengkapi kartu tangan fisik mereka.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleNextRound}
                  className="px-6 py-3 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors whitespace-nowrap shrink-0 shadow-lg"
                >
                  Lanjut ke Ronde {round + 1}
                </button>
              </div>
            )}

            {/* STEP 6: GAME OVER */}
            {step === 'GAME_OVER' && (
              <div className="py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-amber-400">Pertandingan Kartu Asli Tuntas</div>
                  <h3 className="mt-0.5 text-xl font-display font-extrabold text-white">
                    {battle.winnerIndex === 'DRAW'
                      ? 'Hasil Akhir: Pertandingan SERI!'
                      : `Juara Pertandingan: ${battle.players[battle.winnerIndex ?? 0].name}!`}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300">{battle.winReason}</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleStartSimulation}
                    className="px-5 py-3 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Mulai Pertandingan Baru</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right 4 Cols: Battle Log & Round History */}
          <div className="lg:col-span-4 bg-[#131C31] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-display font-bold text-white">
                Catatan Pertempuran &amp; Riwayat Ronde
              </h3>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {battle.roundHistory.length} Ronde Tuntas
              </span>
            </div>

            {battle.roundHistory.length > 0 && (
              <div className="space-y-1.5 pb-3 border-b border-slate-800/80 max-h-36 overflow-y-auto pr-1">
                {battle.roundHistory.map((rh) => {
                  const c0 = CARD_BY_ID[rh.p0CardId];
                  const c1 = CARD_BY_ID[rh.p1CardId];
                  return (
                    <div
                      key={rh.round}
                      className="text-xs flex items-center justify-between gap-2 text-slate-300 font-mono tabular-nums"
                    >
                      <span className="truncate">
                        R{rh.round}: {c0?.name ?? rh.p0CardId} vs {c1?.name ?? rh.p1CardId}
                      </span>
                      <span
                        className={`shrink-0 font-bold ${
                          rh.winner === 0
                            ? 'text-amber-300'
                            : rh.winner === 1
                            ? 'text-sky-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {rh.winner === 'DRAW' ? 'SERI' : battle.players[rh.winner].name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
              {battle.logs.map((entry) => (
                <div
                  key={entry.id}
                  className={`text-xs leading-relaxed py-1.5 border-b border-slate-800/60 last:border-b-0 ${
                    entry.tone === 'highlight'
                      ? 'text-amber-200 font-medium'
                      : entry.tone === 'warning'
                      ? 'text-rose-300'
                      : entry.tone === 'p1'
                      ? 'text-amber-100/90'
                      : entry.tone === 'p2'
                      ? 'text-sky-200/90'
                      : 'text-slate-400'
                  }`}
                >
                  <span className="font-mono text-[10px] text-slate-500 mr-1.5 tabular-nums">
                    [R{entry.round}]
                  </span>
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ZONE CARDS INSPECTOR                                          */}
      {/* ==================================================================== */}
      {zoneInspectModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
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
                Belum ada kartu tercatat di zona ini.
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

      {/* ==================================================================== */}
      {/* MODAL: CAMERA / PHOTO PHYSICAL CARD SCANNER                          */}
      {/* ==================================================================== */}
      {scannerState.open && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/88 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={closePhysicalCardScanner}
        >
          <div
            className="w-full max-w-xl bg-[#131C31] border border-slate-700 rounded-2xl p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <div>
                <div className="text-xs font-mono text-amber-400">
                  Pemindai Kartu Cetak Fisik · {battle.players[scannerState.targetPlayer].name}
                </div>
                <h3 className="text-lg font-display font-bold text-white">
                  Scan / Foto Kartu Asli ({scannerState.targetCategory === CardCategory.SUPPORT ? 'Pendukung' : 'Karakter'})
                </h3>
              </div>
              <button
                type="button"
                onClick={closePhysicalCardScanner}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  stopCameraStream();
                  const dataUrl = await compressPhysicalPhoto(file);
                  await analyzeDataUrlForPhysicalPlay(dataUrl, file.name);
                } catch (err) {
                  setScanError(
                    err instanceof Error ? err.message : 'Gagal membaca berkas foto kartu.'
                  );
                }
              }}
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={startLiveCamera}
                className="py-3 px-4 text-xs sm:text-sm font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Camera className="w-4 h-4" />
                <span>Buka Kamera Langsung</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-3 px-4 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>Ambil / Pilih Foto Kartu</span>
              </button>
            </div>

            {cameraActive && (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-slate-700 bg-black aspect-[4/3] flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={captureFromVideoAndAnalyze}
                  className="w-full py-3 px-4 text-sm font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-xl transition-colors"
                >
                  Jepret &amp; Kenali Kartu Sekarang
                </button>
              </div>
            )}

            {scanLoading && (
              <div className="py-8 text-center space-y-2">
                <Loader2 className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-white">
                  Membaca nama, kode seri, HP/ATK, dan efek dari foto kartu asli...
                </p>
              </div>
            )}

            {scanError && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
                {scanError}
              </div>
            )}

            {scanResultInfo && !scanLoading && (
              <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-700 space-y-4">
                <div className="flex items-start gap-4">
                  {scanPreviewUrl && (
                    <img
                      src={scanPreviewUrl}
                      alt={scanResultInfo.analyzed.name}
                      referrerPolicy="no-referrer"
                      className="w-24 aspect-[5/7] object-cover rounded-lg border border-slate-700 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs font-mono text-emerald-400">
                      {scanResultInfo.matchedCard
                        ? `Cocok dengan Katalog: ${scanResultInfo.matchedCard.numberLabel}`
                        : 'Kartu Fisik Baru Terdeteksi'}
                    </div>
                    <div className="text-base font-display font-bold text-white truncate">
                      {scanResultInfo.matchedCard
                        ? scanResultInfo.matchedCard.name
                        : scanResultInfo.analyzed.name}
                    </div>
                    <div className="text-xs font-mono text-slate-300 tabular-nums">
                      Rank {scanResultInfo.analyzed.rank} · HP {scanResultInfo.analyzed.hp} · ATK{' '}
                      {scanResultInfo.analyzed.atk}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {scanResultInfo.analyzed.effectText}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800">
                  {scanResultInfo.matchedCard ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApplyScannedCard(false)}
                        className="flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Check className="w-4 h-4" />
                        <span>Pakai {scanResultInfo.matchedCard.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyScannedCard(true)}
                        className="py-2.5 px-3.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        Simpan Sebagai Kartu Baru
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApplyScannedCard(true)}
                      className="w-full py-2.5 px-4 text-xs sm:text-sm font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Check className="w-4 h-4" />
                      <span>Daftarkan &amp; Pakai Kartu Fisik Ini Sekarang</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VICTORY CELEBRATION OVERLAY FOR PHYSICAL CARD HOST SIMULATION */}
      {step === 'GAME_OVER' && (
        <VictoryCelebrationOverlay
          battleState={battle}
          holdForKo={Boolean(activeKo)}
          clashFxEnabled={clashFxEnabled}
          contextLabel="Simulasi Kartu Asli Selesai"
          onInspectCard={onInspectCard}
          primaryAction={{
            label: 'Mulai Pertandingan Baru',
            onClick: handleStartSimulation,
          }}
          secondaryAction={{
            label: projectorCleanMode ? 'Buka Konsol Host' : 'Pengaturan Meja',
            onClick: () => {
              if (projectorCleanMode) {
                setProjectorCleanMode(false);
              } else {
                setSession(null);
              }
            },
          }}
        />
      )}
    </section>
  );
};
