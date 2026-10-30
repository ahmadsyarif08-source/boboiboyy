import { CARD_BY_ID } from '../data/cards';
import {
  canPlayCharacterCard,
  compareSuitElements,
  createActiveFighter,
  evaluateAndRecordSupportCombo,
  summarizeSupportCardLabel,
  type FullBattleState,
  type SupportResolutionOutcome,
} from './battleEngine';
import {
  CardCategory,
  SuitElement,
  type BattleLogEntry,
  type CardDefinition,
  type CardInstance,
  type EffectKey,
  type PlayerBattleState,
  type SuitArtSetId,
} from '../types/game';

export type PhysicalWinRule = 'ROUNDS_3' | 'ROUNDS_5' | 'ROUNDS_7' | 'WINS_3' | 'WINS_5';

export type PhysicalSimStep =
  | 'PICK_CHARACTERS'
  | 'TABLE_PROMPT'
  | 'PICK_SUITS'
  | 'PICK_SUPPORTS_AND_STRIKE'
  | 'ROUND_END'
  | 'GAME_OVER';

export type PhysicalPromptKind =
  | 'CONFIRM_KUPUTERI_IN_HAND'
  | 'SWAP_CONDITIONAL_FROM_PHYSICAL_DECK'
  | 'COPY_ENEMY_DECK_SUPPORT'
  | 'COPY_ENEMY_DECK_EFFECT'
  | 'COPY_ENEMY_DECK_STATS'
  | 'RECORD_DISCARD_ENEMY_HAND_1'
  | 'RETURN_ENEMY_WIN_2';

export interface PhysicalTablePrompt {
  id: string;
  ownerIndex: 0 | 1;
  sourceCardName: string;
  kind: PhysicalPromptKind;
  title: string;
  instruction: string;
}

export interface PhysicalTableNotice {
  id: string;
  tone: 'info' | 'p1' | 'p2' | 'warning';
  text: string;
}

export interface PhysicalSimSession {
  hostName: string;
  winRule: PhysicalWinRule;
  enforceUniqueCards: boolean;
  enforceConditions: boolean;
  physicalHandCount: [number, number];
  usedCardIds: [string[], string[]];
  step: PhysicalSimStep;
  pendingEntryPriority3?: boolean;
  pendingPrompts: PhysicalTablePrompt[];
  tableNotices: PhysicalTableNotice[];
  latestHostAnnouncement: { id: string; hostName: string; text: string; timestamp: number } | null;
  battle: FullBattleState;
}

export type PhysicalPromptResolution =
  | { kind: 'CONFIRM_KUPUTERI_IN_HAND'; hasKuputeri: boolean }
  | { kind: 'PICK_CARD_ID'; cardId: string | null }
  | { kind: 'PICK_WIN_ZONE_UIDS'; uids: string[] };

function makeLog(
  logs: BattleLogEntry[],
  round: number,
  text: string,
  tone: BattleLogEntry['tone'] = 'neutral'
): BattleLogEntry[] {
  const entry: BattleLogEntry = {
    id: `psim-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    round,
    text,
    tone,
  };
  return [entry, ...logs].slice(0, 80);
}

function makeNotice(
  tone: PhysicalTableNotice['tone'],
  text: string
): PhysicalTableNotice {
  return {
    id: `psim-note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tone,
    text,
  };
}

