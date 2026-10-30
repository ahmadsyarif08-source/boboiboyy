import React, { useEffect, useState } from 'react';
import { Eye, Heart, Layers, Pencil, Shield, Sparkles, Swords, X } from 'lucide-react';
import {
  BRAND_LOGOS,
  getHologramFinishMeta,
  getPrimaryPackSeriesForCard,
  HOLOGRAM_FINISH_OPTIONS,
  isCardModified,
  resolveCardHologramFinish,
  setCardHologramFinish,
} from '../data/cards';
import {
  ActiveFighter,
  CardCategory,
  CardDefinition,
  type CardPackSeries,
  type HologramFinish,
} from '../types/game';
import { soundFx } from '../utils/sound';
import { Card3DShowcase, InteractiveCard3DTilt } from './Card3DShowcase';

export function getHologramBorderClass(finish: HologramFinish): string {
  switch (finish) {
    case 'RAINBOW_PRISM':
      return 'border-amber-300/75 shadow-amber-400/15';
    case 'SOLAR_GOLD':
      return 'border-amber-400/75 shadow-amber-500/15';
    case 'CRYO_FROST':
      return 'border-sky-300/75 shadow-sky-400/15';
    case 'STARDUST_GALAXY':
      return 'border-fuchsia-400/75 shadow-fuchsia-500/15';
    default:
      return '';
  }
}

export const HologramFoilOverlay: React.FC<{
  finish: HologramFinish;
  showBadge?: boolean;
}> = ({ finish, showBadge = false }) => {
  if (finish === 'NONE') return null;

  const glazeClass =
    finish === 'RAINBOW_PRISM'
      ? 'holo-glaze-prism'
      : finish === 'SOLAR_GOLD'
      ? 'holo-glaze-solar'
      : finish === 'CRYO_FROST'
      ? 'holo-glaze-frost'
      : 'holo-glaze-galaxy';

  const starColor =
    finish === 'SOLAR_GOLD'
      ? 'text-amber-200'
      : finish === 'CRYO_FROST'
      ? 'text-sky-200'
      : finish === 'STARDUST_GALAXY'
      ? 'text-fuchsia-200'
      : 'text-white';

  const badgeTone =
    finish === 'SOLAR_GOLD'
      ? 'bg-amber-950/85 text-amber-200 border-amber-400/60'
      : finish === 'CRYO_FROST'
      ? 'bg-sky-950/85 text-sky-200 border-sky-400/60'
      : finish === 'STARDUST_GALAXY'
      ? 'bg-fuchsia-950/85 text-fuchsia-200 border-fuchsia-400/60'
      : 'bg-slate-950/85 text-amber-200 border-amber-300/60';

  const meta = getHologramFinishMeta(finish);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Iridescent Multi-Stop Holographic Foil Glaze */}
      <div data-holo-glaze="true" className={`absolute inset-0 ${glazeClass} holo-glaze-drift`} />

      {/* Diagonal Specular Shimmer Ribbon */}
      <div
        data-export-ignore="true"
        className="absolute inset-y-0 -left-1/4 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent holo-shimmer-ribbon"
      />

      {/* Crisp 4-Point Holographic Starlight Etchings */}
      <svg
        viewBox="0 0 100 140"
        fill="none"
        className={`absolute inset-0 w-full h-full ${starColor} holo-star-twinkle`}
      >
        <path
          d="M18 16L19.6 20.4L24 22L19.6 23.6L18 28L16.4 23.6L12 22L16.4 20.4L18 16Z"
          fill="currentColor"
          fillOpacity="0.72"
        />
        <path
          d="M82 30L83.3 33.7L87 35L83.3 36.3L82 40L80.7 36.3L77 35L80.7 33.7L82 30Z"
          fill="currentColor"
          fillOpacity="0.65"
        />
        <path
          d="M24 102L25.2 105.5L28.8 106.8L25.2 108L24 111.6L22.8 108L19.2 106.8L22.8 105.5L24 102Z"
          fill="currentColor"
          fillOpacity="0.6"
        />
        <path
          d="M78 112L79.5 116.2L83.8 117.8L79.5 119.3L78 123.6L76.5 119.3L72.2 117.8L76.5 116.2L78 112Z"
          fill="currentColor"
          fillOpacity="0.7"
        />
      </svg>

      {showBadge && (
        <div
          className={`absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded border font-mono text-[8px] sm:text-[9px] font-bold tracking-wider uppercase leading-none ${badgeTone}`}
        >
          HOLO · {meta.shortLabel}
        </div>
      )}
    </div>
  );
};

