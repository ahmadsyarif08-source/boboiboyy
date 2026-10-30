import {
  CardCategory,
  SuitElement,
  type CardDefinition,
  type CardPackSeries,
  type DeckTargetSize,
  type EffectKey,
  type EffectPriority,
  type HologramFinish,
  type PresetDeck,
  type SavedUserDeck,
  type SuitArtSetId,
} from '../types/game.ts';

export const BRAND_LOGOS = {
  indonesia: '/assets/aistudio/imgi_1_LOGO-02-1024x578_c9282dc7.png',
  malaysia: '/assets/aistudio/imgi_2_LOGO-01-1024x578_f923ef66.png',
  malaysiaAlt: '/assets/aistudio/imgi_63_LOGO-01_f3991af9.png',
};

export const DEFAULT_SUIT_CARDS: CardDefinition[] = [
  {
    id: 'suit-46-air',
    numberLabel: '46/54',
    name: 'Suit Air (Blizzard)',
    category: CardCategory.SUIT,
    rank: 'SUIT',
    image: '/assets/aistudio/imgi_105_46_afb41230.jpg',
    hp: 0,
    atk: 0,
    effectText: 'Elemen Air mengalahkan Api, kalah terhadap Daun.',
    characterTags: [],
    effectKey: 'NONE',
    suitElement: SuitElement.AIR,
    suitArtSet: 1,
  },
  {
    id: 'suit-47-api',
    numberLabel: '47/54',
    name: 'Suit Api (Nova)',
    category: CardCategory.SUIT,
    rank: 'SUIT',
    image: '/assets/aistudio/imgi_106_47_c2832194.jpg',
    hp: 0,
    atk: 0,
    effectText: 'Elemen Api mengalahkan Daun, kalah terhadap Air.',
    characterTags: [],
    effectKey: 'NONE',
    suitElement: SuitElement.API,
    suitArtSet: 1,
  },
  {
    id: 'suit-48-daun',
    numberLabel: '48/54',
    name: 'Suit Daun (Rimba)',
    category: CardCategory.SUIT,
    rank: 'SUIT',
    image: '/assets/aistudio/imgi_107_48_d40e710e.jpg',
    hp: 0,
    atk: 0,
    effectText: 'Elemen Daun mengalahkan Air, kalah terhadap Api.',
    characterTags: [],
    effectKey: 'NONE',
    suitElement: SuitElement.DAUN,
    suitArtSet: 1,
  },
  {
    id: 'suit-49-air',
    numberLabel: '49/54',
    name: 'Suit Air (Meriam Beku)',
    category: CardCategory.SUIT,
    rank: 'SUIT',
    image: '/assets/aistudio/imgi_52_49_a164306f.jpg',
    hp: 0,
    atk: 0,
    effectText: 'Elemen Air mengalahkan Api, kalah terhadap Daun.',
    characterTags: [],
    effectKey: 'NONE',
    suitElement: SuitElement.AIR,
    suitArtSet: 2,
  },
  {
    id: 'suit-50-api',
    numberLabel: '50/54',
    name: 'Suit Api (Tinju Bara)',
    category: CardCategory.SUIT,
    rank: 'SUIT',
    image: '/assets/aistudio/imgi_108_50_794241b4.jpg',
    hp: 0,
    atk: 0,
    effectText: 'Elemen Api mengalahkan Daun, kalah terhadap Air.',
    characterTags: [],
    effectKey: 'NONE',
    suitElement: SuitElement.API,
    suitArtSet: 2,
  },
  {
    id: 'suit-51-daun',
    numberLabel: '51/54',
    name: 'Suit Daun (Angin Rimba)',
    category: CardCategory.SUIT,
    rank: 'SUIT',
    image: '/assets/aistudio/imgi_109_51_420d931d.jpg',
    hp: 0,
    atk: 0,
    effectText: 'Elemen Daun mengalahkan Air, kalah terhadap Api.',
    characterTags: [],
    effectKey: 'NONE',
    suitElement: SuitElement.DAUN,
    suitArtSet: 2,
  },
  {
    id: 'suit-52-air',
    numberLabel: '52/54',
    name: 'Suit Air (Ais Artik)',
    category: CardCategory.SUIT,
    rank: 'SUIT',
    image: '/assets/aistudio/imgi_110_52_1da200d9.jpg',
    hp: 0,
    atk: 0,
    effectText: 'Elemen Air mengalahkan Api, kalah terhadap Daun.',
    characterTags: [],
    effectKey: 'NONE',
    suitElement: SuitElement.AIR,
    suitArtSet: 3,
  },
  {
    id: 'suit-53-api',
    numberLabel: '53/54',
    name: 'Suit Api (Hantaman Api)',
    category: CardCategory.SUIT,
    rank: 'SUIT',
    image: '/assets/aistudio/imgi_111_53_371ac948.jpg',
    hp: 0,
    atk: 0,
    effectText: 'Elemen Api mengalahkan Daun, kalah terhadap Air.',
    characterTags: [],
    effectKey: 'NONE',
    suitElement: SuitElement.API,
    suitArtSet: 3,
  },
  {
    id: 'suit-54-daun',
    numberLabel: '54/54',
    name: 'Suit Daun (Tebasan Daun)',
    category: CardCategory.SUIT,
    rank: 'SUIT',
    image: '/assets/aistudio/imgi_112_54_e55f48e9.jpg',
    hp: 0,
    atk: 0,
    effectText: 'Elemen Daun mengalahkan Air, kalah terhadap Api.',
    characterTags: [],
    effectKey: 'NONE',
    suitElement: SuitElement.DAUN,
    suitArtSet: 3,
  },
];

