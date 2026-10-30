import { ALL_PACK_SERIES, CARD_BY_ID, openBoosterPack } from '../data/cards';
import type { CardDefinition } from '../types/game';
import type { OpenedCardItem, ShopProduct, UserWallet, WalletTransaction } from '../types/owner';

export const USER_WALLET_STORAGE_KEY = 'mgc_user_wallet_v1';

export const DEFAULT_PROMO_CODES: Record<
  string,
  { label: string; coins: number; tickets: number; singleUse: boolean }
> = {
  BOBOIBOY2026: {
    label: 'Bonus Selamat Datang BoBoiBoy 2026',
    coins: 500,
    tickets: 1,
    singleUse: true,
  },
  PEMILIKAPP: {
    label: 'Hadiah Spesial Pemilik Aplikasi (Ahmad Syarif)',
    coins: 1000,
    tickets: 2,
    singleUse: true,
  },
  BLAZINGFROST: {
    label: 'Hadiah Rilis Pek Blazing Frost',
    coins: 350,
    tickets: 0,
    singleUse: true,
  },
  KUASA7: {
    label: 'Bonus 7 Elemen Galaksi',
    coins: 700,
    tickets: 1,
    singleUse: true,
  },
};

export const DEFAULT_SHOP_PRODUCTS: ShopProduct[] = [
  {
    id: 'pack-blazing-frost',
    name: 'Pek Blazing Frost (Edisi Perdana)',
    subtitle: 'Seri Utama 54 Kartu · Peluang Tinggi SR & AR',
    category: 'BOOSTER_PACK',
    priceCoins: 300,
    badge: 'Terpopuler',
    description:
      'Booster pack berisi 6 kartu acak dari seri perdana Blazing Frost. Jaminan minimal 1 kartu Langka atau Hologram spektrum!',
    packSeriesId: 'pek-blazing-frost',
    cardCount: 6,
    guaranteedRarity: 'RARE',
    featuredCardIds: ['bf-31-boboiboy-nova', 'bf-32-sr-boboiboy-sopan', 'bf-41-ar-super-papa'],
  },
  {
    id: 'pack-kuasa-elemental',
    name: 'Pek Kuasa Elemental (ELM)',
    subtitle: 'Tahap 2 & 3 · Kombo Fusion Galaksi',
    category: 'BOOSTER_PACK',
    priceCoins: 300,
    badge: 'Elemental',
    description:
      'Berisi 6 kartu kombinasi Halilintar, Taufan, Gempa, Blaze, Ais, Duri, dan Solar dengan sinergi adu suit kuat.',
    packSeriesId: 'pek-kuasa-elemental',
    cardCount: 6,
    guaranteedRarity: 'A',
    featuredCardIds: ['bf-19-boboiboy-halilintar', 'bf-34-boboiboy-blaze', 'bf-36-boboiboy-ais'],
  },
  {
    id: 'pack-legenda-windara',
    name: 'Pek Legenda Windara (WND)',
    subtitle: 'Faksi Windara, Kuputeri & Beliung',
    category: 'BOOSTER_PACK',
    priceCoins: 350,
    badge: 'Pertahanan',
    description:
      'Spesialisasi kartu pertahanan perisai, pantulan serangan Maharaja Reramos, dan jurus Kuputeri.',
    packSeriesId: 'pek-legenda-windara',
    cardCount: 6,
    guaranteedRarity: 'A',
    featuredCardIds: ['bf-10-kuputeri', 'bf-14-boboiboy-beliung', 'bf-12-maharaja-reramos'],
  },
  {
    id: 'pack-kebenaran-papa',
    name: 'Pek Kebenaran P.A.P.A & Tok Aba',
    subtitle: 'Keluarga Papa Zola & Sinergi Bumi',
    category: 'BOOSTER_PACK',
    priceCoins: 350,
    badge: 'Taktis',
    description:
      'Taktik otomatis menang Kapten Papa Zola, Mama Zila, Pipi Zola, Otoi, Tok Aba, dan pengunci bantuan lawan.',
    packSeriesId: 'pek-kebenaran-papa',
    cardCount: 6,
    guaranteedRarity: 'AR',
    featuredCardIds: ['bf-41-ar-super-papa', 'bf-38-mama-zila', 'bf-25-tok-aba'],
  },
  {
    id: 'single-sopan-sr',
    name: 'BoBoiBoy Sopan (Super Rare)',
    subtitle: 'Kartu Lepasan Resmi · Kembalikan Kemenangan',
    category: 'SINGLE_CARD',
    priceCoins: 850,
    badge: 'SR Foil',
    description:
      'Beli langsung kartu legendaris BoBoiBoy Sopan (HP 240, ATK 220) dengan efek mengembalikan 2 kartu kemenangan lawan!',
    cardId: 'bf-32-sr-boboiboy-sopan',
  },
  {
    id: 'single-super-papa-ar',
    name: 'Super Papa (Art Rare)',
    subtitle: 'Kartu Lepasan Resmi · Kunci Pendukung Lawan',
    category: 'SINGLE_CARD',
    priceCoins: 800,
    badge: 'AR Nebula',
    description:
      'Beli langsung kartu Super Papa Zola dengan efek mengunci Kartu Pendukung musuh dan menetapkan ATK musuh jadi 20!',
    cardId: 'bf-41-ar-super-papa',
  },
  {
    id: 'single-nova-s',
    name: 'BoBoiBoy Nova (Rank S)',
    subtitle: 'Kartu Lepasan Resmi · HP 300 & ATK 260',
    category: 'SINGLE_CARD',
    priceCoins: 750,
    badge: 'Rank S',
    description:
      'Beli langsung raksasa api BoBoiBoy Nova dengan efek menyapu semua kartu tangan musuh dan membakar 40 HP per kartu!',
    cardId: 'bf-31-boboiboy-nova',
  },
  {
    id: 'single-kepaku-park',
    name: 'Taman Kepaku (Kartu Pendukung)',
    subtitle: 'Perisai Kebal Serangan Mutlak',
    category: 'SINGLE_CARD',
    priceCoins: 400,
    badge: 'Support',
    description:
      'Kartu pendukung andalan untuk menahan satu serangan fatal musuh dalam benturan apa pun!',
    cardId: 'bf-26-kepaku-park',
  },
];

