import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { FullBattleState } from '../engine/battleEngine';
import type { ActiveFighter, CardDefinition, CardRank } from '../types/game';

export type BgmTrackId =
  | 'MENU'
  | 'BATTLE_NORMAL'
  | 'BATTLE_CRITICAL'
  | 'BATTLE_LEGENDARY'
  | 'VICTORY'
  | 'DEFEAT';

export const ALL_BGM_TRACK_IDS: readonly BgmTrackId[] = [
  'MENU',
  'BATTLE_NORMAL',
  'BATTLE_CRITICAL',
  'BATTLE_LEGENDARY',
  'VICTORY',
  'DEFEAT',
];

export type BgmControlMode = 'AUTO' | BgmTrackId;
export type BgmSourceMode = 'SYNTH' | 'CUSTOM_FILE';
export type SynthLeadWaveform = 'DEFAULT' | 'square' | 'sawtooth' | 'triangle' | 'sine';
export type BgmSynthPresetId =
  | 'DEFAULT'
  | 'CHIPTUNE_8BIT'
  | 'BOSS_OVERDRIVE'
  | 'LOFI_COSMIC'
  | 'CINEMATIC_BRASS';

export interface BgmTrackCustomConfig {
  trackId: BgmTrackId;
  customTitle: string;
  sourceMode: BgmSourceMode;
  // Synth customization
  presetId: BgmSynthPresetId;
  bpm: number;
  transposeSemitones: number;
  leadWaveform: SynthLeadWaveform;
  filterCutoffHz: number;
  drumsEnabled: boolean;
  bassEnabled: boolean;
  chordsEnabled: boolean;
  leadEnabled: boolean;
  // Shared & Custom File playback settings
  trackGain: number; // 0.4 .. 1.6
  playbackRate: number; // 0.75 .. 1.5
  loopStartSec: number;
  loopEndSec: number; // 0 = full track duration
  customFileName: string | null;
  customDurationSec: number;
}

export type CelebrationAudioStyle = 'DYNAMIC' | 'STADIUM_EPIC' | 'ARCADE_RETRO';
export type MatchCelebrationOutcome = 'VICTORY' | 'DEFEAT' | 'DRAW';
export type VictoryCalloutId =
  | 'VICTORY'
  | 'PERFECT_VICTORY'
  | 'COMEBACK_VICTORY'
  | 'LEGENDARY_VICTORY'
  | 'DRAW_GAME';

export interface VictoryCelebrationAudioContext {
  outcome?: MatchCelebrationOutcome;
  isPerfectWin?: boolean;
  isComeback?: boolean;
  isLegendaryFinisher?: boolean;
  comboCount?: number;
  winnerName?: string;
  calloutOverride?: VictoryCalloutId;
}

export interface AudioEventBanner {
  id: number;
  kind: 'CRITICAL' | 'LEGENDARY';
  title: string;
  subtitle: string;
  timestamp: number;
}

export interface AudioSnapshot {
  muted: boolean;
  bgmEnabled: boolean;
  lobbyBgmEnabled: boolean;
  bgmVolume: number;
  sfxVolume: number;
  celebrationCrowdEnabled: boolean;
  celebrationVoiceEnabled: boolean;
  celebrationStyle: CelebrationAudioStyle;
  customCelebrationFileName: string | null;
  controlMode: BgmControlMode;
  autoTrack: BgmTrackId;
  effectiveTrack: BgmTrackId;
  contextUnlocked: boolean;
  activeBanner: AudioEventBanner | null;
  studioOpen: boolean;
  studioTrack: BgmTrackId;
  trackConfigs: Record<BgmTrackId, BgmTrackCustomConfig>;
}

export const BGM_TRACK_META: Record<
  BgmTrackId,
  {
    label: string;
    shortLabel: string;
    bpm: number;
    defaultCutoffHz: number;
    description: string;
  }
> = {
  MENU: {
    label: 'Lobi Galaksi',
    shortLabel: 'Lobi',
    bpm: 92,
    defaultCutoffHz: 2600,
    description: 'Tema atmosferik kosmik saat mengatur dek dan koleksi kartu.',
  },
  BATTLE_NORMAL: {
    label: 'Pertarungan Standar',
    shortLabel: 'Standar',
    bpm: 120,
    defaultCutoffHz: 3800,
    description: 'Ritme taktis utama saat duel berjalan seimbang di Zona Aktif.',
  },
  BATTLE_CRITICAL: {
    label: 'Fase Kritis (HP Rendah)',
    shortLabel: 'Fase Kritis',
    bpm: 148,
    defaultCutoffHz: 5200,
    description: 'Tempo cepat berintensitas tinggi dengan detak darurat saat HP kritis.',
  },
  BATTLE_LEGENDARY: {
    label: 'Tema Kartu Legendaris',
    shortLabel: 'Legendaris',
    bpm: 130,
    defaultCutoffHz: 4800,
    description: 'Anthem heroik megah saat kartu Rank S, AR, atau SR dimainkan.',
  },
  VICTORY: {
    label: 'Fanfare Kemenangan',
    shortLabel: 'Menang',
    bpm: 124,
    defaultCutoffHz: 4000,
    description: 'Melodi selebrasi kemenangan di akhir pertandingan.',
  },
  DEFEAT: {
    label: 'Resolusi Akhir Laga',
    shortLabel: 'Akhir Laga',
    bpm: 86,
    defaultCutoffHz: 2800,
    description: 'Tema reflektif penutup laga untuk bersiap membalas di duel berikutnya.',
  },
};

export const BGM_SYNTH_PRESETS: Array<{
  id: BgmSynthPresetId;
  label: string;
  description: string;
}> = [
  {
    id: 'DEFAULT',
    label: 'Bawaan Asli',
    description: 'Aransemen orisinal Monsta Galaxy.',
  },
  {
    id: 'CHIPTUNE_8BIT',
    label: '8-Bit Retro',
    description: 'Gelombang Square klasik ala konsol arkade.',
  },
  {
    id: 'BOSS_OVERDRIVE',
    label: 'Boss Overdrive',
    description: 'Tempo lebih cepat, sawtooth agresif, dan filter terang.',
  },
  {
    id: 'LOFI_COSMIC',
    label: 'Lo-Fi Kosmik',
    description: 'Suara hangat lembut dengan tempo santai.',
  },
  {
    id: 'CINEMATIC_BRASS',
    label: 'Heroik Megah',
    description: 'Nada dasar lebih berat dan harmoni penuh.',
  },
];

const AUDIO_STORAGE_KEY = 'mgc_audio_settings_v1';
const BGM_CONFIGS_STORAGE_KEY = 'mgc_bgm_track_configs_v1';
const BGM_IDB_NAME = 'mgc_custom_bgm_db_v1';
const BGM_IDB_STORE = 'bgm_blobs';

const CUSTOM_CELEBRATION_IDB_KEY = 'CUSTOM_CELEBRATION_SFX' as const;

interface PersistedAudioPrefs {
  muted: boolean;
  bgmEnabled: boolean;
  lobbyBgmEnabled: boolean;
  bgmVolume: number;
  sfxVolume: number;
  celebrationCrowdEnabled: boolean;
  celebrationVoiceEnabled: boolean;
  celebrationStyle: CelebrationAudioStyle;
  customCelebrationFileName: string | null;
}

interface StoredBgmBlobRecord {
  trackId: BgmTrackId | typeof CUSTOM_CELEBRATION_IDB_KEY;
  fileName: string;
  mimeType: string;
  blob: Blob;
  updatedAt: number;
}

export function buildDefaultTrackConfig(trackId: BgmTrackId): BgmTrackCustomConfig {
  const meta = BGM_TRACK_META[trackId];
  return {
    trackId,
    customTitle: '',
    sourceMode: 'SYNTH',
    presetId: 'DEFAULT',
    bpm: meta.bpm,
    transposeSemitones: 0,
    leadWaveform: 'DEFAULT',
    filterCutoffHz: meta.defaultCutoffHz,
    drumsEnabled: true,
    bassEnabled: true,
    chordsEnabled: true,
    leadEnabled: true,
    trackGain: 1.0,
    playbackRate: 1.0,
    loopStartSec: 0,
    loopEndSec: 0,
    customFileName: null,
    customDurationSec: 0,
  };
}

function normalizeTrackConfig(
  trackId: BgmTrackId,
  raw: Partial<BgmTrackCustomConfig> | undefined
): BgmTrackCustomConfig {
  const base = buildDefaultTrackConfig(trackId);
  if (!raw || typeof raw !== 'object') return base;

  const validWaveforms: SynthLeadWaveform[] = [
    'DEFAULT',
    'square',
    'sawtooth',
    'triangle',
    'sine',
  ];
  const validPresets: BgmSynthPresetId[] = [
    'DEFAULT',
    'CHIPTUNE_8BIT',
    'BOSS_OVERDRIVE',
    'LOFI_COSMIC',
    'CINEMATIC_BRASS',
  ];

  return {
    trackId,
    customTitle: typeof raw.customTitle === 'string' ? raw.customTitle.slice(0, 40) : '',
    sourceMode: raw.sourceMode === 'CUSTOM_FILE' ? 'CUSTOM_FILE' : 'SYNTH',
    presetId:
      raw.presetId && validPresets.includes(raw.presetId) ? raw.presetId : base.presetId,
    bpm:
      typeof raw.bpm === 'number' && Number.isFinite(raw.bpm)
        ? Math.max(60, Math.min(200, Math.round(raw.bpm)))
        : base.bpm,
    transposeSemitones:
      typeof raw.transposeSemitones === 'number' && Number.isFinite(raw.transposeSemitones)
        ? Math.max(-12, Math.min(12, Math.round(raw.transposeSemitones)))
        : 0,
    leadWaveform:
      raw.leadWaveform && validWaveforms.includes(raw.leadWaveform)
        ? raw.leadWaveform
        : 'DEFAULT',
    filterCutoffHz:
      typeof raw.filterCutoffHz === 'number' && Number.isFinite(raw.filterCutoffHz)
        ? Math.max(700, Math.min(7500, Math.round(raw.filterCutoffHz)))
        : base.filterCutoffHz,
    drumsEnabled: typeof raw.drumsEnabled === 'boolean' ? raw.drumsEnabled : true,
    bassEnabled: typeof raw.bassEnabled === 'boolean' ? raw.bassEnabled : true,
    chordsEnabled: typeof raw.chordsEnabled === 'boolean' ? raw.chordsEnabled : true,
    leadEnabled: typeof raw.leadEnabled === 'boolean' ? raw.leadEnabled : true,
    trackGain:
      typeof raw.trackGain === 'number' && Number.isFinite(raw.trackGain)
        ? Math.max(0.4, Math.min(1.6, raw.trackGain))
        : 1.0,
    playbackRate:
      typeof raw.playbackRate === 'number' && Number.isFinite(raw.playbackRate)
        ? Math.max(0.75, Math.min(1.5, raw.playbackRate))
        : 1.0,
    loopStartSec:
      typeof raw.loopStartSec === 'number' && Number.isFinite(raw.loopStartSec)
        ? Math.max(0, raw.loopStartSec)
        : 0,
    loopEndSec:
      typeof raw.loopEndSec === 'number' && Number.isFinite(raw.loopEndSec)
        ? Math.max(0, raw.loopEndSec)
        : 0,
    customFileName: typeof raw.customFileName === 'string' ? raw.customFileName : null,
    customDurationSec:
      typeof raw.customDurationSec === 'number' && Number.isFinite(raw.customDurationSec)
        ? Math.max(0, raw.customDurationSec)
        : 0,
  };
}

function loadTrackConfigs(): Record<BgmTrackId, BgmTrackCustomConfig> {
  const result = {} as Record<BgmTrackId, BgmTrackCustomConfig>;
  for (const id of ALL_BGM_TRACK_IDS) {
    result[id] = buildDefaultTrackConfig(id);
  }
  if (typeof window === 'undefined') return result;

  try {
    const raw = window.localStorage.getItem(BGM_CONFIGS_STORAGE_KEY);
    if (!raw) return result;
    const parsed = JSON.parse(raw) as Partial<Record<BgmTrackId, Partial<BgmTrackCustomConfig>>>;
    for (const id of ALL_BGM_TRACK_IDS) {
      result[id] = normalizeTrackConfig(id, parsed?.[id]);
    }
    return result;
  } catch {
    return result;
  }
}