export const DEFAULT_BATTLE_CARDS: CardDefinition[] = [
  {
    id: 'bf-01-probe',
    numberLabel: '1/54',
    name: 'Probe',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_65_01_1ffc3fa6.jpg',
    hp: 100,
    atk: 80,
    effectPriority: 3,
    effectText: 'Serangan pertama lawan tidak efektif.',
    characterTags: ['Probe'],
    effectKey: 'SHIELD_ONCE',
  },
  {
    id: 'bf-02-alpha-tumbosaur',
    numberLabel: '2/54',
    name: 'Alpha Tumbosaur',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_66_02-1_28f2e1a9.jpg',
    hp: 180,
    atk: 100,
    effectPriority: 1,
    effectText: 'Efek kartu lawan tidak efektif.',
    characterTags: ['Alpha Tumbosaur'],
    effectKey: 'NULLIFY_ENEMY_EFFECT',
  },
  {
    id: 'bf-03-adu-du-b',
    numberLabel: '3/54',
    name: 'Adu Du',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_67_03_419804fe.jpg',
    hp: 120,
    atk: 80,
    effectPriority: 3,
    effectText: 'Pilih 1 kartu dari tangan lawan dan letakkan di Zona Kalah.',
    characterTags: ['Adu Du'],
    effectKey: 'BLIND_DISCARD_ENEMY_HAND_1',
  },
  {
    id: 'bf-04-boboiboy-solar',
    numberLabel: '4/54',
    name: 'BoBoiBoy Solar',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_7_04_f709612d.jpg',
    hp: 140,
    atk: 120,
    effectPriority: 2,
    effectText: 'Ambil kartu BoBoiBoy Duri dari Dek dan letakkan di tangan.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Solar'],
    effectKey: 'TUTOR_DURI',
  },
  {
    id: 'bf-05-boboiboy-sori',
    numberLabel: '5/54',
    name: 'BoBoiBoy Sori',
    category: CardCategory.CHARACTER,
    rank: 'A',
    image: '/assets/aistudio/imgi_68_05_280c0d1b.jpg',
    hp: 260,
    atk: 200,
    effectPriority: 3,
    effectText: 'Jika kalah dalam Suit pertama, tetapkan HP kartu lawan menjadi 40.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Sori'],
    condition: {
      mode: 'ALL',
      requiredTags: ['BoBoiBoy Solar', 'BoBoiBoy Duri'],
      description: 'Pernah menggunakan kartu jenis BoBoiBoy Solar & BoBoiBoy Duri',
    },
    effectKey: 'SORI_COUNTER_HP_40',
  },
  {
    id: 'bf-06-boboiboy-duri',
    numberLabel: '6/54',
    name: 'BoBoiBoy Duri',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_69_06_ea5f3312.jpg',
    hp: 140,
    atk: 100,
    effectPriority: 2,
    effectText: 'Ambil kartu BoBoiBoy Solar dari Dek dan letakkan di tangan.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Duri'],
    effectKey: 'TUTOR_SOLAR',
  },
  {
    id: 'bf-07-yaya-suit',
    numberLabel: '7/54',
    name: 'Yaya (Graviti)',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_70_07_21adaa5b.jpg',
    hp: 120,
    atk: 120,
    effectPriority: 2,
    effectText: 'ATK +40 jika menang Suit pertama (ATK menjadi 160 selama kartu berada di Zona Aktif).',
    characterTags: ['Yaya'],
    effectKey: 'YAYA_SUIT1_WIN_ATK_40',
  },
  {
    id: 'bf-09-ying-b',
    numberLabel: '9/54',
    name: 'Ying (Larian Laju)',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_72_09_bdc9103d.jpg',
    hp: 120,
    atk: 140,
    effectPriority: 3,
    effectText: 'Larian Laju! Serangan pertama lawan tidak efektif.',
    characterTags: ['Ying'],
    effectKey: 'SHIELD_ONCE',
  },
  {
    id: 'bf-10-kuputeri',
    numberLabel: '10/54',
    name: 'Kuputeri',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_73_10_237dedc0.jpg',
    hp: 100,
    atk: 80,
    effectPriority: 3,
    effectText: 'Serangan pihak lawan tidak efektif sebanyak dua kali.',
    characterTags: ['Kuputeri'],
    effectKey: 'SHIELD_TWICE',
  },
  {
    id: 'bf-11-boboiboy-taufan',
    numberLabel: '11/54',
    name: 'BoBoiBoy Taufan',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_74_11_3541d5fc.jpg',
    hp: 120,
    atk: 100,
    effectPriority: 3,
    effectText: 'Lihat tangan pihak lawan, pilih 3 kartu, dan kembalikan kartu tersebut ke dalam Dek pihak lawan.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Taufan'],
    effectKey: 'RETURN_ENEMY_HAND_3_TO_DECK',
  },
  {
    id: 'bf-12-maharaja-reramos',
    numberLabel: '12/54',
    name: 'Maharaja Reramos',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_75_12_ac27bc2f.jpg',
    hp: 120,
    atk: 80,
    effectPriority: 3,
    effectText: 'Serangan pertama pihak lawan terkena pada diri sendiri. Efek ini tetap berterusan jika terjadi seri pada Suit pertama.',
    characterTags: ['Maharaja Reramos'],
    effectKey: 'REFLECT_FIRST_ATTACK',
  },
  {
    id: 'bf-13-maripos',
    numberLabel: '13/54',
    name: 'Maripos',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_16_13_7ea07e69.jpg',
    hp: 140,
    atk: 120,
    effectPriority: 2,
    effectText: 'ATK dan HP +60 jika kartu Kuputeri ada di tangan.',
    characterTags: ['Maripos'],
    effectKey: 'MARIPOS_KUPUTERI_BUFF',
  },
  {
    id: 'bf-14-boboiboy-beliung',
    numberLabel: '14/54',
    name: 'BoBoiBoy Beliung',
    category: CardCategory.CHARACTER,
    rank: 'A',
    image: '/assets/aistudio/imgi_76_18_8588b93b.jpg',
    hp: 260,
    atk: 200,
    effectPriority: 2,
    effectText: 'Otomatis Menang jika kartu Kuputeri berada di Zona Menang atau Zona Kalah.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Beliung'],
    condition: {
      mode: 'ALL',
      requiredTags: ['BoBoiBoy Taufan'],
      description: 'Pernah menggunakan kartu jenis BoBoiBoy Taufan',
    },
    effectKey: 'BELIUNG_AUTO_WIN_KUPUTERI',
  },
  {
    id: 'bf-15-jeneral-cikala',
    numberLabel: '15/54',
    name: 'Jeneral Cikala',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_77_14_e5ddb19f.jpg',
    hp: 140,
    atk: 100,
    effectPriority: 2,
    effectText: 'Ambil 2 kartu dari atas Dek dan letakkan di tangan.',
    characterTags: ['Jeneral Cikala'],
    effectKey: 'DRAW_2',
  },
  {
    id: 'bf-16-yaya-ying',
    numberLabel: '16/54',
    name: 'Yaya & Ying',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_78_15_e4845edc.jpg',
    hp: 160,
    atk: 120,
    effectPriority: 2,
    effectText: 'Tiru satu Efek dari kartu Pendukung yang ada di Dek pihak lawan dan aktifkan Efek tersebut. Lawan mengocok kembali Dek mereka.',
    characterTags: ['Yaya', 'Ying', 'Yaya & Ying'],
    condition: {
      mode: 'ANY',
      requiredTags: ['Yaya', 'Ying'],
      description: 'Pernah menggunakan kartu jenis Yaya atau Ying',
    },
    effectKey: 'COPY_ENEMY_DECK_SUPPORT',
  },
  {
    id: 'bf-17-adu-du-c',
    numberLabel: '17/54',
    name: 'Adu Du (Mecha)',
    category: CardCategory.CHARACTER,
    rank: 'C',
    image: '/assets/aistudio/imgi_79_16_396eed63.jpg',
    hp: 120,
    atk: 100,
    effectPriority: 2,
    effectText: 'Ambil 3 kartu dari atas Dek dan letakkan di tangan.',
    characterTags: ['Adu Du'],
    effectKey: 'DRAW_3',
  },
  {
    id: 'bf-18-gopal-fang',
    numberLabel: '18/54',
    name: 'Gopal & Fang',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_80_17_441b411a.jpg',
    hp: 180,
    atk: 140,
    effectPriority: 3,
    effectText: 'Pindahkan 1 kartu dari Zona Menang pihak lawan ke Zona Kalah setiap kali kartu ini Seri dalam Suit.',
    characterTags: ['Gopal', 'Fang', 'Gopal & Fang'],
    condition: {
      mode: 'ANY',
      requiredTags: ['Fang', 'Gopal'],
      description: 'Pernah menggunakan kartu jenis Fang atau Gopal',
    },
    effectKey: 'GOPAL_FANG_DRAW_STEAL_WIN',
  },
  {
    id: 'bf-19-boboiboy-halilintar',
    numberLabel: '19/54',
    name: 'BoBoiBoy Halilintar',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_81_19_d94204a0.jpg',
    hp: 100,
    atk: 120,
    effectPriority: 1,
    effectText: 'Efek kartu lawan tidak efektif.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Halilintar'],
    effectKey: 'NULLIFY_ENEMY_EFFECT',
  },
  {
    id: 'bf-20-adu-du-probe',
    numberLabel: '20/54',
    name: 'Adu Du & Probe',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_82_20_70fb0660.jpg',
    hp: 140,
    atk: 100,
    effectPriority: 3,
    effectText: 'Lihat tangan pihak lawan, pilih 1 kartu, dan letakkan kartu tersebut di Zona Kalah pihak lawan.',
    characterTags: ['Adu Du', 'Probe', 'Adu Du & Probe'],
    effectKey: 'DISCARD_ENEMY_HAND_1',
  },
  {
    id: 'bf-21-boboiboy-gempa',
    numberLabel: '21/54',
    name: 'BoBoiBoy Gempa',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_83_21_8875d0b1.jpg',
    hp: 140,
    atk: 120,
    effectPriority: 1,
    effectText: 'Efek kartu lawan tidak efektif.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Gempa'],
    effectKey: 'NULLIFY_ENEMY_EFFECT',
  },
  {
    id: 'bf-22-hammer-gentar',
    numberLabel: '22/54',
    name: 'Hammer Gentar',
    category: CardCategory.SUPPORT,
    rank: 'SUPPORT',
    image: '/assets/aistudio/imgi_25_22_701be019.jpg',
    hp: 0,
    atk: 0,
    effectPriority: 3,
    effectText: 'Serap Energi Lawan! Atur HP dan ATK kartu di Zona Aktif lawan menjadi 40.',
    characterTags: [],
    effectKey: 'SUPPORT_HAMMER_GENTAR',
  },
  {
    id: 'bf-23-boboiboy-gentar',
    numberLabel: '23/54',
    name: 'BoBoiBoy Gentar',
    category: CardCategory.CHARACTER,
    rank: 'A',
    image: '/assets/aistudio/imgi_84_23_de9226e9.jpg',
    hp: 220,
    atk: 100,
    effectPriority: 2,
    effectText: 'ATK +160 jika Kalah dalam Suit pertama.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Gentar'],
    condition: {
      mode: 'ALL',
      requiredTags: ['BoBoiBoy Gempa', 'BoBoiBoy Halilintar'],
      description: 'Pernah menggunakan kartu BoBoiBoy Gempa & BoBoiBoy Halilintar',
    },
    effectKey: 'GENTAR_SUIT1_LOSE_ATK_160',
  },
  {
    id: 'bf-24-rosaksa-final',
    numberLabel: '24/54',
    name: 'Rosaksa (Final Form)',
    category: CardCategory.CHARACTER,
    rank: 'A',
    image: '/assets/aistudio/imgi_85_24_c43db065.jpg',
    hp: 220,
    atk: 180,
    effectPriority: 2,
    effectText: 'Lihat Dek pihak lawan, pilih 1 kartu, dan tiru Efek kartu tersebut.',
    characterTags: ['Rosaksa'],
    condition: {
      mode: 'ALL',
      requiredTags: ['Rosaksa'],
      description: 'Pernah menggunakan kartu Rosaksa (atau panggil via BoBoiBoy & Gopal)',
    },
    effectKey: 'ROSAKSA_COPY_ENEMY_DECK_EFFECT',
  },
  {
    id: 'bf-25-tok-aba',
    numberLabel: '25/54',
    name: 'Tok Aba',
    category: CardCategory.CHARACTER,
    rank: 'C',
    image: '/assets/aistudio/imgi_86_25_02d1b72c.jpg',
    hp: 40,
    atk: 20,
    effectPriority: 2,
    effectText: 'Otomatis Menang jika kartu di Zona Aktif pihak lawan adalah kartu jenis BoBoiBoy.',
    characterTags: ['Tok Aba'],
    effectKey: 'TOK_ABA_AUTO_WIN_BOBOIBOY',
  },
  {
    id: 'bf-26-kepaku-park',
    numberLabel: '26/54',
    name: 'Kepaku Park',
    category: CardCategory.SUPPORT,
    rank: 'SUPPORT',
    image: '/assets/aistudio/imgi_87_26_c4a196cf.jpg',
    hp: 0,
    atk: 0,
    effectPriority: 3,
    effectText: 'Serangan pihak lawan tidak efektif.',
    characterTags: [],
    effectKey: 'SUPPORT_KEPAKU_PARK',
  },
  {
    id: 'bf-27-gopal-qually',
    numberLabel: '27/54',
    name: 'Gopal & Qually',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_88_27_20b6e878.jpg',
    hp: 140,
    atk: 80,
    effectPriority: 2,
    effectText: 'Pilih 1 kartu dari Dek dan letakkan di tangan. Kocok kembali Dek setelah kartu dipilih.',
    characterTags: ['Gopal', 'Qually', 'Gopal & Qually'],
    effectKey: 'TUTOR_ANY_FROM_DECK',
  },
  {
    id: 'bf-28-ying-c',
    numberLabel: '28/54',
    name: 'Ying (Intai Dek)',
    category: CardCategory.CHARACTER,
    rank: 'C',
    image: '/assets/aistudio/imgi_89_28_ae712419.jpg',
    hp: 80,
    atk: 60,
    effectPriority: 2,
    effectText: 'Ying berlari ke Dek pihak lawan. Pilih 1 kartu dari Dek lawan dan tiru HP serta ATK kartu tersebut.',
    characterTags: ['Ying'],
    effectKey: 'YING_COPY_ENEMY_DECK_STATS',
  },
  {
    id: 'bf-29-yaya-hantaman',
    numberLabel: '29/54',
    name: 'Yaya (Hantaman Kuat)',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_90_29_330af51b.jpg',
    hp: 100,
    atk: 120,
    effectPriority: 3,
    effectText: 'Hantaman Kuat! Hitung jumlah kartu di tangan lawan, lalu kurangi HP sebanyak 20 untuk setiap kartu tersebut.',
    characterTags: ['Yaya'],
    effectKey: 'YAYA_HAND_BURN_20',
  },
  {
    id: 'bf-30-gopal-c',
    numberLabel: '30/54',
    name: 'Gopal',
    category: CardCategory.CHARACTER,
    rank: 'C',
    image: '/assets/aistudio/imgi_91_30_00748344.jpg',
    hp: 80,
    atk: 80,
    effectPriority: 2,
    effectText: 'Pertukaran Makanan! Hitung jumlah kartu di Zona Kalah lawan, tambah HP Gopal sebanyak 20 untuk setiap kartu yang ada.',
    characterTags: ['Gopal'],
    effectKey: 'GOPAL_LOSE_ZONE_HEAL_20',
  },
  {
    id: 'bf-31-boboiboy-nova',
    numberLabel: '31/54',
    name: 'BoBoiBoy Nova',
    category: CardCategory.CHARACTER,
    rank: 'S',
    image: '/assets/aistudio/imgi_34_31_b64ca956.jpg',
    hp: 300,
    atk: 260,
    effectPriority: 3,
    effectText: 'Api Membara! Buang semua kartu di tangan lawan dan letakkan di Zona Kalah. Kurangi HP lawan sebanyak 40 untuk setiap kartu yang dibuang.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Nova'],
    condition: {
      mode: 'ALL',
      requiredTags: ['BoBoiBoy Blaze'],
      description: 'Pernah menggunakan kartu jenis BoBoiBoy Blaze',
    },
    effectKey: 'NOVA_WIPE_HAND_BURN_40',
  },
  {
    id: 'bf-32-solar-taufan',
    numberLabel: '32/54',
    name: 'BoBoiBoy Solar & Taufan',
    category: CardCategory.CHARACTER,
    rank: 'A',
    image: '/assets/aistudio/imgi_92_32_18b63ad2.jpg',
    hp: 180,
    atk: 140,
    effectPriority: 2,
    effectText: 'Ambil kartu jenis BoBoiBoy Sopan dari Dek dan letakkan di tangan.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Solar', 'BoBoiBoy Taufan', 'BoBoiBoy Solar & Taufan'],
    effectKey: 'TUTOR_SOPAN',
  },
  {
    id: 'bf-32-sr-boboiboy-sopan',
    numberLabel: '32/54 SR',
    name: 'BoBoiBoy Sopan',
    category: CardCategory.CHARACTER,
    rank: 'SR',
    image: '/assets/aistudio/imgi_114_SR_215e69fc.jpg',
    hp: 240,
    atk: 220,
    effectPriority: 3,
    effectText: 'Kembalikan Kemenangan! Ambil 2 kartu dari Zona Menang lawan dan masukkan kembali ke dalam Dek lawan.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Sopan'],
    condition: {
      mode: 'ALL',
      requiredTags: ['BoBoiBoy Solar', 'BoBoiBoy Taufan'],
      description: 'Pernah menggunakan kartu jenis BoBoiBoy Solar & BoBoiBoy Taufan',
    },
    effectKey: 'SOPAN_RETURN_ENEMY_WIN_2',
  },
  {
    id: 'bf-33-boboiboy-blizzard',
    numberLabel: '33/54',
    name: 'BoBoiBoy Blizzard',
    category: CardCategory.CHARACTER,
    rank: 'S',
    image: '/assets/aistudio/imgi_93_33_8bafd51d.jpg',
    hp: 300,
    atk: 260,
    effectPriority: 3,
    effectText: 'Buang semua kartu di tangan lawan dan letakkan di Zona Kalah. Kurangi ATK lawan sebanyak 40 untuk setiap kartu yang dibuang.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Blizzard'],
    condition: {
      mode: 'ALL',
      requiredTags: ['BoBoiBoy Ais'],
      description: 'Pernah menggunakan kartu jenis BoBoiBoy Ais',
    },
    effectKey: 'BLIZZARD_WIPE_HAND_DRAIN_ATK_40',
  },
  {
    id: 'bf-34-boboiboy-blaze',
    numberLabel: '34/54',
    name: 'BoBoiBoy Blaze',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_94_34_31348601.jpg',
    hp: 140,
    atk: 120,
    effectPriority: 3,
    effectText: 'Cakra Api! Lihat kartu di tangan lawan, pilih 1 kartu, dan letakkan di Zona Kalah.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Blaze'],
    effectKey: 'DISCARD_ENEMY_HAND_1',
  },
  {
    id: 'bf-35-rockfamily',
    numberLabel: '35/54',
    name: 'Rockfamily',
    category: CardCategory.SUPPORT,
    rank: 'SUPPORT',
    image: '/assets/aistudio/imgi_95_35_e340e645.jpg',
    hp: 0,
    atk: 0,
    effectPriority: 2,
    effectText: 'Hitung jumlah kartu di tangan lawan, ATK +20 untuk setiap kartu yang ada di tangan lawan.',
    characterTags: [],
    effectKey: 'SUPPORT_ROCKFAMILY_ATK_20',
  },
  {
    id: 'bf-36-boboiboy-ais',
    numberLabel: '36/54',
    name: 'BoBoiBoy Ais',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_96_36_2598c8db.jpg',
    hp: 140,
    atk: 120,
    effectPriority: 1,
    effectText: 'Efek kartu lawan tidak efektif.',
    characterTags: ['BoBoiBoy', 'BoBoiBoy Ais'],
    effectKey: 'NULLIFY_ENEMY_EFFECT',
  },
  {
    id: 'bf-37-kachax',
    numberLabel: '37/54',
    name: 'Kachax',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_97_37_46569dfb.jpg',
    hp: 140,
    atk: 100,
    effectPriority: 2,
    effectText: 'ATK +20 untuk setiap Kartu Pendukung yang berada di Zona Kalah pemain.',
    characterTags: ['Kachax'],
    effectKey: 'KACHAX_SUPPORT_GRAVE_ATK_20',
  },
  {
    id: 'bf-38-mama-zila',
    numberLabel: '38/54',
    name: 'Mama Zila',
    category: CardCategory.CHARACTER,
    rank: 'A',
    image: '/assets/aistudio/imgi_98_38_198e6541.jpg',
    hp: 200,
    atk: 180,
    effectPriority: 3,
    effectText: 'ATK kartu lawan menjadi 40.',
    characterTags: ['Mama Zila'],
    condition: {
      mode: 'ALL',
      requiredTags: ['Mama Zila'],
      description: 'Pernah menggunakan kartu jenis Mama Zila (atau panggil via BoBoiBoy & Gopal)',
    },
    effectKey: 'MAMA_ZILA_ENEMY_ATK_40',
  },
  {
    id: 'bf-39-yon-b',
    numberLabel: '39/54',
    name: 'Yon B',
    category: CardCategory.CHARACTER,
    rank: 'C',
    image: '/assets/aistudio/imgi_99_39_0a4582d0.jpg',
    hp: 100,
    atk: 120,
    effectPriority: 2,
    effectText: 'Pilih 1 Kartu Pendukung atau Kartu Pendukung (Abadi) dari Deck, lalu tambahkan ke tangan.',
    characterTags: ['Yon B'],
    effectKey: 'TUTOR_SUPPORT_FROM_DECK',
  },
  {
    id: 'bf-40-pipi-zola',
    numberLabel: '40/54',
    name: 'Pipi Zola',
    category: CardCategory.CHARACTER,
    rank: 'B',
    image: '/assets/aistudio/imgi_43_40_c895e3e7.jpg',
    hp: 40,
    atk: 20,
    effectPriority: 2,
    effectText: 'Otomatis Menang jika kartu jenis Papa Zola / Mama Zila berada di Zona Kalah / Menang.',
    characterTags: ['Pipi Zola'],
    effectKey: 'PIPI_ZOLA_AUTO_WIN',
  },
  {
    id: 'bf-41-papa-zola-tactical',
    numberLabel: '41/54',
    name: 'Papa Zola (Tactical Suit)',
    category: CardCategory.CHARACTER,
    rank: 'A',
    image: '/assets/aistudio/imgi_100_41_0d0dae31.jpg',
    hp: 160,
    atk: 140,
    effectPriority: 3,
    effectText: 'Setiap kali lawan menang atau seri dalam Suit, pindahkan 1 kartu dari Dek lawan ke Zona Kalah.',
    characterTags: ['Papa Zola', 'Papa Zola (Tidak Bersyarat)'],
    effectKey: 'PAPA_ZOLA_SUIT_MILL_1',
  },
  {
    id: 'bf-41-ar-super-papa',
    numberLabel: '41/54 AR',
    name: 'Papa Zola (Super Papa)',
    category: CardCategory.CHARACTER,
    rank: 'AR',
    image: '/assets/aistudio/imgi_113_AR_ca661f93.jpg',
    hp: 200,
    atk: 200,
    effectPriority: 3,
    effectText: 'Lawan tidak dapat menggunakan Kartu Pendukung & tetapkan ATK kartu lawan menjadi 20.',
    characterTags: ['Papa Zola', 'Super Papa'],
    condition: {
      mode: 'ALL',
      requiredTags: ['Papa Zola (Tidak Bersyarat)'],
      description: 'Pernah menggunakan kartu Papa Zola (Tidak Bersyarat)',
    },
    effectKey: 'SUPER_PAPA_LOCK_SUPPORT_ATK_20',
  },
  {
    id: 'bf-42-otoi',
    numberLabel: '42/54',
    name: 'Otoi',
    category: CardCategory.CHARACTER,
    rank: 'A',
    image: '/assets/aistudio/imgi_101_42_e378339a.jpg',
    hp: 40,
    atk: 20,
    effectPriority: 2,
    effectText: 'Otomatis Menang jika kartu jenis Pipi Zola berada di Zona Kalah / Menang.',
    characterTags: ['Otoi'],
    effectKey: 'OTOI_AUTO_WIN',
  },
  {
    id: 'bf-43-sang-buaya',
    numberLabel: '43/54',
    name: 'Sang Buaya',
    category: CardCategory.SUPPORT,
    rank: 'SUPPORT',
    image: '/assets/aistudio/imgi_102_43_e685042c.jpg',
    hp: 0,
    atk: 0,
    effectPriority: 1,
    effectText: 'Efek Kartu Pendukung lawan tidak aktif.',
    characterTags: [],
    effectKey: 'SUPPORT_SANG_BUAYA_CANCEL',
  },
  {
    id: 'bf-44-boboiboy-gopal',
    numberLabel: '44/54',
    name: 'BoBoiBoy & Gopal',
    category: CardCategory.CHARACTER,
    rank: 'A',
    image: '/assets/aistudio/imgi_103_44_9ceb964c.jpg',
    hp: 140,
    atk: 120,
    effectPriority: 2,
    effectText: 'Tukarkan kartu di Zona Aktif dengan 1 kartu bersyarat apa pun dari Dek, lalu aktifkan efek kartu tersebut.',
    characterTags: ['BoBoiBoy', 'Gopal', 'BoBoiBoy & Gopal'],
    effectKey: 'BOBOIBOY_GOPAL_SWAP_CONDITIONAL',
  },
  {
    id: 'bf-45-operatif-papa',
    numberLabel: '45/54',
    name: 'Operatif P.A.P.A',
    category: CardCategory.SUPPORT,
    rank: 'SUPPORT',
    image: '/assets/aistudio/imgi_104_45_c3ac62d7.jpg',
    hp: 0,
    atk: 0,
    effectPriority: 2,
    effectText: 'Ambil 2 kartu dari atas dek dan letakkan di tangan.',
    characterTags: [],
    effectKey: 'DRAW_2',
  },
];

