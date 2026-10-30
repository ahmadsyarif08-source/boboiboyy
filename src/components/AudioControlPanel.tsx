import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Crown,
  FileAudio,
  Music,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Trophy,
  Upload,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from 'lucide-react';
import {
  ALL_BGM_TRACK_IDS,
  BGM_SYNTH_PRESETS,
  BGM_TRACK_META,
  getResolvedTrackDisplay,
  isTrackCustomized,
  soundFx,
  useAudioState,
  type BgmControlMode,
  type BgmSourceMode,
  type BgmTrackId,
  type CelebrationAudioStyle,
  type SynthLeadWaveform,
} from '../utils/sound';

interface EqualizerIconProps {
  playing: boolean;
  urgent?: boolean;
  toneClass?: string;
}

const EqualizerBars: React.FC<EqualizerIconProps> = ({
  playing,
  urgent = false,
  toneClass = 'fill-current',
}) => {
  const bar1 = playing ? (urgent ? 'animate-eq-bar-fast-1' : 'animate-eq-bar-1') : 'eq-bar-base';
  const bar2 = playing ? (urgent ? 'animate-eq-bar-fast-2' : 'animate-eq-bar-2') : 'eq-bar-base';
  const bar3 = playing ? (urgent ? 'animate-eq-bar-fast-3' : 'animate-eq-bar-3') : 'eq-bar-base';

  return (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <rect
        x="1.5"
        y={playing ? '2' : '8'}
        width="2.6"
        height={playing ? '10.5' : '4.5'}
        rx="0.8"
        className={`${toneClass} ${bar1}`}
      />
      <rect
        x="5.7"
        y={playing ? '1.5' : '5.5'}
        width="2.6"
        height={playing ? '11' : '7'}
        rx="0.8"
        className={`${toneClass} ${bar2}`}
      />
      <rect
        x="9.9"
        y={playing ? '3' : '9'}
        width="2.6"
        height={playing ? '9.5' : '3.5'}
        rx="0.8"
        className={`${toneClass} ${bar3}`}
      />
    </svg>
  );
};