export function loadUserWallet(): UserWallet {
  try {
    const raw = localStorage.getItem(USER_WALLET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.coins === 'number') {
        return {
          coins: Math.max(0, parsed.coins),
          tickets: Math.max(0, parsed.tickets ?? 0),
          lastDailyRewardTimestamp: parsed.lastDailyRewardTimestamp,
          redeemedCodeIds: Array.isArray(parsed.redeemedCodeIds) ? parsed.redeemedCodeIds : [],
          claimedUpdateGiftIds: Array.isArray(parsed.claimedUpdateGiftIds)
            ? parsed.claimedUpdateGiftIds
            : [],
          transactionHistory: Array.isArray(parsed.transactionHistory)
            ? parsed.transactionHistory
            : [],
        };
      }
    }
  } catch {
    // Ignore storage parse error
  }

  // Initial starter wallet: 600 Coins + 1 Booster Ticket
  const starter: UserWallet = {
    coins: 600,
    tickets: 1,
    redeemedCodeIds: [],
    claimedUpdateGiftIds: [],
    transactionHistory: [
      {
        id: `tx-init`,
        timestamp: Date.now(),
        type: 'DAILY_BONUS',
        amount: 600,
        label: 'Modal Awal Petarung Galaksi (+1 Tiket Booster)',
      },
    ],
  };
  saveUserWallet(starter);
  return starter;
}

export function saveUserWallet(wallet: UserWallet): void {
  try {
    localStorage.setItem(USER_WALLET_STORAGE_KEY, JSON.stringify(wallet));
  } catch {
    // Ignore storage write error
  }
}

export function addWalletCoins(
  amount: number,
  label: string,
  type: WalletTransaction['type'] = 'BATTLE_REWARD'
): UserWallet {
  const current = loadUserWallet();
  const nextCoins = current.coins + amount;
  const tx: WalletTransaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    type,
    amount,
    label,
  };
  const updated: UserWallet = {
    ...current,
    coins: nextCoins,
    transactionHistory: [tx, ...current.transactionHistory].slice(0, 50),
  };
  saveUserWallet(updated);
  return updated;
}

export function spendWalletCoins(
  amount: number,
  label: string
): { success: boolean; wallet: UserWallet; error?: string } {
  const current = loadUserWallet();
  if (current.coins < amount) {
    return {
      success: false,
      wallet: current,
      error: `Koin tidak mencukupi! Diperlukan ${amount} Koin (Saldo: ${current.coins}).`,
    };
  }

  const tx: WalletTransaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    type: 'PURCHASE',
    amount: -amount,
    label,
  };
  const updated: UserWallet = {
    ...current,
    coins: current.coins - amount,
    transactionHistory: [tx, ...current.transactionHistory].slice(0, 50),
  };
  saveUserWallet(updated);
  return { success: true, wallet: updated };
}

export function claimDailyReward(): { success: boolean; coins: number; message: string } {
  const current = loadUserWallet();
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (current.lastDailyRewardTimestamp && now - current.lastDailyRewardTimestamp < ONE_DAY_MS) {
    const hoursLeft = Math.ceil(
      (ONE_DAY_MS - (now - current.lastDailyRewardTimestamp)) / (1000 * 60 * 60)
    );
    return {
      success: false,
      coins: 0,
      message: `Hadiah harian sudah diambil. Silakan kembali dalam ${hoursLeft} jam lagi!`,
    };
  }

  const rewardCoins = 250;
  const updated = addWalletCoins(rewardCoins, 'Hadiah Masuk Harian (+250 Koin)', 'DAILY_BONUS');
  updated.lastDailyRewardTimestamp = now;
  saveUserWallet(updated);

  return {
    success: true,
    coins: rewardCoins,
    message: `Selamat! Anda mendapatkan ${rewardCoins} Koin Galaksi hadiah harian!`,
  };
}