const CUSTOM_CARDS_STORAGE_KEY = 'mgc_custom_uploaded_cards_v1';
const EDITED_CARDS_STORAGE_KEY = 'mgc_edited_card_overrides_v1';
const CUSTOM_PACK_SERIES_STORAGE_KEY = 'mgc_custom_pack_series_v1';
const EDITED_PACK_SERIES_STORAGE_KEY = 'mgc_edited_pack_series_v1';
const PACK_COLLECTION_STORAGE_KEY = 'mgc_pack_collection_unlocked_v1';
const SAVED_DECKS_STORAGE_KEY = 'mgc_saved_decks_list_v1';

export const DEFAULT_PACK_SERIES: CardPackSeries[] = [
  {
    id: 'pek-blazing-frost',
    codePrefix: 'BF',
    name: 'Pek Blazing Frost',
    editionLabel: 'Seri Utama 01 · Edisi Lengkap',
    description:
      'Edisi resmi lengkap Monsta Galaxy Card Pek Blazing Frost berisi 42 Karakter, 5 Kartu Pendukung, dan 9 Kartu Suit termasuk kartu langka SR BoBoiBoy Sopan dan AR Super Papa.',
    coverCardId: 'bf-31-boboiboy-nova',
    showcaseCardIds: [
      'bf-31-boboiboy-nova',
      'bf-33-boboiboy-blizzard',
      'bf-32-sr-boboiboy-sopan',
    ],
    accentTheme: 'amber',
    cardsPerBooster: 6,
    cardIds: [
      ...DEFAULT_BATTLE_CARDS.map((c) => c.id),
      ...DEFAULT_SUIT_CARDS.map((c) => c.id),
    ],
    isBuiltIn: true,
  },
  {
    id: 'pek-kuasa-elemental',
    codePrefix: 'ELM',
    name: 'Pek Kuasa Elemental & Fusion',
    editionLabel: 'Seri Tematik 02 · Koleksi Elemen',
    description:
      'Seri pek fokus penguasa elemen tahap kedua dan Fusion BoBoiBoy: Solar, Duri, Sori, Taufan, Beliung, Gempa, Halilintar, Gentar, Blaze, Nova, Ais, Blizzard, serta SR Sopan.',
    coverCardId: 'bf-32-sr-boboiboy-sopan',
    showcaseCardIds: [
      'bf-32-sr-boboiboy-sopan',
      'bf-05-boboiboy-sori',
      'bf-23-boboiboy-gentar',
    ],
    accentTheme: 'sky',
    cardsPerBooster: 6,
    cardIds: [
      'bf-04-boboiboy-solar',
      'bf-05-boboiboy-sori',
      'bf-06-boboiboy-duri',
      'bf-11-boboiboy-taufan',
      'bf-14-boboiboy-beliung',
      'bf-19-boboiboy-halilintar',
      'bf-21-boboiboy-gempa',
      'bf-22-hammer-gentar',
      'bf-23-boboiboy-gentar',
      'bf-31-boboiboy-nova',
      'bf-32-solar-taufan',
      'bf-32-sr-boboiboy-sopan',
      'bf-33-boboiboy-blizzard',
      'bf-34-boboiboy-blaze',
      'bf-35-rockfamily',
      'bf-36-boboiboy-ais',
      'bf-44-boboiboy-gopal',
      'bf-07-yaya-suit',
      'bf-09-ying-b',
      'bf-16-yaya-ying',
      'bf-28-ying-c',
      'bf-29-yaya-hantaman',
    ],
    isBuiltIn: true,
  },
  {
    id: 'pek-legenda-windara',
    codePrefix: 'WND',
    name: 'Pek Legenda Windara & Kosmik',
    editionLabel: 'Seri Tematik 03 · Perisai & Gangguan',
    description:
      'Seri pek pejuang Planet Windara, Gurunda, dan armada Adu Du: Kuputeri, Maripos, Maharaja Reramos, Jeneral Cikala, Alpha Tumbosaur, Rosaksa Final Form, dan Sang Buaya.',
    coverCardId: 'bf-10-kuputeri',
    showcaseCardIds: [
      'bf-10-kuputeri',
      'bf-12-maharaja-reramos',
      'bf-24-rosaksa-final',
    ],
    accentTheme: 'emerald',
    cardsPerBooster: 6,
    cardIds: [
      'bf-01-probe',
      'bf-02-alpha-tumbosaur',
      'bf-03-adu-du-b',
      'bf-10-kuputeri',
      'bf-11-boboiboy-taufan',
      'bf-12-maharaja-reramos',
      'bf-13-maripos',
      'bf-14-boboiboy-beliung',
      'bf-15-jeneral-cikala',
      'bf-17-adu-du-c',
      'bf-20-adu-du-probe',
      'bf-24-rosaksa-final',
      'bf-26-kepaku-park',
      'bf-37-kachax',
      'bf-39-yon-b',
      'bf-43-sang-buaya',
      'bf-45-operatif-papa',
    ],
    isBuiltIn: true,
  },
  {
    id: 'pek-kebenaran-papa',
    codePrefix: 'PAPA',
    name: 'Pek Kebenaran P.A.P.A & Bumi',
    editionLabel: 'Seri Tematik 04 · Taktik Otomatis Menang',
    description:
      'Seri pek taktis berisi keluarga Kapten Papa Zola, Tok Aba, Gopal, Qually, dan sekutu Bumi dengan mekanisme Otomatis Menang dan pengunci Kartu Pendukung lawan.',
    coverCardId: 'bf-41-ar-super-papa',
    showcaseCardIds: [
      'bf-41-ar-super-papa',
      'bf-40-pipi-zola',
      'bf-25-tok-aba',
    ],
    accentTheme: 'rose',
    cardsPerBooster: 6,
    cardIds: [
      'bf-41-ar-super-papa',
      'bf-41-papa-zola-tactical',
      'bf-38-mama-zila',
      'bf-40-pipi-zola',
      'bf-42-otoi',
      'bf-25-tok-aba',
      'bf-44-boboiboy-gopal',
      'bf-27-gopal-qually',
      'bf-30-gopal-c',
      'bf-18-gopal-fang',
      'bf-45-operatif-papa',
      'bf-39-yon-b',
      'bf-07-yaya-suit',
      'bf-29-yaya-hantaman',
      'bf-09-ying-b',
      'bf-28-ying-c',
      'bf-16-yaya-ying',
      'bf-26-kepaku-park',
    ],
    isBuiltIn: true,
  },
  {
    id: 'pek-kreasi-pemain',
    codePrefix: 'KST',
    name: 'Pek Kreasi Studio Pemain',
    editionLabel: 'Seri Kustom · Kartu Upload & Editan',
    description:
      'Seri khusus yang menampung seluruh kartu hasil upload gambar (termasuk Kartu Suit baru) maupun kartu modifikasi pemain dari Studio Kartu.',
    coverCardId: 'bf-31-boboiboy-nova',
    showcaseCardIds: [
      'bf-31-boboiboy-nova',
      'bf-41-ar-super-papa',
      'bf-32-sr-boboiboy-sopan',
    ],
    accentTheme: 'amber',
    cardsPerBooster: 6,
    cardIds: [],
    isBuiltIn: true,
  },
];

