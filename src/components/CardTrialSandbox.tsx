import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  HelpCircle,
  Lock,
  Minus,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  Unlock,
  Wand2,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  ALL_PACK_SERIES,
  BATTLE_CARDS,
  CARD_BY_ID,
  DEFAULT_SUIT_CARDS,
  EFFECT_CATALOG,
} from '../data/cards';
import {
  canPlayCharacterCard,
  compareSuitElements,
} from '../engine/battleEngine';
import {
  CardCategory,
  SuitElement,
  type ActiveFighter,
  type CardDefinition,
  type EffectKey,
} from '../types/game';
import { soundFx } from '../utils/sound';
import { CardVisual } from './CardVisual';

interface CardTrialSandboxProps {
  cardsVersion: number;
  initialFighter0CardId?: string;
  initialFighter1CardId?: string;
  onInspectCard: (card: CardDefinition) => void;
  onOpenDeckBuilder?: () => void;
  onNavigateToArena?: () => void;
}

interface SimulatedFighterState {
  def: CardDefinition;
  currentHp: number;
  maxHp: number;
  currentAtk: number;
  baseAtk: number;
  shields: number;
  reflectFirstAttack: boolean;
  effectNullified: boolean;
  soriCounterArmed: boolean;
  gentarCounterArmed: boolean;
  yayaSuit1Armed: boolean;
  papaZolaMillArmed: boolean;
  blockEnemySupport: boolean;
  statusNotes: string[];
  suit: SuitElement;
  attachedSupport: CardDefinition | null;
}

interface TrialLogEntry {
  id: string;
  timestamp: number;
  source: string;
  text: string;
  type: 'info' | 'buff' | 'damage' | 'shield' | 'clash' | 'warning';
}

const PRESET_TRIAL_SCENARIOS: Array<{
  id: string;
  name: string;
  badge: string;
  desc: string;
  f0Id: string;
  f1Id: string;
  f0Suit: SuitElement;
  f1Suit: SuitElement;
  f0SupportId?: string;
  f1SupportId?: string;
}> = [
  {
    id: 'frostfire-vs-retakka',
    name: 'BoBoiBoy FrostFire vs Retak\'ka',
    badge: 'Blazing Ice Blast',
    desc: 'Uji ledakan es dan api tingkat SR dengan perisai pertahanan tinggi.',
    f0Id: 'bf-31-boboiboy-nova',
    f1Id: 'bf-24-rosaksa-final',
    f0Suit: SuitElement.AIR,
    f1Suit: SuitElement.API,
    f0SupportId: 'bf-26-kepaku-park',
  },
  {
    id: 'super-papa-vs-sang-buaya',
    name: 'Super Papa vs Sang Buaya',
    badge: 'Kunci Pendukung',
    desc: 'Uji efek Super Papa yang mengunci Kartu Pendukung musuh & menetapkan ATK jadi 20.',
    f0Id: 'bf-41-ar-super-papa',
    f1Id: 'bf-43-sang-buaya',
    f0Suit: SuitElement.API,
    f1Suit: SuitElement.DAUN,
    f1SupportId: 'bf-22-hammer-gentar',
  },
  {
    id: 'sori-counter-vs-boss',
    name: 'BoBoiBoy Sori vs Borara',
    badge: 'Counter HP 40',
    desc: 'Uji kemampuan Sori membalikkan keadaan saat kalah suit pertama sehingga HP lawan jadi 40.',
    f0Id: 'bf-21-boboiboy-gempa',
    f1Id: 'bf-15-jeneral-cikala',
    f0Suit: SuitElement.DAUN,
    f1Suit: SuitElement.API,
  },
  {
    id: 'reramos-reflect-strike',
    name: 'Maharaja Reramos (Pantulan Serangan)',
    badge: 'Reflect Attack',
    desc: 'Uji efek pantulan serangan pertama lawan yang berbalik mengenai diri lawan sendiri.',
    f0Id: 'bf-12-maharaja-reramos',
    f1Id: 'bf-19-boboiboy-halilintar',
    f0Suit: SuitElement.DAUN,
    f1Suit: SuitElement.AIR,
    f1SupportId: 'bf-35-rockfamily',
  },
  {
    id: 'gopal-lose-zone-heal',
    name: 'Gopal (Pertukaran Makanan)',
    badge: 'Heal Scaling',
    desc: 'Uji efek penambahan HP Gopal sebanyak 20 untuk setiap kartu di Zona Kalah lawan.',
    f0Id: 'bf-30-gopal-c',
    f1Id: 'bf-03-adu-du-b',
    f0Suit: SuitElement.API,
    f1Suit: SuitElement.DAUN,
  },
  {
    id: 'yaya-suit-rush',
    name: 'Yaya Graviti (Adu Suit Beruntun)',
    badge: 'Suit ATK Boost',
    desc: 'Uji peningkatan ATK +40 jika berhasil memenangkan benturan Suit pertama.',
    f0Id: 'bf-07-yaya-suit',
    f1Id: 'bf-09-ying-b',
    f0Suit: SuitElement.API,
    f1Suit: SuitElement.DAUN,
  },
];

const COMMON_TAGS = [
  'BoBoiBoy',
  'BoBoiBoy Blaze',
  'BoBoiBoy Ais',
  'BoBoiBoy Solar',
  'BoBoiBoy Taufan',
  'BoBoiBoy Halilintar',
  'BoBoiBoy Gempa',
  'BoBoiBoy Duri',
  'Yaya',
  'Ying',
  'Gopal',
  'Fang',
  'Papa Zola',
  'Kuputeri',
  'Adu Du',
  'Probe',
];