function formatSecondsMmSs(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const rounded = Math.max(0, Math.round(seconds));
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface AudioControlWidgetProps {
  compact?: boolean;
  popoverAlign?: 'left' | 'right';
  popoverDirection?: 'down' | 'up';
}

export const AudioControlWidget: React.FC<AudioControlWidgetProps> = ({
  compact = false,
  popoverAlign = 'right',
  popoverDirection = 'down',
}) => {
  const audio = useAudioState();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const meta = BGM_TRACK_META[audio.effectiveTrack];
  const resolvedDisplay = getResolvedTrackDisplay(audio.effectiveTrack, audio.trackConfigs);

  const isBgmAudible =
    !audio.muted &&
    audio.bgmEnabled &&
    audio.bgmVolume > 0.001 &&
    !(audio.controlMode === 'AUTO' && audio.effectiveTrack === 'MENU' && !audio.lobbyBgmEnabled) &&
    audio.contextUnlocked;

  const isCritical = audio.effectiveTrack === 'BATTLE_CRITICAL';
  const isLegendary = audio.effectiveTrack === 'BATTLE_LEGENDARY';

  const mixerBtnTone = audio.muted
    ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-400'
    : isCritical
    ? 'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/50 text-rose-200'
    : isLegendary
    ? 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-200'
    : 'bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200';

  const modeButtons: Array<{ id: BgmControlMode; label: string }> = [
    { id: 'AUTO', label: 'Otomatis (Adaptif)' },
    { id: 'BATTLE_NORMAL', label: 'Standar' },
    { id: 'BATTLE_CRITICAL', label: 'Fase Kritis' },
    { id: 'BATTLE_LEGENDARY', label: 'Legendaris' },
    { id: 'MENU', label: 'Lobi' },
  ];

  const bgmPercent = Math.round(audio.bgmVolume * 100);
  const sfxPercent = Math.round(audio.sfxVolume * 100);
  const customizedCount = ALL_BGM_TRACK_IDS.filter((id) =>
    isTrackCustomized(audio.trackConfigs[id])
  ).length;

  return (
    <div ref={wrapperRef} className="relative inline-flex items-center gap-1.5 shrink-0">
      {/* 1-Click Mute / Unmute */}
      <button
        type="button"
        onClick={() => soundFx.toggleMute()}
        aria-label={audio.muted ? 'Nyalakan seluruh audio' : 'Bisukan seluruh audio'}
        title={audio.muted ? 'Nyalakan suara' : 'Bisukan suara'}
        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
          audio.muted
            ? 'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300'
            : 'bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200'
        }`}
      >
        {audio.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        {!compact && (
          <span className="hidden md:inline">{audio.muted ? 'Bisu' : 'Suara'}</span>
        )}
      </button>

      {/* BGM Status & Mixer Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Buka pengaturan BGM dan efek suara"
        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${mixerBtnTone}`}
      >
        {isCritical && !audio.muted ? (
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        ) : isLegendary && !audio.muted ? (
          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <EqualizerBars
            playing={isBgmAudible}
            urgent={isCritical}
            toneClass={
              isCritical ? 'fill-rose-400' : isLegendary ? 'fill-amber-400' : 'fill-sky-400'
            }
          />
        )}
        <span>
          BGM: {audio.muted || !audio.bgmEnabled ? 'Mati' : resolvedDisplay.shortLabel}
        </span>
        <SlidersHorizontal className="w-3 h-3 opacity-75 shrink-0" />
      </button>

      {/* Direct 1-Click Edit BGM Studio Trigger */}
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          soundFx.playCardSelect();
          soundFx.openBgmStudio(audio.effectiveTrack);
        }}
        title="Edit aransemen BGM atau upload file musik sendiri"
        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
      >
        <Music className="w-3.5 h-3.5 shrink-0" />
        <span>Edit BGM</span>
      </button>

      {/* Audio Management Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="Manajemen Audio dan BGM"
          className={`absolute z-50 w-[310px] sm:w-[348px] bg-[#101829] border border-slate-700 rounded-2xl p-4 shadow-2xl text-left space-y-4 ${
            popoverDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          } ${popoverAlign === 'left' ? 'left-0' : 'right-0'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <Music className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-xs font-display font-bold text-white truncate">
                Manajemen Audio &amp; BGM Adaptif
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup panel audio"
              className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Active BGM State Readout */}
          <div
            className={`rounded-xl p-3 border ${
              isCritical && !audio.muted
                ? 'bg-rose-950/35 border-rose-500/40'
                : isLegendary && !audio.muted
                ? 'bg-amber-950/30 border-amber-500/40'
                : 'bg-[#0B1120] border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
              <span
                className={`font-bold flex items-center gap-1.5 min-w-0 ${
                  isCritical && !audio.muted
                    ? 'text-rose-300'
                    : isLegendary && !audio.muted
                    ? 'text-amber-300'
                    : 'text-sky-300'
                }`}
              >
                {isCritical ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                ) : isLegendary ? (
                  <Crown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <EqualizerBars playing={isBgmAudible} urgent={isCritical} />
                )}
                <span className="truncate">{resolvedDisplay.label}</span>
              </span>
              <span className="text-[11px] text-slate-400 shrink-0">
                {resolvedDisplay.bpmLabel}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              {resolvedDisplay.isCustomFile
                ? `Memutar file audio kustom (${audio.trackConfigs[audio.effectiveTrack].customFileName}).`
                : meta.description}
            </p>
            {audio.controlMode !== 'AUTO' && (
              <div className="mt-1.5 text-[11px] font-mono text-amber-300">
                Mode Pratinjau Manual Aktif · Klik Otomatis untuk adaptif laga
              </div>
            )}
          </div>

          {/* Volume Sliders */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-200">Musik Latar (BGM)</span>
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  <span className="text-slate-300">
                    {audio.bgmEnabled ? `${bgmPercent}%` : 'Mati'}
                  </span>
                  <button
                    type="button"
                    onClick={() => soundFx.setBgmEnabled(!audio.bgmEnabled)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      audio.bgmEnabled
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {audio.bgmEnabled ? 'Aktif' : 'Nonaktif'}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={bgmPercent}
                aria-label="Volume Musik Latar BGM"
                onChange={(e) => {
                  const val = Number(e.target.value) / 100;
                  if (!audio.bgmEnabled && val > 0) {
                    soundFx.setBgmEnabled(true);
                  }
                  soundFx.setBgmVolume(val);
                }}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-200">Efek Pertarungan (SFX)</span>
                <span className="font-mono text-slate-300 tabular-nums">{sfxPercent}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={sfxPercent}
                aria-label="Volume Efek Suara SFX"
                onChange={(e) => soundFx.setSfxVolume(Number(e.target.value) / 100)}
                className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Quick Dynamic 1v1 Celebration Audio Controls */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Audio Perayaan Menang 1v1</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (audio.muted) soundFx.toggleMute();
                    soundFx.playVictoryCelebration({ outcome: 'VICTORY' });
                  }}
                  className="text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4 whitespace-nowrap shrink-0"
                >
                  Uji Suara
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    soundFx.setCelebrationCrowdEnabled(!audio.celebrationCrowdEnabled)
                  }
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    audio.celebrationCrowdEnabled
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                      : 'bg-[#0B1120] border-slate-800 text-slate-400'
                  }`}
                >
                  Sorakan: {audio.celebrationCrowdEnabled ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    soundFx.setCelebrationVoiceEnabled(!audio.celebrationVoiceEnabled)
                  }
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    audio.celebrationVoiceEnabled
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                      : 'bg-[#0B1120] border-slate-800 text-slate-400'
                  }`}
                >
                  &ldquo;Victory!&rdquo;: {audio.celebrationVoiceEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* BGM Trigger Mode & Instant Track Preview */}
          <div className="pt-2.5 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Mode &amp; Uji Trek BGM</span>
              <span>HP &le; 35% · Rank S/AR/SR</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {modeButtons.map((btn) => {
                const selected = audio.controlMode === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => soundFx.setControlMode(btn.id, btn.id !== 'AUTO')}
                    className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      selected
                        ? btn.id === 'BATTLE_CRITICAL'
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-[#0B1120] hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
              <span>Musik Latar saat di Lobi / Menu</span>
              <button
                type="button"
                onClick={() => soundFx.setLobbyBgmEnabled(!audio.lobbyBgmEnabled)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  audio.lobbyBgmEnabled
                    ? 'bg-slate-800 text-emerald-300 border border-slate-700'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                {audio.lobbyBgmEnabled ? 'Aktif' : 'Hening'}
              </button>
            </div>
          </div>

          {/* Open Full BGM Studio CTA */}
          <div className="pt-2.5 border-t border-slate-800 space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                soundFx.playCardSelect();
                soundFx.openBgmStudio(audio.effectiveTrack);
              }}
              className="w-full py-2.5 px-3.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
              <span>Buka Studio Edit &amp; Upload BGM</span>
            </button>
            {customizedCount > 0 && (
              <div className="text-center text-[11px] font-mono text-slate-400 tabular-nums">
                {customizedCount} dari 6 trek BGM telah dikustomisasi
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface BattleAudioNoticeProps {
  isCriticalPhase: boolean;
  hasLegendaryActive: boolean;
  criticalNames: string[];
  legendaryNames: string[];
}

export const BattleAudioNotice: React.FC<BattleAudioNoticeProps> = ({
  isCriticalPhase,
  hasLegendaryActive,
  criticalNames,
  legendaryNames,
}) => {
  const audio = useAudioState();

  if (audio.muted || !audio.bgmEnabled) return null;

  // Priority 1: Fresh reactive transition banner (Critical Alert or Legendary Summon)
  if (audio.activeBanner) {
    const isCritBanner = audio.activeBanner.kind === 'CRITICAL';
    return (
      <div
        role="status"
        aria-live="polite"
        className={`px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3 transition-opacity duration-200 ${
          isCritBanner
            ? 'bg-rose-950/45 border-rose-500/45 text-rose-100'
            : 'bg-amber-950/40 border-amber-400/45 text-amber-100'
        }`}
      >
        <div className="flex items-center gap-2.5 text-xs min-w-0">
          {isCritBanner ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <div className="min-w-0">
            <span className="font-display font-bold">{audio.activeBanner.title}</span>
            <span className="hidden sm:inline text-slate-400 mx-1.5" aria-hidden="true">
              ·
            </span>
            <span className="block sm:inline text-[11px] text-slate-300">
              {audio.activeBanner.subtitle}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => soundFx.dismissBanner()}
          aria-label="Tutup notifikasi audio"
          className="text-slate-400 hover:text-white shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Priority 2: Subtle steady-state indicator when Critical or Legendary BGM is actively driving the arena
  const track: BgmTrackId = audio.effectiveTrack;
  if (track !== 'BATTLE_CRITICAL' && track !== 'BATTLE_LEGENDARY') {
    return null;
  }

  const showingCrit = track === 'BATTLE_CRITICAL';
  const resolved = getResolvedTrackDisplay(track, audio.trackConfigs);

  return (
    <div
      className={`px-3.5 py-2 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
        showingCrit
          ? 'bg-rose-950/25 border-rose-500/30 text-rose-200'
          : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {showingCrit ? (
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        ) : (
          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        )}
        <span className="font-semibold">{resolved.label}</span>
        <span className="text-slate-500" aria-hidden="true">
          ·
        </span>
        <span className="text-slate-300 truncate tabular-nums">
          {showingCrit && isCriticalPhase && criticalNames.length > 0
            ? `HP Rendah: ${criticalNames.join(' · ')}`
            : !showingCrit && hasLegendaryActive && legendaryNames.length > 0
            ? `Arena: ${legendaryNames.join(' · ')}`
            : BGM_TRACK_META[track].description}
        </span>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
          {resolved.bpmLabel}
        </span>
        <button
          type="button"
          onClick={() => soundFx.openBgmStudio(track)}
          className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-4 whitespace-nowrap shrink-0"
        >
          Edit
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Global BGM Studio Modal — Custom Audio Upload + Procedural Synth Editor
// ============================================================================