const BUILT_IN_BY_ID: Record<string, CardDefinition> = Object.fromEntries(
  [...DEFAULT_BATTLE_CARDS, ...DEFAULT_SUIT_CARDS].map((c) => [
    c.id,
    { ...c, packSeriesId: c.packSeriesId ?? 'pek-blazing-frost' },
  ])
);

const BUILT_IN_PACK_SERIES_BY_ID: Record<string, CardPackSeries> = Object.fromEntries(
  DEFAULT_PACK_SERIES.map((p) => [p.id, { ...p, isBuiltIn: true }])
);

function loadStoredCustomCards(): CardDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CARDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadStoredEditedMap(): Record<string, CardDefinition> {
  try {
    const raw = localStorage.getItem(EDITED_CARDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadStoredCustomPackSeries(): CardPackSeries[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PACK_SERIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadStoredEditedPackSeriesMap(): Record<string, CardPackSeries> {
  try {
    const raw = localStorage.getItem(EDITED_PACK_SERIES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadStoredUnlockedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PACK_COLLECTION_STORAGE_KEY);
    if (!raw) {
      // Seed initial starter collection with core Rank C & B starter cards + Suits
      const starter = [
        ...DEFAULT_SUIT_CARDS.map((c) => c.id),
        'bf-01-probe',
        'bf-03-adu-du-b',
        'bf-04-boboiboy-solar',
        'bf-06-boboiboy-duri',
        'bf-07-yaya-suit',
        'bf-09-ying-b',
        'bf-11-boboiboy-taufan',
        'bf-19-boboiboy-halilintar',
        'bf-21-boboiboy-gempa',
        'bf-30-gopal-c',
        'bf-34-boboiboy-blaze',
        'bf-36-boboiboy-ais',
      ];
      return new Set(starter);
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function persistUnlockedIds(set: Set<string>): void {
  try {
    localStorage.setItem(PACK_COLLECTION_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage error
  }
}

let customCardsStore: CardDefinition[] = loadStoredCustomCards();
let editedCardsStore: Record<string, CardDefinition> = loadStoredEditedMap();
let customPackSeriesStore: CardPackSeries[] = loadStoredCustomPackSeries();
let editedPackSeriesStore: Record<string, CardPackSeries> = loadStoredEditedPackSeriesMap();
let unlockedCollectionSet: Set<string> = loadStoredUnlockedIds();

export const SUIT_CARDS: CardDefinition[] = [];
export const BATTLE_CARDS: CardDefinition[] = [];
export const ALL_CARDS: CardDefinition[] = [];
export const CARD_BY_ID: Record<string, CardDefinition> = {};
export const ALL_PACK_SERIES: CardPackSeries[] = [];
export const PACK_SERIES_BY_ID: Record<string, CardPackSeries> = {};

let sessionSyncedCards: Record<string, CardDefinition> = {};

export function inferEffectFromCardText(
  effectText: string,
  category: CardCategory
): { effectKey: EffectKey; priority: EffectPriority } | null {
  const t = (effectText || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return null;

  if (category === CardCategory.SUPPORT) {
    if (
      t.includes('membatalkan efek kartu pendukung') ||
      t.includes('batalkan efek kartu pendukung') ||
      t.includes('batal kartu sokongan')
    ) {
      return { effectKey: 'SUPPORT_SANG_BUAYA_CANCEL', priority: 1 };
    }
    if (
      (t.includes('hp') && t.includes('atk') && t.includes('40')) ||
      t.includes('hammer gentar')
    ) {
      return { effectKey: 'SUPPORT_HAMMER_GENTAR', priority: 3 };
    }
    if (
      (t.includes('atk') && t.includes('20') && t.includes('tangan')) ||
      t.includes('rockfamily')
    ) {
      return { effectKey: 'SUPPORT_ROCKFAMILY_ATK_20', priority: 2 };
    }
    if ((t.includes('ambil 2 kartu') || t.includes('tarik 2 kartu')) && t.includes('dek')) {
      return { effectKey: 'DRAW_2', priority: 2 };
    }
    if (t.includes('serangan') && t.includes('tidak efektif')) {
      return { effectKey: 'SUPPORT_KEPAKU_PARK', priority: 3 };
    }
    return null;
  }

  if (category !== CardCategory.CHARACTER) {
    return null;
  }

  if ((t.includes('efek kartu') || t.includes('kesan kad')) && t.includes('tidak efektif')) {
    return { effectKey: 'NULLIFY_ENEMY_EFFECT', priority: 1 };
  }

  if (t.includes('otomatis menang') || t.includes('menang automatik')) {
    if (t.includes('papa zola') || t.includes('mama zila')) {
      return { effectKey: 'PIPI_ZOLA_AUTO_WIN', priority: 2 };
    }
    if (t.includes('pipi zola')) {
      return { effectKey: 'OTOI_AUTO_WIN', priority: 2 };
    }
    if (t.includes('kuputeri')) {
      return { effectKey: 'BELIUNG_AUTO_WIN_KUPUTERI', priority: 2 };
    }
    if (t.includes('boboiboy')) {
      return { effectKey: 'TOK_ABA_AUTO_WIN_BOBOIBOY', priority: 2 };
    }
  }

  if (
    t.includes('zona menang') &&
    (t.includes('dek lawan') || t.includes('kembalikan kemenangan') || t.includes('masukkan kembali'))
  ) {
    return { effectKey: 'SOPAN_RETURN_ENEMY_WIN_2', priority: 3 };
  }

  if (t.includes('seri') && t.includes('suit') && t.includes('zona menang')) {
    return { effectKey: 'GOPAL_FANG_DRAW_STEAL_WIN', priority: 3 };
  }

  if (t.includes('suit') && t.includes('dek') && t.includes('zona kalah')) {
    return { effectKey: 'PAPA_ZOLA_SUIT_MILL_1', priority: 3 };
  }

  if (t.includes('tukarkan') && t.includes('bersyarat')) {
    return { effectKey: 'BOBOIBOY_GOPAL_SWAP_CONDITIONAL', priority: 2 };
  }

  if (t.includes('boboiboy duri') && t.includes('dek')) {
    return { effectKey: 'TUTOR_DURI', priority: 2 };
  }
  if (t.includes('boboiboy solar') && t.includes('dek')) {
    return { effectKey: 'TUTOR_SOLAR', priority: 2 };
  }
  if (t.includes('boboiboy sopan') && t.includes('dek')) {
    return { effectKey: 'TUTOR_SOPAN', priority: 2 };
  }

  if (t.includes('dek') && t.includes('lawan') && t.includes('pendukung') && t.includes('tiru')) {
    return { effectKey: 'COPY_ENEMY_DECK_SUPPORT', priority: 2 };
  }
  if (
    t.includes('dek') &&
    t.includes('lawan') &&
    t.includes('hp') &&
    t.includes('atk') &&
    t.includes('tiru')
  ) {
    return { effectKey: 'YING_COPY_ENEMY_DECK_STATS', priority: 2 };
  }
  if (t.includes('dek') && t.includes('lawan') && t.includes('tiru')) {
    return { effectKey: 'ROSAKSA_COPY_ENEMY_DECK_EFFECT', priority: 2 };
  }

  if (
    (t.includes('pilih 1 kartu pendukung') || t.includes('ambil 1 kartu pendukung')) &&
    t.includes('dek')
  ) {
    return { effectKey: 'TUTOR_SUPPORT_FROM_DECK', priority: 2 };
  }
  if (
    (t.includes('pilih 1 kartu') || t.includes('1 kartu apa saja') || t.includes('1 kartu bebas')) &&
    t.includes('dek') &&
    t.includes('tangan')
  ) {
    return { effectKey: 'TUTOR_ANY_FROM_DECK', priority: 2 };
  }

  if ((t.includes('ambil 3 kartu') || t.includes('tarik 3 kartu')) && t.includes('dek')) {
    return { effectKey: 'DRAW_3', priority: 2 };
  }
  if ((t.includes('ambil 2 kartu') || t.includes('tarik 2 kartu')) && t.includes('dek')) {
    return { effectKey: 'DRAW_2', priority: 2 };
  }

  if (t.includes('kuputeri') && t.includes('tangan') && t.includes('60')) {
    return { effectKey: 'MARIPOS_KUPUTERI_BUFF', priority: 2 };
  }
  if (t.includes('pendukung') && t.includes('zona kalah') && t.includes('atk') && t.includes('20')) {
    return { effectKey: 'KACHAX_SUPPORT_GRAVE_ATK_20', priority: 2 };
  }
  if (t.includes('zona kalah') && t.includes('hp') && t.includes('20')) {
    return { effectKey: 'GOPAL_LOSE_ZONE_HEAL_20', priority: 2 };
  }

  if (t.includes('kalah') && t.includes('suit pertama') && t.includes('hp') && t.includes('40')) {
    return { effectKey: 'SORI_COUNTER_HP_40', priority: 3 };
  }
  if (t.includes('kalah') && t.includes('suit pertama') && t.includes('160')) {
    return { effectKey: 'GENTAR_SUIT1_LOSE_ATK_160', priority: 2 };
  }
  if (t.includes('menang') && t.includes('suit pertama') && t.includes('40')) {
    return { effectKey: 'YAYA_SUIT1_WIN_ATK_40', priority: 2 };
  }

  if (
    (t.includes('semua kartu') || t.includes('seluruh kartu')) &&
    t.includes('tangan') &&
    t.includes('40') &&
    (t.includes('atk') || t.includes('kurangi atk'))
  ) {
    return { effectKey: 'BLIZZARD_WIPE_HAND_DRAIN_ATK_40', priority: 3 };
  }
  if (
    (t.includes('semua kartu') || t.includes('seluruh kartu')) &&
    t.includes('tangan') &&
    t.includes('40')
  ) {
    return { effectKey: 'NOVA_WIPE_HAND_BURN_40', priority: 3 };
  }
  if (t.includes('tangan lawan') && t.includes('20') && (t.includes('hp') || t.includes('kerusakan'))) {
    return { effectKey: 'YAYA_HAND_BURN_20', priority: 3 };
  }
  if (t.includes('tangan') && t.includes('3 kartu') && t.includes('dek')) {
    return { effectKey: 'RETURN_ENEMY_HAND_3_TO_DECK', priority: 3 };
  }
  if (t.includes('tangan') && t.includes('1 kartu') && t.includes('zona kalah')) {
    if (t.includes('lihat')) {
      return { effectKey: 'DISCARD_ENEMY_HAND_1', priority: 3 };
    }
    return { effectKey: 'BLIND_DISCARD_ENEMY_HAND_1', priority: 3 };
  }

  if (
    t.includes('pendukung') &&
    t.includes('atk') &&
    t.includes('20') &&
    (t.includes('tidak dapat') || t.includes('tidak bisa'))
  ) {
    return { effectKey: 'SUPER_PAPA_LOCK_SUPPORT_ATK_20', priority: 3 };
  }
  if (
    t.includes('atk') &&
    t.includes('lawan') &&
    t.includes('40') &&
    (t.includes('tetapkan') || t.includes('menjadi 40') || t.includes('jadi 40'))
  ) {
    return { effectKey: 'MAMA_ZILA_ENEMY_ATK_40', priority: 3 };
  }

  if (
    t.includes('serangan pertama') &&
    (t.includes('diri sendiri') ||
      t.includes('dirinya sendiri') ||
      t.includes('berbalik') ||
      t.includes('pantul'))
  ) {
    return { effectKey: 'REFLECT_FIRST_ATTACK', priority: 3 };
  }
  if (
    t.includes('serangan') &&
    t.includes('tidak efektif') &&
    (t.includes('dua kali') || t.includes('2 kali'))
  ) {
    return { effectKey: 'SHIELD_TWICE', priority: 3 };
  }
  if (t.includes('serangan pertama') && t.includes('tidak efektif')) {
    return { effectKey: 'SHIELD_ONCE', priority: 3 };
  }

  return null;
}

function normalizeBattleCardEffects(card: CardDefinition, builtInBase?: CardDefinition): CardDefinition {
  let next = { ...card };

  // Migrate stale localStorage overrides for 3/54 Adu Du & 32/54 SR BoBoiBoy Sopan
  if (
    builtInBase?.id === 'bf-03-adu-du-b' &&
    next.effectKey === 'DISCARD_ENEMY_HAND_1' &&
    !next.effectText.toLowerCase().includes('lihat')
  ) {
    next = { ...next, effectKey: 'BLIND_DISCARD_ENEMY_HAND_1' };
  }
  if (
    builtInBase?.id === 'bf-32-sr-boboiboy-sopan' &&
    next.effectKey === 'SOPAN_RETURN_ENEMY_WIN_2' &&
    next.effectText.toLowerCase().includes('zona kalah')
  ) {
    next = { ...next, effectText: builtInBase.effectText };
  }

  // Heal custom/uploaded cards whose printed text matched a formerly missing catalog EffectKey
  if (
    next.isCustom &&
    (next.effectKey === 'SHIELD_ONCE' || next.effectKey === 'SUPPORT_KEPAKU_PARK')
  ) {
    const inferred = inferEffectFromCardText(next.effectText, next.category);
    if (inferred && inferred.effectKey !== next.effectKey) {
      next = {
        ...next,
        effectKey: inferred.effectKey,
        effectPriority: inferred.priority,
      };
    }
  }

  return next;
}

function rebuildLiveRegistries(): void {
  const nextSuits: CardDefinition[] = [
    ...DEFAULT_SUIT_CARDS.map((c) => {
      const resolved = sessionSyncedCards[c.id] ?? editedCardsStore[c.id] ?? c;
      return {
        ...resolved,
        category: CardCategory.SUIT,
        rank: 'SUIT' as const,
        suitArtSet: resolved.suitArtSet ?? c.suitArtSet ?? 1,
        packSeriesId: resolved.packSeriesId ?? 'pek-blazing-frost',
      };
    }),
    ...customCardsStore
      .filter((c) => c.category === CardCategory.SUIT)
      .map((c) => {
        const resolved = sessionSyncedCards[c.id] ?? c;
        return {
          ...resolved,
          category: CardCategory.SUIT,
          rank: 'SUIT' as const,
          isCustom: true,
          suitArtSet: Math.max(1, Math.floor(Number(resolved.suitArtSet) || 4)),
          packSeriesId: resolved.packSeriesId ?? 'pek-kreasi-pemain',
        };
      }),
  ];

  const existingSuitIds = new Set(nextSuits.map((c) => c.id));
  for (const synced of Object.values(sessionSyncedCards)) {
    if (!existingSuitIds.has(synced.id) && synced.category === CardCategory.SUIT) {
      nextSuits.push({
        ...synced,
        category: CardCategory.SUIT,
        rank: 'SUIT',
        isCustom: true,
        suitArtSet: Math.max(1, Math.floor(Number(synced.suitArtSet) || 4)),
        packSeriesId: synced.packSeriesId ?? 'pek-kreasi-pemain',
      });
      existingSuitIds.add(synced.id);
    }
  }

  const nextBattles = [
    ...DEFAULT_BATTLE_CARDS.map((c) => {
      const resolved = normalizeBattleCardEffects(
        sessionSyncedCards[c.id] ?? editedCardsStore[c.id] ?? c,
        c
      );
      return { ...resolved, packSeriesId: resolved.packSeriesId ?? 'pek-blazing-frost' };
    }),
    ...customCardsStore
      .filter((c) => c.category !== CardCategory.SUIT)
      .map((c) => {
        const resolved = normalizeBattleCardEffects({
          ...(sessionSyncedCards[c.id] ?? c),
          isCustom: true,
        });
        return {
          ...resolved,
          isCustom: true,
          packSeriesId: resolved.packSeriesId ?? 'pek-kreasi-pemain',
        };
      }),
  ];

  const existingBattleIds = new Set(nextBattles.map((c) => c.id));
  for (const synced of Object.values(sessionSyncedCards)) {
    if (!existingBattleIds.has(synced.id) && synced.category !== CardCategory.SUIT) {
      const resolved = normalizeBattleCardEffects({ ...synced, isCustom: true });
      nextBattles.push({
        ...resolved,
        isCustom: true,
        packSeriesId: resolved.packSeriesId ?? 'pek-kreasi-pemain',
      });
      existingBattleIds.add(resolved.id);
    }
  }

  SUIT_CARDS.splice(0, SUIT_CARDS.length, ...nextSuits);
  BATTLE_CARDS.splice(0, BATTLE_CARDS.length, ...nextBattles);
  ALL_CARDS.splice(0, ALL_CARDS.length, ...nextBattles, ...nextSuits);

  for (const key of Object.keys(CARD_BY_ID)) {
    delete CARD_BY_ID[key];
  }
  for (const card of ALL_CARDS) {
    CARD_BY_ID[card.id] = card;
  }

  const nextPacks = [
    ...DEFAULT_PACK_SERIES.map((basePack) => {
      const override = editedPackSeriesStore[basePack.id];
      if (!override) return { ...basePack, isBuiltIn: true };
      return {
        ...basePack,
        ...override,
        id: basePack.id,
        isBuiltIn: true,
      };
    }),
    ...customPackSeriesStore.map((p) => ({
      ...p,
      isBuiltIn: false,
    })),
  ];
  ALL_PACK_SERIES.splice(0, ALL_PACK_SERIES.length, ...nextPacks);

  for (const key of Object.keys(PACK_SERIES_BY_ID)) {
    delete PACK_SERIES_BY_ID[key];
  }
  for (const pack of ALL_PACK_SERIES) {
    PACK_SERIES_BY_ID[pack.id] = pack;
  }
}

rebuildLiveRegistries();

export function cardBelongsToPackSeries(card: CardDefinition, packId: string): boolean {
  if (!packId || packId === 'ALL') return true;
  const pack = PACK_SERIES_BY_ID[packId];
  if (packId === 'pek-kreasi-pemain') {
    const inExplicitList = Boolean(pack?.cardIds && pack.cardIds.includes(card.id));
    if (editedPackSeriesStore[packId] && pack?.cardIds && pack.cardIds.length > 0) {
      return Boolean(
        inExplicitList ||
          card.packSeriesId === 'pek-kreasi-pemain' ||
          card.isCustom
      );
    }
    return Boolean(
      inExplicitList ||
        card.packSeriesId === 'pek-kreasi-pemain' ||
        card.isCustom ||
        editedCardsStore[card.id]
    );
  }
  if (!pack) return card.packSeriesId === packId;

  // If this built-in pack was customized by the user, honor its edited cardIds list + explicit custom card assignments
  if (editedPackSeriesStore[packId] && Array.isArray(pack.cardIds)) {
    const explicitlyAssignedToPack =
      (card.isCustom && card.packSeriesId === packId) ||
      editedCardsStore[card.id]?.packSeriesId === packId;
    return pack.cardIds.includes(card.id) || explicitlyAssignedToPack;
  }

  if (card.packSeriesId === packId) return true;
  if (pack.cardIds && pack.cardIds.includes(card.id)) return true;
  return false;
}

export function getCardsForPackSeries(
  packId: string,
  includeSuits = true
): CardDefinition[] {
  const source = includeSuits ? ALL_CARDS : BATTLE_CARDS;
  if (!packId || packId === 'ALL') return [...source];
  return source.filter((card) => cardBelongsToPackSeries(card, packId));
}

export function getPrimaryPackSeriesForCard(card: CardDefinition): CardPackSeries {
  if (card.packSeriesId && PACK_SERIES_BY_ID[card.packSeriesId]) {
    return PACK_SERIES_BY_ID[card.packSeriesId];
  }
  if (card.isCustom) {
    return PACK_SERIES_BY_ID['pek-kreasi-pemain'] ?? DEFAULT_PACK_SERIES[0];
  }
  return DEFAULT_PACK_SERIES[0];
}

export function isBuiltInPackSeries(packId: string): boolean {
  return Boolean(BUILT_IN_PACK_SERIES_BY_ID[packId]);
}

export function isPackSeriesModified(packId: string): boolean {
  return Boolean(editedPackSeriesStore[packId]);
}

export function getDefaultPackSeries(packId: string): CardPackSeries | null {
  return BUILT_IN_PACK_SERIES_BY_ID[packId] ?? null;
}

export function upsertPackSeries(
  pack: CardPackSeries
): { ok: boolean; error?: string } {
  try {
    const builtInBase = BUILT_IN_PACK_SERIES_BY_ID[pack.id];
    const normalized: CardPackSeries = {
      ...pack,
      isBuiltIn: Boolean(builtInBase),
      cardsPerBooster: Math.min(10, Math.max(3, Number(pack.cardsPerBooster) || 6)),
      cardIds: Array.from(new Set(pack.cardIds ?? [])),
      showcaseCardIds: Array.from(new Set(pack.showcaseCardIds ?? [])).slice(0, 3),
    };

    if (builtInBase) {
      const nextEdited = { ...editedPackSeriesStore, [normalized.id]: normalized };
      localStorage.setItem(EDITED_PACK_SERIES_STORAGE_KEY, JSON.stringify(nextEdited));
      editedPackSeriesStore = nextEdited;
    } else {
      const nextList = [...customPackSeriesStore];
      const idx = nextList.findIndex((p) => p.id === normalized.id);
      if (idx >= 0) {
        nextList[idx] = normalized;
      } else {
        nextList.push(normalized);
      }
      localStorage.setItem(CUSTOM_PACK_SERIES_STORAGE_KEY, JSON.stringify(nextList));
      customPackSeriesStore = nextList;
    }
    rebuildLiveRegistries();
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Penyimpanan lokal penuh. Gunakan ukuran sampul yang lebih kecil.',
    };
  }
}

export function upsertCustomPackSeries(
  pack: CardPackSeries
): { ok: boolean; error?: string } {
  return upsertPackSeries(pack);
}

export function resetPackSeriesToDefault(packId: string): void {
  if (!editedPackSeriesStore[packId]) return;
  const nextEdited = { ...editedPackSeriesStore };
  delete nextEdited[packId];
  try {
    localStorage.setItem(EDITED_PACK_SERIES_STORAGE_KEY, JSON.stringify(nextEdited));
  } catch {
    // Ignore storage error
  }
  editedPackSeriesStore = nextEdited;
  rebuildLiveRegistries();
}

export function deleteCustomPackSeries(packId: string): void {
  if (DEFAULT_PACK_SERIES.some((p) => p.id === packId)) return;
  customPackSeriesStore = customPackSeriesStore.filter((p) => p.id !== packId);
  try {
    localStorage.setItem(
      CUSTOM_PACK_SERIES_STORAGE_KEY,
      JSON.stringify(customPackSeriesStore)
    );
  } catch {
    // Ignore storage error
  }

  // Reassign any custom cards pointing to deleted pack back to 'pek-kreasi-pemain'
  let cardsChanged = false;
  customCardsStore = customCardsStore.map((c) => {
    if (c.packSeriesId === packId) {
      cardsChanged = true;
      return { ...c, packSeriesId: 'pek-kreasi-pemain' };
    }
    return c;
  });
  if (cardsChanged) {
    try {
      localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(customCardsStore));
    } catch {
      // Ignore storage error
    }
  }
  rebuildLiveRegistries();
}

export function getUnlockedCollectionIds(): Set<string> {
  // Custom uploaded cards are automatically unlocked in the player's album
  const combined = new Set(unlockedCollectionSet);
  for (const c of customCardsStore) {
    combined.add(c.id);
  }
  return combined;
}

export function unlockAllCollectionCards(): void {
  for (const c of ALL_CARDS) {
    unlockedCollectionSet.add(c.id);
  }
  persistUnlockedIds(unlockedCollectionSet);
}

export function resetUnlockedCollection(): void {
  unlockedCollectionSet = new Set(DEFAULT_SUIT_CARDS.map((c) => c.id));
  persistUnlockedIds(unlockedCollectionSet);
}

function pickRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function openBoosterPack(
  packId: string,
  boosterCount = 1
): { cards: CardDefinition[]; newlyUnlockedIds: string[] } {
  const pack = PACK_SERIES_BY_ID[packId] ?? DEFAULT_PACK_SERIES[0];
  let pool = getCardsForPackSeries(pack.id, false);
  if (pool.length === 0) {
    pool = [...BATTLE_CARDS];
  }

  const perPack = Math.min(pool.length, Math.max(1, pack.cardsPerBooster || 6));
  const pulled: CardDefinition[] = [];
  const newlyUnlocked: string[] = [];
  const currentlyUnlocked = getUnlockedCollectionIds();

  for (let b = 0; b < boosterCount; b++) {
    const usedInSinglePack = new Set<string>();
    const highRarity = pool.filter(
      (c) => c.rank === 'SR' || c.rank === 'AR' || c.rank === 'S'
    );
    const midRarity = pool.filter((c) => c.rank === 'A' || c.category === CardCategory.SUPPORT);
    const baseRarity = pool.filter((c) => c.rank === 'B' || c.rank === 'C');

    const packPulls: CardDefinition[] = [];

    const takeFromTier = (tier: CardDefinition[]) => {
      const candidates = tier.filter((c) => !usedInSinglePack.has(c.id));
      if (candidates.length === 0) return false;
      const chosen = pickRandomItem(candidates);
      usedInSinglePack.add(chosen.id);
      packPulls.push(chosen);
      return true;
    };

    // Slot 1..N-2: Base / Mid mix
    while (packPulls.length < Math.max(0, perPack - 2)) {
      if (!takeFromTier(baseRarity.length > 0 ? baseRarity : pool)) {
        if (!takeFromTier(pool)) break;
      }
    }
    // Slot N-1: Guaranteed Rank A / Support if available
    if (packPulls.length < perPack) {
      if (!takeFromTier(midRarity)) {
        takeFromTier(pool);
      }
    }
    // Final Foil Slot: Weighted chance for SR / AR / S hit!
    if (packPulls.length < perPack) {
      const hitHigh = highRarity.length > 0 && Math.random() < 0.65;
      if (hitHigh) {
        if (!takeFromTier(highRarity)) takeFromTier(pool);
      } else if (!takeFromTier(midRarity)) {
        if (!takeFromTier(highRarity)) takeFromTier(pool);
      }
    }

    for (const card of packPulls) {
      pulled.push(card);
      if (!currentlyUnlocked.has(card.id)) {
        currentlyUnlocked.add(card.id);
        newlyUnlocked.push(card.id);
      }
      unlockedCollectionSet.add(card.id);
    }
  }

  persistUnlockedIds(unlockedCollectionSet);
  return { cards: pulled, newlyUnlockedIds: newlyUnlocked };
}

export function buildPlayableDeckFromPackSeries(
  packId: string,
  targetSize = 30
): string[] {
  const seriesCards = getCardsForPackSeries(packId, false);
  const used = new Set<string>();
  const result: string[] = [];

  // Prioritize unconditional characters first so starting hand is always legal
  const seriesUncond = seriesCards.filter(
    (c) => c.category === CardCategory.CHARACTER && !c.condition
  );
  for (const c of seriesUncond) {
    if (result.length >= targetSize) break;
    used.add(c.id);
    result.push(c.id);
  }

  for (const c of seriesCards) {
    if (result.length >= targetSize) break;
    if (!used.has(c.id)) {
      used.add(c.id);
      result.push(c.id);
    }
  }

  // If the chosen thematic/custom pack has fewer than targetSize cards, pad cleanly with unique cards from Blazing Frost
  const minUncond = Math.min(8, Math.ceil(targetSize * 0.3));
  let uncondCount = result.filter((id) => {
    const d = CARD_BY_ID[id];
    return d && d.category === CardCategory.CHARACTER && !d.condition;
  }).length;

  if (uncondCount < minUncond) {
    for (const c of BATTLE_CARDS) {
      if (result.length >= targetSize || uncondCount >= minUncond) break;
      if (!used.has(c.id) && c.category === CardCategory.CHARACTER && !c.condition) {
        used.add(c.id);
        result.push(c.id);
        uncondCount += 1;
      }
    }
  }

  for (const c of BATTLE_CARDS) {
    if (result.length >= targetSize) break;
    if (!used.has(c.id)) {
      used.add(c.id);
      result.push(c.id);
    }
  }

  return deduplicateDeckIds(result, targetSize);
}

export function registerSessionCards(cards: Record<string, CardDefinition>): void {
  if (!cards || Object.keys(cards).length === 0) return;
  sessionSyncedCards = { ...sessionSyncedCards, ...cards };
  rebuildLiveRegistries();
}

export function getCustomOrEditedCardsForDeck(
  deckIds: string[],
  suitArtSet?: SuitArtSetId
): Record<string, CardDefinition> {
  const result: Record<string, CardDefinition> = {};
  for (const id of deckIds) {
    const def = CARD_BY_ID[id];
    if (!def) continue;
    if (def.isCustom || editedCardsStore[id]) {
      result[id] = def;
    }
  }
  for (const suitCard of SUIT_CARDS) {
    const matchesSet = suitArtSet ? (suitCard.suitArtSet ?? 1) === suitArtSet : true;
    if (matchesSet && (suitCard.isCustom || editedCardsStore[suitCard.id])) {
      result[suitCard.id] = suitCard;
    }
  }
  return result;
}

export function isBuiltInCard(cardId: string): boolean {
  return Boolean(BUILT_IN_BY_ID[cardId]);
}

export function isCardModified(cardId: string): boolean {
  return Boolean(editedCardsStore[cardId]);
}

export function getDefaultCardDefinition(cardId: string): CardDefinition | null {
  return BUILT_IN_BY_ID[cardId] ?? null;
}

export function upsertCardDefinition(card: CardDefinition): { ok: boolean; error?: string } {
  try {
    if (BUILT_IN_BY_ID[card.id]) {
      const nextEdited = { ...editedCardsStore, [card.id]: { ...card, isCustom: false } };
      localStorage.setItem(EDITED_CARDS_STORAGE_KEY, JSON.stringify(nextEdited));
      editedCardsStore = nextEdited;
    } else {
      const normalized: CardDefinition = { ...card, isCustom: true };
      const existsIdx = customCardsStore.findIndex((c) => c.id === normalized.id);
      const nextCustom = [...customCardsStore];
      if (existsIdx >= 0) {
        nextCustom[existsIdx] = normalized;
      } else {
        nextCustom.unshift(normalized);
      }
      localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(nextCustom));
      customCardsStore = nextCustom;
    }
    rebuildLiveRegistries();
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Penyimpanan lokal penuh. Gunakan ukuran gambar yang lebih kecil atau hapus kartu kustom lama.',
    };
  }
}

export function resetCardToDefault(cardId: string): void {
  if (!editedCardsStore[cardId]) return;
  const nextEdited = { ...editedCardsStore };
  delete nextEdited[cardId];
  try {
    localStorage.setItem(EDITED_CARDS_STORAGE_KEY, JSON.stringify(nextEdited));
  } catch {
    // Ignore storage error
  }
  editedCardsStore = nextEdited;
  rebuildLiveRegistries();
}

export function deleteCustomCardDefinition(cardId: string): void {
  if (BUILT_IN_BY_ID[cardId]) return;
  const nextCustom = customCardsStore.filter((c) => c.id !== cardId);
  try {
    localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(nextCustom));
  } catch {
    // Ignore storage error
  }
  customCardsStore = nextCustom;
  rebuildLiveRegistries();
}

export function deduplicateDeckIds(cardIds: string[], maxCount?: number): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of cardIds) {
    if (!CARD_BY_ID[id] || CARD_BY_ID[id].category === CardCategory.SUIT) continue;
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
      if (maxCount && unique.length >= maxCount) break;
    }
  }
  return unique;
}

export function getSuitCardForSet(
  element: SuitElement,
  artSet: SuitArtSetId = 1
): CardDefinition {
  // Prefer custom/edited latest match for the requested artSet
  const matches = SUIT_CARDS.filter(
    (c) => c.suitElement === element && (c.suitArtSet ?? 1) === artSet
  );
  if (matches.length > 0) {
    return matches[0];
  }
  return (
    SUIT_CARDS.find((c) => c.suitElement === element && c.suitArtSet === 1) ??
    SUIT_CARDS.find((c) => c.suitElement === element)!
  );
}

export interface SuitArtSetOption {
  id: SuitArtSetId;
  label: string;
  shortLabel: string;
  isCustom: boolean;
  uploadedElements: SuitElement[];
  cards: {
    AIR: CardDefinition;
    API: CardDefinition;
    DAUN: CardDefinition;
  };
}

export function getAvailableSuitArtSets(): SuitArtSetOption[] {
  const builtInMeta: Array<{ id: number; label: string; shortLabel: string }> = [
    {
      id: 1,
      label: 'Seri Suit #1 — Blizzard / Nova / Rimba (46–48)',
      shortLabel: 'Seri #1 (46–48)',
    },
    {
      id: 2,
      label: 'Seri Suit #2 — Meriam / Tinju / Angin (49–51)',
      shortLabel: 'Seri #2 (49–51)',
    },
    {
      id: 3,
      label: 'Seri Suit #3 — Artik / Hantaman / Tebasan (52–54)',
      shortLabel: 'Seri #3 (52–54)',
    },
  ];

  const options: SuitArtSetOption[] = builtInMeta.map((b) => ({
    id: b.id,
    label: b.label,
    shortLabel: b.shortLabel,
    isCustom: SUIT_CARDS.some(
      (c) => (c.suitArtSet ?? 1) === b.id && Boolean(c.isCustom || editedCardsStore[c.id])
    ),
    uploadedElements: [SuitElement.AIR, SuitElement.API, SuitElement.DAUN],
    cards: {
      AIR: getSuitCardForSet(SuitElement.AIR, b.id),
      API: getSuitCardForSet(SuitElement.API, b.id),
      DAUN: getSuitCardForSet(SuitElement.DAUN, b.id),
    },
  }));

  const extraIds = Array.from(
    new Set(
      SUIT_CARDS.map((c) => c.suitArtSet ?? 1).filter(
        (n) => Number.isFinite(n) && n > 3
      )
    )
  ).sort((a, b) => a - b);

  for (const id of extraIds) {
    const cardsInSet = SUIT_CARDS.filter((c) => (c.suitArtSet ?? 1) === id);
    const customLabel = cardsInSet.find((c) => c.suitSetLabel?.trim())?.suitSetLabel?.trim();
    const fallbackNames = cardsInSet.map((c) => c.name).slice(0, 3).join(' / ');
    const uploadedElements = Array.from(
      new Set(
        cardsInSet
          .map((c) => c.suitElement)
          .filter((el): el is SuitElement => Boolean(el))
      )
    );
    options.push({
      id,
      label: customLabel
        ? `Seri Suit #${id} — ${customLabel}`
        : `Seri Suit #${id} — ${fallbackNames || 'Upload Kustom'}`,
      shortLabel: customLabel ? `Seri #${id} · ${customLabel}` : `Seri #${id} (Upload)`,
      isCustom: true,
      uploadedElements,
      cards: {
        AIR: getSuitCardForSet(SuitElement.AIR, id),
        API: getSuitCardForSet(SuitElement.API, id),
        DAUN: getSuitCardForSet(SuitElement.DAUN, id),
      },
    });
  }

  return options;
}

export function getNextCustomSuitSetId(): number {
  const maxSet = SUIT_CARDS.reduce(
    (max, card) => Math.max(max, Math.floor(Number(card.suitArtSet) || 1)),
    3
  );
  return maxSet + 1;
}

export interface EffectCatalogItem {
  key: EffectKey;
  label: string;
  targetCategory: 'BOTH' | 'CHARACTER' | 'SUPPORT';
  defaultPriority: EffectPriority;
  defaultText: string;
}

export const EFFECT_CATALOG: EffectCatalogItem[] = [
  {
    key: 'NONE',
    label: 'Tanpa Efek Khusus',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText: 'Petarung murni yang mengandalkan kekuatan HP dan ATK di Zona Aktif.',
  },
  {
    key: 'NULLIFY_ENEMY_EFFECT',
    label: 'Batalkan Efek Kartu Lawan (Efek 01)',
    targetCategory: 'CHARACTER',
    defaultPriority: 1,
    defaultText: 'Efek kartu lawan di Zona Aktif tidak efektif.',
  },
  {
    key: 'SHIELD_ONCE',
    label: 'Tangkis Serangan Pertama Lawan',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText: 'Serangan pertama lawan tidak efektif.',
  },
  {
    key: 'SHIELD_TWICE',
    label: 'Perisai 2x Serangan Lawan',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText: 'Serangan pihak lawan tidak efektif sebanyak dua kali.',
  },
  {
    key: 'REFLECT_FIRST_ATTACK',
    label: 'Pantulkan Serangan Pertama Lawan (Terus jika Suit 1 Seri)',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText:
      'Serangan pertama pihak lawan terkena pada diri sendiri. Efek ini tetap berterusan jika terjadi seri pada Suit pertama.',
  },
  {
    key: 'BLIND_DISCARD_ENEMY_HAND_1',
    label: 'Pilih Acak/Tertutup 1 Kartu Tangan Lawan ke Zona Kalah',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText: 'Pilih 1 kartu dari tangan lawan dan letakkan di Zona Kalah.',
  },
  {
    key: 'DISCARD_ENEMY_HAND_1',
    label: 'Lihat Tangan Lawan & Buang 1 Kartu ke Zona Kalah',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText: 'Lihat kartu di tangan lawan, pilih 1 kartu, dan letakkan di Zona Kalah.',
  },
  {
    key: 'RETURN_ENEMY_HAND_3_TO_DECK',
    label: 'Lihat Tangan Lawan & Kembalikan 3 Kartu ke Dek Lawan',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText:
      'Lihat tangan pihak lawan, pilih 3 kartu, dan kembalikan kartu tersebut ke dalam Dek pihak lawan.',
  },
  {
    key: 'DRAW_2',
    label: 'Tarik 2 Kartu dari Dek',
    targetCategory: 'BOTH',
    defaultPriority: 2,
    defaultText: 'Ambil 2 kartu dari atas Dek dan letakkan di tangan.',
  },
  {
    key: 'DRAW_3',
    label: 'Tarik 3 Kartu dari Dek',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Ambil 3 kartu dari atas Dek dan letakkan di tangan.',
  },
  {
    key: 'TUTOR_DURI',
    label: 'Ambil BoBoiBoy Duri dari Dek ke Tangan',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Ambil kartu BoBoiBoy Duri dari Dek dan letakkan di tangan.',
  },
  {
    key: 'TUTOR_SOLAR',
    label: 'Ambil BoBoiBoy Solar dari Dek ke Tangan',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Ambil kartu BoBoiBoy Solar dari Dek dan letakkan di tangan.',
  },
  {
    key: 'TUTOR_SOPAN',
    label: 'Ambil BoBoiBoy Sopan dari Dek ke Tangan',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Ambil kartu BoBoiBoy Sopan dari Dek dan letakkan di tangan.',
  },
  {
    key: 'TUTOR_ANY_FROM_DECK',
    label: 'Cari & Ambil 1 Kartu Bebas dari Dek',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Pilih 1 kartu apa saja dari Dek ke tangan, lalu kocok Dek kembali.',
  },
  {
    key: 'TUTOR_SUPPORT_FROM_DECK',
    label: 'Cari 1 Kartu Pendukung dari Dek',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Pilih 1 Kartu Pendukung dari Dek dan tambahkan ke tangan.',
  },
  {
    key: 'MARIPOS_KUPUTERI_BUFF',
    label: 'Kuputeri di Tangan: HP +60 & ATK +60',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Jika kartu Kuputeri berada di tangan, kartu ini mendapat HP +60 dan ATK +60.',
  },
  {
    key: 'KACHAX_SUPPORT_GRAVE_ATK_20',
    label: 'ATK +20 per Kartu Pendukung di Zona Kalah Sendiri',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'ATK +20 untuk setiap Kartu Pendukung yang ada di Zona Kalah sendiri.',
  },
  {
    key: 'GOPAL_LOSE_ZONE_HEAL_20',
    label: 'Tambah +20 HP per Kartu Zona Kalah Lawan',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Tambah HP sebanyak 20 untuk setiap kartu di Zona Kalah lawan.',
  },
  {
    key: 'YAYA_SUIT1_WIN_ATK_40',
    label: 'Menang Suit Pertama: ATK +40',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'ATK +40 jika menang Suit pertama pada ronde ini.',
  },
  {
    key: 'GENTAR_SUIT1_LOSE_ATK_160',
    label: 'Kalah Suit Pertama: ATK +160',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'ATK +160 jika kalah dalam Suit pertama pada ronde ini.',
  },
  {
    key: 'SORI_COUNTER_HP_40',
    label: 'Kalah Suit Pertama: HP Lawan Jadi 40',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText: 'Jika kalah dalam Suit pertama, tetapkan HP kartu lawan menjadi 40.',
  },
  {
    key: 'GOPAL_FANG_DRAW_STEAL_WIN',
    label: 'Seri Suit: Buang 1 Kartu Zona Menang Lawan ke Zona Kalah',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText:
      'Jika terjadi seri saat Suit, ambil 1 kartu dari Zona Menang lawan dan letakkan di Zona Kalah lawan.',
  },
  {
    key: 'PAPA_ZOLA_SUIT_MILL_1',
    label: 'Lawan Menang/Seri Suit: Buang 1 Kartu Atas Dek Lawan',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText:
      'Setiap kali lawan menang atau seri dalam Suit, buang 1 kartu teratas dari Dek lawan ke Zona Kalah.',
  },
  {
    key: 'YAYA_HAND_BURN_20',
    label: 'Hantaman Tangan: 20 Kerusakan per Kartu Lawan',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText: 'Kurangi HP lawan sebanyak 20 untuk setiap kartu di tangan lawan.',
  },
  {
    key: 'NOVA_WIPE_HAND_BURN_40',
    label: 'Sapu Tangan Lawan + 40 Kerusakan/Kartu',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText: 'Buang semua kartu di tangan lawan ke Zona Kalah dan beri 40 kerusakan per kartu.',
  },
  {
    key: 'BLIZZARD_WIPE_HAND_DRAIN_ATK_40',
    label: 'Sapu Tangan Lawan + Kurangi 40 ATK/Kartu',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText: 'Buang semua kartu di tangan lawan ke Zona Kalah dan kurangi ATK lawan 40 per kartu.',
  },
  {
    key: 'MAMA_ZILA_ENEMY_ATK_40',
    label: 'Tetapkan ATK Lawan Menjadi 40',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText: 'Tetapkan nilai ATK kartu lawan di Zona Aktif menjadi 40.',
  },
  {
    key: 'SUPER_PAPA_LOCK_SUPPORT_ATK_20',
    label: 'Kunci Pendukung Lawan & ATK Lawan Jadi 20',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText: 'Lawan tidak dapat memakai Kartu Pendukung & ATK lawan menjadi 20.',
  },
  {
    key: 'BOBOIBOY_GOPAL_SWAP_CONDITIONAL',
    label: 'Tukar dengan Kartu Bersyarat dari Dek & Aktifkan Efeknya',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText:
      'Tukarkan kartu di Zona Aktif dengan 1 kartu bersyarat apa pun dari Dek, lalu aktifkan efek kartu tersebut.',
  },
  {
    key: 'SOPAN_RETURN_ENEMY_WIN_2',
    label: 'Kembalikan 2 Kartu Zona Menang Lawan ke Dek Lawan',
    targetCategory: 'CHARACTER',
    defaultPriority: 3,
    defaultText:
      'Kembalikan Kemenangan! Ambil 2 kartu dari Zona Menang lawan dan masukkan kembali ke dalam Dek lawan.',
  },
  {
    key: 'COPY_ENEMY_DECK_SUPPORT',
    label: 'Tiru 1 Kartu Pendukung dari Dek Lawan',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Pilih 1 Kartu Pendukung dari Dek lawan dan tiru efek kartu tersebut.',
  },
  {
    key: 'YING_COPY_ENEMY_DECK_STATS',
    label: 'Tiru HP & ATK Karakter dari Dek Lawan',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Pilih 1 Kartu Karakter di Dek lawan dan tiru nilai HP serta ATK miliknya.',
  },
  {
    key: 'ROSAKSA_COPY_ENEMY_DECK_EFFECT',
    label: 'Tiru Efek Kartu dari Dek Lawan',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Pilih 1 kartu di Dek lawan dan tiru efek kartu tersebut.',
  },
  {
    key: 'TOK_ABA_AUTO_WIN_BOBOIBOY',
    label: 'Otomatis Menang vs Karakter BoBoiBoy',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText: 'Otomatis Menang ronde ini jika kartu aktif lawan bertipe BoBoiBoy.',
  },
  {
    key: 'BELIUNG_AUTO_WIN_KUPUTERI',
    label: 'Otomatis Menang jika Kuputeri di Zona Kalah/Menang',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText:
      'Otomatis Menang jika terdapat kartu Kuputeri di Zona Kalah atau Zona Menang mana pun.',
  },
  {
    key: 'PIPI_ZOLA_AUTO_WIN',
    label: 'Otomatis Menang jika Papa Zola / Mama Zila di Zona Kalah/Menang',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText:
      'Otomatis Menang jika terdapat kartu Papa Zola atau Mama Zila di Zona Kalah atau Zona Menang mana pun.',
  },
  {
    key: 'OTOI_AUTO_WIN',
    label: 'Otomatis Menang jika Pipi Zola di Zona Kalah/Menang',
    targetCategory: 'CHARACTER',
    defaultPriority: 2,
    defaultText:
      'Otomatis Menang jika terdapat kartu Pipi Zola di Zona Kalah atau Zona Menang mana pun.',
  },
  {
    key: 'SUPPORT_HAMMER_GENTAR',
    label: '[Pendukung] HP & ATK Lawan Menjadi 40',
    targetCategory: 'SUPPORT',
    defaultPriority: 3,
    defaultText: 'Atur HP dan ATK kartu di Zona Aktif lawan menjadi 40.',
  },
  {
    key: 'SUPPORT_KEPAKU_PARK',
    label: '[Pendukung] Tangkis Serangan Bentrokan Ini',
    targetCategory: 'SUPPORT',
    defaultPriority: 3,
    defaultText: 'Serangan pihak lawan pada bentrokan ini menjadi tidak efektif.',
  },
  {
    key: 'SUPPORT_ROCKFAMILY_ATK_20',
    label: '[Pendukung] +20 ATK per Kartu Tangan Lawan',
    targetCategory: 'SUPPORT',
    defaultPriority: 2,
    defaultText: 'Tambah ATK sebesar 20 untuk setiap kartu yang ada di tangan lawan.',
  },
  {
    key: 'SUPPORT_SANG_BUAYA_CANCEL',
    label: '[Pendukung] Batalkan Kartu Pendukung Lawan (01)',
    targetCategory: 'SUPPORT',
    defaultPriority: 1,
    defaultText: 'Membatalkan efek Kartu Pendukung yang dimainkan lawan.',
  },
];

// Strictly Singleton Preset Decks: Every card appears ONLY ONCE (0 duplicates)
export const PRESET_DECKS: PresetDeck[] = [
  {
    id: 'deck-blazing-frost',
    name: 'Pek Blazing Frost (Nova & Blizzard Unik)',
    subtitle: '30 kartu unik tanpa kembar: Blaze, Ais, Nova, Blizzard, Gentar, Sori, dan Sopan.',
    featuredCardId: 'bf-31-boboiboy-nova',
    cardIds: [
      'bf-34-boboiboy-blaze',
      'bf-31-boboiboy-nova',
      'bf-36-boboiboy-ais',
      'bf-33-boboiboy-blizzard',
      'bf-21-boboiboy-gempa',
      'bf-19-boboiboy-halilintar',
      'bf-23-boboiboy-gentar',
      'bf-04-boboiboy-solar',
      'bf-06-boboiboy-duri',
      'bf-05-boboiboy-sori',
      'bf-11-boboiboy-taufan',
      'bf-14-boboiboy-beliung',
      'bf-32-solar-taufan',
      'bf-32-sr-boboiboy-sopan',
      'bf-44-boboiboy-gopal',
      'bf-27-gopal-qually',
      'bf-30-gopal-c',
      'bf-18-gopal-fang',
      'bf-07-yaya-suit',
      'bf-29-yaya-hantaman',
      'bf-09-ying-b',
      'bf-28-ying-c',
      'bf-16-yaya-ying',
      'bf-15-jeneral-cikala',
      'bf-39-yon-b',
      'bf-22-hammer-gentar',
      'bf-26-kepaku-park',
      'bf-35-rockfamily',
      'bf-43-sang-buaya',
      'bf-45-operatif-papa',
    ],
  },
  {
    id: 'deck-fusion-elemen',
    name: 'Fusion Elemen & Kuputeri (Unik)',
    subtitle: '30 kartu unik tanpa kembar: sinergi Solar, Duri, Taufan, Kuputeri, dan Beliung.',
    featuredCardId: 'bf-32-sr-boboiboy-sopan',
    cardIds: [
      'bf-04-boboiboy-solar',
      'bf-06-boboiboy-duri',
      'bf-05-boboiboy-sori',
      'bf-32-solar-taufan',
      'bf-32-sr-boboiboy-sopan',
      'bf-11-boboiboy-taufan',
      'bf-14-boboiboy-beliung',
      'bf-10-kuputeri',
      'bf-13-maripos',
      'bf-12-maharaja-reramos',
      'bf-15-jeneral-cikala',
      'bf-02-alpha-tumbosaur',
      'bf-21-boboiboy-gempa',
      'bf-19-boboiboy-halilintar',
      'bf-23-boboiboy-gentar',
      'bf-34-boboiboy-blaze',
      'bf-31-boboiboy-nova',
      'bf-36-boboiboy-ais',
      'bf-33-boboiboy-blizzard',
      'bf-07-yaya-suit',
      'bf-09-ying-b',
      'bf-16-yaya-ying',
      'bf-44-boboiboy-gopal',
      'bf-27-gopal-qually',
      'bf-39-yon-b',
      'bf-22-hammer-gentar',
      'bf-26-kepaku-park',
      'bf-35-rockfamily',
      'bf-43-sang-buaya',
      'bf-45-operatif-papa',
    ],
  },
  {
    id: 'deck-kebenaran-papa',
    name: 'Taktik Kebenaran Papa & Tok Aba (Unik)',
    subtitle: '30 kartu unik tanpa kembar: kombo Super Papa, Mama Zila, Pipi Zola, Otoi, dan Tok Aba.',
    featuredCardId: 'bf-41-ar-super-papa',
    cardIds: [
      'bf-41-papa-zola-tactical',
      'bf-41-ar-super-papa',
      'bf-38-mama-zila',
      'bf-40-pipi-zola',
      'bf-42-otoi',
      'bf-25-tok-aba',
      'bf-44-boboiboy-gopal',
      'bf-24-rosaksa-final',
      'bf-37-kachax',
      'bf-39-yon-b',
      'bf-27-gopal-qually',
      'bf-30-gopal-c',
      'bf-18-gopal-fang',
      'bf-01-probe',
      'bf-03-adu-du-b',
      'bf-17-adu-du-c',
      'bf-20-adu-du-probe',
      'bf-02-alpha-tumbosaur',
      'bf-12-maharaja-reramos',
      'bf-10-kuputeri',
      'bf-13-maripos',
      'bf-15-jeneral-cikala',
      'bf-28-ying-c',
      'bf-29-yaya-hantaman',
      'bf-07-yaya-suit',
      'bf-22-hammer-gentar',
      'bf-26-kepaku-park',
      'bf-35-rockfamily',
      'bf-43-sang-buaya',
      'bf-45-operatif-papa',
    ],
  },
  {
    id: 'deck-aliansi-galaksi',
    name: 'Aliansi Adu Du & Perisai Galaksi (Unik)',
    subtitle: '30 kartu unik tanpa kembar: gangguan tangan Adu Du, pantulan Reramos, dan perisai Kuputeri.',
    featuredCardId: 'bf-12-maharaja-reramos',
    cardIds: [
      'bf-01-probe',
      'bf-03-adu-du-b',
      'bf-17-adu-du-c',
      'bf-20-adu-du-probe',
      'bf-02-alpha-tumbosaur',
      'bf-12-maharaja-reramos',
      'bf-10-kuputeri',
      'bf-13-maripos',
      'bf-15-jeneral-cikala',
      'bf-24-rosaksa-final',
      'bf-37-kachax',
      'bf-39-yon-b',
      'bf-07-yaya-suit',
      'bf-29-yaya-hantaman',
      'bf-09-ying-b',
      'bf-28-ying-c',
      'bf-16-yaya-ying',
      'bf-34-boboiboy-blaze',
      'bf-31-boboiboy-nova',
      'bf-36-boboiboy-ais',
      'bf-33-boboiboy-blizzard',
      'bf-11-boboiboy-taufan',
      'bf-44-boboiboy-gopal',
      'bf-27-gopal-qually',
      'bf-41-papa-zola-tactical',
      'bf-22-hammer-gentar',
      'bf-26-kepaku-park',
      'bf-35-rockfamily',
      'bf-43-sang-buaya',
      'bf-45-operatif-papa',
    ],
  },
];

function sanitizeTargetSize(raw: unknown): DeckTargetSize {
  if (raw === 10 || raw === 15 || raw === 20 || raw === 30) return raw;
  return 30;
}

export function createStarterSavedDecks(legacyDeckIds?: string[]): SavedUserDeck[] {
  const now = Date.now();
  const mainIds =
    legacyDeckIds && deduplicateDeckIds(legacyDeckIds, 30).length >= 10
      ? deduplicateDeckIds(legacyDeckIds, 30)
      : deduplicateDeckIds(PRESET_DECKS[0].cardIds, 30);

  return [
    {
      id: 'user-deck-utama',
      name: 'Dek Utama Blazing Frost',
      targetSize: 30,
      suitArtSet: 1,
      cardIds: mainIds,
      updatedAt: now,
    },
    {
      id: 'user-deck-elemental',
      name: 'Dek Kuasa Elemental (ELM)',
      targetSize: 20,
      suitArtSet: 2,
      cardIds: buildPlayableDeckFromPackSeries('pek-kuasa-elemental', 20),
      updatedAt: now - 1000,
    },
    {
      id: 'user-deck-windara',
      name: 'Dek Perisai Windara Cepat',
      targetSize: 15,
      suitArtSet: 3,
      cardIds: buildPlayableDeckFromPackSeries('pek-legenda-windara', 15),
      updatedAt: now - 2000,
    },
  ];
}

export function loadSavedUserDecks(legacyDeckIds?: string[]): {
  decks: SavedUserDeck[];
  activeDeckId: string;
} {
  try {
    const raw = localStorage.getItem(SAVED_DECKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.decks) && parsed.decks.length > 0) {
        const cleaned: SavedUserDeck[] = parsed.decks.map((d: SavedUserDeck, idx: number) => {
          const targetSize = sanitizeTargetSize(d.targetSize);
          const rawSuitSet = Number(d.suitArtSet);
          return {
            id: String(d.id || `user-deck-${idx + 1}`),
            name: String(d.name || `Dek Kustom #${idx + 1}`).slice(0, 36),
            targetSize,
            suitArtSet: Number.isFinite(rawSuitSet) && rawSuitSet >= 1 ? Math.floor(rawSuitSet) : 1,
            cardIds: deduplicateDeckIds(Array.isArray(d.cardIds) ? d.cardIds : [], targetSize),
            updatedAt: Number(d.updatedAt) || Date.now(),
          };
        });
        const activeId = cleaned.some((d) => d.id === parsed.activeDeckId)
          ? parsed.activeDeckId
          : cleaned[0].id;
        return { decks: cleaned, activeDeckId: activeId };
      }
    }
  } catch {
    // Ignore storage read error
  }

  const starters = createStarterSavedDecks(legacyDeckIds);
  return { decks: starters, activeDeckId: starters[0].id };
}

