export type UpdateCategory =
  | 'PATCH'
  | 'EVENT'
  | 'NEW_CARDS'
  | 'MAINTENANCE'
  | 'ANNOUNCEMENT';

export interface GlobalAppUpdate {
  id: string;
  version: string;
  title: string;
  category: UpdateCategory;
  summary: string;
  details: string[];
  author: string;
  timestamp: number;
  pinned?: boolean;
  giftCoins?: number;
  giftTickets?: number;
}

export interface OwnerSession {
  token: string;
  email: string;
  name: string;
  role: 'OWNER';
  expiresAt: number;
}

export type ShopProductCategory = 'BOOSTER_PACK' | 'SINGLE_CARD' | 'SPECIAL_BUNDLE';

export interface ShopProduct {
  id: string;
  name: string;
  subtitle: string;
  category: ShopProductCategory;
  priceCoins: number;
  badge?: string;
  description: string;
  image?: string;
  packSeriesId?: string;
  cardId?: string;
  cardCount?: number;
  guaranteedRarity?: 'SR' | 'AR' | 'S' | 'A' | 'RARE';
  featuredCardIds?: string[];
}

export interface OpenedCardItem {
  id: string;
  numberLabel: string;
  name: string;
  category: string;
  rank: string;
  image: string;
  hp: number;
  atk: number;
  effectText: string;
  isNew: boolean;
  hologramFinish?: string;
}

export interface WalletTransaction {
  id: string;
  timestamp: number;
  type: 'BATTLE_REWARD' | 'PURCHASE' | 'PROMO_CODE' | 'UPDATE_GIFT' | 'DAILY_BONUS';
  amount: number;
  label: string;
}

export interface UserWallet {
  coins: number;
  tickets: number;
  lastDailyRewardTimestamp?: number;
  redeemedCodeIds: string[];
  claimedUpdateGiftIds: string[];
  transactionHistory: WalletTransaction[];
}
