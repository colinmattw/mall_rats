import { CURRENCY_PACKS, packById } from '../config/iap';
import { makeId } from '../engine/rng';
import type { GameStore } from '../economy/store';

/**
 * In-app purchase abstraction for fixed Mall Cash packs.
 *
 * Flow: purchase -> durable 'pending' record -> authoritative verification ->
 * 'verified' -> fulfil exactly once -> 'fulfilled' -> finish transaction.
 *
 * Browser local storage cannot secure paid currency. Production builds need a
 * native billing plugin plus server-side receipt verification and a
 * server-held wallet; see docs/MONETIZATION.md. Consumable currency cannot be
 * "restored" from a local save.
 */
export interface StoreProduct {
  productId: string;
  amount: number;
  title: string;
  /** Localized price string from the platform. Null when unavailable. */
  localizedPrice: string | null;
}

export type PurchaseOutcome =
  | { status: 'purchased'; transactionId: string; productId: string; receipt: string }
  | { status: 'pending'; transactionId: string; productId: string }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

export type BillingEnvironment = 'development' | 'sandbox' | 'production';

export interface BillingProvider {
  readonly id: string;
  readonly label: string;
  readonly isDevelopmentMock: boolean;
  readonly environment: BillingEnvironment;
  isConfigured(): boolean;
  getProducts(): Promise<StoreProduct[]>;
  purchase(productId: string): Promise<PurchaseOutcome>;
  /** Ask the platform about a transaction that was left pending. */
  queryTransaction(transactionId: string): Promise<PurchaseOutcome | null>;
  finishTransaction(transactionId: string): Promise<void>;
}

export interface VerificationResult {
  verified: boolean;
  productId: string;
  amount: number;
  environment: BillingEnvironment;
  reason?: string;
}

/** Authoritative receipt verification (a game server in production). */
export interface PurchaseVerifier {
  verify(input: { transactionId: string; productId: string; receipt: string; provider: string }): Promise<VerificationResult>;
}

export class UnconfiguredBillingProvider implements BillingProvider {
  readonly id = 'unconfigured';
  readonly label = 'Purchases unavailable';
  readonly isDevelopmentMock = false;
  readonly environment = 'production' as const;
  isConfigured(): boolean {
    return false;
  }
  async getProducts(): Promise<StoreProduct[]> {
    return CURRENCY_PACKS.map((p) => ({ ...p, localizedPrice: null }));
  }
  async purchase(): Promise<PurchaseOutcome> {
    return { status: 'failed', message: 'Billing is not configured in this build.' };
  }
  async queryTransaction(): Promise<PurchaseOutcome | null> {
    return null;
  }
  async finishTransaction(): Promise<void> {}
}

export class UnconfiguredVerifier implements PurchaseVerifier {
  async verify(input: { productId: string }): Promise<VerificationResult> {
    return { verified: false, productId: input.productId, amount: 0, environment: 'production', reason: 'No verification server configured.' };
  }
}

export type MockPurchaseMode = 'interactive' | 'success' | 'cancel' | 'fail' | 'pending';

/** Development-only mock store. Never charges anything. */
export class MockBillingProvider implements BillingProvider {
  readonly id = 'mock-dev';
  readonly label = 'Development mock store (no real charges)';
  readonly isDevelopmentMock = true;
  readonly environment = 'development' as const;
  mode: MockPurchaseMode = 'interactive';
  presenter: ((product: StoreProduct) => Promise<'success' | 'cancel' | 'fail' | 'pending'>) | null = null;
  /** Receipts the mock "server" will accept. */
  readonly issuedReceipts = new Map<string, { productId: string; receipt: string }>();
  private pending = new Map<string, string>();
  finished: string[] = [];

  isConfigured(): boolean {
    return true;
  }

  async getProducts(): Promise<StoreProduct[]> {
    // Obviously fake test labels; production prices always come from the platform.
    return CURRENCY_PACKS.map((p, i) => ({ ...p, localizedPrice: `TEST ${['A', 'B', 'C', 'D'][i] ?? 'X'}` }));
  }

  async purchase(productId: string): Promise<PurchaseOutcome> {
    const product = (await this.getProducts()).find((p) => p.productId === productId);
    if (!product) return { status: 'failed', message: 'Unknown product.' };
    let mode: 'success' | 'cancel' | 'fail' | 'pending' = this.mode === 'interactive' ? 'success' : this.mode;
    if (this.mode === 'interactive' && this.presenter) mode = await this.presenter(product);
    const transactionId = makeId('devtx');
    if (mode === 'cancel') return { status: 'cancelled' };
    if (mode === 'fail') return { status: 'failed', message: 'Mock: payment declined.' };
    if (mode === 'pending') {
      this.pending.set(transactionId, productId);
      return { status: 'pending', transactionId, productId };
    }
    const receipt = makeId('devreceipt');
    this.issuedReceipts.set(transactionId, { productId, receipt });
    return { status: 'purchased', transactionId, productId, receipt };
  }

  /** Simulate the platform approving a deferred / pending payment. */
  approvePending(transactionId: string): void {
    const productId = this.pending.get(transactionId);
    if (!productId) return;
    this.pending.delete(transactionId);
    this.issuedReceipts.set(transactionId, { productId, receipt: makeId('devreceipt') });
  }