export function persistSavedUserDecks(decks: SavedUserDeck[], activeDeckId: string): void {
  try {
    localStorage.setItem(
      SAVED_DECKS_STORAGE_KEY,
      JSON.stringify({ decks, activeDeckId })
    );
  } catch {
    // Ignore storage write error
  }
}

export interface HologramFinishOption {
  id: HologramFinish;
  label: string;
  shortLabel: string;
  description: string;
}

export const HOLOGRAM_FINISH_OPTIONS: HologramFinishOption[] = [
  {
    id: 'NONE',
    label: 'Standar (Tanpa Hologram)',
    shortLabel: 'Standar',
    description: 'Permukaan kartu reguler tanpa lapisan foil hologram.',
  },
  {
    id: 'RAINBOW_PRISM',
    label: 'Hologram Prisma Pelangi',
    shortLabel: 'Prisma',
    description: 'Bias spektrum pelangi diagonal khas kartu Super Rare (SR).',
  },
  {
    id: 'SOLAR_GOLD',
    label: 'Hologram Emas Solar',
    shortLabel: 'Emas Solar',
    description: 'Kilau foil emas hangat untuk kartu elemen api, cahaya, dan petir.',
  },
  {
    id: 'CRYO_FROST',
    label: 'Hologram Kristal Es',
    shortLabel: 'Kristal Es',
    description: 'Pantulan kristal biru-sian untuk kartu elemen es, air, dan angin.',
  },
  {
    id: 'STARDUST_GALAXY',
    label: 'Hologram Bintang Galaksi',
    shortLabel: 'Galaksi',
    description: 'Kilau nebula ungu-magenta berbintang khas kartu Art Rare (AR).',
  },
];

