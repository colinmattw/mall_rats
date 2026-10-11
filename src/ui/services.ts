import { useSyncExternalStore } from 'react';
import { GameStore, MemoryStorage, type StorageLike } from '../economy/store';
import type { SaveData } from '../economy/saveSchema';
import { DisabledAdProvider, MockAdProvider, type RewardedAdProvider } from '../monetization/ads';
import {
  MockBillingProvider,
  MockPurchaseVerifier,
  UnconfiguredBillingProvider,
  UnconfiguredVerifier,
  type BillingProvider,
  type PurchaseVerifier,
} from '../monetization/billing';

/**
 * Development mocks are only ever constructed in dev builds (or test builds
 * that explicitly opt in with VITE_ENABLE_MOCK_PROVIDERS=true). Production
 * builds get the disabled / unconfigured providers until real SDKs are wired.
 */
export const MOCKS_ALLOWED: boolean = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK_PROVIDERS === 'true';
export const DEV_TOOLS: boolean = MOCKS_ALLOWED;

function storage(): StorageLike {
  try {
    const ls = window.localStorage;
    const probe = '__mallrats_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return new MemoryStorage();
  }
}

export const store = new GameStore(storage());
// Close out any run that a reload abandoned: collected rewards were already committed.
store.finalizeAbandonedRun();

const disabledAds = new DisabledAdProvider();
export const mockAds: MockAdProvider | null = MOCKS_ALLOWED ? new MockAdProvider() : null;
const unconfiguredBilling = new UnconfiguredBillingProvider();
const unconfiguredVerifier = new UnconfiguredVerifier();
export const mockBilling: MockBillingProvider | null = MOCKS_ALLOWED ? new MockBillingProvider() : null;
const mockVerifier: PurchaseVerifier | null = mockBilling ? new MockPurchaseVerifier(mockBilling) : null;

export function adProvider(): RewardedAdProvider {
  if (mockAds && store.snapshot.settings.devMockProviders) return mockAds;
  return disabledAds;
}

export function billing(): { provider: BillingProvider; verifier: PurchaseVerifier } {
  if (mockBilling && mockVerifier && store.snapshot.settings.devMockProviders) return { provider: mockBilling, verifier: mockVerifier };
  return { provider: unconfiguredBilling, verifier: unconfiguredVerifier };
}

export function useSave(): SaveData {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function formatCash(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}
