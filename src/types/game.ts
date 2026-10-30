export const CardCategory = {
  CHARACTER: 'CHARACTER',
  SUPPORT: 'SUPPORT',
  SUIT: 'SUIT',
} as const;
export type CardCategory = (typeof CardCategory)[keyof typeof CardCategory];

export const SuitElement = {
  AIR: 'AIR',
  API: 'API',
  DAUN: 'DAUN',
} as const;
export type SuitElement = (typeof SuitElement)[keyof typeof SuitElement];

export type CardRank = 'SR' | 'AR' | 'S' | 'A' | 'B' | 'C' | 'SUPPORT' | 'SUIT';

export type HologramFinish =
  | 'NONE'
  | 'RAINBOW_PRISM'
  | 'SOLAR_GOLD'
  | 'CRYO_FROST'
  | 'STARDUST_GALAXY';

export type EffectPriority = 1 | 2 | 3;

export type ConditionMode = 'ALL' | 'ANY';

export interface CardCondition {
  mode: ConditionMode;
  requiredTags: string[];
  description: string;
}

export type EffectKey =
  | 'SHIELD_ONCE' // 1/54 Probe, 9/54 Ying
  | 'NULLIFY_ENEMY_EFFECT' // 2/54 Alpha Tumbosaur, 19/54 Halilintar, 21/54 Gempa, 36/54 Ais
  | 'BLIND_DISCARD_ENEMY_HAND_1' // 3/54 Adu Du (pilih tanpa melihat isi tangan lawan)
  | 'DISCARD_ENEMY_HAND_1' // 20/54 Adu Du & Probe, 34/54 Blaze (lihat tangan lawan lalu pilih 1)
  | 'TUTOR_DURI' // 4/54 Solar
  | 'SORI_COUNTER_HP_40' // 5/54 Sori
  | 'TUTOR_SOLAR' // 6/54 Duri
  | 'YAYA_SUIT1_WIN_ATK_40' // 7/54 Yaya
  | 'SHIELD_TWICE' // 10/54 Kuputeri
  | 'RETURN_ENEMY_HAND_3_TO_DECK' // 11/54 Taufan
  | 'REFLECT_FIRST_ATTACK' // 12/54 Maharaja Reramos
  | 'MARIPOS_KUPUTERI_BUFF' // 13/54 Maripos
  | 'BELIUNG_AUTO_WIN_KUPUTERI' // 14/54 Beliung
  | 'DRAW_2' // 15/54 Jeneral Cikala, 45/54 Operatif P.A.P.A
  | 'COPY_ENEMY_DECK_SUPPORT' // 16/54 Yaya & Ying
  | 'DRAW_3' // 17/54 Adu Du [C]
  | 'GOPAL_FANG_DRAW_STEAL_WIN' // 18/54 Gopal & Fang
  | 'SUPPORT_HAMMER_GENTAR' // 22/54 Hammer Gentar
  | 'GENTAR_SUIT1_LOSE_ATK_160' // 23/54 Gentar
  | 'ROSAKSA_COPY_ENEMY_DECK_EFFECT' // 24/54 Rosaksa Final Form
  | 'TOK_ABA_AUTO_WIN_BOBOIBOY' // 25/54 Tok Aba
  | 'SUPPORT_KEPAKU_PARK' // 26/54 Kepaku Park
  | 'TUTOR_ANY_FROM_DECK' // 27/54 Gopal & Qually
  | 'YING_COPY_ENEMY_DECK_STATS' // 28/54 Ying [C]
  | 'YAYA_HAND_BURN_20' // 29/54 Yaya
  | 'GOPAL_LOSE_ZONE_HEAL_20' // 30/54 Gopal
  | 'NOVA_WIPE_HAND_BURN_40' // 31/54 Nova
  | 'TUTOR_SOPAN' // 32/54 Solar & Taufan
  | 'SOPAN_RETURN_ENEMY_WIN_2' // 32/54 SR Sopan
  | 'BLIZZARD_WIPE_HAND_DRAIN_ATK_40' // 33/54 Blizzard
  | 'SUPPORT_ROCKFAMILY_ATK_20' // 35/54 Rockfamily
  | 'KACHAX_SUPPORT_GRAVE_ATK_20' // 37/54 Kachax
  | 'MAMA_ZILA_ENEMY_ATK_40' // 38/54 Mama Zila
  | 'TUTOR_SUPPORT_FROM_DECK' // 39/54 Yon B
  | 'PIPI_ZOLA_AUTO_WIN' // 40/54 Pipi Zola
  | 'PAPA_ZOLA_SUIT_MILL_1' // 41/54 Papa Zola Tactical Suit
  | 'SUPER_PAPA_LOCK_SUPPORT_ATK_20' // 41/54 AR Super Papa
  | 'OTOI_AUTO_WIN' // 42/54 Otoi
  | 'SUPPORT_SANG_BUAYA_CANCEL' // 43/54 Sang Buaya
  | 'BOBOIBOY_GOPAL_SWAP_CONDITIONAL' // 44/54 BoBoiBoy & Gopal
  | 'NONE';

export type PackAccentTheme = 'amber' | 'sky' | 'rose' | 'emerald';

export type SuitArtSetId = number;

export interface CardPackSeries {
  id: string;
  codePrefix: string;
  name: string;
  editionLabel: string;
  description: string;
  coverCardId: string;
  showcaseCardIds: string[];
  customCoverImage?: string;
  accentTheme: PackAccentTheme;
  cardsPerBooster: number;
  cardIds?: string[];
  isBuiltIn: boolean;
}