const BUILT_IN_FROST_HOLO_IDS = new Set([
  'bf-33-boboiboy-blizzard',
  'bf-14-boboiboy-beliung',
  'bf-10-kuputeri',
]);

const BUILT_IN_GALAXY_HOLO_IDS = new Set([
  'bf-24-rosaksa-final',
  'bf-12-maharaja-reramos',
]);

export function getDefaultHologramForRank(rank: string, cardId?: string): HologramFinish {
  if (rank === 'SR') return 'RAINBOW_PRISM';
  if (rank === 'AR') return 'STARDUST_GALAXY';
  if (rank === 'S') {
    if (cardId && BUILT_IN_FROST_HOLO_IDS.has(cardId)) return 'CRYO_FROST';
    if (cardId && BUILT_IN_GALAXY_HOLO_IDS.has(cardId)) return 'STARDUST_GALAXY';
    return 'SOLAR_GOLD';
  }
  return 'NONE';
}

export function resolveCardHologramFinish(card: CardDefinition | null | undefined): HologramFinish {
  if (!card) return 'NONE';
  if (
    card.hologramFinish === 'NONE' ||
    card.hologramFinish === 'RAINBOW_PRISM' ||
    card.hologramFinish === 'SOLAR_GOLD' ||
    card.hologramFinish === 'CRYO_FROST' ||
    card.hologramFinish === 'STARDUST_GALAXY'
  ) {
    return card.hologramFinish;
  }
  return getDefaultHologramForRank(card.rank, card.id);
}