function loadAudioPrefs(): PersistedAudioPrefs {
  const defaults: PersistedAudioPrefs = {
    muted: false,
    bgmEnabled: true,
    lobbyBgmEnabled: true,
    bgmVolume: 0.55,
    sfxVolume: 0.8,
    celebrationCrowdEnabled: true,
    celebrationVoiceEnabled: true,
    celebrationStyle: 'DYNAMIC',
    customCelebrationFileName: null,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PersistedAudioPrefs>;
    const validStyles: CelebrationAudioStyle[] = ['DYNAMIC', 'STADIUM_EPIC', 'ARCADE_RETRO'];
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : defaults.muted,
      bgmEnabled: typeof parsed.bgmEnabled === 'boolean' ? parsed.bgmEnabled : defaults.bgmEnabled,
      lobbyBgmEnabled:
        typeof parsed.lobbyBgmEnabled === 'boolean'
          ? parsed.lobbyBgmEnabled
          : defaults.lobbyBgmEnabled,
      bgmVolume:
        typeof parsed.bgmVolume === 'number'
          ? Math.max(0, Math.min(1, parsed.bgmVolume))
          : defaults.bgmVolume,
      sfxVolume:
        typeof parsed.sfxVolume === 'number'
          ? Math.max(0, Math.min(1, parsed.sfxVolume))
          : defaults.sfxVolume,
      celebrationCrowdEnabled:
        typeof parsed.celebrationCrowdEnabled === 'boolean'
          ? parsed.celebrationCrowdEnabled
          : defaults.celebrationCrowdEnabled,
      celebrationVoiceEnabled:
        typeof parsed.celebrationVoiceEnabled === 'boolean'
          ? parsed.celebrationVoiceEnabled
          : defaults.celebrationVoiceEnabled,
      celebrationStyle:
        parsed.celebrationStyle && validStyles.includes(parsed.celebrationStyle)
          ? parsed.celebrationStyle
          : defaults.celebrationStyle,
      customCelebrationFileName:
        typeof parsed.customCelebrationFileName === 'string'
          ? parsed.customCelebrationFileName
          : null,
    };
  } catch {
    return defaults;
  }
}

// ============================================================================
// IndexedDB Persistence for User-Uploaded BGM Audio Files (MP3 / WAV / OGG)
// ============================================================================

function openBgmDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(BGM_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(BGM_IDB_STORE)) {
          db.createObjectStore(BGM_IDB_STORE, { keyPath: 'trackId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveBgmBlobToIdb(record: StoredBgmBlobRecord): Promise<void> {
  const db = await openBgmDatabase();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(BGM_IDB_STORE, 'readwrite');
      tx.objectStore(BGM_IDB_STORE).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

async function deleteBgmBlobFromIdb(
  trackId: BgmTrackId | typeof CUSTOM_CELEBRATION_IDB_KEY
): Promise<void> {
  const db = await openBgmDatabase();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(BGM_IDB_STORE, 'readwrite');
      tx.objectStore(BGM_IDB_STORE).delete(trackId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

async function loadAllBgmBlobsFromIdb(): Promise<StoredBgmBlobRecord[]> {
  const db = await openBgmDatabase();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(BGM_IDB_STORE, 'readonly');
      const req = tx.objectStore(BGM_IDB_STORE).getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? (req.result as StoredBgmBlobRecord[]) : [];
        db.close();
        resolve(rows);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}

export function isTrackCustomized(cfg: BgmTrackCustomConfig): boolean {
  const def = buildDefaultTrackConfig(cfg.trackId);
  return (
    cfg.sourceMode === 'CUSTOM_FILE' ||
    Boolean(cfg.customFileName) ||
    cfg.customTitle.trim().length > 0 ||
    cfg.presetId !== 'DEFAULT' ||
    cfg.bpm !== def.bpm ||
    cfg.transposeSemitones !== 0 ||
    cfg.leadWaveform !== 'DEFAULT' ||
    cfg.filterCutoffHz !== def.filterCutoffHz ||
    !cfg.drumsEnabled ||
    !cfg.bassEnabled ||
    !cfg.chordsEnabled ||
    !cfg.leadEnabled ||
    Math.abs(cfg.trackGain - 1.0) > 0.02
  );
}

export function getResolvedTrackDisplay(
  trackId: BgmTrackId,
  configs: Record<BgmTrackId, BgmTrackCustomConfig>
): {
  label: string;
  shortLabel: string;
  bpmLabel: string;
  isCustomFile: boolean;
  isEdited: boolean;
} {
  const base = BGM_TRACK_META[trackId];
  const cfg = configs[trackId] ?? buildDefaultTrackConfig(trackId);
  const customTitle = cfg.customTitle.trim();
  const isCustomFile = cfg.sourceMode === 'CUSTOM_FILE' && Boolean(cfg.customFileName);

  return {
    label: customTitle || base.label,
    shortLabel: customTitle ? customTitle.slice(0, 14) : base.shortLabel,
    bpmLabel: isCustomFile
      ? `Audio ${Math.round(cfg.playbackRate * 100)}%`
      : `${cfg.bpm} BPM`,
    isCustomFile,
    isEdited: isTrackCustomized(cfg),
  };
}

export function isLegendaryCard(card: CardDefinition | null | undefined): boolean {
  if (!card) return false;
  return card.rank === 'SR' || card.rank === 'AR' || card.rank === 'S';
}

export function isFighterCriticalHp(fighter: ActiveFighter | null | undefined): boolean {
  if (!fighter || fighter.currentHp <= 0 || fighter.maxHp <= 0) return false;
  if (fighter.maxHp <= 60) {
    return fighter.currentHp < fighter.maxHp || fighter.currentHp <= 20;
  }
  const ratio = fighter.currentHp / fighter.maxHp;
  return ratio <= 0.35 || fighter.currentHp <= 60;
}

export function getFighterHpVisualState(
  fighter: ActiveFighter,
  defaultHealthyFill: 'emerald' | 'sky' = 'emerald'
): {
  isCritical: boolean;
  isCaution: boolean;
  barFillClass: string;
  labelClass: string;
} {
  const isCritical = isFighterCriticalHp(fighter);
  const ratio = fighter.currentHp / Math.max(1, fighter.maxHp);
  const isCaution = !isCritical && ratio <= 0.6;

  if (isCritical) {
    return {
      isCritical: true,
      isCaution: false,
      barFillClass: 'fill-rose-500 transition-all duration-200',
      labelClass: 'text-rose-400',
    };
  }
  if (isCaution) {
    return {
      isCritical: false,
      isCaution: true,
      barFillClass: 'fill-amber-400 transition-all duration-200',
      labelClass: 'text-amber-300',
    };
  }
  return {
    isCritical: false,
    isCaution: false,
    barFillClass:
      defaultHealthyFill === 'sky'
        ? 'fill-sky-400 transition-all duration-200'
        : 'fill-emerald-400 transition-all duration-200',
    labelClass: 'text-rose-300',
  };
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface ActiveTrackChannel {
  track: BgmTrackId;
  mode: BgmSourceMode;
  gainNode: GainNode;
  bufferSource?: AudioBufferSourceNode;
}

// ============================================================================
// Musical Pattern Tables (64-step = 4-bar 16th-note phrasing per BGM Track)
// ============================================================================

const MENU_CHORDS: number[][] = [
  [50, 57, 60, 64], // Dm9
  [46, 53, 57, 62], // Bbmaj7
  [48, 55, 57, 62], // C6/9
  [45, 52, 55, 60], // Am7
];
const MENU_ARP: Array<number | null> = [
  74, null, 69, null, 76, null, 72, null, 74, null, 81, null, 76, null, 72, null,
  74, null, 69, null, 77, null, 74, null, 72, null, 69, null, 65, null, 69, null,
  76, null, 72, null, 79, null, 74, null, 76, null, 84, null, 79, null, 74, null,
  72, null, 69, null, 76, null, 72, null, 69, null, 67, null, 64, null, 67, null,
];

const NORMAL_BASS_ROOTS = [33, 29, 31, 28];
const NORMAL_CHORDS: number[][] = [
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
  [52, 55, 59],
];
const NORMAL_LEAD: Array<number | null> = [
  69, null, null, 72, null, null, 76, null, 74, null, 72, null, 71, null, 67, null,
  69, null, null, 72, null, null, 77, null, 76, null, 72, null, 74, null, null, null,
  71, null, null, 74, null, null, 79, null, 76, null, 74, null, 72, null, 71, null,
  69, null, 72, null, 71, null, 67, null, 64, null, null, null, 67, null, 71, null,
];

const CRITICAL_BASS_ROOTS = [36, 32, 29, 31];
const CRITICAL_CHORDS: number[][] = [
  [60, 63, 67],
  [56, 60, 63],
  [53, 56, 60],
  [55, 59, 62, 68],
];
const CRITICAL_LEAD: Array<number | null> = [
  72, null, 75, 74, 72, null, 79, null, 72, null, 75, 74, 72, null, 71, null,
  68, null, 72, null, 75, null, 80, null, 79, null, 75, null, 74, null, 72, null,
  65, null, 68, null, 72, null, 77, null, 75, null, 74, null, 72, null, 68, null,
  67, null, 71, null, 74, null, 80, null, 79, 78, 79, null, 83, null, 84, null,
];

const LEGENDARY_BASS_ROOTS = [38, 34, 36, 33];
const LEGENDARY_CHORDS: number[][] = [
  [50, 57, 62, 66],
  [46, 53, 58, 62],
  [48, 55, 60, 64],
  [45, 52, 57, 61],
];
const LEGENDARY_LEAD: Array<number | null> = [
  74, null, null, 74, 81, null, null, null, 79, null, 78, null, 76, null, 74, null,
  70, null, null, 74, 77, null, 82, null, 81, null, 77, null, 74, null, null, null,
  72, null, null, 76, 79, null, 84, null, 82, null, 79, null, 76, null, 79, null,
  81, null, null, null, 81, null, 83, null, 85, null, null, null, 86, null, 81, null,
];

const VICTORY_BASS_ROOTS = [36, 31, 33, 29];
const VICTORY_CHORDS: number[][] = [
  [60, 64, 67],
  [55, 59, 62],
  [57, 60, 64],
  [53, 57, 60],
];
const VICTORY_LEAD: Array<number | null> = [
  72, null, 76, null, 79, null, 84, null, 83, null, 79, null, 76, null, null, null,
  74, null, 79, null, 83, null, 86, null, 84, null, 79, null, 74, null, null, null,
  76, null, 81, null, 84, null, 88, null, 86, null, 84, null, 81, null, 79, null,
  77, null, 81, null, 84, null, 86, null, 84, null, null, null, null, null, null, null,
];

const DEFEAT_CHORDS: number[][] = [
  [57, 60, 64],
  [53, 57, 60],
  [50, 53, 57],
  [52, 56, 59],
];
const DEFEAT_ARP: Array<number | null> = [
  69, null, null, null, 72, null, null, null, 69, null, null, null, 64, null, null, null,
  65, null, null, null, 69, null, null, null, 72, null, null, null, 69, null, null, null,
  62, null, null, null, 65, null, null, null, 69, null, null, null, 65, null, null, null,
  64, null, null, null, 68, null, null, null, 71, null, null, null, null, null, null, null,
];

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmBusGain: GainNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;
  private sfxBusGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private activeChannel: ActiveTrackChannel | null = null;
  private fadingChannels: Set<GainNode> = new Set();

  private rawCustomBuffers = new Map<BgmTrackId, ArrayBuffer>();
  private decodedCustomBuffers = new Map<BgmTrackId, AudioBuffer>();
  private decodingTracks = new Set<BgmTrackId>();
  private rawCustomCelebrationBuf: ArrayBuffer | null = null;
  private decodedCustomCelebrationBuf: AudioBuffer | null = null;
  private decodingCelebrationBuf = false;

  private schedulerTimer: number | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;
  private unlockListenersBound = false;

  private _muted: boolean;
  private _bgmEnabled: boolean;
  private _lobbyBgmEnabled: boolean;
  private _bgmVolume: number;
  private _sfxVolume: number;
  private _celebrationCrowdEnabled: boolean;
  private _celebrationVoiceEnabled: boolean;
  private _celebrationStyle: CelebrationAudioStyle;
  private _customCelebrationFileName: string | null;

  private _controlMode: BgmControlMode = 'AUTO';
  private _autoTrack: BgmTrackId = 'MENU';
  private _contextUnlocked = false;
  private _activeBanner: AudioEventBanner | null = null;
  private bannerSeq = 0;
  private bannerTimer: number | null = null;

  private _studioOpen = false;
  private _studioTrack: BgmTrackId = 'BATTLE_NORMAL';
  private _trackConfigs: Record<BgmTrackId, BgmTrackCustomConfig>;

  private listeners = new Set<() => void>();
  private cachedSnapshot: AudioSnapshot;

  constructor() {
    const prefs = loadAudioPrefs();
    this._muted = prefs.muted;
    this._bgmEnabled = prefs.bgmEnabled;
    this._lobbyBgmEnabled = prefs.lobbyBgmEnabled;
    this._bgmVolume = prefs.bgmVolume;
    this._sfxVolume = prefs.sfxVolume;
    this._celebrationCrowdEnabled = prefs.celebrationCrowdEnabled;
    this._celebrationVoiceEnabled = prefs.celebrationVoiceEnabled;
    this._celebrationStyle = prefs.celebrationStyle;
    this._customCelebrationFileName = prefs.customCelebrationFileName;
    this._trackConfigs = loadTrackConfigs();

    this.cachedSnapshot = this.buildSnapshot();
    this.bindGlobalUnlockListeners();
    void this.hydrateCustomBlobsFromIdb();
  }

  private async hydrateCustomBlobsFromIdb(): Promise<void> {
    const records = await loadAllBgmBlobsFromIdb();
    if (records.length === 0) return;

    let changed = false;
    let prefsChanged = false;
    for (const rec of records) {
      if (rec.trackId === CUSTOM_CELEBRATION_IDB_KEY) {
        try {
          this.rawCustomCelebrationBuf = await rec.blob.arrayBuffer();
          if (this._customCelebrationFileName !== rec.fileName) {
            this._customCelebrationFileName = rec.fileName;
            prefsChanged = true;
          }
        } catch {
          // Ignore corrupted celebration SFX blob
        }
        continue;
      }

      if (!ALL_BGM_TRACK_IDS.includes(rec.trackId)) continue;
      try {
        const arrBuf = await rec.blob.arrayBuffer();
        this.rawCustomBuffers.set(rec.trackId, arrBuf);
        const curCfg = this._trackConfigs[rec.trackId];
        if (curCfg && curCfg.customFileName !== rec.fileName) {
          this._trackConfigs = {
            ...this._trackConfigs,
            [rec.trackId]: {
              ...curCfg,
              customFileName: rec.fileName,
            },
          };
          changed = true;
        }
      } catch {
        // Ignore corrupted blob
      }
    }

    if (this.ctx) {
      await this.decodePendingCustomBuffers();
    }
    if (prefsChanged) {
      this.persistPrefs();
    }
    if (changed) {
      this.persistTrackConfigs();
    }
    if (changed || prefsChanged) {
      this.emitChange();
    }
  }

  private async decodePendingCustomBuffers(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;

    if (
      this.rawCustomCelebrationBuf &&
      !this.decodedCustomCelebrationBuf &&
      !this.decodingCelebrationBuf
    ) {
      this.decodingCelebrationBuf = true;
      try {
        this.decodedCustomCelebrationBuf = await ctx.decodeAudioData(
          this.rawCustomCelebrationBuf.slice(0)
        );
      } catch {
        // Ignore decode failure
      } finally {
        this.decodingCelebrationBuf = false;
      }
    }

    let decodedAny = false;
    for (const [trackId, rawBuf] of this.rawCustomBuffers.entries()) {
      if (this.decodedCustomBuffers.has(trackId) || this.decodingTracks.has(trackId)) {
        continue;
      }
      this.decodingTracks.add(trackId);
      try {
        const audioBuf = await ctx.decodeAudioData(rawBuf.slice(0));
        this.decodedCustomBuffers.set(trackId, audioBuf);
        const cur = this._trackConfigs[trackId];
        if (cur && Math.abs(cur.customDurationSec - audioBuf.duration) > 0.05) {
          this._trackConfigs = {
            ...this._trackConfigs,
            [trackId]: {
              ...cur,
              customDurationSec: audioBuf.duration,
            },
          };
        }
        decodedAny = true;
      } catch {
        // Ignore decode failure
      } finally {
        this.decodingTracks.delete(trackId);
      }
    }

    if (decodedAny) {
      this.persistTrackConfigs();
      this.syncBgmChannel(true);
      this.emitChange();
    }
  }

  private computeEffectiveTrack(): BgmTrackId {
    return this._controlMode === 'AUTO' ? this._autoTrack : this._controlMode;
  }

  private resolvePlaybackModeForTrack(track: BgmTrackId): BgmSourceMode {
    const cfg = this._trackConfigs[track];
    if (cfg?.sourceMode === 'CUSTOM_FILE' && this.decodedCustomBuffers.has(track)) {
      return 'CUSTOM_FILE';
    }
    return 'SYNTH';
  }

  private isTrackAudible(track: BgmTrackId): boolean {
    if (this._muted || !this._bgmEnabled || this._bgmVolume <= 0.001) return false;
    if (this._controlMode === 'AUTO' && track === 'MENU' && !this._lobbyBgmEnabled) {
      return false;
    }
    return true;
  }

  private buildSnapshot(): AudioSnapshot {
    const effectiveTrack = this.computeEffectiveTrack();
    return {
      muted: this._muted,
      bgmEnabled: this._bgmEnabled,
      lobbyBgmEnabled: this._lobbyBgmEnabled,
      bgmVolume: this._bgmVolume,
      sfxVolume: this._sfxVolume,
      celebrationCrowdEnabled: this._celebrationCrowdEnabled,
      celebrationVoiceEnabled: this._celebrationVoiceEnabled,
      celebrationStyle: this._celebrationStyle,
      customCelebrationFileName: this._customCelebrationFileName,
      controlMode: this._controlMode,
      autoTrack: this._autoTrack,
      effectiveTrack,
      contextUnlocked: this._contextUnlocked,
      activeBanner: this._activeBanner,
      studioOpen: this._studioOpen,
      studioTrack: this._studioTrack,
      trackConfigs: this._trackConfigs,
    };
  }

  private emitChange(): void {
    this.cachedSnapshot = this.buildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  private persistPrefs(): void {
    if (typeof window === 'undefined') return;
    try {
      const payload: PersistedAudioPrefs = {
        muted: this._muted,
        bgmEnabled: this._bgmEnabled,
        lobbyBgmEnabled: this._lobbyBgmEnabled,
        bgmVolume: this._bgmVolume,
        sfxVolume: this._sfxVolume,
        celebrationCrowdEnabled: this._celebrationCrowdEnabled,
        celebrationVoiceEnabled: this._celebrationVoiceEnabled,
        celebrationStyle: this._celebrationStyle,
        customCelebrationFileName: this._customCelebrationFileName,
      };
      window.localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }

  private persistTrackConfigs(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(BGM_CONFIGS_STORAGE_KEY, JSON.stringify(this._trackConfigs));
    } catch {
      // Ignore storage quota errors
    }
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): AudioSnapshot => {
    return this.cachedSnapshot;
  };

  private bindGlobalUnlockListeners(): void {
    if (this.unlockListenersBound || typeof window === 'undefined') return;
    this.unlockListenersBound = true;

    const unlock = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.getVoices();
        } catch {
          // Ignore speechSynthesis access issues
        }
      }
      const ctx = this.ensureGraph();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx
          .resume()
          .then(() => {
            if (!this._contextUnlocked && ctx.state === 'running') {
              this._contextUnlocked = true;
              this.syncBgmChannel();
              this.emitChange();
            }
          })
          .catch(() => {});
      } else if (ctx.state === 'running' && !this._contextUnlocked) {
        this._contextUnlocked = true;
        this.syncBgmChannel();
        this.emitChange();
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  private ensureGraph(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, ctx.currentTime);
      compressor.knee.setValueAtTime(18, ctx.currentTime);
      compressor.ratio.setValueAtTime(4, ctx.currentTime);
      compressor.attack.setValueAtTime(0.004, ctx.currentTime);
      compressor.release.setValueAtTime(0.18, ctx.currentTime);
      compressor.connect(ctx.destination);

      const master = ctx.createGain();
      master.gain.setValueAtTime(this._muted ? 0 : 1, ctx.currentTime);
      master.connect(compressor);
      this.masterGain = master;

      const bgmFilter = ctx.createBiquadFilter();
      bgmFilter.type = 'lowpass';
      bgmFilter.frequency.setValueAtTime(4200, ctx.currentTime);
      bgmFilter.Q.setValueAtTime(0.7, ctx.currentTime);
      bgmFilter.connect(master);
      this.bgmFilter = bgmFilter;

      const bgmBus = ctx.createGain();
      bgmBus.gain.setValueAtTime(this._bgmEnabled ? this._bgmVolume : 0, ctx.currentTime);
      bgmBus.connect(bgmFilter);
      this.bgmBusGain = bgmBus;

      const sfxBus = ctx.createGain();
      sfxBus.gain.setValueAtTime(this._sfxVolume, ctx.currentTime);
      sfxBus.connect(master);
      this.sfxBusGain = sfxBus;

      const bufferSize = ctx.sampleRate;
      const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = noiseBuf;

      ctx.onstatechange = () => {
        const unlocked = ctx.state === 'running';
        if (unlocked !== this._contextUnlocked) {
          this._contextUnlocked = unlocked;
          if (unlocked) {
            void this.decodePendingCustomBuffers();
            this.syncBgmChannel();
          }
          this.emitChange();
        }
      };

      void this.decodePendingCustomBuffers();
      this.startLookaheadScheduler();
    }

    if (this.ctx.state === 'suspended' && !this._muted) {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private getSfxTarget(): { ctx: AudioContext; out: AudioNode } | null {
    if (this._muted || this._sfxVolume <= 0.001) return null;
    const ctx = this.ensureGraph();
    if (!ctx || !this.sfxBusGain) return null;
    return { ctx, out: this.sfxBusGain };
  }

  private applyGainLevels(): void {
    if (!this.ctx || !this.masterGain || !this.bgmBusGain || !this.sfxBusGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this._muted ? 0 : 1, now, 0.03);

    const effectiveTrack = this.computeEffectiveTrack();
    const targetBgm = this.isTrackAudible(effectiveTrack) ? this._bgmVolume : 0;
    this.bgmBusGain.gain.cancelScheduledValues(now);
    this.bgmBusGain.gain.setTargetAtTime(targetBgm, now, 0.06);

    const cfg = this._trackConfigs[effectiveTrack];
    if (this.bgmFilter && cfg) {
      const cutoff = cfg.sourceMode === 'CUSTOM_FILE' ? 18000 : cfg.filterCutoffHz;
      this.bgmFilter.frequency.setTargetAtTime(cutoff, now, 0.1);
    }

    if (this.activeChannel && this.activeChannel.track === effectiveTrack && cfg) {
      this.activeChannel.gainNode.gain.setTargetAtTime(cfg.trackGain, now, 0.08);
      if (this.activeChannel.bufferSource) {
        this.activeChannel.bufferSource.playbackRate.setTargetAtTime(
          cfg.playbackRate,
          now,
          0.05
        );
        const audioBuf = this.decodedCustomBuffers.get(effectiveTrack);
        if (audioBuf) {
          const safeStart = Math.max(0, Math.min(cfg.loopStartSec, Math.max(0, audioBuf.duration - 0.25)));
          const safeEnd =
            cfg.loopEndSec > safeStart + 0.25
              ? Math.min(cfg.loopEndSec, audioBuf.duration)
              : audioBuf.duration;
          this.activeChannel.bufferSource.loopStart = safeStart;
          this.activeChannel.bufferSource.loopEnd = safeEnd;
        }
      }
    }

    this.sfxBusGain.gain.cancelScheduledValues(now);
    this.sfxBusGain.gain.setTargetAtTime(this._sfxVolume, now, 0.03);
  }

  private duckBgm(duckFactor: number, holdSeconds: number): void {
    if (!this.ctx || !this.bgmBusGain) return;
    const effectiveTrack = this.computeEffectiveTrack();
    if (!this.isTrackAudible(effectiveTrack)) return;

    const now = this.ctx.currentTime;
    const baseVol = this._bgmVolume;
    const ducked = Math.max(0.02, baseVol * duckFactor);

    this.bgmBusGain.gain.cancelScheduledValues(now);
    this.bgmBusGain.gain.setValueAtTime(baseVol, now);
    this.bgmBusGain.gain.linearRampToValueAtTime(ducked, now + 0.04);
    this.bgmBusGain.gain.setValueAtTime(ducked, now + holdSeconds);
    this.bgmBusGain.gain.linearRampToValueAtTime(baseVol, now + holdSeconds + 0.45);
  }

  private syncBgmChannel(forceRestart = false): void {
    if (!this.ctx || !this.bgmBusGain) return;
    const desiredTrack = this.computeEffectiveTrack();
    const desiredMode = this.resolvePlaybackModeForTrack(desiredTrack);
    const audible = this.isTrackAudible(desiredTrack);
    const now = this.ctx.currentTime;

    this.applyGainLevels();

    if (!audible) {
      if (this.activeChannel) {
        this.fadeOutChannel(this.activeChannel, 0.25);
        this.activeChannel = null;
      }
      return;
    }

    if (
      !forceRestart &&
      this.activeChannel &&
      this.activeChannel.track === desiredTrack &&
      this.activeChannel.mode === desiredMode
    ) {
      return;
    }

    if (this.activeChannel) {
      this.fadeOutChannel(this.activeChannel, 0.38);
      this.activeChannel = null;
    }

    const cfg = this._trackConfigs[desiredTrack] ?? buildDefaultTrackConfig(desiredTrack);
    const nextGain = this.ctx.createGain();
    nextGain.gain.setValueAtTime(0.0001, now);
    nextGain.gain.linearRampToValueAtTime(cfg.trackGain, now + 0.35);
    nextGain.connect(this.bgmBusGain);

    if (desiredMode === 'CUSTOM_FILE') {
      const audioBuf = this.decodedCustomBuffers.get(desiredTrack);
      if (audioBuf) {
        const src = this.ctx.createBufferSource();
        src.buffer = audioBuf;
        src.loop = true;

        const safeStart = Math.max(
          0,
          Math.min(cfg.loopStartSec, Math.max(0, audioBuf.duration - 0.25))
        );
        const safeEnd =
          cfg.loopEndSec > safeStart + 0.25
            ? Math.min(cfg.loopEndSec, audioBuf.duration)
            : audioBuf.duration;

        src.loopStart = safeStart;
        src.loopEnd = safeEnd;
        src.playbackRate.setValueAtTime(cfg.playbackRate, now);
        src.connect(nextGain);
        src.start(now, safeStart);

        this.activeChannel = {
          track: desiredTrack,
          mode: 'CUSTOM_FILE',
          gainNode: nextGain,
          bufferSource: src,
        };

        if (this.bgmFilter) {
          this.bgmFilter.frequency.setTargetAtTime(18000, now, 0.08);
        }
        return;
      }
    }

    this.activeChannel = {
      track: desiredTrack,
      mode: 'SYNTH',
      gainNode: nextGain,
    };

    this.stepIndex = 0;
    this.nextStepTime = Math.max(now + 0.03, this.nextStepTime);

    if (this.bgmFilter) {
      this.bgmFilter.frequency.setTargetAtTime(cfg.filterCutoffHz, now, 0.12);
    }
  }

  private fadeOutChannel(channel: ActiveTrackChannel, durationSec: number): void {
    if (!this.ctx) return;
    const { gainNode, bufferSource } = channel;
    const now = this.ctx.currentTime;
    this.fadingChannels.add(gainNode);
    try {
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), now);
      gainNode.gain.linearRampToValueAtTime(0.0001, now + durationSec);
    } catch {
      // Ignore automation race
    }
    window.setTimeout(() => {
      try {
        if (bufferSource) {
          bufferSource.stop();
          bufferSource.disconnect();
        }
      } catch {
        // Ignore stop race
      }
      try {
        gainNode.disconnect();
      } catch {
        // Ignore disconnect error
      }
      this.fadingChannels.delete(gainNode);
    }, Math.ceil((durationSec + 0.08) * 1000));
  }

  private startLookaheadScheduler(): void {
    if (this.schedulerTimer !== null || typeof window === 'undefined') return;
    this.schedulerTimer = window.setInterval(() => {
      this.schedulerTick();
    }, 40);
  }

  private schedulerTick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    const effectiveTrack = this.computeEffectiveTrack();
    if (!this.isTrackAudible(effectiveTrack)) {
      this.nextStepTime = ctx.currentTime + 0.05;
      return;
    }

    const desiredMode = this.resolvePlaybackModeForTrack(effectiveTrack);
    if (
      !this.activeChannel ||
      this.activeChannel.track !== effectiveTrack ||
      this.activeChannel.mode !== desiredMode
    ) {
      this.syncBgmChannel();
    }
    if (!this.activeChannel || this.activeChannel.mode !== 'SYNTH') {
      this.nextStepTime = ctx.currentTime + 0.05;
      return;
    }

    const cfg = this._trackConfigs[effectiveTrack] ?? buildDefaultTrackConfig(effectiveTrack);
    const bpm = cfg.bpm;
    const stepDuration = 60 / bpm / 4;
    const now = ctx.currentTime;

    if (this.nextStepTime < now - 0.15) {
      this.nextStepTime = now + 0.02;
    }

    const scheduleAhead = 0.12;
    while (this.nextStepTime < now + scheduleAhead) {
      this.scheduleTrackStep(
        ctx,
        this.activeChannel.gainNode,
        effectiveTrack,
        cfg,
        this.stepIndex,
        this.nextStepTime,
        stepDuration
      );
      this.nextStepTime += stepDuration;
      this.stepIndex = (this.stepIndex + 1) % 64;
    }
  }

  // ==========================================================================
  // Instrument Synthesis Primitives for Dynamic & Editable BGM
  // ==========================================================================

  private playSynthTone(
    ctx: AudioContext,
    dest: AudioNode,
    params: {
      freq: number;
      time: number;
      duration: number;
      type: OscillatorType;
      gain: number;
      attack?: number;
      detuneCents?: number;
      filterHz?: number;
    }
  ): void {
    const {
      freq,
      time,
      duration,
      type,
      gain: peakGain,
      attack = 0.01,
      detuneCents = 0,
      filterHz,
    } = params;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (detuneCents !== 0) {
      osc.detune.setValueAtTime(detuneCents, time);
    }

    const stopAt = time + Math.max(0.03, duration);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peakGain, time + Math.min(attack, duration * 0.45));
    env.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    if (filterHz) {
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(filterHz, time);
      osc.connect(flt);
      flt.connect(env);
      osc.onended = () => {
        flt.disconnect();
        env.disconnect();
      };
    } else {
      osc.connect(env);
      osc.onended = () => {
        env.disconnect();
      };
    }

    env.connect(dest);
    osc.start(time);
    osc.stop(stopAt + 0.01);
  }

  private playKick(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    punch = 0.22,
    startFreq = 135
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.13);

    gain.gain.setValueAtTime(punch, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);

    osc.connect(gain);
    gain.connect(dest);
    osc.onended = () => gain.disconnect();
    osc.start(time);
    osc.stop(time + 0.16);
  }

  private playNoisePerc(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    duration: number,
    peakGain: number,
    bandFreq: number,
    type: BiquadFilterType = 'highpass'
  ): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(bandFreq, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    const offset = (this.stepIndex * 0.037) % 0.6;
    src.onended = () => {
      filter.disconnect();
      gain.disconnect();
    };
    src.start(time, offset, duration + 0.01);
  }

  private resolveLeadOsc(
    cfg: BgmTrackCustomConfig,
    fallback: OscillatorType
  ): OscillatorType {
    return cfg.leadWaveform === 'DEFAULT' ? fallback : cfg.leadWaveform;
  }

  private scheduleTrackStep(
    ctx: AudioContext,
    dest: AudioNode,
    track: BgmTrackId,
    cfg: BgmTrackCustomConfig,
    step: number,
    time: number,
    stepDur: number
  ): void {
    const bar = Math.floor(step / 16) % 4;
    const stepInBar = step % 16;
    const tr = cfg.transposeSemitones;

    if (track === 'MENU') {
      const chord = MENU_CHORDS[bar];
      if (stepInBar === 0) {
        if (cfg.chordsEnabled) {
          chord.forEach((midi, idx) => {
            this.playSynthTone(ctx, dest, {
              freq: midiToFreq(midi + tr),
              time,
              duration: stepDur * 15.5,
              type: idx % 2 === 0 ? 'sine' : 'triangle',
              gain: 0.045,
              attack: 0.28,
              detuneCents: idx * 3 - 3,
              filterHz: Math.min(cfg.filterCutoffHz, 2200),
            });
          });
        }
        if (cfg.bassEnabled) {
          this.playSynthTone(ctx, dest, {
            freq: midiToFreq(chord[0] - 12 + tr),
            time,
            duration: stepDur * 14,
            type: 'sine',
            gain: 0.075,
            attack: 0.18,
          });
        }
      }

      if (cfg.drumsEnabled && (stepInBar === 0 || stepInBar === 8) && cfg.presetId !== 'DEFAULT') {
        this.playKick(ctx, dest, time, 0.12, 110);
      }

      const arpNote = MENU_ARP[step];
      if (cfg.leadEnabled && arpNote !== null) {
        const wave = this.resolveLeadOsc(cfg, 'sine');
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq(arpNote + tr),
          time,
          duration: stepDur * 2.8,
          type: wave,
          gain: wave === 'square' || wave === 'sawtooth' ? 0.028 : 0.04,
          attack: 0.015,
          filterHz: cfg.filterCutoffHz,
        });
      }
      return;
    }

    if (track === 'BATTLE_NORMAL') {
      const root = NORMAL_BASS_ROOTS[bar] + tr;

      if (cfg.drumsEnabled) {
        if (stepInBar === 0 || stepInBar === 6 || stepInBar === 8 || stepInBar === 14) {
          this.playKick(ctx, dest, time, stepInBar === 14 ? 0.14 : 0.2, 130);
        }
        if (stepInBar === 4 || stepInBar === 12) {
          this.playNoisePerc(ctx, dest, time, 0.11, 0.075, 1800, 'bandpass');
        }
        if (stepInBar % 2 === 0) {
          this.playNoisePerc(ctx, dest, time, 0.04, stepInBar % 4 === 2 ? 0.036 : 0.02, 6500);
        }
      }

      if (cfg.bassEnabled && (stepInBar % 2 === 0 || stepInBar === 7 || stepInBar === 15)) {
        const octaveUp =
          stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14;
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq(octaveUp ? root + 12 : root),
          time,
          duration: stepDur * 1.5,
          type: cfg.presetId === 'CHIPTUNE_8BIT' ? 'square' : 'sawtooth',
          gain: cfg.presetId === 'CHIPTUNE_8BIT' ? 0.075 : 0.095,
          attack: 0.008,
          filterHz: 560,
        });
      }

      if (cfg.chordsEnabled && (stepInBar === 0 || stepInBar === 8)) {
        NORMAL_CHORDS[bar].forEach((midi) => {
          this.playSynthTone(ctx, dest, {
            freq: midiToFreq(midi + tr),
            time,
            duration: stepDur * 7.2,
            type: 'triangle',
            gain: 0.036,
            attack: 0.05,
            filterHz: Math.min(cfg.filterCutoffHz, 2200),
          });
        });
      }

      const lead = NORMAL_LEAD[step];
      if (cfg.leadEnabled && lead !== null) {
        const wave = this.resolveLeadOsc(cfg, 'triangle');
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq(lead + tr),
          time,
          duration: stepDur * 2.2,
          type: wave,
          gain: wave === 'square' || wave === 'sawtooth' ? 0.052 : 0.068,
          attack: 0.01,
          filterHz: cfg.filterCutoffHz,
        });
      }
      return;
    }

    if (track === 'BATTLE_CRITICAL') {
      const root = CRITICAL_BASS_ROOTS[bar] + tr;

      if (cfg.drumsEnabled) {
        if (stepInBar === 0 || stepInBar === 3 || stepInBar === 8 || stepInBar === 11) {
          const isFirstPulse = stepInBar === 0 || stepInBar === 8;
          this.playKick(ctx, dest, time, isFirstPulse ? 0.25 : 0.19, isFirstPulse ? 155 : 125);
        }
        if (stepInBar === 4 || stepInBar === 12 || (bar === 3 && stepInBar >= 13)) {
          this.playNoisePerc(
            ctx,
            dest,
            time,
            0.1,
            bar === 3 && stepInBar >= 13 ? 0.065 : 0.095,
            2100,
            'bandpass'
          );
        }
        this.playNoisePerc(ctx, dest, time, 0.032, stepInBar % 2 === 0 ? 0.034 : 0.018, 7200);
      }

      if (cfg.bassEnabled) {
        const bassMidi =
          stepInBar % 4 === 0
            ? root
            : stepInBar % 4 === 2
            ? root + 12
            : stepInBar === 15
            ? root + 11
            : root + 7;
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq(bassMidi),
          time,
          duration: stepDur * 0.92,
          type: cfg.presetId === 'CHIPTUNE_8BIT' ? 'square' : 'sawtooth',
          gain: cfg.presetId === 'CHIPTUNE_8BIT' ? 0.08 : 0.105,
          attack: 0.005,
          filterHz: 780,
        });
      }

      if (cfg.chordsEnabled && (stepInBar === 0 || stepInBar === 6 || stepInBar === 12)) {
        CRITICAL_CHORDS[bar].forEach((midi) => {
          this.playSynthTone(ctx, dest, {
            freq: midiToFreq(midi + tr),
            time,
            duration: stepDur * 2.4,
            type: 'sawtooth',
            gain: 0.042,
            attack: 0.006,
            filterHz: Math.min(cfg.filterCutoffHz, 2600),
          });
        });
      }

      if (cfg.chordsEnabled && stepInBar === 0 && (bar === 0 || bar === 2)) {
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq((bar === 0 ? 84 : 83) + tr),
          time,
          duration: stepDur * 2.2,
          type: 'sine',
          gain: 0.042,
          attack: 0.006,
        });
      }

      const lead = CRITICAL_LEAD[step];
      if (cfg.leadEnabled && lead !== null) {
        const wave = this.resolveLeadOsc(cfg, 'sawtooth');
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq(lead + tr),
          time,
          duration: stepDur * 1.65,
          type: wave,
          gain: wave === 'square' ? 0.055 : 0.068,
          attack: 0.006,
          detuneCents: 6,
          filterHz: cfg.filterCutoffHz,
        });
      }
      return;
    }

    if (track === 'BATTLE_LEGENDARY') {
      const root = LEGENDARY_BASS_ROOTS[bar] + tr;
      const chord = LEGENDARY_CHORDS[bar];

      if (cfg.drumsEnabled) {
        if (stepInBar === 0 || stepInBar === 6 || stepInBar === 8 || stepInBar === 10) {
          this.playKick(ctx, dest, time, 0.23, 145);
        }
        if (stepInBar === 4 || stepInBar === 12) {
          this.playNoisePerc(ctx, dest, time, 0.14, 0.095, 1950, 'bandpass');
        }
        if (stepInBar === 0 && bar === 0) {
          this.playNoisePerc(ctx, dest, time, 0.42, 0.055, 5200);
        } else if (stepInBar % 2 === 0) {
          this.playNoisePerc(ctx, dest, time, 0.055, 0.032, 6600);
        }
      }

      if (cfg.bassEnabled && stepInBar !== 5 && stepInBar !== 13) {
        const up = stepInBar % 2 === 1;
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq(up ? root + 12 : root),
          time,
          duration: stepDur * 0.95,
          type: cfg.presetId === 'CHIPTUNE_8BIT' ? 'square' : 'sawtooth',
          gain: cfg.presetId === 'CHIPTUNE_8BIT' ? 0.078 : 0.098,
          attack: 0.006,
          filterHz: 680,
        });
      }

      if (cfg.chordsEnabled && (stepInBar === 0 || stepInBar === 6 || stepInBar === 12)) {
        const holdSteps = stepInBar === 0 ? 5.6 : stepInBar === 6 ? 5.6 : 3.8;
        chord.forEach((midi, idx) => {
          this.playSynthTone(ctx, dest, {
            freq: midiToFreq(midi + tr),
            time,
            duration: stepDur * holdSteps,
            type: idx === 0 ? 'sawtooth' : 'triangle',
            gain: 0.048,
            attack: 0.02,
            detuneCents: idx % 2 === 0 ? -5 : 5,
            filterHz: Math.min(cfg.filterCutoffHz, 3200),
          });
        });
      }

      const lead = LEGENDARY_LEAD[step];
      if (cfg.leadEnabled && lead !== null) {
        const isSustained = step + 1 < 64 && LEGENDARY_LEAD[step + 1] === null ? 2.8 : 1.4;
        const primaryWave = this.resolveLeadOsc(cfg, 'sawtooth');
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq(lead + tr),
          time,
          duration: stepDur * isSustained,
          type: primaryWave,
          gain: primaryWave === 'square' ? 0.048 : 0.062,
          attack: 0.012,
          detuneCents: -6,
          filterHz: cfg.filterCutoffHz,
        });
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq(lead + tr),
          time,
          duration: stepDur * isSustained,
          type: 'triangle',
          gain: 0.055,
          attack: 0.012,
          detuneCents: 6,
        });
      }
      return;
    }

    if (track === 'VICTORY') {
      const root = VICTORY_BASS_ROOTS[bar] + tr;
      if (stepInBar === 0 || stepInBar === 8) {
        if (cfg.drumsEnabled) {
          this.playKick(ctx, dest, time, 0.18, 130);
        }
        if (cfg.chordsEnabled) {
          VICTORY_CHORDS[bar].forEach((midi) => {
            this.playSynthTone(ctx, dest, {
              freq: midiToFreq(midi + tr),
              time,
              duration: stepDur * 7.5,
              type: 'triangle',
              gain: 0.048,
              attack: 0.03,
            });
          });
        }
      }
      if (cfg.drumsEnabled && (stepInBar === 4 || stepInBar === 12)) {
        this.playNoisePerc(ctx, dest, time, 0.1, 0.055, 2200, 'bandpass');
      }
      if (cfg.bassEnabled && stepInBar % 4 === 0) {
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq(root + 12),
          time,
          duration: stepDur * 3.2,
          type: 'triangle',
          gain: 0.085,
          attack: 0.01,
        });
      }
      const lead = VICTORY_LEAD[step];
      if (cfg.leadEnabled && lead !== null) {
        const wave = this.resolveLeadOsc(cfg, 'triangle');
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq(lead + tr),
          time,
          duration: stepDur * 2.4,
          type: wave,
          gain: wave === 'square' || wave === 'sawtooth' ? 0.05 : 0.068,
          attack: 0.012,
          filterHz: cfg.filterCutoffHz,
        });
      }
      return;
    }

    // DEFEAT
    if (cfg.chordsEnabled && stepInBar === 0) {
      DEFEAT_CHORDS[bar].forEach((midi) => {
        this.playSynthTone(ctx, dest, {
          freq: midiToFreq(midi + tr),
          time,
          duration: stepDur * 15,
          type: 'sine',
          gain: 0.045,
          attack: 0.22,
        });
      });
    }
    const arp = DEFEAT_ARP[step];
    if (cfg.leadEnabled && arp !== null) {
      const wave = this.resolveLeadOsc(cfg, 'triangle');
      this.playSynthTone(ctx, dest, {
        freq: midiToFreq(arp + tr),
        time,
        duration: stepDur * 3.8,
        type: wave,
        gain: wave === 'square' || wave === 'sawtooth' ? 0.034 : 0.045,
        attack: 0.02,
        filterHz: cfg.filterCutoffHz,
      });
    }
  }

  // ==========================================================================
  // Public BGM Studio & Track Editing Methods
  // ==========================================================================

  public openBgmStudio(initialTrack?: BgmTrackId): void {
    this._studioOpen = true;
    this._studioTrack = initialTrack ?? this.computeEffectiveTrack();
    this.ensureGraph();
    this.emitChange();
  }

  public closeBgmStudio(): void {
    if (!this._studioOpen) return;
    this._studioOpen = false;
    this.emitChange();
  }

  public setStudioTrack(track: BgmTrackId, previewNow = false): void {
    this._studioTrack = track;
    if (previewNow) {
      this._controlMode = track;
      if (!this._bgmEnabled) this._bgmEnabled = true;
      if (this._muted) this._muted = false;
      this.persistPrefs();
      this.ensureGraph();
      this.syncBgmChannel();
    }
    this.emitChange();
  }

  public updateTrackConfig(
    trackId: BgmTrackId,
    patch: Partial<BgmTrackCustomConfig>,
    options?: { forceRestart?: boolean }
  ): void {
    const prev = this._trackConfigs[trackId] ?? buildDefaultTrackConfig(trackId);
    const merged = normalizeTrackConfig(trackId, { ...prev, ...patch });
    this._trackConfigs = {
      ...this._trackConfigs,
      [trackId]: merged,
    };
    this.persistTrackConfigs();
    this.ensureGraph();

    const modeChanged = prev.sourceMode !== merged.sourceMode;
    this.syncBgmChannel(Boolean(options?.forceRestart || modeChanged));
    this.emitChange();
  }

  public applySynthPresetToTrack(trackId: BgmTrackId, presetId: BgmSynthPresetId): void {
    const baseMeta = BGM_TRACK_META[trackId];
    const cur = this._trackConfigs[trackId] ?? buildDefaultTrackConfig(trackId);

    let patch: Partial<BgmTrackCustomConfig>;
    switch (presetId) {
      case 'CHIPTUNE_8BIT':
        patch = {
          sourceMode: 'SYNTH',
          presetId,
          bpm: Math.min(185, Math.round(baseMeta.bpm * 1.04)),
          transposeSemitones: 0,
          leadWaveform: 'square',
          filterCutoffHz: 5400,
          drumsEnabled: true,
          bassEnabled: true,
          chordsEnabled: true,
          leadEnabled: true,
        };
        break;
      case 'BOSS_OVERDRIVE':
        patch = {
          sourceMode: 'SYNTH',
          presetId,
          bpm: Math.min(195, Math.round(baseMeta.bpm * 1.15)),
          transposeSemitones: 2,
          leadWaveform: 'sawtooth',
          filterCutoffHz: 6400,
          drumsEnabled: true,
          bassEnabled: true,
          chordsEnabled: true,
          leadEnabled: true,
        };
        break;
      case 'LOFI_COSMIC':
        patch = {
          sourceMode: 'SYNTH',
          presetId,
          bpm: Math.max(68, Math.round(baseMeta.bpm * 0.84)),
          transposeSemitones: -2,
          leadWaveform: 'sine',
          filterCutoffHz: 1650,
          drumsEnabled: trackId !== 'MENU' && trackId !== 'DEFEAT',
          bassEnabled: true,
          chordsEnabled: true,
          leadEnabled: true,
        };
        break;
      case 'CINEMATIC_BRASS':
        patch = {
          sourceMode: 'SYNTH',
          presetId,
          bpm: Math.max(72, Math.round(baseMeta.bpm * 0.96)),
          transposeSemitones: -3,
          leadWaveform: 'sawtooth',
          filterCutoffHz: 4400,
          drumsEnabled: true,
          bassEnabled: true,
          chordsEnabled: true,
          leadEnabled: true,
        };
        break;
      default:
        patch = {
          ...buildDefaultTrackConfig(trackId),
          customTitle: cur.customTitle,
          customFileName: cur.customFileName,
          customDurationSec: cur.customDurationSec,
          sourceMode: 'SYNTH',
        };
        break;
    }

    this.updateTrackConfig(trackId, patch);
    this.playCardSelect();
  }

  public async uploadCustomBgmFile(
    trackId: BgmTrackId,
    file: File
  ): Promise<{ ok: boolean; error?: string }> {
    if (!file) {
      return { ok: false, error: 'File audio tidak ditemukan.' };
    }
    if (file.size > 45 * 1024 * 1024) {
      return { ok: false, error: 'Ukuran file maksimal 45 MB.' };
    }

    const ctx = this.ensureGraph();
    if (!ctx) {
      return { ok: false, error: 'Web Audio tidak tersedia di peramban ini.' };
    }

    try {
      const arrBuf = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrBuf.slice(0));

      this.rawCustomBuffers.set(trackId, arrBuf);
      this.decodedCustomBuffers.set(trackId, decoded);

      await saveBgmBlobToIdb({
        trackId,
        fileName: file.name,
        mimeType: file.type || 'audio/mpeg',
        blob: file,
        updatedAt: Date.now(),
      });

      const prev = this._trackConfigs[trackId] ?? buildDefaultTrackConfig(trackId);
      const cleanStem = file.name.replace(/\.[^/.]+$/, '').slice(0, 36);
      this._trackConfigs = {
        ...this._trackConfigs,
        [trackId]: normalizeTrackConfig(trackId, {
          ...prev,
          sourceMode: 'CUSTOM_FILE',
          customFileName: file.name,
          customDurationSec: decoded.duration,
          customTitle: prev.customTitle.trim() ? prev.customTitle : cleanStem,
          loopStartSec: 0,
          loopEndSec: 0,
          playbackRate: 1.0,
        }),
      };
      this.persistTrackConfigs();

      // Automatically audition the newly uploaded track
      this._controlMode = trackId;
      this._bgmEnabled = true;
      this._muted = false;
      this.persistPrefs();
      this.syncBgmChannel(true);
      this.emitChange();

      return { ok: true };
    } catch {
      return {
        ok: false,
        error: 'Format audio tidak dapat dibaca. Gunakan file MP3, WAV, OGG, atau M4A.',
      };
    }
  }

  public async removeCustomBgmFile(trackId: BgmTrackId): Promise<void> {
    this.rawCustomBuffers.delete(trackId);
    this.decodedCustomBuffers.delete(trackId);
    await deleteBgmBlobFromIdb(trackId);

    const prev = this._trackConfigs[trackId] ?? buildDefaultTrackConfig(trackId);
    this._trackConfigs = {
      ...this._trackConfigs,
      [trackId]: normalizeTrackConfig(trackId, {
        ...prev,
        sourceMode: 'SYNTH',
        customFileName: null,
        customDurationSec: 0,
        loopStartSec: 0,
        loopEndSec: 0,
      }),
    };
    this.persistTrackConfigs();
    this.syncBgmChannel(true);
    this.emitChange();
  }

  public async resetTrackToDefault(trackId: BgmTrackId): Promise<void> {
    this.rawCustomBuffers.delete(trackId);
    this.decodedCustomBuffers.delete(trackId);
    await deleteBgmBlobFromIdb(trackId);

    this._trackConfigs = {
      ...this._trackConfigs,
      [trackId]: buildDefaultTrackConfig(trackId),
    };
    this.persistTrackConfigs();
    this.syncBgmChannel(true);
    this.emitChange();
  }

  public async resetAllTracksToDefault(): Promise<void> {
    for (const id of ALL_BGM_TRACK_IDS) {
      this.rawCustomBuffers.delete(id);
      this.decodedCustomBuffers.delete(id);
      await deleteBgmBlobFromIdb(id);
    }

    const fresh = {} as Record<BgmTrackId, BgmTrackCustomConfig>;
    for (const id of ALL_BGM_TRACK_IDS) {
      fresh[id] = buildDefaultTrackConfig(id);
    }
    this._trackConfigs = fresh;
    this._controlMode = 'AUTO';
    this.persistTrackConfigs();
    this.syncBgmChannel(true);
    this.emitChange();
  }

  // ==========================================================================
  // Public Audio Control & State Methods
  // ==========================================================================

  public get muted(): boolean {
    return this._muted;
  }

  public set muted(val: boolean) {
    if (this._muted === val) return;
    this._muted = val;
    this.persistPrefs();
    if (!val) {
      this.ensureGraph();
    }
    this.syncBgmChannel();
    this.emitChange();
  }

  public toggleMute(): boolean {
    this.muted = !this._muted;
    return this._muted;
  }

  public setBgmEnabled(enabled: boolean): void {
    if (this._bgmEnabled === enabled) return;
    this._bgmEnabled = enabled;
    this.persistPrefs();
    if (enabled) this.ensureGraph();
    this.syncBgmChannel();
    this.emitChange();
  }

  public setLobbyBgmEnabled(enabled: boolean): void {
    if (this._lobbyBgmEnabled === enabled) return;
    this._lobbyBgmEnabled = enabled;
    this.persistPrefs();
    if (enabled) this.ensureGraph();
    this.syncBgmChannel();
    this.emitChange();
  }

  public setBgmVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this._bgmVolume = clamped;
    if (clamped > 0 && this._muted) {
      this._muted = false;
    }
    this.persistPrefs();
    this.ensureGraph();
    this.syncBgmChannel();
    this.emitChange();
  }

  public setSfxVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this._sfxVolume = clamped;
    if (clamped > 0 && this._muted) {
      this._muted = false;
    }
    this.persistPrefs();
    this.ensureGraph();
    this.applyGainLevels();
    this.emitChange();
  }

  public setCelebrationCrowdEnabled(enabled: boolean): void {
    if (this._celebrationCrowdEnabled === enabled) return;
    this._celebrationCrowdEnabled = enabled;
    this.persistPrefs();
    this.emitChange();
  }

  public setCelebrationVoiceEnabled(enabled: boolean): void {
    if (this._celebrationVoiceEnabled === enabled) return;
    this._celebrationVoiceEnabled = enabled;
    this.persistPrefs();
    this.emitChange();
  }

  public setCelebrationStyle(style: CelebrationAudioStyle): void {
    if (this._celebrationStyle === style) return;
    this._celebrationStyle = style;
    this.persistPrefs();
    this.emitChange();
  }

  public async uploadCustomCelebrationSfx(
    file: File
  ): Promise<{ ok: boolean; error?: string }> {
    if (!file) {
      return { ok: false, error: 'File efek suara tidak ditemukan.' };
    }
    if (file.size > 20 * 1024 * 1024) {
      return { ok: false, error: 'Ukuran file efek perayaan maksimal 20 MB.' };
    }
    const ctx = this.ensureGraph();
    if (!ctx) {
      return { ok: false, error: 'Web Audio tidak tersedia di peramban ini.' };
    }
    try {
      const arrBuf = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrBuf.slice(0));
      this.rawCustomCelebrationBuf = arrBuf;
      this.decodedCustomCelebrationBuf = decoded;

      await saveBgmBlobToIdb({
        trackId: CUSTOM_CELEBRATION_IDB_KEY,
        fileName: file.name,
        mimeType: file.type || 'audio/mpeg',
        blob: file,
        updatedAt: Date.now(),
      });

      this._customCelebrationFileName = file.name;
      if (this._muted) this._muted = false;
      this.persistPrefs();
      this.applyGainLevels();
      this.emitChange();
      this.playVictoryCelebration({ outcome: 'VICTORY' });
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: 'Format audio tidak dapat dibaca. Gunakan MP3, WAV, OGG, atau M4A.',
      };
    }
  }

  public async removeCustomCelebrationSfx(): Promise<void> {
    this.rawCustomCelebrationBuf = null;
    this.decodedCustomCelebrationBuf = null;
    await deleteBgmBlobFromIdb(CUSTOM_CELEBRATION_IDB_KEY);
    this._customCelebrationFileName = null;
    this.persistPrefs();
    this.emitChange();
  }

  public setControlMode(mode: BgmControlMode, playPreviewStinger = false): void {
    this._controlMode = mode;
    if (mode !== 'AUTO' && !this._bgmEnabled) {
      this._bgmEnabled = true;
      this.persistPrefs();
    }
    this.ensureGraph();
    this.syncBgmChannel();

    if (playPreviewStinger) {
      if (mode === 'BATTLE_CRITICAL') {
        this.playCriticalAlert('Uji Audio', 'Fase Kritis');
      } else if (mode === 'BATTLE_LEGENDARY') {
        this.playLegendarySummon('Kartu Legendaris', 'SR');
      } else {
        this.playCardSelect();
      }
    } else {
      this.emitChange();
    }
  }

  public setAutoTrack(track: BgmTrackId): void {
    if (this._autoTrack === track) return;
    this._autoTrack = track;
    if (this._controlMode === 'AUTO') {
      this.syncBgmChannel();
    }
    this.emitChange();
  }

  public dismissBanner(): void {
    if (!this._activeBanner) return;
    if (this.bannerTimer !== null) {
      window.clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }
    this._activeBanner = null;
    this.emitChange();
  }

  private pushBanner(kind: 'CRITICAL' | 'LEGENDARY', title: string, subtitle: string): void {
    if (typeof window === 'undefined') return;
    if (this.bannerTimer !== null) {
      window.clearTimeout(this.bannerTimer);
    }
    this.bannerSeq += 1;
    const nextBanner: AudioEventBanner = {
      id: this.bannerSeq,
      kind,
      title,
      subtitle,
      timestamp: Date.now(),
    };
    this._activeBanner = nextBanner;
    this.emitChange();

    this.bannerTimer = window.setTimeout(() => {
      if (this._activeBanner?.id === nextBanner.id) {
        this._activeBanner = null;
        this.emitChange();
      }
    }, 4400);
  }

  // ==========================================================================
  // Reactive Event Stingers & Gameplay SFX
  // ==========================================================================

  public playCriticalAlert(fighterName?: string, hpDetail?: string): void {
    const critDisp = getResolvedTrackDisplay('BATTLE_CRITICAL', this._trackConfigs);
    const label = fighterName
      ? `Fase Kritis · ${fighterName}${hpDetail ? ` (${hpDetail})` : ''}`
      : 'Fase Kritis · HP Rendah Terdeteksi';
    this.pushBanner(
      'CRITICAL',
      label,
      `BGM beralih ke ${critDisp.label} (${critDisp.bpmLabel})`
    );

    const sfx = this.getSfxTarget();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const now = ctx.currentTime;

    this.duckBgm(0.32, 0.55);

    [0, 0.19].forEach((offset, idx) => {
      const sub = ctx.createOscillator();
      const gain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(idx === 0 ? 135 : 108, now + offset);
      sub.frequency.exponentialRampToValueAtTime(36, now + offset + 0.16);
      gain.gain.setValueAtTime(idx === 0 ? 0.24 : 0.18, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
      sub.connect(gain);
      gain.connect(out);
      sub.onended = () => gain.disconnect();
      sub.start(now + offset);
      sub.stop(now + offset + 0.19);
    });

    const sirenNotes = [
      { freq: 783.99, start: 0.02, dur: 0.14 },
      { freq: 830.61, start: 0.18, dur: 0.14 },
      { freq: 1046.5, start: 0.34, dur: 0.24 },
    ];
    sirenNotes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + start);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(2600, now + start);
      gain.gain.setValueAtTime(0.095, now + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(flt);
      flt.connect(gain);
      gain.connect(out);
      osc.onended = () => {
        flt.disconnect();
        gain.disconnect();
      };
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  }

  public playLegendarySummon(cardName?: string, rank: CardRank = 'SR'): void {
    const legDisp = getResolvedTrackDisplay('BATTLE_LEGENDARY', this._trackConfigs);
    const rankTag = rank === 'SR' || rank === 'AR' || rank === 'S' ? ` [${rank}]` : '';
    const title = cardName
      ? `Kartu Legendaris Turun · ${cardName}${rankTag}`
      : `Kartu Legendaris Dimainkan${rankTag}`;
    this.pushBanner(
      'LEGENDARY',
      title,
      `BGM beralih ke ${legDisp.label} (${legDisp.bpmLabel})`
    );

    const sfx = this.getSfxTarget();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const now = ctx.currentTime;

    this.duckBgm(0.28, 0.72);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.44);
    subGain.gain.setValueAtTime(0.24, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
    sub.connect(subGain);
    subGain.connect(out);
    sub.onended = () => subGain.disconnect();
    sub.start(now);
    sub.stop(now + 0.47);

    const sweepMidi =
      rank === 'SR' ? [62, 66, 69, 74, 76, 78, 81, 86] : [62, 66, 69, 74, 78, 81];
    sweepMidi.forEach((midi, idx) => {
      const startAt = now + idx * 0.048;
      this.playSynthTone(ctx, out, {
        freq: midiToFreq(midi),
        time: startAt,
        duration: 0.28,
        type: 'triangle',
        gain: 0.095,
        attack: 0.008,
      });
    });

    const crestStart = now + sweepMidi.length * 0.044;
    const crestChord = [50, 57, 62, 66, 74];
    crestChord.forEach((midi, idx) => {
      this.playSynthTone(ctx, out, {
        freq: midiToFreq(midi),
        time: crestStart,
        duration: 0.56,
        type: idx < 2 ? 'sawtooth' : 'triangle',
        gain: 0.078,
        attack: 0.02,
        detuneCents: idx % 2 === 0 ? -5 : 5,
        filterHz: 3400,
      });
    });
  }

  public playCardSelect(): void {
    const sfx = this.getSfxTarget();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.07);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(gain);
    gain.connect(out);
    osc.onended = () => gain.disconnect();
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playCardDeploy(): void {
    const sfx = this.getSfxTarget();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.14);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(gain);
    gain.connect(out);
    osc.onended = () => gain.disconnect();
    osc.start(now);
    osc.stop(now + 0.155);
  }

  public playSuitClash(outcome: 'win' | 'lose' | 'draw'): void {
    const sfx = this.getSfxTarget();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const now = ctx.currentTime;
    const notes =
      outcome === 'win'
        ? [523.25, 659.25, 783.99]
        : outcome === 'lose'
        ? [392.0, 329.63, 261.63]
        : [440, 440];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = outcome === 'draw' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.09, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.14);
      osc.connect(gain);
      gain.connect(out);
      osc.onended = () => gain.disconnect();
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.15);
    });
  }

  public playHit(): void {
    const sfx = this.getSfxTarget();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    osc.connect(gain);
    gain.connect(out);
    osc.onended = () => gain.disconnect();
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playShieldBlock(): void {
    const sfx = this.getSfxTarget();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.12);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(out);
    osc.onended = () => gain.disconnect();
    osc.start(now);
    osc.stop(now + 0.165);
  }

  public playRoundWin(): void {
    const sfx = this.getSfxTarget();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.1, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.22);
      osc.connect(gain);
      gain.connect(out);
      osc.onended = () => gain.disconnect();
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.23);
    });
  }

  public playComboChain(chainCount = 2): void {
    const sfx = this.getSfxTarget();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const now = ctx.currentTime;

    this.duckBgm(0.55, 0.32);

    const scale = [587.33, 739.99, 880.0, 1174.66, 1479.98];
    const count = Math.max(3, Math.min(scale.length, chainCount + 1));

    for (let i = 0; i < count; i++) {
      const startAt = now + i * 0.055;
      const freq = scale[i];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === count - 1 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq * 0.98, startAt);
      osc.frequency.exponentialRampToValueAtTime(freq, startAt + 0.03);

      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.linearRampToValueAtTime(i === count - 1 ? 0.13 : 0.1, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + (i === count - 1 ? 0.28 : 0.16));

      osc.connect(gain);
      gain.connect(out);
      osc.onended = () => gain.disconnect();
      osc.start(startAt);
      osc.stop(startAt + 0.3);
    }
  }

  private connectWithStereoPan(
    ctx: AudioContext,
    sourceNode: AudioNode,
    destNode: AudioNode,
    pan: number
  ): AudioNode {
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      sourceNode.connect(panner);
      panner.connect(destNode);
      return panner;
    }
    sourceNode.connect(destNode);
    return sourceNode;
  }

  private playCrowdCheerLayer(
    ctx: AudioContext,
    out: AudioNode,
    now: number,
    options: { isGrand: boolean; isArcade: boolean; durationScale?: number }
  ): void {
    if (!this.noiseBuffer) return;
    const { isGrand, isArcade, durationScale = 1 } = options;
    const totalDur = (isArcade ? 1.55 : isGrand ? 3.1 : 2.2) * durationScale;

    // 1. Wide Stereo Stadium Crowd Roar Swell (2 formant-swept noise streams)
    const channels: Array<{
      pan: number;
      offset: number;
      startHz: number;
      peakHz: number;
      endHz: number;
      q: number;
      peakGain: number;
    }> = [
      {
        pan: -0.48,
        offset: 0.08,
        startHz: 340,
        peakHz: isGrand ? 690 : 580,
        endHz: 430,
        q: 1.05,
        peakGain: isArcade ? 0.075 : isGrand ? 0.145 : 0.105,
      },
      {
        pan: 0.48,
        offset: 0.43,
        startHz: 840,
        peakHz: isGrand ? 1520 : 1280,
        endHz: 940,
        q: 1.35,
        peakGain: isArcade ? 0.065 : isGrand ? 0.115 : 0.085,
      },
    ];

    channels.forEach((ch) => {
      if (!this.noiseBuffer) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.setValueAtTime(ch.q, now);
      bp.frequency.setValueAtTime(ch.startHz, now);
      bp.frequency.exponentialRampToValueAtTime(ch.peakHz, now + 0.34);
      bp.frequency.exponentialRampToValueAtTime(ch.endHz, now + totalDur);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(isArcade ? 3600 : 2800, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(ch.peakGain, now + 0.18);
      gain.gain.setValueAtTime(ch.peakGain * 0.88, now + totalDur * 0.48);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + totalDur);

      src.connect(bp);
      bp.connect(lp);
      lp.connect(gain);
      const tailNode = this.connectWithStereoPan(ctx, gain, out, ch.pan);

      src.onended = () => {
        bp.disconnect();
        lp.disconnect();
        gain.disconnect();
        if (tailNode !== gain) tailNode.disconnect();
      };
      src.start(now + 0.03, ch.offset);
      src.stop(now + totalDur + 0.04);
    });

    // 2. Scattered Multi-Person Stadium Hand-Claps & Applause Transients
    const clapCount = Math.max(
      6,
      Math.round((isArcade ? 10 : isGrand ? 26 : 16) * durationScale)
    );
    for (let i = 0; i < clapCount; i++) {
      if (!this.noiseBuffer) break;
      const progress = i / clapCount;
      // Denser claps in the first half, natural taper toward the end
      const jitter = ((i * 73) % 19) / 190;
      const startAt = now + 0.08 + Math.pow(progress, 1.12) * (totalDur * 0.82) + jitter * 0.09;
      const clapDur = 0.042 + ((i * 29) % 7) * 0.004;

      const clapSrc = ctx.createBufferSource();
      clapSrc.buffer = this.noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1180 + ((i * 317) % 1250), startAt);
      bp.Q.setValueAtTime(2.3, startAt);

      const envFactor = progress < 0.6 ? 1 : 1 - (progress - 0.6) * 0.9;
      const peak = (isGrand ? 0.078 : 0.06) * Math.max(0.25, envFactor);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(peak, startAt + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + clapDur);

      clapSrc.connect(bp);
      bp.connect(gain);
      const panPos = (((i * 53) % 13) / 6 - 1) * 0.68;
      const tailNode = this.connectWithStereoPan(ctx, gain, out, panPos);

      clapSrc.onended = () => {
        bp.disconnect();
        gain.disconnect();
        if (tailNode !== gain) tailNode.disconnect();
      };
      clapSrc.start(startAt, ((i * 11) % 9) * 0.09);
      clapSrc.stop(startAt + clapDur + 0.01);
    }

    // 3. Celebratory Crowd Whistles on Grand Tier
    if (isGrand && !isArcade) {
      [
        { delay: 0.36, pan: -0.35, fStart: 2120, fPeak: 2560, fEnd: 2380 },
        { delay: 1.02, pan: 0.38, fStart: 2260, fPeak: 2680, fEnd: 2490 },
      ].forEach((w) => {
        const t = now + w.delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(w.fStart, t);
        osc.frequency.exponentialRampToValueAtTime(w.fPeak, t + 0.11);
        osc.frequency.exponentialRampToValueAtTime(w.fEnd, t + 0.24);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.024, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

        osc.connect(gain);
        const tailNode = this.connectWithStereoPan(ctx, gain, out, w.pan);
        osc.onended = () => {
          gain.disconnect();
          if (tailNode !== gain) tailNode.disconnect();
        };
        osc.start(t);
        osc.stop(t + 0.26);
      });
    }
  }

  private playSynthesizedVictoryFormants(
    ctx: AudioContext,
    out: AudioNode,
    startTime: number,
    gainScale: number
  ): void {
    // 3-Syllable Vocal Formant Articulation ("VIC - TO - RY!")
    // Ensures an unmistakable heroic vocal timbre even on headless/Linux browsers without OS TTS voices.
    const syllables: Array<{
      offset: number;
      dur: number;
      f0Start: number;
      f0End: number;
      formants: [number, number, number];
      plosiveHz?: number;
    }> = [
      {
        offset: 0.0,
        dur: 0.14,
        f0Start: 220,
        f0End: 246.94,
        formants: [410, 1960, 2580], // "VIC" [ɪ]
      },
      {
        offset: 0.16,
        dur: 0.15,
        f0Start: 261.63,
        f0End: 277.18,
        formants: [510, 940, 2440], // "TO" [ɔ]
        plosiveHz: 3600,
      },
      {
        offset: 0.33,
        dur: 0.44,
        f0Start: 293.66,
        f0End: 329.63,
        formants: [310, 2280, 2960], // "RY!" [iː]
      },
    ];

    syllables.forEach((syl) => {
      const t0 = startTime + syl.offset;
      const src = ctx.createOscillator();
      src.type = 'sawtooth';
      src.frequency.setValueAtTime(syl.f0Start, t0);
      src.frequency.exponentialRampToValueAtTime(syl.f0End, t0 + syl.dur);

      const voiceBus = ctx.createGain();
      voiceBus.gain.setValueAtTime(0.0001, t0);
      voiceBus.gain.linearRampToValueAtTime(0.11 * gainScale, t0 + 0.018);
      voiceBus.gain.exponentialRampToValueAtTime(0.0001, t0 + syl.dur);
      voiceBus.connect(out);

      const filters: BiquadFilterNode[] = syl.formants.map((fHz, idx) => {
        const flt = ctx.createBiquadFilter();
        flt.type = 'bandpass';
        flt.frequency.setValueAtTime(fHz, t0);
        flt.Q.setValueAtTime(idx === 0 ? 5.5 : 8.5, t0);
        src.connect(flt);
        flt.connect(voiceBus);
        return flt;
      });

      if (syl.plosiveHz && this.noiseBuffer) {
        const pSrc = ctx.createBufferSource();
        pSrc.buffer = this.noiseBuffer;
        const pBp = ctx.createBiquadFilter();
        pBp.type = 'bandpass';
        pBp.frequency.setValueAtTime(syl.plosiveHz, t0);
        pBp.Q.setValueAtTime(3.0, t0);
        const pGain = ctx.createGain();
        pGain.gain.setValueAtTime(0.055 * gainScale, t0);
        pGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.022);
        pSrc.connect(pBp);
        pBp.connect(pGain);
        pGain.connect(out);
        pSrc.onended = () => {
          pBp.disconnect();
          pGain.disconnect();
        };
        pSrc.start(t0, 0.2);
        pSrc.stop(t0 + 0.025);
      }

      src.onended = () => {
        filters.forEach((f) => f.disconnect());
        voiceBus.disconnect();
      };
      src.start(t0);
      src.stop(t0 + syl.dur + 0.02);
    });
  }

  private playAnnouncerVoiceCallout(
    ctx: AudioContext,
    out: AudioNode,
    now: number,
    callout: VictoryCalloutId,
    isGrand: boolean
  ): void {
    const phraseMap: Record<VictoryCalloutId, string> = {
      VICTORY: 'Victory!',
      PERFECT_VICTORY: 'Perfect Victory!',
      COMEBACK_VICTORY: 'Comeback Victory!',
      LEGENDARY_VICTORY: 'Legendary Victory!',
      DRAW_GAME: 'Draw Game!',
    };
    const phrase = phraseMap[callout];

    let usedWebSpeech = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const synth = window.speechSynthesis;
        const voices = synth.getVoices();
        if (voices.length > 0) {
          const preferred =
            voices.find(
              (v) =>
                v.lang.toLowerCase().startsWith('en') &&
                /(google|natural|enhanced|daniel|alex|samantha|guy|aria)/i.test(v.name)
            ) ??
            voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
            voices[0];

          synth.cancel();
          window.setTimeout(() => {
            if (this._muted || this._sfxVolume <= 0.01) return;
            try {
              const utter = new SpeechSynthesisUtterance(phrase);
              if (preferred) {
                utter.voice = preferred;
                utter.lang = preferred.lang;
              } else {
                utter.lang = 'en-US';
              }
              utter.rate = isGrand ? 1.02 : 1.08;
              utter.pitch = callout === 'DRAW_GAME' ? 1.0 : isGrand ? 1.18 : 1.12;
              utter.volume = Math.min(1, Math.max(0.25, this._sfxVolume));
              synth.speak(utter);
            } catch {
              // Ignore speech error
            }
          }, 145);
          usedWebSpeech = true;
        }
      } catch {
        usedWebSpeech = false;
      }
    }

    // Play full vocal formant articulation if OS TTS voices are absent, or subtle harmonic layer if present
    if (callout !== 'DRAW_GAME') {
      this.playSynthesizedVictoryFormants(ctx, out, now + 0.16, usedWebSpeech ? 0.28 : 0.95);
    }
  }

  private playDefeatResolutionStinger(ctx: AudioContext, out: AudioNode, now: number): void {
    this.duckBgm(0.55, 0.75);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(128, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + 0.36);
    subGain.gain.setValueAtTime(0.18, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    sub.connect(subGain);
    subGain.connect(out);
    sub.onended = () => subGain.disconnect();
    sub.start(now);
    sub.stop(now + 0.4);

    // Dignified descending minor resolution (D4 -> C4 -> Bb3 -> A3)
    const notes = [293.66, 261.63, 233.08, 220.0];
    notes.forEach((freq, idx) => {
      const t = now + 0.06 + idx * 0.14;
      const dur = idx === notes.length - 1 ? 0.65 : 0.28;
      this.playSynthTone(ctx, out, {
        freq,
        time: t,
        duration: dur,
        type: 'triangle',
        gain: 0.085,
        attack: 0.015,
        filterHz: 1800,
      });
    });
  }

  private playDrawResolutionStinger(ctx: AudioContext, out: AudioNode, now: number): void {
    this.duckBgm(0.45, 0.95);

    // Balanced dual-fighter clash bell
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const t = now + idx * 0.06;
      this.playSynthTone(ctx, out, {
        freq,
        time: t,
        duration: 0.55,
        type: 'triangle',
        gain: 0.085,
        attack: 0.01,
      });
    });

    if (this._celebrationCrowdEnabled) {
      this.playCrowdCheerLayer(ctx, out, now + 0.08, {
        isGrand: false,
        isArcade: this._celebrationStyle === 'ARCADE_RETRO',
        durationScale: 0.6,
      });
    }
    if (this._celebrationVoiceEnabled) {
      this.playAnnouncerVoiceCallout(ctx, out, now, 'DRAW_GAME', false);
    }
  }

  public playVictoryCelebration(context?: VictoryCelebrationAudioContext): void {
    const sfx = this.getSfxTarget();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const now = ctx.currentTime;

    const outcome: MatchCelebrationOutcome = context?.outcome ?? 'VICTORY';
    if (outcome === 'DEFEAT') {
      this.playDefeatResolutionStinger(ctx, out, now);
      return;
    }
    if (outcome === 'DRAW') {
      this.playDrawResolutionStinger(ctx, out, now);
      return;
    }

    const isArcade = this._celebrationStyle === 'ARCADE_RETRO';
    const isGrand =
      this._celebrationStyle === 'STADIUM_EPIC' ||
      Boolean(
        context?.isPerfectWin ||
          context?.isComeback ||
          context?.isLegendaryFinisher ||
          (context?.comboCount ?? 0) >= 2 ||
          context?.calloutOverride === 'PERFECT_VICTORY' ||
          context?.calloutOverride === 'COMEBACK_VICTORY' ||
          context?.calloutOverride === 'LEGENDARY_VICTORY'
      );

    const callout: VictoryCalloutId =
      context?.calloutOverride ??
      (context?.isPerfectWin
        ? 'PERFECT_VICTORY'
        : context?.isComeback
        ? 'COMEBACK_VICTORY'
        : context?.isLegendaryFinisher
        ? 'LEGENDARY_VICTORY'
        : 'VICTORY');

    this.duckBgm(0.28, isGrand ? 1.95 : 1.35);

    // Optional User-Uploaded Custom Celebration SFX Layer
    if (this.decodedCustomCelebrationBuf) {
      const customSrc = ctx.createBufferSource();
      customSrc.buffer = this.decodedCustomCelebrationBuf;
      const customGain = ctx.createGain();
      customGain.gain.setValueAtTime(0.88, now);
      customSrc.connect(customGain);
      customGain.connect(out);
      customSrc.onended = () => customGain.disconnect();
      customSrc.start(now);
    }

    // 1. Celebratory Timpani Impact + Heroic Brass/Crystal Fanfare
    const subImpact = ctx.createOscillator();
    const subGain = ctx.createGain();
    subImpact.type = 'sine';
    subImpact.frequency.setValueAtTime(145, now);
    subImpact.frequency.exponentialRampToValueAtTime(48, now + 0.34);
    subGain.gain.setValueAtTime(0.22, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    subImpact.connect(subGain);
    subGain.connect(out);
    subImpact.onended = () => subGain.disconnect();
    subImpact.start(now);
    subImpact.stop(now + 0.37);

    const fanfare = isGrand
      ? [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51, 1567.98]
      : [523.25, 659.25, 783.99, 1046.5, 1318.51];
    const noteSpacing = isArcade ? 0.055 : 0.072;

    fanfare.forEach((freq, idx) => {
      const t = now + idx * noteSpacing;
      const isLast = idx === fanfare.length - 1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isArcade ? 'square' : idx >= 3 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(isArcade ? 5200 : 3800, t);

      const peak = isArcade ? 0.085 : isLast ? 0.135 : 0.095;
      const dur = isLast ? (isGrand ? 0.85 : 0.62) : 0.28;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(flt);
      flt.connect(gain);
      gain.connect(out);
      osc.onended = () => {
        flt.disconnect();
        gain.disconnect();
      };
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });

    // Triumphant Brass / Synth Crest Chord
    const chordStart = now + fanfare.length * noteSpacing * 0.72;
    const crestFreqs = isGrand
      ? [261.63, 392.0, 523.25, 659.25, 783.99, 1046.5]
      : [523.25, 659.25, 783.99, 1046.5];
    crestFreqs.forEach((freq, idx) => {
      this.playSynthTone(ctx, out, {
        freq,
        time: chordStart,
        duration: isGrand ? 1.05 : 0.72,
        type: isArcade ? 'triangle' : idx < 2 ? 'sawtooth' : 'triangle',
        gain: isGrand ? 0.068 : 0.06,
        attack: 0.025,
        detuneCents: idx % 2 === 0 ? -4 : 4,
        filterHz: 3600,
      });
    });

    // 2. Dynamic Stadium Crowd Cheer & Applause
    if (this._celebrationCrowdEnabled) {
      this.playCrowdCheerLayer(ctx, out, now, { isGrand, isArcade });
    }

    // 3. Dynamic Announcer Callout ("Victory!", "Perfect Victory!", "Comeback Victory!")
    if (this._celebrationVoiceEnabled) {
      this.playAnnouncerVoiceCallout(ctx, out, now, callout, isGrand);
    }
  }

  public playKnockout(isFinalKo = false): void {
    const sfx = this.getSfxTarget();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const now = ctx.currentTime;

    this.duckBgm(0.3, isFinalKo ? 0.65 : 0.42);

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(155, now);
    subOsc.frequency.exponentialRampToValueAtTime(34, now + 0.38);
    subGain.gain.setValueAtTime(0.22, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    subOsc.connect(subGain);
    subGain.connect(out);
    subOsc.onended = () => subGain.disconnect();
    subOsc.start(now);
    subOsc.stop(now + 0.41);

    const crunchOsc = ctx.createOscillator();
    const crunchGain = ctx.createGain();
    crunchOsc.type = 'sawtooth';
    crunchOsc.frequency.setValueAtTime(340, now);
    crunchOsc.frequency.exponentialRampToValueAtTime(62, now + 0.22);
    crunchGain.gain.setValueAtTime(0.14, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    crunchOsc.connect(crunchGain);
    crunchGain.connect(out);
    crunchOsc.onended = () => crunchGain.disconnect();
    crunchOsc.start(now);
    crunchOsc.stop(now + 0.25);

    const chord = isFinalKo
      ? [261.63, 329.63, 392.0, 523.25, 659.25]
      : [220.0, 329.63, 440.0];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const startAt = now + 0.06 + idx * 0.045;
      const dur = isFinalKo ? 0.52 : 0.34;
      osc.frequency.setValueAtTime(freq, startAt);
      gain.gain.setValueAtTime(0.11, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
      osc.connect(gain);
      gain.connect(out);
      osc.onended = () => gain.disconnect();
      osc.start(startAt);
      osc.stop(startAt + dur + 0.02);
    });
  }
}

export const soundFx = new SoundManager();
export const audioManager = soundFx;

export function useAudioState(): AudioSnapshot {
  return useSyncExternalStore(soundFx.subscribe, soundFx.getSnapshot, soundFx.getSnapshot);
}

export interface BattleAudioDirectorOptions {
  perspectiveIndex?: 0 | 1;
  isSpectator?: boolean;
}

export interface BattleAudioDirectorSummary {
  isCriticalPhase: boolean;
  hasLegendaryActive: boolean;
  criticalNames: string[];
  legendaryNames: string[];
}

export function useBattleAudioDirector(
  battleState: FullBattleState | null,
  options?: BattleAudioDirectorOptions
): BattleAudioDirectorSummary {
  const perspectiveIndex = options?.perspectiveIndex ?? 0;
  const isSpectator = Boolean(options?.isSpectator);

  const announcedLegendaryRef = useRef<Set<string>>(new Set());
  const activeCriticalRef = useRef<Set<string>>(new Set());
  const prevMatchRoundRef = useRef<number>(0);
  const prevHistoryLenRef = useRef<number>(0);
  const prevPhaseRef = useRef<string | null>(null);
  const legendarySpotlightUntilRef = useRef<number>(0);
  const [spotlightTick, setSpotlightTick] = useState<number>(0);

  useEffect(() => {
    return () => {
      soundFx.setAutoTrack('MENU');
    };
  }, []);

  useEffect(() => {
    if (!battleState) {
      announcedLegendaryRef.current.clear();
      activeCriticalRef.current.clear();
      legendarySpotlightUntilRef.current = 0;
      prevMatchRoundRef.current = 0;
      prevHistoryLenRef.current = 0;
      prevPhaseRef.current = null;
      soundFx.setAutoTrack('MENU');
      return;
    }

    const { round, phase, players, roundHistory } = battleState;

    if (
      round < prevMatchRoundRef.current ||
      roundHistory.length < prevHistoryLenRef.current ||
      (round === 1 && roundHistory.length === 0 && prevHistoryLenRef.current > 0) ||
      (prevPhaseRef.current === 'GAME_OVER' && phase !== 'GAME_OVER')
    ) {
      announcedLegendaryRef.current.clear();
      activeCriticalRef.current.clear();
      legendarySpotlightUntilRef.current = 0;
    }
    prevMatchRoundRef.current = round;
    prevHistoryLenRef.current = roundHistory.length;
    prevPhaseRef.current = phase;

    const p0 = players[0];
    const p1 = players[1];

    let newlyPlayedLegendary: CardDefinition | null = null;
    for (const p of [p0, p1]) {
      if (p.active && isLegendaryCard(p.active.def)) {
        const key = `char-${round}-${p.id}-${p.active.instance.uid}`;
        if (!announcedLegendaryRef.current.has(key)) {
          announcedLegendaryRef.current.add(key);
          newlyPlayedLegendary = p.active.def;
        }
      }
      if (p.playedSupportCard && isLegendaryCard(p.playedSupportCard)) {
        const supKey = `sup-${round}-${battleState.suitAttemptInRound}-${p.id}-${p.playedSupportCard.id}`;
        if (!announcedLegendaryRef.current.has(supKey)) {
          announcedLegendaryRef.current.add(supKey);
          newlyPlayedLegendary = p.playedSupportCard;
        }
      }
    }

    const inLiveRound = phase !== 'ROUND_END' && phase !== 'GAME_OVER';
    let newlyEnteredCritical: { fighterName: string; hpText: string } | null = null;
    const currentCriticalKeys = new Set<string>();

    if (inLiveRound) {
      for (const p of [p0, p1]) {
        if (p.active && isFighterCriticalHp(p.active)) {
          const critKey = `crit-${round}-${p.id}-${p.active.instance.uid}`;
          currentCriticalKeys.add(critKey);
          if (!activeCriticalRef.current.has(critKey)) {
            newlyEnteredCritical = {
              fighterName: p.active.def.name,
              hpText: `${p.active.currentHp}/${p.active.maxHp} HP`,
            };
          }
        }
      }
    }
    activeCriticalRef.current = currentCriticalKeys;

    let scheduledTimer: number | undefined;
    const now = Date.now();

    if (newlyPlayedLegendary) {
      soundFx.playLegendarySummon(newlyPlayedLegendary.name, newlyPlayedLegendary.rank);
      const spotlightMs = currentCriticalKeys.size > 0 ? 11000 : 18000;
      legendarySpotlightUntilRef.current = now + spotlightMs;
      scheduledTimer = window.setTimeout(() => {
        setSpotlightTick((t) => t + 1);
      }, spotlightMs + 60);
    } else if (newlyEnteredCritical) {
      legendarySpotlightUntilRef.current = 0;
      soundFx.playCriticalAlert(newlyEnteredCritical.fighterName, newlyEnteredCritical.hpText);
    } else if (legendarySpotlightUntilRef.current > now) {
      const remaining = legendarySpotlightUntilRef.current - now;
      scheduledTimer = window.setTimeout(() => {
        if (currentCriticalKeys.size > 0) {
          const critFighter =
            p0.active && isFighterCriticalHp(p0.active)
              ? p0.active
              : p1.active && isFighterCriticalHp(p1.active)
              ? p1.active
              : null;
          if (critFighter) {
            soundFx.playCriticalAlert(
              critFighter.def.name,
              `${critFighter.currentHp}/${critFighter.maxHp} HP`
            );
          }
        }
        setSpotlightTick((t) => t + 1);
      }, remaining + 50);
    }

    const hasLegendaryActive =
      Boolean(p0.active && isLegendaryCard(p0.active.def)) ||
      Boolean(p1.active && isLegendaryCard(p1.active.def)) ||
      Boolean(p0.playedSupportCard && isLegendaryCard(p0.playedSupportCard)) ||
      Boolean(p1.playedSupportCard && isLegendaryCard(p1.playedSupportCard));

    const isCriticalNow = inLiveRound && currentCriticalKeys.size > 0;
    const inLegendarySpotlight = Date.now() < legendarySpotlightUntilRef.current;

    let targetTrack: BgmTrackId = 'BATTLE_NORMAL';

    if (phase === 'GAME_OVER') {
      if (
        battleState.winnerIndex === 'DRAW' ||
        battleState.winnerIndex === null ||
        isSpectator ||
        battleState.mode === 'PASS_AND_PLAY' ||
        battleState.mode === 'CPU_VS_CPU'
      ) {
        targetTrack = 'VICTORY';
      } else {
        targetTrack = battleState.winnerIndex === perspectiveIndex ? 'VICTORY' : 'DEFEAT';
      }
    } else if (phase === 'ROUND_END') {
      targetTrack = hasLegendaryActive ? 'BATTLE_LEGENDARY' : 'BATTLE_NORMAL';
    } else if (inLegendarySpotlight) {
      targetTrack = 'BATTLE_LEGENDARY';
    } else if (isCriticalNow) {
      targetTrack = 'BATTLE_CRITICAL';
    } else if (hasLegendaryActive) {
      targetTrack = 'BATTLE_LEGENDARY';
    } else {
      targetTrack = 'BATTLE_NORMAL';
    }

    soundFx.setAutoTrack(targetTrack);

    return () => {
      if (scheduledTimer !== undefined) {
        window.clearTimeout(scheduledTimer);
      }
    };
  }, [battleState, perspectiveIndex, isSpectator, spotlightTick]);

  if (!battleState) {
    return {
      isCriticalPhase: false,
      hasLegendaryActive: false,
      criticalNames: [],
      legendaryNames: [],
    };
  }

  const inLiveRound = battleState.phase !== 'ROUND_END' && battleState.phase !== 'GAME_OVER';
  const criticalNames: string[] = [];
  const legendaryNames: string[] = [];

  for (const p of battleState.players) {
    if (inLiveRound && p.active && isFighterCriticalHp(p.active)) {
      criticalNames.push(`${p.active.def.name} (${p.active.currentHp}/${p.active.maxHp} HP)`);
    }
    if (p.active && isLegendaryCard(p.active.def)) {
      legendaryNames.push(`${p.active.def.name} [${p.active.def.rank}]`);
    }
  }

  return {
    isCriticalPhase: criticalNames.length > 0,
    hasLegendaryActive: legendaryNames.length > 0,
    criticalNames,
    legendaryNames,
  };
}
