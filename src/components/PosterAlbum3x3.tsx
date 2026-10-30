import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Grid3X3,
  Layers,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import {
  ALL_CARDS,
  ALL_PACK_SERIES,
  BRAND_LOGOS,
  CARD_BY_ID,
  cardBelongsToPackSeries,
  cycleCardHologramFinish,
  getHologramFinishMeta,
  getPrimaryPackSeriesForCard,
  isCardHolographic,
  resolveCardHologramFinish,
} from '../data/cards';
import {
  CardCategory,
  type CardDefinition,
  type HologramFinish,
  type SavedUserDeck,
} from '../types/game';
import { soundFx } from '../utils/sound';
import { getHologramBorderClass, HologramFoilOverlay } from './CardVisual';

const POSTER_STORAGE_KEY = 'mgc_poster_album_3x3_state_v1';
const BINDER_BOOK_STORAGE_KEY = 'mgc_collection_binder_book_v1';
const MAX_STACK_PER_SLOT = 6;

const POSTER_WAVE_CLASSES = [
  'poster-wave-0',
  'poster-wave-1',
  'poster-wave-2',
  'poster-wave-1',
  'poster-wave-2',
  'poster-wave-3',
  'poster-wave-2',
  'poster-wave-3',
  'poster-wave-4',
] as const;

const RANK_SORT_WEIGHT: Record<string, number> = {
  SR: 60,
  AR: 50,
  S: 40,
  A: 30,
  B: 20,
  C: 10,
  SUPPORT: 6,
  SUIT: 3,
};

export type PosterThemeId = 'BLAZING_FROST' | 'SOLAR_GOLD' | 'CRYO_GLACIER' | 'MUSEUM_LIGHT';
export type AlbumMode = 'CUSTOM_POSTER' | 'COLLECTION_BINDER';
export type ExportScale = 2 | 3;
export type PickerCategoryFilter = 'ALL' | 'HOLOGRAM' | CardCategory;
export type SlotAssignMode = 'OVERWRITE' | 'STACK_LAYER';

export interface PocketStack {
  cardIds: string[];
  activeIndex: number;
  locked?: boolean;
}

export interface EditableBinderSheet {
  id: string;
  title: string;
  subtitle: string;
  slots: (string | null)[];
  pocketStacks: PocketStack[];
}

interface SavedPosterState {
  title: string;
  subtitle: string;
  collectorName: string;
  theme: PosterThemeId;
  showCardCaptions: boolean;
  showStatsFooter: boolean;
  slots: (string | null)[];
  pocketStacks: PocketStack[];
}

interface PosterThemeStyle {
  id: PosterThemeId;
  name: string;
  posterOuter: string;
  posterInnerFrame: string;
  kickerText: string;
  titleText: string;
  subtitleText: string;
  dividerBorder: string;
  slotFrame: string;
  slotEmpty: string;
  captionTitle: string;
  captionMeta: string;
  footerText: string;
  footerAccent: string;
  canvasBgHex: string;
  canvasFrameHex: string;
  canvasTitleHex: string;
  canvasSubHex: string;
  canvasAccentHex: string;
}

const POSTER_THEMES: Record<PosterThemeId, PosterThemeStyle> = {
  BLAZING_FROST: {
    id: 'BLAZING_FROST',
    name: 'Blazing Frost',
    posterOuter:
      'bg-gradient-to-b from-[#0A1020] via-[#111C35] to-[#090E1B] border-amber-400/45 text-white',
    posterInnerFrame: 'border-slate-700/70',
    kickerText: 'text-amber-400',
    titleText: 'text-white',
    subtitleText: 'text-slate-300',
    dividerBorder: 'border-slate-800/90',
    slotFrame: 'bg-[#080D1A] border-slate-700/90 shadow-lg',
    slotEmpty: 'bg-[#080D1A]/75 border-slate-800 text-slate-500',
    captionTitle: 'text-slate-100',
    captionMeta: 'text-amber-300/90',
    footerText: 'text-slate-400',
    footerAccent: 'text-amber-300',
    canvasBgHex: '#0D1528',
    canvasFrameHex: '#F59E0B',
    canvasTitleHex: '#FFFFFF',
    canvasSubHex: '#CBD5E1',
    canvasAccentHex: '#FBBF24',
  },
  SOLAR_GOLD: {
    id: 'SOLAR_GOLD',
    name: 'Solar Royal',
    posterOuter:
      'bg-gradient-to-b from-[#171108] via-[#22190C] to-[#120D06] border-amber-400/65 text-amber-50',
    posterInnerFrame: 'border-amber-500/30',
    kickerText: 'text-amber-300',
    titleText: 'text-amber-50',
    subtitleText: 'text-amber-200/80',
    dividerBorder: 'border-amber-500/25',
    slotFrame: 'bg-[#0F0B05] border-amber-500/40 shadow-lg',
    slotEmpty: 'bg-[#0F0B05]/75 border-amber-500/20 text-amber-200/40',
    captionTitle: 'text-amber-50',
    captionMeta: 'text-amber-300',
    footerText: 'text-amber-200/70',
    footerAccent: 'text-amber-300',
    canvasBgHex: '#1A1309',
    canvasFrameHex: '#FBBF24',
    canvasTitleHex: '#FFFBEB',
    canvasSubHex: '#FDE68A',
    canvasAccentHex: '#F59E0B',
  },
  CRYO_GLACIER: {
    id: 'CRYO_GLACIER',
    name: 'Cryo Glacier',
    posterOuter:
      'bg-gradient-to-b from-[#071524] via-[#0D2238] to-[#06101C] border-sky-400/50 text-sky-50',
    posterInnerFrame: 'border-sky-400/25',
    kickerText: 'text-sky-300',
    titleText: 'text-white',
    subtitleText: 'text-sky-200/80',
    dividerBorder: 'border-sky-400/20',
    slotFrame: 'bg-[#06101C] border-sky-400/35 shadow-lg',
    slotEmpty: 'bg-[#06101C]/75 border-sky-900/60 text-sky-300/40',
    captionTitle: 'text-sky-50',
    captionMeta: 'text-sky-300',
    footerText: 'text-sky-200/70',
    footerAccent: 'text-sky-300',
    canvasBgHex: '#0A1B2E',
    canvasFrameHex: '#38BDF8',
    canvasTitleHex: '#F0F9FF',
    canvasSubHex: '#BAE6FD',
    canvasAccentHex: '#38BDF8',
  },
  MUSEUM_LIGHT: {
    id: 'MUSEUM_LIGHT',
    name: 'Galeri Terang',
    posterOuter:
      'bg-gradient-to-b from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0] border-slate-300 text-slate-900',
    posterInnerFrame: 'border-slate-300/90',
    kickerText: 'text-amber-700',
    titleText: 'text-slate-900',
    subtitleText: 'text-slate-600',
    dividerBorder: 'border-slate-300',
    slotFrame: 'bg-white border-slate-300 shadow-md',
    slotEmpty: 'bg-slate-100 border-slate-300 text-slate-400',
    captionTitle: 'text-slate-900',
    captionMeta: 'text-amber-700',
    footerText: 'text-slate-600',
    footerAccent: 'text-slate-900',
    canvasBgHex: '#F1F5F9',
    canvasFrameHex: '#94A3B8',
    canvasTitleHex: '#0F172A',
    canvasSubHex: '#475569',
    canvasAccentHex: '#B45309',
  },
};

function createSheetId(): string {
  return `binder-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getActiveCardIdFromStack(stack: PocketStack | undefined): string | null {
  if (!stack || stack.cardIds.length === 0) return null;
  const clamped = Math.min(Math.max(0, stack.activeIndex), stack.cardIds.length - 1);
  return stack.cardIds[clamped] ?? null;
}

function deriveLegacySlotsFromStacks(stacks: PocketStack[]): (string | null)[] {
  return Array.from({ length: 9 }, (_, idx) => getActiveCardIdFromStack(stacks[idx]));
}

function stacksFromSingleSlotIds(
  ids: (string | null)[],
  preserveLocksFrom?: PocketStack[]
): PocketStack[] {
  return Array.from({ length: 9 }, (_, idx) => {
    const prevStack = preserveLocksFrom?.[idx];
    const isLocked = Boolean(prevStack?.locked);
    if (isLocked && prevStack) {
      return {
        cardIds: [...prevStack.cardIds],
        activeIndex: prevStack.activeIndex,
        locked: true,
      };
    }
    const id = ids[idx];
    return {
      cardIds: typeof id === 'string' && id.length > 0 ? [id] : [],
      activeIndex: 0,
      locked: false,
    };
  });
}

function normalizeNineStacks(rawStacks: unknown, fallbackSlots?: unknown): PocketStack[] {
  if (Array.isArray(rawStacks)) {
    return Array.from({ length: 9 }, (_, idx) => {
      const item = rawStacks[idx] as Partial<PocketStack> | undefined;
      if (item && typeof item === 'object' && Array.isArray(item.cardIds)) {
        const cleanedIds = item.cardIds
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
          .slice(0, MAX_STACK_PER_SLOT);
        const rawIdx = typeof item.activeIndex === 'number' ? item.activeIndex : 0;
        const clampedIdx =
          cleanedIds.length > 0 ? Math.min(Math.max(0, rawIdx), cleanedIds.length - 1) : 0;
        return {
          cardIds: cleanedIds,
          activeIndex: clampedIdx,
          locked: Boolean(item.locked),
        };
      }
      const legacyVal = Array.isArray(fallbackSlots) ? fallbackSlots[idx] : null;
      return {
        cardIds: typeof legacyVal === 'string' && legacyVal.length > 0 ? [legacyVal] : [],
        activeIndex: 0,
        locked: false,
      };
    });
  }

  if (Array.isArray(fallbackSlots)) {
    return Array.from({ length: 9 }, (_, idx) => {
      const val = fallbackSlots[idx];
      return {
        cardIds: typeof val === 'string' && val.length > 0 ? [val] : [],
        activeIndex: 0,
        locked: false,
      };
    });
  }

  return Array.from({ length: 9 }, () => ({
    cardIds: [],
    activeIndex: 0,
    locked: false,
  }));
}

function buildDefaultCuratedSlots(): (string | null)[] {
  const sorted = [...ALL_CARDS]
    .filter((c) => c.category === CardCategory.CHARACTER)
    .sort((a, b) => {
      const rw = (RANK_SORT_WEIGHT[b.rank] ?? 0) - (RANK_SORT_WEIGHT[a.rank] ?? 0);
      if (rw !== 0) return rw;
      return b.hp + b.atk - (a.hp + a.atk);
    });

  const ids: (string | null)[] = sorted.slice(0, 9).map((c) => c.id);
  while (ids.length < 9) ids.push(null);
  return ids;
}

function buildDefaultBinderSheetsFromCollection(): EditableBinderSheet[] {
  const totalCards = ALL_CARDS.length;
  const pageCount = Math.max(1, Math.ceil(totalCards / 9));

  return Array.from({ length: pageCount }, (_, pageIdx) => {
    const start = pageIdx * 9;
    const slice = ALL_CARDS.slice(start, start + 9);
    const slots = Array.from({ length: 9 }, (__, slotIdx) => slice[slotIdx]?.id ?? null);
    const pocketStacks = stacksFromSingleSlotIds(slots);
    const pageNum = String(pageIdx + 1).padStart(2, '0');
    const firstLabel = slice[0]?.numberLabel ?? `#${start + 1}`;
    const lastLabel = slice[slice.length - 1]?.numberLabel ?? `#${start + slice.length}`;

    return {
      id: `binder-default-${pageIdx + 1}`,
      title: `LEMBAR KOLEKSI ${pageNum}`,
      subtitle: `Kantong Binder ${firstLabel} – ${lastLabel} · Susunan Katalog`,
      slots,
      pocketStacks,
    };
  });
}