export function isCardHolographic(card: CardDefinition | null | undefined): boolean {
  return resolveCardHologramFinish(card) !== 'NONE';
}

export function getHologramFinishMeta(finish: HologramFinish): HologramFinishOption {
  return HOLOGRAM_FINISH_OPTIONS.find((opt) => opt.id === finish) ?? HOLOGRAM_FINISH_OPTIONS[0];
}

export function setCardHologramFinish(
  cardId: string,
  finish: HologramFinish
): { ok: boolean; card?: CardDefinition; error?: string } {
  const existing = CARD_BY_ID[cardId];
  if (!existing) {
    return { ok: false, error: 'Kartu tidak ditemukan.' };
  }
  const updated: CardDefinition = {
    ...existing,
    hologramFinish: finish,
  };
  const res = upsertCardDefinition(updated);
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  return { ok: true, card: CARD_BY_ID[cardId] ?? updated };
}

export function cycleCardHologramFinish(cardId: string): {
  ok: boolean;
  card?: CardDefinition;
  nextFinish: HologramFinish;
} {
  const existing = CARD_BY_ID[cardId];
  const order: HologramFinish[] = [
    'NONE',
    'RAINBOW_PRISM',
    'SOLAR_GOLD',
    'CRYO_FROST',
    'STARDUST_GALAXY',
  ];
  const current = resolveCardHologramFinish(existing);
  const idx = order.indexOf(current);
  const nextFinish = order[(idx + 1) % order.length];
  const saved = setCardHologramFinish(cardId, nextFinish);
  return { ok: saved.ok, card: saved.card, nextFinish };
}