export interface CardDefinition {
  id: string;
  numberLabel: string;
  name: string;
  category: CardCategory;
  rank: CardRank;
  image: string;
  hp: number;
  atk: number;
  effectPriority?: EffectPriority;
  effectText: string;
  characterTags: string[];
  condition?: CardCondition;
  effectKey: EffectKey;
  suitElement?: SuitElement;
  suitArtSet?: SuitArtSetId;
  suitSetLabel?: string;
  packSeriesId?: string;
  isCustom?: boolean;
  showCustomOverlay?: boolean;
  hologramFinish?: HologramFinish;
}

export interface AnalyzedCardImageResult {
  name: string;
  detectedCode: string;
  hasPrintedCardFrame: boolean;
  category: CardCategory;
  rank: CardRank;
  hp: number;
  atk: number;
  effectPriority: EffectPriority;
  effectKey: EffectKey;
  effectText: string;
  characterTags: string[];
  hasCondition: boolean;
  conditionMode: ConditionMode;
  conditionRequiredTags: string[];
  conditionDescription: string;
  suitElement: SuitElement;
  suitSetLabel: string;
  summary: string;
}

export interface CardInstance {
  uid: string;
  defId: string;
}

export interface ActiveFighter {
  instance: CardInstance;
  def: CardDefinition;
  currentHp: number;
  maxHp: number;
  currentAtk: number;
  baseAtk: number;
  effectNullified: boolean;
  shieldsRemaining: number;
  firstAttackShield?: boolean;
  enemyAttacksReceived?: number;
  blockStrikeThisClash?: boolean;
  negateEnemySupport?: boolean;
  entryEffectResolved?: boolean;
  reflectFirstAttack: boolean;
  soriCounterArmed: boolean;
  gentarCounterArmed: boolean;
  yayaSuit1Armed: boolean;
  gopalFangArmed: boolean;
  papaZolaMillArmed: boolean;
  blockEnemySupport: boolean;
  statusNotes: string[];
}

export type GameMode = 'VS_CPU' | 'PASS_AND_PLAY' | 'CPU_VS_CPU';

export type CpuDifficulty = 'MUDAH' | 'STANDAR' | 'MASTER';

export type BattlePhase =
  | 'SETUP'
  | 'P1_PICK_CHARACTER'
  | 'P2_PRIVACY_CHARACTER'
  | 'P2_PICK_CHARACTER'
  | 'INTERACTIVE_CHOICE'
  | 'P1_PICK_SUIT'
  | 'P2_PRIVACY_SUIT'
  | 'P2_PICK_SUIT'
  | 'SUIT_REVEAL'
  | 'P1_PICK_SUPPORT'
  | 'P2_PRIVACY_SUPPORT'
  | 'P2_PICK_SUPPORT'
  | 'ROUND_END'
  | 'GAME_OVER';

export type ChoicePurpose =
  | 'DISCARD_ENEMY_HAND_1'
  | 'RETURN_ENEMY_HAND_3'
  | 'TUTOR_ANY_FROM_DECK'
  | 'TUTOR_SUPPORT_FROM_DECK'
  | 'SWAP_CONDITIONAL_FROM_DECK'
  | 'COPY_ENEMY_DECK_SUPPORT'
  | 'COPY_ENEMY_DECK_EFFECT'
  | 'COPY_ENEMY_DECK_STATS'
  | 'RETURN_ENEMY_WIN_2';

export interface PendingChoice {
  playerIndex: 0 | 1;
  purpose: ChoicePurpose;
  title: string;
  subtitle: string;
  candidates: CardInstance[];
  concealCandidates?: boolean;
  maxSelect: number;
  minSelect: number;
  resumePhaseAfterChoices: 'SUIT_START' | 'COMBAT_RESOLVE';
}

export interface PlayerBattleState {
  id: 0 | 1;
  name: string;
  isCpu: boolean;
  deck: CardInstance[];
  hand: CardInstance[];
  winZone: CardInstance[];
  loseZone: CardInstance[];
  active: ActiveFighter | null;
  pendingCharacterUid: string | null;
  selectedSuit: SuitElement | null;
  pendingSupportUid: string | null;
  playedSupportCard: CardDefinition | null;
  usedCharacterTags: string[];
  suitArtSet: SuitArtSetId;
}

export interface BattleLogEntry {
  id: string;
  round: number;
  text: string;
  tone: 'neutral' | 'p1' | 'p2' | 'highlight' | 'warning';
}

export interface PresetDeck {
  id: string;
  name: string;
  subtitle: string;
  featuredCardId: string;
  cardIds: string[];
}

export type DeckTargetSize = 10 | 15 | 20 | 30;

export interface SavedUserDeck {
  id: string;
  name: string;
  targetSize: DeckTargetSize;
  suitArtSet: SuitArtSetId;
  cardIds: string[];
  updatedAt: number;
}

export interface RoundRecord {
  round: number;
  p0CardId: string;
  p1CardId: string;
  p0Supports: string[];
  p1Supports: string[];
  suitClashes: number;
  lastP0Suit: SuitElement | null;
  lastP1Suit: SuitElement | null;
  winner: 0 | 1 | 'DRAW';
  summary: string;
}

export type SupportComboKind = 'CHAIN_ATTACK' | 'MULTI_SUPPORT' | 'SUPPORT_SYNERGY';

export interface SupportComboStep {
  cardId: string;
  cardName: string;
  role: 'CHARACTER' | 'SUPPORT' | 'STRIKE';
  effectLabel: string;
}

export interface SupportComboEvent {
  id: string;
  round: number;
  suitAttempt: number;
  playerIndex: 0 | 1;
  playerName: string;
  fighterName: string;
  fighterCardId: string;
  kind: SupportComboKind;
  chainCount: number;
  title: string;
  subtitle: string;
  totalStatBadge: string;
  finalAtk: number;
  finalHp: number;
  steps: SupportComboStep[];
}


