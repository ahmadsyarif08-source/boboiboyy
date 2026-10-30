import { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, Crown, Menu, Plus, ShoppingBag, X } from 'lucide-react';
import { AudioControlWidget, BgmEditorModal } from './components/AudioControlPanel';
import { BattleArena } from './components/BattleArena';
import { BattleHistory } from './components/BattleHistory';
import { CardEditorModal } from './components/CardEditorModal';
import { CardGallery } from './components/CardGallery';
import { CardShop } from './components/CardShop';
import { CardTrialSandbox } from './components/CardTrialSandbox';
import { CardDetailModal } from './components/CardVisual';
import { CustomArena } from './components/CustomArena';
import { DeckBuilder } from './components/DeckBuilder';
import { GlobalUpdateBanner } from './components/GlobalUpdateBanner';
import { HomeMenu, type MainMenuDestination } from './components/HomeMenu';
import { MultiplayerArena } from './components/MultiplayerArena';
import { OwnerModal } from './components/OwnerModal';
import { PackSeriesEditorModal } from './components/PackSeriesEditorModal';
import { PackSeriesHub } from './components/PackSeriesHub';
import { PhysicalHostArena } from './components/PhysicalHostArena';
import { PosterAlbum3x3 } from './components/PosterAlbum3x3';
import { RulesGuide } from './components/RulesGuide';
import {
  CARD_BY_ID,
  deduplicateDeckIds,
  loadSavedUserDecks,
  PACK_SERIES_BY_ID,
  persistSavedUserDecks,
  PRESET_DECKS,
} from './data/cards';
import { createInitialBattleState, FullBattleState } from './engine/battleEngine';
import {
  CardCategory,
  CardDefinition,
  type CardPackSeries,
  type DeckTargetSize,
  type SavedUserDeck,
  type SuitArtSetId,
} from './types/game';
import { saveBattleMatch } from './utils/battleHistoryStore';
import { initGlobalSync } from './utils/globalSync';
import { getStoredOwnerSession } from './utils/ownerService';
import { addWalletCoins, loadUserWallet } from './utils/shopStore';
import { soundFx } from './utils/sound';

type ActiveTab =
  | 'home'
  | 'arena'
  | 'history'
  | 'trial'
  | 'physical'
  | 'multiplayer'
  | 'shop'
  | 'packs'
  | 'custom'
  | 'gallery'
  | 'album'
  | 'deck'
  | 'rules';

const CUSTOM_DECK_STORAGE_KEY = 'mgc_blazing_frost_custom_deck_v1';

const BATTLE_GROUP_TABS: readonly ActiveTab[] = [
  'arena',
  'history',
  'trial',
  'physical',
  'multiplayer',
  'custom',
  'rules',
];

const COLLECTION_GROUP_TABS: readonly ActiveTab[] = [
  'shop',
  'gallery',
  'packs',
  'album',
  'deck',
];

function getRoomCodeFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('room')?.trim().toUpperCase();
    return raw && raw.length >= 4 ? raw : null;
  } catch {
    return null;
  }
}

function normalizeUnique30Deck(rawIds: string[]): string[] {
  const unique = deduplicateDeckIds(rawIds, 30);
  if (unique.length === 30) return unique;
  const fallback = deduplicateDeckIds([...unique, ...PRESET_DECKS[0].cardIds], 30);
  return fallback;
}