export const CardTrialSandbox: React.FC<CardTrialSandboxProps> = ({
  cardsVersion,
  initialFighter0CardId = 'bf-31-boboiboy-nova',
  initialFighter1CardId = 'bf-19-boboiboy-halilintar',
  onInspectCard,
  onOpenDeckBuilder,
  onNavigateToArena,
}) => {
  // Fighter Definitions
  const [f0Def, setF0Def] = useState<CardDefinition>(
    () => CARD_BY_ID[initialFighter0CardId] ?? BATTLE_CARDS.find((c) => c.category === CardCategory.CHARACTER) ?? BATTLE_CARDS[0]
  );
  const [f1Def, setF1Def] = useState<CardDefinition>(
    () => CARD_BY_ID[initialFighter1CardId] ?? BATTLE_CARDS.find((c) => c.category === CardCategory.CHARACTER && c.id !== f0Def.id) ?? BATTLE_CARDS[1]
  );

  // Fighter Dynamic States
  const createInitialFighterState = (def: CardDefinition, suit: SuitElement): SimulatedFighterState => ({
    def,
    currentHp: def.hp,
    maxHp: def.hp,
    currentAtk: def.atk,
    baseAtk: def.atk,
    shields: def.effectKey === 'SHIELD_TWICE' ? 2 : def.effectKey === 'SHIELD_ONCE' ? 1 : 0,
    reflectFirstAttack: def.effectKey === 'REFLECT_FIRST_ATTACK',
    effectNullified: false,
    soriCounterArmed: def.effectKey === 'SORI_COUNTER_HP_40',
    gentarCounterArmed: def.effectKey === 'GENTAR_SUIT1_LOSE_ATK_160',
    yayaSuit1Armed: def.effectKey === 'YAYA_SUIT1_WIN_ATK_40',
    papaZolaMillArmed: def.effectKey === 'PAPA_ZOLA_SUIT_MILL_1',
    blockEnemySupport: def.effectKey === 'SUPER_PAPA_LOCK_SUPPORT_ATK_20',
    statusNotes: [],
    suit,
    attachedSupport: null,
  });

  const [f0State, setF0State] = useState<SimulatedFighterState>(() =>
    createInitialFighterState(f0Def, SuitElement.AIR)
  );
  const [f1State, setF1State] = useState<SimulatedFighterState>(() =>
    createInitialFighterState(f1Def, SuitElement.API)
  );

  // Active Tag Simulator for Testing Evolution Prerequisites
  const [simulatedTags, setSimulatedTags] = useState<string[]>(['BoBoiBoy', 'BoBoiBoy Blaze']);

  // Trial Logs
  const [trialLogs, setTrialLogs] = useState<TrialLogEntry[]>([
    {
      id: 'init-1',
      timestamp: Date.now(),
      source: 'Sistem Lab',
      text: 'Laboratorium Uji Coba Kartu & Efek siap digunakan. Pilih skenario atau konfigurasikan pertarungan Anda.',
      type: 'info',
    },
  ]);

  // Card Selector Modal
  const [selectorTarget, setSelectorTarget] = useState<'F0' | 'F1' | 'F0_SUPPORT' | 'F1_SUPPORT' | null>(null);
  const [cardSearch, setCardSearch] = useState<string>('');
  const [cardFilterCategory, setCardFilterCategory] = useState<string>('ALL');

  // Effect Catalog Search
  const [effectCatalogSearch, setEffectCatalogSearch] = useState<string>('');

  const addLog = (source: string, text: string, type: TrialLogEntry['type'] = 'info') => {
    setTrialLogs((prev) => [
      {
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        source,
        text,
        type,
      },
      ...prev.slice(0, 40),
    ]);
  };

  // Reset simulation to fresh baseline stats
  const handleResetSimulation = () => {
    soundFx.playCardSelect();
    setF0State(createInitialFighterState(f0Def, f0State.suit));
    setF1State(createInitialFighterState(f1Def, f1State.suit));
    addLog('Reset', 'Kedua petarung telah dipulihkan ke statistik bawaan kartu.', 'info');
  };

  // Load Preset Scenario
  const handleLoadScenario = (sc: (typeof PRESET_TRIAL_SCENARIOS)[0]) => {
    soundFx.playCardDeploy();
    const c0 = CARD_BY_ID[sc.f0Id] ?? f0Def;
    const c1 = CARD_BY_ID[sc.f1Id] ?? f1Def;
    setF0Def(c0);
    setF1Def(c1);

    const s0 = createInitialFighterState(c0, sc.f0Suit);
    const s1 = createInitialFighterState(c1, sc.f1Suit);

    if (sc.f0SupportId && CARD_BY_ID[sc.f0SupportId]) {
      s0.attachedSupport = CARD_BY_ID[sc.f0SupportId];
    }
    if (sc.f1SupportId && CARD_BY_ID[sc.f1SupportId]) {
      s1.attachedSupport = CARD_BY_ID[sc.f1SupportId];
    }

    setF0State(s0);
    setF1State(s1);
    addLog(
      'Skenario',
      `Skenario "${sc.name}" dimuat (${c0.name} vs ${c1.name}). ${sc.desc}`,
      'buff'
    );
  };

  // Trigger Entry Effect (Prioritas 1, 2, 3)
  const handleTriggerEntryEffect = (targetIdx: 0 | 1) => {
    const actorDef = targetIdx === 0 ? f0State.def : f1State.def;
    const enemyDef = targetIdx === 0 ? f1State.def : f0State.def;
    const actorName = actorDef.name;
    const enemyName = enemyDef.name;

    soundFx.playHit();

    if (targetIdx === 0) {
      if (f0State.effectNullified) {
        addLog(actorName, `Efek ${actorName} dibatalkan oleh nullifikasi lawan!`, 'warning');
        return;
      }
    } else {
      if (f1State.effectNullified) {
        addLog(actorName, `Efek ${actorName} dibatalkan oleh nullifikasi lawan!`, 'warning');
        return;
      }
    }

    const key = actorDef.effectKey;

    switch (key) {
      case 'NULLIFY_ENEMY_EFFECT': {
        if (targetIdx === 0) {
          setF1State((prev) => ({
            ...prev,
            effectNullified: true,
            statusNotes: [...prev.statusNotes, 'Efek Dibatalkan (Nullified)'],
          }));
        } else {
          setF0State((prev) => ({
            ...prev,
            effectNullified: true,
            statusNotes: [...prev.statusNotes, 'Efek Dibatalkan (Nullified)'],
          }));
        }
        addLog(actorName, `Membatalkan seluruh efek kartu ${enemyName} di Zona Aktif!`, 'buff');
        break;
      }

      case 'SUPER_PAPA_LOCK_SUPPORT_ATK_20': {
        if (targetIdx === 0) {
          setF0State((prev) => ({ ...prev, blockEnemySupport: true }));
          setF1State((prev) => ({
            ...prev,
            currentAtk: 20,
            statusNotes: [...prev.statusNotes, 'Terkunci: Dilarang Pakai Pendukung & ATK Jadi 20'],
          }));
        } else {
          setF1State((prev) => ({ ...prev, blockEnemySupport: true }));
          setF0State((prev) => ({
            ...prev,
            currentAtk: 20,
            statusNotes: [...prev.statusNotes, 'Terkunci: Dilarang Pakai Pendukung & ATK Jadi 20'],
          }));
        }
        addLog(
          actorName,
          `Mengunci ${enemyName}! Lawan tidak bisa menggunakan Kartu Pendukung & ATK ditetapkan menjadi 20!`,
          'buff'
        );
        break;
      }

      case 'MAMA_ZILA_ENEMY_ATK_40': {
        if (targetIdx === 0) {
          setF1State((prev) => ({
            ...prev,
            currentAtk: 40,
            statusNotes: [...prev.statusNotes, 'ATK Ditetapkan 40'],
          }));
        } else {
          setF0State((prev) => ({
            ...prev,
            currentAtk: 40,
            statusNotes: [...prev.statusNotes, 'ATK Ditetapkan 40'],
          }));
        }
        addLog(actorName, `Menetapkan nilai ATK ${enemyName} menjadi 40!`, 'buff');
        break;
      }

      case 'REFLECT_FIRST_ATTACK': {
        if (targetIdx === 0) {
          setF0State((prev) => ({
            ...prev,
            reflectFirstAttack: true,
            statusNotes: [...prev.statusNotes, 'Reflect Stance Aktif'],
          }));
        } else {
          setF1State((prev) => ({
            ...prev,
            reflectFirstAttack: true,
            statusNotes: [...prev.statusNotes, 'Reflect Stance Aktif'],
          }));
        }
        addLog(actorName, 'Memasang kuda-kuda pantulan! Serangan pertama musuh akan berbalik mengenai dirinya sendiri.', 'shield');
        break;
      }

      case 'SHIELD_TWICE': {
        if (targetIdx === 0) {
          setF0State((prev) => ({
            ...prev,
            shields: prev.shields + 2,
            statusNotes: [...prev.statusNotes, 'Perisai Ganda (+2 Kebal)'],
          }));
        } else {
          setF1State((prev) => ({
            ...prev,
            shields: prev.shields + 2,
            statusNotes: [...prev.statusNotes, 'Perisai Ganda (+2 Kebal)'],
          }));
        }
        addLog(actorName, 'Mengaktifkan Perisai Ganda! Kebal terhadap 2 serangan musuh berikutnya.', 'shield');
        break;
      }

      case 'SHIELD_ONCE': {
        if (targetIdx === 0) {
          setF0State((prev) => ({
            ...prev,
            shields: prev.shields + 1,
            statusNotes: [...prev.statusNotes, 'Perisai Tunggal (+1 Kebal)'],
          }));
        } else {
          setF1State((prev) => ({
            ...prev,
            shields: prev.shields + 1,
            statusNotes: [...prev.statusNotes, 'Perisai Tunggal (+1 Kebal)'],
          }));
        }
        addLog(actorName, 'Larian Laju! Kebal terhadap 1 serangan pertama musuh.', 'shield');
        break;
      }

      case 'GOPAL_LOSE_ZONE_HEAL_20': {
        // Assume 2 cards in lose zone for simulation
        const healAmt = 40;
        if (targetIdx === 0) {
          setF0State((prev) => ({
            ...prev,
            currentHp: prev.currentHp + healAmt,
            maxHp: prev.maxHp + healAmt,
          }));
        } else {
          setF1State((prev) => ({
            ...prev,
            currentHp: prev.currentHp + healAmt,
            maxHp: prev.maxHp + healAmt,
          }));
        }
        addLog(actorName, `Pertukaran Makanan! Memulihkan +${healAmt} HP berdasarkan kartu di Zona Kalah.`, 'buff');
        break;
      }

      case 'NOVA_WIPE_HAND_BURN_40': {
        // Assume 2 cards in hand for simulation
        const burnDmg = 80;
        if (targetIdx === 0) {
          setF1State((prev) => ({
            ...prev,
            currentHp: Math.max(0, prev.currentHp - burnDmg),
          }));
        } else {
          setF0State((prev) => ({
            ...prev,
            currentHp: Math.max(0, prev.currentHp - burnDmg),
          }));
        }
        addLog(actorName, `Api Membara! Menghanguskan kartu tangan lawan dan memberi ${burnDmg} kerusakan bakar!`, 'damage');
        break;
      }

      default: {
        addLog(
          actorName,
          `Efek Masuk "${key}" (${actorDef.effectText || 'Efek khusus'}) terpicu dan diverifikasi aktif.`,
          'info'
        );
      }
    }
  };

  // Trigger Attached Support Card
  const handleTriggerSupport = (targetIdx: 0 | 1) => {
    const actorState = targetIdx === 0 ? f0State : f1State;
    const enemyState = targetIdx === 0 ? f1State : f0State;
    const supportCard = actorState.attachedSupport;

    if (!supportCard) {
      addLog('Bantuan', 'Belum ada Kartu Pendukung yang terpasang pada petarung ini.', 'warning');
      return;
    }

    if (enemyState.blockEnemySupport) {
      addLog('Bantuan', `Gagal! ${enemyState.def.name} mengunci pemakaian Kartu Pendukung!`, 'warning');
      return;
    }

    soundFx.playCardDeploy();
    const supName = supportCard.name;
    const key = supportCard.effectKey;

    if (key === 'SUPPORT_HAMMER_GENTAR') {
      if (targetIdx === 0) {
        setF1State((prev) => ({
          ...prev,
          currentHp: Math.max(0, prev.currentHp - 40),
          currentAtk: Math.max(0, prev.currentAtk - 20),
        }));
      } else {
        setF0State((prev) => ({
          ...prev,
          currentHp: Math.max(0, prev.currentHp - 40),
          currentAtk: Math.max(0, prev.currentAtk - 20),
        }));
      }
      addLog(supName, `Hentakan Palu Gentar! Mengurangi 40 HP & 20 ATK lawan!`, 'damage');
    } else if (key === 'SUPPORT_KEPAKU_PARK') {
      if (targetIdx === 0) {
        setF0State((prev) => ({ ...prev, shields: prev.shields + 1 }));
      } else {
        setF1State((prev) => ({ ...prev, shields: prev.shields + 1 }));
      }
      addLog(supName, 'Perisai Taman Kepaku aktif! Menahan 1 serangan mematikan.', 'shield');
    } else if (key === 'SUPPORT_ROCKFAMILY_ATK_20') {
      if (targetIdx === 0) {
        setF0State((prev) => ({ ...prev, currentAtk: prev.currentAtk + 40 }));
      } else {
        setF1State((prev) => ({ ...prev, currentAtk: prev.currentAtk + 40 }));
      }
      addLog(supName, 'Keluarga Bebatu! Menambah +40 ATK petarung.', 'buff');
    } else {
      if (targetIdx === 0) {
        setF0State((prev) => ({
          ...prev,
          currentAtk: prev.currentAtk + 20,
          currentHp: prev.currentHp + 20,
        }));
      } else {
        setF1State((prev) => ({
          ...prev,
          currentAtk: prev.currentAtk + 20,
          currentHp: prev.currentHp + 20,
        }));
      }
      addLog(supName, `Dukungan taktis terpasang: +20 ATK & +20 HP!`, 'buff');
    }
  };

  // Simulate Suit Element Clash (Air vs Api vs Daun)
  const handleSimulateSuitClash = () => {
    soundFx.playCardSelect();
    const clashResult = compareSuitElements(f0State.suit, f1State.suit);

    if (clashResult === 'DRAW') {
      addLog(
        'Adu Suit',
        `Hasil Suit SERI! Kedua petarung memilih elemen ${f0State.suit}. Tidak ada penyerang di benturan ini.`,
        'clash'
      );
      if (f0State.papaZolaMillArmed || f1State.papaZolaMillArmed) {
        addLog('Papa Zola', 'Efek Taktis Papa Zola terpicu saat seri: 1 kartu teratas Dek lawan dibuang.', 'warning');
      }
    } else if (clashResult === 0) {
      soundFx.playRoundWin();
      addLog(
        'Adu Suit',
        `${f0State.def.name} (${f0State.suit}) MENANG suit atas ${f1State.def.name} (${f1State.suit})! ${f0State.def.name} memegang giliran menyerang.`,
        'buff'
      );
      if (f0State.yayaSuit1Armed) {
        setF0State((prev) => ({
          ...prev,
          currentAtk: prev.currentAtk + 40,
          yayaSuit1Armed: false,
          statusNotes: [...prev.statusNotes, 'Menang Suit: +40 ATK Permanen'],
        }));
        addLog('Yaya Graviti', 'Menang suit pertama: ATK Yaya bertambah +40!', 'buff');
      }
      if (f1State.gentarCounterArmed) {
        setF1State((prev) => ({
          ...prev,
          currentAtk: prev.currentAtk + 160,
          gentarCounterArmed: false,
          statusNotes: [...prev.statusNotes, 'Kalah Suit 1: +160 ATK Berdaya Ledak!'],
        }));
        addLog('BoBoiBoy Gentar', 'Kalah suit pertama: ATK Gentar melonjak drastis +160!', 'buff');
      }
      if (f1State.soriCounterArmed) {
        setF0State((prev) => ({
          ...prev,
          currentHp: 40,
          statusNotes: [...prev.statusNotes, 'Counter Duri: HP Ditetapkan 40!'],
        }));
        setF1State((prev) => ({ ...prev, soriCounterArmed: false }));
        addLog('BoBoiBoy Sori', `Counter Duri Sori terpicu! HP ${f0State.def.name} ditetapkan menjadi 40!`, 'damage');
      }
    } else {
      soundFx.playRoundWin();
      addLog(
        'Adu Suit',
        `${f1State.def.name} (${f1State.suit}) MENANG suit atas ${f0State.def.name} (${f0State.suit})! ${f1State.def.name} memegang giliran menyerang.`,
        'buff'
      );
      if (f1State.yayaSuit1Armed) {
        setF1State((prev) => ({
          ...prev,
          currentAtk: prev.currentAtk + 40,
          yayaSuit1Armed: false,
          statusNotes: [...prev.statusNotes, 'Menang Suit: +40 ATK Permanen'],
        }));
        addLog('Yaya Graviti', 'Menang suit pertama: ATK Yaya bertambah +40!', 'buff');
      }
      if (f0State.gentarCounterArmed) {
        setF0State((prev) => ({
          ...prev,
          currentAtk: prev.currentAtk + 160,
          gentarCounterArmed: false,
          statusNotes: [...prev.statusNotes, 'Kalah Suit 1: +160 ATK Berdaya Ledak!'],
        }));
        addLog('BoBoiBoy Gentar', 'Kalah suit pertama: ATK Gentar melonjak drastis +160!', 'buff');
      }
      if (f0State.soriCounterArmed) {
        setF1State((prev) => ({
          ...prev,
          currentHp: 40,
          statusNotes: [...prev.statusNotes, 'Counter Duri: HP Ditetapkan 40!'],
        }));
        setF0State((prev) => ({ ...prev, soriCounterArmed: false }));
        addLog('BoBoiBoy Sori', `Counter Duri Sori terpicu! HP ${f1State.def.name} ditetapkan menjadi 40!`, 'damage');
      }
    }
  };

  // Simulate Attack Strike
  const handleSimulateStrike = (attackerIdx: 0 | 1) => {
    soundFx.playHit();
    const attacker = attackerIdx === 0 ? f0State : f1State;
    const defender = attackerIdx === 0 ? f1State : f0State;
    const atkVal = attacker.currentAtk;

    if (defender.reflectFirstAttack) {
      // Reflect back to attacker
      const netDmg = atkVal;
      if (attackerIdx === 0) {
        setF0State((prev) => ({
          ...prev,
          currentHp: Math.max(0, prev.currentHp - netDmg),
        }));
        setF1State((prev) => ({ ...prev, reflectFirstAttack: false }));
      } else {
        setF1State((prev) => ({
          ...prev,
          currentHp: Math.max(0, prev.currentHp - netDmg),
        }));
        setF0State((prev) => ({ ...prev, reflectFirstAttack: false }));
      }
      addLog(
        'Reflect',
        `PANTULAN! Serangan ${atkVal} ATK dari ${attacker.def.name} dipantulkan kembali dan mengenai ${attacker.def.name} sendiri!`,
        'damage'
      );
      return;
    }

    if (defender.shields > 0) {
      if (attackerIdx === 0) {
        setF1State((prev) => ({ ...prev, shields: prev.shields - 1 }));
      } else {
        setF0State((prev) => ({ ...prev, shields: prev.shields - 1 }));
      }
      addLog(
        'Perisai',
        `Perisai ${defender.def.name} MENAHAN seluruh serangan ${atkVal} ATK! Kerusakan 0. Sisa perisai: ${defender.shields - 1}.`,
        'shield'
      );
      return;
    }

    // Direct damage
    if (attackerIdx === 0) {
      const nextHp = Math.max(0, defender.currentHp - atkVal);
      setF1State((prev) => ({ ...prev, currentHp: nextHp }));
      addLog(
        'Serangan',
        `${attacker.def.name} melancarkan ${atkVal} ATK ke ${defender.def.name}! HP berkurang dari ${defender.currentHp} menjadi ${nextHp}.`,
        'damage'
      );
      if (nextHp <= 0) {
        soundFx.playRoundWin();
        addLog('K.O.', `${defender.def.name} telah K.O. (Tumbang)! Ronde dimenangkan oleh ${attacker.def.name}!`, 'clash');
      }
    } else {
      const nextHp = Math.max(0, defender.currentHp - atkVal);
      setF0State((prev) => ({ ...prev, currentHp: nextHp }));
      addLog(
        'Serangan',
        `${attacker.def.name} melancarkan ${atkVal} ATK ke ${defender.def.name}! HP berkurang dari ${defender.currentHp} menjadi ${nextHp}.`,
        'damage'
      );
      if (nextHp <= 0) {
        soundFx.playRoundWin();
        addLog('K.O.', `${defender.def.name} telah K.O. (Tumbang)! Ronde dimenangkan oleh ${attacker.def.name}!`, 'clash');
      }
    }
  };

  // Evolution Condition Validation
  const f0ConditionStatus = useMemo(() => {
    return canPlayCharacterCard(f0Def, simulatedTags);
  }, [f0Def, simulatedTags]);

  const f1ConditionStatus = useMemo(() => {
    return canPlayCharacterCard(f1Def, simulatedTags);
  }, [f1Def, simulatedTags]);

  // Available cards for picker modal
  const selectableCards = useMemo(() => {
    return BATTLE_CARDS.filter((c) => {
      if (selectorTarget === 'F0_SUPPORT' || selectorTarget === 'F1_SUPPORT') {
        if (c.category !== CardCategory.SUPPORT) return false;
      } else {
        if (c.category !== CardCategory.CHARACTER) return false;
      }
      if (cardSearch.trim()) {
        const q = cardSearch.toLowerCase().trim();
        const mName = c.name.toLowerCase().includes(q);
        const mKey = (c.effectKey || '').toLowerCase().includes(q);
        const mTags = c.characterTags.some((t) => t.toLowerCase().includes(q));
        if (!mName && !mKey && !mTags) return false;
      }
      return true;
    });
  }, [selectorTarget, cardSearch]);

  const handleSelectCardFromPicker = (card: CardDefinition) => {
    soundFx.playCardSelect();
    if (selectorTarget === 'F0') {
      setF0Def(card);
      setF0State(createInitialFighterState(card, f0State.suit));
      addLog('Petarung 1', `Mengganti Petarung 1 menjadi ${card.name}.`, 'info');
    } else if (selectorTarget === 'F1') {
      setF1Def(card);
      setF1State(createInitialFighterState(card, f1State.suit));
      addLog('Petarung 2', `Mengganti Petarung 2 menjadi ${card.name}.`, 'info');
    } else if (selectorTarget === 'F0_SUPPORT') {
      setF0State((prev) => ({ ...prev, attachedSupport: card }));
      addLog('Bantuan P1', `Memasang Kartu Pendukung "${card.name}" pada Petarung 1.`, 'buff');
    } else if (selectorTarget === 'F1_SUPPORT') {
      setF1State((prev) => ({ ...prev, attachedSupport: card }));
      addLog('Bantuan P2', `Memasang Kartu Pendukung "${card.name}" pada Petarung 2.`, 'buff');
    }
    setSelectorTarget(null);
  };

  // Filtered Effect Catalog
  const filteredCatalog = useMemo(() => {
    if (!effectCatalogSearch.trim()) return EFFECT_CATALOG;
    const q = effectCatalogSearch.toLowerCase().trim();
    return EFFECT_CATALOG.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q) ||
        item.defaultText.toLowerCase().includes(q)
    );
  }, [effectCatalogSearch]);

  const handleLoadCardWithEffect = (key: EffectKey) => {
    const matchingCard = BATTLE_CARDS.find((c) => c.effectKey === key);
    if (matchingCard) {
      soundFx.playCardDeploy();
      setF0Def(matchingCard);
      setF0State(createInitialFighterState(matchingCard, f0State.suit));
      addLog('Katalog Efek', `Memuat kartu "${matchingCard.name}" yang memiliki efek ${key} ke Petarung 1.`, 'buff');
    } else {
      addLog('Katalog Efek', `Tidak ditemukan kartu bawaan dengan kunci ${key}.`, 'warning');
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <Wand2 className="w-4 h-4" />
            <span>LABORATORIUM & SIMULATOR TAKTIS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">
            Uji Coba Kartu & Efek
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Eksperimenkan mekanisme efek kartu, benturan suit elemen, sinergi kartu pendukung, kalkulator kerusakan, dan syarat evolusi secara interaktif sebelum bertanding di Arena sesungguhnya.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetSimulation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Simulasi</span>
          </button>

          {onNavigateToArena && (
            <button
              type="button"
              onClick={onNavigateToArena}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors shadow-lg shadow-amber-500/20"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Coba di Arena</span>
            </button>
          )}
        </div>
      </div>

      {/* PRESET SCENARIOS BAR */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 uppercase font-bold text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Skenario Uji Coba Terkenal (1-Klik Muat)
          </span>
          <span>Pilih untuk simulasi instan</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {PRESET_TRIAL_SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => handleLoadScenario(sc)}
              className="p-3 bg-[#131C31] hover:bg-[#18233D] border border-slate-800 hover:border-amber-400/60 rounded-2xl text-left transition-all group flex flex-col justify-between"
            >
              <div>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono font-bold text-amber-300 block mb-1 truncate">
                  {sc.badge}
                </span>
                <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                  {sc.name}
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mt-2 line-clamp-2 leading-tight">
                {sc.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN DUAL ARENA TESTING RING */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* FIGHTER 1 (LEFT) */}
        <div className="lg:col-span-5 bg-[#131C31] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono font-bold">
                PETARUNG 1 (UJI COBA)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFx.playCardSelect();
                setSelectorTarget('F0');
              }}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <span>Ganti Kartu</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Visual Display & Core Stats */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="shrink-0">
              <CardVisual
                card={f0Def}
                size="md"
                onClick={() => onInspectCard(f0Def)}
                onInspect={onInspectCard}
              />
            </div>

            <div className="flex-1 w-full space-y-2.5">
              <div>
                <div className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span className="truncate">{f0Def.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                    {f0Def.rank}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {f0Def.numberLabel} · Prioritas {f0Def.effectPriority ?? 2}
                </div>
              </div>

              {/* Dynamic HP Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Health Points (HP)</span>
                  <span className="font-bold text-emerald-400 tabular-nums">
                    {f0State.currentHp} / {f0State.maxHp}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#0B1120] rounded-full overflow-hidden border border-slate-700/60">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, (f0State.currentHp / (f0State.maxHp || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Dynamic ATK Indicator */}
              <div className="flex items-center justify-between text-xs font-mono bg-[#0B1120] p-2 rounded-xl border border-slate-800">
                <span className="text-slate-400">Attack Power (ATK)</span>
                <span className="text-amber-400 font-bold text-sm tabular-nums">
                  {f0State.currentAtk}{' '}
                  {f0State.currentAtk !== f0State.baseAtk && (
                    <span className="text-[10px] text-slate-500 line-through">
                      ({f0State.baseAtk})
                    </span>
                  )}
                </span>
              </div>

              {/* Active Buffs & Badges */}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {f0State.shields > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Perisai x{f0State.shields}
                  </span>
                )}
                {f0State.reflectFirstAttack && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                    🛡️ Pantulan Aktif
                  </span>
                )}
                {f0State.blockEnemySupport && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                    🚫 Kunci Pendukung
                  </span>
                )}
                {f0State.effectNullified && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                    ❌ Efek Terkunci
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Elemental Suit Selection for Fighter 1 */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono text-[11px]">Suit Elemen P1</span>
              <span className="text-amber-300 font-bold text-xs">
                {f0State.suit === SuitElement.AIR
                  ? '💧 Air / Es'
                  : f0State.suit === SuitElement.API
                  ? '🔥 Api / Petir'
                  : '🍃 Daun / Alam'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([SuitElement.AIR, SuitElement.API, SuitElement.DAUN] as const).map((el) => (
                <button
                  key={el}
                  type="button"
                  onClick={() => {
                    soundFx.playCardSelect();
                    setF0State((prev) => ({ ...prev, suit: el }));
                  }}
                  className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    f0State.suit === el
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                      : 'bg-[#0B1120] text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {el === SuitElement.AIR ? '💧 Air' : el === SuitElement.API ? '🔥 Api' : '🍃 Daun'}
                </button>
              ))}
            </div>
          </div>

          {/* Attached Support Card Slot */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] font-mono text-slate-400 block">Kartu Pendukung Terpasang:</span>
              <span className="font-semibold text-slate-200">
                {f0State.attachedSupport?.name ?? 'Belum ada kartu'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  soundFx.playCardSelect();
                  setSelectorTarget('F0_SUPPORT');
                }}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
              >
                {f0State.attachedSupport ? 'Ganti' : 'Pasang'}
              </button>
              {f0State.attachedSupport && (
                <button
                  type="button"
                  onClick={() => handleTriggerSupport(0)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                >
                  Aktifkan
                </button>
              )}
            </div>
          </div>

          {/* Action Trigger Buttons for Fighter 1 */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleTriggerEntryEffect(0)}
              className="py-2.5 px-3 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Picukan Efek Masuk</span>
            </button>
            <button
              type="button"
              onClick={() => handleSimulateStrike(0)}
              className="py-2.5 px-3 text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Serang P2 ({f0State.currentAtk} ATK)</span>
            </button>
          </div>
        </div>

        {/* CLASH COCKPIT & CONTROLS (CENTER - 2 COLS ON LG) */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center space-y-4 py-4">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center font-display font-black text-lg shadow-xl shadow-amber-500/20">
            VS
          </div>

          {/* Elemental Clash Trigger */}
          <button
            type="button"
            onClick={handleSimulateSuitClash}
            className="w-full py-3 px-3 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl transition-all shadow-lg shadow-amber-500/20 flex flex-col items-center justify-center gap-1 group"
          >
            <Flame className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Adu Suit Sekarang!</span>
          </button>

          <div className="text-[11px] font-mono text-center text-slate-400 leading-tight">
            Air &gt; Api<br />
            Api &gt; Daun<br />
            Daun &gt; Air
          </div>
        </div>

        {/* FIGHTER 2 (RIGHT) */}
        <div className="lg:col-span-5 bg-[#131C31] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-xs font-mono font-bold">
                PETARUNG 2 (LAWAN / SPARRING)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFx.playCardSelect();
                setSelectorTarget('F1');
              }}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <span>Ganti Kartu</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Visual Display & Core Stats */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="shrink-0">
              <CardVisual
                card={f1Def}
                size="md"
                onClick={() => onInspectCard(f1Def)}
                onInspect={onInspectCard}
              />
            </div>

            <div className="flex-1 w-full space-y-2.5">
              <div>
                <div className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span className="truncate">{f1Def.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                    {f1Def.rank}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {f1Def.numberLabel} · Prioritas {f1Def.effectPriority ?? 2}
                </div>
              </div>

              {/* Dynamic HP Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Health Points (HP)</span>
                  <span className="font-bold text-sky-400 tabular-nums">
                    {f1State.currentHp} / {f1State.maxHp}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#0B1120] rounded-full overflow-hidden border border-slate-700/60">
                  <div
                    className="h-full bg-sky-500 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, (f1State.currentHp / (f1State.maxHp || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Dynamic ATK Indicator */}
              <div className="flex items-center justify-between text-xs font-mono bg-[#0B1120] p-2 rounded-xl border border-slate-800">
                <span className="text-slate-400">Attack Power (ATK)</span>
                <span className="text-sky-400 font-bold text-sm tabular-nums">
                  {f1State.currentAtk}{' '}
                  {f1State.currentAtk !== f1State.baseAtk && (
                    <span className="text-[10px] text-slate-500 line-through">
                      ({f1State.baseAtk})
                    </span>
                  )}
                </span>
              </div>

              {/* Active Buffs & Badges */}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {f1State.shields > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Perisai x{f1State.shields}
                  </span>
                )}
                {f1State.reflectFirstAttack && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                    🛡️ Pantulan Aktif
                  </span>
                )}
                {f1State.blockEnemySupport && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                    🚫 Kunci Pendukung
                  </span>
                )}
                {f1State.effectNullified && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                    ❌ Efek Terkunci
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Elemental Suit Selection for Fighter 2 */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono text-[11px]">Suit Elemen P2</span>
              <span className="text-sky-300 font-bold text-xs">
                {f1State.suit === SuitElement.AIR
                  ? '💧 Air / Es'
                  : f1State.suit === SuitElement.API
                  ? '🔥 Api / Petir'
                  : '🍃 Daun / Alam'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([SuitElement.AIR, SuitElement.API, SuitElement.DAUN] as const).map((el) => (
                <button
                  key={el}
                  type="button"
                  onClick={() => {
                    soundFx.playCardSelect();
                    setF1State((prev) => ({ ...prev, suit: el }));
                  }}
                  className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    f1State.suit === el
                      ? 'bg-sky-500 text-slate-950 border-sky-400 font-black shadow-md'
                      : 'bg-[#0B1120] text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {el === SuitElement.AIR ? '💧 Air' : el === SuitElement.API ? '🔥 Api' : '🍃 Daun'}
                </button>
              ))}
            </div>
          </div>

          {/* Attached Support Card Slot for Fighter 2 */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] font-mono text-slate-400 block">Kartu Pendukung Terpasang:</span>
              <span className="font-semibold text-slate-200">
                {f1State.attachedSupport?.name ?? 'Belum ada kartu'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  soundFx.playCardSelect();
                  setSelectorTarget('F1_SUPPORT');
                }}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
              >
                {f1State.attachedSupport ? 'Ganti' : 'Pasang'}
              </button>
              {f1State.attachedSupport && (
                <button
                  type="button"
                  onClick={() => handleTriggerSupport(1)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg"
                >
                  Aktifkan
                </button>
              )}
            </div>
          </div>

          {/* Action Trigger Buttons for Fighter 2 */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleTriggerEntryEffect(1)}
              className="py-2.5 px-3 text-xs font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Picukan Efek Masuk</span>
            </button>
            <button
              type="button"
              onClick={() => handleSimulateStrike(1)}
              className="py-2.5 px-3 text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Serang P1 ({f1State.currentAtk} ATK)</span>
            </button>
          </div>
        </div>
      </div>

      {/* LOWER SECTION: EVOLUTION PREREQUISITES & LIVE LOGS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* EVOLUTION & PREREQUISITE CONDITION VALIDATOR (LEFT) */}
        <div className="lg:col-span-6 bg-[#131C31] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Unlock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Uji Syarat Evolusi & Prasyarat Kartu</h3>
              <p className="text-xs text-slate-400">
                Validasi apakah kartu bersyarat (Fusion/Tahap 2/3) siap diturunkan berdasarkan tag riwayat
              </p>
            </div>
          </div>

          {/* Active Cards Prerequisite Status */}
          <div className="space-y-3 pt-2">
            {/* Fighter 1 Condition Evaluation */}
            <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-200">Petarung 1: {f0Def.name}</span>
                {f0Def.condition ? (
                  f0ConditionStatus.playable ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Siap Dimainkan (Unconditional Ready)
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <Lock className="w-4 h-4" />
                      Terkunci (Syarat Belum Terpenuhi)
                    </span>
                  )
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Tanpa Syarat (Bebas Dipakai Ronde 1)
                  </span>
                )}
              </div>

              {f0Def.condition && (
                <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="font-mono text-amber-400 font-bold block mb-0.5">Syarat Tercetak:</span>
                  {f0Def.condition.description}
                  {!f0ConditionStatus.playable && f0ConditionStatus.reason && (
                    <div className="text-rose-300 mt-1 font-semibold">{f0ConditionStatus.reason}</div>
                  )}
                </div>
              )}
            </div>

            {/* Fighter 2 Condition Evaluation */}
            <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-200">Petarung 2: {f1Def.name}</span>
                {f1Def.condition ? (
                  f1ConditionStatus.playable ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Siap Dimainkan (Unconditional Ready)
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <Lock className="w-4 h-4" />
                      Terkunci (Syarat Belum Terpenuhi)
                    </span>
                  )
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Tanpa Syarat (Bebas Dipakai Ronde 1)
                  </span>
                )}
              </div>

              {f1Def.condition && (
                <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="font-mono text-sky-400 font-bold block mb-0.5">Syarat Tercetak:</span>
                  {f1Def.condition.description}
                  {!f1ConditionStatus.playable && f1ConditionStatus.reason && (
                    <div className="text-rose-300 mt-1 font-semibold">{f1ConditionStatus.reason}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Interactive Tag Toggles */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400 uppercase font-bold text-[10px]">
                Simulasikan Tag Karakter yang Pernah Digunakan:
              </span>
              <button
                type="button"
                onClick={() => setSimulatedTags([])}
                className="text-[10px] text-slate-400 hover:text-white"
              >
                Kosongkan
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {COMMON_TAGS.map((tag) => {
                const isSelected = simulatedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      soundFx.playCardSelect();
                      setSimulatedTags((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                      );
                    }}
                    className={`px-2.5 py-1 text-xs rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                        : 'bg-[#0B1120] hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* LIVE TRIAL LOG CONSOLE (RIGHT) */}
        <div className="lg:col-span-6 bg-[#131C31] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Log Eksekusi & Kalkulasi Lab</h3>
                <p className="text-xs text-slate-400">Catatan langsung setiap perubahan statistik dan efek</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTrialLogs([])}
              className="text-xs text-slate-500 hover:text-slate-300 font-mono"
            >
              Bersihkan Log
            </button>
          </div>

          <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4 h-[350px] overflow-y-auto space-y-2.5 text-xs font-mono pr-2">
            {trialLogs.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                Belum ada aktivitas. Picukan efek atau lakukan serangan untuk melihat log.
              </div>
            ) : (
              trialLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-[10px] text-slate-500 tabular-nums shrink-0 pt-0.5">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-800/80 text-[10px] font-bold text-slate-300 shrink-0">
                    {log.source}
                  </span>
                  <span
                    className={
                      log.type === 'buff'
                        ? 'text-emerald-300 font-medium'
                        : log.type === 'damage'
                        ? 'text-rose-300 font-medium'
                        : log.type === 'shield'
                        ? 'text-sky-300 font-medium'
                        : log.type === 'clash'
                        ? 'text-amber-300 font-bold'
                        : log.type === 'warning'
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }
                  >
                    {log.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CATALOG OF ALL OFFICIAL 44+ CARD EFFECTS EXPLORER */}
      <div className="bg-[#131C31] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Eksplorasi Seluruh {EFFECT_CATALOG.length} Jenis Efek Kartu Resmi
            </h3>
            <p className="text-xs text-slate-400">
              Jelajahi seluruh variasi efek mesin BoBoiBoy Monsta Galaxy dan uji langsung dengan 1-klik
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari efek (contoh: tutor, heal, shield)..."
              value={effectCatalogSearch}
              onChange={(e) => setEffectCatalogSearch(e.target.value)}
              className="w-full bg-[#0B1120] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
          {filteredCatalog.map((eff) => (
            <div
              key={eff.key}
              className="bg-[#0B1120] border border-slate-800/80 hover:border-slate-700 p-3.5 rounded-2xl flex flex-col justify-between text-xs space-y-2 group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-[10px] text-amber-400 font-bold truncate">
                    {eff.key}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono shrink-0">
                    P{eff.defaultPriority}
                  </span>
                </div>
                <div className="font-semibold text-white group-hover:text-amber-300 transition-colors">
                  {eff.label}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {eff.defaultText}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                  {eff.targetCategory}
                </span>
                <button
                  type="button"
                  onClick={() => handleLoadCardWithEffect(eff.key)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  <span>Uji Kartu Ini</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CARD PICKER MODAL */}
      {selectorTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectorTarget(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-[#131C31] border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {selectorTarget === 'F0'
                    ? 'Pilih Karakter Petarung 1'
                    : selectorTarget === 'F1'
                    ? 'Pilih Karakter Petarung 2'
                    : 'Pilih Kartu Pendukung'}
                </h3>
                <p className="text-xs text-slate-400">
                  Pilih kartu dari koleksi resmi maupun kartu kustom studio Anda
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectorTarget(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kartu berdasarkan nama atau tag..."
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
                className="w-full bg-[#0B1120] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Cards Grid */}
            <div className="overflow-y-auto max-h-[500px] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 p-1">
              {selectableCards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => handleSelectCardFromPicker(card)}
                  className="cursor-pointer group flex flex-col items-center p-2 rounded-2xl bg-[#0B1120] hover:bg-[#162038] border border-slate-800 hover:border-amber-400/80 transition-all"
                >
                  <CardVisual
                    card={card}
                    size="sm"
                    showCaption={false}
                    onClick={() => handleSelectCardFromPicker(card)}
                  />
                  <div className="mt-2 text-center w-full">
                    <div className="text-xs font-bold text-white truncate group-hover:text-amber-300">
                      {card.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {card.category === CardCategory.CHARACTER ? `HP ${card.hp} · ATK ${card.atk}` : 'Pendukung'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
