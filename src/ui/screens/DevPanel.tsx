import { useState } from 'react';
import { RARITIES, RARITY_LABELS, type Rarity } from '../../config/catalog';
import type { MockAdMode } from '../../monetization/ads';
import type { MockPurchaseMode } from '../../monetization/billing';
import { useApp } from '../AppContext';
import { Btn, Chip, ScreenHeader, Toggle } from '../components';
import { formatCash, mockAds, mockBilling, store, useSave } from '../services';

/** Development-only fixtures (excluded from production builds). */
export function DevPanel() {
  const save = useSave();
  const app = useApp();
  const [adMode, setAdMode] = useState<MockAdMode>(mockAds?.mode ?? 'interactive');
  const [payMode, setPayMode] = useState<MockPurchaseMode>(mockBilling?.mode ?? 'interactive');
  const [dupCallbacks, setDupCallbacks] = useState(mockAds?.duplicateCallbacks ?? false);
  const d = save.drop;
  const note = (title: string) => app.toast({ kind: 'info', title });

  return (
    <div className="screen panel-screen" data-testid="dev-panel">
      <ScreenHeader title="Dev fixtures" sub="Development builds only" onBack={app.back} />
      <div className="panel-scroll">
        <section className="settings-group">
          <h3>Wallet</h3>
          <div className="btn-wrap">
            <Btn testId="dev-cash-1k" onClick={() => (store.dev.grantCash(1000), note('+1,000'))}>
              +1,000
            </Btn>
            <Btn testId="dev-cash-25k" onClick={() => (store.dev.grantCash(25000), note('+25,000'))}>
              +25,000
            </Btn>
            <Btn testId="dev-cash-zero" onClick={() => (store.dev.setCash(0), note('Wallet emptied'))}>
              Set to 0 (insufficient funds)
            </Btn>
          </div>
        </section>
        <section className="settings-group">
          <h3>Rare bag rewards</h3>
          <div className="btn-wrap">
            {RARITIES.map((r: Rarity) => (
              <Btn key={r} testId={`dev-bag-${r}`} onClick={() => (store.dev.grantBagOfRarity(r), note(`${RARITY_LABELS[r]} bag granted`))}>
                {RARITY_LABELS[r]} bag
              </Btn>
            ))}
          </div>
          <div className="btn-wrap">
            <Btn testId="dev-dupes" onClick={() => (store.dev.addDuplicates(), note('Duplicates added'))}>
              Add duplicates
            </Btn>
            <Btn testId="dev-bag-soon" onClick={() => (store.dev.forceBagSoon(), note('Next bag within ~120 m'))}>
              Force bag next run
            </Btn>
          </div>
          <p className="muted small" data-testid="drop-state">
            Drop director: {formatCash(d.distanceSinceOpportunity)} m / {formatCash(d.nextOpportunityAt)} m · opportunities {d.opportunities} (collected {d.collected}, missed {d.missed})
          </p>
        </section>
        <section className="settings-group">
          <h3>Wardrobe</h3>
          <div className="btn-wrap">
            <Btn testId="dev-unlock" onClick={() => (store.dev.unlockAll(), note('All items unlocked'))}>
              Unlock all items
            </Btn>
            <Btn testId="dev-outfit" onClick={() => (store.dev.randomOutfit(), note('Random outfit equipped'))}>
              Random outfit
            </Btn>
          </div>
        </section>
        <section className="settings-group">
          <h3>Runs</h3>
          <div className="btn-wrap">
            <Btn
              testId="dev-capture"
              onClick={() => {
                app.startRun({ tutorial: false });
                setTimeout(() => {
                  const sim = app.runtime()?.sim;
                  sim?.security.add(100);
                }, 1500);
              }}
            >
              Run → capture after 1.5 s
            </Btn>
            <Btn
              testId="dev-autopilot"
              onClick={() => {
                app.startRun({ tutorial: false });
                setTimeout(() => app.runtime()?.setAutopilot(true), 50);
              }}
            >
              Run with autopilot
            </Btn>
          </div>
        </section>
        <section className="settings-group">
          <h3>Mock rewarded ad</h3>
          <div className="chip-row wrap">
            {(['interactive', 'completed', 'cancelled', 'unavailable', 'error'] as MockAdMode[]).map((m) => (
              <Chip
                key={m}
                active={adMode === m}
                testId={`dev-ad-${m}`}
                onClick={() => {
                  if (mockAds) mockAds.mode = m;
                  setAdMode(m);
                }}
              >
                {m}
              </Chip>
            ))}
          </div>
          <Toggle
            label="Fire duplicate completion callbacks"
            checked={dupCallbacks}
            onChange={(v) => {
              if (mockAds) mockAds.duplicateCallbacks = v;
              setDupCallbacks(v);
            }}
          />
        </section>
        <section className="settings-group">
          <h3>Mock purchases</h3>
          <div className="chip-row wrap">
            {(['interactive', 'success', 'cancel', 'fail', 'pending'] as MockPurchaseMode[]).map((m) => (
              <Chip
                key={m}
                active={payMode === m}
                testId={`dev-pay-${m}`}
                onClick={() => {
                  if (mockBilling) mockBilling.mode = m;
                  setPayMode(m);
                }}
              >
                {m}
              </Chip>
            ))}
          </div>
          <Btn onClick={() => app.go({ name: 'cash' })}>Open Get Mall Cash</Btn>
        </section>
      </div>
    </div>
  );
}
