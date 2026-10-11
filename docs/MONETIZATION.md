# Monetization

Ads and real-money purchases are **optional**. They never gate play, never change drop odds, shop prices, mission rewards or physics, and they never appear as interstitials or banners.

Development builds include clearly labelled mocks. Production web builds ship with ads disabled and billing unconfigured until native plugins + a verification server are wired.

## Rewarded video

Interface: `RewardedAdProvider` in `src/monetization/ads.ts`.

| Implementation | When it is used |
| --- | --- |
| `DisabledAdProvider` | Production, or when the player turns mocks off |
| `MockAdProvider` | Development only (`import.meta.env.DEV` or `VITE_ENABLE_MOCK_PROVIDERS=true`) |

Flow:

1. The player taps **Watch an ad** on Results or Get Mall Cash. Nothing auto-plays.
2. `provider.show(placement)` runs. Cancel / error / no-fill → no currency.
3. `provider.verify(outcome)` must return true. In production this is the ad network’s server-side callback (S2S), not a client boolean.
4. `GameStore.grantAdReward({ rewardId, verified: true })` pays **100 Mall Cash** at most once per `rewardId`, at most **10 times per local calendar day**.

Duplicate completion callbacks are ignored. Closing early grants nothing.

### Production wiring

Replace `DisabledAdProvider` with a thin adapter around a native plugin (for example AdMob rewarded via Capacitor). Keep verification on a server: the client sends `{ rewardId, token }`, the server talks to the network, then the server (or a signed receipt) is what `verify()` trusts. Do not grant currency from an unverified client event.

## In-app purchases

Interface: `BillingProvider` + `PurchaseVerifier` in `src/monetization/billing.ts`.

Packs (`src/config/iap.ts`) are **fixed Mall Cash amounts**. This file does **not** contain real-money prices. The UI always shows `localizedPrice` from the platform. If that string is missing, the buy button stays unavailable.

| Product id | Amount |
| --- | --- |
| `mallrats.cash.1000` | 1,000 |
| `mallrats.cash.3000` | 3,000 |
| `mallrats.cash.7500` | 7,500 |
| `mallrats.cash.20000` | 20,000 |

Flow:

1. `purchase(productId)` → `purchased` | `pending` | `cancelled` | `failed`.
2. A durable `PurchaseRecord` is written as `pending`.
3. `PurchaseVerifier.verify({ transactionId, productId, receipt, provider })` is the **authoritative** check (App Store Server API / Google Play Developer API on your backend). Amount must match the pack.
4. Status becomes `verified`, then `fulfillPurchase` grants currency **once**, then `finishTransaction`.
5. `resumePendingPurchases` on startup finishes anything left `pending` / `verified`.

Cancel and fail grant nothing. A rejected receipt marks the record `failed` and leaves the wallet unchanged.

Consumable Mall Cash **cannot** be restored from a local save. If a player reinstalls, only unfinished (`pending`/`verified`) platform transactions should be queried and fulfilled. Already-spent cash does not come back.

### Production wiring

- iOS: StoreKit 2 (or a Capacitor Purchases plugin) + App Store Server notifications.
- Android: Play Billing Library + Real-time developer notifications.
- Hold the paid wallet on a server keyed by a stable account id. Browser `localStorage` is fine for earned cosmetics in a web demo; it is **not** a source of truth for money.

`UnconfiguredBillingProvider` is the safe default: the Get Mall Cash screen explains that purchases are unavailable.

## What is never sold

- Mystery bags, keys, rerolls, pity timers, or better odds.
- Gameplay power (speed, shields, extra jumps, score multipliers).
- The ability to skip or mute the security system.
- Forced ads.

## Development fixtures

The Dev screen can force mock ad outcomes (`completed`, `cancelled`, `unavailable`, `error`, duplicate callbacks) and mock purchase outcomes (`success`, `cancel`, `fail`, `pending` + Approve). The overlays are labelled **DEVELOPMENT MOCK**. They are compiled out of production bundles because `MOCKS_ALLOWED` is false there.
