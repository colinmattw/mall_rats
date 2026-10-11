import { ECONOMY } from '../config/economy';
import { makeId } from '../engine/rng';
import type { GameStore } from '../economy/store';

/**
 * Optional rewarded ads only. There are no interstitials, no banners and no
 * ad is ever required to play. The player must explicitly choose to watch.
 *
 * Currency is granted only after a verified completion, and each reward id
 * can pay out at most once (duplicate callbacks are ignored by the store).
 */
export type AdOutcome =
  | { status: 'completed'; rewardId: string; token: string }
  | { status: 'cancelled' }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; message: string };

export interface RewardedAdProvider {
  readonly id: string;
  readonly label: string;
  /** Development mocks must never be presented as real ads. */
  readonly isDevelopmentMock: boolean;
  isAvailable(): boolean;
  show(placement: string): Promise<AdOutcome>;
  /** Production: confirm via the ad network's server-side verification callback. */
  verify(outcome: Extract<AdOutcome, { status: 'completed' }>): Promise<boolean>;
}

/** Default provider: ads are off. The UI hides the ad action entirely. */
export class DisabledAdProvider implements RewardedAdProvider {
  readonly id = 'disabled';
  readonly label = 'Ads disabled';
  readonly isDevelopmentMock = false;
  isAvailable(): boolean {
    return false;
  }
  async show(): Promise<AdOutcome> {
    return { status: 'unavailable', reason: 'Rewarded ads are not configured in this build.' };
  }
  async verify(): Promise<boolean> {
    return false;
  }
}

export type MockAdMode = 'interactive' | 'completed' | 'cancelled' | 'unavailable' | 'error';

/**
 * Development-only mock. Shows an obviously fake "ad" overlay (supplied by the
 * UI through `presenter`) and lets testers force every outcome.
 */
export class MockAdProvider implements RewardedAdProvider {
  readonly id = 'mock-dev';
  readonly label = 'Development mock ad';
  readonly isDevelopmentMock = true;
  mode: MockAdMode = 'interactive';
  presenter: ((placement: string) => Promise<'completed' | 'cancelled' | 'error'>) | null = null;
  /** Emit the completion callback twice (tests duplicate-callback safety). */
  duplicateCallbacks = false;
  private issued = new Map<string, string>();

  isAvailable(): boolean {
    return this.mode !== 'unavailable';
  }

  async show(placement: string): Promise<AdOutcome> {
    if (this.mode === 'unavailable') return { status: 'unavailable', reason: 'Mock: no fill available.' };
    if (this.mode === 'error') return { status: 'error', message: 'Mock: ad failed to load.' };
    if (this.mode === 'cancelled') return { status: 'cancelled' };
    let result: 'completed' | 'cancelled' | 'error' = 'completed';
    if (this.mode === 'interactive' && this.presenter) result = await this.presenter(placement);
    if (result === 'cancelled') return { status: 'cancelled' };
    if (result === 'error') return { status: 'error', message: 'Mock: playback error.' };
    const rewardId = makeId('adreward');
    const token = makeId('adtoken');
    this.issued.set(rewardId, token);
    return { status: 'completed', rewardId, token };
  }

  async verify(outcome: Extract<AdOutcome, { status: 'completed' }>): Promise<boolean> {
    return this.issued.get(outcome.rewardId) === outcome.token;
  }
}

export type WatchAdResult =
  | { status: 'granted'; amount: number; balance: number }
  | { status: 'cancelled' }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; message: string }
  | { status: 'capped'; message: string };

export async function watchRewardedAd(provider: RewardedAdProvider, store: GameStore, placement: string): Promise<WatchAdResult> {
  if (!provider.isAvailable()) return { status: 'unavailable', reason: 'No ad available right now.' };
  if (store.adRewardsToday() >= ECONOMY.rewardedAd.dailyCap) {
    return { status: 'capped', message: 'You have reached today\u2019s ad rewards.' };
  }
  let outcome: AdOutcome;
  try {
    outcome = await provider.show(placement);
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Ad failed.' };
  }
  if (outcome.status === 'cancelled') return { status: 'cancelled' };
  if (outcome.status === 'unavailable') return { status: 'unavailable', reason: outcome.reason };
  if (outcome.status === 'error') return { status: 'error', message: outcome.message };
  const verified = await provider.verify(outcome).catch(() => false);
  if (!verified) return { status: 'error', message: 'Ad completion could not be verified. Nothing was charged or granted.' };
  const grant = store.grantAdReward({ rewardId: outcome.rewardId, verified: true, provider: provider.id });
  if (provider instanceof MockAdProvider && provider.duplicateCallbacks) {
    store.grantAdReward({ rewardId: outcome.rewardId, verified: true, provider: provider.id });
  }
  if (!grant.ok) {
    if (grant.code === 'cap_reached') return { status: 'capped', message: grant.message };
    return { status: 'error', message: grant.message };
  }
  return { status: 'granted', amount: grant.value.amount, balance: grant.value.balance };
}