function makeCardInstance(playerIdx: 0 | 1, defId: string, prefix = 'phys'): CardInstance {
  return {
    uid: `${prefix}-p${playerIdx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    defId,
  };
}

function buildHandPlaceholders(playerIdx: 0 | 1, count: number): CardInstance[] {
  const clamped = Math.max(0, Math.min(20, Math.round(count)));
  const fallbackDefId = 'bf-01-probe';
  return Array.from({ length: clamped }, (_, i) => ({
    uid: `phys-hand-p${playerIdx}-${i}`,
    defId: fallbackDefId,
  }));
}

function syncHandPlaceholders(session: PhysicalSimSession): PhysicalSimSession {
  const c0 = Math.max(0, Math.min(20, session.physicalHandCount[0]));
  const c1 = Math.max(0, Math.min(20, session.physicalHandCount[1]));
  return {
    ...session,
    physicalHandCount: [c0, c1],
    battle: {
      ...session.battle,
      players: [
        {
          ...session.battle.players[0],
          hand: buildHandPlaceholders(0, c0),
        },
        {
          ...session.battle.players[1],
          hand: buildHandPlaceholders(1, c1),
        },
      ],
    },
  };
}

function cloneSession(session: PhysicalSimSession): PhysicalSimSession {
  const b = session.battle;
  return {
    ...session,
    physicalHandCount: [session.physicalHandCount[0], session.physicalHandCount[1]],
    usedCardIds: [[...session.usedCardIds[0]], [...session.usedCardIds[1]]],
    pendingPrompts: [...session.pendingPrompts],
    tableNotices: [...session.tableNotices],
    latestHostAnnouncement: session.latestHostAnnouncement
      ? { ...session.latestHostAnnouncement }
      : null,
    battle: {
      ...b,
      choiceQueue: [...b.choiceQueue],
      logs: [...b.logs],
      roundHistory: [...b.roundHistory],
      comboHistory: [...(b.comboHistory ?? [])],
      currentRoundP0Supports: [...b.currentRoundP0Supports],
      currentRoundP1Supports: [...b.currentRoundP1Supports],
      players: [
        {
          ...b.players[0],
          deck: [...b.players[0].deck],
          hand: [...b.players[0].hand],
          winZone: [...b.players[0].winZone],
          loseZone: [...b.players[0].loseZone],
          usedCharacterTags: [...b.players[0].usedCharacterTags],
          active: b.players[0].active
            ? {
                ...b.players[0].active,
                statusNotes: [...b.players[0].active.statusNotes],
              }
            : null,
        },
        {
          ...b.players[1],
          deck: [...b.players[1].deck],
          hand: [...b.players[1].hand],
          winZone: [...b.players[1].winZone],
          loseZone: [...b.players[1].loseZone],
          usedCharacterTags: [...b.players[1].usedCharacterTags],
          active: b.players[1].active
            ? {
                ...b.players[1].active,
                statusNotes: [...b.players[1].active.statusNotes],
              }
            : null,
        },
      ],
    },
  };
}

export function createPhysicalSimSession(params: {
  hostName: string;
  p0Name: string;
  p1Name: string;
  winRule: PhysicalWinRule;
  initialHandCount: number;
  p0SuitSet: SuitArtSetId;
  p1SuitSet: SuitArtSetId;
  enforceUniqueCards: boolean;
  enforceConditions: boolean;
}): PhysicalSimSession {
  const maxRoundsMap: Record<PhysicalWinRule, number | null> = {
    ROUNDS_3: 3,
    ROUNDS_5: 5,
    ROUNDS_7: 7,
    WINS_3: null,
    WINS_5: null,
  };
  const targetWinsMap: Record<PhysicalWinRule, number> = {
    ROUNDS_3: 99,
    ROUNDS_5: 99,
    ROUNDS_7: 99,
    WINS_3: 3,
    WINS_5: 5,
  };

  const handCount = Math.max(0, Math.min(12, params.initialHandCount));
  const cleanHost = params.hostName.trim() || 'Host Meja';
  const cleanP0 = params.p0Name.trim() || 'Pemain 1';
  const cleanP1 = params.p1Name.trim() || 'Pemain 2';
  const maxRounds = maxRoundsMap[params.winRule];
  const targetWins = targetWinsMap[params.winRule];

  const p0: PlayerBattleState = {
    id: 0,
    name: cleanP0,
    isCpu: false,
    deck: [],
    hand: buildHandPlaceholders(0, handCount),
    winZone: [],
    loseZone: [],
    active: null,
    pendingCharacterUid: null,
    selectedSuit: null,
    pendingSupportUid: null,
    playedSupportCard: null,
    usedCharacterTags: [],
    suitArtSet: params.p0SuitSet,
  };

  const p1: PlayerBattleState = {
    id: 1,
    name: cleanP1,
    isCpu: false,
    deck: [],
    hand: buildHandPlaceholders(1, handCount),
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

  const ruleDesc = maxRounds ? `Format ${maxRounds} Ronde` : `Target ${targetWins} Kartu Zona Menang`;
  const logs = makeLog(
    [],
    1,
    `[HOST · ${cleanHost}] Simulasi Kartu Asli dimulai (${cleanP0} vs ${cleanP1} · ${ruleDesc}).`,
    'highlight'
  );

  const battle: FullBattleState = {
    mode: 'PASS_AND_PLAY',
    difficulty: 'STANDAR',
    p0Difficulty: 'STANDAR',
    targetWins,
    maxRounds,
    round: 1,
    suitAttemptInRound: 1,
    phase: 'P1_PICK_CHARACTER',
    players: [p0, p1],
    choiceQueue: [],
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
  };

  return {
    hostName: cleanHost,
    winRule: params.winRule,
    enforceUniqueCards: params.enforceUniqueCards,
    enforceConditions: params.enforceConditions,
    physicalHandCount: [handCount, handCount],
    usedCardIds: [[], []],
    step: 'PICK_CHARACTERS',
    pendingEntryPriority3: false,
    pendingPrompts: [],
    tableNotices: [
      makeNotice(
        'info',
        `Ronde 1: Minta ${cleanP0} dan ${cleanP1} meletakkan 1 Kartu Karakter asli tertutup di meja, buka bersamaan, lalu input/scan kedua kartu di bawah.`
      ),
    ],
    latestHostAnnouncement: null,
    battle,
  };
}

export function checkPhysicalCardPlayability(
  session: PhysicalSimSession,
  playerIdx: 0 | 1,
  card: CardDefinition
): { playable: boolean; warning?: string } {
  if (card.category !== CardCategory.CHARACTER) {
    return { playable: false, warning: 'Bukan Kartu Karakter.' };
  }

  const alreadyUsed = session.usedCardIds[playerIdx].includes(card.id);
  if (alreadyUsed && session.enforceUniqueCards) {
    return {
      playable: false,
      warning: 'Sudah dipakai di ronde sebelumnya (Aturan 1x Pakai Aktif)',
    };
  }

  const condCheck = canPlayCharacterCard(card, session.battle.players[playerIdx].usedCharacterTags);
  if (!condCheck.playable && session.enforceConditions) {
    return {
      playable: false,
      warning: condCheck.reason ?? 'Syarat evolusi belum terpenuhi',
    };
  }

  if (alreadyUsed) {
    return { playable: true, warning: 'Pernah dipakai (diizinkan Host)' };
  }
  if (!condCheck.playable) {
    return { playable: true, warning: 'Syarat dilewati (Override Host)' };
  }

  return { playable: true };
}

function applyPhysicalEntryEffectKey(
  session: PhysicalSimSession,
  ownerIdx: 0 | 1,
  effectKey: EffectKey,
  sourceName: string,
  instantWins: Set<0 | 1>
): void {
  const enemyIdx: 0 | 1 = ownerIdx === 0 ? 1 : 0;
  const s = session.battle;
  const owner = s.players[ownerIdx];
  const enemy = s.players[enemyIdx];
  const tone = ownerIdx === 0 ? 'p1' : 'p2';
  const noticeTone = ownerIdx === 0 ? 'p1' : 'p2';

  if (!owner.active || !enemy.active) return;

  switch (effectKey) {
    case 'NULLIFY_ENEMY_EFFECT': {
      enemy.active.effectNullified = true;
      if (!enemy.active.statusNotes.includes('Efek Dibatalkan (Efek 01)')) {
        enemy.active.statusNotes.push('Efek Dibatalkan (Efek 01)');
      }
      s.logs = makeLog(
        s.logs,
        s.round,
        `${sourceName} (${owner.name}): Efek kartu ${enemy.active.def.name} menjadi tidak efektif!`,
        tone
      );
      break;
    }
    case 'SHIELD_ONCE': {
      if ((owner.active.enemyAttacksReceived ?? 0) === 0) {
        owner.active.firstAttackShield = true;
        if (!owner.active.statusNotes.includes('Tangkis Serangan ke-1')) {
          owner.active.statusNotes.push('Tangkis Serangan ke-1');
        }
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName} (${owner.name}): Serangan pertama lawan menjadi tidak efektif!`,
          tone
        );
      } else {
        owner.active.shieldsRemaining += 1;
        owner.active.statusNotes.push('Perisai x1');
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName} (${owner.name}): Menangkis 1 serangan lawan berikutnya!`,
          tone
        );
      }
      break;
    }
    case 'SHIELD_TWICE': {
      owner.active.shieldsRemaining += 2;
      owner.active.statusNotes.push('Perisai x2');
      s.logs = makeLog(s.logs, s.round, `${sourceName} (${owner.name}): Menangkis 2 kali serangan lawan!`, tone);
      break;
    }
    case 'REFLECT_FIRST_ATTACK': {
      owner.active.reflectFirstAttack = true;
      owner.active.statusNotes.push('Pantul Serangan');
      s.logs = makeLog(s.logs, s.round, `${sourceName} (${owner.name}): Siap memantulkan serangan pertama lawan!`, tone);
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
      owner.active.statusNotes.push('Seri Suit: Gugurkan 1 Zona Menang Lawan');
      break;
    }
    case 'PAPA_ZOLA_SUIT_MILL_1': {
      owner.active.papaZolaMillArmed = true;
      owner.active.statusNotes.push('Lawan Menang/Seri Suit: Buang 1 Dek Fisik');
      break;
    }
    case 'SUPER_PAPA_LOCK_SUPPORT_ATK_20': {
      owner.active.blockEnemySupport = true;
      owner.active.statusNotes.push('Kunci Pendukung Lawan');
      enemy.active.currentAtk = 20;
      enemy.active.statusNotes.push('ATK jadi 20');
      s.logs = makeLog(
        s.logs,
        s.round,
        `${sourceName}: Kartu Pendukung ${enemy.name} dikunci & ATK ${enemy.active.def.name} menjadi 20!`,
        tone
      );
      session.tableNotices.push(
        makeNotice(
          noticeTone,
          `Meja Fisik: ${enemy.name} DILARANG menurunkan Kartu Pendukung fisik selama ${sourceName} aktif.`
        )
      );
      break;
    }
    case 'MAMA_ZILA_ENEMY_ATK_40': {
      enemy.active.currentAtk = 40;
      enemy.active.statusNotes.push('ATK jadi 40');
      s.logs = makeLog(
        s.logs,
        s.round,
        `${sourceName}: ATK ${enemy.active.def.name} ditetapkan menjadi 40!`,
        tone
      );
      break;
    }
    case 'TUTOR_DURI':
    case 'TUTOR_SOLAR':
    case 'TUTOR_SOPAN': {
      const targetLabel =
        effectKey === 'TUTOR_DURI'
          ? 'BoBoiBoy Duri'
          : effectKey === 'TUTOR_SOLAR'
          ? 'BoBoiBoy Solar'
          : 'SR BoBoiBoy Sopan';
      session.physicalHandCount[ownerIdx] += 1;
      s.logs = makeLog(
        s.logs,
        s.round,
        `${sourceName}: ${owner.name} mencari ${targetLabel} dari Dek Fisik ke tangan (+1 Kartu Tangan).`,
        tone
      );
      session.tableNotices.push(
        makeNotice(
          noticeTone,
          `Meja Fisik (${owner.name}): Cari kartu "${targetLabel}" di Dek Fisik, tambahkan ke tangan, lalu kocok ulang Dek Fisik (kurangi -1 tangan bila tidak ada di dek).`
        )
      );
      break;
    }
    case 'TUTOR_ANY_FROM_DECK': {
      session.physicalHandCount[ownerIdx] += 1;
      s.logs = makeLog(
        s.logs,
        s.round,
        `${sourceName}: ${owner.name} memilih 1 kartu bebas dari Dek Fisik ke tangan (+1 Kartu Tangan).`,
        tone
      );
      session.tableNotices.push(
        makeNotice(
          noticeTone,
          `Meja Fisik (${owner.name}): Pilih 1 kartu bebas dari Dek Fisik ke Tangan, lalu kocok ulang Dek Fisik.`
        )
      );
      break;
    }
    case 'TUTOR_SUPPORT_FROM_DECK': {
      session.physicalHandCount[ownerIdx] += 1;
      s.logs = makeLog(
        s.logs,
        s.round,
        `${sourceName}: ${owner.name} mencari 1 Kartu Pendukung dari Dek Fisik ke tangan (+1 Kartu Tangan).`,
        tone
      );
      session.tableNotices.push(
        makeNotice(
          noticeTone,
          `Meja Fisik (${owner.name}): Ambil 1 Kartu Pendukung dari Dek Fisik ke Tangan, lalu kocok Dek Fisik.`
        )
      );
      break;
    }
    case 'DRAW_2': {
      session.physicalHandCount[ownerIdx] += 2;
      s.logs = makeLog(
        s.logs,
        s.round,
        `${sourceName}: ${owner.name} menarik 2 kartu dari Dek Fisik ke tangan.`,
        tone
      );
      session.tableNotices.push(
        makeNotice(
          noticeTone,
          `Meja Fisik (${owner.name}): Ambil 2 kartu teratas dari Dek Fisik ke Tangan!`
        )
      );
      break;
    }
    case 'DRAW_3': {
      session.physicalHandCount[ownerIdx] += 3;
      s.logs = makeLog(
        s.logs,
        s.round,
        `${sourceName}: ${owner.name} menarik 3 kartu dari Dek Fisik ke tangan.`,
        tone
      );
      session.tableNotices.push(
        makeNotice(
          noticeTone,
          `Meja Fisik (${owner.name}): Ambil 3 kartu teratas dari Dek Fisik ke Tangan!`
        )
      );
      break;
    }
    case 'MARIPOS_KUPUTERI_BUFF': {
      session.pendingPrompts.push({
        id: `prm-maripos-${Date.now()}-${ownerIdx}`,
        ownerIndex: ownerIdx,
        sourceCardName: sourceName,
        kind: 'CONFIRM_KUPUTERI_IN_HAND',
        title: `${sourceName} (${owner.name}) — Cek Kartu Fisik Kuputeri`,
        instruction: `Tanyakan kepada ${owner.name}: Apakah saat ini memegang kartu fisik "Kuputeri" di tangan? Jika ya, ${sourceName} mendapat +60 HP dan +60 ATK!`,
      });
      break;
    }
    case 'GOPAL_LOSE_ZONE_HEAL_20': {
      const count = enemy.loseZone.length;
      if (count > 0) {
        const bonus = count * 20;
        owner.active.currentHp += bonus;
        owner.active.maxHp += bonus;
        owner.active.statusNotes.push(`+${bonus} HP`);
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName}: HP bertambah +${bonus} (${count} kartu tercatat di Zona Kalah ${enemy.name}).`,
          tone
        );
      } else {
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName}: Zona Kalah ${enemy.name} masih kosong (0 bonus HP).`,
          'neutral'
        );
      }
      break;
    }
    case 'KACHAX_SUPPORT_GRAVE_ATK_20': {
      const supportCount = owner.loseZone.filter(
        (c) => CARD_BY_ID[c.defId]?.category === CardCategory.SUPPORT
      ).length;
      if (supportCount > 0) {
        const bonus = supportCount * 20;
        owner.active.currentAtk += bonus;
        owner.active.statusNotes.push(`+${bonus} ATK`);
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName}: ATK +${bonus} dari ${supportCount} Kartu Pendukung di Zona Kalah ${owner.name}!`,
          tone
        );
      }
      break;
    }
    case 'YAYA_HAND_BURN_20': {
      const count = session.physicalHandCount[enemyIdx];
      const dmg = count * 20;
      if (dmg > 0) {
        enemy.active.currentHp = Math.max(0, enemy.active.currentHp - dmg);
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName}: Hantaman Kuat! ${enemy.active.def.name} menerima ${dmg} kerusakan (${count} kartu fisik di tangan ${enemy.name}).`,
          tone
        );
      }
      break;
    }
    case 'NOVA_WIPE_HAND_BURN_40': {
      const discardedCount = session.physicalHandCount[enemyIdx];
      if (discardedCount > 0) {
        for (let i = 0; i < discardedCount; i++) {
          enemy.loseZone.push(makeCardInstance(enemyIdx, 'bf-01-probe', 'nova-disc'));
        }
        session.physicalHandCount[enemyIdx] = 0;
        const dmg = discardedCount * 40;
        enemy.active.currentHp = Math.max(0, enemy.active.currentHp - dmg);
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName}: Api Membara! Membuang ${discardedCount} kartu tangan fisik ${enemy.name} & memberi ${dmg} kerusakan!`,
          'highlight'
        );
        session.tableNotices.push(
          makeNotice(
            'warning',
            `Meja Fisik (${enemy.name}): Buang SELURUH ${discardedCount} kartu tangan fisik ke Zona Kalah sekarang!`
          )
        );
      }
      break;
    }
    case 'BLIZZARD_WIPE_HAND_DRAIN_ATK_40': {
      const discardedCount = session.physicalHandCount[enemyIdx];
      if (discardedCount > 0) {
        for (let i = 0; i < discardedCount; i++) {
          enemy.loseZone.push(makeCardInstance(enemyIdx, 'bf-01-probe', 'bliz-disc'));
        }
        session.physicalHandCount[enemyIdx] = 0;
        const drain = discardedCount * 40;
        enemy.active.currentAtk = Math.max(0, enemy.active.currentAtk - drain);
        enemy.active.statusNotes.push(`-${drain} ATK`);
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName}: Badai Salju! Membuang ${discardedCount} kartu tangan fisik ${enemy.name} & mengurangi ATK sebanyak ${drain}!`,
          'highlight'
        );
        session.tableNotices.push(
          makeNotice(
            'warning',
            `Meja Fisik (${enemy.name}): Buang SELURUH ${discardedCount} kartu tangan fisik ke Zona Kalah sekarang!`
          )
        );
      }
      break;
    }
    case 'TOK_ABA_AUTO_WIN_BOBOIBOY': {
      if (enemy.active.def.characterTags.includes('BoBoiBoy')) {
        instantWins.add(ownerIdx);
        s.logs = makeLog(
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
        const tags = CARD_BY_ID[c.defId]?.characterTags ?? [];
        return tags.includes('Papa Zola') || tags.includes('Mama Zila');
      });
      if (matched) {
        instantWins.add(ownerIdx);
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName}: Papa Zola / Mama Zila tercatat di Zona Kalah/Menang — Pipi Zola Otomatis Menang!`,
          'highlight'
        );
      }
      break;
    }
    case 'OTOI_AUTO_WIN': {
      const allZones = [...owner.loseZone, ...owner.winZone, ...enemy.loseZone, ...enemy.winZone];
      const matched = allZones.some((c) =>
        (CARD_BY_ID[c.defId]?.characterTags ?? []).includes('Pipi Zola')
      );
      if (matched) {
        instantWins.add(ownerIdx);
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName}: Pipi Zola tercatat di Zona Kalah/Menang — Otoi Otomatis Menang!`,
          'highlight'
        );
      }
      break;
    }
    case 'BELIUNG_AUTO_WIN_KUPUTERI': {
      const allZones = [...owner.loseZone, ...owner.winZone, ...enemy.loseZone, ...enemy.winZone];
      const matched = allZones.some((c) =>
        (CARD_BY_ID[c.defId]?.characterTags ?? []).includes('Kuputeri')
      );
      if (matched) {
        instantWins.add(ownerIdx);
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName}: Kuputeri tercatat di Zona Kalah/Menang — BoBoiBoy Beliung Otomatis Menang!`,
          'highlight'
        );
      }
      break;
    }
    case 'BLIND_DISCARD_ENEMY_HAND_1': {
      if (session.physicalHandCount[enemyIdx] > 0) {
        session.physicalHandCount[enemyIdx] -= 1;
        session.tableNotices.push(
          makeNotice(
            'warning',
            `Meja Fisik: ${owner.name} memilih 1 kartu TERTUTUP dari Tangan Fisik ${enemy.name} (tanpa melihat isinya) ke Zona Kalah!`
          )
        );
        session.pendingPrompts.push({
          id: `prm-blinddisc1-${Date.now()}-${ownerIdx}`,
          ownerIndex: ownerIdx,
          sourceCardName: sourceName,
          kind: 'RECORD_DISCARD_ENEMY_HAND_1',
          title: `${sourceName} — Pilih 1 Kartu Tertutup Tangan ${enemy.name}`,
          instruction: `${owner.name} memilih 1 kartu tertutup (tanpa mengintip) dari tangan fisik ${enemy.name} untuk diletakkan di Zona Kalah. Catat kartu yang terpilih, atau klik "Catat Umum".`,
        });
      }
      break;
    }
    case 'DISCARD_ENEMY_HAND_1': {
      if (session.physicalHandCount[enemyIdx] > 0) {
        session.physicalHandCount[enemyIdx] -= 1;
        session.tableNotices.push(
          makeNotice(
            'warning',
            `Meja Fisik: ${owner.name} MELIHAT Tangan Fisik ${enemy.name} lalu memilih 1 kartu untuk diletakkan di Zona Kalah!`
          )
        );
        session.pendingPrompts.push({
          id: `prm-disc1-${Date.now()}-${ownerIdx}`,
          ownerIndex: ownerIdx,
          sourceCardName: sourceName,
          kind: 'RECORD_DISCARD_ENEMY_HAND_1',
          title: `${sourceName} — Lihat Tangan ${enemy.name} & Catat 1 Kartu Dibuang`,
          instruction: `${owner.name} melihat tangan fisik ${enemy.name} dan memilih 1 kartu ke Zona Kalah. Pilih kartu tersebut agar tercatat di Zona Kalah, atau klik "Catat Umum" bila tidak perlu dicatat spesifik.`,
        });
      }
      break;
    }
    case 'RETURN_ENEMY_HAND_3_TO_DECK': {
      const retCount = Math.min(3, session.physicalHandCount[enemyIdx]);
      if (retCount > 0) {
        session.physicalHandCount[enemyIdx] -= retCount;
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName}: ${owner.name} melihat tangan ${enemy.name} & mengembalikan ${retCount} kartu tangan fisik ke dalam Dek Fisik ${enemy.name}!`,
          tone
        );
        session.tableNotices.push(
          makeNotice(
            'warning',
            `Meja Fisik: ${owner.name} melihat Tangan Fisik ${enemy.name} & memilih ${retCount} kartu untuk dimasukkan kembali ke Dek Fisik ${enemy.name}, lalu kocok Dek Fisik!`
          )
        );
      }
      break;
    }
    case 'BOBOIBOY_GOPAL_SWAP_CONDITIONAL': {
      session.pendingPrompts.push({
        id: `prm-swapcond-${Date.now()}-${ownerIdx}`,
        ownerIndex: ownerIdx,
        sourceCardName: sourceName,
        kind: 'SWAP_CONDITIONAL_FROM_PHYSICAL_DECK',
        title: `${sourceName} (${owner.name}) — Tukar Kartu Bersyarat dari Dek Fisik`,
        instruction: `${owner.name} memilih 1 Kartu Karakter Bersyarat di Dek Fisiknya untuk ditukarkan dengan ${sourceName} (${sourceName} kembali ke dalam Dek Fisik & dikocok). Pilih kartu yang ditarik:`,
      });
      break;
    }
    case 'COPY_ENEMY_DECK_SUPPORT': {
      session.pendingPrompts.push({
        id: `prm-copysup-${Date.now()}-${ownerIdx}`,
        ownerIndex: ownerIdx,
        sourceCardName: sourceName,
        kind: 'COPY_ENEMY_DECK_SUPPORT',
        title: `${sourceName} (${owner.name}) — Tiru Kartu Pendukung Dek Fisik ${enemy.name}`,
        instruction: `${owner.name} memilih 1 Kartu Pendukung dari Dek Fisik ${enemy.name} untuk ditiru efeknya sekarang, lalu Dek Fisik ${enemy.name} dikocok:`,
      });
      break;
    }
    case 'ROSAKSA_COPY_ENEMY_DECK_EFFECT': {
      session.pendingPrompts.push({
        id: `prm-copyeff-${Date.now()}-${ownerIdx}`,
        ownerIndex: ownerIdx,
        sourceCardName: sourceName,
        kind: 'COPY_ENEMY_DECK_EFFECT',
        title: `${sourceName} (${owner.name}) — Tiru Efek Kartu Dek Fisik ${enemy.name}`,
        instruction: `${owner.name} memilih 1 kartu ber-efek dari Dek Fisik ${enemy.name} untuk langsung ditiru oleh ${sourceName}, lalu Dek Fisik ${enemy.name} dikocok:`,
      });
      break;
    }
    case 'YING_COPY_ENEMY_DECK_STATS': {
      session.pendingPrompts.push({
        id: `prm-copystats-${Date.now()}-${ownerIdx}`,
        ownerIndex: ownerIdx,
        sourceCardName: sourceName,
        kind: 'COPY_ENEMY_DECK_STATS',
        title: `${sourceName} (${owner.name}) — Tiru HP & ATK Karakter Dek Fisik ${enemy.name}`,
        instruction: `${owner.name} memilih 1 Kartu Karakter dari Dek Fisik ${enemy.name} agar Ying meniru nilai HP & ATK-nya, lalu Dek Fisik ${enemy.name} dikocok:`,
      });
      break;
    }
    case 'SOPAN_RETURN_ENEMY_WIN_2': {
      if (enemy.winZone.length === 0) {
        s.logs = makeLog(s.logs, s.round, `${sourceName}: Zona Menang ${enemy.name} masih kosong.`, 'neutral');
      } else if (enemy.winZone.length <= 2) {
        const count = enemy.winZone.length;
        const removed = enemy.winZone.splice(0, count);
        const returnedIds = new Set(removed.map((c) => c.defId));
        session.usedCardIds[enemyIdx] = session.usedCardIds[enemyIdx].filter(
          (id) => !returnedIds.has(id)
        );
        s.logs = makeLog(
          s.logs,
          s.round,
          `${sourceName}: Kembalikan Kemenangan! ${count} kartu dari Zona Menang ${enemy.name} dimasukkan kembali ke dalam Dek Fisik ${enemy.name}!`,
          'highlight'
        );
        session.tableNotices.push(
          makeNotice(
            'warning',
            `Meja Fisik (${enemy.name}): Ambil ${count} kartu dari Zona Menang Fisik dan masukkan kembali ke dalam Dek Fisik ${enemy.name}, lalu kocok Dek Fisik!`
          )
        );
      } else {
        session.pendingPrompts.push({
          id: `prm-sopan-${Date.now()}-${ownerIdx}`,
          ownerIndex: ownerIdx,
          sourceCardName: sourceName,
          kind: 'RETURN_ENEMY_WIN_2',
          title: `${sourceName} — Pilih 2 Kartu Zona Menang ${enemy.name}`,
          instruction: `Pilih 2 kartu dari Zona Menang ${enemy.name} untuk dimasukkan kembali ke dalam Dek Fisik ${enemy.name}:`,
        });
      }
      break;
    }
    default:
      break;
  }
}

function applyPhysicalSupportEffect(
  session: PhysicalSimSession,
  ownerIdx: 0 | 1,
  supportDef: CardDefinition,
  fromSupportPhase = false
): SupportResolutionOutcome {
  const enemyIdx: 0 | 1 = ownerIdx === 0 ? 1 : 0;
  const s = session.battle;
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
      s.logs = makeLog(
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
        s.logs = makeLog(
          s.logs,
          s.round,
          `Kartu Pendukung ${supportDef.name} (${owner.name}): Serangan lawan pada bentrokan ini menjadi tidak efektif!`,
          tone
        );
      } else {
        owner.active.shieldsRemaining += 1;
        owner.active.statusNotes.push('Perisai x1 (Tiru Kepaku Park)');
        grantedStatBonus = true;
        bonusParts.push('+1 Perisai');
        s.logs = makeLog(
          s.logs,
          s.round,
          `Efek ${supportDef.name} (${owner.name}): ${owner.active.def.name} memperoleh Perisai 1x serangan!`,
          tone
        );
      }
      break;
    }
    case 'SUPPORT_ROCKFAMILY_ATK_20': {
      const handCount = session.physicalHandCount[enemyIdx];
      const bonus = handCount * 20;
      owner.active.currentAtk += bonus;
      owner.active.statusNotes.push(`+${bonus} ATK (Rockfamily)`);
      if (bonus > 0) {
        grantedStatBonus = true;
        bonusParts.push(`+${bonus} ATK`);
      }
      s.logs = makeLog(
        s.logs,
        s.round,
        `Kartu Pendukung ${supportDef.name} (${owner.name}): ATK ${owner.active.def.name} +${bonus} (${handCount} kartu fisik di tangan ${enemy.name})!`,
        tone
      );
      break;
    }
    case 'DRAW_2': {
      session.physicalHandCount[ownerIdx] += 2;
      bonusParts.push('+2 Kartu');
      s.logs = makeLog(
        s.logs,
        s.round,
        `Kartu Pendukung ${supportDef.name} (${owner.name}): Menarik 2 kartu dari Dek Fisik ke tangan!`,
        tone
      );
      session.tableNotices.push(
        makeNotice(
          ownerIdx === 0 ? 'p1' : 'p2',
          `Meja Fisik (${owner.name}): Ambil 2 kartu dari Dek Fisik ke Tangan karena efek ${supportDef.name}!`
        )
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
        s.logs = makeLog(
          s.logs,
          s.round,
          `${owner.active.def.name} (${owner.name}) meniru efek ${supportDef.name}: Kartu Pendukung lawan berikutnya akan dibatalkan!`,
          tone
        );
      }
      break;
    }
    default: {
      if (supportDef.effectKey !== 'NONE') {
        const unusedWins = new Set<0 | 1>();
        applyPhysicalEntryEffectKey(session, ownerIdx, supportDef.effectKey, supportDef.name, unusedWins);
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
    s.logs = makeLog(
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
    s.logs = makeLog(
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

function runRemainingPhysicalEntryPriority3(
  session: PhysicalSimSession,
  instantWins: Set<0 | 1>
): void {
  const s = session.battle;
  for (const idx of [0, 1] as const) {
    const fighter = s.players[idx].active;
    if (!fighter || fighter.effectNullified || fighter.entryEffectResolved) continue;
    const prio = fighter.def.effectPriority ?? 3;
    if (prio === 3) {
      fighter.entryEffectResolved = true;
      applyPhysicalEntryEffectKey(
        session,
        idx,
        fighter.def.effectKey,
        fighter.def.name,
        instantWins
      );
    }
  }
}

function finalizePhysicalPostCheck(
  session: PhysicalSimSession,
  instantWins: Set<0 | 1>,
  nextStepIfAlive: PhysicalSimStep,
  nextBattlePhaseIfAlive: FullBattleState['phase']
): PhysicalSimSession {
  const s = session.battle;
  const p0 = s.players[0];
  const p1 = s.players[1];

  if (!p0.active || !p1.active) {
    return syncHandPlaceholders(session);
  }

  // Otomatis Menang (instantWins) takes strict precedence over incidental HP changes
  const p0Dead = instantWins.size > 0 ? instantWins.has(1) : p0.active.currentHp <= 0;
  const p1Dead = instantWins.size > 0 ? instantWins.has(0) : p1.active.currentHp <= 0;

  if (!p0Dead && !p1Dead) {
    if (session.pendingPrompts.length > 0) {
      session.step = 'TABLE_PROMPT';
      s.phase = 'INTERACTIVE_CHOICE';
      return syncHandPlaceholders(session);
    }
    session.pendingEntryPriority3 = false;
    s.pendingEntryPriority3 = false;
    session.step = nextStepIfAlive;
    s.phase = nextBattlePhaseIfAlive;
    return syncHandPlaceholders(session);
  }

  // A fighter (or both) has been K.O.'d / Auto-defeated!
  session.pendingPrompts = [];
  session.pendingEntryPriority3 = false;
  s.pendingEntryPriority3 = false;
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
    summary = `Seri Ganda! ${n0} dan ${n1} sama-sama tumbang dan masuk ke Zona Kalah masing-masing.`;
    s.logs = makeLog(s.logs, s.round, summary, 'warning');
    session.tableNotices.push(
      makeNotice(
        'warning',
        `Meja Fisik: Ronde ${s.round} SERI GANDA — Kedua pemain meletakkan Kartu Karakter aktifnya ke Zona Kalah Fisik masing-masing.`
      )
    );
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
      : `${p0.name} memenangkan ronde! ${defeatedName} masuk ke Zona Menang ${p0.name} (${p0.winZone.length}/${winQuotaLabel}). ${victorName} selesai bertugas ke Zona Kalah.`;
    s.logs = makeLog(s.logs, s.round, summary, 'p1');
    session.tableNotices.push(
      makeNotice(
        'p1',
        `Meja Fisik: ${p0.name} menang Ronde ${s.round}! Kartu lawan (${defeatedName}) masuk ke Zona Menang ${p0.name}, dan ${victorName} masuk ke Zona Kalah ${p0.name}.`
      )
    );
  } else {
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
      : `${p1.name} memenangkan ronde! ${defeatedName} masuk ke Zona Menang ${p1.name} (${p1.winZone.length}/${winQuotaLabel}). ${victorName} selesai bertugas ke Zona Kalah.`;
    s.logs = makeLog(s.logs, s.round, summary, 'p2');
    session.tableNotices.push(
      makeNotice(
        'p2',
        `Meja Fisik: ${p1.name} menang Ronde ${s.round}! Kartu lawan (${defeatedName}) masuk ke Zona Menang ${p1.name}, dan ${victorName} masuk ke Zona Kalah ${p1.name}.`
      )
    );
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

  p0.selectedSuit = null;
  p1.selectedSuit = null;
  p0.playedSupportCard = null;
  p1.playedSupportCard = null;
  s.choiceQueue = [];

  if (s.maxRounds !== null && s.round >= s.maxRounds) {
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

    s.phase = 'GAME_OVER';
    s.winnerIndex = matchWinner;
    s.winReason = reason;
    s.roundSummaryText = summary;
    s.logs = makeLog(
      s.logs,
      s.round,
      matchWinner === 'DRAW'
        ? `HASIL AKHIR SIMULASI KARTU ASLI: SERI!`
        : `JUARA PERTANDINGAN KARTU ASLI: ${s.players[matchWinner].name}!`,
      'highlight'
    );
    session.step = 'GAME_OVER';
    return syncHandPlaceholders(session);
  }

  if (s.maxRounds === null) {
    if (p0.winZone.length >= s.targetWins) {
      s.phase = 'GAME_OVER';
      s.winnerIndex = 0;
      s.winReason = `${p0.name} mencapai target ${p0.winZone.length} kartu di Zona Menang!`;
      s.roundSummaryText = summary;
      s.logs = makeLog(s.logs, s.round, `KEMENANGAN MUTLAK untuk ${p0.name}!`, 'highlight');
      session.step = 'GAME_OVER';
      return syncHandPlaceholders(session);
    }
    if (p1.winZone.length >= s.targetWins) {
      s.phase = 'GAME_OVER';
      s.winnerIndex = 1;
      s.winReason = `${p1.name} mencapai target ${p1.winZone.length} kartu di Zona Menang!`;
      s.roundSummaryText = summary;
      s.logs = makeLog(s.logs, s.round, `KEMENANGAN MUTLAK untuk ${p1.name}!`, 'highlight');
      session.step = 'GAME_OVER';
      return syncHandPlaceholders(session);
    }
  }

  s.phase = 'ROUND_END';
  s.roundSummaryText = summary;
  session.step = 'ROUND_END';
  return syncHandPlaceholders(session);
}

export function deployPhysicalCharacters(
  prevSession: PhysicalSimSession,
  p0CardId: string,
  p1CardId: string
): PhysicalSimSession {
  const def0 = CARD_BY_ID[p0CardId];
  const def1 = CARD_BY_ID[p1CardId];
  if (!def0 || !def1) return prevSession;

  const next = cloneSession(prevSession);
  const s = next.battle;
  const p0 = s.players[0];
  const p1 = s.players[1];

  next.tableNotices = [];
  next.pendingPrompts = [];

  // Playing 1 physical card from each player's hand onto the active zone
  next.physicalHandCount[0] = Math.max(0, next.physicalHandCount[0] - 1);
  next.physicalHandCount[1] = Math.max(0, next.physicalHandCount[1] - 1);

  if (!next.usedCardIds[0].includes(def0.id)) {
    next.usedCardIds[0].push(def0.id);
  }
  if (!next.usedCardIds[1].includes(def1.id)) {
    next.usedCardIds[1].push(def1.id);
  }

  const inst0 = makeCardInstance(0, def0.id, `r${s.round}`);
  const inst1 = makeCardInstance(1, def1.id, `r${s.round}`);

  p0.active = createActiveFighter(inst0);
  p1.active = createActiveFighter(inst1);
  p0.selectedSuit = null;
  p1.selectedSuit = null;
  p0.playedSupportCard = null;
  p1.playedSupportCard = null;
  s.suitAttemptInRound = 1;
  s.lastSuitWinner = null;
  s.roundSummaryText = null;
  s.currentRoundP0CardId = def0.id;
  s.currentRoundP1CardId = def1.id;
  s.currentRoundP0Supports = [];
  s.currentRoundP1Supports = [];
  s.currentRoundSuitClashes = 0;

  for (const tag of def0.characterTags) {
    if (!p0.usedCharacterTags.includes(tag)) p0.usedCharacterTags.push(tag);
  }
  for (const tag of def1.characterTags) {
    if (!p1.usedCharacterTags.includes(tag)) p1.usedCharacterTags.push(tag);
  }

  s.logs = makeLog(
    s.logs,
    s.round,
    `Kartu Asli Dibuka: ${p0.name} menurunkan ${def0.name} (${def0.hp}/${def0.atk}) vs ${p1.name} menurunkan ${def1.name} (${def1.hp}/${def1.atk})!`,
    'highlight'
  );

  // EFEK 01: Nullify Enemy Entry Effect
  const p0Nullifies = def0.effectKey === 'NULLIFY_ENEMY_EFFECT';
  const p1Nullifies = def1.effectKey === 'NULLIFY_ENEMY_EFFECT';

  if (p0Nullifies) {
    p0.active.entryEffectResolved = true;
    p1.active.effectNullified = true;
    p1.active.statusNotes.push('Efek Dibatalkan (Efek 01)');
    s.logs = makeLog(
      s.logs,
      s.round,
      `Efek 01 — ${def0.name} (${p0.name}) membatalkan efek kartu ${def1.name}!`,
      'p1'
    );
  }
  if (p1Nullifies) {
    p1.active.entryEffectResolved = true;
    p0.active.effectNullified = true;
    p0.active.statusNotes.push('Efek Dibatalkan (Efek 01)');
    s.logs = makeLog(
      s.logs,
      s.round,
      `Efek 01 — ${def1.name} (${p1.name}) membatalkan efek kartu ${def0.name}!`,
      'p2'
    );
  }

  const instantWins = new Set<0 | 1>();

  // Step 1: EFEK 02 executes strictly before EFEK 03
  next.pendingEntryPriority3 = true;
  for (const idx of [0, 1] as const) {
    const fighter = s.players[idx].active;
    if (!fighter || fighter.effectNullified || fighter.entryEffectResolved) continue;
    if (fighter.def.effectPriority === 2) {
      fighter.entryEffectResolved = true;
      applyPhysicalEntryEffectKey(
        next,
        idx,
        fighter.def.effectKey,
        fighter.def.name,
        instantWins
      );
    }
  }

  // If EFEK 02 already caused Otomatis Menang or 0 HP, end round immediately without running EFEK 03!
  if (
    instantWins.size > 0 ||
    (s.players[0].active && s.players[0].active.currentHp <= 0) ||
    (s.players[1].active && s.players[1].active.currentHp <= 0)
  ) {
    next.pendingPrompts = [];
    next.pendingEntryPriority3 = false;
    return finalizePhysicalPostCheck(next, instantWins, 'PICK_SUITS', 'P1_PICK_SUIT');
  }

  // If an EFEK 02 table prompt is queued, wait for Host confirmation BEFORE running EFEK 03!
  if (next.pendingPrompts.length > 0) {
    return finalizePhysicalPostCheck(next, instantWins, 'PICK_SUITS', 'P1_PICK_SUIT');
  }

  // Step 2: Run EFEK 03 now that all EFEK 02 actions have resolved
  next.pendingEntryPriority3 = false;
  runRemainingPhysicalEntryPriority3(next, instantWins);

  if (next.tableNotices.length === 0 && next.pendingPrompts.length === 0) {
    next.tableNotices.push(
      makeNotice(
        'info',
        `Efek masuk selesai — Minta ${p0.name} & ${p1.name} membuka Kartu Suit Fisik (Air / Api / Daun) secara bersamaan!`
      )
    );
  }

  return finalizePhysicalPostCheck(next, instantWins, 'PICK_SUITS', 'P1_PICK_SUIT');
}

export function resolvePhysicalTablePrompt(
  prevSession: PhysicalSimSession,
  resolution: PhysicalPromptResolution
): PhysicalSimSession {
  const next = cloneSession(prevSession);
  const prompt = next.pendingPrompts.shift();
  if (!prompt) {
    next.step = 'PICK_SUITS';
    next.battle.phase = 'P1_PICK_SUIT';
    return syncHandPlaceholders(next);
  }

  const s = next.battle;
  const ownerIdx = prompt.ownerIndex;
  const enemyIdx: 0 | 1 = ownerIdx === 0 ? 1 : 0;
  const owner = s.players[ownerIdx];
  const enemy = s.players[enemyIdx];
  const tone = ownerIdx === 0 ? 'p1' : 'p2';
  const instantWins = new Set<0 | 1>();

  switch (prompt.kind) {
    case 'CONFIRM_KUPUTERI_IN_HAND': {
      if (resolution.kind === 'CONFIRM_KUPUTERI_IN_HAND' && resolution.hasKuputeri && owner.active) {
        owner.active.currentHp += 60;
        owner.active.maxHp += 60;
        owner.active.currentAtk += 60;
        owner.active.statusNotes.push('+60 HP & +60 ATK (Kuputeri)');
        s.logs = makeLog(
          s.logs,
          s.round,
          `${prompt.sourceCardName} (${owner.name}): Kartu fisik Kuputeri dikonfirmasi di tangan — HP & ATK +60!`,
          tone
        );
      } else {
        s.logs = makeLog(
          s.logs,
          s.round,
          `${prompt.sourceCardName} (${owner.name}): Tidak ada Kuputeri di tangan (stat tetap).`,
          'neutral'
        );
      }
      break;
    }

    case 'RECORD_DISCARD_ENEMY_HAND_1': {
      const pickedId = resolution.kind === 'PICK_CARD_ID' ? resolution.cardId : null;
      const pickedDef = pickedId ? CARD_BY_ID[pickedId] : null;
      if (pickedDef) {
        enemy.loseZone.push(makeCardInstance(enemyIdx, pickedDef.id, 'disc'));
        if (!next.usedCardIds[enemyIdx].includes(pickedDef.id)) {
          next.usedCardIds[enemyIdx].push(pickedDef.id);
        }
        s.logs = makeLog(
          s.logs,
          s.round,
          `${prompt.sourceCardName}: Kartu fisik "${pickedDef.name}" milik ${enemy.name} dibuang ke Zona Kalah!`,
          tone
        );
      } else {
        enemy.loseZone.push(makeCardInstance(enemyIdx, 'bf-01-probe', 'disc-generic'));
        s.logs = makeLog(
          s.logs,
          s.round,
          `${prompt.sourceCardName}: 1 kartu tangan fisik ${enemy.name} dibuang ke Zona Kalah.`,
          tone
        );
      }
      break;
    }

    case 'SWAP_CONDITIONAL_FROM_PHYSICAL_DECK': {
      const pickedId = resolution.kind === 'PICK_CARD_ID' ? resolution.cardId : null;
      const pickedDef = pickedId ? CARD_BY_ID[pickedId] : null;
      if (pickedDef && owner.active) {
        const previousInst = owner.active.instance;
        next.usedCardIds[ownerIdx] = next.usedCardIds[ownerIdx].filter(
          (id) => id !== previousInst.defId
        );
        const swappedInst = makeCardInstance(ownerIdx, pickedDef.id, 'swap');
        owner.active = createActiveFighter(swappedInst);
        if (!next.usedCardIds[ownerIdx].includes(pickedDef.id)) {
          next.usedCardIds[ownerIdx].push(pickedDef.id);
        }
        if (ownerIdx === 0) s.currentRoundP0CardId = pickedDef.id;
        else s.currentRoundP1CardId = pickedDef.id;
        for (const tag of pickedDef.characterTags) {
          if (!owner.usedCharacterTags.includes(tag)) owner.usedCharacterTags.push(tag);
        }
        s.logs = makeLog(
          s.logs,
          s.round,
          `${prompt.sourceCardName} ditukarkan kembali ke dalam Dek Fisik & digantikan ${pickedDef.name} di Zona Aktif!`,
          'highlight'
        );
        next.tableNotices.push(
          makeNotice(
            ownerIdx === 0 ? 'p1' : 'p2',
            `Meja Fisik (${owner.name}): Masukkan kembali ${prompt.sourceCardName} ke dalam Dek Fisik, letakkan ${pickedDef.name} di Zona Aktif, lalu kocok Dek Fisik!`
          )
        );
        if (!next.pendingEntryPriority3 || (pickedDef.effectPriority ?? 3) <= 2) {
          owner.active.entryEffectResolved = true;
          applyPhysicalEntryEffectKey(
            next,
            ownerIdx,
            pickedDef.effectKey,
            pickedDef.name,
            instantWins
          );
        }
      } else {
        s.logs = makeLog(
          s.logs,
          s.round,
          `${prompt.sourceCardName}: Tidak ada Kartu Bersyarat yang ditukar dari Dek Fisik.`,
          'neutral'
        );
      }
      break;
    }

    case 'COPY_ENEMY_DECK_SUPPORT': {
      const pickedId = resolution.kind === 'PICK_CARD_ID' ? resolution.cardId : null;
      const pickedDef = pickedId ? CARD_BY_ID[pickedId] : null;
      if (pickedDef && owner.active) {
        const sourceCardDef = owner.active.def;
        const priorSupports =
          ownerIdx === 0 ? [...s.currentRoundP0Supports] : [...s.currentRoundP1Supports];
        if (ownerIdx === 0) s.currentRoundP0Supports.push(pickedDef.id);
        else s.currentRoundP1Supports.push(pickedDef.id);
        s.logs = makeLog(
          s.logs,
          s.round,
          `${prompt.sourceCardName} (${owner.name}) meniru efek Kartu Pendukung ${pickedDef.name} dari Dek Fisik ${enemy.name}!`,
          tone
        );
        next.tableNotices.push(
          makeNotice(
            enemyIdx === 0 ? 'p1' : 'p2',
            `Meja Fisik (${enemy.name}): Masukkan kembali ${pickedDef.name} ke Dek Fisik lalu kocok Dek Fisik!`
          )
        );
        const outcome = applyPhysicalSupportEffect(next, ownerIdx, pickedDef, false);
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
      const pickedId = resolution.kind === 'PICK_CARD_ID' ? resolution.cardId : null;
      const pickedDef = pickedId ? CARD_BY_ID[pickedId] : null;
      if (pickedDef && owner.active) {
        const sourceCardDef = owner.active.def;
        s.logs = makeLog(
          s.logs,
          s.round,
          `${prompt.sourceCardName} (${owner.name}) meniru efek ${pickedDef.name} dari Dek Fisik ${enemy.name}!`,
          tone
        );
        next.tableNotices.push(
          makeNotice(
            enemyIdx === 0 ? 'p1' : 'p2',
            `Meja Fisik (${enemy.name}): Masukkan kembali ${pickedDef.name} ke Dek Fisik lalu kocok Dek Fisik!`
          )
        );
        if (pickedDef.category === CardCategory.SUPPORT) {
          const priorSupports =
            ownerIdx === 0 ? [...s.currentRoundP0Supports] : [...s.currentRoundP1Supports];
          if (ownerIdx === 0) s.currentRoundP0Supports.push(pickedDef.id);
          else s.currentRoundP1Supports.push(pickedDef.id);
          const outcome = applyPhysicalSupportEffect(next, ownerIdx, pickedDef, false);
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
          applyPhysicalEntryEffectKey(
            next,
            ownerIdx,
            pickedDef.effectKey,
            `${prompt.sourceCardName} (${pickedDef.name})`,
            instantWins
          );
        }
      }
      break;
    }

    case 'COPY_ENEMY_DECK_STATS': {
      const pickedId = resolution.kind === 'PICK_CARD_ID' ? resolution.cardId : null;
      const pickedDef = pickedId ? CARD_BY_ID[pickedId] : null;
      if (pickedDef && owner.active) {
        owner.active.currentHp = pickedDef.hp;
        owner.active.maxHp = pickedDef.hp;
        owner.active.currentAtk = pickedDef.atk;
        owner.active.baseAtk = pickedDef.atk;
        owner.active.statusNotes.push(`Tiru ${pickedDef.name} (${pickedDef.hp}/${pickedDef.atk})`);
        s.logs = makeLog(
          s.logs,
          s.round,
          `${prompt.sourceCardName} (${owner.name}) meniru HP (${pickedDef.hp}) & ATK (${pickedDef.atk}) milik ${pickedDef.name}!`,
          tone
        );
        next.tableNotices.push(
          makeNotice(
            enemyIdx === 0 ? 'p1' : 'p2',
            `Meja Fisik (${enemy.name}): Masukkan kembali ${pickedDef.name} ke Dek Fisik lalu kocok Dek Fisik!`
          )
        );
      }
      break;
    }

    case 'RETURN_ENEMY_WIN_2': {
      const uids = resolution.kind === 'PICK_WIN_ZONE_UIDS' ? new Set(resolution.uids) : new Set<string>();
      const chosen = enemy.winZone.filter((c) => uids.has(c.uid));
      if (chosen.length > 0) {
        enemy.winZone = enemy.winZone.filter((c) => !uids.has(c.uid));
        const returnedIds = new Set(chosen.map((c) => c.defId));
        next.usedCardIds[enemyIdx] = next.usedCardIds[enemyIdx].filter(
          (id) => !returnedIds.has(id)
        );
        s.logs = makeLog(
          s.logs,
          s.round,
          `${prompt.sourceCardName}: Mengembalikan ${chosen.length} kartu dari Zona Menang ${enemy.name} ke dalam Dek Fisik ${enemy.name}!`,
          'highlight'
        );
        next.tableNotices.push(
          makeNotice(
            'warning',
            `Meja Fisik (${enemy.name}): Masukkan kembali ${chosen.length} kartu yang dipilih dari Zona Menang Fisik ke dalam Dek Fisik ${enemy.name}, lalu kocok Dek Fisik!`
          )
        );
      }
      break;
    }
  }

  if (
    instantWins.size > 0 ||
    (s.players[0].active && s.players[0].active.currentHp <= 0) ||
    (s.players[1].active && s.players[1].active.currentHp <= 0)
  ) {
    next.pendingPrompts = [];
    next.pendingEntryPriority3 = false;
    return finalizePhysicalPostCheck(next, instantWins, 'PICK_SUITS', 'P1_PICK_SUIT');
  }

  if (next.pendingPrompts.length === 0 && next.pendingEntryPriority3) {
    next.pendingEntryPriority3 = false;
    runRemainingPhysicalEntryPriority3(next, instantWins);
  }

  if (next.tableNotices.length === 0 && next.pendingPrompts.length === 0) {
    next.tableNotices.push(
      makeNotice(
        'info',
        `Efek masuk selesai — Minta ${s.players[0].name} & ${s.players[1].name} membuka Kartu Suit Fisik (Air / Api / Daun) secara bersamaan!`
      )
    );
  }

  return finalizePhysicalPostCheck(next, instantWins, 'PICK_SUITS', 'P1_PICK_SUIT');
}

export function resolvePhysicalSuitClash(
  prevSession: PhysicalSimSession,
  p0Suit: SuitElement,
  p1Suit: SuitElement
): PhysicalSimSession {
  const next = cloneSession(prevSession);
  const s = next.battle;
  const p0 = s.players[0];
  const p1 = s.players[1];

  if (!p0.active || !p1.active) return prevSession;

  next.tableNotices = [];
  p0.selectedSuit = p0Suit;
  p1.selectedSuit = p1Suit;
  p0.playedSupportCard = null;
  p1.playedSupportCard = null;

  const outcome = compareSuitElements(p0Suit, p1Suit);
  s.lastSuitWinner = outcome;
  s.currentRoundSuitClashes += 1;

  // Papa Zola Tactical Suit triggers on enemy win OR draw
  for (const idx of [0, 1] as const) {
    const enemyIdx: 0 | 1 = idx === 0 ? 1 : 0;
    const owner = s.players[idx];
    const enemy = s.players[enemyIdx];
    if (owner.active?.papaZolaMillArmed && (outcome === enemyIdx || outcome === 'DRAW')) {
      enemy.loseZone.push(makeCardInstance(enemyIdx, 'bf-01-probe', 'mill'));
      s.logs = makeLog(
        s.logs,
        s.round,
        `Efek Papa Zola (${owner.name}): ${enemy.name} wajib membuang 1 kartu teratas Dek Fisik ke Zona Kalah!`,
        idx === 0 ? 'p1' : 'p2'
      );
      next.tableNotices.push(
        makeNotice(
          'warning',
          `Meja Fisik (${enemy.name}): Buang 1 kartu paling atas dari Dek Fisik ke Zona Kalah (Efek Papa Zola)!`
        )
      );
    }
  }

  if (outcome === 'DRAW') {
    s.logs = makeLog(
      s.logs,
      s.round,
      `Adu Suit Kartu Asli ke-${s.suitAttemptInRound}: ${p0Suit} vs ${p1Suit} — SERI!`,
      'warning'
    );

    for (const idx of [0, 1] as const) {
      const enemyIdx: 0 | 1 = idx === 0 ? 1 : 0;
      const owner = s.players[idx];
      const enemy = s.players[enemyIdx];
      if (owner.active?.gopalFangArmed && enemy.winZone.length > 0) {
        const removed = enemy.winZone.pop()!;
        enemy.loseZone.push(removed);
        s.logs = makeLog(
          s.logs,
          s.round,
          `Efek Gopal & Fang (${owner.name}): Menggugurkan 1 kartu dari Zona Menang ${enemy.name} ke Zona Kalah!`,
          'highlight'
        );
        next.tableNotices.push(
          makeNotice(
            'warning',
            `Meja Fisik (${enemy.name}): Pindahkan 1 kartu dari Zona Menang Fisik ke Zona Kalah (Efek Gopal & Fang)!`
          )
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
          s.logs = makeLog(
            s.logs,
            s.round,
            `Suit pertama berakhir Seri — syarat Suit pertama ${f.def.name} tidak aktif.`,
            'neutral'
          );
        }
      }
    }

    s.suitAttemptInRound += 1;
    s.phase = 'SUIT_REVEAL';
    next.step = 'PICK_SUITS';
    next.tableNotices.push(
      makeNotice(
        'info',
        `Hasil Suit SERI (${p0Suit} vs ${p1Suit})! Minta kedua pemain langsung adu Kartu Suit Fisik ulang (Adu Suit #${s.suitAttemptInRound}).`
      )
    );
    return syncHandPlaceholders(next);
  }

  const winner = s.players[outcome];
  const loserIdx: 0 | 1 = outcome === 0 ? 1 : 0;
  const loser = s.players[loserIdx];

  s.logs = makeLog(
    s.logs,
    s.round,
    `Adu Suit Kartu Asli: ${p0.name} (${p0Suit}) vs ${p1.name} (${p1Suit}) — ${winner.name} MENANG SUIT!`,
    outcome === 0 ? 'p1' : 'p2'
  );

  // Suit 1 special triggers
  if (winner.active?.yayaSuit1Armed) {
    winner.active.yayaSuit1Armed = false;
    winner.active.currentAtk += 40;
    winner.active.statusNotes.push('+40 ATK (Menang Suit 1)');
    s.logs = makeLog(
      s.logs,
      s.round,
      `Efek Yaya (${winner.name}): Menang Suit pertama! ATK naik menjadi ${winner.active.currentAtk}!`,
      outcome === 0 ? 'p1' : 'p2'
    );
  } else if (loser.active?.yayaSuit1Armed) {
    loser.active.yayaSuit1Armed = false;
  }

  if (loser.active?.gentarCounterArmed) {
    loser.active.gentarCounterArmed = false;
    loser.active.currentAtk += 160;
    loser.active.statusNotes.push('+160 ATK (Kalah Suit 1)');
    s.logs = makeLog(
      s.logs,
      s.round,
      `Efek BoBoiBoy Gentar (${loser.name}): Kalah Suit pertama! ATK melonjak menjadi ${loser.active.currentAtk}!`,
      loserIdx === 0 ? 'p1' : 'p2'
    );
  } else if (winner.active?.gentarCounterArmed) {
    winner.active.gentarCounterArmed = false;
  }

  if (loser.active?.soriCounterArmed && winner.active) {
    loser.active.soriCounterArmed = false;
    winner.active.currentHp = 40;
    winner.active.statusNotes.push('HP jadi 40 (Efek Sori)');
    s.logs = makeLog(
      s.logs,
      s.round,
      `Efek BoBoiBoy Sori (${loser.name}): Kalah Suit pertama! HP ${winner.active.def.name} ditetapkan menjadi 40!`,
      'highlight'
    );
  } else if (winner.active?.soriCounterArmed) {
    winner.active.soriCounterArmed = false;
  }

  s.phase = 'SUIT_REVEAL';
  next.step = 'PICK_SUPPORTS_AND_STRIKE';
  next.tableNotices.push(
    makeNotice(
      outcome === 0 ? 'p1' : 'p2',
      `${winner.name} Menang Suit! Tanyakan apakah ada pemain yang menurunkan Kartu Pendukung fisik sebelum ${
        winner.active?.def.name ?? 'Karakter'
      } menyerang.`
    )
  );

  return syncHandPlaceholders(next);
}