export default function App() {
  const [initialRoomCode, setInitialRoomCode] = useState<string | null>(() => getRoomCodeFromUrl());
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    getRoomCodeFromUrl() ? 'multiplayer' : 'home'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [physicalBroadcastInit, setPhysicalBroadcastInit] = useState<boolean>(false);
  const [battleState, setBattleState] = useState<FullBattleState | null>(null);
  const [inspectedCard, setInspectedCard] = useState<CardDefinition | null>(null);
  const [cardsVersion, setCardsVersion] = useState<number>(0);
  const [editorState, setEditorState] = useState<{
    open: boolean;
    card: CardDefinition | null;
    defaultPackSeriesId?: string | null;
    defaultCategory?: CardCategory | null;
  }>({ open: false, card: null, defaultPackSeriesId: null, defaultCategory: null });
  const [seriesEditorState, setSeriesEditorState] = useState<{
    open: boolean;
    pack: CardPackSeries | null;
  }>({ open: false, pack: null });

  const [trialFighters, setTrialFighters] = useState<{ f0: string; f1: string }>({
    f0: 'bf-31-boboiboy-nova',
    f1: 'bf-19-boboiboy-halilintar',
  });

  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [wallet, setWallet] = useState(loadUserWallet);
  const lastSavedBattleMatchIdRef = useRef<string | null>(null);

  // Initialize global real-time synchronization listener
  useEffect(() => {
    const cleanup = initGlobalSync();
    return cleanup;
  }, []);

  // Sync wallet state on focus/storage changes
  useEffect(() => {
    const handleStorage = () => setWallet(loadUserWallet());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (battleState && battleState.phase === 'GAME_OVER') {
      const matchId =
        battleState.matchId ||
        `match-${battleState.round}-${battleState.players[0].winZone.length}-${battleState.players[1].winZone.length}`;
      if (lastSavedBattleMatchIdRef.current !== matchId) {
        lastSavedBattleMatchIdRef.current = matchId;
        saveBattleMatch(battleState);

        // Award Galaxy Coins for completing match
        const isP1Winner = battleState.winnerIndex === 0;
        const rewardCoins = isP1Winner ? 150 : 60;
        const updated = addWalletCoins(
          rewardCoins,
          `Hadiah Tanding ${battleState.mode === 'VS_CPU' ? 'vs CPU' : 'Duel'}: ${
            isP1Winner ? 'Kemenangan Mutlak (+150 Koin)' : 'Partisipasi Tanding (+60 Koin)'
          }`,
          'BATTLE_REWARD'
        );
        setWallet(updated);
      }
    }
  }, [battleState]);

  const [customDeckIds, setCustomDeckIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_DECK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeUnique30Deck(parsed);
        }
      }
    } catch {
      // Ignore storage error
    }
    return deduplicateDeckIds(PRESET_DECKS[0].cardIds, 30);
  });

  const [deckStore, setDeckStore] = useState<{
    decks: SavedUserDeck[];
    activeDeckId: string;
  }>(() => loadSavedUserDecks(customDeckIds));

  const savedDecks = deckStore.decks;
  const activeDeckId = deckStore.activeDeckId;

  const navigateToTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (soundFx.getSnapshot().studioOpen) {
          soundFx.closeBgmStudio();
        } else if (seriesEditorState.open) {
          setSeriesEditorState({ open: false, pack: null });
        } else if (editorState.open) {
          setEditorState({
            open: false,
            card: null,
            defaultPackSeriesId: null,
            defaultCategory: null,
          });
        } else if (inspectedCard) {
          setInspectedCard(null);
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectedCard, editorState.open, seriesEditorState.open, mobileMenuOpen]);

  const handleClearInitialRoomCode = useCallback(() => {
    setInitialRoomCode(null);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('room')) {
        url.searchParams.delete('room');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      // Ignore history API errors
    }
  }, []);

  const handleUpdateSavedDecks = useCallback(
    (nextDecks: SavedUserDeck[], nextActiveId: string) => {
      if (nextDecks.length === 0) return;
      const resolvedActiveId = nextDecks.some((d) => d.id === nextActiveId)
        ? nextActiveId
        : nextDecks[0].id;
      setDeckStore({ decks: nextDecks, activeDeckId: resolvedActiveId });
      persistSavedUserDecks(nextDecks, resolvedActiveId);

      const activeDeck = nextDecks.find((d) => d.id === resolvedActiveId) ?? nextDecks[0];
      const uniqueActiveIds = deduplicateDeckIds(activeDeck.cardIds, activeDeck.targetSize);
      if (uniqueActiveIds.length > 0) {
        setCustomDeckIds(uniqueActiveIds);
        try {
          localStorage.setItem(CUSTOM_DECK_STORAGE_KEY, JSON.stringify(uniqueActiveIds));
        } catch {
          // Ignore storage error
        }
      }
    },
    []
  );

  const handleLoadPackIntoDeckBuilder = useCallback(
    (deckIds: string[], packId?: string, packName?: string) => {
      const rawLen = deduplicateDeckIds(deckIds, 30).length;
      const targetSize: DeckTargetSize =
        rawLen <= 10 ? 10 : rawLen <= 15 ? 15 : rawLen <= 20 ? 20 : 30;
      const cleanIds = deduplicateDeckIds(deckIds, targetSize);
      const packMeta = packId ? PACK_SERIES_BY_ID[packId] : undefined;
      const resolvedLabel = packName || packMeta?.name || 'Seri Pek';

      const targetName = `Dek ${resolvedLabel}`.slice(0, 36);
      const existingIdx = savedDecks.findIndex((d) => d.name === targetName);

      if (existingIdx >= 0) {
        const updatedSlot: SavedUserDeck = {
          ...savedDecks[existingIdx],
          targetSize,
          cardIds: cleanIds,
          updatedAt: Date.now(),
        };
        const nextDecks = savedDecks.map((d, i) => (i === existingIdx ? updatedSlot : d));
        handleUpdateSavedDecks(nextDecks, updatedSlot.id);
      } else {
        const newSlot: SavedUserDeck = {
          id: `user-deck-pack-${Date.now()}`,
          name: targetName,
          targetSize,
          suitArtSet: 1,
          cardIds: cleanIds,
          updatedAt: Date.now(),
        };
        handleUpdateSavedDecks([...savedDecks, newSlot], newSlot.id);
      }
      navigateToTab('deck');
    },
    [savedDecks, handleUpdateSavedDecks, navigateToTab]
  );

  const handleQuickStartMatch = (deckOrIds?: SavedUserDeck | string[]) => {
    const activeSaved = savedDecks.find((d) => d.id === activeDeckId) ?? savedDecks[0];
    let p1Ids: string[] = [];
    let p1SuitSet: SuitArtSetId = 1;

    if (deckOrIds && !Array.isArray(deckOrIds)) {
      p1Ids = deduplicateDeckIds(deckOrIds.cardIds, deckOrIds.targetSize);
      p1SuitSet = deckOrIds.suitArtSet;
    } else if (Array.isArray(deckOrIds)) {
      p1Ids = deduplicateDeckIds(deckOrIds, 30);
    } else if (activeSaved) {
      p1Ids = deduplicateDeckIds(activeSaved.cardIds, activeSaved.targetSize);
      p1SuitSet = activeSaved.suitArtSet;
    }

    if (p1Ids.length < 10) {
      p1Ids = deduplicateDeckIds(PRESET_DECKS[0].cardIds, 30);
    }
    const p2Ids = deduplicateDeckIds(PRESET_DECKS[1].cardIds, 30);

    soundFx.playCardDeploy();
    setBattleState(
      createInitialBattleState({
        mode: 'VS_CPU',
        difficulty: 'STANDAR',
        targetWins: 99,
        maxRounds: 5,
        p1Name: 'Pemain 1',
        p2Name: 'CPU (STANDAR)',
        p1DeckIds: p1Ids,
        p2DeckIds: p2Ids,
        p1SuitSet,
        p2SuitSet: 3,
      })
    );
    navigateToTab('arena');
  };

  const handleOpenEditCard = (card: CardDefinition) => {
    setEditorState({
      open: true,
      card,
      defaultPackSeriesId: card.packSeriesId ?? null,
      defaultCategory: card.category,
    });
  };

  const handleOpenCreateCard = (packSeriesId?: string, category?: CardCategory) => {
    setMobileMenuOpen(false);
    setEditorState({
      open: true,
      card: null,
      defaultPackSeriesId: packSeriesId ?? null,
      defaultCategory: category ?? null,
    });
  };

  const handleOpenCreateSuitCard = () => {
    handleOpenCreateCard('pek-kreasi-pemain', CardCategory.SUIT);
  };

  const handleOpenEditSeries = (pack: CardPackSeries) => {
    setSeriesEditorState({
      open: true,
      pack: PACK_SERIES_BY_ID[pack.id] ?? pack,
    });
  };

  const handleOpenCreateSeries = () => {
    setSeriesEditorState({ open: true, pack: null });
  };

  const handleOpenPhysicalHost = useCallback(
    (withBroadcast = false) => {
      setPhysicalBroadcastInit(withBroadcast);
      navigateToTab('physical');
    },
    [navigateToTab]
  );

  const handleHomeDestination = useCallback(
    (dest: MainMenuDestination) => {
      if (dest === 'physical') {
        handleOpenPhysicalHost(false);
        return;
      }
      navigateToTab(dest);
    },
    [handleOpenPhysicalHost, navigateToTab]
  );

  const headerNavItems: {
    id: ActiveTab;
    label: string;
    isActive: boolean;
  }[] = [
    {
      id: 'home',
      label: 'Beranda',
      isActive: activeTab === 'home',
    },
    {
      id: 'arena',
      label: 'Pertarungan',
      isActive:
        activeTab === 'arena' ||
        activeTab === 'physical' ||
        activeTab === 'multiplayer' ||
        activeTab === 'custom' ||
        activeTab === 'rules',
    },
    {
      id: 'history',
      label: 'Riwayat Duel',
      isActive: activeTab === 'history',
    },
    {
      id: 'trial',
      label: 'Uji Coba Kartu',
      isActive: activeTab === 'trial',
    },
    {
      id: 'shop',
      label: 'Toko Kartu',
      isActive: activeTab === 'shop',
    },
    {
      id: 'deck',
      label: 'Atur Dek',
      isActive: activeTab === 'deck',
    },
    {
      id: 'gallery',
      label: 'Koleksi',
      isActive: activeTab === 'gallery' || activeTab === 'packs',
    },
    {
      id: 'album',
      label: 'Album 3×3',
      isActive: activeTab === 'album',
    },
  ];

  const battleSubTabs: { id: ActiveTab; label: string }[] = [
    { id: 'arena', label: 'Duel 1 vs 1' },
    { id: 'history', label: 'Riwayat Duel' },
    { id: 'trial', label: 'Uji Coba Kartu' },
    { id: 'physical', label: 'Host Kartu Asli' },
    { id: 'multiplayer', label: 'Multiplayer' },
    { id: 'custom', label: 'Simulasi Custom' },
    { id: 'rules', label: 'Panduan' },
  ];

  const collectionSubTabs: { id: ActiveTab; label: string }[] = [
    { id: 'shop', label: 'Toko Kartu' },
    { id: 'gallery', label: 'Galeri & 3D' },
    { id: 'packs', label: 'Seri Pek' },
    { id: 'album', label: 'Album Poster 3×3' },
    { id: 'deck', label: 'Atur Dek' },
  ];

  const isInActiveTabletopMatch = activeTab === 'arena' && battleState !== null;
  const showBattleSubBar = BATTLE_GROUP_TABS.includes(activeTab) && !isInActiveTabletopMatch;
  const showCollectionSubBar = COLLECTION_GROUP_TABS.includes(activeTab);

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1120] text-slate-100">
      {/* Real-time Global Updates & Broadcast Banner */}
      <GlobalUpdateBanner
        onOpenShop={() => navigateToTab('shop')}
        onRefreshData={() => setWallet(loadUserWallet())}
      />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#0B1120]/95 backdrop-blur-xs border-b border-slate-800/90 relative">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 py-3">
          {/* Zone 1: Single Wordmark Brand Link */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              soundFx.playCardSelect();
              navigateToTab('home');
            }}
            className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
          >
            Monsta Galaxy Battle
          </a>

          {/* Zone 2: Concise Single-Line Navigation Links */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-7 text-xs sm:text-sm font-medium text-slate-300">
            {headerNavItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  soundFx.playCardSelect();
                  navigateToTab(item.id);
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  item.isActive
                    ? 'text-white border-amber-400 font-semibold'
                    : 'text-slate-400 border-transparent hover:text-white hover:border-slate-600'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: Wallet Coins, Owner Button, Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Quick Wallet Pill */}
            <button
              type="button"
              onClick={() => {
                soundFx.playCardSelect();
                navigateToTab('shop');
              }}
              title="Koin Galaksi — Klik untuk Buka Toko"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{wallet.coins.toLocaleString()}</span>
            </button>

            {/* Owner Access Button */}
            <button
              type="button"
              onClick={() => {
                soundFx.playCardSelect();
                setOwnerModalOpen(true);
              }}
              title="Panel Pemilik Aplikasi (Ahmad Syarif)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#131C31] hover:bg-slate-800 border border-amber-500/30 hover:border-amber-400 text-amber-300 text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Pemilik</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateCard()}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Kartu</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label="Buka menu navigasi"
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#131C31] hover:bg-slate-800 text-slate-100 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              <span>Menu</span>
            </button>
          </div>
        </div>

        {/* Clean Structured Mobile Menu Dropdown (< lg viewports only) */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute inset-x-0 top-full bg-[#11192C] border-b border-slate-800 shadow-2xl px-4 py-4 space-y-4">
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono text-slate-400 px-1">Navigasi Utama</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'home' as ActiveTab, label: 'Beranda Utama' },
                  { id: 'shop' as ActiveTab, label: '🛒 Toko Kartu' },
                  { id: 'arena' as ActiveTab, label: 'Duel 1 vs 1' },
                  { id: 'history' as ActiveTab, label: 'Riwayat Duel' },
                  { id: 'trial' as ActiveTab, label: 'Uji Coba Kartu' },
                  { id: 'physical' as ActiveTab, label: 'Host Kartu Asli' },
                  { id: 'multiplayer' as ActiveTab, label: 'Multiplayer Online' },
                  { id: 'custom' as ActiveTab, label: 'Simulasi Custom' },
                  { id: 'album' as ActiveTab, label: 'Album Poster 3×3' },
                  { id: 'gallery' as ActiveTab, label: 'Galeri & 3D' },
                  { id: 'packs' as ActiveTab, label: 'Seri Pek Kartu' },
                  { id: 'deck' as ActiveTab, label: 'Atur Dek Unik' },
                  { id: 'rules' as ActiveTab, label: 'Panduan Resmi' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      soundFx.playCardSelect();
                      if (item.id === 'physical') {
                        handleOpenPhysicalHost(false);
                      } else {
                        navigateToTab(item.id);
                      }
                    }}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-xl border text-left transition-colors whitespace-nowrap truncate ${
                      activeTab === item.id
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                        : 'bg-[#0B1120] hover:bg-slate-800 text-slate-200 border-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <AudioControlWidget compact />
              <button
                type="button"
                onClick={() => handleOpenCreateCard()}
                className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Kartu Baru</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Contextual Sub-Menu Toolbar for Battle Modes */}
        {showBattleSubBar && (
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-5">
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                {battleSubTabs.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      soundFx.playCardSelect();
                      if (sub.id === 'physical') {
                        handleOpenPhysicalHost(false);
                      } else {
                        navigateToTab(sub.id);
                      }
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      activeTab === sub.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <AudioControlWidget compact />
              </div>
            </div>
          </div>
        )}

        {/* Contextual Sub-Menu Toolbar for Collection & Studio Modes */}
        {showCollectionSubBar && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-5">
            <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                {collectionSubTabs.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      soundFx.playCardSelect();
                      navigateToTab(sub.id);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      activeTab === sub.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <AudioControlWidget compact />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'home' && (
          <HomeMenu
            cardsVersion={cardsVersion}
            savedDecks={savedDecks}
            activeDeckId={activeDeckId}
            onNavigate={handleHomeDestination}
            onQuickStartDuel={() => handleQuickStartMatch()}
            onInspectCard={setInspectedCard}
            onEditCard={handleOpenEditCard}
            onOpenCreateCard={() => handleOpenCreateCard()}
          />
        )}

        {activeTab === 'arena' && (
          <BattleArena
            battleState={battleState}
            setBattleState={setBattleState}
            customDeckIds={customDeckIds}
            savedDecks={savedDecks}
            activeDeckId={activeDeckId}
            cardsVersion={cardsVersion}
            onInspectCard={setInspectedCard}
            onEditCard={handleOpenEditCard}
            onOpenCreateCard={() => handleOpenCreateCard()}
            onOpenCreateSuitCard={handleOpenCreateSuitCard}
            onOpenDeckBuilder={() => navigateToTab('deck')}
            onOpenCustomArena={() => navigateToTab('custom')}
            onOpenMultiplayer={() => navigateToTab('multiplayer')}
            onOpenPhysicalHost={() => handleOpenPhysicalHost(false)}
            onOpenPackSeries={() => navigateToTab('packs')}
            onOpenAlbum={() => navigateToTab('album')}
            onOpenHistory={() => navigateToTab('history')}
            onOpenCardTrial={() => navigateToTab('trial')}
            onOpenShop={() => navigateToTab('shop')}
          />
        )}

        {activeTab === 'history' && (
          <BattleHistory
            onInspectCard={setInspectedCard}
            onNavigateToArena={() => navigateToTab('arena')}
            onOpenCardTrialWithFighters={(f0, f1) => {
              setTrialFighters({ f0, f1 });
              navigateToTab('trial');
            }}
          />
        )}

        {activeTab === 'trial' && (
          <CardTrialSandbox
            cardsVersion={cardsVersion}
            initialFighter0CardId={trialFighters.f0}
            initialFighter1CardId={trialFighters.f1}
            onInspectCard={setInspectedCard}
            onOpenDeckBuilder={() => navigateToTab('deck')}
            onNavigateToArena={() => navigateToTab('arena')}
          />
        )}

        {activeTab === 'physical' && (
          <PhysicalHostArena
            cardsVersion={cardsVersion}
            initialBroadcastEnabled={physicalBroadcastInit}
            onInspectCard={setInspectedCard}
            onEditCard={handleOpenEditCard}
            onOpenCreateCard={() => handleOpenCreateCard()}
            onOpenCreateSuitCard={handleOpenCreateSuitCard}
            onCardsMutated={() => setCardsVersion((v) => v + 1)}
            onBackToDigitalArena={() => navigateToTab('arena')}
          />
        )}

        {activeTab === 'multiplayer' && (
          <MultiplayerArena
            customDeckIds={customDeckIds}
            savedDecks={savedDecks}
            activeDeckId={activeDeckId}
            cardsVersion={cardsVersion}
            initialRoomCode={initialRoomCode}
            onClearInitialRoomCode={handleClearInitialRoomCode}
            onInspectCard={setInspectedCard}
            onEditCard={handleOpenEditCard}
            onOpenCreateCard={() => handleOpenCreateCard()}
            onOpenCreateSuitCard={handleOpenCreateSuitCard}
            onOpenPhysicalHostWithBroadcast={() => handleOpenPhysicalHost(true)}
            onSyncCardsFromRoom={() => setCardsVersion((v) => v + 1)}
          />
        )}

        {activeTab === 'packs' && (
          <PackSeriesHub
            cardsVersion={cardsVersion}
            onInspectCard={setInspectedCard}
            onEditCard={handleOpenEditCard}
            onOpenCreateCardInPack={(packId) => handleOpenCreateCard(packId)}
            onOpenCreateSeries={handleOpenCreateSeries}
            onOpenEditSeries={handleOpenEditSeries}
            onUsePackInBattle={(deckIds) => {
              handleQuickStartMatch(deckIds);
            }}
            onLoadPackIntoDeckBuilder={(deckIds, packId, packName) => {
              handleLoadPackIntoDeckBuilder(deckIds, packId, packName);
            }}
          />
        )}

        {activeTab === 'custom' && (
          <CustomArena
            customDeckIds={customDeckIds}
            savedDecks={savedDecks}
            cardsVersion={cardsVersion}
            onInspectCard={setInspectedCard}
            onEditCard={handleOpenEditCard}
            onOpenCreateCard={() => handleOpenCreateCard()}
            onOpenCreateSuitCard={handleOpenCreateSuitCard}
            onOpenPhysicalHost={() => handleOpenPhysicalHost(false)}
          />
        )}

        {activeTab === 'gallery' && (
          <CardGallery
            cardsVersion={cardsVersion}
            onInspectCard={setInspectedCard}
            onEditCard={handleOpenEditCard}
            onOpenCreateCard={() => handleOpenCreateCard()}
            onOpenCreateSuitCard={handleOpenCreateSuitCard}
            onEditPackSeries={handleOpenEditSeries}
            onOpenCreateSeries={handleOpenCreateSeries}
            onOpenAlbum={() => navigateToTab('album')}
            onCardsMutated={() => setCardsVersion((v) => v + 1)}
          />
        )}

        {activeTab === 'album' && (
          <PosterAlbum3x3
            cardsVersion={cardsVersion}
            savedDecks={savedDecks}
            activeDeckId={activeDeckId}
            onInspectCard={setInspectedCard}
            onEditCard={handleOpenEditCard}
            onOpenCreateCard={() => handleOpenCreateCard()}
            onOpenGallery={() => navigateToTab('gallery')}
            onCardsMutated={() => setCardsVersion((v) => v + 1)}
          />
        )}

        {activeTab === 'deck' && (
          <DeckBuilder
            savedDecks={savedDecks}
            activeDeckId={activeDeckId}
            cardsVersion={cardsVersion}
            onUpdateSavedDecks={handleUpdateSavedDecks}
            onUseDeckInBattle={(deck) => handleQuickStartMatch(deck)}
            onInspectCard={setInspectedCard}
            onEditCard={handleOpenEditCard}
            onOpenCreateCard={() => handleOpenCreateCard()}
            onOpenCreateSuitCard={handleOpenCreateSuitCard}
            onEditPackSeries={handleOpenEditSeries}
          />
        )}

        {activeTab === 'shop' && (
          <CardShop
            onInspectCard={setInspectedCard}
            onNavigateToCollection={() => navigateToTab('gallery')}
            onDeckUpdated={() => setCardsVersion((v) => v + 1)}
          />
        )}

        {activeTab === 'rules' && (
          <RulesGuide
            onInspectCard={setInspectedCard}
            onStartQuickDuel={() => handleQuickStartMatch()}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 py-5 px-4 sm:px-6 text-center text-xs text-slate-500 flex flex-wrap items-center justify-center gap-3">
        <span>Monsta Galaxy Card · Arena &amp; Koleksi 1 vs 1</span>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => navigateToTab('home')}
          className="text-slate-400 hover:text-amber-300 transition-colors underline underline-offset-4 whitespace-nowrap shrink-0"
        >
          Beranda Utama
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => navigateToTab('shop')}
          className="text-slate-400 hover:text-amber-300 transition-colors underline underline-offset-4 whitespace-nowrap shrink-0"
        >
          Toko Kartu
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => setOwnerModalOpen(true)}
          className="text-slate-400 hover:text-amber-300 transition-colors underline underline-offset-4 whitespace-nowrap shrink-0"
        >
          👑 Panel Pemilik
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => navigateToTab('album')}
          className="text-slate-400 hover:text-amber-300 transition-colors underline underline-offset-4 whitespace-nowrap shrink-0"
        >
          Album Poster 3×3
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => handleOpenPhysicalHost(false)}
          className="text-slate-400 hover:text-emerald-300 transition-colors underline underline-offset-4 whitespace-nowrap shrink-0"
        >
          Host Kartu Asli
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => navigateToTab('rules')}
          className="text-slate-400 hover:text-amber-300 transition-colors underline underline-offset-4 whitespace-nowrap shrink-0"
        >
          Panduan Resmi
        </button>
        <span aria-hidden="true">·</span>
        <AudioControlWidget compact popoverDirection="up" />
      </footer>

      {/* Card Detail 3D Lightbox */}
      <CardDetailModal
        card={inspectedCard ? CARD_BY_ID[inspectedCard.id] ?? inspectedCard : null}
        onClose={() => setInspectedCard(null)}
        onEditCard={handleOpenEditCard}
        onEditPackSeries={handleOpenEditSeries}
        onCardsMutated={() => setCardsVersion((v) => v + 1)}
      />

      {/* Global Pack Series Studio Modal */}
      <PackSeriesEditorModal
        isOpen={seriesEditorState.open}
        initialPack={seriesEditorState.pack}
        onClose={() => setSeriesEditorState({ open: false, pack: null })}
        onSaved={() => {
          setCardsVersion((v) => v + 1);
          setSeriesEditorState({ open: false, pack: null });
        }}
        onDeleted={() => {
          setCardsVersion((v) => v + 1);
          setSeriesEditorState({ open: false, pack: null });
        }}
        onResetToDefault={() => {
          setCardsVersion((v) => v + 1);
          setSeriesEditorState({ open: false, pack: null });
        }}
      />

      {/* Card Upload & Edit Studio Modal */}
      <CardEditorModal
        isOpen={editorState.open}
        initialCard={editorState.card}
        defaultPackSeriesId={editorState.defaultPackSeriesId}
        defaultCategory={editorState.defaultCategory}
        onClose={() =>
          setEditorState({
            open: false,
            card: null,
            defaultPackSeriesId: null,
            defaultCategory: null,
          })
        }
        onSaved={(savedCard) => {
          setCardsVersion((v) => v + 1);
          if (inspectedCard && inspectedCard.id === savedCard.id) {
            setInspectedCard(savedCard);
          }
          setEditorState({
            open: false,
            card: null,
            defaultPackSeriesId: null,
            defaultCategory: null,
          });
        }}
        onDeleted={(deletedId) => {
          setCardsVersion((v) => v + 1);
          if (inspectedCard && inspectedCard.id === deletedId) {
            setInspectedCard(null);
          }
          const updatedDecks = savedDecks.map((slot) =>
            slot.cardIds.includes(deletedId)
              ? {
                  ...slot,
                  cardIds: deduplicateDeckIds(
                    slot.cardIds.filter((id) => id !== deletedId),
                    slot.targetSize
                  ),
                }
              : slot
          );
          handleUpdateSavedDecks(updatedDecks, activeDeckId);
          setCustomDeckIds((prev) => {
            if (!prev.includes(deletedId)) return prev;
            const cleaned = normalizeUnique30Deck(prev.filter((id) => id !== deletedId));
            try {
              localStorage.setItem(CUSTOM_DECK_STORAGE_KEY, JSON.stringify(cleaned));
            } catch {
              // Ignore storage error
            }
            return cleaned;
          });
          setEditorState({
            open: false,
            card: null,
            defaultPackSeriesId: null,
            defaultCategory: null,
          });
        }}
        onResetToDefault={(resetId) => {
          setCardsVersion((v) => v + 1);
          if (inspectedCard && inspectedCard.id === resetId && CARD_BY_ID[resetId]) {
            setInspectedCard(CARD_BY_ID[resetId]);
          }
          setEditorState({
            open: false,
            card: null,
            defaultPackSeriesId: null,
          });
        }}
      />

      {/* Owner Authentication & Live Global Broadcast Panel */}
      <OwnerModal
        isOpen={ownerModalOpen}
        onClose={() => setOwnerModalOpen(false)}
        onUpdateBroadcasted={() => setWallet(loadUserWallet())}
      />

      {/* Global BGM & Custom Soundtrack Studio Modal */}
      <BgmEditorModal />
    </div>
  );
}