export function redeemPromoCode(code: string): {
  success: boolean;
  message: string;
  coins?: number;
  tickets?: number;
} {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, message: 'Silakan masukkan kode promo.' };
  }

  const promo = DEFAULT_PROMO_CODES[cleanCode];
  if (!promo) {
    return { success: false, message: 'Kode promo tidak valid atau sudah kedaluwarsa.' };
  }

  const current = loadUserWallet();
  if (promo.singleUse && current.redeemedCodeIds.includes(cleanCode)) {
    return { success: false, message: 'Kode promo ini sudah pernah Anda tukarkan sebelumnya.' };
  }

  const nextCoins = current.coins + promo.coins;
  const nextTickets = current.tickets + promo.tickets;
  const tx: WalletTransaction = {
    id: `tx-${Date.now()}-${cleanCode}`,
    timestamp: Date.now(),
    type: 'PROMO_CODE',
    amount: promo.coins,
    label: `Klaim Kode: ${cleanCode} (${promo.label})`,
  };

  const updated: UserWallet = {
    ...current,
    coins: nextCoins,
    tickets: nextTickets,
    redeemedCodeIds: [...current.redeemedCodeIds, cleanCode],
    transactionHistory: [tx, ...current.transactionHistory].slice(0, 50),
  };
  saveUserWallet(updated);

  return {
    success: true,
    coins: promo.coins,
    tickets: promo.tickets,
    message: `Berhasil menukarkan kode "${cleanCode}"! Mendapatkan +${promo.coins} Koin${
      promo.tickets > 0 ? ` & +${promo.tickets} Tiket Booster` : ''
    }!`,
  };
}

export function claimUpdateGift(
  updateId: string,
  coins: number,
  updateTitle: string
): { success: boolean; message: string } {
  const current = loadUserWallet();
  if (current.claimedUpdateGiftIds.includes(updateId)) {
    return { success: false, message: 'Hadiah pembaruan ini sudah Anda klaim.' };
  }

  const updated = addWalletCoins(
    coins,
    `Bonus Pembaruan: ${updateTitle} (+${coins} Koin)`,
    'UPDATE_GIFT'
  );
  updated.claimedUpdateGiftIds = [...updated.claimedUpdateGiftIds, updateId];
  saveUserWallet(updated);

  return {
    success: true,
    message: `Berhasil mengklaim bonus pembaruan +${coins} Koin Galaksi!`,
  };
}

export function executeBuyBoosterPack(
  product: ShopProduct,
  useTicket = false
): {
  success: boolean;
  openedCards: CardDefinition[];
  newlyUnlockedIds: string[];
  error?: string;
} {
  const current = loadUserWallet();

  if (useTicket) {
    if (current.tickets < 1) {
      return { success: false, openedCards: [], newlyUnlockedIds: [], error: 'Tiket Booster Anda habis.' };
    }
    const updated: UserWallet = {
      ...current,
      tickets: current.tickets - 1,
      transactionHistory: [
        {
          id: `tx-${Date.now()}`,
          timestamp: Date.now(),
          type: 'PURCHASE',
          amount: 0,
          label: `Membuka ${product.name} (Gunakan 1 Tiket Booster)`,
        },
        ...current.transactionHistory,
      ].slice(0, 50),
    };
    saveUserWallet(updated);
  } else {
    const spendRes = spendWalletCoins(product.priceCoins, `Membeli ${product.name}`);
    if (!spendRes.success) {
      return { success: false, openedCards: [], newlyUnlockedIds: [], error: spendRes.error };
    }
  }

  const packId = product.packSeriesId ?? 'pek-blazing-frost';
  const openRes = openBoosterPack(packId, 1);

  return {
    success: true,
    openedCards: openRes.cards,
    newlyUnlockedIds: openRes.newlyUnlockedIds,
  };
}

export function executeBuySingleCard(product: ShopProduct): {
  success: boolean;
  card: CardDefinition | null;
  error?: string;
} {
  if (!product.cardId || !CARD_BY_ID[product.cardId]) {
    return { success: false, card: null, error: 'Kartu tidak ditemukan dalam katalog.' };
  }

  const spendRes = spendWalletCoins(product.priceCoins, `Membeli Kartu Lepasan: ${product.name}`);
  if (!spendRes.success) {
    return { success: false, card: null, error: spendRes.error };
  }

  const card = CARD_BY_ID[product.cardId];

  // Unlock in player collection
  try {
    const raw = localStorage.getItem('mgc_blazing_frost_unlocked_cards_v1');
    const set = new Set(raw ? JSON.parse(raw) : []);
    set.add(card.id);
    localStorage.setItem('mgc_blazing_frost_unlocked_cards_v1', JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage write error
  }

  return {
    success: true,
    card,
  };
}