export function resolvePhysicalSupportsAndStrike(
  prevSession: PhysicalSimSession,
  p0SupportId: string | null,
  p1SupportId: string | null
): PhysicalSimSession {
  const next = cloneSession(prevSession);
  const s = next.battle;
  const p0 = s.players[0];
  const p1 = s.players[1];

  if (!p0.active || !p1.active) return prevSession;

  next.tableNotices = [];

  let def0: CardDefinition | null =
    p0SupportId && !p1.active.blockEnemySupport ? CARD_BY_ID[p0SupportId] ?? null : null;
  let def1: CardDefinition | null =
    p1SupportId && !p0.active.blockEnemySupport ? CARD_BY_ID[p1SupportId] ?? null : null;

  if (def0) {
    next.physicalHandCount[0] = Math.max(0, next.physicalHandCount[0] - 1);
    if (!next.usedCardIds[0].includes(def0.id)) {
      next.usedCardIds[0].push(def0.id);
    }
    p0.loseZone.push(makeCardInstance(0, def0.id, 'sup'));
    p0.playedSupportCard = def0;
    s.currentRoundP0Supports.push(def0.id);
  }

  if (def1) {
    next.physicalHandCount[1] = Math.max(0, next.physicalHandCount[1] - 1);
    if (!next.usedCardIds[1].includes(def1.id)) {
      next.usedCardIds[1].push(def1.id);
    }
    p1.loseZone.push(makeCardInstance(1, def1.id, 'sup'));
    p1.playedSupportCard = def1;
    s.currentRoundP1Supports.push(def1.id);
  }

  // Priority 01 Sang Buaya Cancel Check (played Support OR copied on entry)
  const p0Cancels =
    def0?.effectKey === 'SUPPORT_SANG_BUAYA_CANCEL' ||
    Boolean(def1 && p0.active.negateEnemySupport);
  const p1Cancels =
    def1?.effectKey === 'SUPPORT_SANG_BUAYA_CANCEL' ||
    Boolean(def0 && p1.active.negateEnemySupport);

  if (p0Cancels && def1) {
    const cancelSource =
      def0?.effectKey === 'SUPPORT_SANG_BUAYA_CANCEL'
        ? `${def0.name} (${p0.name})`
        : `${p0.active.def.name} (Tiru Sang Buaya)`;
    if (def0?.effectKey !== 'SUPPORT_SANG_BUAYA_CANCEL' && p0.active.negateEnemySupport) {
      p0.active.negateEnemySupport = false;
      p0.active.statusNotes = p0.active.statusNotes.filter((n) => !n.includes('Batal Pendukung'));
    }
    s.logs = makeLog(
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
        ? `${def1.name} (${p1.name})`
        : `${p1.active.def.name} (Tiru Sang Buaya)`;
    if (def1?.effectKey !== 'SUPPORT_SANG_BUAYA_CANCEL' && p1.active.negateEnemySupport) {
      p1.active.negateEnemySupport = false;
      p1.active.statusNotes = p1.active.statusNotes.filter((n) => !n.includes('Batal Pendukung'));
    }
    s.logs = makeLog(
      s.logs,
      s.round,
      `${cancelSource} membatalkan efek Kartu Pendukung ${def0.name} milik ${p0.name}!`,
      'p2'
    );
    def0 = null;
    p0.playedSupportCard = null;
  }

  const priorP0Supports = p0SupportId && !p1.active.blockEnemySupport
    ? s.currentRoundP0Supports.slice(0, -1)
    : [...s.currentRoundP0Supports];
  const priorP1Supports = p1SupportId && !p0.active.blockEnemySupport
    ? s.currentRoundP1Supports.slice(0, -1)
    : [...s.currentRoundP1Supports];
  const priorP0Mod =
    p0.active?.statusNotes.filter((n) => !n.includes('Efek Dibatalkan')).slice(-1)[0] ?? null;
  const priorP1Mod =
    p1.active?.statusNotes.filter((n) => !n.includes('Efek Dibatalkan')).slice(-1)[0] ?? null;

  for (const priority of [2, 3] as const) {
    if (def0 && (def0.effectPriority ?? 2) === priority) {
      const outcome0 = applyPhysicalSupportEffect(next, 0, def0, true);
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
      const outcome1 = applyPhysicalSupportEffect(next, 1, def1, true);
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
        s.logs = makeLog(
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
        s.logs = makeLog(
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
        s.logs = makeLog(
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
        s.logs = makeLog(
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
        s.logs = makeLog(
          s.logs,
          s.round,
          `${attacker.active.def.name} melancarkan serangan ${dmg} ATK! Sisa HP ${defender.active.def.name}: ${defender.active.currentHp}/${defender.active.maxHp}.`,
          attackerIdx === 0 ? 'p1' : 'p2'
        );
      }
    }
  }

  for (const idx of [0, 1] as const) {
    const f = s.players[idx].active;
    if (f?.blockStrikeThisClash) {
      f.blockStrikeThisClash = false;
      f.statusNotes = f.statusNotes.filter((n) => n !== 'Kepaku Park (Tangkis Bentrokan Ini)');
    }
  }

  s.suitAttemptInRound += 1;

  const checked = finalizePhysicalPostCheck(next, new Set(), 'PICK_SUITS', 'P1_PICK_SUIT');
  if (checked.step === 'PICK_SUITS') {
    checked.battle.players[0].selectedSuit = null;
    checked.battle.players[1].selectedSuit = null;
    checked.tableNotices.push(
      makeNotice(
        'info',
        `Kedua Karakter masih bertahan! Lanjutkan ke Adu Suit Fisik #${checked.battle.suitAttemptInRound}.`
      )
    );
  }

  return checked;
}

export function startNextPhysicalRound(prevSession: PhysicalSimSession): PhysicalSimSession {
  const next = cloneSession(prevSession);
  const s = next.battle;

  s.round += 1;
  s.suitAttemptInRound = 1;
  s.lastSuitWinner = null;
  s.roundSummaryText = null;
  s.phase = 'P1_PICK_CHARACTER';
  s.players[0].selectedSuit = null;
  s.players[1].selectedSuit = null;
  s.players[0].playedSupportCard = null;
  s.players[1].playedSupportCard = null;

  // Replenish physical hand counts according to official rules (up to min 4, or +1 if >= 4, max 7)
  for (const idx of [0, 1] as const) {
    const cur = next.physicalHandCount[idx];
    if (cur < 4) {
      next.physicalHandCount[idx] = 4;
    } else if (cur < 7) {
      next.physicalHandCount[idx] = cur + 1;
    }
  }

  next.step = 'PICK_CHARACTERS';
  next.pendingEntryPriority3 = false;
  next.pendingPrompts = [];
  next.tableNotices = [
    makeNotice(
      'info',
      `Ronde ${s.round} dimulai! Kedua pemain melengkapi kartu tangan dari Dek Fisik (standar 4 kartu), lalu meletakkan 1 Kartu Karakter fisik tertutup ke Zona Aktif.`
    ),
  ];
  s.logs = makeLog(
    s.logs,
    s.round,
    `Ronde ${s.round} dimulai — menunggu input Kartu Karakter asli dari ${s.players[0].name} & ${s.players[1].name}.`,
    'neutral'
  );

  return syncHandPlaceholders(next);
}

export function adjustPhysicalHandCount(
  prevSession: PhysicalSimSession,
  target: 0 | 1,
  delta: number
): PhysicalSimSession {
  const next = cloneSession(prevSession);
  next.physicalHandCount[target] = Math.max(0, Math.min(15, next.physicalHandCount[target] + delta));
  return syncHandPlaceholders(next);
}

export function adjustPhysicalFighterStat(
  prevSession: PhysicalSimSession,
  target: 0 | 1,
  stat: 'HP' | 'ATK',
  delta: number
): PhysicalSimSession {
  const next = cloneSession(prevSession);
  const s = next.battle;
  const fighter = s.players[target].active;
  if (!fighter || s.phase === 'GAME_OVER' || s.phase === 'ROUND_END') {
    return prevSession;
  }

  const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;
  if (stat === 'HP') {
    const nextHp = Math.max(0, Math.min(9999, fighter.currentHp + delta));
    fighter.currentHp = nextHp;
    if (nextHp > fighter.maxHp) {
      fighter.maxHp = nextHp;
    }
    fighter.statusNotes.push(`Host ${deltaLabel} HP`);
    s.logs = makeLog(
      s.logs,
      s.round,
      `[HOST · ${next.hostName}] Koreksi HP ${s.players[target].name} (${fighter.def.name}): ${deltaLabel} HP → ${fighter.currentHp}/${fighter.maxHp}.`,
      'highlight'
    );
    if (fighter.currentHp <= 0 && s.players[0].active && s.players[1].active) {
      return finalizePhysicalPostCheck(next, new Set(), next.step, s.phase);
    }
    return syncHandPlaceholders(next);
  }

  fighter.currentAtk = Math.max(0, Math.min(9999, fighter.currentAtk + delta));
  fighter.statusNotes.push(`Host ${deltaLabel} ATK`);
  s.logs = makeLog(
    s.logs,
    s.round,
    `[HOST · ${next.hostName}] Koreksi ATK ${s.players[target].name} (${fighter.def.name}): ${deltaLabel} ATK → ${fighter.currentAtk}.`,
    'highlight'
  );
  return syncHandPlaceholders(next);
}

export function recordPhysicalCardToZone(
  prevSession: PhysicalSimSession,
  target: 0 | 1,
  zone: 'WIN' | 'LOSE',
  cardId: string
): PhysicalSimSession {
  const def = CARD_BY_ID[cardId];
  if (!def) return prevSession;
  const next = cloneSession(prevSession);
  const s = next.battle;
  const pl = s.players[target];
  const inst = makeCardInstance(target, def.id, zone === 'WIN' ? 'hostwin' : 'hostlose');

  if (zone === 'WIN') {
    pl.winZone.push(inst);
    s.logs = makeLog(
      s.logs,
      s.round,
      `[HOST · ${next.hostName}] Mencatat kartu "${def.name}" ke Zona Menang ${pl.name}.`,
      'highlight'
    );
  } else {
    pl.loseZone.push(inst);
    if (!next.usedCardIds[target].includes(def.id)) {
      next.usedCardIds[target].push(def.id);
    }
    for (const tag of def.characterTags) {
      if (!pl.usedCharacterTags.includes(tag)) {
        pl.usedCharacterTags.push(tag);
      }
    }
    s.logs = makeLog(
      s.logs,
      s.round,
      `[HOST · ${next.hostName}] Mencatat kartu "${def.name}" ke Zona Kalah ${pl.name}.`,
      'highlight'
    );
  }

  return syncHandPlaceholders(next);
}

export function forcePhysicalRoundWinner(
  prevSession: PhysicalSimSession,
  winner: 0 | 1 | 'DRAW',
  reason?: string
): PhysicalSimSession {
  if (prevSession.step === 'GAME_OVER' || prevSession.step === 'ROUND_END') {
    return prevSession;
  }
  const next = cloneSession(prevSession);
  const s = next.battle;
  const suffix = reason?.trim() ? ` (${reason.trim()})` : '';
  const verdict =
    winner === 'DRAW'
      ? `Ronde ${s.round} dinyatakan SERI`
      : `${s.players[winner].name} dinyatakan Menang Ronde ${s.round}`;

  s.logs = makeLog(
    s.logs,
    s.round,
    `[HOST · ${next.hostName}] Keputusan Ronde: ${verdict}${suffix}.`,
    'highlight'
  );

  // Ensure both active slots exist so standard round completion records history cleanly
  for (const idx of [0, 1] as const) {
    if (!s.players[idx].active) {
      s.players[idx].active = createActiveFighter(
        makeCardInstance(idx, 'bf-01-probe', `forced-r${s.round}`)
      );
    }
  }

  if (winner === 'DRAW') {
    s.players[0].active!.currentHp = 0;
    s.players[1].active!.currentHp = 0;
  } else if (winner === 0) {
    s.players[1].active!.currentHp = 0;
  } else {
    s.players[0].active!.currentHp = 0;
  }

  return finalizePhysicalPostCheck(next, new Set(), 'PICK_SUITS', 'P1_PICK_SUIT');
}

export function declarePhysicalMatchWinner(
  prevSession: PhysicalSimSession,
  winner: 0 | 1 | 'DRAW',
  reason?: string
): PhysicalSimSession {
  const next = cloneSession(prevSession);
  const s = next.battle;
  const base =
    winner === 'DRAW'
      ? `Keputusan Resmi Host (${next.hostName}): Pertandingan Kartu Asli dinyatakan SERI!`
      : `Keputusan Resmi Host (${next.hostName}): ${s.players[winner].name} dinyatakan MENANG!`;
  const fullReason = reason?.trim() ? `${base} — ${reason.trim()}` : base;

  s.phase = 'GAME_OVER';
  s.winnerIndex = winner;
  s.winReason = fullReason;
  s.choiceQueue = [];
  s.logs = makeLog(s.logs, s.round, `[HOST · ${next.hostName}] ${fullReason}`, 'highlight');
  next.step = 'GAME_OVER';
  next.pendingPrompts = [];

  return syncHandPlaceholders(next);
}

export function addHostAnnouncement(
  prevSession: PhysicalSimSession,
  text: string
): PhysicalSimSession {
  const trimmed = text.trim();
  if (!trimmed) return prevSession;
  const next = cloneSession(prevSession);
  next.latestHostAnnouncement = {
    id: `ann-${Date.now()}`,
    hostName: next.hostName,
    text: trimmed,
    timestamp: Date.now(),
  };
  next.battle.logs = makeLog(
    next.battle.logs,
    next.battle.round,
    `[PENGUMUMAN HOST · ${next.hostName}] ${trimmed}`,
    'highlight'
  );
  return next;
}

export function togglePhysicalRule(
  prevSession: PhysicalSimSession,
  field: 'enforceUniqueCards' | 'enforceConditions'
): PhysicalSimSession {
  const next = cloneSession(prevSession);
  next[field] = !next[field];
  return next;
}
