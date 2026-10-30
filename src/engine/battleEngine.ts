import {
  CARD_BY_ID,
  deduplicateDeckIds,
} from '../data/cards.ts';
import {
  CardCategory,
  SuitElement,
  type ActiveFighter,
  type BattleLogEntry,
  type BattlePhase,
  type CardDefinition,
  type CardInstance,
  type CpuDifficulty,
  type EffectKey,
  type GameMode,
  type PendingChoice,
  type PlayerBattleState,
  type RoundRecord,
  type SuitArtSetId,
  type SupportComboEvent,
  type SupportComboKind,
  type SupportComboStep,
} from '../types/game.ts';

export interface FullBattleState {
  matchId?: string;
  createdAt?: number;
  mode: GameMode;
  difficulty: CpuDifficulty;
  p0Difficulty: CpuDifficulty;
  targetWins: number;
  maxRounds: number | null;
  round: number;
  suitAttemptInRound: number;
  phase: BattlePhase;
  players: [PlayerBattleState, PlayerBattleState];
  choiceQueue: PendingChoice[];
  pendingEntryPriority3?: boolean;
  lastSuitWinner: 0 | 1 | 'DRAW' | null;
  roundSummaryText: string | null;
  winnerIndex: 0 | 1 | 'DRAW' | null;
  winReason: string | null;
  logs: BattleLogEntry[];
  roundHistory: RoundRecord[];
  comboHistory: SupportComboEvent[];
  currentRoundP0CardId: string | null;
  currentRoundP1CardId: string | null;
  currentRoundP0Supports: string[];
  currentRoundP1Supports: string[];
  currentRoundSuitClashes: number;
}

export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function canPlayCharacterCard(
  def: CardDefinition,
  usedCharacterTags: string[]
): { playable: boolean; reason?: string } {
  if (def.category !== CardCategory.CHARACTER) {
    return { playable: false, reason: 'Kartu Pendukung hanya dipakai setelah Suit.' };
  }
  if (!def.condition) {
    return { playable: true };
  }
  const { mode, requiredTags, description } = def.condition;
  if (mode === 'ALL') {
    const missing = requiredTags.filter((tag) => !usedCharacterTags.includes(tag));
    if (missing.length > 0) {
      return {
        playable: false,
        reason: `Syarat belum terpenuhi: ${description}`,
      };
    }
    return { playable: true };
  } else {
    const hasAny = requiredTags.some((tag) => usedCharacterTags.includes(tag));
    if (!hasAny) {
      return {
        playable: false,
        reason: `Syarat belum terpenuhi: ${description}`,
      };
    }
    return { playable: true };
  }
}