const WAVEFORM_OPTIONS: Array<{ id: SynthLeadWaveform; label: string }> = [
  { id: 'DEFAULT', label: 'Bawaan Trek' },
  { id: 'square', label: 'Square (8-Bit)' },
  { id: 'sawtooth', label: 'Sawtooth (Tajam)' },
  { id: 'triangle', label: 'Triangle (Lembut)' },
  { id: 'sine', label: 'Sine (Halus)' },
];

export const BgmEditorModal: React.FC = () => {
  const audio = useAudioState();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const celebrationSfxInputRef = useRef<HTMLInputElement | null>(null);
  const [editorTab, setEditorTab] = useState<BgmSourceMode>('SYNTH');
  const [autoAudition, setAutoAudition] = useState<boolean>(true);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);
  const [celebrationUploadMsg, setCelebrationUploadMsg] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState<boolean>(false);

  const selectedTrack = audio.studioTrack;
  const trackConfig = audio.trackConfigs[selectedTrack];
  const baseMeta = BGM_TRACK_META[selectedTrack];
  const resolvedSelected = getResolvedTrackDisplay(selectedTrack, audio.trackConfigs);

  useEffect(() => {
    if (!audio.studioOpen) {
      setConfirmResetAll(false);
      setUploadStatus(null);
      return;
    }
    setEditorTab(audio.trackConfigs[selectedTrack].sourceMode);
    setUploadStatus(null);
  }, [audio.studioOpen, selectedTrack]);

  if (!audio.studioOpen) return null;

  const isAudibleNow =
    !audio.muted &&
    audio.bgmEnabled &&
    audio.bgmVolume > 0.001 &&
    !(audio.controlMode === 'AUTO' && audio.effectiveTrack === 'MENU' && !audio.lobbyBgmEnabled) &&
    audio.contextUnlocked;

  const isThisTrackPlaying = isAudibleNow && audio.effectiveTrack === selectedTrack;
  const isTrackEdited = isTrackCustomized(trackConfig);
  const totalEditedCount = ALL_BGM_TRACK_IDS.filter((id) =>
    isTrackCustomized(audio.trackConfigs[id])
  ).length;

  const bgmMasterPercent = Math.round(audio.bgmVolume * 100);
  const trackGainPercent = Math.round(trackConfig.trackGain * 100);

  const handleSelectTrack = (trackId: BgmTrackId) => {
    soundFx.playCardSelect();
    soundFx.setStudioTrack(trackId, autoAudition);
  };

  const handleSwitchSourceTab = (mode: BgmSourceMode) => {
    soundFx.playCardSelect();
    setEditorTab(mode);
    setUploadStatus(null);

    if (mode === 'SYNTH' && trackConfig.sourceMode !== 'SYNTH') {
      soundFx.updateTrackConfig(selectedTrack, { sourceMode: 'SYNTH' }, { forceRestart: true });
    } else if (
      mode === 'CUSTOM_FILE' &&
      trackConfig.customFileName &&
      trackConfig.sourceMode !== 'CUSTOM_FILE'
    ) {
      soundFx.updateTrackConfig(
        selectedTrack,
        { sourceMode: 'CUSTOM_FILE' },
        { forceRestart: true }
      );
    }
  };

  const processAudioFile = async (file: File | undefined | null) => {
    if (!file) return;
    setIsUploading(true);
    setUploadStatus(null);
    const res = await soundFx.uploadCustomBgmFile(selectedTrack, file);
    setIsUploading(false);

    if (res.ok) {
      setEditorTab('CUSTOM_FILE');
      setUploadStatus({
        kind: 'success',
        message: `File "${file.name}" berhasil dimuat dan langsung diputar untuk slot ${baseMeta.label}.`,
      });
    } else {
      setUploadStatus({
        kind: 'error',
        message: res.error ?? 'Gagal memuat file audio.',
      });
    }
  };

  const handleCloseAndReturnAdaptive = () => {
    soundFx.setControlMode('AUTO');
    soundFx.closeBgmStudio();
  };

  const maxLoopSeconds =
    trackConfig.customDurationSec > 1 ? Math.floor(trackConfig.customDurationSec * 2) / 2 : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Studio Edit Musik Latar BGM"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          soundFx.closeBgmStudio();
        }
      }}
    >
      <div className="w-full max-w-[1060px] bg-[#101829] border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Top Studio Bar */}
        <div className="px-5 sm:px-6 py-4 bg-[#0B1120] border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
              <Music className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-display font-bold text-white truncate">
                Studio Edit BGM &amp; Musik Kustom
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Ubah aransemen synth bawaan atau upload file MP3 / WAV / OGG untuk tiap momen pertarungan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Master BGM Volume Quick Slider */}
            <div className="hidden sm:flex items-center gap-2.5 bg-[#131C31] border border-slate-800 rounded-xl px-3 py-1.5">
              <button
                type="button"
                onClick={() => soundFx.toggleMute()}
                aria-label={audio.muted ? 'Nyalakan audio' : 'Bisukan audio'}
                className="text-slate-300 hover:text-amber-300 transition-colors"
              >
                {audio.muted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-amber-400" />
                )}
              </button>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">Volume Utama</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={audio.muted ? 0 : bgmMasterPercent}
                aria-label="Volume Utama BGM"
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  if (!audio.bgmEnabled && v > 0) soundFx.setBgmEnabled(true);
                  soundFx.setBgmVolume(v);
                }}
                className="w-24 accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-xs font-mono text-slate-200 tabular-nums w-9 text-right">
                {audio.muted ? '0%' : `${bgmMasterPercent}%`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => soundFx.closeBgmStudio()}
              aria-label="Tutup Studio BGM"
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main 2-Column Studio Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column (4 Cols): 6 Adaptive BGM Track Slots */}
          <aside className="lg:col-span-4 bg-[#0D1424] border-b lg:border-b-0 lg:border-r border-slate-800 p-4 sm:p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-300">
                  Pilih Slot Trek BGM (6 Fase)
                </span>
                <button
                  type="button"
                  onClick={() => setAutoAudition((prev) => !prev)}
                  className={`text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                    autoAudition ? 'text-amber-300' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {autoAudition ? 'Auto-Putar: Aktif' : 'Auto-Putar: Mati'}
                </button>
              </div>

              <div className="space-y-1.5">
                {ALL_BGM_TRACK_IDS.map((id) => {
                  const disp = getResolvedTrackDisplay(id, audio.trackConfigs);
                  const isSelected = selectedTrack === id;
                  const isAudibleSlot = isAudibleNow && audio.effectiveTrack === id;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectTrack(id)}
                      className={`w-full p-3 rounded-xl border text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-[#17223B] border-amber-400/70 text-white'
                          : 'bg-[#111A2E] hover:bg-[#152038] border-slate-800/90 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <EqualizerBars
                            playing={isAudibleSlot}
                            urgent={id === 'BATTLE_CRITICAL'}
                            toneClass={
                              isAudibleSlot
                                ? id === 'BATTLE_CRITICAL'
                                  ? 'fill-rose-400'
                                  : 'fill-amber-400'
                                : 'fill-slate-600'
                            }
                          />
                          <span className="text-xs sm:text-sm font-semibold truncate">
                            {disp.label}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 tabular-nums truncate pl-5">
                          <span>{BGM_TRACK_META[id].shortLabel}</span>
                          <span className="mx-1.5 text-slate-600" aria-hidden="true">
                            ·
                          </span>
                          <span>{disp.bpmLabel}</span>
                          {disp.isEdited && (
                            <>
                              <span className="mx-1.5 text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-amber-300">
                                {disp.isCustomFile ? 'File Audio' : 'Kustom'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Playback Routing Info */}
            <div className="pt-3 border-t border-slate-800/90 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400 font-mono tabular-nums">
                <span>Mode Putar Saat Ini</span>
                <span className="text-slate-200">
                  {audio.controlMode === 'AUTO' ? 'Adaptif Otomatis' : 'Uji Manual'}
                </span>
              </div>
              {audio.controlMode !== 'AUTO' && (
                <button
                  type="button"
                  onClick={() => soundFx.setControlMode('AUTO')}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-[#131C31] hover:bg-slate-800 text-sky-300 border border-slate-700 transition-colors whitespace-nowrap"
                >
                  Kembalikan ke Adaptif Otomatis
                </button>
              )}
            </div>
          </aside>

          {/* Right Column (8 Cols): Active Track Editor */}
          <div className="lg:col-span-8 p-5 sm:p-6 space-y-6">
            {/* Selected Track Header & Live Audition Button */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-mono text-amber-400 tabular-nums">
                  Slot Fase: {baseMeta.label} · Bawaan {baseMeta.bpm} BPM
                </div>
                <h3 className="text-lg sm:text-xl font-display font-bold text-white truncate">
                  {resolvedSelected.label}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                  {baseMeta.description}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (isThisTrackPlaying && audio.controlMode === selectedTrack) {
                      soundFx.setBgmEnabled(false);
                    } else {
                      soundFx.setBgmEnabled(true);
                      if (audio.muted) soundFx.toggleMute();
                      soundFx.setControlMode(selectedTrack, false);
                    }
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                    isThisTrackPlaying
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span>{isThisTrackPlaying ? 'Sedang Diputar (Hentikan)' : 'Uji Putar Trek Ini'}</span>
                </button>
              </div>
            </div>

            {/* Custom Track Title Input */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-7 space-y-1.5">
                <label
                  htmlFor="bgm-custom-title-input"
                  className="block text-xs font-semibold text-slate-200"
                >
                  Judul Kustom Trek (Opsional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="bgm-custom-title-input"
                    type="text"
                    maxLength={40}
                    value={trackConfig.customTitle}
                    placeholder={baseMeta.label}
                    onChange={(e) =>
                      soundFx.updateTrackConfig(selectedTrack, { customTitle: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[#0B1120] border border-slate-700 focus:border-amber-400 rounded-xl text-white placeholder:text-slate-500 outline-none"
                  />
                  {trackConfig.customTitle.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        soundFx.updateTrackConfig(selectedTrack, { customTitle: '' })
                      }
                      className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl whitespace-nowrap shrink-0"
                    >
                      Hapus Judul
                    </button>
                  )}
                </div>
              </div>

              {/* Per-Track Gain Control (Applies to both Synth & Custom File) */}
              <div className="sm:col-span-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">Penguatan Trek</span>
                  <span className="font-mono text-amber-300 tabular-nums">{trackGainPercent}%</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={160}
                  step={5}
                  value={trackGainPercent}
                  aria-label="Penguatan Volume Trek"
                  onChange={(e) =>
                    soundFx.updateTrackConfig(selectedTrack, {
                      trackGain: Number(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            {/* Source Mode Segmented Switcher */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200">Sumber Musik Slot Ini</span>
                <div className="inline-flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleSwitchSourceTab('SYNTH')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      editorTab === 'SYNTH'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Edit Synth Bawaan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchSourceTab('CUSTOM_FILE')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      editorTab === 'CUSTOM_FILE'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <FileAudio className="w-3.5 h-3.5 shrink-0" />
                    <span>Upload File Audio</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: PROCEDURAL SYNTH & ARRANGEMENT EDITOR */}
              {editorTab === 'SYNTH' && (
                <div className="space-y-5 pt-1">
                  {/* Synth Style Presets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">Preset Gaya Aransemen</span>
                      <span className="text-slate-400">Klik untuk menerapkan karakter instan</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {BGM_SYNTH_PRESETS.map((preset) => {
                        const active =
                          trackConfig.sourceMode === 'SYNTH' &&
                          trackConfig.presetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              soundFx.applySynthPresetToTrack(selectedTrack, preset.id)
                            }
                            title={preset.description}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors text-center whitespace-nowrap truncate ${
                              active
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                                : 'bg-[#0B1120] hover:bg-slate-800 border-slate-800 text-slate-300'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sliders: Tempo, Pitch Transpose, Filter Cutoff */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
                    {/* Tempo BPM */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200">Tempo (BPM)</span>
                        <span className="font-mono text-sky-300 tabular-nums">
                          {trackConfig.bpm} BPM
                        </span>
                      </div>
                      <input
                        type="range"
                        min={60}
                        max={200}
                        step={2}
                        value={trackConfig.bpm}
                        aria-label="Tempo BGM dalam BPM"
                        onChange={(e) =>
                          soundFx.updateTrackConfig(selectedTrack, {
                            sourceMode: 'SYNTH',
                            bpm: Number(e.target.value),
                          })
                        }
                        className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                      <div className="flex justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                        <span>60</span>
                        <span>Asli {baseMeta.bpm}</span>
                        <span>200</span>
                      </div>
                    </div>

                    {/* Pitch Transpose */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200">Transposisi Nada</span>
                        <span className="font-mono text-amber-300 tabular-nums">
                          {trackConfig.transposeSemitones > 0
                            ? `+${trackConfig.transposeSemitones} st`
                            : `${trackConfig.transposeSemitones} st`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={trackConfig.transposeSemitones}
                        aria-label="Transposisi Nada Semitone"
                        onChange={(e) =>
                          soundFx.updateTrackConfig(selectedTrack, {
                            sourceMode: 'SYNTH',
                            transposeSemitones: Number(e.target.value),
                          })
                        }
                        className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                      <div className="flex justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                        <span>-12 st</span>
                        <span>0 st</span>
                        <span>+12 st</span>
                      </div>
                    </div>

                    {/* Lowpass Filter Brightness */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200">Kecerahan Suara</span>
                        <span className="font-mono text-emerald-300 tabular-nums">
                          {trackConfig.filterCutoffHz} Hz
                        </span>
                      </div>
                      <input
                        type="range"
                        min={700}
                        max={7500}
                        step={100}
                        value={trackConfig.filterCutoffHz}
                        aria-label="Frekuensi Filter Kecerahan Suara"
                        onChange={(e) =>
                          soundFx.updateTrackConfig(selectedTrack, {
                            sourceMode: 'SYNTH',
                            filterCutoffHz: Number(e.target.value),
                          })
                        }
                        className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                      <div className="flex justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                        <span>Hangat</span>
                        <span>Jernih</span>
                      </div>
                    </div>
                  </div>

                  {/* Lead Oscillator Waveform Selector */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <span className="block text-xs font-semibold text-slate-200">
                      Karakter Gelombang Melodi Utama
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {WAVEFORM_OPTIONS.map((wf) => {
                        const selected = trackConfig.leadWaveform === wf.id;
                        return (
                          <button
                            key={wf.id}
                            type="button"
                            onClick={() => {
                              soundFx.playCardSelect();
                              soundFx.updateTrackConfig(selectedTrack, {
                                sourceMode: 'SYNTH',
                                leadWaveform: wf.id,
                              });
                            }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                              selected
                                ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                                : 'bg-[#0B1120] hover:bg-slate-800 border-slate-800 text-slate-300'
                            }`}
                          >
                            {wf.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4 Instrument Layer Toggles */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">
                        Lapisan Instrumen Aktif (Mixer 4 Kanal)
                      </span>
                      <span className="text-slate-400">Aktifkan atau matikan instrumen langsung</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        {
                          key: 'leadEnabled' as const,
                          label: 'Melodi Utama',
                          enabled: trackConfig.leadEnabled,
                        },
                        {
                          key: 'chordsEnabled' as const,
                          label: 'Harmoni Chord',
                          enabled: trackConfig.chordsEnabled,
                        },
                        {
                          key: 'bassEnabled' as const,
                          label: 'Bassline',
                          enabled: trackConfig.bassEnabled,
                        },
                        {
                          key: 'drumsEnabled' as const,
                          label: 'Drum & Perkusi',
                          enabled: trackConfig.drumsEnabled,
                        },
                      ].map((layer) => (
                        <button
                          key={layer.key}
                          type="button"
                          onClick={() => {
                            soundFx.playCardSelect();
                            soundFx.updateTrackConfig(selectedTrack, {
                              sourceMode: 'SYNTH',
                              [layer.key]: !layer.enabled,
                            });
                          }}
                          className={`p-3 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
                            layer.enabled
                              ? 'bg-[#152238] border-emerald-500/45 text-white'
                              : 'bg-[#0B1120] border-slate-800 text-slate-500'
                          }`}
                        >
                          <span className="text-xs font-semibold truncate">{layer.label}</span>
                          <span
                            className={`text-[11px] font-mono shrink-0 ${
                              layer.enabled ? 'text-emerald-300' : 'text-slate-500'
                            }`}
                          >
                            {layer.enabled ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CUSTOM AUDIO FILE UPLOAD & SEAMLESS LOOPING */}
              {editorTab === 'CUSTOM_FILE' && (
                <div className="space-y-5 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      void processAudioFile(file);
                      e.target.value = '';
                    }}
                  />

                  {/* Drag & Drop Upload Box */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      const file = e.dataTransfer.files?.[0];
                      void processAudioFile(file);
                    }}
                    className={`rounded-2xl border border-dashed p-5 text-center transition-colors ${
                      isDraggingFile
                        ? 'bg-amber-500/10 border-amber-400'
                        : 'bg-[#0B1120] border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2.5">
                      <Upload className="w-6 h-6 text-amber-400" />
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-white">
                          {isUploading
                            ? 'Memproses & Mendekode File Audio...'
                            : trackConfig.customFileName
                            ? 'Ganti File Audio untuk Slot Ini'
                            : `Upload Musik Kustom untuk ${baseMeta.label}`}
                        </div>
                        <p className="text-xs text-slate-400">
                          Tarik file ke sini atau klik tombol di bawah. Mendukung MP3, WAV, OGG, M4A (maks. 45 MB, tersimpan otomatis di perangkat).
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-1 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        <span>{trackConfig.customFileName ? 'Pilih File Baru' : 'Pilih File Audio'}</span>
                      </button>
                    </div>
                  </div>

                  {uploadStatus && (
                    <div
                      className={`px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                        uploadStatus.kind === 'success'
                          ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-200'
                          : 'bg-rose-950/35 border-rose-500/40 text-rose-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {uploadStatus.kind === 'success' ? (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>{uploadStatus.message}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setUploadStatus(null)}
                        className="text-slate-400 hover:text-white shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Active Uploaded File Controls */}
                  {trackConfig.customFileName ? (
                    <div className="space-y-4 pt-2 border-t border-slate-800/80">
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0B1120] border border-slate-800 rounded-xl p-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileAudio className="w-5 h-5 text-amber-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-white truncate">
                              {trackConfig.customFileName}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                              Durasi {formatSecondsMmSs(trackConfig.customDurationSec)}
                              <span className="mx-1.5 text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span>
                                {trackConfig.sourceMode === 'CUSTOM_FILE'
                                  ? 'Aktif Dipakai'
                                  : 'Tersimpan (Mode Synth Aktif)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {trackConfig.sourceMode !== 'CUSTOM_FILE' && (
                            <button
                              type="button"
                              onClick={() =>
                                soundFx.updateTrackConfig(
                                  selectedTrack,
                                  { sourceMode: 'CUSTOM_FILE' },
                                  { forceRestart: true }
                                )
                              }
                              className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg whitespace-nowrap shrink-0"
                            >
                              Gunakan File Ini
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              void soundFx.removeCustomBgmFile(selectedTrack);
                              setUploadStatus(null);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Hapus File</span>
                          </button>
                        </div>
                      </div>

                      {/* Playback Rate & Seamless Loop Trim Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-200">Kecepatan Putar</span>
                            <span className="font-mono text-sky-300 tabular-nums">
                              {trackConfig.playbackRate.toFixed(2)}×
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.75}
                            max={1.5}
                            step={0.05}
                            value={trackConfig.playbackRate}
                            aria-label="Kecepatan Putar File Audio"
                            onChange={(e) =>
                              soundFx.updateTrackConfig(selectedTrack, {
                                playbackRate: Number(e.target.value),
                              })
                            }
                            className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                          />
                          <div className="flex justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                            <span>0.75×</span>
                            <span>1.00×</span>
                            <span>1.50×</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-200">Mulai Loop</span>
                            <span className="font-mono text-amber-300 tabular-nums">
                              {formatSecondsMmSs(trackConfig.loopStartSec)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(0, maxLoopSeconds - 1)}
                            step={0.5}
                            disabled={maxLoopSeconds <= 1}
                            value={Math.min(
                              trackConfig.loopStartSec,
                              Math.max(0, maxLoopSeconds - 1)
                            )}
                            aria-label="Detik Mulai Loop"
                            onChange={(e) => {
                              const nextStart = Number(e.target.value);
                              const patch: { loopStartSec: number; loopEndSec?: number } = {
                                loopStartSec: nextStart,
                              };
                              if (
                                trackConfig.loopEndSec > 0 &&
                                trackConfig.loopEndSec <= nextStart + 0.5
                              ) {
                                patch.loopEndSec = 0;
                              }
                              soundFx.updateTrackConfig(selectedTrack, patch);
                            }}
                            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                          />
                          <div className="flex justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                            <span>00:00</span>
                            <span>Awal Lagu</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-200">Akhir Loop</span>
                            <span className="font-mono text-emerald-300 tabular-nums">
                              {trackConfig.loopEndSec > 0
                                ? formatSecondsMmSs(trackConfig.loopEndSec)
                                : 'Penuh'}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={maxLoopSeconds}
                            step={0.5}
                            disabled={maxLoopSeconds <= 1}
                            value={
                              trackConfig.loopEndSec > 0
                                ? Math.min(trackConfig.loopEndSec, maxLoopSeconds)
                                : 0
                            }
                            aria-label="Detik Akhir Loop"
                            onChange={(e) => {
                              const rawEnd = Number(e.target.value);
                              const validEnd =
                                rawEnd > 0 && rawEnd <= trackConfig.loopStartSec + 0.5
                                  ? Math.min(maxLoopSeconds, trackConfig.loopStartSec + 1)
                                  : rawEnd;
                              soundFx.updateTrackConfig(selectedTrack, {
                                loopEndSec: validEnd,
                              });
                            }}
                            className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                          />
                          <div className="flex justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                            <span>0 = Penuh</span>
                            <span>{formatSecondsMmSs(trackConfig.customDurationSec)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 leading-relaxed">
                      Belum ada file audio kustom di slot <strong className="text-slate-200">{baseMeta.label}</strong>. Selama belum ada file yang diunggah, game otomatis memainkan aransemen synth bawaan untuk fase ini.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dynamic 1v1 Victory Celebration SFX Configuration */}
            <div className="pt-5 border-t border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-display font-bold text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Efek Suara Perayaan Kemenangan 1v1 Dinamis</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Mengatur sorakan penonton, tepuk tangan, dan suara announcer (&ldquo;Victory!&rdquo;, &ldquo;Perfect Victory!&rdquo;, &ldquo;Comeback Victory!&rdquo;) saat memenangkan duel.
                  </p>
                </div>
              </div>

              {/* Style Selector & Layer Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7 space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-300">
                    Gaya Perayaan Audio
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'DYNAMIC', label: 'Dinamis (Badge)' },
                        { id: 'STADIUM_EPIC', label: 'Stadion Megah' },
                        { id: 'ARCADE_RETRO', label: 'Arkade Klasik' },
                      ] as Array<{ id: CelebrationAudioStyle; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          soundFx.setCelebrationStyle(opt.id);
                          soundFx.playCardSelect();
                        }}
                        className={`px-2.5 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap truncate ${
                          audio.celebrationStyle === opt.id
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                            : 'bg-[#0B1120] hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-5 space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-300">
                    Komponen Perayaan Aktif
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        soundFx.setCelebrationCrowdEnabled(!audio.celebrationCrowdEnabled)
                      }
                      className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap truncate ${
                        audio.celebrationCrowdEnabled
                          ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-200'
                          : 'bg-[#0B1120] border-slate-800 text-slate-500'
                      }`}
                    >
                      Sorakan: {audio.celebrationCrowdEnabled ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        soundFx.setCelebrationVoiceEnabled(!audio.celebrationVoiceEnabled)
                      }
                      className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap truncate ${
                        audio.celebrationVoiceEnabled
                          ? 'bg-sky-500/15 border-sky-500/45 text-sky-200'
                          : 'bg-[#0B1120] border-slate-800 text-slate-500'
                      }`}
                    >
                      Voice: {audio.celebrationVoiceEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Audition Dynamic Callout Tiers & Optional Custom SFX File */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (audio.muted) soundFx.toggleMute();
                      soundFx.playVictoryCelebration({
                        outcome: 'VICTORY',
                        calloutOverride: 'VICTORY',
                      });
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B1120] hover:bg-slate-800 border border-slate-700 text-amber-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3 h-3 fill-current shrink-0" />
                    <span>Uji &ldquo;Victory!&rdquo;</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (audio.muted) soundFx.toggleMute();
                      soundFx.playVictoryCelebration({
                        outcome: 'VICTORY',
                        isPerfectWin: true,
                        calloutOverride: 'PERFECT_VICTORY',
                      });
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B1120] hover:bg-slate-800 border border-slate-700 text-emerald-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3 h-3 fill-current shrink-0" />
                    <span>Uji &ldquo;Perfect Victory!&rdquo;</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (audio.muted) soundFx.toggleMute();
                      soundFx.playVictoryCelebration({
                        outcome: 'VICTORY',
                        isComeback: true,
                        calloutOverride: 'COMEBACK_VICTORY',
                      });
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B1120] hover:bg-slate-800 border border-slate-700 text-rose-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3 h-3 fill-current shrink-0" />
                    <span>Uji &ldquo;Comeback!&rdquo;</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={celebrationSfxInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      const res = await soundFx.uploadCustomCelebrationSfx(f);
                      setCelebrationUploadMsg(
                        res.ok
                          ? `Efek perayaan kustom "${f.name}" aktif.`
                          : (res.error ?? 'Gagal memuat file efek suara.')
                      );
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => celebrationSfxInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {audio.customCelebrationFileName
                        ? 'Ganti SFX Perayaan'
                        : 'Upload SFX Sorakan'}
                    </span>
                  </button>
                  {audio.customCelebrationFileName && (
                    <button
                      type="button"
                      onClick={() => {
                        void soundFx.removeCustomCelebrationSfx();
                        setCelebrationUploadMsg(null);
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-200 transition-colors whitespace-nowrap shrink-0"
                    >
                      Hapus SFX
                    </button>
                  )}
                </div>
              </div>

              {(audio.customCelebrationFileName || celebrationUploadMsg) && (
                <div className="text-xs font-mono text-slate-400 tabular-nums">
                  {celebrationUploadMsg ??
                    `SFX Perayaan Kustom Aktif: ${audio.customCelebrationFileName}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Studio Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-[#0B1120] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!isTrackEdited}
              onClick={() => {
                soundFx.playCardSelect();
                void soundFx.resetTrackToDefault(selectedTrack);
                setEditorTab('SYNTH');
                setUploadStatus(null);
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Reset Trek Ini</span>
            </button>

            {totalEditedCount > 0 && !confirmResetAll && (
              <button
                type="button"
                onClick={() => setConfirmResetAll(true)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 transition-colors whitespace-nowrap shrink-0"
              >
                Reset Semua BGM ({totalEditedCount})
              </button>
            )}

            {confirmResetAll && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    void soundFx.resetAllTracksToDefault();
                    setEditorTab('SYNTH');
                    setConfirmResetAll(false);
                    setUploadStatus(null);
                  }}
                  className="px-3 py-2 text-xs font-bold rounded-xl bg-rose-500 hover:bg-rose-400 text-white transition-colors whitespace-nowrap shrink-0"
                >
                  Ya, Reset 6 Trek
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetAll(false)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap shrink-0"
                >
                  Batal
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {audio.controlMode !== 'AUTO' && (
              <button
                type="button"
                onClick={() => soundFx.closeBgmStudio()}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                Tutup (Kunci Trek Uji)
              </button>
            )}
            <button
              type="button"
              onClick={handleCloseAndReturnAdaptive}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Selesai &amp; Mode Adaptif
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
