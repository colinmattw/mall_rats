/**
 * Fixed-quantity Mall Cash packs. Prices are NOT defined here: production
 * builds must display the localized price string returned by the platform
 * billing provider (App Store / Google Play).
 */
export interface CurrencyPack {
  productId: string;
  amount: number;
  title: string;
}

export const CURRENCY_PACKS: CurrencyPack[] = [
  { productId: 'mallrats.cash.1000', amount: 1000, title: 'Pocket Change' },
  { productId: 'mallrats.cash.3000', amount: 3000, title: 'Allowance' },
  { productId: 'mallrats.cash.7500', amount: 7500, title: 'Paycheck' },
  { productId: 'mallrats.cash.20000', amount: 20000, title: 'Mall Mogul' },
];

export function packById(productId: string): CurrencyPack | undefined {
  return CURRENCY_PACKS.find((p) => p.productId === productId);
}
