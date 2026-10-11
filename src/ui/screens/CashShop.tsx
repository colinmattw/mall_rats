import { useEffect, useState } from 'react';
import { audio } from '../../audio/audio';
import { ECONOMY } from '../../config/economy';
import { watchRewardedAd } from '../../monetization/ads';
import { buyCurrencyPack, resumePendingPurchases, type StoreProduct } from '../../monetization/billing';
import { useApp } from '../AppContext';
import { Btn, CashAmount, ScreenHeader, WalletPill } from '../components';
import { TvIcon } from '../icons';
import { adProvider, billing, formatCash, mockBilling, store, useSave } from '../services';

/** Provider-aware Mall Cash screen: optional rewarded ad + fixed currency packs. */
export function CashShop() {
  const save = useSave();
  const app = useApp();
  const { provider, verifier } = billing();
  const ads = adProvider();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void provider.getProducts().then((p) => alive && setProducts(p));
    void resumePendingPurchases(provider, verifier, store);
    return () => {
      alive = false;
    };
  }, [provider, verifier]);

  const adAvailable = ads.isAvailable();
  const adsLeft = Math.max(0, ECONOMY.rewardedAd.dailyCap - store.adRewardsToday());
  const pending = Object.values(save.purchases).filter((p) => p.status === 'pending');
  const recent = Object.values(save.purchases)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);

  const buy = async (p: StoreProduct) => {
    setBusy(p.productId);
    setMsg(null);
    const r = await buyCurrencyPack(provider, verifier, store, p.productId);
    setBusy(null);
    if (r.status === 'fulfilled') {
      audio.play('purchase');
      setMsg({ tone: 'ok', text: `+${formatCash(r.amount)} Mall Cash${r.environment === 'development' ? ' (development transaction — no money involved)' : ''}.` });
    } else if (r.status === 'pending') setMsg({ tone: 'warn', text: 'Payment pending. Mall Cash will be added once the store confirms it.' });
    else if (r.status === 'cancelled') setMsg({ tone: 'warn', text: 'Purchase cancelled. Nothing was charged.' });
    else setMsg({ tone: 'warn', text: r.message });
  };

  const watch = async () => {
    setBusy('ad');
    setMsg(null);
    const r = await watchRewardedAd(ads, store, 'cash-shop');
    setBusy(null);
    if (r.status === 'granted') setMsg({ tone: 'ok', text: `+${r.amount} Mall Cash for watching.` });
    else if (r.status === 'cancelled') setMsg({ tone: 'warn', text: 'Ad closed early — no reward, nothing lost.' });
    else if (r.status === 'unavailable') setMsg({ tone: 'warn', text: r.reason });
    else setMsg({ tone: 'warn', text: r.message });
  };

  return (
    <div className="screen panel-screen" data-testid="cash-shop">
      <ScreenHeader title="Get Mall Cash" sub="Always optional" onBack={app.back} right={<WalletPill amount={save.wallet.cash} />} />
      <div className="panel-scroll">
        <p className="muted">Every cosmetic can be earned just by skating. Nothing here changes gameplay, drop odds or prices.</p>
        {msg && (
          <p className={msg.tone === 'ok' ? 'ok-text' : 'warn-text'} data-testid="cash-message">
            {msg.text}
          </p>
        )}

        {adAvailable && (
          <section className="info-card ad-card" data-testid="ad-card">
            <h3>Rewarded video</h3>
            <Btn variant="dark" icon={<TvIcon />} disabled={busy !== null || adsLeft === 0} onClick={watch} testId="watch-ad">
              Watch an ad — earn {ECONOMY.rewardedAd.amount} Mall Cash
            </Btn>
            <p className="muted small">
              {adsLeft} left today. {ads.isDevelopmentMock ? 'Development mock — not a real ad.' : ''}
            </p>
          </section>
        )}

        <section className="info-card">
          <h3>Mall Cash packs</h3>
          {!provider.isConfigured() && (
            <p className="warn-text" data-testid="billing-unavailable">
              Purchases are unavailable in this build. Store billing has not been configured.
            </p>
          )}
          {provider.isDevelopmentMock && (
            <p className="dev-label block" data-testid="billing-dev">
              DEVELOPMENT MOCK STORE — test transactions only, no real charges.
            </p>
          )}
          <ul className="pack-list">
            {products.map((p) => (
              <li key={p.productId} className="pack" data-testid={`pack-${p.amount}`}>
                <div>
                  <strong>{p.title}</strong>
                  <CashAmount amount={p.amount} />
                </div>
                <Btn variant="gold" disabled={!provider.isConfigured() || busy !== null || !p.localizedPrice} onClick={() => buy(p)} testId={`buy-pack-${p.amount}`}>
                  {p.localizedPrice ?? 'Unavailable'}
                </Btn>
              </li>
            ))}
          </ul>
          <p className="muted small">Prices shown come from the platform store. Paid Mall Cash is granted only after the purchase is verified.</p>
        </section>

        {pending.length > 0 && (
          <section className="info-card" data-testid="pending-purchases">
            <h3>Pending</h3>
            {pending.map((p) => (
              <div className="row" key={p.transactionId}>
                <span>
                  {formatCash(p.amount)} Mall Cash {p.environment === 'development' && <span className="dev-label">DEV</span>}
                </span>
                {mockBilling && provider === mockBilling && (
                  <Btn
                    size="sm"
                    testId="approve-pending"
                    onClick={async () => {
                      mockBilling?.approvePending(p.transactionId);
                      const res = await resumePendingPurchases(provider, verifier, store);
                      const done = res.find((x) => x.status === 'fulfilled');
                      if (done && done.status === 'fulfilled') setMsg({ tone: 'ok', text: `Pending payment approved: +${formatCash(done.amount)} Mall Cash (development).` });
                    }}
                  >
                    Approve (dev)
                  </Btn>
                )}
              </div>
            ))}
          </section>
        )}

        {recent.length > 0 && (
          <section className="info-card">
            <h3>Recent transactions</h3>
            {recent.map((p) => (
              <div className="row small" key={p.transactionId} data-testid="purchase-row">
                <span>
                  {formatCash(p.amount)} · {p.status}
                  {p.environment !== 'production' && <span className="dev-label">{p.environment === 'development' ? 'DEV' : 'SANDBOX'}</span>}
                </span>
                <span className="muted">{new Date(p.updatedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