function loadInitialBinderSheets(): EditableBinderSheet[] {
  const fallback = buildDefaultBinderSheetsFromCollection();
  try {
    const raw = localStorage.getItem(BINDER_BOOK_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;

    const validSheets: EditableBinderSheet[] = parsed
      .map((item, idx) => {
        if (!item || typeof item !== 'object') return null;
        const obj = item as Partial<EditableBinderSheet>;
        const pageNum = String(idx + 1).padStart(2, '0');
        const pocketStacks = normalizeNineStacks(obj.pocketStacks, obj.slots);
        return {
          id: typeof obj.id === 'string' && obj.id.length > 0 ? obj.id : createSheetId(),
          title:
            typeof obj.title === 'string' && obj.title.trim().length > 0
              ? obj.title
              : `LEMBAR KOLEKSI ${pageNum}`,
          subtitle: typeof obj.subtitle === 'string' ? obj.subtitle : '',
          slots: deriveLegacySlotsFromStacks(pocketStacks),
          pocketStacks,
        };
      })
      .filter((s): s is EditableBinderSheet => s !== null);

    return validSheets.length > 0 ? validSheets : fallback;
  } catch {
    return fallback;
  }
}

function loadInitialPosterState(): SavedPosterState {
  const initialSlots = buildDefaultCuratedSlots();
  const initialStacks = stacksFromSingleSlotIds(initialSlots);
  const fallback: SavedPosterState = {
    title: 'KOLEKSI ELIT GALAXY',
    subtitle: 'Album Poster 3x3 · Edisi Pilihan Kolektor',
    collectorName: 'Kolektor Monsta',
    theme: 'BLAZING_FROST',
    showCardCaptions: true,
    showStatsFooter: true,
    slots: initialSlots,
    pocketStacks: initialStacks,
  };

  try {
    const raw = localStorage.getItem(POSTER_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SavedPosterState>;
    const pocketStacks =
      Array.isArray(parsed.pocketStacks) || Array.isArray(parsed.slots)
        ? normalizeNineStacks(parsed.pocketStacks, parsed.slots)
        : fallback.pocketStacks;

    const validTheme =
      parsed.theme && parsed.theme in POSTER_THEMES ? parsed.theme : fallback.theme;

    return {
      title: typeof parsed.title === 'string' ? parsed.title : fallback.title,
      subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : fallback.subtitle,
      collectorName:
        typeof parsed.collectorName === 'string' ? parsed.collectorName : fallback.collectorName,
      theme: validTheme,
      showCardCaptions:
        typeof parsed.showCardCaptions === 'boolean'
          ? parsed.showCardCaptions
          : fallback.showCardCaptions,
      showStatsFooter:
        typeof parsed.showStatsFooter === 'boolean'
          ? parsed.showStatsFooter
          : fallback.showStatsFooter,
      slots: deriveLegacySlotsFromStacks(pocketStacks),
      pocketStacks,
    };
  } catch {
    return fallback;
  }
}

function sanitizeFilename(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'album-poster-3x3';
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawFallbackHologramOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  finish: HologramFinish
): void {
  if (finish === 'NONE') return;

  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  if (finish === 'SOLAR_GOLD') {
    grad.addColorStop(0, 'rgba(251, 191, 36, 0.24)');
    grad.addColorStop(0.5, 'rgba(255, 251, 235, 0.28)');
    grad.addColorStop(1, 'rgba(245, 158, 11, 0.22)');
  } else if (finish === 'CRYO_FROST') {
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
    grad.addColorStop(0.5, 'rgba(224, 242, 254, 0.28)');
    grad.addColorStop(1, 'rgba(99, 102, 241, 0.20)');
  } else if (finish === 'STARDUST_GALAXY') {
    grad.addColorStop(0, 'rgba(232, 121, 249, 0.25)');
    grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.22)');
    grad.addColorStop(1, 'rgba(251, 191, 36, 0.22)');
  } else {
    grad.addColorStop(0, 'rgba(251, 113, 133, 0.22)');
    grad.addColorStop(0.35, 'rgba(250, 204, 21, 0.22)');
    grad.addColorStop(0.68, 'rgba(52, 211, 153, 0.22)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.24)');
  }

  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  const starPositions = [
    { cx: x + w * 0.18, cy: y + h * 0.16, r: 7 },
    { cx: x + w * 0.82, cy: y + h * 0.26, r: 6 },
    { cx: x + w * 0.78, cy: y + h * 0.82, r: 7 },
  ];
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  starPositions.forEach(({ cx, cy, r }) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.28, cy - r * 0.28);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx + r * 0.28, cy + r * 0.28);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.28, cy + r * 0.28);
    ctx.lineTo(cx - r, cy);
    ctx.lineTo(cx - r * 0.28, cy - r * 0.28);
    ctx.closePath();
    ctx.fill();
  });
}

async function renderFallbackPosterCanvas(params: {
  cards: (CardDefinition | null)[];
  title: string;
  subtitle: string;
  collectorName: string;
  editionMeta: string;
  footerSummary: string;
  themeStyle: PosterThemeStyle;
  showCardCaptions: boolean;
  showStatsFooter: boolean;
  scale: ExportScale;
}): Promise<HTMLCanvasElement> {
  const baseW = 900;
  const baseH = params.showCardCaptions ? 1320 : 1220;
  const canvas = document.createElement('canvas');
  canvas.width = baseW * params.scale;
  canvas.height = baseH * params.scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(params.scale, params.scale);

  ctx.fillStyle = params.themeStyle.canvasBgHex;
  ctx.fillRect(0, 0, baseW, baseH);

  ctx.strokeStyle = params.themeStyle.canvasFrameHex;
  ctx.lineWidth = 3;
  drawRoundedRectPath(ctx, 22, 22, baseW - 44, baseH - 44, 24);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = params.themeStyle.canvasAccentHex;
  ctx.font = '700 16px monospace';
  ctx.fillText(params.editionMeta.toUpperCase(), baseW / 2, 74);

  ctx.fillStyle = params.themeStyle.canvasTitleHex;
  ctx.font = '800 38px sans-serif';
  ctx.fillText(params.title || 'ALBUM POSTER 3X3', baseW / 2, 122);

  if (params.subtitle) {
    ctx.fillStyle = params.themeStyle.canvasSubHex;
    ctx.font = '500 19px sans-serif';
    ctx.fillText(params.subtitle, baseW / 2, 154);
  }

  const marginX = 58;
  const gapX = 24;
  const gapY = params.showCardCaptions ? 46 : 24;
  const gridTop = 190;
  const cardW = (baseW - marginX * 2 - gapX * 2) / 3;
  const cardH = (cardW * 7) / 5;

  const loadedImages = await Promise.all(
    params.cards.map((c) => (c ? loadImageElement(c.image) : Promise.resolve(null)))
  );

  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = marginX + col * (cardW + gapX);
    const y = gridTop + row * (cardH + gapY);
    const card = params.cards[i];
    const img = loadedImages[i];
    const holoFinish = resolveCardHologramFinish(card);

    ctx.save();
    drawRoundedRectPath(ctx, x, y, cardW, cardH, 16);
    ctx.fillStyle = '#090F1E';
    ctx.fill();
    ctx.clip();

    if (card && img) {
      const imgRatio = img.width / Math.max(1, img.height);
      const slotRatio = cardW / cardH;
      let drawW = cardW;
      let drawH = cardH;
      let drawX = x;
      let drawY = y;

      if (imgRatio > slotRatio) {
        drawW = cardH * imgRatio;
        drawX = x - (drawW - cardW) / 2;
      } else {
        drawH = cardW / Math.max(0.01, imgRatio);
        drawY = y - (drawH - cardH) / 2;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      if (holoFinish !== 'NONE') {
        drawFallbackHologramOverlay(ctx, x, y, cardW, cardH, holoFinish);
      }
    } else {
      ctx.fillStyle = params.themeStyle.canvasSubHex;
      ctx.font = '600 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`SLOT 0${i + 1}`, x + cardW / 2, y + cardH / 2);
    }
    ctx.restore();

    ctx.strokeStyle = holoFinish !== 'NONE' ? '#FBBF24' : params.themeStyle.canvasFrameHex;
    ctx.lineWidth = holoFinish !== 'NONE' ? 2.2 : 1.5;
    drawRoundedRectPath(ctx, x, y, cardW, cardH, 16);
    ctx.stroke();

    if (params.showCardCaptions && card) {
      ctx.textAlign = 'center';
      ctx.fillStyle = params.themeStyle.canvasTitleHex;
      ctx.font = '700 15px sans-serif';
      ctx.fillText(card.name.slice(0, 24), x + cardW / 2, y + cardH + 22);
    }
  }

  if (params.showStatsFooter) {
    ctx.textAlign = 'center';
    ctx.fillStyle = params.themeStyle.canvasSubHex;
    ctx.font = '600 15px monospace';
    ctx.fillText(
      `${params.footerSummary} · Kolektor: ${params.collectorName || 'Pemain'}`,
      baseW / 2,
      baseH - 48
    );
  }

  return canvas;
}

export interface PosterAlbum3x3Props {
  cardsVersion: number;
  savedDecks?: SavedUserDeck[];
  activeDeckId?: string;
  onInspectCard: (card: CardDefinition) => void;
  onEditCard?: (card: CardDefinition) => void;
  onOpenCreateCard?: () => void;
  onOpenGallery?: () => void;
  onCardsMutated?: () => void;
}