function buildInitialDeckAndHand(
  playerIndex: 0 | 1,
  cardIds: string[],
  requestedHandSize = 4
): { deck: CardInstance[]; hand: CardInstance[] } {
  const uniqueIds = deduplicateDeckIds(cardIds);
  let instances: CardInstance[] = uniqueIds.map((defId, idx) => ({
    uid: `p${playerIndex}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    defId,
  }));

  const handSize = Math.max(1, Math.min(requestedHandSize, instances.length));
  const minPlayableNeeded = Math.min(2, Math.max(1, handSize));

  for (let attempt = 0; attempt < 15; attempt++) {
    instances = shuffleArray(instances);
    const hand = instances.slice(0, handSize);
    const playableCount = hand.filter((inst) => {
      const def = CARD_BY_ID[inst.defId];
      return def && canPlayCharacterCard(def, []).playable;
    }).length;
    if (playableCount >= minPlayableNeeded) {
      return { hand, deck: instances.slice(handSize) };
    }
  }

  // Fallback: pull at least 1 unconditional character to top
  const unconditionalIdx = instances.findIndex((inst) => {
    const def = CARD_BY_ID[inst.defId];
    return def && def.category === CardCategory.CHARACTER && !def.condition;
  });
  if (unconditionalIdx >= handSize) {
    [instances[0], instances[unconditionalIdx]] = [instances[unconditionalIdx], instances[0]];
  }
  return { hand: instances.slice(0, handSize), deck: instances.slice(handSize) };
}

function addLog(
  logs: BattleLogEntry[],
  round: number,
  text: string,
  tone: BattleLogEntry['tone'] = 'neutral'
): BattleLogEntry[] {
  const entry: BattleLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    round,
    text,
    tone,
  };
  return [entry, ...logs].slice(0, 60);
}

export function createInitialBattleState(params: {
  mode: GameMode;
  difficulty: CpuDifficulty;
  p0Difficulty?: CpuDifficulty;
  p1IsCpu?: boolean;
  targetWins: number;
  maxRounds?: number | null;
  initialHandSize?: number;
  p1Name: string;
  p2Name: string;
  p1DeckIds: string[];
  p2DeckIds: string[];
  p1SuitSet: SuitArtSetId;
  p2SuitSet: SuitArtSetId;
  matchId?: string;
}): FullBattleState {
  const handSize = params.initialHandSize ?? 4;
  const p1Setup = buildInitialDeckAndHand(0, params.p1DeckIds, handSize);
  const p2Setup = buildInitialDeckAndHand(1, params.p2DeckIds, handSize);
  const maxRounds = params.maxRounds ?? null;
  const p1Cpu = params.mode === 'CPU_VS_CPU' || Boolean(params.p1IsCpu);
  const p2Cpu = params.mode === 'VS_CPU' || params.mode === 'CPU_VS_CPU' || Boolean(params.p1IsCpu);

  const p1: PlayerBattleState = {
    id: 0,
    name: params.p1Name,
    isCpu: p1Cpu,
    deck: p1Setup.deck,
    hand: p1Setup.hand,
    winZone: [],
    loseZone: [],
    active: null,
    pendingCharacterUid: null,
    selectedSuit: null,
    pendingSupportUid: null,
    playedSupportCard: null,
    usedCharacterTags: [],
    suitArtSet: params.p1SuitSet,
  };

  const p2: PlayerBattleState = {
    id: 1,
    name: params.p2Name,
    isCpu: p2Cpu,
    deck: p2Setup.deck,
    hand: p2Setup.hand,
    winZone: [],
    loseZone: [],
    active: null,
    pendingCharacterUid: null,
    selectedSuit: null,
    pendingSupportUid: null,
    playedSupportCard: null,
    usedCharacterTags: [],
    suitArtSet: params.p2SuitSet,
  };

  const openingLog = maxRounds
    ? `Pertarungan ${maxRounds} Ronde dimulai! Setiap kartu unik dan hanya dapat dipakai 1 kali.`
    : `Pertarungan dimulai! Target ${params.targetWins} kartu Zona Menang (setiap kartu hanya dipakai 1 kali).`;

  const logs = addLog([], 1, openingLog, 'highlight');

  const generatedMatchId =
    params.matchId || `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return ensureBothPlayersHavePlayableCharacter({
    matchId: generatedMatchId,
    createdAt: Date.now(),
    mode: params.mode,
    difficulty: params.difficulty,
    p0Difficulty: params.p0Difficulty ?? params.difficulty,
    targetWins: params.targetWins,
    maxRounds,
    round: 1,
    suitAttemptInRound: 1,
    phase: 'P1_PICK_CHARACTER',
    players: [p1, p2],
    choiceQueue: [],
    pendingEntryPriority3: false,
    lastSuitWinner: null,
    roundSummaryText: null,
    winnerIndex: null,
    winReason: null,
    logs,
    roundHistory: [],
    comboHistory: [],
    currentRoundP0CardId: null,
    currentRoundP1CardId: null,
    currentRoundP0Supports: [],
    currentRoundP1Supports: [],
    currentRoundSuitClashes: 0,
  });
}

export function ensureBothPlayersHavePlayableCharacter(state: FullBattleState): FullBattleState {
  const nextPlayers: [PlayerBattleState, PlayerBattleState] = [
    { ...state.players[0], hand: [...state.players[0].hand], deck: [...state.players[0].deck] },
    { ...state.players[1], hand: [...state.players[1].hand], deck: [...state.players[1].deck] },
  ];
  let logs = state.logs;

  for (const idx of [0, 1] as const) {
    const p = nextPlayers[idx];
    if (p.active) continue;

    const hasPlayable = () =>
      p.hand.some((inst) => canPlayCharacterCard(CARD_BY_ID[inst.defId], p.usedCharacterTags).playable);

    while (!hasPlayable() && p.deck.length > 0) {
      const drawn = p.deck.shift()!;
      p.hand.push(drawn);
      logs = addLog(
        logs,
        state.round,
        `${p.name} menarik kartu tambahan karena belum memiliki Karakter yang siap dimainkan.`,
        idx === 0 ? 'p1' : 'p2'
      );
    }

    if (!hasPlayable()) {
      const winnerIdx: 0 | 1 = idx === 0 ? 1 : 0;
      return {
        ...state,
        players: nextPlayers,
        phase: 'GAME_OVER',
        winnerIndex: winnerIdx,
        winReason: `${p.name} kehabisan Kartu Karakter yang dapat dimainkan!`,
        logs: addLog(
          logs,
          state.round,
          `${p.name} tidak memiliki Karakter tersisa. ${nextPlayers[winnerIdx].name} menang!`,
          'highlight'
        ),
      };
    }
  }

  return { ...state, players: nextPlayers, logs };
}

export function createActiveFighter(instance: CardInstance): ActiveFighter {
  const def = CARD_BY_ID[instance.defId];
  return {
    instance,
    def,
    currentHp: def.hp,
    maxHp: def.hp,
    currentAtk: def.atk,
    baseAtk: def.atk,
    effectNullified: false,
    shieldsRemaining: 0,
    firstAttackShield: false,
    enemyAttacksReceived: 0,
    blockStrikeThisClash: false,
    negateEnemySupport: false,
    entryEffectResolved: false,
    reflectFirstAttack: false,
    soriCounterArmed: false,
    gentarCounterArmed: false,
    yayaSuit1Armed: false,
    gopalFangArmed: false,
    papaZolaMillArmed: false,
    blockEnemySupport: false,
    statusNotes: [],
  };
}

export function selectCpuCharacterUid(
  cpu: PlayerBattleState,
  enemy: PlayerBattleState,
  difficulty: CpuDifficulty
): string {
  const playable = cpu.hand.filter(
    (inst) => canPlayCharacterCard(CARD_BY_ID[inst.defId], cpu.usedCharacterTags).playable
  );
  if (playable.length === 0) return cpu.hand[0]?.uid ?? '';
  if (difficulty === 'MUDAH') {
    return playable[Math.floor(Math.random() * playable.length)].uid;
  }

  // Score each playable card heuristically
  let best = playable[0];
  let bestScore = -9999;

  const allGraveAndWin = [
    ...cpu.loseZone,
    ...cpu.winZone,
    ...enemy.loseZone,
    ...enemy.winZone,
  ].map((c) => CARD_BY_ID[c.defId]);

  for (const inst of playable) {
    const def = CARD_BY_ID[inst.defId];
    let score = def.hp + def.atk;

    // Conditional evolutions are high-priority power plays
    if (def.condition) score += 160;

    // Unlocking evolutions currently in hand or deck
    const lockedInHand = cpu.hand
      .map((h) => CARD_BY_ID[h.defId])
      .filter((d) => d.condition && !canPlayCharacterCard(d, cpu.usedCharacterTags).playable);

    for (const locked of lockedInHand) {
      if (locked.condition?.requiredTags.some((t) => def.characterTags.includes(t))) {
        score += difficulty === 'MASTER' ? 140 : 90;
      }
    }

    // Check auto-win conditions
    if (def.effectKey === 'PIPI_ZOLA_AUTO_WIN') {
      const hasPapaMama = allGraveAndWin.some(
        (d) => d.characterTags.includes('Papa Zola') || d.characterTags.includes('Mama Zila')
      );
      score += hasPapaMama ? 900 : -120;
    }
    if (def.effectKey === 'OTOI_AUTO_WIN') {
      const hasPipi = allGraveAndWin.some((d) => d.characterTags.includes('Pipi Zola'));
      score += hasPipi ? 900 : -120;
    }
    if (def.effectKey === 'BELIUNG_AUTO_WIN_KUPUTERI') {
      const hasKupu = allGraveAndWin.some((d) => d.characterTags.includes('Kuputeri'));
      score += hasKupu ? 900 : 80;
    }
    if (def.effectKey === 'TOK_ABA_AUTO_WIN_BOBOIBOY') {
      // Risky but deadly if opponent uses lots of BoBoiBoy
      score += difficulty === 'MASTER' ? 120 : 40;
    }
    if (def.effectKey === 'SOPAN_RETURN_ENEMY_WIN_2' && enemy.winZone.length > 0) {
      score += enemy.winZone.length * 140;
    }
    if (def.effectKey === 'BOBOIBOY_GOPAL_SWAP_CONDITIONAL') {
      const hasCondInDeck = cpu.deck.some((c) => Boolean(CARD_BY_ID[c.defId].condition));
      score += hasCondInDeck ? 180 : -40;
    }

    if (score > bestScore) {
      bestScore = score;
      best = inst;
    }
  }

  return best.uid;
}

export function selectCpuSuit(difficulty: CpuDifficulty): SuitElement {
  const suits = [SuitElement.AIR, SuitElement.API, SuitElement.DAUN];
  if (difficulty === 'MUDAH') {
    return suits[Math.floor(Math.random() * suits.length)];
  }
  return suits[Math.floor(Math.random() * suits.length)];
}

export function selectCpuSupportUid(
  cpu: PlayerBattleState,
  enemy: PlayerBattleState,
  suitWinner: 0 | 1,
  difficulty: CpuDifficulty
): string | null {
  if (enemy.active?.blockEnemySupport || enemy.active?.negateEnemySupport) return null;
  const supports = cpu.hand.filter((c) => CARD_BY_ID[c.defId].category === CardCategory.SUPPORT);
  if (supports.length === 0) return null;
  if (difficulty === 'MUDAH' && Math.random() < 0.5) return null;

  const cpuWonSuit = suitWinner === cpu.id;

  for (const inst of supports) {
    const def = CARD_BY_ID[inst.defId];
    if (!cpuWonSuit && def.effectKey === 'SUPPORT_KEPAKU_PARK') {
      // Block incoming lethal or heavy hit when no active shield/reflect is protecting
      if (
        (cpu.active?.shieldsRemaining ?? 0) === 0 &&
        !cpu.active?.firstAttackShield &&
        !cpu.active?.reflectFirstAttack &&
        !cpu.active?.blockStrikeThisClash
      ) {
        return inst.uid;
      }
    }
    if (def.effectKey === 'SUPPORT_HAMMER_GENTAR') {
      if ((enemy.active?.currentHp ?? 0) > 100 || (enemy.active?.currentAtk ?? 0) >= 120) {
        return inst.uid;
      }
    }
    if (cpuWonSuit && def.effectKey === 'SUPPORT_ROCKFAMILY_ATK_20' && enemy.hand.length >= 2) {
      return inst.uid;
    }
    if (def.effectKey === 'DRAW_2' && cpu.hand.length <= 3) {
      return inst.uid;
    }
    if (def.effectKey === 'SUPPORT_SANG_BUAYA_CANCEL' && enemy.hand.length >= 3 && Math.random() < 0.45) {
      return inst.uid;
    }
  }

  return null;
}

export function compareSuitElements(p0: SuitElement, p1: SuitElement): 0 | 1 | 'DRAW' {
  if (p0 === p1) return 'DRAW';
  if (
    (p0 === SuitElement.AIR && p1 === SuitElement.API) ||
    (p0 === SuitElement.API && p1 === SuitElement.DAUN) ||
    (p0 === SuitElement.DAUN && p1 === SuitElement.AIR)
  ) {
    return 0;
  }
  return 1;
}

function drawCards(player: PlayerBattleState, count: number): void {
  for (let i = 0; i < count; i++) {
    if (player.deck.length > 0) {
      player.hand.push(player.deck.shift()!);
    }
  }
}

function cloneBattleState(state: FullBattleState): FullBattleState {
  return {
    ...state,
    choiceQueue: [...state.choiceQueue],
    logs: [...state.logs],
    roundHistory: [...state.roundHistory],
    comboHistory: [...(state.comboHistory ?? [])],
    currentRoundP0Supports: [...state.currentRoundP0Supports],
    currentRoundP1Supports: [...state.currentRoundP1Supports],
    players: [
      {
        ...state.players[0],
        deck: [...state.players[0].deck],
        hand: [...state.players[0].hand],
        winZone: [...state.players[0].winZone],
        loseZone: [...state.players[0].loseZone],
        usedCharacterTags: [...state.players[0].usedCharacterTags],
        active: state.players[0].active
          ? {
              ...state.players[0].active,
              statusNotes: [...state.players[0].active.statusNotes],
            }
          : null,
      },
      {
        ...state.players[1],
        deck: [...state.players[1].deck],
        hand: [...state.players[1].hand],
        winZone: [...state.players[1].winZone],
        loseZone: [...state.players[1].loseZone],
        usedCharacterTags: [...state.players[1].usedCharacterTags],
        active: state.players[1].active
          ? {
              ...state.players[1].active,
              statusNotes: [...state.players[1].active.statusNotes],
            }
          : null,
      },
    ],
  };
}

function scoreConditionalSwapCandidate(
  def: CardDefinition,
  owner: PlayerBattleState,
  enemy: PlayerBattleState
): number {
  let score = def.hp + def.atk;
  const allZones = [...owner.loseZone, ...owner.winZone, ...enemy.loseZone, ...enemy.winZone];
  const hasTagInZones = (tag: string) =>
    allZones.some((c) => CARD_BY_ID[c.defId]?.characterTags.includes(tag));

  if (def.effectKey === 'BELIUNG_AUTO_WIN_KUPUTERI') {
    score += hasTagInZones('Kuputeri') ? 2000 : 0;
  } else if (def.effectKey === 'PIPI_ZOLA_AUTO_WIN') {
    score += hasTagInZones('Papa Zola') || hasTagInZones('Mama Zila') ? 2000 : -200;
  } else if (def.effectKey === 'OTOI_AUTO_WIN') {
    score += hasTagInZones('Pipi Zola') ? 2000 : -200;
  } else if (def.effectKey === 'SOPAN_RETURN_ENEMY_WIN_2') {
    score += enemy.winZone.length * 180;
  } else if (def.effectKey === 'NOVA_WIPE_HAND_BURN_40') {
    score += enemy.hand.length * 60;
  } else if (def.effectKey === 'BLIZZARD_WIPE_HAND_DRAIN_ATK_40') {
    score += enemy.hand.length * 50;
  }
  return score;
}

function scoreCopiedEffectCandidate(
  def: CardDefinition,
  owner: PlayerBattleState,
  enemy: PlayerBattleState
): number {
  const allZones = [...owner.loseZone, ...owner.winZone, ...enemy.loseZone, ...enemy.winZone];
  const hasTagInZones = (tag: string) =>
    allZones.some((c) => CARD_BY_ID[c.defId]?.characterTags.includes(tag));

  switch (def.effectKey) {
    case 'TOK_ABA_AUTO_WIN_BOBOIBOY':
      return enemy.active?.def.characterTags.includes('BoBoiBoy') ? 2000 : -500;
    case 'BELIUNG_AUTO_WIN_KUPUTERI':
      return hasTagInZones('Kuputeri') ? 2000 : -500;
    case 'PIPI_ZOLA_AUTO_WIN':
      return hasTagInZones('Papa Zola') || hasTagInZones('Mama Zila') ? 2000 : -500;
    case 'OTOI_AUTO_WIN':
      return hasTagInZones('Pipi Zola') ? 2000 : -500;
    case 'NOVA_WIPE_HAND_BURN_40':
      return enemy.hand.length > 0 ? 400 + enemy.hand.length * 60 : -100;
    case 'BLIZZARD_WIPE_HAND_DRAIN_ATK_40':
      return enemy.hand.length > 0 ? 360 + enemy.hand.length * 50 : -100;
    case 'SUPER_PAPA_LOCK_SUPPORT_ATK_20':
      return 420;
    case 'SUPPORT_HAMMER_GENTAR':
      return 410;
    case 'SOPAN_RETURN_ENEMY_WIN_2':
      return enemy.winZone.length > 0 ? 350 + enemy.winZone.length * 140 : -100;
    case 'SHIELD_TWICE':
      return 340;
    case 'REFLECT_FIRST_ATTACK':
      return 320;
    case 'NULLIFY_ENEMY_EFFECT':
      return enemy.active && !enemy.active.effectNullified ? 310 : -50;
    case 'MAMA_ZILA_ENEMY_ATK_40':
      return 290;
    case 'DRAW_3':
      return 280;
    case 'DRAW_2':
      return 240;
    case 'SHIELD_ONCE':
    case 'SUPPORT_KEPAKU_PARK':
      return 220;
    default:
      return 120;
  }
}

function findNamedCardIndexInDeck(
  deck: CardInstance[],
  preferredDefId: string,
  exactLowerName: string,
  fallbackTag: string
): number {
  const exactIdx = deck.findIndex((c) => {
    const d = CARD_BY_ID[c.defId];
    return d && (d.id === preferredDefId || d.name.trim().toLowerCase() === exactLowerName);
  });
  if (exactIdx >= 0) return exactIdx;
  return deck.findIndex((c) => CARD_BY_ID[c.defId]?.characterTags.includes(fallbackTag));
}

function applySingleEffectKey(
  s: FullBattleState,
  ownerIdx: 0 | 1,
  effectKey: EffectKey,
  sourceName: string,
  instantWins: Set<0 | 1>
): void {
  const enemyIdx: 0 | 1 = ownerIdx === 0 ? 1 : 0;
  const owner = s.players[ownerIdx];
  const enemy = s.players[enemyIdx];
  const tone = ownerIdx === 0 ? 'p1' : 'p2';

  if (!owner.active || !enemy.active) return;

  switch (effectKey) {
    case 'NULLIFY_ENEMY_EFFECT': {
      if (!enemy.active.effectNullified) {
        enemy.active.effectNullified = true;
        enemy.active.reflectFirstAttack = false;
        enemy.active.firstAttackShield = false;
        enemy.active.shieldsRemaining = 0;
        enemy.active.soriCounterArmed = false;
        enemy.active.gentarCounterArmed = false;
        enemy.active.yayaSuit1Armed = false;
        enemy.active.gopalFangArmed = false;
        enemy.active.papaZolaMillArmed = false;
        enemy.active.blockEnemySupport = false;
        enemy.active.negateEnemySupport = false;
        enemy.active.statusNotes.push('Efek Dibatalkan (Efek 01)');
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Efek kartu ${enemy.active.def.name} menjadi tidak efektif!`,
          tone
        );
      }
      break;
    }
    case 'SHIELD_ONCE': {
      if ((owner.active.enemyAttacksReceived ?? 0) === 0) {
        owner.active.firstAttackShield = true;
        if (!owner.active.statusNotes.includes('Tangkis Serangan ke-1')) {
          owner.active.statusNotes.push('Tangkis Serangan ke-1');
        }
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Serangan pertama lawan tidak efektif!`,
          tone
        );
      }
      break;
    }
    case 'SHIELD_TWICE': {
      owner.active.shieldsRemaining += 2;
      owner.active.statusNotes.push('Perisai x2');
      s.logs = addLog(
        s.logs,
        s.round,
        `${sourceName}: Serangan lawan tidak efektif sebanyak 2 kali!`,
        tone
      );
      break;
    }
    case 'REFLECT_FIRST_ATTACK': {
      owner.active.reflectFirstAttack = true;
      owner.active.statusNotes.push('Pantul Serangan');
      s.logs = addLog(
        s.logs,
        s.round,
        `${sourceName}: Siap memantulkan serangan pertama lawan (tetap aktif bila Suit pertama seri)!`,
        tone
      );
      break;
    }
    case 'SORI_COUNTER_HP_40': {
      owner.active.soriCounterArmed = true;
      owner.active.statusNotes.push('Siaga Suit 1 (HP Lawan=40)');
      break;
    }
    case 'GENTAR_SUIT1_LOSE_ATK_160': {
      owner.active.gentarCounterArmed = true;
      owner.active.statusNotes.push('Siaga Suit 1 (+160 ATK)');
      break;
    }
    case 'YAYA_SUIT1_WIN_ATK_40': {
      owner.active.yayaSuit1Armed = true;
      owner.active.statusNotes.push('Siaga Suit 1 (+40 ATK)');
      break;
    }
    case 'GOPAL_FANG_DRAW_STEAL_WIN': {
      owner.active.gopalFangArmed = true;
      owner.active.statusNotes.push('Seri Suit: Buang 1 Zona Menang Lawan');
      break;
    }
    case 'PAPA_ZOLA_SUIT_MILL_1': {
      owner.active.papaZolaMillArmed = true;
      owner.active.statusNotes.push('Lawan Menang/Seri Suit: Buang 1 Dek');
      break;
    }
    case 'SUPER_PAPA_LOCK_SUPPORT_ATK_20': {
      owner.active.blockEnemySupport = true;
      owner.active.statusNotes.push('Kunci Pendukung Lawan');
      enemy.active.currentAtk = 20;
      enemy.active.statusNotes.push('ATK jadi 20');
      s.logs = addLog(
        s.logs,
        s.round,
        `${sourceName}: Kartu Pendukung lawan dikunci & ATK ${enemy.active.def.name} menjadi 20!`,
        tone
      );
      break;
    }
    case 'MAMA_ZILA_ENEMY_ATK_40': {
      enemy.active.currentAtk = 40;
      enemy.active.statusNotes.push('ATK jadi 40');
      s.logs = addLog(
        s.logs,
        s.round,
        `${sourceName}: ATK ${enemy.active.def.name} ditetapkan menjadi 40!`,
        tone
      );
      break;
    }
    case 'TUTOR_DURI': {
      const idx = findNamedCardIndexInDeck(
        owner.deck,
        'bf-06-boboiboy-duri',
        'boboiboy duri',
        'BoBoiBoy Duri'
      );
      if (idx >= 0) {
        const [found] = owner.deck.splice(idx, 1);
        owner.hand.push(found);
        owner.deck = shuffleArray(owner.deck);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Mengambil ${CARD_BY_ID[found.defId].name} dari Dek ke tangan!`,
          tone
        );
      } else {
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Tidak ada BoBoiBoy Duri tersisa di Dek.`,
          'neutral'
        );
      }
      break;
    }
    case 'TUTOR_SOLAR': {
      const idx = findNamedCardIndexInDeck(
        owner.deck,
        'bf-04-boboiboy-solar',
        'boboiboy solar',
        'BoBoiBoy Solar'
      );
      if (idx >= 0) {
        const [found] = owner.deck.splice(idx, 1);
        owner.hand.push(found);
        owner.deck = shuffleArray(owner.deck);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Mengambil ${CARD_BY_ID[found.defId].name} dari Dek ke tangan!`,
          tone
        );
      } else {
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Tidak ada BoBoiBoy Solar tersisa di Dek.`,
          'neutral'
        );
      }
      break;
    }
    case 'TUTOR_SOPAN': {
      const idx = findNamedCardIndexInDeck(
        owner.deck,
        'bf-32-sr-boboiboy-sopan',
        'boboiboy sopan',
        'BoBoiBoy Sopan'
      );
      if (idx >= 0) {
        const [found] = owner.deck.splice(idx, 1);
        owner.hand.push(found);
        owner.deck = shuffleArray(owner.deck);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Mengambil ${CARD_BY_ID[found.defId].name} dari Dek ke tangan!`,
          tone
        );
      } else {
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Tidak ada BoBoiBoy Sopan tersisa di Dek.`,
          'neutral'
        );
      }
      break;
    }
    case 'DRAW_2': {
      const before = owner.hand.length;
      drawCards(owner, 2);
      const gained = owner.hand.length - before;
      s.logs = addLog(
        s.logs,
        s.round,
        `${sourceName}: Menarik ${gained} kartu dari Dek ke tangan.`,
        tone
      );
      break;
    }
    case 'DRAW_3': {
      const before = owner.hand.length;
      drawCards(owner, 3);
      const gained = owner.hand.length - before;
      s.logs = addLog(
        s.logs,
        s.round,
        `${sourceName}: Menarik ${gained} kartu dari Dek ke tangan.`,
        tone
      );
      break;
    }
    case 'MARIPOS_KUPUTERI_BUFF': {
      const hasKuputeri = owner.hand.some((c) =>
        CARD_BY_ID[c.defId].characterTags.includes('Kuputeri')
      );
      if (hasKuputeri) {
        owner.active.currentHp += 60;
        owner.active.maxHp += 60;
        owner.active.currentAtk += 60;
        owner.active.statusNotes.push('+60 HP & +60 ATK');
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Kuputeri ada di tangan! HP & ATK +60!`,
          tone
        );
      }
      break;
    }
    case 'GOPAL_LOSE_ZONE_HEAL_20': {
      const count = enemy.loseZone.length;
      if (count > 0) {
        const bonus = count * 20;
        owner.active.currentHp += bonus;
        owner.active.maxHp += bonus;
        owner.active.statusNotes.push(`+${bonus} HP`);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Pertukaran Makanan! HP bertambah +${bonus} (${count} kartu di Zona Kalah lawan).`,
          tone
        );
      }
      break;
    }
    case 'KACHAX_SUPPORT_GRAVE_ATK_20': {
      const supportCount = owner.loseZone.filter(
        (c) => CARD_BY_ID[c.defId].category === CardCategory.SUPPORT
      ).length;
      if (supportCount > 0) {
        const bonus = supportCount * 20;
        owner.active.currentAtk += bonus;
        owner.active.statusNotes.push(`+${bonus} ATK`);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: ATK +${bonus} dari ${supportCount} Kartu Pendukung di Zona Kalah!`,
          tone
        );
      }
      break;
    }
    case 'YAYA_HAND_BURN_20': {
      const count = enemy.hand.length;
      const dmg = count * 20;
      if (dmg > 0) {
        enemy.active.currentHp = Math.max(0, enemy.active.currentHp - dmg);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Hantaman Kuat! ${enemy.active.def.name} menerima ${dmg} kerusakan (${count} kartu di tangan).`,
          tone
        );
      }
      break;
    }
    case 'NOVA_WIPE_HAND_BURN_40': {
      const discardedCount = enemy.hand.length;
      if (discardedCount > 0) {
        enemy.loseZone.push(...enemy.hand);
        enemy.hand = [];
        const dmg = discardedCount * 40;
        enemy.active.currentHp = Math.max(0, enemy.active.currentHp - dmg);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Api Membara! Membuang ${discardedCount} kartu tangan lawan & memberi ${dmg} kerusakan!`,
          'highlight'
        );
      }
      break;
    }
    case 'BLIZZARD_WIPE_HAND_DRAIN_ATK_40': {
      const discardedCount = enemy.hand.length;
      if (discardedCount > 0) {
        enemy.loseZone.push(...enemy.hand);
        enemy.hand = [];
        const drain = discardedCount * 40;
        enemy.active.currentAtk = Math.max(0, enemy.active.currentAtk - drain);
        enemy.active.statusNotes.push(`-${drain} ATK`);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Badai Salju! Membuang ${discardedCount} kartu tangan lawan & mengurangi ATK lawan sebanyak ${drain}!`,
          'highlight'
        );
      }
      break;
    }
    case 'TOK_ABA_AUTO_WIN_BOBOIBOY': {
      if (enemy.active.def.characterTags.includes('BoBoiBoy')) {
        instantWins.add(ownerIdx);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Lawan menggunakan kartu BoBoiBoy (${enemy.active.def.name}) — Tok Aba Otomatis Menang ronde ini!`,
          'highlight'
        );
      }
      break;
    }
    case 'PIPI_ZOLA_AUTO_WIN': {
      const allZones = [...owner.loseZone, ...owner.winZone, ...enemy.loseZone, ...enemy.winZone];
      const matched = allZones.some((c) => {
        const tags = CARD_BY_ID[c.defId].characterTags;
        return tags.includes('Papa Zola') || tags.includes('Mama Zila');
      });
      if (matched) {
        instantWins.add(ownerIdx);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Papa Zola / Mama Zila ada di Zona Kalah/Menang — Pipi Zola Otomatis Menang!`,
          'highlight'
        );
      }
      break;
    }
    case 'OTOI_AUTO_WIN': {
      const allZones = [...owner.loseZone, ...owner.winZone, ...enemy.loseZone, ...enemy.winZone];
      const matched = allZones.some((c) => CARD_BY_ID[c.defId].characterTags.includes('Pipi Zola'));
      if (matched) {
        instantWins.add(ownerIdx);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Pipi Zola ada di Zona Kalah/Menang — Otoi Otomatis Menang!`,
          'highlight'
        );
      }
      break;
    }
    case 'BELIUNG_AUTO_WIN_KUPUTERI': {
      const allZones = [...owner.loseZone, ...owner.winZone, ...enemy.loseZone, ...enemy.winZone];
      const matched = allZones.some((c) => CARD_BY_ID[c.defId].characterTags.includes('Kuputeri'));
      if (matched) {
        instantWins.add(ownerIdx);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Kuputeri ada di Zona Kalah/Menang — BoBoiBoy Beliung Otomatis Menang!`,
          'highlight'
        );
      }
      break;
    }
    case 'BLIND_DISCARD_ENEMY_HAND_1': {
      if (enemy.hand.length === 0) break;
      if (owner.isCpu) {
        // Blind pick without seeing opponent's hand
        const randIdx = Math.floor(Math.random() * enemy.hand.length);
        const target = enemy.hand[randIdx];
        enemy.hand = enemy.hand.filter((c) => c.uid !== target.uid);
        enemy.loseZone.push(target);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName} (${owner.name}) memilih 1 kartu secara acak dari tangan ${enemy.name} (${CARD_BY_ID[target.defId].name}) ke Zona Kalah!`,
          tone
        );
      } else {
        s.choiceQueue.push({
          playerIndex: ownerIdx,
          purpose: 'DISCARD_ENEMY_HAND_1',
          title: `${sourceName} — Pilih 1 Kartu Tertutup Tangan Lawan`,
          subtitle:
            'Pilih 1 kartu tertutup dari tangan lawan (tanpa melihat isinya) untuk diletakkan di Zona Kalah.',
          candidates: shuffleArray([...enemy.hand]),
          concealCandidates: true,
          maxSelect: 1,
          minSelect: 1,
          resumePhaseAfterChoices: 'SUIT_START',
        });
      }
      break;
    }
    case 'DISCARD_ENEMY_HAND_1': {
      if (enemy.hand.length === 0) break;
      if (owner.isCpu) {
        // CPU inspects hand (20/54 Adu Du & Probe, 34/54 Blaze) and picks strongest card
        const sorted = [...enemy.hand].sort((a, b) => {
          const da = CARD_BY_ID[a.defId];
          const db = CARD_BY_ID[b.defId];
          return db.hp + db.atk - (da.hp + da.atk);
        });
        const target = sorted[0];
        enemy.hand = enemy.hand.filter((c) => c.uid !== target.uid);
        enemy.loseZone.push(target);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName} (${owner.name}) melihat tangan ${enemy.name} & membuang ${CARD_BY_ID[target.defId].name} ke Zona Kalah!`,
          tone
        );
      } else {
        s.choiceQueue.push({
          playerIndex: ownerIdx,
          purpose: 'DISCARD_ENEMY_HAND_1',
          title: `${sourceName} — Lihat Tangan Lawan & Pilih 1 Kartu`,
          subtitle: 'Lihat kartu di tangan lawan dan pilih 1 kartu untuk diletakkan di Zona Kalah.',
          candidates: [...enemy.hand],
          concealCandidates: false,
          maxSelect: 1,
          minSelect: 1,
          resumePhaseAfterChoices: 'SUIT_START',
        });
      }
      break;
    }
    case 'RETURN_ENEMY_HAND_3_TO_DECK': {
      if (enemy.hand.length === 0) break;
      const pickCount = Math.min(3, enemy.hand.length);
      if (owner.isCpu) {
        const sorted = [...enemy.hand].sort((a, b) => {
          const da = CARD_BY_ID[a.defId];
          const db = CARD_BY_ID[b.defId];
          return db.hp + db.atk - (da.hp + da.atk);
        });
        const chosen = sorted.slice(0, pickCount);
        const chosenUids = new Set(chosen.map((c) => c.uid));
        enemy.hand = enemy.hand.filter((c) => !chosenUids.has(c.uid));
        enemy.deck = shuffleArray([...enemy.deck, ...chosen]);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName} mengembalikan ${chosen.length} kartu dari tangan ${enemy.name} ke Dek!`,
          tone
        );
      } else {
        s.choiceQueue.push({
          playerIndex: ownerIdx,
          purpose: 'RETURN_ENEMY_HAND_3',
          title: `${sourceName} — Lihat Tangan Lawan & Pilih ${pickCount} Kartu`,
          subtitle: 'Kartu yang dipilih akan dikembalikan ke dalam Dek lawan.',
          candidates: [...enemy.hand],
          maxSelect: pickCount,
          minSelect: pickCount,
          resumePhaseAfterChoices: 'SUIT_START',
        });
      }
      break;
    }
    case 'TUTOR_ANY_FROM_DECK': {
      if (owner.deck.length === 0) break;
      if (owner.isCpu) {
        const sorted = [...owner.deck].sort((a, b) => {
          const da = CARD_BY_ID[a.defId];
          const db = CARD_BY_ID[b.defId];
          return db.hp + db.atk - (da.hp + da.atk);
        });
        const picked = sorted[0];
        owner.deck = shuffleArray(owner.deck.filter((c) => c.uid !== picked.uid));
        owner.hand.push(picked);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName} memilih 1 kartu dari Dek dan menambahkannya ke tangan.`,
          tone
        );
      } else {
        s.choiceQueue.push({
          playerIndex: ownerIdx,
          purpose: 'TUTOR_ANY_FROM_DECK',
          title: `${sourceName} — Pilih 1 Kartu dari Dek`,
          subtitle: 'Tambahkan kartu pilihanmu ke tangan, lalu Dek akan dikocok kembali.',
          candidates: [...owner.deck],
          maxSelect: 1,
          minSelect: 1,
          resumePhaseAfterChoices: 'SUIT_START',
        });
      }
      break;
    }
    case 'TUTOR_SUPPORT_FROM_DECK': {
      const supports = owner.deck.filter(
        (c) => CARD_BY_ID[c.defId].category === CardCategory.SUPPORT
      );
      if (supports.length === 0) {
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Tidak ada Kartu Pendukung tersisa di Dek.`,
          'neutral'
        );
        break;
      }
      if (owner.isCpu) {
        const picked = supports[0];
        owner.deck = shuffleArray(owner.deck.filter((c) => c.uid !== picked.uid));
        owner.hand.push(picked);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName} mengambil 1 Kartu Pendukung dari Dek ke tangan.`,
          tone
        );
      } else {
        s.choiceQueue.push({
          playerIndex: ownerIdx,
          purpose: 'TUTOR_SUPPORT_FROM_DECK',
          title: `${sourceName} — Pilih 1 Kartu Pendukung dari Dek`,
          subtitle: 'Tambahkan Kartu Pendukung pilihanmu ke tangan.',
          candidates: supports,
          maxSelect: 1,
          minSelect: 1,
          resumePhaseAfterChoices: 'SUIT_START',
        });
      }
      break;
    }
    case 'BOBOIBOY_GOPAL_SWAP_CONDITIONAL': {
      const conditionals = owner.deck.filter((c) => Boolean(CARD_BY_ID[c.defId].condition));
      if (conditionals.length === 0) {
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Tidak ada Kartu Bersyarat di Dek.`,
          'neutral'
        );
        break;
      }
      if (owner.isCpu) {
        const sorted = [...conditionals].sort((a, b) => {
          const da = CARD_BY_ID[a.defId];
          const db = CARD_BY_ID[b.defId];
          return (
            scoreConditionalSwapCandidate(db, owner, enemy) -
            scoreConditionalSwapCandidate(da, owner, enemy)
          );
        });
        const picked = sorted[0];
        const previousInstance = owner.active.instance;
        owner.deck = shuffleArray([
          ...owner.deck.filter((c) => c.uid !== picked.uid),
          previousInstance,
        ]);
        owner.active = createActiveFighter(picked);
        if (ownerIdx === 0) s.currentRoundP0CardId = owner.active.def.id;
        else s.currentRoundP1CardId = owner.active.def.id;
        for (const tag of owner.active.def.characterTags) {
          if (!owner.usedCharacterTags.includes(tag)) owner.usedCharacterTags.push(tag);
        }
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName} ditukarkan kembali ke dalam Dek & memanggil ${owner.active.def.name} ke Zona Aktif!`,
          'highlight'
        );
        if (!s.pendingEntryPriority3 || (owner.active.def.effectPriority ?? 3) <= 2) {
          owner.active.entryEffectResolved = true;
          applySingleEffectKey(
            s,
            ownerIdx,
            owner.active.def.effectKey,
            owner.active.def.name,
            instantWins
          );
        }
      } else {
        s.choiceQueue.push({
          playerIndex: ownerIdx,
          purpose: 'SWAP_CONDITIONAL_FROM_DECK',
          title: `${sourceName} — Pilih 1 Kartu Bersyarat dari Dek`,
          subtitle:
            'Tukarkan kartu di Zona Aktif kembali ke Dek dengan Kartu Bersyarat pilihanmu, lalu aktifkan efeknya!',
          candidates: conditionals,
          maxSelect: 1,
          minSelect: 1,
          resumePhaseAfterChoices: 'SUIT_START',
        });
      }
      break;
    }
    case 'COPY_ENEMY_DECK_SUPPORT': {
      const enemySupports = enemy.deck.filter(
        (c) => CARD_BY_ID[c.defId].category === CardCategory.SUPPORT
      );
      if (enemySupports.length === 0) {
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Tidak ada Kartu Pendukung di Dek lawan.`,
          'neutral'
        );
        break;
      }
      if (owner.isCpu) {
        const sortedSupports = [...enemySupports].sort((a, b) => {
          const da = CARD_BY_ID[a.defId];
          const db = CARD_BY_ID[b.defId];
          return (
            scoreCopiedEffectCandidate(db, owner, enemy) -
            scoreCopiedEffectCandidate(da, owner, enemy)
          );
        });
        const picked = sortedSupports[0];
        const pickedDef = CARD_BY_ID[picked.defId];
        enemy.deck = shuffleArray(enemy.deck);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName} meniru efek Kartu Pendukung ${pickedDef.name} dari Dek lawan!`,
          tone
        );
        applySupportEffectToFighters(s, ownerIdx, pickedDef, false);
      } else {
        s.choiceQueue.push({
          playerIndex: ownerIdx,
          purpose: 'COPY_ENEMY_DECK_SUPPORT',
          title: `${sourceName} — Tiru 1 Kartu Pendukung Dek Lawan`,
          subtitle: 'Pilih Kartu Pendukung di Dek lawan untuk ditiru efeknya sekarang.',
          candidates: enemySupports,
          maxSelect: 1,
          minSelect: 1,
          resumePhaseAfterChoices: 'SUIT_START',
        });
      }
      break;
    }
    case 'ROSAKSA_COPY_ENEMY_DECK_EFFECT': {
      const copyable = enemy.deck.filter((c) => {
        const d = CARD_BY_ID[c.defId];
        return d.effectKey !== 'NONE' && d.effectKey !== 'ROSAKSA_COPY_ENEMY_DECK_EFFECT';
      });
      if (copyable.length === 0) break;
      if (owner.isCpu) {
        const sortedCopyable = [...copyable].sort((a, b) => {
          const da = CARD_BY_ID[a.defId];
          const db = CARD_BY_ID[b.defId];
          return (
            scoreCopiedEffectCandidate(db, owner, enemy) -
            scoreCopiedEffectCandidate(da, owner, enemy)
          );
        });
        const picked = sortedCopyable[0];
        const pickedDef = CARD_BY_ID[picked.defId];
        enemy.deck = shuffleArray(enemy.deck);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName} meniru efek ${pickedDef.name} dari Dek lawan!`,
          tone
        );
        if (pickedDef.category === CardCategory.SUPPORT) {
          applySupportEffectToFighters(s, ownerIdx, pickedDef, false);
        } else {
          applySingleEffectKey(
            s,
            ownerIdx,
            pickedDef.effectKey,
            `${sourceName} (${pickedDef.name})`,
            instantWins
          );
        }
      } else {
        s.choiceQueue.push({
          playerIndex: ownerIdx,
          purpose: 'COPY_ENEMY_DECK_EFFECT',
          title: `${sourceName} — Pilih 1 Kartu Dek Lawan untuk Ditiru Efeknya`,
          subtitle: 'Efek kartu yang dipilih akan langsung diaktifkan oleh Rosaksa.',
          candidates: copyable,
          maxSelect: 1,
          minSelect: 1,
          resumePhaseAfterChoices: 'SUIT_START',
        });
      }
      break;
    }
    case 'YING_COPY_ENEMY_DECK_STATS': {
      const chars = enemy.deck.filter(
        (c) => CARD_BY_ID[c.defId].category === CardCategory.CHARACTER
      );
      if (chars.length === 0) break;
      if (owner.isCpu) {
        const sorted = [...chars].sort((a, b) => {
          const da = CARD_BY_ID[a.defId];
          const db = CARD_BY_ID[b.defId];
          return db.hp + db.atk - (da.hp + da.atk);
        });
        const pickedDef = CARD_BY_ID[sorted[0].defId];
        enemy.deck = shuffleArray(enemy.deck);
        owner.active.currentHp = pickedDef.hp;
        owner.active.maxHp = pickedDef.hp;
        owner.active.currentAtk = pickedDef.atk;
        owner.active.baseAtk = pickedDef.atk;
        owner.active.statusNotes.push(`Tiru ${pickedDef.name} (${pickedDef.hp}/${pickedDef.atk})`);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName} meniru HP (${pickedDef.hp}) & ATK (${pickedDef.atk}) milik ${pickedDef.name}!`,
          tone
        );
      } else {
        s.choiceQueue.push({
          playerIndex: ownerIdx,
          purpose: 'COPY_ENEMY_DECK_STATS',
          title: `${sourceName} — Pilih 1 Karakter Dek Lawan`,
          subtitle: 'Ying akan meniru nilai HP dan ATK kartu Karakter tersebut.',
          candidates: chars,
          maxSelect: 1,
          minSelect: 1,
          resumePhaseAfterChoices: 'SUIT_START',
        });
      }
      break;
    }
    case 'SOPAN_RETURN_ENEMY_WIN_2': {
      if (enemy.winZone.length === 0) {
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Zona Menang lawan masih kosong.`,
          'neutral'
        );
        break;
      }
      const count = Math.min(2, enemy.winZone.length);
      if (owner.isCpu || enemy.winZone.length <= 2) {
        let returned: CardInstance[];
        if (owner.isCpu && enemy.winZone.length > 2) {
          // Return 2 weakest cards from opponent's Win Zone back into opponent's Deck
          const sortedWeakest = [...enemy.winZone].sort((a, b) => {
            const da = CARD_BY_ID[a.defId];
            const db = CARD_BY_ID[b.defId];
            return da.hp + da.atk - (db.hp + db.atk);
          });
          returned = sortedWeakest.slice(0, count);
          const returnedUids = new Set(returned.map((c) => c.uid));
          enemy.winZone = enemy.winZone.filter((c) => !returnedUids.has(c.uid));
        } else {
          returned = enemy.winZone.splice(0, count);
        }
        enemy.deck = shuffleArray([...enemy.deck, ...returned]);
        s.logs = addLog(
          s.logs,
          s.round,
          `${sourceName}: Kembalikan Kemenangan! ${returned.length} kartu dari Zona Menang ${enemy.name} dimasukkan kembali ke dalam Dek ${enemy.name}!`,
          'highlight'
        );
      } else {
        s.choiceQueue.push({
          playerIndex: ownerIdx,
          purpose: 'RETURN_ENEMY_WIN_2',
          title: `${sourceName} — Pilih 2 Kartu Zona Menang Lawan`,
          subtitle: 'Ambil 2 kartu dari Zona Menang lawan dan masukkan kembali ke dalam Dek lawan!',
          candidates: [...enemy.winZone],
          maxSelect: 2,
          minSelect: 2,
          resumePhaseAfterChoices: 'SUIT_START',
        });
      }
      break;
    }
    default:
      break;
  }
}

export interface SupportResolutionOutcome {
  grantedStatBonus: boolean;
  statLabel: string;
}

export function summarizeSupportCardLabel(def: CardDefinition): string {
  switch (def.effectKey) {
    case 'SUPPORT_ROCKFAMILY_ATK_20':
      return '+ATK Tangan';
    case 'SUPPORT_HAMMER_GENTAR':
      return 'Lawan 40/40';
    case 'SUPPORT_KEPAKU_PARK':
      return '+1 Perisai';
    case 'DRAW_2':
      return '+2 Kartu';
    case 'SUPPORT_SANG_BUAYA_CANCEL':
      return 'Batal Pendukung';
    default: {
      const parts: string[] = [];
      if (def.hp > 0) parts.push(`+${def.hp} HP`);
      if (def.atk > 0) parts.push(`+${def.atk} ATK`);
      return parts.length > 0 ? parts.join(' · ') : 'Efek Pendukung';
    }
  }
}

export function evaluateAndRecordSupportCombo(params: {
  state: FullBattleState;
  ownerIdx: 0 | 1;
  supportDef: CardDefinition;
  outcome: SupportResolutionOutcome;
  priorFighterModNote: string | null;
  priorRoundSupportsBeforeThis: string[];
  willChainStrike: boolean;
  triggerSourceCard?: CardDefinition | null;
}): void {
  const {
    state: s,
    ownerIdx,
    supportDef,
    outcome,
    priorFighterModNote,
    priorRoundSupportsBeforeThis,
    willChainStrike,
    triggerSourceCard,
  } = params;

  const owner = s.players[ownerIdx];
  if (!owner.active) return;

  const lastRoundRec =
    s.roundHistory.length > 0 ? s.roundHistory[s.roundHistory.length - 1] : null;
  const prevRoundSupports = lastRoundRec
    ? ownerIdx === 0
      ? lastRoundRec.p0Supports
      : lastRoundRec.p1Supports
    : [];

  const hasMultiSupportSequence =
    priorRoundSupportsBeforeThis.length > 0 || prevRoundSupports.length > 0;

  if (!outcome.grantedStatBonus && !hasMultiSupportSequence) {
    return;
  }

  const steps: SupportComboStep[] = [];

  if (priorRoundSupportsBeforeThis.length > 0) {
    for (const prevId of priorRoundSupportsBeforeThis.slice(-2)) {
      const prevDef = CARD_BY_ID[prevId];
      if (prevDef) {
        steps.push({
          cardId: prevDef.id,
          cardName: prevDef.name,
          role: 'SUPPORT',
          effectLabel: summarizeSupportCardLabel(prevDef),
        });
      }
    }
  } else if (prevRoundSupports.length > 0) {
    const prevId = prevRoundSupports[prevRoundSupports.length - 1];
    const prevDef = CARD_BY_ID[prevId];
    if (prevDef) {
      steps.push({
        cardId: prevDef.id,
        cardName: prevDef.name,
        role: 'SUPPORT',
        effectLabel: `R${lastRoundRec!.round} · ${summarizeSupportCardLabel(prevDef)}`,
      });
    }
  }

  if (triggerSourceCard) {
    steps.push({
      cardId: triggerSourceCard.id,
      cardName: triggerSourceCard.name,
      role: 'CHARACTER',
      effectLabel: 'Tiru Pendukung',
    });
  } else if (priorFighterModNote) {
    steps.push({
      cardId: owner.active.def.id,
      cardName: owner.active.def.name,
      role: 'CHARACTER',
      effectLabel: priorFighterModNote,
    });
  } else if (steps.length === 0 && !willChainStrike) {
    steps.push({
      cardId: owner.active.def.id,
      cardName: owner.active.def.name,
      role: 'CHARACTER',
      effectLabel: `Aktif ${owner.active.currentHp}/${owner.active.baseAtk}`,
    });
  }

  steps.push({
    cardId: supportDef.id,
    cardName: supportDef.name,
    role: 'SUPPORT',
    effectLabel: outcome.statLabel,
  });

  if (willChainStrike) {
    steps.push({
      cardId: owner.active.def.id,
      cardName: owner.active.def.name,
      role: 'STRIKE',
      effectLabel: `Serang ${owner.active.currentAtk} ATK`,
    });
  }

  const trimmedSteps = steps.slice(-4);
  const chainCount = Math.max(2, steps.length);

  let kind: SupportComboKind = 'SUPPORT_SYNERGY';
  let title = 'KOMBO BONUS STATS!';
  let subtitle = `Aktivasi ${supportDef.name} memperkuat stat tempur ${owner.active.def.name}!`;

  if (hasMultiSupportSequence && willChainStrike) {
    kind = 'CHAIN_ATTACK';
    title = 'CHAIN ATTACK · KOMBO BERUNTUN!';
    subtitle = `${owner.name} merangkai urutan Kartu Pendukung langsung ke serangan ${owner.active.def.name}!`;
  } else if (hasMultiSupportSequence) {
    kind = 'MULTI_SUPPORT';
    title = 'KOMBO PENDUKUNG BERUNTUN!';
    subtitle = `${owner.name} mengaktifkan rangkaian Kartu Pendukung beruntun (${outcome.statLabel})!`;
  } else if (willChainStrike) {
    kind = 'CHAIN_ATTACK';
    title = 'CHAIN ATTACK!';
    subtitle = `Bonus ${supportDef.name} (${outcome.statLabel}) menyambung langsung ke serangan ${owner.active.def.name}!`;
  }

  const comboEvent: SupportComboEvent = {
    id: `combo-${s.round}-${s.suitAttemptInRound}-${ownerIdx}-${(s.comboHistory?.length ?? 0) + 1}`,
    round: s.round,
    suitAttempt: s.suitAttemptInRound,
    playerIndex: ownerIdx,
    playerName: owner.name,
    fighterName: owner.active.def.name,
    fighterCardId: owner.active.def.id,
    kind,
    chainCount,
    title,
    subtitle,
    totalStatBadge: outcome.statLabel,
    finalAtk: owner.active.currentAtk,
    finalHp: owner.active.currentHp,
    steps: trimmedSteps,
  };

  s.comboHistory = [...(s.comboHistory ?? []), comboEvent];
  s.logs = addLog(
    s.logs,
    s.round,
    `[${title.replace('!', '')} x${chainCount}] ${owner.name}: ${trimmedSteps
      .map((st) => `${st.cardName} (${st.effectLabel})`)
      .join(' → ')}!`,
    'highlight'
  );
}

function applySupportEffectToFighters(
  s: FullBattleState,
  ownerIdx: 0 | 1,
  supportDef: CardDefinition,
  fromSupportPhase = false
): SupportResolutionOutcome {
  const enemyIdx: 0 | 1 = ownerIdx === 0 ? 1 : 0;
  const owner = s.players[ownerIdx];
  const enemy = s.players[enemyIdx];
  const tone = ownerIdx === 0 ? 'p1' : 'p2';
  if (!owner.active || !enemy.active) {
    return { grantedStatBonus: false, statLabel: 'Pendukung' };
  }

  const prevHp = owner.active.currentHp;
  const prevAtk = owner.active.currentAtk;
  const prevShields = owner.active.shieldsRemaining;
  const prevEnemyHp = enemy.active.currentHp;
  const prevEnemyAtk = enemy.active.currentAtk;

  const bonusParts: string[] = [];
  let grantedStatBonus = false;

  switch (supportDef.effectKey) {
    case 'SUPPORT_HAMMER_GENTAR': {
      enemy.active.currentHp = 40;
      enemy.active.maxHp = Math.max(40, enemy.active.maxHp);
      enemy.active.currentAtk = 40;
      enemy.active.statusNotes.push('Hammer Gentar (40/40)');
      grantedStatBonus = true;
      bonusParts.push('Lawan 40/40');
      s.logs = addLog(
        s.logs,
        s.round,
        `Kartu Pendukung ${supportDef.name} (${owner.name}): HP & ATK ${enemy.active.def.name} menjadi 40!`,
        tone
      );
      break;
    }
    case 'SUPPORT_KEPAKU_PARK': {
      if (fromSupportPhase) {
        owner.active.blockStrikeThisClash = true;
        if (!owner.active.statusNotes.includes('Kepaku Park (Tangkis Bentrokan Ini)')) {
          owner.active.statusNotes.push('Kepaku Park (Tangkis Bentrokan Ini)');
        }
        grantedStatBonus = true;
        bonusParts.push('Tangkis Bentrokan');
        s.logs = addLog(
          s.logs,
          s.round,
          `Kartu Pendukung ${supportDef.name} (${owner.name}): Serangan lawan pada bentrokan ini tidak efektif!`,
          tone
        );
      } else {
        owner.active.shieldsRemaining += 1;
        owner.active.statusNotes.push('Perisai x1 (Tiru Kepaku Park)');
        grantedStatBonus = true;
        bonusParts.push('+1 Perisai');
        s.logs = addLog(
          s.logs,
          s.round,
          `Efek ${supportDef.name} (${owner.name}): ${owner.active.def.name} memperoleh Perisai 1x serangan!`,
          tone
        );
      }
      break;
    }
    case 'SUPPORT_ROCKFAMILY_ATK_20': {
      const bonus = enemy.hand.length * 20;
      owner.active.currentAtk += bonus;
      owner.active.statusNotes.push(`+${bonus} ATK (Rockfamily)`);
      if (bonus > 0) {
        grantedStatBonus = true;
        bonusParts.push(`+${bonus} ATK`);
      }
      s.logs = addLog(
        s.logs,
        s.round,
        `Kartu Pendukung ${supportDef.name} (${owner.name}): ATK ${owner.active.def.name} +${bonus}!`,
        tone
      );
      break;
    }
    case 'DRAW_2': {
      drawCards(owner, 2);
      bonusParts.push('+2 Kartu');
      s.logs = addLog(
        s.logs,
        s.round,
        `Kartu Pendukung ${supportDef.name} (${owner.name}): Menarik 2 kartu dari Dek!`,
        tone
      );
      break;
    }
    case 'SUPPORT_SANG_BUAYA_CANCEL': {
      if (!fromSupportPhase) {
        owner.active.negateEnemySupport = true;
        if (!owner.active.statusNotes.includes('Siaga Batal Pendukung (Sang Buaya)')) {
          owner.active.statusNotes.push('Siaga Batal Pendukung (Sang Buaya)');
        }
        grantedStatBonus = true;
        bonusParts.push('Batal Pendukung');
        s.logs = addLog(
          s.logs,
          s.round,
          `${owner.active.def.name} meniru efek ${supportDef.name}: Kartu Pendukung lawan berikutnya akan dibatalkan!`,
          tone
        );
      }
      break;
    }
    default: {
      if (supportDef.effectKey !== 'NONE') {
        const unusedWins = new Set<0 | 1>();
        applySingleEffectKey(s, ownerIdx, supportDef.effectKey, supportDef.name, unusedWins);
        const dHp = owner.active.currentHp - prevHp;
        const dAtk = owner.active.currentAtk - prevAtk;
        const dShield = owner.active.shieldsRemaining - prevShields;
        const dEnemyHp = enemy.active.currentHp - prevEnemyHp;
        const dEnemyAtk = enemy.active.currentAtk - prevEnemyAtk;
        if (dHp > 0) {
          grantedStatBonus = true;
          bonusParts.push(`+${dHp} HP`);
        }
        if (dAtk > 0) {
          grantedStatBonus = true;
          bonusParts.push(`+${dAtk} ATK`);
        }
        if (dShield > 0) {
          grantedStatBonus = true;
          bonusParts.push(`+${dShield} Perisai`);
        }
        if (dEnemyHp < 0 || dEnemyAtk < 0) {
          grantedStatBonus = true;
          bonusParts.push(
            dEnemyAtk < 0 ? `Lawan ${dEnemyAtk} ATK` : `Lawan ${dEnemyHp} HP`
          );
        }
      }
      break;
    }
  }

  // Apply explicit custom/uploaded Support stat bonuses if defined on the card
  if (supportDef.hp > 0) {
    owner.active.currentHp += supportDef.hp;
    owner.active.maxHp += supportDef.hp;
    owner.active.statusNotes.push(`+${supportDef.hp} HP (${supportDef.name})`);
    grantedStatBonus = true;
    bonusParts.push(`+${supportDef.hp} HP`);
    s.logs = addLog(
      s.logs,
      s.round,
      `Bonus Kartu Pendukung ${supportDef.name} (${owner.name}): +${supportDef.hp} HP untuk ${owner.active.def.name}!`,
      tone
    );
  }
  if (supportDef.atk > 0) {
    owner.active.currentAtk += supportDef.atk;
    owner.active.statusNotes.push(`+${supportDef.atk} ATK (${supportDef.name})`);
    grantedStatBonus = true;
    bonusParts.push(`+${supportDef.atk} ATK`);
    s.logs = addLog(
      s.logs,
      s.round,
      `Bonus Kartu Pendukung ${supportDef.name} (${owner.name}): +${supportDef.atk} ATK untuk ${owner.active.def.name}!`,
      tone
    );
  }

  return {
    grantedStatBonus,
    statLabel: bonusParts.length > 0 ? bonusParts.join(' · ') : summarizeSupportCardLabel(supportDef),
  };
}

function runRemainingEntryPriority3(s: FullBattleState, instantWins: Set<0 | 1>): void {
  for (const idx of [0, 1] as const) {
    const fighter = s.players[idx].active;
    if (!fighter || fighter.effectNullified || fighter.entryEffectResolved) continue;
    const prio = fighter.def.effectPriority ?? 3;
    if (prio === 3) {
      fighter.entryEffectResolved = true;
      applySingleEffectKey(s, idx, fighter.def.effectKey, fighter.def.name, instantWins);
    }
  }
}

function finalizePostEffectOrCombatCheck(
  s: FullBattleState,
  instantWins: Set<0 | 1>,
  nextIfAlive: BattlePhase
): FullBattleState {
  const p0 = s.players[0];
  const p1 = s.players[1];
  if (!p0.active || !p1.active) return s;

  // Otomatis Menang (instantWins) takes strict precedence over incidental HP changes
  const p0Dead = instantWins.size > 0 ? instantWins.has(1) : p0.active.currentHp <= 0;
  const p1Dead = instantWins.size > 0 ? instantWins.has(0) : p1.active.currentHp <= 0;

  if (!p0Dead && !p1Dead) {
    if (s.choiceQueue.length > 0) {
      return { ...s, phase: 'INTERACTIVE_CHOICE' };
    }
    return { ...s, pendingEntryPriority3: false, phase: nextIfAlive };
  }

  const recordedP0CardId = s.currentRoundP0CardId ?? p0.active.def.id;
  const recordedP1CardId = s.currentRoundP1CardId ?? p1.active.def.id;
  const recordedLastP0Suit = p0.selectedSuit;
  const recordedLastP1Suit = p1.selectedSuit;
  let roundWinner: 0 | 1 | 'DRAW' = 'DRAW';
  let summary = '';
  const winQuotaLabel = s.maxRounds ? `${s.maxRounds} Ronde` : `${s.targetWins}`;

  if (p0Dead && p1Dead) {
    const c0 = p0.active.instance;
    const c1 = p1.active.instance;
    const n0 = p0.active.def.name;
    const n1 = p1.active.def.name;
    p0.loseZone.push(c0);
    p1.loseZone.push(c1);
    p0.active = null;
    p1.active = null;
    roundWinner = 'DRAW';
    summary = `Seri Ganda! ${n0} dan ${n1} sama-sama tumbang dan masuk ke Zona Kalah.`;
    s.logs = addLog(s.logs, s.round, summary, 'warning');
  } else if (p1Dead) {
    const defeated = p1.active.instance;
    const defeatedName = p1.active.def.name;
    const victor = p0.active.instance;
    const victorName = p0.active.def.name;
    p0.winZone.push(defeated);
    p0.loseZone.push(victor);
    p0.active = null;
    p1.active = null;
    roundWinner = 0;
    summary = s.maxRounds
      ? `${p0.name} memenangkan Ronde ${s.round}! ${defeatedName} masuk ke Zona Menang ${p0.name} (Total: ${p0.winZone.length}).`
      : `${p0.name} memenangkan ronde! ${defeatedName} masuk ke Zona Menang ${p0.name} (${p0.winZone.length}/${winQuotaLabel}). ${victorName} selesai bertugas.`;
    s.logs = addLog(s.logs, s.round, summary, 'p1');
  } else if (p0Dead) {
    const defeated = p0.active.instance;
    const defeatedName = p0.active.def.name;
    const victor = p1.active.instance;
    const victorName = p1.active.def.name;
    p1.winZone.push(defeated);
    p1.loseZone.push(victor);
    p0.active = null;
    p1.active = null;
    roundWinner = 1;
    summary = s.maxRounds
      ? `${p1.name} memenangkan Ronde ${s.round}! ${defeatedName} masuk ke Zona Menang ${p1.name} (Total: ${p1.winZone.length}).`
      : `${p1.name} memenangkan ronde! ${defeatedName} masuk ke Zona Menang ${p1.name} (${p1.winZone.length}/${winQuotaLabel}). ${victorName} selesai bertugas.`;
    s.logs = addLog(s.logs, s.round, summary, 'p2');
  }

  s.roundHistory = [
    ...s.roundHistory,
    {
      round: s.round,
      p0CardId: recordedP0CardId,
      p1CardId: recordedP1CardId,
      p0Supports: [...s.currentRoundP0Supports],
      p1Supports: [...s.currentRoundP1Supports],
      suitClashes: s.currentRoundSuitClashes,
      lastP0Suit: recordedLastP0Suit,
      lastP1Suit: recordedLastP1Suit,
      winner: roundWinner,
      summary,
    },
  ];

  // Clear temporary round selections
  p0.selectedSuit = null;
  p1.selectedSuit = null;
  p0.playedSupportCard = null;
  p1.playedSupportCard = null;
  s.choiceQueue = [];
  s.pendingEntryPriority3 = false;

  // Fixed N-Round Match Victory Check (e.g., 5-Round Simulation or 5-Round Format)
  if (s.maxRounds !== null) {
    if (s.round >= s.maxRounds) {
      const p0RoundWins = s.roundHistory.filter((r) => r.winner === 0).length;
      const p1RoundWins = s.roundHistory.filter((r) => r.winner === 1).length;
      let matchWinner: 0 | 1 | 'DRAW' = 'DRAW';
      let reason = '';

      if (p0RoundWins > p1RoundWins) {
        matchWinner = 0;
        reason = `Tuntas ${s.maxRounds} Ronde! ${p0.name} unggul ${p0RoundWins} - ${p1RoundWins} ronde (Zona Menang ${p0.winZone.length} - ${p1.winZone.length}).`;
      } else if (p1RoundWins > p0RoundWins) {
        matchWinner = 1;
        reason = `Tuntas ${s.maxRounds} Ronde! ${p1.name} unggul ${p1RoundWins} - ${p0RoundWins} ronde (Zona Menang ${p1.winZone.length} - ${p0.winZone.length}).`;
      } else if (p0.winZone.length > p1.winZone.length) {
        matchWinner = 0;
        reason = `Skor ronde imbang ${p0RoundWins} - ${p1RoundWins}, namun ${p0.name} unggul jumlah kartu Zona Menang (${p0.winZone.length} vs ${p1.winZone.length})!`;
      } else if (p1.winZone.length > p0.winZone.length) {
        matchWinner = 1;
        reason = `Skor ronde imbang ${p1RoundWins} - ${p0RoundWins}, namun ${p1.name} unggul jumlah kartu Zona Menang (${p1.winZone.length} vs ${p0.winZone.length})!`;
      } else {
        matchWinner = 'DRAW';
        reason = `Pertarungan ${s.maxRounds} Ronde berakhir SERI imbang (${p0RoundWins} - ${p1RoundWins} ronde, Zona Menang ${p0.winZone.length} - ${p1.winZone.length})!`;
      }

      const endHeadline =
        matchWinner === 'DRAW'
          ? `HASIL AKHIR ${s.maxRounds} RONDE: SERI IMBANG!`
          : `JUARA ${s.maxRounds} RONDE: ${s.players[matchWinner].name}!`;

      return {
        ...s,
        phase: 'GAME_OVER',
        winnerIndex: matchWinner,
        winReason: reason,
        roundSummaryText: summary,
        logs: addLog(s.logs, s.round, endHeadline, 'highlight'),
      };
    }

    return {
      ...s,
      phase: 'ROUND_END',
      roundSummaryText: summary,
    };
  }

  // Standard Target Wins Check
  if (p0.winZone.length >= s.targetWins) {
    return {
      ...s,
      phase: 'GAME_OVER',
      winnerIndex: 0,
      winReason: `${p0.name} berhasil mengumpulkan ${p0.winZone.length} kartu di Zona Menang!`,
      roundSummaryText: summary,
      logs: addLog(s.logs, s.round, `KEMENANGAN MUTLAK untuk ${p0.name}!`, 'highlight'),
    };
  }
  if (p1.winZone.length >= s.targetWins) {
    return {
      ...s,
      phase: 'GAME_OVER',
      winnerIndex: 1,
      winReason: `${p1.name} berhasil mengumpulkan ${p1.winZone.length} kartu di Zona Menang!`,
      roundSummaryText: summary,
      logs: addLog(s.logs, s.round, `KEMENANGAN MUTLAK untuk ${p1.name}!`, 'highlight'),
    };
  }

  return {
    ...s,
    phase: 'ROUND_END',
    roundSummaryText: summary,
  };
}

export function deployBothCharactersAndResolveEntry(
  prevState: FullBattleState,
  p0Uid: string,
  p1Uid: string
): FullBattleState {
  const s = cloneBattleState(prevState);
  const p0 = s.players[0];
  const p1 = s.players[1];

  const inst0 = p0.hand.find((c) => c.uid === p0Uid) ?? p0.hand[0];
  const inst1 = p1.hand.find((c) => c.uid === p1Uid) ?? p1.hand[0];

  p0.hand = p0.hand.filter((c) => c.uid !== inst0.uid);
  p1.hand = p1.hand.filter((c) => c.uid !== inst1.uid);

  p0.active = createActiveFighter(inst0);
  p1.active = createActiveFighter(inst1);
  p0.pendingCharacterUid = null;
  p1.pendingCharacterUid = null;
  p0.selectedSuit = null;
  p1.selectedSuit = null;
  p0.playedSupportCard = null;
  p1.playedSupportCard = null;
  s.suitAttemptInRound = 1;
  s.lastSuitWinner = null;
  s.roundSummaryText = null;
  s.currentRoundP0CardId = p0.active.def.id;
  s.currentRoundP1CardId = p1.active.def.id;
  s.currentRoundP0Supports = [];
  s.currentRoundP1Supports = [];
  s.currentRoundSuitClashes = 0;
  s.choiceQueue = [];
  s.pendingEntryPriority3 = false;

  for (const tag of p0.active.def.characterTags) {
    if (!p0.usedCharacterTags.includes(tag)) p0.usedCharacterTags.push(tag);
  }
  for (const tag of p1.active.def.characterTags) {
    if (!p1.usedCharacterTags.includes(tag)) p1.usedCharacterTags.push(tag);
  }

  s.logs = addLog(
    s.logs,
    s.round,
    `Zona Aktif: ${p0.name} menurunkan ${p0.active.def.name} vs ${p1.name} menurunkan ${p1.active.def.name}!`,
    'highlight'
  );

  // EFEK 01: Nullify Enemy Effect
  const p0Nullifies = p0.active.def.effectKey === 'NULLIFY_ENEMY_EFFECT';
  const p1Nullifies = p1.active.def.effectKey === 'NULLIFY_ENEMY_EFFECT';

  if (p0Nullifies) {
    p0.active.entryEffectResolved = true;
    p1.active.effectNullified = true;
    p1.active.statusNotes.push('Efek Dibatalkan (Efek 01)');
    s.logs = addLog(
      s.logs,
      s.round,
      `Efek 01 — ${p0.active.def.name} membatalkan efek kartu ${p1.active.def.name}!`,
      'p1'
    );
  }
  if (p1Nullifies) {
    p1.active.entryEffectResolved = true;
    p0.active.effectNullified = true;
    p0.active.statusNotes.push('Efek Dibatalkan (Efek 01)');
    s.logs = addLog(
      s.logs,
      s.round,
      `Efek 01 — ${p1.active.def.name} membatalkan efek kartu ${p0.active.def.name}!`,
      'p2'
    );
  }

  const instantWins = new Set<0 | 1>();

  // Step 1: EFEK 02 executes strictly before EFEK 03
  s.pendingEntryPriority3 = true;
  for (const idx of [0, 1] as const) {
    const fighter = s.players[idx].active;
    if (!fighter || fighter.effectNullified || fighter.entryEffectResolved) continue;
    if (fighter.def.effectPriority === 2) {
      fighter.entryEffectResolved = true;
      applySingleEffectKey(s, idx, fighter.def.effectKey, fighter.def.name, instantWins);
    }
  }

  // If EFEK 02 already caused Otomatis Menang or 0 HP, end round immediately without running EFEK 03!
  if (
    instantWins.size > 0 ||
    (s.players[0].active && s.players[0].active.currentHp <= 0) ||
    (s.players[1].active && s.players[1].active.currentHp <= 0)
  ) {
    s.choiceQueue = [];
    s.pendingEntryPriority3 = false;
    return finalizePostEffectOrCombatCheck(s, instantWins, 'P1_PICK_SUIT');
  }

  // If an interactive EFEK 02 choice is queued, wait for player selection BEFORE running EFEK 03!
  if (s.choiceQueue.length > 0) {
    return finalizePostEffectOrCombatCheck(s, instantWins, 'P1_PICK_SUIT');
  }

  // Step 2: Run EFEK 03 now that all EFEK 02 actions have resolved
  s.pendingEntryPriority3 = false;
  runRemainingEntryPriority3(s, instantWins);

  return finalizePostEffectOrCombatCheck(s, instantWins, 'P1_PICK_SUIT');
}

export function resolvePendingChoice(
  prevState: FullBattleState,
  selectedUids: string[]
): FullBattleState {
  const s = cloneBattleState(prevState);
  const current = s.choiceQueue.shift();
  if (!current) {
    return { ...s, pendingEntryPriority3: false, phase: 'P1_PICK_SUIT' };
  }

  const ownerIdx = current.playerIndex;
  const enemyIdx: 0 | 1 = ownerIdx === 0 ? 1 : 0;
  const owner = s.players[ownerIdx];
  const enemy = s.players[enemyIdx];
  const tone = ownerIdx === 0 ? 'p1' : 'p2';
  const instantWins = new Set<0 | 1>();

  const selectedSet = new Set(selectedUids);

  switch (current.purpose) {
    case 'DISCARD_ENEMY_HAND_1': {
      const target = enemy.hand.find((c) => selectedSet.has(c.uid));
      if (target) {
        enemy.hand = enemy.hand.filter((c) => c.uid !== target.uid);
        enemy.loseZone.push(target);
        s.logs = addLog(
          s.logs,
          s.round,
          `${owner.name} membuang ${CARD_BY_ID[target.defId].name} dari tangan ${enemy.name} ke Zona Kalah!`,
          tone
        );
      }
      break;
    }
    case 'RETURN_ENEMY_HAND_3': {
      const chosen = enemy.hand.filter((c) => selectedSet.has(c.uid));
      enemy.hand = enemy.hand.filter((c) => !selectedSet.has(c.uid));
      enemy.deck = shuffleArray([...enemy.deck, ...chosen]);
      s.logs = addLog(
        s.logs,
        s.round,
        `${owner.name} mengembalikan ${chosen.length} kartu dari tangan ${enemy.name} ke Dek!`,
        tone
      );
      break;
    }
    case 'TUTOR_ANY_FROM_DECK':
    case 'TUTOR_SUPPORT_FROM_DECK': {
      const picked = owner.deck.find((c) => selectedSet.has(c.uid));
      if (picked) {
        owner.deck = shuffleArray(owner.deck.filter((c) => c.uid !== picked.uid));
        owner.hand.push(picked);
        s.logs = addLog(
          s.logs,
          s.round,
          `${owner.name} mengambil ${CARD_BY_ID[picked.defId].name} dari Dek ke tangan!`,
          tone
        );
      }
      break;
    }
    case 'SWAP_CONDITIONAL_FROM_DECK': {
      const picked = owner.deck.find((c) => selectedSet.has(c.uid));
      if (picked && owner.active) {
        const prevInst = owner.active.instance;
        const prevName = owner.active.def.name;
        owner.deck = shuffleArray([
          ...owner.deck.filter((c) => c.uid !== picked.uid),
          prevInst,
        ]);
        owner.active = createActiveFighter(picked);
        if (ownerIdx === 0) s.currentRoundP0CardId = owner.active.def.id;
        else s.currentRoundP1CardId = owner.active.def.id;
        for (const tag of owner.active.def.characterTags) {
          if (!owner.usedCharacterTags.includes(tag)) owner.usedCharacterTags.push(tag);
        }
        s.logs = addLog(
          s.logs,
          s.round,
          `${prevName} ditukarkan kembali ke dalam Dek & digantikan ${owner.active.def.name} di Zona Aktif!`,
          'highlight'
        );
        if (!s.pendingEntryPriority3 || (owner.active.def.effectPriority ?? 3) <= 2) {
          owner.active.entryEffectResolved = true;
          applySingleEffectKey(
            s,
            ownerIdx,
            owner.active.def.effectKey,
            owner.active.def.name,
            instantWins
          );
        }
      }
      break;
    }
    case 'COPY_ENEMY_DECK_SUPPORT': {
      const picked = enemy.deck.find((c) => selectedSet.has(c.uid));
      if (picked && owner.active) {
        const pickedDef = CARD_BY_ID[picked.defId];
        const sourceCardDef = owner.active.def;
        const priorSupports =
          ownerIdx === 0 ? [...s.currentRoundP0Supports] : [...s.currentRoundP1Supports];
        if (ownerIdx === 0) s.currentRoundP0Supports.push(pickedDef.id);
        else s.currentRoundP1Supports.push(pickedDef.id);
        enemy.deck = shuffleArray(enemy.deck);
        s.logs = addLog(
          s.logs,
          s.round,
          `${owner.name} meniru efek Kartu Pendukung ${pickedDef.name} milik ${enemy.name}!`,
          tone
        );
        const outcome = applySupportEffectToFighters(s, ownerIdx, pickedDef, false);
        evaluateAndRecordSupportCombo({
          state: s,
          ownerIdx,
          supportDef: pickedDef,
          outcome,
          priorFighterModNote: null,
          priorRoundSupportsBeforeThis: priorSupports,
          willChainStrike: false,
          triggerSourceCard: sourceCardDef,
        });
      }
      break;
    }
    case 'COPY_ENEMY_DECK_EFFECT': {
      const picked = enemy.deck.find((c) => selectedSet.has(c.uid));
      if (picked && owner.active) {
        const pickedDef = CARD_BY_ID[picked.defId];
        const sourceCardDef = owner.active.def;
        enemy.deck = shuffleArray(enemy.deck);
        s.logs = addLog(
          s.logs,
          s.round,
          `${owner.active.def.name} meniru efek ${pickedDef.name} dari Dek ${enemy.name}!`,
          tone
        );
        if (pickedDef.category === CardCategory.SUPPORT) {
          const priorSupports =
            ownerIdx === 0 ? [...s.currentRoundP0Supports] : [...s.currentRoundP1Supports];
          if (ownerIdx === 0) s.currentRoundP0Supports.push(pickedDef.id);
          else s.currentRoundP1Supports.push(pickedDef.id);
          const outcome = applySupportEffectToFighters(s, ownerIdx, pickedDef, false);
          evaluateAndRecordSupportCombo({
            state: s,
            ownerIdx,
            supportDef: pickedDef,
            outcome,
            priorFighterModNote: null,
            priorRoundSupportsBeforeThis: priorSupports,
            willChainStrike: false,
            triggerSourceCard: sourceCardDef,
          });
        } else {
          applySingleEffectKey(
            s,
            ownerIdx,
            pickedDef.effectKey,
            `${owner.active.def.name} (${pickedDef.name})`,
            instantWins
          );
        }
      }
      break;
    }
    case 'COPY_ENEMY_DECK_STATS': {
      const picked = enemy.deck.find((c) => selectedSet.has(c.uid));
      if (picked && owner.active) {
        const pickedDef = CARD_BY_ID[picked.defId];
        enemy.deck = shuffleArray(enemy.deck);
        owner.active.currentHp = pickedDef.hp;
        owner.active.maxHp = pickedDef.hp;
        owner.active.currentAtk = pickedDef.atk;
        owner.active.baseAtk = pickedDef.atk;
        owner.active.statusNotes.push(`Tiru ${pickedDef.name} (${pickedDef.hp}/${pickedDef.atk})`);
        s.logs = addLog(
          s.logs,
          s.round,
          `${owner.active.def.name} meniru HP (${pickedDef.hp}) & ATK (${pickedDef.atk}) milik ${pickedDef.name}!`,
          tone
        );
      }
      break;
    }
    case 'RETURN_ENEMY_WIN_2': {
      const chosen = enemy.winZone.filter((c) => selectedSet.has(c.uid));
      enemy.winZone = enemy.winZone.filter((c) => !selectedSet.has(c.uid));
      enemy.deck = shuffleArray([...enemy.deck, ...chosen]);
      s.logs = addLog(
        s.logs,
        s.round,
        `${owner.name} mengembalikan ${chosen.length} kartu dari Zona Menang ${enemy.name} ke dalam Dek ${enemy.name}!`,
        'highlight'
      );
      break;
    }
  }

  // If resolving the choice already ended the round, finalize immediately without running EFEK 03
  if (
    instantWins.size > 0 ||
    (s.players[0].active && s.players[0].active.currentHp <= 0) ||
    (s.players[1].active && s.players[1].active.currentHp <= 0)
  ) {
    s.choiceQueue = [];
    s.pendingEntryPriority3 = false;
    return finalizePostEffectOrCombatCheck(s, instantWins, 'P1_PICK_SUIT');
  }

  // Once all EFEK 02 choices have been resolved, run remaining EFEK 03 entry effects!
  if (s.choiceQueue.length === 0 && s.pendingEntryPriority3) {
    s.pendingEntryPriority3 = false;
    runRemainingEntryPriority3(s, instantWins);
  }

  return finalizePostEffectOrCombatCheck(
    s,
    instantWins,
    current.resumePhaseAfterChoices === 'SUIT_START' ? 'P1_PICK_SUIT' : 'P1_PICK_SUIT'
  );
}

export function resolveSuitClash(
  prevState: FullBattleState,
  p0Suit: SuitElement,
  p1Suit: SuitElement
): FullBattleState {
  const s = cloneBattleState(prevState);
  const p0 = s.players[0];
  const p1 = s.players[1];
  p0.selectedSuit = p0Suit;
  p1.selectedSuit = p1Suit;
  p0.playedSupportCard = null;
  p1.playedSupportCard = null;

  const outcome = compareSuitElements(p0Suit, p1Suit);
  s.lastSuitWinner = outcome;
  s.currentRoundSuitClashes += 1;

  if (!p0.active || !p1.active) return s;

  // Papa Zola Tactical Suit triggers on enemy win OR draw
  for (const idx of [0, 1] as const) {
    const enemyIdx: 0 | 1 = idx === 0 ? 1 : 0;
    const owner = s.players[idx];
    const enemy = s.players[enemyIdx];
    if (owner.active?.papaZolaMillArmed && (outcome === enemyIdx || outcome === 'DRAW')) {
      if (enemy.deck.length > 0) {
        const milled = enemy.deck.shift()!;
        enemy.loseZone.push(milled);
        s.logs = addLog(
          s.logs,
          s.round,
          `Efek Papa Zola (${owner.name}): Membuang 1 kartu atas Dek ${enemy.name} (${CARD_BY_ID[milled.defId].name}) ke Zona Kalah!`,
          idx === 0 ? 'p1' : 'p2'
        );
      }
    }
  }

  if (outcome === 'DRAW') {
    s.logs = addLog(
      s.logs,
      s.round,
      `Adu Suit ke-${s.suitAttemptInRound}: ${p0Suit} vs ${p1Suit} — SERI!`,
      'warning'
    );

    // Gopal & Fang draw trigger
    for (const idx of [0, 1] as const) {
      const enemyIdx: 0 | 1 = idx === 0 ? 1 : 0;
      const owner = s.players[idx];
      const enemy = s.players[enemyIdx];
      if (owner.active?.gopalFangArmed && enemy.winZone.length > 0) {
        const removed = enemy.winZone.pop()!;
        enemy.loseZone.push(removed);
        s.logs = addLog(
          s.logs,
          s.round,
          `Efek Gopal & Fang (${owner.name}): Memindahkan ${CARD_BY_ID[removed.defId].name} dari Zona Menang ${enemy.name} ke Zona Kalah!`,
          'highlight'
        );
      }
    }

    // Suit pertama ended in DRAW: disarm strictly "Suit pertama" win/lose cards (5/54 Sori, 7/54 Yaya, 23/54 Gentar).
    // Note: 12/54 Maharaja Reramos explicitly states its effect persists if Suit pertama is a draw!
    if (s.suitAttemptInRound === 1) {
      for (const idx of [0, 1] as const) {
        const f = s.players[idx].active;
        if (!f) continue;
        if (f.yayaSuit1Armed || f.gentarCounterArmed || f.soriCounterArmed) {
          f.yayaSuit1Armed = false;
          f.gentarCounterArmed = false;
          f.soriCounterArmed = false;
          f.statusNotes = f.statusNotes.filter((n) => !n.startsWith('Siaga Suit 1'));
          s.logs = addLog(
            s.logs,
            s.round,
            `Suit pertama berakhir Seri — syarat Suit pertama ${f.def.name} tidak aktif.`,
            'neutral'
          );
        }
      }
    }

    s.suitAttemptInRound += 1;
    return { ...s, phase: 'SUIT_REVEAL' };
  }

  const winner = s.players[outcome];
  const loserIdx: 0 | 1 = outcome === 0 ? 1 : 0;
  const loser = s.players[loserIdx];

  s.logs = addLog(
    s.logs,
    s.round,
    `Adu Suit: ${p0.name} (${p0Suit}) vs ${p1.name} (${p1Suit}) — ${winner.name} MENANG SUIT!`,
    outcome === 0 ? 'p1' : 'p2'
  );

  // First Suit triggers (only still armed when s.suitAttemptInRound === 1)
  if (winner.active?.yayaSuit1Armed) {
    winner.active.yayaSuit1Armed = false;
    winner.active.statusNotes = winner.active.statusNotes.filter(
      (n) => !n.startsWith('Siaga Suit 1')
    );
    winner.active.currentAtk += 40;
    winner.active.statusNotes.push('+40 ATK (Menang Suit 1)');
    s.logs = addLog(
      s.logs,
      s.round,
      `Efek Yaya (${winner.name}): Menang Suit pertama! ATK naik menjadi ${winner.active.currentAtk}!`,
      outcome === 0 ? 'p1' : 'p2'
    );
  } else if (loser.active?.yayaSuit1Armed) {
    loser.active.yayaSuit1Armed = false;
    loser.active.statusNotes = loser.active.statusNotes.filter(
      (n) => !n.startsWith('Siaga Suit 1')
    );
  }

  if (loser.active?.gentarCounterArmed) {
    loser.active.gentarCounterArmed = false;
    loser.active.statusNotes = loser.active.statusNotes.filter(
      (n) => !n.startsWith('Siaga Suit 1')
    );
    loser.active.currentAtk += 160;
    loser.active.statusNotes.push('+160 ATK (Kalah Suit 1)');
    s.logs = addLog(
      s.logs,
      s.round,
      `Efek BoBoiBoy Gentar (${loser.name}): Kalah Suit pertama! ATK melonjak menjadi ${loser.active.currentAtk}!`,
      loserIdx === 0 ? 'p1' : 'p2'
    );
  } else if (winner.active?.gentarCounterArmed) {
    winner.active.gentarCounterArmed = false;
    winner.active.statusNotes = winner.active.statusNotes.filter(
      (n) => !n.startsWith('Siaga Suit 1')
    );
  }

  if (loser.active?.soriCounterArmed && winner.active) {
    loser.active.soriCounterArmed = false;
    loser.active.statusNotes = loser.active.statusNotes.filter(
      (n) => !n.startsWith('Siaga Suit 1')
    );
    winner.active.currentHp = 40;
    winner.active.statusNotes.push('HP jadi 40 (Efek Sori)');
    s.logs = addLog(
      s.logs,
      s.round,
      `Efek BoBoiBoy Sori (${loser.name}): Kalah Suit pertama! HP ${winner.active.def.name} ditetapkan menjadi 40!`,
      'highlight'
    );
  } else if (winner.active?.soriCounterArmed) {
    winner.active.soriCounterArmed = false;
    winner.active.statusNotes = winner.active.statusNotes.filter(
      (n) => !n.startsWith('Siaga Suit 1')
    );
  }

  return { ...s, phase: 'SUIT_REVEAL' };
}

export function playerHasPlayableSupport(
  player: PlayerBattleState,
  opponent: PlayerBattleState
): boolean {
  if (opponent.active?.blockEnemySupport) return false;
  return player.hand.some((c) => CARD_BY_ID[c.defId].category === CardCategory.SUPPORT);
}

export function advanceAfterSuitReveal(prevState: FullBattleState): FullBattleState {
  if (
    prevState.players[0].active &&
    prevState.players[1].active &&
    (prevState.players[0].active.currentHp <= 0 || prevState.players[1].active.currentHp <= 0)
  ) {
    return finalizePostEffectOrCombatCheck(cloneBattleState(prevState), new Set(), 'P1_PICK_SUIT');
  }

  if (prevState.lastSuitWinner === 'DRAW' || prevState.lastSuitWinner === null) {
    const s = cloneBattleState(prevState);
    s.players[0].selectedSuit = null;
    s.players[1].selectedSuit = null;
    return { ...s, phase: 'P1_PICK_SUIT' };
  }

  const p0CanSupport = playerHasPlayableSupport(prevState.players[0], prevState.players[1]);
  const p1CanSupport = playerHasPlayableSupport(prevState.players[1], prevState.players[0]);

  if (p0CanSupport) {
    return { ...prevState, phase: 'P1_PICK_SUPPORT' };
  }

  if (p1CanSupport) {
    if (prevState.players[1].isCpu) {
      const cpuSupportUid = selectCpuSupportUid(
        prevState.players[1],
        prevState.players[0],
        prevState.lastSuitWinner,
        prevState.difficulty
      );
      return resolveSupportsAndStrike(prevState, null, cpuSupportUid);
    }
    return {
      ...prevState,
      phase: prevState.mode === 'PASS_AND_PLAY' ? 'P2_PRIVACY_SUPPORT' : 'P2_PICK_SUPPORT',
    };
  }

  return resolveSupportsAndStrike(prevState, null, null);
}

export function resolveSupportsAndStrike(
  prevState: FullBattleState,
  p0SupportUid: string | null,
  p1SupportUid: string | null
): FullBattleState {
  const s = cloneBattleState(prevState);
  const p0 = s.players[0];
  const p1 = s.players[1];

  const sup0 =
    p0SupportUid && !p1.active?.blockEnemySupport
      ? p0.hand.find((c) => c.uid === p0SupportUid) ?? null
      : null;
  const sup1 =
    p1SupportUid && !p0.active?.blockEnemySupport
      ? p1.hand.find((c) => c.uid === p1SupportUid) ?? null
      : null;

  let def0: CardDefinition | null = null;
  let def1: CardDefinition | null = null;

  if (sup0) {
    p0.hand = p0.hand.filter((c) => c.uid !== sup0.uid);
    p0.loseZone.push(sup0);
    def0 = CARD_BY_ID[sup0.defId];
    p0.playedSupportCard = def0;
    s.currentRoundP0Supports.push(def0.id);
  }
  if (sup1) {
    p1.hand = p1.hand.filter((c) => c.uid !== sup1.uid);
    p1.loseZone.push(sup1);
    def1 = CARD_BY_ID[sup1.defId];
    p1.playedSupportCard = def1;
    s.currentRoundP1Supports.push(def1.id);
  }

  // Priority 01 Sang Buaya Cancel Check (played Support OR copied on entry)
  const p0Cancels =
    def0?.effectKey === 'SUPPORT_SANG_BUAYA_CANCEL' ||
    Boolean(def1 && p0.active?.negateEnemySupport);
  const p1Cancels =
    def1?.effectKey === 'SUPPORT_SANG_BUAYA_CANCEL' ||
    Boolean(def0 && p1.active?.negateEnemySupport);

  if (p0Cancels && def1) {
    const cancelSource =
      def0?.effectKey === 'SUPPORT_SANG_BUAYA_CANCEL'
        ? `Sang Buaya (${p0.name})`
        : `${p0.active?.def.name ?? p0.name} (Tiru Sang Buaya)`;
    if (def0?.effectKey !== 'SUPPORT_SANG_BUAYA_CANCEL' && p0.active?.negateEnemySupport) {
      p0.active.negateEnemySupport = false;
      p0.active.statusNotes = p0.active.statusNotes.filter((n) => !n.includes('Batal Pendukung'));
    }
    s.logs = addLog(
      s.logs,
      s.round,
      `${cancelSource} membatalkan efek Kartu Pendukung ${def1.name} milik ${p1.name}!`,
      'p1'
    );
    def1 = null;
    p1.playedSupportCard = null;
  }
  if (p1Cancels && def0) {
    const cancelSource =
      def1?.effectKey === 'SUPPORT_SANG_BUAYA_CANCEL'
        ? `Sang Buaya (${p1.name})`
        : `${p1.active?.def.name ?? p1.name} (Tiru Sang Buaya)`;
    if (def1?.effectKey !== 'SUPPORT_SANG_BUAYA_CANCEL' && p1.active?.negateEnemySupport) {
      p1.active.negateEnemySupport = false;
      p1.active.statusNotes = p1.active.statusNotes.filter((n) => !n.includes('Batal Pendukung'));
    }
    s.logs = addLog(
      s.logs,
      s.round,
      `${cancelSource} membatalkan efek Kartu Pendukung ${def0.name} milik ${p0.name}!`,
      'p2'
    );
    def0 = null;
    p0.playedSupportCard = null;
  }

  const priorP0Supports = sup0 ? s.currentRoundP0Supports.slice(0, -1) : [...s.currentRoundP0Supports];
  const priorP1Supports = sup1 ? s.currentRoundP1Supports.slice(0, -1) : [...s.currentRoundP1Supports];
  const priorP0Mod =
    p0.active?.statusNotes.filter((n) => !n.includes('Efek Dibatalkan')).slice(-1)[0] ?? null;
  const priorP1Mod =
    p1.active?.statusNotes.filter((n) => !n.includes('Efek Dibatalkan')).slice(-1)[0] ?? null;

  for (const priority of [2, 3] as const) {
    if (def0 && (def0.effectPriority ?? 2) === priority) {
      const outcome0 = applySupportEffectToFighters(s, 0, def0, true);
      evaluateAndRecordSupportCombo({
        state: s,
        ownerIdx: 0,
        supportDef: def0,
        outcome: outcome0,
        priorFighterModNote: priorP0Mod,
        priorRoundSupportsBeforeThis: priorP0Supports,
        willChainStrike: s.lastSuitWinner === 0,
      });
    }
    if (def1 && (def1.effectPriority ?? 2) === priority) {
      const outcome1 = applySupportEffectToFighters(s, 1, def1, true);
      evaluateAndRecordSupportCombo({
        state: s,
        ownerIdx: 1,
        supportDef: def1,
        outcome: outcome1,
        priorFighterModNote: priorP1Mod,
        priorRoundSupportsBeforeThis: priorP1Supports,
        willChainStrike: s.lastSuitWinner === 1,
      });
    }
  }

  // Execute Suit Winner's Strike
  const attackerIdx = s.lastSuitWinner;
  if (attackerIdx === 0 || attackerIdx === 1) {
    const defenderIdx: 0 | 1 = attackerIdx === 0 ? 1 : 0;
    const attacker = s.players[attackerIdx];
    const defender = s.players[defenderIdx];

    if (attacker.active && defender.active) {
      const dmg = attacker.active.currentAtk;
      const attackNumber = (defender.active.enemyAttacksReceived ?? 0) + 1;
      defender.active.enemyAttacksReceived = attackNumber;

      if (defender.active.reflectFirstAttack && attackNumber === 1) {
        defender.active.reflectFirstAttack = false;
        defender.active.firstAttackShield = false;
        defender.active.statusNotes = defender.active.statusNotes.filter(
          (n) => n !== 'Pantul Serangan' && n !== 'Tangkis Serangan ke-1'
        );
        attacker.active.currentHp = Math.max(0, attacker.active.currentHp - dmg);
        s.logs = addLog(
          s.logs,
          s.round,
          `Pantulan ${defender.active.def.name}! Serangan pertama ${dmg} ATK berbalik mengenai ${attacker.active.def.name} sendiri!`,
          'highlight'
        );
      } else if (defender.active.blockStrikeThisClash) {
        if (attackNumber === 1 && defender.active.firstAttackShield) {
          defender.active.firstAttackShield = false;
          defender.active.statusNotes = defender.active.statusNotes.filter(
            (n) => n !== 'Tangkis Serangan ke-1'
          );
        }
        s.logs = addLog(
          s.logs,
          s.round,
          `Kepaku Park menangkis serangan ${attacker.active.def.name} pada bentrokan ini! (0 Kerusakan)`,
          defenderIdx === 0 ? 'p1' : 'p2'
        );
      } else if (defender.active.firstAttackShield && attackNumber === 1) {
        defender.active.firstAttackShield = false;
        defender.active.statusNotes = defender.active.statusNotes.filter(
          (n) => n !== 'Tangkis Serangan ke-1'
        );
        s.logs = addLog(
          s.logs,
          s.round,
          `${defender.active.def.name} menangkis serangan pertama ${attacker.active.def.name}! (0 Kerusakan)`,
          defenderIdx === 0 ? 'p1' : 'p2'
        );
      } else if (defender.active.shieldsRemaining > 0) {
        defender.active.shieldsRemaining -= 1;
        if (defender.active.shieldsRemaining === 0) {
          defender.active.statusNotes = defender.active.statusNotes.filter(
            (n) => !n.startsWith('Perisai')
          );
        }
        s.logs = addLog(
          s.logs,
          s.round,
          `Perisai ${defender.active.def.name} menangkis serangan ${attacker.active.def.name}! (0 Kerusakan, sisa perisai: ${defender.active.shieldsRemaining})`,
          defenderIdx === 0 ? 'p1' : 'p2'
        );
      } else {
        if (defender.active.firstAttackShield) {
          defender.active.firstAttackShield = false;
          defender.active.statusNotes = defender.active.statusNotes.filter(
            (n) => n !== 'Tangkis Serangan ke-1'
          );
        }
        defender.active.currentHp = Math.max(0, defender.active.currentHp - dmg);
        s.logs = addLog(
          s.logs,
          s.round,
          `${attacker.active.def.name} melancarkan serangan ${dmg} ATK! Sisa HP ${defender.active.def.name}: ${defender.active.currentHp}/${defender.active.maxHp}.`,
          attackerIdx === 0 ? 'p1' : 'p2'
        );
      }
    }
  }

  // Clear clash-only Support shields (Kepaku Park) after the clash concludes
  for (const idx of [0, 1] as const) {
    const f = s.players[idx].active;
    if (f?.blockStrikeThisClash) {
      f.blockStrikeThisClash = false;
      f.statusNotes = f.statusNotes.filter((n) => n !== 'Kepaku Park (Tangkis Bentrokan Ini)');
    }
  }

  s.suitAttemptInRound += 1;
  p0.pendingSupportUid = null;
  p1.pendingSupportUid = null;

  return finalizePostEffectOrCombatCheck(s, new Set(), 'P1_PICK_SUIT');
}

export function startNextRound(prevState: FullBattleState): FullBattleState {
  const s = cloneBattleState(prevState);
  s.round += 1;
  s.suitAttemptInRound = 1;
  s.lastSuitWinner = null;
  s.roundSummaryText = null;
  s.pendingEntryPriority3 = false;

  // Replenish hands up to at least 4 cards (or +1 card if already >= 4, max 7)
  for (const idx of [0, 1] as const) {
    const p = s.players[idx];
    if (p.hand.length < 4) {
      drawCards(p, 4 - p.hand.length);
    } else if (p.hand.length < 7) {
      drawCards(p, 1);
    }
  }

  s.phase = 'P1_PICK_CHARACTER';
  s.logs = addLog(s.logs, s.round, `Ronde ${s.round} dimulai — pilih Kartu Karakter untuk Zona Aktif.`, 'neutral');

  return ensureBothPlayersHavePlayableCharacter(s);
}

export function stepSimulationOnce(state: FullBattleState): FullBattleState {
  if (state.phase === 'GAME_OVER') {
    return state;
  }

  const p0 = state.players[0];
  const p1 = state.players[1];

  if (state.phase === 'P1_PICK_CHARACTER' || state.phase === 'P2_PICK_CHARACTER') {
    const p0Uid = selectCpuCharacterUid(p0, p1, state.p0Difficulty);
    const p1Uid = selectCpuCharacterUid(p1, p0, state.difficulty);
    return deployBothCharactersAndResolveEntry(state, p0Uid, p1Uid);
  }

  if (state.phase === 'INTERACTIVE_CHOICE') {
    const choice = state.choiceQueue[0];
    if (!choice) return { ...state, phase: 'P1_PICK_SUIT' };
    const picked = choice.candidates.slice(0, choice.maxSelect).map((c) => c.uid);
    return resolvePendingChoice(state, picked);
  }

  if (state.phase === 'P1_PICK_SUIT' || state.phase === 'P2_PICK_SUIT') {
    const s0 = selectCpuSuit(state.p0Difficulty);
    let s1 = selectCpuSuit(state.difficulty);
    if (state.suitAttemptInRound >= 4 && s0 === s1) {
      const others = [SuitElement.AIR, SuitElement.API, SuitElement.DAUN].filter((el) => el !== s0);
      s1 = others[Math.floor(Math.random() * others.length)];
    }
    return resolveSuitClash(state, s0, s1);
  }

  if (state.phase === 'SUIT_REVEAL') {
    if (state.lastSuitWinner === 'DRAW' || state.lastSuitWinner === null) {
      return advanceAfterSuitReveal(state);
    }
    const sup0 = selectCpuSupportUid(p0, p1, state.lastSuitWinner, state.p0Difficulty);
    const sup1 = selectCpuSupportUid(p1, p0, state.lastSuitWinner, state.difficulty);
    return resolveSupportsAndStrike(state, sup0, sup1);
  }

  if (state.phase === 'P1_PICK_SUPPORT' || state.phase === 'P2_PICK_SUPPORT') {
    const winner: 0 | 1 = state.lastSuitWinner === 1 ? 1 : 0;
    const sup0 = selectCpuSupportUid(p0, p1, winner, state.p0Difficulty);
    const sup1 = selectCpuSupportUid(p1, p0, winner, state.difficulty);
    return resolveSupportsAndStrike(state, sup0, sup1);
  }

  if (state.phase === 'ROUND_END') {
    return startNextRound(state);
  }

  return state;
}

export function runSimulationToCompletion(initialState: FullBattleState): FullBattleState {
  let current = initialState;
  let safetyCounter = 0;
  while (current.phase !== 'GAME_OVER' && safetyCounter < 450) {
    current = stepSimulationOnce(current);
    safetyCounter += 1;
  }
  return current;
}

export function appendRefereeBattleLog(
  prevState: FullBattleState,
  refereeName: string,
  text: string
): FullBattleState {
  return {
    ...prevState,
    logs: addLog(prevState.logs, prevState.round, `[WASIT · ${refereeName}] ${text}`, 'highlight'),
  };
}

export function applyRefereeStatAdjustment(
  prevState: FullBattleState,
  target: 0 | 1,
  stat: 'HP' | 'ATK',
  delta: number,
  refereeName: string
): FullBattleState {
  if (prevState.phase === 'GAME_OVER' || prevState.phase === 'ROUND_END') {
    return prevState;
  }
  const s = cloneBattleState(prevState);
  const fighter = s.players[target].active;
  if (!fighter) return prevState;

  const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;
  if (stat === 'HP') {
    const nextHp = Math.max(0, Math.min(9999, fighter.currentHp + delta));
    fighter.currentHp = nextHp;
    if (nextHp > fighter.maxHp) {
      fighter.maxHp = nextHp;
    }
    fighter.statusNotes.push(`Wasit ${deltaLabel} HP`);
    s.logs = addLog(
      s.logs,
      s.round,
      `[WASIT · ${refereeName}] Koreksi HP ${s.players[target].name} (${fighter.def.name}): ${deltaLabel} HP → ${fighter.currentHp}/${fighter.maxHp}.`,
      'highlight'
    );
    if (fighter.currentHp <= 0 && s.players[0].active && s.players[1].active) {
      return finalizePostEffectOrCombatCheck(s, new Set(), s.phase);
    }
    return s;
  }

  const nextAtk = Math.max(0, Math.min(9999, fighter.currentAtk + delta));
  fighter.currentAtk = nextAtk;
  fighter.statusNotes.push(`Wasit ${deltaLabel} ATK`);
  s.logs = addLog(
    s.logs,
    s.round,
    `[WASIT · ${refereeName}] Koreksi ATK ${s.players[target].name} (${fighter.def.name}): ${deltaLabel} ATK → ${fighter.currentAtk}.`,
    'highlight'
  );
  return s;
}

export function applyRefereeForceRoundWinner(
  prevState: FullBattleState,
  winner: 0 | 1 | 'DRAW',
  refereeName: string,
  reason?: string
): FullBattleState {
  if (prevState.phase === 'GAME_OVER' || prevState.phase === 'ROUND_END') {
    return prevState;
  }
  const s = cloneBattleState(prevState);
  const reasonSuffix = reason?.trim() ? ` (${reason.trim()})` : '';
  const verdictLabel =
    winner === 'DRAW'
      ? 'Ronde dinyatakan SERI'
      : `${s.players[winner].name} dinyatakan Menang Ronde ${s.round}`;

  s.logs = addLog(
    s.logs,
    s.round,
    `[WASIT · ${refereeName}] Keputusan Ronde: ${verdictLabel}${reasonSuffix}.`,
    'highlight'
  );

  // Ensure both active slots have a card instance if ruled during character selection
  for (const idx of [0, 1] as const) {
    const pl = s.players[idx];
    if (!pl.active) {
      const candidate = pl.hand.shift() ?? pl.deck.shift() ?? null;
      if (candidate) {
        pl.active = createActiveFighter(candidate);
      }
    }
  }

  if (s.players[0].active && s.players[1].active) {
    if (winner === 'DRAW') {
      s.players[0].active.currentHp = 0;
      s.players[1].active.currentHp = 0;
    } else if (winner === 0) {
      s.players[1].active.currentHp = 0;
    } else {
      s.players[0].active.currentHp = 0;
    }
    return finalizePostEffectOrCombatCheck(s, new Set(), 'P1_PICK_SUIT');
  }

  return {
    ...s,
    phase: 'ROUND_END',
    choiceQueue: [],
    roundSummaryText: `${verdictLabel}${reasonSuffix}.`,
  };
}

export function applyRefereeDeclareMatchWinner(
  prevState: FullBattleState,
  winner: 0 | 1 | 'DRAW',
  refereeName: string,
  reason?: string
): FullBattleState {
  const s = cloneBattleState(prevState);
  const baseText =
    winner === 'DRAW'
      ? `Keputusan Resmi Wasit (${refereeName}): Pertandingan dinyatakan SERI!`
      : `Keputusan Resmi Wasit (${refereeName}): ${s.players[winner].name} dinyatakan MENANG!`;
  const fullReason = reason?.trim() ? `${baseText} — ${reason.trim()}` : baseText;

  return {
    ...s,
    phase: 'GAME_OVER',
    winnerIndex: winner,
    winReason: fullReason,
    choiceQueue: [],
    logs: addLog(s.logs, s.round, `[WASIT · ${refereeName}] ${fullReason}`, 'highlight'),
  };
}