interface CardVisualProps {
  card: CardDefinition;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  conditionalReady?: boolean;
  enable3DTilt?: boolean;
  onClick?: () => void;
  onInspect?: (card: CardDefinition) => void;
  onEdit?: (card: CardDefinition) => void;
  activeFighter?: ActiveFighter;
  showCaption?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<CardVisualProps['size']>, string> = {
  xs: 'w-20 aspect-[5/7]',
  sm: 'w-28 sm:w-32 aspect-[5/7]',
  md: 'w-36 sm:w-44 aspect-[5/7]',
  lg: 'w-48 sm:w-56 aspect-[5/7]',
};

export const CardBack: React.FC<{ size?: 'xs' | 'sm' | 'md'; label?: string }> = ({
  size = 'sm',
  label,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div
      className={`${SIZE_CLASSES[size]} relative rounded-xl bg-slate-900 border border-slate-700/80 shadow-md overflow-hidden flex flex-col items-center justify-center p-2 select-none`}
    >
      <div className="absolute inset-1.5 rounded-lg border border-amber-500/25 bg-gradient-to-br from-slate-800/90 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-2">
        {!logoFailed ? (
          <img
            src={BRAND_LOGOS.indonesia}
            alt="Monsta Galaxy Card"
            referrerPolicy="no-referrer"
            onError={() => setLogoFailed(true)}
            className="w-4/5 object-contain opacity-90"
          />
        ) : (
          <span className="font-display font-bold text-xs text-amber-400 text-center">
            Monsta Galaxy
          </span>
        )}
        {label && (
          <span className="mt-2 font-mono text-[11px] font-semibold text-slate-300 tabular-nums">
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

export const CardVisual: React.FC<CardVisualProps> = ({
  card,
  size = 'sm',
  selected = false,
  disabled = false,
  disabledReason,
  conditionalReady = false,
  enable3DTilt,
  onClick,
  onInspect,
  onEdit,
  activeFighter,
  showCaption = false,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [card.image]);

  const interactive = Boolean(onClick) && !disabled;
  const holoFinish = resolveCardHologramFinish(card);
  const isHolo = holoFinish !== 'NONE' && !disabled;
  const holoRimClass = isHolo ? getHologramBorderClass(holoFinish) : '';

  const shouldTilt3D =
    enable3DTilt !== undefined
      ? enable3DTilt && !disabled
      : (size === 'md' || size === 'lg') && !disabled && !activeFighter;

  const cardElement = (
    <div
      role={onClick ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        title={disabled && disabledReason ? disabledReason : `${card.name} (${card.numberLabel})`}
        onClick={() => {
          if (interactive && onClick) onClick();
        }}
        onKeyDown={(e) => {
          if (interactive && onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
        className={`${SIZE_CLASSES[size]} card-hover-motion relative rounded-xl overflow-hidden bg-slate-900 border select-none ${
          selected
            ? 'border-amber-400 ring-2 ring-amber-400/80 -translate-y-3 scale-[1.06] shadow-xl cursor-pointer'
            : activeFighter && interactive
            ? `${holoRimClass || 'border-slate-700'} hover:border-amber-400/70 hover:-translate-y-1.5 hover:scale-[1.04] active:scale-[0.98] cursor-pointer shadow-md`
            : conditionalReady && !disabled
            ? 'border-amber-500/80 ring-1 ring-amber-400/40 hover:-translate-y-2.5 hover:scale-[1.06] active:scale-[0.98] cursor-pointer shadow-md'
            : interactive
            ? `${holoRimClass || 'border-slate-700'} hover:border-slate-400 hover:-translate-y-2.5 hover:scale-[1.06] active:scale-[0.98] cursor-pointer shadow-md`
            : disabled
            ? 'border-slate-800 opacity-45 grayscale-[35%] cursor-not-allowed'
            : `${holoRimClass || 'border-slate-700/90'} shadow-md`
        }`}
      >
        {!imgError ? (
          <img
            src={card.image}
            alt={`${card.name} — ${card.numberLabel}`}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-slate-800 to-slate-950 p-3 flex flex-col justify-between text-left">
            <div>
              <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                {card.numberLabel} · {card.rank}
              </div>
              <div className="mt-1 font-display font-bold text-sm text-white leading-snug">
                {card.name}
              </div>
            </div>
            {card.category === CardCategory.CHARACTER && (
              <div className="font-mono text-xs text-amber-300 tabular-nums">
                HP {card.hp} · ATK {card.atk}
              </div>
            )}
            <p className="text-[10px] text-slate-300 line-clamp-3 leading-relaxed">
              {card.effectText}
            </p>
          </div>
        )}

        {/* Selective Hologram Foil Shimmer for Specific Hologram Cards */}
        {isHolo && !imgError && (
          <HologramFoilOverlay
            finish={holoFinish}
            showBadge={!activeFighter && !card.showCustomOverlay && (size === 'md' || size === 'lg')}
          />
        )}

        {/* Live Combat Overlay when in Active Zone */}
        {activeFighter && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-transparent pt-6 pb-2 px-2.5">
            <div className="flex items-center justify-between text-xs font-mono font-bold tabular-nums">
              <span className="flex items-center gap-1 text-rose-300">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 shrink-0" />
                {activeFighter.currentHp}/{activeFighter.maxHp}
              </span>
              <span className="flex items-center gap-1 text-emerald-300">
                <Swords className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {activeFighter.currentAtk}
              </span>
            </div>
            {(activeFighter.blockStrikeThisClash ||
              activeFighter.shieldsRemaining > 0 ||
              activeFighter.firstAttackShield) && (
              <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-sky-300">
                <Shield className="w-3 h-3 shrink-0" />
                <span>
                  {activeFighter.blockStrikeThisClash
                    ? 'Tangkis Bentrokan Ini'
                    : activeFighter.shieldsRemaining > 0
                    ? `Perisai Aktif (${activeFighter.shieldsRemaining}x)`
                    : 'Tangkis Serangan ke-1'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Custom Card Frame Overlay for Uploaded / Custom Styled Cards */}
        {card.showCustomOverlay && !activeFighter && !imgError && (
          <>
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-slate-950/92 via-slate-950/65 to-transparent p-2 flex items-start justify-between gap-1 pointer-events-none">
              <div className="min-w-0">
                <div className="text-[10px] font-mono font-extrabold text-amber-400 leading-none">
                  {card.category === CardCategory.CHARACTER
                    ? `RANK ${card.rank}`
                    : card.category === CardCategory.SUPPORT
                    ? 'PENDUKUNG'
                    : `SUIT ${card.suitElement ?? ''}`}
                </div>
                <div className="mt-0.5 font-display font-bold text-[11px] sm:text-xs text-white truncate drop-shadow-xs">
                  {card.name}
                </div>
              </div>
              {card.category === CardCategory.CHARACTER && (
                <div className="text-right font-mono text-[10px] font-extrabold leading-tight tabular-nums shrink-0">
                  <div className="text-rose-300">{card.hp} HP</div>
                  <div className="text-emerald-300">{card.atk} ATK</div>
                </div>
              )}
            </div>
            {(size === 'md' || size === 'lg') && (
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/92 border-t border-slate-700/80 px-2.5 py-1.5 pointer-events-none text-left">
                <div className="flex items-center justify-between text-[9px] font-mono text-amber-300 tabular-nums">
                  <span>
                    {card.category === CardCategory.SUIT
                      ? `SERI SUIT #${card.suitArtSet ?? 1}`
                      : card.effectPriority
                      ? `EFEK 0${card.effectPriority}`
                      : 'KARTU'}
                  </span>
                  <span className="text-slate-400">{card.numberLabel}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-200 line-clamp-2 leading-snug">
                  {card.effectText}
                </p>
              </div>
            )}
          </>
        )}

        {/* Subtle Foil Sheen Sweep on Hover */}
        {(interactive || selected) && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-200 ease-out"
          />
        )}

        {/* Inspect & Quick Edit Affordances */}
        {(onInspect || onEdit) && (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
            {onInspect && (
              <button
                type="button"
                aria-label={`Lihat detail kartu ${card.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onInspect(card);
                }}
                className="w-7 h-7 rounded-lg bg-slate-950/85 text-slate-200 hover:bg-amber-500 hover:text-slate-950 flex items-center justify-center border border-slate-700/80"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                aria-label={`Edit kartu ${card.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(card);
                }}
                className="w-7 h-7 rounded-lg bg-slate-950/85 text-amber-300 hover:bg-amber-500 hover:text-slate-950 flex items-center justify-center border border-slate-700/80"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
  );

  return (
    <div className="group relative flex flex-col items-center">
      {shouldTilt3D ? (
        <InteractiveCard3DTilt rank={card.rank} hologramFinish={holoFinish}>
          {cardElement}
        </InteractiveCard3DTilt>
      ) : (
        cardElement
      )}

      {showCaption && (
        <div className="mt-2 w-full text-center px-1">
          <div className="text-xs font-semibold text-slate-100 truncate">{card.name}</div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
            {card.category === CardCategory.CHARACTER
              ? `HP ${card.hp} · ATK ${card.atk}`
              : card.category === CardCategory.SUPPORT
              ? `Pendukung · Efek 0${card.effectPriority ?? 2}`
              : `Kartu Suit · ${card.suitElement}`}
          </div>
        </div>
      )}
    </div>
  );
};

export const CardDetailModal: React.FC<{
  card: CardDefinition | null;
  onClose: () => void;
  onEditCard?: (card: CardDefinition) => void;
  onEditPackSeries?: (pack: CardPackSeries) => void;
  onCardsMutated?: () => void;
}> = ({ card, onClose, onEditCard, onEditPackSeries, onCardsMutated }) => {
  if (!card) return null;

  const modified = isCardModified(card.id);
  const packSeries = getPrimaryPackSeriesForCard(card);
  const activeHoloFinish = resolveCardHologramFinish(card);

  const handleSelectHologram = (nextFinish: HologramFinish) => {
    soundFx.playCardSelect();
    const res = setCardHologramFinish(card.id, nextFinish);
    if (res.ok && onCardsMutated) {
      onCardsMutated();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/88 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#131C31] border border-slate-700/90 rounded-2xl p-5 sm:p-6 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup detail kartu"
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-lg bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Column: Full Interactive 3D Card Display Showcase */}
        <div className="lg:col-span-6 flex justify-center">
          <Card3DShowcase card={card} />
        </div>

        {/* Right Column: Card Details, Hologram Selector & Studio Shortcuts */}
        <div className="lg:col-span-6 flex flex-col gap-4 text-left pt-1 sm:pr-8">
          <div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              <span className="text-amber-300">
                [{packSeries.codePrefix}] {packSeries.name}
                {modified && !card.isCustom ? ' (Diedit)' : ''}
              </span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>No. {card.numberLabel}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>
                {card.category === CardCategory.CHARACTER
                  ? `Rank ${card.rank}`
                  : card.category === CardCategory.SUPPORT
                  ? 'Kartu Pendukung'
                  : `Suit ${card.suitElement}`}
              </span>
              {activeHoloFinish !== 'NONE' && (
                <>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span className="text-sky-300">
                    {getHologramFinishMeta(activeHoloFinish).label}
                  </span>
                </>
              )}
            </div>
            <h3 className="mt-1 text-2xl font-display font-bold text-white">{card.name}</h3>
          </div>

          {card.category === CardCategory.CHARACTER && (
            <div className="flex flex-wrap items-center gap-5 py-3 border-y border-slate-800 font-mono text-sm tabular-nums">
              <div>
                <span className="text-slate-400">HP Dasar: </span>
                <span className="font-bold text-rose-300">{card.hp}</span>
              </div>
              <div>
                <span className="text-slate-400">ATK Dasar: </span>
                <span className="font-bold text-emerald-300">{card.atk}</span>
              </div>
              {card.effectPriority && (
                <div>
                  <span className="text-slate-400">Prioritas: </span>
                  <span className="font-bold text-amber-300">Efek 0{card.effectPriority}</span>
                </div>
              )}
            </div>
          )}

          {card.condition && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="text-xs font-semibold text-amber-300">
                Syarat Penggunaan (Kartu Bersyarat)
              </div>
              <p className="mt-1 text-sm text-amber-100/90 leading-relaxed">
                {card.condition.description}
              </p>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-400">
              {card.effectPriority
                ? `Efek Kartu (Urutan Efek 0${card.effectPriority})`
                : 'Keterangan Kartu'}
            </div>
            <p className="mt-1.5 text-sm text-slate-200 leading-relaxed">{card.effectText}</p>
          </div>

          {/* Selective Per-Card Hologram Foil Controls */}
          <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Efek Kartu Hologram (Khusus Kartu Ini)</span>
              </div>
              <span className="text-[11px] font-mono text-amber-300">
                {getHologramFinishMeta(activeHoloFinish).shortLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {HOLOGRAM_FINISH_OPTIONS.map((opt) => {
                const isSelected = activeHoloFinish === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectHologram(opt.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                        : 'bg-[#131C31] hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              {getHologramFinishMeta(activeHoloFinish).description}
            </p>
          </div>

          {card.category === CardCategory.SUIT && (
            <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800 text-xs text-slate-300 font-mono">
              Seri Kartu Suit #{card.suitArtSet ?? 1}
              {card.suitSetLabel ? ` · ${card.suitSetLabel}` : ''} · Elemen {card.suitElement}
            </div>
          )}

          {card.characterTags.length > 0 && (
            <div className="text-xs text-slate-400">
              <span>Kategori Karakter: </span>
              <span className="text-slate-200">{card.characterTags.join(' · ')}</span>
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center gap-2.5">
            {onEditCard && (
              <button
                type="button"
                onClick={() => {
                  const target = card;
                  onClose();
                  onEditCard(target);
                }}
                className="px-4 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Kartu Ini</span>
              </button>
            )}

            {onEditPackSeries && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditPackSeries(packSeries);
                }}
                className="px-4 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/35 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Edit Seri {packSeries.codePrefix}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