export const PosterAlbum3x3: React.FC<PosterAlbum3x3Props> = ({
  cardsVersion,
  savedDecks = [],
  activeDeckId,
  onInspectCard,
  onOpenCreateCard,
  onOpenGallery,
  onCardsMutated,
}) => {
  const [posterState, setPosterState] = useState<SavedPosterState>(() => loadInitialPosterState());
  const [binderSheets, setBinderSheets] = useState<EditableBinderSheet[]>(() =>
    loadInitialBinderSheets()
  );
  const [albumMode, setAlbumMode] = useState<AlbumMode>('CUSTOM_POSTER');
  const [binderPage, setBinderPage] = useState<number>(0);
  const [isBinderEditMode, setIsBinderEditMode] = useState<boolean>(true);
  const [binderFillSource, setBinderFillSource] = useState<string>('HOLOGRAM');
  const [confirmDeleteSheet, setConfirmDeleteSheet] = useState<boolean>(false);
  const [confirmRebuildBinder, setConfirmRebuildBinder] = useState<boolean>(false);

  // Targeted Slot Overwrite & Multi-Card Pocket Stack State ("Fitur Timpa & Gonta-Ganti Kartu Tertentu")
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);
  const [slotAssignMode, setSlotAssignMode] = useState<SlotAssignMode>('OVERWRITE');
  const [keepTargetSlot, setKeepTargetSlot] = useState<boolean>(true);

  const [swapSourceIdx, setSwapSourceIdx] = useState<number | null>(null);
  const [draggedSlotIdx, setDraggedSlotIdx] = useState<number | null>(null);
  const [draggedCatalogCardId, setDraggedCatalogCardId] = useState<string | null>(null);
  const [dragOverSlotIdx, setDragOverSlotIdx] = useState<number | null>(null);

  // Smooth Layout Fading & Per-Slot Crossfade Choreography State
  const [isSheetFadingOut, setIsSheetFadingOut] = useState<boolean>(false);
  const [sheetWaveKey, setSheetWaveKey] = useState<number>(1);
  const [slotSwapTicks, setSlotSwapTicks] = useState<number[]>(() =>
    Array.from({ length: 9 }, () => 0)
  );
  const pendingTransitionRef = useRef<{ timerId: number; commit: () => void } | null>(null);

  // Card Picker Catalog Filter State
  const [pickerPack, setPickerPack] = useState<string>('ALL');
  const [pickerCategory, setPickerCategory] = useState<PickerCategoryFilter>('ALL');
  const [pickerQuery, setPickerQuery] = useState<string>('');

  // Export State
  const [exportScale, setExportScale] = useState<ExportScale>(2);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [logoError, setLogoError] = useState<boolean>(false);

  const posterRef = useRef<HTMLDivElement | null>(null);
  const catalogSectionRef = useRef<HTMLDivElement | null>(null);

  const flushPendingTransition = useCallback(() => {
    if (pendingTransitionRef.current) {
      window.clearTimeout(pendingTransitionRef.current.timerId);
      const pendingCommit = pendingTransitionRef.current.commit;
      pendingTransitionRef.current = null;
      pendingCommit();
      setSlotSwapTicks(Array.from({ length: 9 }, () => 0));
      setIsSheetFadingOut(false);
      setSheetWaveKey((k) => k + 1);
    }
  }, []);

  const runWithPosterFade = useCallback((commitFn: () => void) => {
    if (pendingTransitionRef.current) {
      window.clearTimeout(pendingTransitionRef.current.timerId);
      const prevCommit = pendingTransitionRef.current.commit;
      pendingTransitionRef.current = null;
      prevCommit();
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    if (prefersReducedMotion) {
      commitFn();
      setSlotSwapTicks(Array.from({ length: 9 }, () => 0));
      setIsSheetFadingOut(false);
      setSheetWaveKey((k) => k + 1);
      return;
    }

    setIsSheetFadingOut(true);
    const timerId = window.setTimeout(() => {
      pendingTransitionRef.current = null;
      commitFn();
      setSlotSwapTicks(Array.from({ length: 9 }, () => 0));
      setIsSheetFadingOut(false);
      setSheetWaveKey((k) => k + 1);
    }, 135);

    pendingTransitionRef.current = { timerId, commit: commitFn };
  }, []);

  useEffect(() => {
    return () => {
      if (pendingTransitionRef.current) {
        window.clearTimeout(pendingTransitionRef.current.timerId);
      }
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(POSTER_STORAGE_KEY, JSON.stringify(posterState));
    } catch {
      // Ignore storage quota errors
    }
  }, [posterState]);

  useEffect(() => {
    try {
      localStorage.setItem(BINDER_BOOK_STORAGE_KEY, JSON.stringify(binderSheets));
    } catch {
      // Ignore storage quota errors
    }
  }, [binderSheets]);

  const totalBinderPages = Math.max(1, binderSheets.length);
  const safeBinderPage = Math.min(binderPage, totalBinderPages - 1);

  useEffect(() => {
    if (binderPage !== safeBinderPage) {
      setBinderPage(safeBinderPage);
    }
  }, [binderPage, safeBinderPage]);

  useEffect(() => {
    setConfirmDeleteSheet(false);
    setConfirmRebuildBinder(false);
  }, [safeBinderPage, albumMode]);

  const activeBinderSheet: EditableBinderSheet = useMemo(() => {
    const found = binderSheets[safeBinderPage];
    if (found) return found;
    const emptyStacks = normalizeNineStacks(null);
    return {
      id: 'binder-fallback',
      title: 'LEMBAR KOLEKSI 01',
      subtitle: 'Kantong Koleksi 3×3',
      slots: deriveLegacySlotsFromStacks(emptyStacks),
      pocketStacks: emptyStacks,
    };
  }, [binderSheets, safeBinderPage]);

  const activePocketStacks: PocketStack[] =
    albumMode === 'COLLECTION_BINDER' ? activeBinderSheet.pocketStacks : posterState.pocketStacks;

  const activeSheetSlots = useMemo(
    () => deriveLegacySlotsFromStacks(activePocketStacks),
    [activePocketStacks]
  );

  const isSlotInteractive =
    albumMode === 'CUSTOM_POSTER' || (albumMode === 'COLLECTION_BINDER' && isBinderEditMode);

  // Resolve the 9 active top cards currently displayed on the Poster / Binder Sheet
  const displayedCards = useMemo<(CardDefinition | null)[]>(() => {
    void cardsVersion;
    return activeSheetSlots.map((id) => (id ? CARD_BY_ID[id] ?? null : null));
  }, [activeSheetSlots, cardsVersion]);

  const selectedSlotStack: PocketStack = activePocketStacks[activeSlotIdx] ?? {
    cardIds: [],
    activeIndex: 0,
    locked: false,
  };

  const selectedSlotStackCards = useMemo<CardDefinition[]>(() => {
    void cardsVersion;
    return selectedSlotStack.cardIds
      .map((id) => CARD_BY_ID[id])
      .filter((c): c is CardDefinition => Boolean(c));
  }, [selectedSlotStack.cardIds, cardsVersion]);

  // Suggest related character variants for 1-click pocket stacking ("+ Tumpuk Varian Sebaris")
  const suggestedVariantCards = useMemo<CardDefinition[]>(() => {
    void cardsVersion;
    const topId = getActiveCardIdFromStack(selectedSlotStack);
    const topCard = topId ? CARD_BY_ID[topId] : null;
    if (!topCard) return [];

    const existingSet = new Set(selectedSlotStack.cardIds);
    const primaryTag = topCard.characterTags[0]?.toLowerCase() ?? '';
    const firstWord = topCard.name.split(/\s+/)[0]?.toLowerCase() ?? '';

    return ALL_CARDS.filter((c) => {
      if (existingSet.has(c.id)) return false;
      if (c.category !== topCard.category) return false;
      if (
        primaryTag &&
        c.characterTags.some((t) => t.toLowerCase() === primaryTag)
      ) {
        return true;
      }
      if (firstWord.length >= 4 && c.name.toLowerCase().includes(firstWord)) {
        return true;
      }
      return false;
    }).slice(0, 4);
  }, [selectedSlotStack, cardsVersion]);

  const hologramTotalInCatalog = useMemo(() => {
    void cardsVersion;
    return ALL_CARDS.filter((c) => isCardHolographic(c)).length;
  }, [cardsVersion]);

  // Filtered Catalog for Right-Hand Picker
  const catalogCards = useMemo(() => {
    void cardsVersion;
    return ALL_CARDS.filter((card) => {
      if (pickerPack !== 'ALL' && !cardBelongsToPackSeries(card, pickerPack)) return false;
      if (pickerCategory === 'HOLOGRAM') {
        if (!isCardHolographic(card)) return false;
      } else if (pickerCategory !== 'ALL' && card.category !== pickerCategory) {
        return false;
      }
      if (pickerQuery.trim()) {
        const q = pickerQuery.toLowerCase();
        return (
          card.name.toLowerCase().includes(q) ||
          card.numberLabel.toLowerCase().includes(q) ||
          card.rank.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [pickerPack, pickerCategory, pickerQuery, cardsVersion]);

  // Quantitative Poster / Binder Stats
  const posterMetrics = useMemo(() => {
    void cardsVersion;
    const filled = displayedCards.filter((c): c is CardDefinition => c !== null);
    const totalHp = filled.reduce((acc, c) => acc + c.hp, 0);
    const totalAtk = filled.reduce((acc, c) => acc + c.atk, 0);
    const srCount = filled.filter(
      (c) => c.rank === 'SR' || c.rank === 'AR' || c.rank === 'S'
    ).length;
    const holoCount = filled.filter((c) => isCardHolographic(c)).length;
    const totalStackedCards = activePocketStacks.reduce(
      (sum, st) => sum + st.cardIds.length,
      0
    );
    const lockedCount = activePocketStacks.filter((st) => st.locked).length;

    const seriesNames = Array.from(
      new Set(filled.map((c) => getPrimaryPackSeriesForCard(c).codePrefix))
    );

    return {
      filledCount: filled.length,
      totalStackedCards,
      lockedCount,
      totalHp,
      totalAtk,
      srCount,
      holoCount,
      seriesLabel: seriesNames.length > 0 ? seriesNames.slice(0, 3).join(' / ') : 'MGC',
    };
  }, [displayedCards, activePocketStacks, cardsVersion]);

  const themeStyle = POSTER_THEMES[posterState.theme];

  const bumpSlotTicks = useCallback((indices: number[]) => {
    setSlotSwapTicks((prev) => {
      const next = [...prev];
      indices.forEach((idx) => {
        if (idx >= 0 && idx < 9) {
          next[idx] = (next[idx] ?? 0) + 1;
        }
      });
      return next;
    });
  }, []);

  const mutateActiveSheetStacks = useCallback(
    (updater: (stacks: PocketStack[]) => PocketStack[]) => {
      if (albumMode === 'COLLECTION_BINDER') {
        setBinderSheets((prev) =>
          prev.map((sheet, idx) => {
            if (idx !== safeBinderPage) return sheet;
            const nextStacks = updater(sheet.pocketStacks);
            return {
              ...sheet,
              pocketStacks: nextStacks,
              slots: deriveLegacySlotsFromStacks(nextStacks),
            };
          })
        );
      } else {
        setPosterState((prev) => {
          const nextStacks = updater(prev.pocketStacks);
          return {
            ...prev,
            pocketStacks: nextStacks,
            slots: deriveLegacySlotsFromStacks(nextStacks),
          };
        });
      }
    },
    [albumMode, safeBinderPage]
  );

  const updateActiveBinderSheet = useCallback(
    (updater: (sheet: EditableBinderSheet) => EditableBinderSheet) => {
      setBinderSheets((prev) =>
        prev.map((sheet, idx) => (idx === safeBinderPage ? updater(sheet) : sheet))
      );
    },
    [safeBinderPage]
  );

  // =========================================================================
  // FITUR TIMPA & GONTA-GANTI KARTU TERTENTU HANDLERS
  // =========================================================================
  const handleAssignCardToSlot = useCallback(
    (cardId: string, targetSlot?: number, forcedMode?: SlotAssignMode) => {
      soundFx.playCardSelect();
      const idx = targetSlot ?? activeSlotIdx;
      const effectiveMode = forcedMode ?? slotAssignMode;

      if (albumMode === 'COLLECTION_BINDER' && !isBinderEditMode) {
        setIsBinderEditMode(true);
      }

      mutateActiveSheetStacks((prevStacks) => {
        const next = prevStacks.map((st) => ({
          cardIds: [...st.cardIds],
          activeIndex: st.activeIndex,
          locked: st.locked,
        }));
        const current = next[idx] ?? { cardIds: [], activeIndex: 0, locked: false };

        if (effectiveMode === 'STACK_LAYER') {
          const existingPos = current.cardIds.indexOf(cardId);
          if (existingPos >= 0) {
            // Card already in this slot's stack -> bring/focus it to active!
            current.activeIndex = existingPos;
          } else if (current.cardIds.length < MAX_STACK_PER_SLOT) {
            current.cardIds.push(cardId);
            current.activeIndex = current.cardIds.length - 1;
          } else {
            // Replace top layer when stack is at max capacity (6)
            current.cardIds[current.activeIndex] = cardId;
          }
        } else {
          // OVERWRITE ('Timpa Kartu Aktif'):
          // If the slot has multiple stacked layers, overwrite the currently active layer cleanly;
          // if 0 or 1 card, set [cardId] directly!
          if (current.cardIds.length <= 1) {
            current.cardIds = [cardId];
            current.activeIndex = 0;
          } else {
            const safeIdx = Math.min(
              Math.max(0, current.activeIndex),
              current.cardIds.length - 1
            );
            current.cardIds[safeIdx] = cardId;
            current.activeIndex = safeIdx;
          }
        }

        next[idx] = current;
        return next;
      });

      bumpSlotTicks([idx]);
      setSwapSourceIdx(null);

      if (targetSlot !== undefined) {
        setActiveSlotIdx(targetSlot);
      } else if (!keepTargetSlot) {
        setActiveSlotIdx((idx + 1) % 9);
      }
    },
    [
      activeSlotIdx,
      albumMode,
      bumpSlotTicks,
      isBinderEditMode,
      keepTargetSlot,
      mutateActiveSheetStacks,
      slotAssignMode,
    ]
  );

  const handleCycleSlotStack = useCallback(
    (slotIdx: number, delta: -1 | 1) => {
      soundFx.playCardSelect();
      mutateActiveSheetStacks((prevStacks) => {
        const next = [...prevStacks];
        const target = next[slotIdx];
        if (!target || target.cardIds.length <= 1) return prevStacks;
        const len = target.cardIds.length;
        const nextActive = (target.activeIndex + delta + len) % len;
        next[slotIdx] = {
          ...target,
          activeIndex: nextActive,
        };
        return next;
      });
      bumpSlotTicks([slotIdx]);
    },
    [bumpSlotTicks, mutateActiveSheetStacks]
  );

  const handleSelectStackLayer = useCallback(
    (slotIdx: number, layerIdx: number) => {
      soundFx.playCardSelect();
      mutateActiveSheetStacks((prevStacks) => {
        const next = [...prevStacks];
        const target = next[slotIdx];
        if (!target || layerIdx < 0 || layerIdx >= target.cardIds.length) return prevStacks;
        next[slotIdx] = {
          ...target,
          activeIndex: layerIdx,
        };
        return next;
      });
      bumpSlotTicks([slotIdx]);
    },
    [bumpSlotTicks, mutateActiveSheetStacks]
  );

  const handleRemoveStackLayer = useCallback(
    (slotIdx: number, layerIdx: number) => {
      soundFx.playCardSelect();
      mutateActiveSheetStacks((prevStacks) => {
        const next = [...prevStacks];
        const target = next[slotIdx];
        if (!target || layerIdx < 0 || layerIdx >= target.cardIds.length) return prevStacks;
        const nextIds = target.cardIds.filter((_, i) => i !== layerIdx);
        const nextActive =
          nextIds.length === 0 ? 0 : Math.min(target.activeIndex, nextIds.length - 1);
        next[slotIdx] = {
          ...target,
          cardIds: nextIds,
          activeIndex: nextActive,
        };
        return next;
      });
      bumpSlotTicks([slotIdx]);
    },
    [bumpSlotTicks, mutateActiveSheetStacks]
  );

  const handleToggleLockSlot = useCallback(
    (slotIdx: number) => {
      soundFx.playCardSelect();
      mutateActiveSheetStacks((prevStacks) => {
        const next = [...prevStacks];
        const target = next[slotIdx] ?? { cardIds: [], activeIndex: 0, locked: false };
        next[slotIdx] = {
          ...target,
          locked: !target.locked,
        };
        return next;
      });
    },
    [mutateActiveSheetStacks]
  );

  const handleRandomizeUnlockedSlots = useCallback(() => {
    soundFx.playCardDeploy();
    const pool = [...ALL_CARDS].filter((c) => c.category !== CardCategory.SUIT);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const changedIndices: number[] = [];
    let cursor = 0;

    mutateActiveSheetStacks((prevStacks) =>
      prevStacks.map((st, idx) => {
        if (st.locked) return st;
        changedIndices.push(idx);
        const picked = pool[cursor % Math.max(1, pool.length)];
        cursor += 1;
        return {
          cardIds: picked ? [picked.id] : [],
          activeIndex: 0,
          locked: false,
        };
      })
    );

    if (changedIndices.length > 0) {
      bumpSlotTicks(changedIndices);
    }
  }, [bumpSlotTicks, mutateActiveSheetStacks]);

  const handleFocusSlotForOverwrite = useCallback((slotIdx: number) => {
    soundFx.playCardSelect();
    setActiveSlotIdx(slotIdx);
    setKeepTargetSlot(true);
    setSwapSourceIdx(null);
    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const handleSwapSlots = useCallback(
    (idxA: number, idxB: number) => {
      if (idxA === idxB) return;
      soundFx.playCardDeploy();

      mutateActiveSheetStacks((prevStacks) => {
        const next = [...prevStacks];
        [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
        return next;
      });

      bumpSlotTicks([idxA, idxB]);
      setActiveSlotIdx(idxB);
      setSwapSourceIdx(null);
    },
    [bumpSlotTicks, mutateActiveSheetStacks]
  );

  const handleClearSlot = useCallback(
    (idx: number, clearEntireStack = false) => {
      soundFx.playCardSelect();
      mutateActiveSheetStacks((prevStacks) => {
        const next = [...prevStacks];
        const current = next[idx];
        if (!current) return prevStacks;

        if (!clearEntireStack && current.cardIds.length > 1) {
          // Remove only the top active card so the card stacked underneath appears!
          const nextIds = current.cardIds.filter((_, i) => i !== current.activeIndex);
          next[idx] = {
            ...current,
            cardIds: nextIds,
            activeIndex: Math.min(current.activeIndex, Math.max(0, nextIds.length - 1)),
          };
        } else {
          next[idx] = {
            cardIds: [],
            activeIndex: 0,
            locked: false,
          };
        }
        return next;
      });
      bumpSlotTicks([idx]);
    },
    [bumpSlotTicks, mutateActiveSheetStacks]
  );

  const handleCycleCardHoloInSlot = useCallback(
    (cardId: string, slotIdx: number) => {
      soundFx.playCardSelect();
      const result = cycleCardHologramFinish(cardId);
      if (result.ok) {
        onCardsMutated?.();
        bumpSlotTicks([slotIdx]);
      }
    },
    [bumpSlotTicks, onCardsMutated]
  );

  // =========================================================================
  // BINDER SHEET MANAGEMENT HANDLERS (EDIT LEMBAR BINDER KOLEKSI)
  // =========================================================================
  const handleAddBinderSheet = () => {
    soundFx.playCardDeploy();
    const nextNumber = String(binderSheets.length + 1).padStart(2, '0');
    const emptyStacks = normalizeNineStacks(null);
    const newSheet: EditableBinderSheet = {
      id: createSheetId(),
      title: `LEMBAR KOLEKSI ${nextNumber}`,
      subtitle: 'Susunan Kantong Kustom 3×3',
      slots: deriveLegacySlotsFromStacks(emptyStacks),
      pocketStacks: emptyStacks,
    };
    const nextIndex = binderSheets.length;
    runWithPosterFade(() => {
      setBinderSheets((prev) => [...prev, newSheet]);
      setBinderPage(nextIndex);
      setIsBinderEditMode(true);
      setActiveSlotIdx(0);
      setSwapSourceIdx(null);
    });
  };

  const handleDuplicateBinderSheet = () => {
    soundFx.playCardDeploy();
    const clonedStacks = activeBinderSheet.pocketStacks.map((st) => ({
      cardIds: [...st.cardIds],
      activeIndex: st.activeIndex,
      locked: st.locked,
    }));
    const copy: EditableBinderSheet = {
      id: createSheetId(),
      title: `${activeBinderSheet.title} (SALINAN)`.slice(0, 42),
      subtitle: activeBinderSheet.subtitle,
      slots: deriveLegacySlotsFromStacks(clonedStacks),
      pocketStacks: clonedStacks,
    };
    const insertIdx = safeBinderPage + 1;
    runWithPosterFade(() => {
      setBinderSheets((prev) => {
        const next = [...prev];
        next.splice(insertIdx, 0, copy);
        return next;
      });
      setBinderPage(insertIdx);
      setSwapSourceIdx(null);
    });
  };

  const handleMoveBinderSheet = (direction: -1 | 1) => {
    const targetIdx = safeBinderPage + direction;
    if (targetIdx < 0 || targetIdx >= binderSheets.length) return;
    soundFx.playCardSelect();
    runWithPosterFade(() => {
      setBinderSheets((prev) => {
        const next = [...prev];
        [next[safeBinderPage], next[targetIdx]] = [next[targetIdx], next[safeBinderPage]];
        return next;
      });
      setBinderPage(targetIdx);
      setSwapSourceIdx(null);
    });
  };

  const handleDeleteActiveBinderSheet = () => {
    if (binderSheets.length <= 1) return;
    soundFx.playCardSelect();
    const nextPage = Math.max(0, safeBinderPage - 1);
    runWithPosterFade(() => {
      setBinderSheets((prev) => prev.filter((_, idx) => idx !== safeBinderPage));
      setBinderPage(nextPage);
      setConfirmDeleteSheet(false);
      setSwapSourceIdx(null);
    });
  };

  const handleSortCurrentSheetByRank = () => {
    soundFx.playCardDeploy();
    runWithPosterFade(() => {
      setSwapSourceIdx(null);
      mutateActiveSheetStacks((prevStacks) => {
        const unlockedStacks = prevStacks
          .filter((st) => !st.locked && st.cardIds.length > 0)
          .sort((a, b) => {
            const cardA = CARD_BY_ID[getActiveCardIdFromStack(a) ?? ''];
            const cardB = CARD_BY_ID[getActiveCardIdFromStack(b) ?? ''];
            if (!cardA || !cardB) return 0;
            const rankDiff =
              (RANK_SORT_WEIGHT[cardB.rank] ?? 0) - (RANK_SORT_WEIGHT[cardA.rank] ?? 0);
            if (rankDiff !== 0) return rankDiff;
            return cardB.atk + cardB.hp - (cardA.atk + cardA.hp);
          });

        let cursor = 0;
        return prevStacks.map((st) => {
          if (st.locked) return st;
          const nextSt = unlockedStacks[cursor];
          cursor += 1;
          return nextSt ?? { cardIds: [], activeIndex: 0, locked: false };
        });
      });
    });
  };

  const handleFillBinderSheetFromSource = () => {
    soundFx.playCardDeploy();
    runWithPosterFade(() => {
      setSwapSourceIdx(null);
      setActiveSlotIdx(0);

      if (binderFillSource === 'HOLOGRAM') {
        const holoCards = ALL_CARDS.filter((c) => isCardHolographic(c)).sort((a, b) => {
          const rw = (RANK_SORT_WEIGHT[b.rank] ?? 0) - (RANK_SORT_WEIGHT[a.rank] ?? 0);
          if (rw !== 0) return rw;
          return b.hp + b.atk - (a.hp + a.atk);
        });
        const nextSlots = Array.from({ length: 9 }, (_, i) => holoCards[i]?.id ?? null);
        updateActiveBinderSheet((sheet) => {
          const nextStacks = stacksFromSingleSlotIds(nextSlots, sheet.pocketStacks);
          return {
            ...sheet,
            title: 'KOLEKSI KARTU HOLOGRAM',
            subtitle: '9 Kartu Foil Hologram Pilihan dalam Kantong Binder',
            slots: deriveLegacySlotsFromStacks(nextStacks),
            pocketStacks: nextStacks,
          };
        });
        return;
      }

      if (binderFillSource === 'ACTIVE_DECK') {
        const activeDeck =
          savedDecks.find((d) => d.id === activeDeckId) ?? savedDecks[0] ?? null;
        const deckSourceIds = activeDeck
          ? activeDeck.cardIds
          : ALL_CARDS.slice(0, 9).map((c) => c.id);
        const nextSlots = Array.from({ length: 9 }, (_, i) => deckSourceIds[i] ?? null);
        updateActiveBinderSheet((sheet) => {
          const nextStacks = stacksFromSingleSlotIds(nextSlots, sheet.pocketStacks);
          return {
            ...sheet,
            title: activeDeck ? activeDeck.name.toUpperCase().slice(0, 42) : 'LEMBAR DEK UTAMA',
            subtitle: '9 Kartu Inti dari Susunan Dek Pertarungan',
            slots: deriveLegacySlotsFromStacks(nextStacks),
            pocketStacks: nextStacks,
          };
        });
        return;
      }

      const pack = ALL_PACK_SERIES.find((p) => p.id === binderFillSource);
      const packCards = ALL_CARDS.filter((c) => cardBelongsToPackSeries(c, binderFillSource));
      const nextSlots = Array.from({ length: 9 }, (_, i) => packCards[i]?.id ?? null);
      updateActiveBinderSheet((sheet) => {
        const nextStacks = stacksFromSingleSlotIds(nextSlots, sheet.pocketStacks);
        return {
          ...sheet,
          title: pack ? pack.name.toUpperCase().slice(0, 42) : sheet.title,
          subtitle: pack ? `Seri ${pack.codePrefix} · 9 Kantong Pilihan` : sheet.subtitle,
          slots: deriveLegacySlotsFromStacks(nextStacks),
          pocketStacks: nextStacks,
        };
      });
    });
  };

  const handleClearActiveBinderSheet = () => {
    soundFx.playCardSelect();
    runWithPosterFade(() => {
      setSwapSourceIdx(null);
      setActiveSlotIdx(0);
      updateActiveBinderSheet((sheet) => {
        const nextStacks = sheet.pocketStacks.map((st) =>
          st.locked ? st : { cardIds: [], activeIndex: 0, locked: false }
        );
        return {
          ...sheet,
          slots: deriveLegacySlotsFromStacks(nextStacks),
          pocketStacks: nextStacks,
        };
      });
    });
  };

  const handleRebuildBinderFromCatalog = () => {
    soundFx.playCardDeploy();
    runWithPosterFade(() => {
      setBinderSheets(buildDefaultBinderSheetsFromCollection());
      setBinderPage(0);
      setActiveSlotIdx(0);
      setSwapSourceIdx(null);
      setConfirmRebuildBinder(false);
    });
  };

  const handleApplyPreset = (
    preset:
      | 'TOP_RANK'
      | 'HOLOGRAM_SHOWCASE'
      | 'BOBOIBOY_ELEMENTS'
      | 'ACTIVE_DECK'
      | 'SORT_CURRENT'
      | 'SHUFFLE_9'
      | 'CLEAR_ALL'
  ) => {
    if (preset === 'SORT_CURRENT') {
      handleSortCurrentSheetByRank();
      return;
    }

    if (preset === 'SHUFFLE_9') {
      handleRandomizeUnlockedSlots();
      return;
    }

    soundFx.playCardDeploy();
    runWithPosterFade(() => {
      setAlbumMode('CUSTOM_POSTER');
      setSwapSourceIdx(null);

      if (preset === 'CLEAR_ALL') {
        setPosterState((prev) => {
          const nextStacks = prev.pocketStacks.map((st) =>
            st.locked ? st : { cardIds: [], activeIndex: 0, locked: false }
          );
          return {
            ...prev,
            slots: deriveLegacySlotsFromStacks(nextStacks),
            pocketStacks: nextStacks,
          };
        });
        setActiveSlotIdx(0);
        return;
      }

      if (preset === 'HOLOGRAM_SHOWCASE') {
        const holoPool = ALL_CARDS.filter((c) => isCardHolographic(c)).sort((a, b) => {
          const rw = (RANK_SORT_WEIGHT[b.rank] ?? 0) - (RANK_SORT_WEIGHT[a.rank] ?? 0);
          if (rw !== 0) return rw;
          return b.hp + b.atk - (a.hp + a.atk);
        });
        const slots = Array.from({ length: 9 }, (_, i) => holoPool[i]?.id ?? null);
        setPosterState((prev) => {
          const nextStacks = stacksFromSingleSlotIds(slots, prev.pocketStacks);
          return {
            ...prev,
            title: 'PAMERAN FOIL HOLOGRAM',
            subtitle: '9 Kartu Edisi Hologram Berkilau · Koleksi Khusus',
            slots: deriveLegacySlotsFromStacks(nextStacks),
            pocketStacks: nextStacks,
          };
        });
        return;
      }

      if (preset === 'TOP_RANK') {
        const slots = buildDefaultCuratedSlots();
        setPosterState((prev) => {
          const nextStacks = stacksFromSingleSlotIds(slots, prev.pocketStacks);
          return {
            ...prev,
            title: 'KOLEKSI ELIT GALAXY',
            subtitle: '9 Kartu Karakter Terkuat · Edisi Pilihan',
            slots: deriveLegacySlotsFromStacks(nextStacks),
            pocketStacks: nextStacks,
          };
        });
        return;
      }

      if (preset === 'BOBOIBOY_ELEMENTS') {
        const bbbCards = ALL_CARDS.filter(
          (c) =>
            c.category === CardCategory.CHARACTER &&
            (c.name.toLowerCase().includes('boboiboy') ||
              c.characterTags.some((t) => t.toLowerCase().includes('boboiboy')))
        );
        const chosen = bbbCards.slice(0, 9).map((c) => c.id);
        while (chosen.length < 9) chosen.push(ALL_CARDS[chosen.length]?.id ?? '');
        const slots = chosen.map((id) => id || null);
        setPosterState((prev) => {
          const nextStacks = stacksFromSingleSlotIds(slots, prev.pocketStacks);
          return {
            ...prev,
            title: 'SKUAD KUASA ELEMENTAL',
            subtitle: 'Formasi 3x3 BoBoiBoy Galaxy Pilihan',
            slots: deriveLegacySlotsFromStacks(nextStacks),
            pocketStacks: nextStacks,
          };
        });
        return;
      }

      if (preset === 'ACTIVE_DECK') {
        const activeDeck =
          savedDecks.find((d) => d.id === activeDeckId) ?? savedDecks[0] ?? null;
        const deckSourceIds = activeDeck
          ? activeDeck.cardIds
          : ALL_CARDS.slice(0, 9).map((c) => c.id);
        const nextSlots = Array.from({ length: 9 }, (_, i) => deckSourceIds[i] ?? null);
        setPosterState((prev) => {
          const nextStacks = stacksFromSingleSlotIds(nextSlots, prev.pocketStacks);
          return {
            ...prev,
            title: activeDeck ? activeDeck.name.toUpperCase() : 'ANDALAN DEK UTAMA',
            subtitle: '9 Kartu Inti dari Susunan Dek Pertarungan',
            slots: deriveLegacySlotsFromStacks(nextStacks),
            pocketStacks: nextStacks,
          };
        });
      }
    });
  };

  const handleCopyBinderPageToCustom = () => {
    soundFx.playCardDeploy();
    const clonedStacks = activeBinderSheet.pocketStacks.map((st) => ({
      cardIds: [...st.cardIds],
      activeIndex: st.activeIndex,
      locked: st.locked,
    }));
    runWithPosterFade(() => {
      setPosterState((prev) => ({
        ...prev,
        title: activeBinderSheet.title.trim() || `ALBUM KOLEKSI · LEMBAR ${safeBinderPage + 1}`,
        subtitle:
          activeBinderSheet.subtitle.trim() ||
          `Salinan Lembar Binder ${safeBinderPage + 1} dari ${totalBinderPages}`,
        slots: deriveLegacySlotsFromStacks(clonedStacks),
        pocketStacks: clonedStacks,
      }));
      setAlbumMode('CUSTOM_POSTER');
    });
  };

  const editionMetaText =
    albumMode === 'COLLECTION_BINDER'
      ? `Lembar Binder ${safeBinderPage + 1}/${totalBinderPages} · Seri ${posterMetrics.seriesLabel}`
      : `Poster 3x3 · Seri ${posterMetrics.seriesLabel} · ${posterMetrics.filledCount}/9 Kartu`;

  const resolvedTitle =
    albumMode === 'COLLECTION_BINDER'
      ? activeBinderSheet.title.trim() || `LEMBAR KOLEKSI 0${safeBinderPage + 1}`
      : posterState.title.trim() || 'ALBUM POSTER 3X3';

  const resolvedSubtitle =
    albumMode === 'COLLECTION_BINDER'
      ? activeBinderSheet.subtitle.trim()
      : posterState.subtitle.trim();

  const footerStatsLine = `${posterMetrics.filledCount}/9 Slot (${posterMetrics.totalStackedCards} Kartu) · ${posterMetrics.holoCount} Hologram · Total HP ${posterMetrics.totalHp} · Total ATK ${posterMetrics.totalAtk}`;

  // Export Current 3x3 Poster / Binder Sheet View to PNG using html2canvas-pro
  const handleExportAsImage = async () => {
    const node = posterRef.current;
    if (!node || isExporting) return;

    flushPendingTransition();
    setIsExporting(true);
    setExportNotice(null);
    soundFx.playCardSelect();

    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready;
      }

      const imgs = Array.from(node.querySelectorAll('img'));
      await Promise.all(
        imgs.map(async (img) => {
          if (img.complete) return;
          try {
            await img.decode();
          } catch {
            // Ignore individual decode warnings
          }
        })
      );

      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(node, {
          scale: exportScale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: themeStyle.canvasBgHex,
          logging: false,
          ignoreElements: (el) => el.getAttribute('data-export-ignore') === 'true',
          onclone: (_doc, clonedPoster) => {
            const highlighted = clonedPoster.querySelectorAll('[data-slot-active="true"]');
            highlighted.forEach((slotEl) => {
              slotEl.classList.remove(
                'ring-2',
                'ring-amber-400',
                'ring-emerald-400',
                'ring-sky-400',
                'border-amber-400',
                'border-emerald-400',
                'border-sky-400'
              );
            });
            const animatedNodes = clonedPoster.querySelectorAll(
              '.poster-stage-fading-out, .animate-poster-slot-cascade, .animate-poster-slot-swap, .animate-poster-header-fade, .animate-poster-caption-fade, .holo-glaze-drift, .holo-star-twinkle'
            );
            animatedNodes.forEach((animEl) => {
              animEl.classList.remove(
                'poster-stage-fading-out',
                'animate-poster-slot-cascade',
                'animate-poster-slot-swap',
                'animate-poster-header-fade',
                'animate-poster-caption-fade',
                'holo-glaze-drift',
                'holo-star-twinkle'
              );
            });
          },
        });
      } catch {
        canvas = await renderFallbackPosterCanvas({
          cards: displayedCards,
          title: resolvedTitle,
          subtitle: resolvedSubtitle,
          collectorName: posterState.collectorName,
          editionMeta: editionMetaText,
          footerSummary: footerStatsLine,
          themeStyle,
          showCardCaptions: posterState.showCardCaptions,
          showStatsFooter: posterState.showStatsFooter,
          scale: exportScale,
        });
      }

      const fileSlug = sanitizeFilename(
        albumMode === 'COLLECTION_BINDER'
          ? `lembar-binder-${safeBinderPage + 1}-${resolvedTitle}`
          : resolvedTitle
      );
      const filename = `${fileSlug}.png`;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png', 1.0)
      );

      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      } else {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      soundFx.playRoundWin();
      setExportNotice({
        tone: 'success',
        text: `Tampilan 3×3 berhasil disimpan sebagai ${filename} (${canvas.width}×${canvas.height} px).`,
      });
    } catch {
      setExportNotice({
        tone: 'error',
        text: 'Gagal mengekspor gambar poster. Silakan coba kembali.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Studio Header & Primary Export Action */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-slate-800">
        <div>
          <div className="text-xs font-mono text-amber-400">
            Album 3×3 Interaktif · Fitur Timpa &amp; Tumpuk Kartu · Gonta-Ganti Kartu Tertentu
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-display font-extrabold text-white">
            Album Poster 3×3 &amp; Lembar Binder Koleksi
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Timpa langsung kartu pada slot tertentu, tumpuk hingga {MAX_STACK_PER_SLOT} varian kartu di dalam satu kantong lalu gonta-ganti kartu teratasnya kapan saja, dan kunci kartu favorit agar tidak ikut terganti.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onOpenGallery && (
            <button
              type="button"
              onClick={onOpenGallery}
              className="px-3.5 py-2.5 text-xs sm:text-sm font-semibold bg-[#131C31] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              Galeri &amp; Panggung 3D
            </button>
          )}

          {/* Export Resolution Selector */}
          <div className="flex items-center gap-1 p-1 bg-[#131C31] border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setExportScale(2)}
              className={`px-2.5 py-1.5 text-xs font-mono rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                exportScale === 2
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PNG HD (2x)
            </button>
            <button
              type="button"
              onClick={() => setExportScale(3)}
              className={`px-2.5 py-1.5 text-xs font-mono rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                exportScale === 3
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cetak (3x)
            </button>
          </div>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportAsImage}
            className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/60 text-slate-950 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 shadow-lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyiapkan PNG...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Ekspor sebagai Gambar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export Status Feedback */}
      {exportNotice && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm ${
            exportNotice.tone === 'success'
              ? 'bg-emerald-950/40 border-emerald-400/45 text-emerald-200'
              : 'bg-rose-950/40 border-rose-400/45 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {exportNotice.tone === 'success' && (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{exportNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            aria-label="Tutup pemberitahuan"
            className="w-7 h-7 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-300 flex items-center justify-center shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 12-Column Workspace: Left Poster Frame (7 cols) + Right Customization & Card Picker (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT 7 COLS: THE 3x3 POSTER / BINDER SHEET */}
        <div className="lg:col-span-7 space-y-4">
          {/* Mode Switcher & Quick Timpa Mode Bar Above Poster */}
          <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    if (albumMode === 'CUSTOM_POSTER') return;
                    soundFx.playCardSelect();
                    runWithPosterFade(() => {
                      setSwapSourceIdx(null);
                      setAlbumMode('CUSTOM_POSTER');
                    });
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    albumMode === 'CUSTOM_POSTER'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  <span>Susun Poster Kustom</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (albumMode === 'COLLECTION_BINDER') return;
                    soundFx.playCardSelect();
                    runWithPosterFade(() => {
                      setSwapSourceIdx(null);
                      setAlbumMode('COLLECTION_BINDER');
                    });
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    albumMode === 'COLLECTION_BINDER'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Lembar Binder Koleksi</span>
                </button>
              </div>

              {albumMode === 'COLLECTION_BINDER' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playCardSelect();
                        setIsBinderEditMode(true);
                      }}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                        isBinderEditMode
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit Kantong</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playCardSelect();
                        setSwapSourceIdx(null);
                        setIsBinderEditMode(false);
                      }}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                        !isBinderEditMode
                          ? 'bg-slate-700 text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Mode Baca</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                    <button
                      type="button"
                      disabled={safeBinderPage <= 0}
                      onClick={() => {
                        soundFx.playCardSelect();
                        runWithPosterFade(() => {
                          setSwapSourceIdx(null);
                          setBinderPage((p) => Math.max(0, p - 1));
                        });
                      }}
                      className="p-2 rounded-lg bg-[#0B1120] hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-slate-200 transition-colors"
                      aria-label="Lembar sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-slate-200 font-semibold px-1 whitespace-nowrap">
                      Lembar {safeBinderPage + 1} / {totalBinderPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeBinderPage >= totalBinderPages - 1}
                      onClick={() => {
                        soundFx.playCardSelect();
                        runWithPosterFade(() => {
                          setSwapSourceIdx(null);
                          setBinderPage((p) => Math.min(totalBinderPages - 1, p + 1));
                        });
                      }}
                      className="p-2 rounded-lg bg-[#0B1120] hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-slate-200 transition-colors"
                      aria-label="Lembar berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-mono text-slate-300 tabular-nums">
                  Target Timpa: <strong className="text-amber-300">Slot #0{activeSlotIdx + 1}</strong>
                  {selectedSlotStack.cardIds.length > 1
                    ? ` · Lapis ${selectedSlotStack.activeIndex + 1}/${selectedSlotStack.cardIds.length}`
                    : ''}
                  {swapSourceIdx !== null ? ' · Pilih slot tujuan tukar' : ''}
                </div>
              )}
            </div>

            {/* Quick Timpa Mode Bar (Visible whenever interactive editing is active) */}
            {isSlotInteractive && (
              <div className="pt-2.5 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playCardSelect();
                      setSlotAssignMode('OVERWRITE');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      slotAssignMode === 'OVERWRITE'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Mode Timpa Kartu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playCardSelect();
                      setSlotAssignMode('STACK_LAYER');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      slotAssignMode === 'STACK_LAYER'
                        ? 'bg-sky-400 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Mode Tumpuk Berlapis</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playCardSelect();
                      setKeepTargetSlot((v) => !v);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      keepTargetSlot
                        ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                        : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {keepTargetSlot
                      ? `Fokus Slot #0${activeSlotIdx + 1} (Gonta-Ganti)`
                      : 'Pindah Slot Otomatis'}
                  </button>
                </div>
              </div>
            )}

            {/* Binder Sheet Quick-Jump Strip + Add New Sheet */}
            {albumMode === 'COLLECTION_BINDER' && (
              <div className="pt-2.5 border-t border-slate-800/90 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 min-w-0">
                  {binderSheets.map((sheet, idx) => {
                    const isCurrent = idx === safeBinderPage;
                    const filledCount = sheet.pocketStacks.filter(
                      (st) => st.cardIds.length > 0
                    ).length;
                    return (
                      <button
                        key={sheet.id}
                        type="button"
                        onClick={() => {
                          if (isCurrent) return;
                          soundFx.playCardSelect();
                          runWithPosterFade(() => {
                            setSwapSourceIdx(null);
                            setBinderPage(idx);
                          });
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono tabular-nums border transition-colors whitespace-nowrap shrink-0 ${
                          isCurrent
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                            : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        #{String(idx + 1).padStart(2, '0')} · {filledCount}/9
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleAddBinderSheet}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Lembar Baru</span>
                </button>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* CAPTURED POSTER / BINDER SURFACE (ref={posterRef})                */}
          {/* ================================================================= */}
          <div className="flex justify-center">
            <div
              ref={posterRef}
              className={`w-full max-w-[660px] rounded-2xl border-2 p-5 sm:p-7 shadow-2xl poster-frame-transition ${themeStyle.posterOuter}`}
            >
              <div
                className={`rounded-xl border p-4 sm:p-6 flex flex-col justify-between poster-frame-transition poster-stage-transition ${
                  isSheetFadingOut ? 'poster-stage-fading-out' : 'poster-stage-visible'
                } ${themeStyle.posterInnerFrame}`}
              >
                {/* Poster / Binder Sheet Header */}
                <div
                  key={`poster-header-${sheetWaveKey}`}
                  className={`pb-4 sm:pb-5 border-b ${themeStyle.dividerBorder} text-center animate-poster-header-fade`}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {!logoError && (
                        <img
                          src={BRAND_LOGOS.indonesia}
                          alt="Monsta Galaxy Card"
                          referrerPolicy="no-referrer"
                          onError={() => setLogoError(true)}
                          className="h-7 sm:h-8 w-auto object-contain shrink-0"
                        />
                      )}
                      <span
                        className={`text-[10px] sm:text-xs font-mono font-bold tracking-wider uppercase truncate ${themeStyle.kickerText}`}
                      >
                        Monsta Galaxy Card
                      </span>
                    </div>

                    <span
                      className={`text-[10px] sm:text-xs font-mono tabular-nums whitespace-nowrap shrink-0 ${themeStyle.kickerText}`}
                    >
                      {editionMetaText}
                    </span>
                  </div>

                  <h2
                    className={`text-xl sm:text-3xl font-display font-extrabold tracking-tight leading-tight ${themeStyle.titleText}`}
                  >
                    {resolvedTitle}
                  </h2>

                  {resolvedSubtitle && (
                    <p
                      className={`mt-1 text-xs sm:text-sm leading-relaxed max-w-lg mx-auto ${themeStyle.subtitleText}`}
                    >
                      {resolvedSubtitle}
                    </p>
                  )}
                </div>

                {/* 3x3 Poster / Binder Pocket Grid */}
                <div className="my-5 sm:my-6 grid grid-cols-3 gap-3 sm:gap-4">
                  {displayedCards.map((card, slotIdx) => {
                    const stack = activePocketStacks[slotIdx] ?? {
                      cardIds: [],
                      activeIndex: 0,
                      locked: false,
                    };
                    const stackCount = stack.cardIds.length;
                    const hasStack = stackCount > 1;
                    const isSlotLocked = Boolean(stack.locked);

                    const isActiveSlot = isSlotInteractive && activeSlotIdx === slotIdx;
                    const isSwapSource = isSlotInteractive && swapSourceIdx === slotIdx;
                    const isDragTarget =
                      isSlotInteractive &&
                      dragOverSlotIdx === slotIdx &&
                      ((draggedSlotIdx !== null && draggedSlotIdx !== slotIdx) ||
                        draggedCatalogCardId !== null);
                    const swapTick = slotSwapTicks[slotIdx] ?? 0;

                    const holoFinish = resolveCardHologramFinish(card);
                    const isHolo = holoFinish !== 'NONE';
                    const holoMeta = getHologramFinishMeta(holoFinish);
                    const holoBorderClass =
                      card && isHolo && !isActiveSlot && !isSwapSource && !isDragTarget
                        ? getHologramBorderClass(holoFinish)
                        : '';

                    // Preview image of the card directly underneath for realistic stacked pocket depth
                    const underCardId = hasStack
                      ? stack.cardIds[(stack.activeIndex - 1 + stackCount) % stackCount]
                      : null;
                    const underCard = underCardId ? CARD_BY_ID[underCardId] : null;

                    return (
                      <div
                        key={`poster-wave-${sheetWaveKey}-slot-${slotIdx}`}
                        className={`flex flex-col animate-poster-slot-cascade ${POSTER_WAVE_CLASSES[slotIdx]}`}
                      >
                        <div className="relative aspect-[5/7] w-full">
                          {/* Physical Stacked Sleeve Back-Edge Peek when >= 2 Cards Stacked in This Pocket */}
                          {hasStack && (
                            <div
                              data-export-ignore="true"
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 translate-x-1.5 -translate-y-1.5 rounded-xl border border-amber-300/45 bg-slate-900/90 overflow-hidden opacity-85"
                            >
                              {underCard && (
                                <img
                                  src={underCard.image}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover opacity-55"
                                />
                              )}
                            </div>
                          )}

                          <div
                            data-slot-active={
                              isActiveSlot || isSwapSource || isDragTarget ? 'true' : 'false'
                            }
                            draggable={isSlotInteractive && Boolean(card)}
                            onDragStart={() => {
                              if (!isSlotInteractive) return;
                              setDraggedCatalogCardId(null);
                              setDraggedSlotIdx(slotIdx);
                            }}
                            onDragEnter={() => {
                              if (
                                !isSlotInteractive ||
                                (draggedSlotIdx === null && draggedCatalogCardId === null)
                              ) {
                                return;
                              }
                              setDragOverSlotIdx(slotIdx);
                            }}
                            onDragOver={(e) => {
                              if (!isSlotInteractive) return;
                              e.preventDefault();
                            }}
                            onDragLeave={() => {
                              if (dragOverSlotIdx === slotIdx) {
                                setDragOverSlotIdx(null);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggedSlotIdx(null);
                              setDragOverSlotIdx(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverSlotIdx(null);
                              if (!isSlotInteractive) return;

                              if (draggedCatalogCardId) {
                                handleAssignCardToSlot(draggedCatalogCardId, slotIdx);
                                setDraggedCatalogCardId(null);
                                return;
                              }

                              if (draggedSlotIdx !== null) {
                                handleSwapSlots(draggedSlotIdx, slotIdx);
                                setDraggedSlotIdx(null);
                              }
                            }}
                            onClick={() => {
                              if (!isSlotInteractive) {
                                if (card) onInspectCard(card);
                                return;
                              }
                              if (swapSourceIdx !== null) {
                                handleSwapSlots(swapSourceIdx, slotIdx);
                                return;
                              }
                              soundFx.playCardSelect();
                              setActiveSlotIdx(slotIdx);
                            }}
                            className={`group relative w-full h-full rounded-xl overflow-hidden border card-hover-motion select-none ${
                              card ? themeStyle.slotFrame : themeStyle.slotEmpty
                            } ${holoBorderClass} ${
                              isDragTarget
                                ? 'ring-2 ring-sky-400 border-sky-400 scale-[1.02] cursor-pointer'
                                : isSwapSource
                                ? 'ring-2 ring-emerald-400 border-emerald-400 cursor-pointer'
                                : isActiveSlot
                                ? 'ring-2 ring-amber-400 border-amber-400 cursor-pointer'
                                : 'cursor-pointer hover:-translate-y-0.5'
                            }`}
                          >
                            <div
                              key={`slot-inner-${slotIdx}-${swapTick}`}
                              className={`w-full h-full relative ${
                                swapTick > 0 ? 'animate-poster-slot-swap' : ''
                              }`}
                            >
                              {card ? (
                                <>
                                  <img
                                    src={card.image}
                                    alt={`${card.name} — ${card.numberLabel}`}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />

                                  {/* Selective Hologram Foil Overlay */}
                                  <HologramFoilOverlay finish={holoFinish} showBadge />

                                  {/* Subtle Collector Foil Veil on Layout / Slot Crossfade */}
                                  <div
                                    data-export-ignore="true"
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent animate-poster-slot-sheen"
                                  />

                                  {/* Custom Card Overlay Support inside Poster */}
                                  {card.showCustomOverlay && (
                                    <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-slate-950/90 via-slate-950/55 to-transparent p-1.5 sm:p-2 flex items-start justify-between gap-1 pointer-events-none">
                                      <div className="min-w-0">
                                        <div className="text-[9px] font-mono font-extrabold text-amber-400 leading-none">
                                          {card.category === CardCategory.CHARACTER
                                            ? `RANK ${card.rank}`
                                            : card.category === CardCategory.SUPPORT
                                            ? 'PENDUKUNG'
                                            : `SUIT ${card.suitElement ?? ''}`}
                                        </div>
                                        <div className="mt-0.5 font-display font-bold text-[10px] sm:text-xs text-white truncate">
                                          {card.name}
                                        </div>
                                      </div>
                                      {card.category === CardCategory.CHARACTER && (
                                        <div className="text-right font-mono text-[9px] font-extrabold leading-tight tabular-nums shrink-0">
                                          <div className="text-rose-300">{card.hp}</div>
                                          <div className="text-emerald-300">{card.atk}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Slot Lock Pin Indicator (Top-Left, Ignored on PNG Export) */}
                                  {isSlotLocked && (
                                    <button
                                      type="button"
                                      data-export-ignore="true"
                                      title="Slot terkunci (Klik untuk membuka kunci)"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleLockSlot(slotIdx);
                                      }}
                                      className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md bg-amber-500 text-slate-950 border border-amber-300 flex items-center justify-center shadow"
                                    >
                                      <Lock className="w-3 h-3" />
                                    </button>
                                  )}

                                  {/* Interactive Hover Controls (Top-Right, Ignored During PNG Export!) */}
                                  <div
                                    data-export-ignore="true"
                                    className="absolute top-1.5 right-1.5 flex flex-wrap justify-end items-center gap-1 max-w-[85%] opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                                  >
                                    {isSlotInteractive && (
                                      <button
                                        type="button"
                                        title="Fokus Gonta-Ganti / Timpa Kartu Ini"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleFocusSlotForOverwrite(slotIdx);
                                        }}
                                        className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                                          isActiveSlot && keepTargetSlot
                                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                                            : 'bg-slate-950/85 hover:bg-slate-900 text-amber-300 border-slate-700'
                                        }`}
                                      >
                                        <RefreshCw className="w-3 h-3" />
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      title={`Ubah Efek Hologram (${holoMeta.shortLabel})`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCycleCardHoloInSlot(card.id, slotIdx);
                                      }}
                                      className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                                        isHolo
                                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                                          : 'bg-slate-950/85 hover:bg-slate-900 text-slate-300 hover:text-amber-300 border-slate-700'
                                      }`}
                                    >
                                      <Sparkles className="w-3 h-3" />
                                    </button>

                                    <button
                                      type="button"
                                      title="Perbesar & Atur Hologram 3D"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onInspectCard(card);
                                      }}
                                      className="w-6 h-6 rounded-md bg-slate-950/85 hover:bg-slate-900 text-white border border-slate-700 flex items-center justify-center"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>

                                    {isSlotInteractive && (
                                      <>
                                        {!isSlotLocked && (
                                          <button
                                            type="button"
                                            title="Kunci Kartu Ini (Tidak Ikut Terganti Saat Acak/Reset)"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleLockSlot(slotIdx);
                                            }}
                                            className="w-6 h-6 rounded-md bg-slate-950/85 hover:bg-slate-900 text-slate-300 hover:text-amber-300 border border-slate-700 flex items-center justify-center"
                                          >
                                            <Unlock className="w-3 h-3" />
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          title="Tukar Posisi Kantong"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSwapSourceIdx((prev) =>
                                              prev === slotIdx ? null : slotIdx
                                            );
                                          }}
                                          className={`w-6 h-6 rounded-md border flex items-center justify-center ${
                                            isSwapSource
                                              ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                                              : 'bg-slate-950/85 hover:bg-slate-900 text-amber-300 border-slate-700'
                                          }`}
                                        >
                                          <ArrowLeftRight className="w-3 h-3" />
                                        </button>

                                        <button
                                          type="button"
                                          title={
                                            hasStack
                                              ? 'Lepas Lapisan Kartu Teratas'
                                              : 'Kosongkan Kantong'
                                          }
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleClearSlot(slotIdx, false);
                                          }}
                                          className="w-6 h-6 rounded-md bg-slate-950/85 hover:bg-rose-600 text-slate-200 hover:text-white border border-slate-700 flex items-center justify-center"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </>
                                    )}
                                  </div>

                                  {/* 1-Click Gonta-Ganti Tumpukan Switcher on Stacked Slots (Ignored on PNG Export!) */}
                                  {hasStack && (
                                    <div
                                      data-export-ignore="true"
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded-lg bg-slate-950/90 border border-sky-400/60 px-1 py-0.5 text-sky-200 shadow-md"
                                    >
                                      <button
                                        type="button"
                                        title="Kartu tumpukan sebelumnya"
                                        onClick={() => handleCycleSlotStack(slotIdx, -1)}
                                        className="w-5 h-5 rounded hover:bg-sky-500/25 flex items-center justify-center"
                                      >
                                        <ChevronLeft className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        title="Kelola tumpukan kartu di slot ini"
                                        onClick={() => {
                                          soundFx.playCardSelect();
                                          setActiveSlotIdx(slotIdx);
                                        }}
                                        className="px-1 font-mono text-[9px] font-bold tabular-nums whitespace-nowrap"
                                      >
                                        {stack.activeIndex + 1}/{stackCount}
                                      </button>
                                      <button
                                        type="button"
                                        title="Ganti ke kartu tumpukan berikutnya"
                                        onClick={() => handleCycleSlotStack(slotIdx, 1)}
                                        className="w-5 h-5 rounded hover:bg-sky-500/25 flex items-center justify-center"
                                      >
                                        <ChevronRight className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                                  <span className="font-mono text-xs font-bold tabular-nums">
                                    0{slotIdx + 1}
                                  </span>
                                  <span
                                    data-export-ignore="true"
                                    className="mt-1 text-[10px] opacity-80"
                                  >
                                    {isActiveSlot ? 'Pilih / Tarik Kartu' : 'Kantong Kosong'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Optional Collector Plaque Caption Beneath Each Card */}
                        {posterState.showCardCaptions && (
                          <div
                            key={`caption-${slotIdx}-${swapTick}`}
                            className="mt-1.5 text-center px-0.5 min-w-0 animate-poster-caption-fade"
                          >
                            <div
                              className={`text-[11px] sm:text-xs font-display font-bold truncate ${themeStyle.captionTitle}`}
                            >
                              {card ? card.name : `Kantong 0${slotIdx + 1}`}
                            </div>
                            <div
                              className={`text-[9px] sm:text-[10px] font-mono tabular-nums truncate ${themeStyle.captionMeta}`}
                            >
                              {card
                                ? `${card.numberLabel} · ${
                                    card.category === CardCategory.CHARACTER
                                      ? `Rank ${card.rank}`
                                      : card.category === CardCategory.SUPPORT
                                      ? 'Pendukung'
                                      : `Suit ${card.suitElement ?? ''}`
                                  }${isHolo ? ` · ${holoMeta.shortLabel}` : ''}`
                                : 'Kosong'}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Poster / Binder Editorial Footer */}
                {posterState.showStatsFooter && (
                  <div
                    key={`poster-footer-${sheetWaveKey}`}
                    className={`pt-3.5 border-t ${themeStyle.dividerBorder} flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs font-mono tabular-nums animate-poster-caption-fade ${themeStyle.footerText}`}
                  >
                    <span>{footerStatsLine}</span>
                    <span className={`font-semibold ${themeStyle.footerAccent}`}>
                      Kolektor: {posterState.collectorName.trim() || 'Pemain'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Secondary Action & Export Bar Beneath Poster */}
          <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-300">
              {isSlotInteractive
                ? `Tips: Klik kartu di katalog atau tarik langsung ke slot tertentu untuk ${
                    slotAssignMode === 'STACK_LAYER'
                      ? 'menumpuk kartu berlapis'
                      : 'menimpa/mengganti kartu tersebut'
                  }.`
                : 'Mode Baca aktif: Klik panah pada tumpukan kartu untuk gonta-ganti kartu teratas, atau klik kartu untuk pratinjau 3D.'}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {albumMode === 'COLLECTION_BINDER' && (
                <button
                  type="button"
                  onClick={handleCopyBinderPageToCustom}
                  className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Salin ke Poster Kustom
                </button>
              )}
              <button
                type="button"
                disabled={isExporting}
                onClick={handleExportAsImage}
                className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/60 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor sebagai Gambar</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT 5 COLS: POSTER / BINDER SHEET EDITOR & TIMPA/STACK CATALOG PICKER */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Poster Design OR Editable Collection Binder Sheet Studio */}
          <div className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-display font-bold text-white">
                {albumMode === 'COLLECTION_BINDER'
                  ? `Editor Lembar Binder #${String(safeBinderPage + 1).padStart(2, '0')}`
                  : 'Desain & Identitas Poster'}
              </h3>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {posterMetrics.filledCount}/9 Slot · {posterMetrics.totalStackedCards} Kartu
              </span>
            </div>

            {/* Theme Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Tema Bingkai Lembar
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.values(POSTER_THEMES) as PosterThemeStyle[]).map((th) => {
                  const active = posterState.theme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        soundFx.playCardSelect();
                        setPosterState((prev) => ({ ...prev, theme: th.id }));
                      }}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 truncate ${
                        active
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-[#0B1120] hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      {th.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {albumMode === 'CUSTOM_POSTER' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Judul Poster Utama
                  </label>
                  <input
                    type="text"
                    maxLength={42}
                    value={posterState.title}
                    onChange={(e) =>
                      setPosterState((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Contoh: KOLEKSI ELIT GALAXY"
                    className="w-full px-3.5 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Subjudul Edisi
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={posterState.subtitle}
                      onChange={(e) =>
                        setPosterState((prev) => ({ ...prev, subtitle: e.target.value }))
                      }
                      placeholder="Edisi Pilihan 9 Kartu..."
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nama Kolektor
                    </label>
                    <input
                      type="text"
                      maxLength={28}
                      value={posterState.collectorName}
                      onChange={(e) =>
                        setPosterState((prev) => ({ ...prev, collectorName: e.target.value }))
                      }
                      placeholder="Nama Anda..."
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Editable Collection Binder Sheet Metadata & Sheet Actions */
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Judul Lembar Binder Aktif
                  </label>
                  <input
                    type="text"
                    maxLength={42}
                    value={activeBinderSheet.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateActiveBinderSheet((sheet) => ({ ...sheet, title: val }));
                    }}
                    placeholder="Contoh: LEMBAR KOLEKSI HOLOGRAM"
                    className="w-full px-3.5 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Catatan / Subjudul Lembar
                    </label>
                    <input
                      type="text"
                      maxLength={64}
                      value={activeBinderSheet.subtitle}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateActiveBinderSheet((sheet) => ({ ...sheet, subtitle: val }));
                      }}
                      placeholder="Catatan seri atau tema lembar..."
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nama Kolektor
                    </label>
                    <input
                      type="text"
                      maxLength={28}
                      value={posterState.collectorName}
                      onChange={(e) =>
                        setPosterState((prev) => ({ ...prev, collectorName: e.target.value }))
                      }
                      placeholder="Nama Anda..."
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Sheet-Level Management Controls */}
                <div className="pt-2 border-t border-slate-800/90 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-300">
                    Kelola Lembar Binder ({safeBinderPage + 1} dari {totalBinderPages})
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddBinderSheet}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Lembar Baru</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDuplicateBinderSheet}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplikat</span>
                    </button>

                    <button
                      type="button"
                      disabled={safeBinderPage <= 0}
                      onClick={() => handleMoveBinderSheet(-1)}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Geser Kiri</span>
                    </button>

                    <button
                      type="button"
                      disabled={safeBinderPage >= totalBinderPages - 1}
                      onClick={() => handleMoveBinderSheet(1)}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <span>Geser Kanan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {binderSheets.length > 1 &&
                      (!confirmDeleteSheet ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSheet(true)}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-rose-950/60 text-rose-300 border border-slate-800 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Lembar</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleDeleteActiveBinderSheet}
                            className="px-2.5 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            Yakin Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSheet(false)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            Batal
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Quick-Fill Current Binder Sheet */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      value={binderFillSource}
                      onChange={(e) => setBinderFillSource(e.target.value)}
                      aria-label="Sumber isi otomatis lembar binder"
                      className="flex-1 px-3 py-2 text-xs bg-[#0B1120] border border-slate-700 rounded-xl text-amber-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="HOLOGRAM">
                        9 Kartu Hologram Terbaik ({hologramTotalInCatalog} Tersedia)
                      </option>
                      <option value="ACTIVE_DECK">9 Kartu dari Dek Aktif</option>
                      {ALL_PACK_SERIES.map((pack) => (
                        <option key={pack.id} value={pack.id}>
                          Seri {pack.name} ({pack.codePrefix})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleFillBinderSheetFromSource}
                      className="px-3.5 py-2 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 rounded-xl transition-colors whitespace-nowrap shrink-0"
                    >
                      Isi Slot Tak Terkunci
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Toggle Captions & Stats Footer */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  setPosterState((prev) => ({
                    ...prev,
                    showCardCaptions: !prev.showCardCaptions,
                  }))
                }
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  posterState.showCardCaptions
                    ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                    : 'bg-[#0B1120] border-slate-800 text-slate-400'
                }`}
              >
                Label Kartu: {posterState.showCardCaptions ? 'Tampil' : 'Sembunyi'}
              </button>

              <button
                type="button"
                onClick={() =>
                  setPosterState((prev) => ({
                    ...prev,
                    showStatsFooter: !prev.showStatsFooter,
                  }))
                }
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  posterState.showStatsFooter
                    ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                    : 'bg-[#0B1120] border-slate-800 text-slate-400'
                }`}
              >
                Statistik Bawah: {posterState.showStatsFooter ? 'Tampil' : 'Sembunyi'}
              </button>
            </div>

            {/* Quick Auto-Fill / Selective Randomization Actions */}
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-400">
                  {albumMode === 'COLLECTION_BINDER'
                    ? 'Tata Cepat Kantong Lembar Ini'
                    : 'Susunan Cepat (Slot Terkunci Tetap Aman)'}
                </span>
                {posterMetrics.lockedCount > 0 && (
                  <span className="text-[11px] font-mono text-amber-300 tabular-nums">
                    {posterMetrics.lockedCount} Terkunci
                  </span>
                )}
              </div>

              {albumMode === 'COLLECTION_BINDER' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRandomizeUnlockedSlots}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-sky-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Ganti Acak Tak Terkunci</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSortCurrentSheetByRank}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                    <span>Urutkan Rank</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearActiveBinderSheet}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-rose-950/60 text-rose-300 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Kosongkan Tak Terkunci</span>
                  </button>

                  {!confirmRebuildBinder ? (
                    <button
                      type="button"
                      onClick={() => setConfirmRebuildBinder(true)}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Susun Ulang Semua dari Katalog</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleRebuildBinderFromCatalog}
                        className="px-2.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        Konfirmasi Reset Binder
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRebuildBinder(false)}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('HOLOGRAM_SHOWCASE')}
                    className="px-3 py-1.5 text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>9 Kartu Hologram</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('TOP_RANK')}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-amber-300 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    9 Rank Tertinggi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('BOBOIBOY_ELEMENTS')}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-sky-300 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    BoBoiBoy Elemental
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('ACTIVE_DECK')}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-emerald-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Dari Dek Aktif</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('SORT_CURRENT')}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                    <span>Urutkan Rank</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('SHUFFLE_9')}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-slate-800 text-sky-200 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Ganti Acak Tak Terkunci</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('CLEAR_ALL')}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#0B1120] hover:bg-rose-950/60 text-rose-300 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Kosongkan</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Panel Timpa, Tumpukan Lapisan Slot #0X & Katalog Pemilih Kartu */}
          <div
            ref={catalogSectionRef}
            className="bg-[#131C31] border border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-display font-bold text-white">
                  {slotAssignMode === 'STACK_LAYER'
                    ? `Tumpuk Berlapis di Slot #0${activeSlotIdx + 1}`
                    : `Timpa / Ganti Kartu di Slot #0${activeSlotIdx + 1}`}
                </h3>
                <p className="text-xs text-slate-400">
                  {slotAssignMode === 'STACK_LAYER'
                    ? `Tambahkan hingga ${MAX_STACK_PER_SLOT} kartu ke dalam Slot #0${activeSlotIdx + 1}, lalu klik kartu di daftar tumpukan untuk gonta-ganti.`
                    : `Klik kartu katalog (atau tarik ke slot mana pun) untuk langsung mengganti kartu di Slot #0${activeSlotIdx + 1}.`}
                </p>
              </div>

              {onOpenCreateCard && (
                <button
                  type="button"
                  onClick={onOpenCreateCard}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Kartu</span>
                </button>
              )}
            </div>

            {/* Mini 9-Pocket Selector Matrix (Shows Stack Depth & Lock State!) */}
            <div className="grid grid-cols-9 gap-1.5">
              {Array.from({ length: 9 }, (_, idx) => {
                const st = activePocketStacks[idx];
                const count = st?.cardIds.length ?? 0;
                const locked = Boolean(st?.locked);
                const isSelected = isSlotInteractive && activeSlotIdx === idx;
                return (
                  <button
                    key={`mini-slot-${idx}`}
                    type="button"
                    onClick={() => {
                      soundFx.playCardSelect();
                      if (albumMode === 'COLLECTION_BINDER' && !isBinderEditMode) {
                        setIsBinderEditMode(true);
                      }
                      setActiveSlotIdx(idx);
                    }}
                    className={`py-1.5 px-0.5 rounded-lg font-mono text-[11px] font-bold tabular-nums border transition-colors flex flex-col items-center justify-center leading-tight ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : count > 1
                        ? 'bg-sky-950/60 text-sky-200 border-sky-400/50 hover:border-sky-300'
                        : count === 1
                        ? 'bg-[#0B1120] text-emerald-300 border-slate-700 hover:border-slate-500'
                        : 'bg-[#0B1120]/60 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    <span>#{idx + 1}</span>
                    <span className="text-[9px] opacity-85">
                      {locked ? 'Kunci' : count > 1 ? `×${count}` : count === 1 ? 'Isi' : '-'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Slot Stack & Gonta-Ganti Drawer ("Lapisan Kartu di Slot #0X") */}
            <div className="rounded-xl bg-[#0B1120] border border-slate-800 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-200 tabular-nums">
                  Isi Tumpukan Slot #0{activeSlotIdx + 1} ({selectedSlotStackCards.length}/
                  {MAX_STACK_PER_SLOT} Lapis)
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleLockSlot(activeSlotIdx)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      selectedSlotStack.locked
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {selectedSlotStack.locked ? (
                      <>
                        <Lock className="w-3 h-3" />
                        <span>Terkunci</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3 h-3" />
                        <span>Kunci Slot</span>
                      </>
                    )}
                  </button>

                  {selectedSlotStackCards.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleClearSlot(activeSlotIdx, true)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-slate-900 hover:bg-rose-950/60 text-rose-300 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Kosongkan Semua
                    </button>
                  )}
                </div>
              </div>

              {selectedSlotStackCards.length > 0 ? (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {selectedSlotStackCards.map((stCard, layerIdx) => {
                    const isTopActive = selectedSlotStack.activeIndex === layerIdx;
                    return (
                      <div
                        key={`${stCard.id}-${layerIdx}`}
                        className={`relative shrink-0 w-16 rounded-lg border p-1 transition-colors ${
                          isTopActive
                            ? 'bg-amber-500/15 border-amber-400'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectStackLayer(activeSlotIdx, layerIdx)}
                          title={`Tampilkan ${stCard.name} di paling atas`}
                          className="w-full text-left"
                        >
                          <div className="aspect-[5/7] w-full rounded overflow-hidden bg-slate-950">
                            <img
                              src={stCard.image}
                              alt={stCard.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="mt-1 text-[9px] font-mono text-center tabular-nums truncate text-slate-200">
                            {isTopActive ? 'Aktif' : `Lapis ${layerIdx + 1}`}
                          </div>
                        </button>

                        <button
                          type="button"
                          title="Hapus lapisan ini"
                          onClick={() => handleRemoveStackLayer(activeSlotIdx, layerIdx)}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-950 hover:bg-rose-600 text-slate-200 border border-slate-700 flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-1">
                  Slot #0{activeSlotIdx + 1} masih kosong. Pilih kartu di bawah untuk memasangnya.
                </div>
              )}

              {/* Quick 1-Click Variant Stacker ("+ Tumpuk Varian Karakter Ini") */}
              {suggestedVariantCards.length > 0 &&
                selectedSlotStackCards.length < MAX_STACK_PER_SLOT && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 mr-1">
                      Tumpuk cepat varian:
                    </span>
                    {suggestedVariantCards.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() =>
                          handleAssignCardToSlot(variant.id, activeSlotIdx, 'STACK_LAYER')
                        }
                        className="px-2 py-1 rounded-md bg-slate-900 hover:bg-sky-950/60 text-sky-200 border border-slate-700 hover:border-sky-400/50 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0"
                      >
                        + {variant.name}
                      </button>
                    ))}
                  </div>
                )}
            </div>

            {/* Search & Filter */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={pickerPack}
                  onChange={(e) => setPickerPack(e.target.value)}
                  aria-label="Filter Seri Pek Katalog"
                  className="px-3 py-2 text-xs bg-[#0B1120] border border-slate-700 rounded-xl text-amber-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">Semua Seri Pek</option>
                  {ALL_PACK_SERIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.codePrefix})
                    </option>
                  ))}
                </select>

                <select
                  value={pickerCategory}
                  onChange={(e) => setPickerCategory(e.target.value as PickerCategoryFilter)}
                  aria-label="Filter Kategori Katalog"
                  className="px-3 py-2 text-xs bg-[#0B1120] border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">Semua Jenis ({ALL_CARDS.length})</option>
                  <option value="HOLOGRAM">Khusus Hologram ({hologramTotalInCatalog})</option>
                  <option value={CardCategory.CHARACTER}>Karakter</option>
                  <option value={CardCategory.SUPPORT}>Pendukung</option>
                  <option value={CardCategory.SUIT}>Suit</option>
                </select>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Cari nama kartu, nomor (32/54), atau rank..."
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Scrollable Visual Card Picker (Click to Timpa/Stack Active Slot OR Drag onto Any Specific Slot!) */}
            <div className="max-h-[430px] overflow-y-auto pr-1 grid grid-cols-3 gap-2.5">
              {catalogCards.map((card) => {
                const inTopSlotIdx = activeSheetSlots.findIndex((id) => id === card.id);
                const inAnyStackSlotIdx = activePocketStacks.findIndex((st) =>
                  st.cardIds.includes(card.id)
                );
                const isAlreadyPlaced = inAnyStackSlotIdx >= 0;
                const cardHolo = resolveCardHologramFinish(card);
                const cardIsHolo = cardHolo !== 'NONE';

                return (
                  <button
                    key={card.id}
                    type="button"
                    draggable
                    onDragStart={() => {
                      setDraggedSlotIdx(null);
                      setDraggedCatalogCardId(card.id);
                    }}
                    onDragEnd={() => {
                      setDraggedCatalogCardId(null);
                      setDragOverSlotIdx(null);
                    }}
                    onClick={() => handleAssignCardToSlot(card.id)}
                    className={`group p-2 rounded-xl border text-left transition-colors flex flex-col cursor-pointer ${
                      inTopSlotIdx >= 0
                        ? 'bg-amber-500/10 border-amber-400/50 hover:bg-amber-500/20'
                        : isAlreadyPlaced
                        ? 'bg-sky-500/10 border-sky-400/40 hover:bg-sky-500/20'
                        : 'bg-[#0B1120] border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div
                      className={`relative aspect-[5/7] w-full rounded-lg overflow-hidden bg-slate-900 border ${
                        cardIsHolo ? getHologramBorderClass(cardHolo) : 'border-slate-800'
                      }`}
                    >
                      <img
                        src={card.image}
                        alt={card.name}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <HologramFoilOverlay finish={cardHolo} />
                      {cardIsHolo && (
                        <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-slate-950/85 text-amber-200 border border-amber-400/50 font-mono text-[8px] font-bold leading-none">
                          HOLO
                        </div>
                      )}
                      {isAlreadyPlaced && (
                        <div
                          className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded font-mono text-[9px] font-extrabold tabular-nums ${
                            inTopSlotIdx >= 0
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-sky-400 text-slate-950'
                          }`}
                        >
                          #{inAnyStackSlotIdx + 1}
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 text-[11px] font-semibold text-slate-100 truncate w-full">
                      {card.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 tabular-nums truncate w-full">
                      {card.numberLabel} · {card.rank}
                      {cardIsHolo ? ' · Holo' : ''}
                    </div>
                  </button>
                );
              })}

              {catalogCards.length === 0 && (
                <div className="col-span-3 py-10 text-center text-xs text-slate-400">
                  Tidak ada kartu yang cocok dengan filter pencarian.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
