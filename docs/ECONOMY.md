# Economy

Mall Rats uses one currency: **Mall Cash**. Cosmetics never change gameplay. Spending (or not spending) never changes drop rates, prices, mission rewards or pickup values.

Values below are starting assumptions encoded in `src/config/economy.ts` and `src/config/drops.ts`. They are locked in by tests: if you retune, update this file and re-run `npm test`, `npm run sim:drops` and `npm run report:economy`.

## Typical run

| Knob | Value |
| --- | --- |
| Ordinary run length | 60–90 seconds of active skating |
| Target pickup earnings | **75–150 Mall Cash** |
| Assumed collection rate | 55% of tokens the skater physically passes |
| Starting wallet | 0 |
| Tutorial reward (once) | 600 (enough for a common cosmetic) |

Coin lines are authored per chunk, then scaled by environment (`ECONOMY.coinDensity`) so route tradeoffs stay intact: Food Court still pays more than Maintenance.

Cash is committed during the run (every 90 ticks / 1.5 s, and on every pickup). Crashing, getting caught, quitting or reloading does **not** claw back what was already collected.

## Shop prices (fixed, permanent)

Every non-starter item is directly buyable. Prices sit inside a rarity band:

| Rarity | Shop price | Duplicate sell-back |
| --- | --- | --- |
| Common | 300–600 | 75 |
| Uncommon | 800–1,500 | 150 |
| Rare | 2,500–4,000 | 400 |
| Epic | 6,000–10,000 | 1,000 |
| Legendary | 15,000–25,000 | 2,500 |

A player who never watches ads and never buys packs, skating ordinary 75 s runs at ~100 Mall Cash each:

| Goal | Approximate active skating |
| --- | --- |
| First common (e.g. 350) after the tutorial | a couple of runs (tutorial already pays 600) |
| Uncommon (~1,000) | ~12 minutes |
| Rare (~3,000) | ~40 minutes |
| Epic (~8,000) | ~1.5 hours |
| Legendary (~20,000) | ~4 hours |

Mission rewards (100–400 each) and duplicate sell-back shorten this. A duplicate legendary is worth 2,500 — about 30 minutes of skating — which is why extras are worth selling and why the owned copy is never sold.

## Rewarded ads (optional)

- **100 Mall Cash** per completed, verified video.
- **10 per calendar day**.
- Never required to play, never an interstitial, never an unlock wall.
- Closing early grants nothing. Duplicate SDK callbacks grant nothing.

Ten ads = 1,000 Mall Cash ≈ one uncommon, or a modest slice of a rare.

## Real-money packs (optional)

Fixed amounts only. Localized prices come from the platform store at runtime — they are not hardcoded.

| Product id | Mall Cash |
| --- | --- |
| `mallrats.cash.1000` | 1,000 (Pocket Change) |
| `mallrats.cash.3000` | 3,000 (Allowance) |
| `mallrats.cash.7500` | 7,500 (Paycheck) |
| `mallrats.cash.20000` | 20,000 (Mall Mogul) |

Packs never change drop odds or shop prices. See `docs/MONETIZATION.md`.

## Mystery bags

| Knob | Value |
| --- | --- |
| Opportunity window | 20–30 minutes of **active skating** |
| Hard drought cap | 32 minutes |
| Unit | Distance, using a 13.0 m/s reference speed (average of ordinary 60–90 s runs on the real speed curve) |
| Persist | Metres-to-next-bag is pre-rolled and saved. Reloading cannot reroll it. |
| Contents | One cosmetic, rolled from a dedicated RNG stream at collection time. Reloading cannot reroll the item. |
| Odds | Common 50% · Uncommon 28% · Rare 15% · Epic 6% · Legendary 1% |

Paused, backgrounded and menu time do not count. Bags are never sold, gifted, or made more likely by spending. If a rarity has no eligible items, its weight is redistributed.

A player who skates 30 minutes a day should see about one bag a session, and never go more than ~32 minutes of skating without an opportunity.

## Duplicates

The first copy of an item is permanent. Extra copies from bags can be sold one-at-a-time or as a reviewed “sell all” with a locked payout. Confirming a sale with a stale total is rejected. The equipped copy cannot disappear.

## Missions

Twenty-four curated goals, then endless deterministic repeats. Ordinary missions never require a bag. Rewards are Mall Cash plus optional cosmetic badges (no gameplay effect). Progress for `total` missions accumulates while the mission is active; `run` missions take the best single-run value. Payout is granted the tick the target is met, with an idempotency key per mission instance.