  async queryTransaction(transactionId: string): Promise<PurchaseOutcome | null> {
    const issued = this.issuedReceipts.get(transactionId);
    if (issued) return { status: 'purchased', transactionId, productId: issued.productId, receipt: issued.receipt };
    const pendingProduct = this.pending.get(transactionId);
    if (pendingProduct) return { status: 'pending', transactionId, productId: pendingProduct };
    return null;
  }

  async finishTransaction(transactionId: string): Promise<void> {
    this.finished.push(transactionId);
  }
}

/** Stands in for a verification server during development. */
export class MockPurchaseVerifier implements PurchaseVerifier {
  constructor(private readonly provider: MockBillingProvider) {}
  async verify(input: { transactionId: string; productId: string; receipt: string }): Promise<VerificationResult> {
    const issued = this.provider.issuedReceipts.get(input.transactionId);
    const pack = packById(input.productId);
    const verified = !!issued && !!pack && issued.receipt === input.receipt && issued.productId === input.productId;
    return {
      verified,
      productId: input.productId,
      amount: verified ? pack!.amount : 0,
      environment: 'development',
      reason: verified ? undefined : 'Receipt rejected by mock verifier.',
    };
  }
}

export type BuyResult =
  | { status: 'fulfilled'; amount: number; balance: number; transactionId: string; environment: BillingEnvironment }
  | { status: 'pending'; transactionId: string }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

async function verifyAndFulfil(
  provider: BillingProvider,
  verifier: PurchaseVerifier,
  store: GameStore,
  outcome: Extract<PurchaseOutcome, { status: 'purchased' }>,
): Promise<BuyResult> {
  const pack = packById(outcome.productId);
  if (!pack) return { status: 'failed', message: 'Unknown product.' };
  store.recordPurchase({
    transactionId: outcome.transactionId,
    productId: outcome.productId,
    amount: pack.amount,
    provider: provider.id,
    environment: provider.environment,
    status: 'pending',
  });
  const verification = await verifier
    .verify({ transactionId: outcome.transactionId, productId: outcome.productId, receipt: outcome.receipt, provider: provider.id })
    .catch((e: unknown) => ({ verified: false, productId: outcome.productId, amount: 0, environment: provider.environment, reason: String(e) }) as VerificationResult);
  if (!verification.verified || verification.amount !== pack.amount) {
    store.setPurchaseStatus(outcome.transactionId, 'failed', verification.reason ?? 'Verification failed');
    return { status: 'failed', message: 'The purchase could not be verified. No Mall Cash was granted.' };
  }
  store.setPurchaseStatus(outcome.transactionId, 'verified');
  const granted = store.fulfillPurchase(outcome.transactionId);
  if (!granted.ok) return { status: 'failed', message: granted.message };
  await provider.finishTransaction(outcome.transactionId);
  return {
    status: 'fulfilled',
    amount: granted.replayed ? 0 : granted.value.amount,
    balance: granted.value.balance,
    transactionId: outcome.transactionId,
    environment: provider.environment,
  };
}

export async function buyCurrencyPack(
  provider: BillingProvider,
  verifier: PurchaseVerifier,
  store: GameStore,
  productId: string,
): Promise<BuyResult> {
  if (!provider.isConfigured()) return { status: 'failed', message: 'Purchases are not available in this build.' };
  const pack = packById(productId);
  if (!pack) return { status: 'failed', message: 'Unknown product.' };
  let outcome: PurchaseOutcome;
  try {
    outcome = await provider.purchase(productId);
  } catch (e) {
    return { status: 'failed', message: e instanceof Error ? e.message : 'Purchase failed.' };
  }
  if (outcome.status === 'cancelled') return { status: 'cancelled' };
  if (outcome.status === 'failed') return { status: 'failed', message: outcome.message };
  if (outcome.status === 'pending') {
    store.recordPurchase({
      transactionId: outcome.transactionId,
      productId,
      amount: pack.amount,
      provider: provider.id,
      environment: provider.environment,
      status: 'pending',
    });
    return { status: 'pending', transactionId: outcome.transactionId };
  }
  return verifyAndFulfil(provider, verifier, store, outcome);
}

/** Resume any purchase left pending / verified-but-unfulfilled (call on startup). */
export async function resumePendingPurchases(provider: BillingProvider, verifier: PurchaseVerifier, store: GameStore): Promise<BuyResult[]> {
  const results: BuyResult[] = [];
  for (const rec of store.pendingFulfillment()) {
    if (rec.provider !== provider.id) continue;
    if (rec.status === 'verified') {
      const granted = store.fulfillPurchase(rec.transactionId);
      if (granted.ok) {
        await provider.finishTransaction(rec.transactionId);
        results.push({ status: 'fulfilled', amount: granted.value.amount, balance: granted.value.balance, transactionId: rec.transactionId, environment: rec.environment });
      }
      continue;
    }
    const outcome = await provider.queryTransaction(rec.transactionId);
    if (outcome?.status === 'purchased') results.push(await verifyAndFulfil(provider, verifier, store, outcome));
    else if (outcome?.status === 'pending') results.push({ status: 'pending', transactionId: rec.transactionId });
  }
  return results;
}
