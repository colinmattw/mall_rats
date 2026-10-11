import { useState } from 'react';
import { RARITY_LABELS, getItem } from '../../config/catalog';
import { ECONOMY } from '../../config/economy';
import type { RunResult } from '../../economy/store';
import { watchRewardedAd } from '../../monetization/ads';
import { useApp } from '../AppContext';
import { Btn, CashAmount, ProgressBar } from '../components';
import { TargetIcon, TvIcon } from '../icons';
import { adProvider, formatCash, store, useSave } from '../services';
import { RevealCard } from './Reveal';

const TITLES: Record<string, { title: string; sub: string }> = {
  captured: { title: 'BUSTED!', sub: 'Mall security caught up with you.' },
  crash: { title: 'WIPEOUT!', sub: 'That one had hazard stripes for a reason.' },
  quit: { title: 'RUN OVER', sub: 'You called it a day.' },
  tutorialComplete: { title: 'TUTORIAL DONE', sub: 'You know the moves. Now skate the mall.' },
};

export function Results({ result, onMenu }: { result: RunResult; onMenu: () => void }) {
  const save = useSave();
  const app = useApp();
  const s = result.summary;
  const head = TITLES[s.endReason] ?? TITLES.quit!;
  const [shown, setShown] = useState<Set<string>>(() => new Set(result.rewards.filter((r) => !save.unrevealed.some((u) => u.rewardId === r.rewardId)).map((r) => r.rewardId)));
  const [adBusy, setAdBusy] = useState(false);
  const [adMsg, setAdMsg] = useState<string | null>(null);
  const target = getItem(save.saveTarget);
  const newItems = result.rewards.filter((r) => !r.duplicate).map((r) => getItem(r.itemId)!).filter(Boolean);
  const unequippedNew = newItems.filter((it) => save.equipped[it.slot] !== it.id && save.owned[it.id]);
  const hasDuplicates = Object.values(save.duplicates).some((n) => n > 0);
  const provider = adProvider();
  const adAvailable = provider.isAvailable() && store.adRewardsToday() < ECONOMY.rewardedAd.dailyCap;
  const missionTotal = result.missionRewards.reduce((n, m) => n + m.reward, 0);

  const reveal = (ids: string[]) => {
    setShown((cur) => new Set([...cur, ...ids]));
    store.markRevealed(ids);
  };

  const watchAd = async () => {
    setAdBusy(true);
    setAdMsg(null);
    const r = await watchRewardedAd(provider, store, 'results');
    setAdBusy(false);
    if (r.status === 'granted') setAdMsg(`+${r.amount} Mall Cash added.`);
    else if (r.status === 'cancelled') setAdMsg('Ad closed early. Nothing was granted.');
    else if (r.status === 'unavailable') setAdMsg('No ad available right now.');
    else if (r.status === 'capped') setAdMsg(r.message);
    else setAdMsg(r.message);
  };

  return (
    <div className="screen results-screen" data-testid="results">
      <div className="results-card">
        <div className={`results-title end-${s.endReason}`}>
          <h1 data-testid="results-title">{head.title}</h1>
          <p>{head.sub}</p>
        </div>
        <div className="results-stats">
          <div className="stat-big">
            <span className="label">Distance</span>
            <span className="value" data-testid="results-distance">
              {formatCash(s.distance)} m
            </span>
            {result.records.distance && <span className="record">NEW BEST</span>}
          </div>
          <div className="stat-big">
            <span className="label">Style</span>
            <span className="value" data-testid="results-style">
              {formatCash(s.style)}
            </span>
            {result.records.style && <span className="record">NEW BEST</span>}
          </div>
        </div>
        <div className="results-rows">
          <div className="row">
            <span>Mall Cash collected</span>
            <CashAmount amount={result.cashCollected} sign testId="results-cash" />
          </div>
          {result.missionRewards.map((m) => (
            <div className="row" key={m.instanceId}>
              <span>
                Mission: {m.title}
                {m.badge ? ' (badge)' : ''}
              </span>
              <CashAmount amount={m.reward} sign />
            </div>
          ))}
          {result.tutorialReward > 0 && (
            <div className="row">
              <span>Tutorial reward</span>
              <CashAmount amount={result.tutorialReward} sign />
            </div>
          )}
          <div className="row subtle">
            <span>Already in your wallet</span>
            <CashAmount amount={save.wallet.cash} size="sm" />
          </div>
          {missionTotal === 0 && !result.tutorialReward && <div className="row subtle tiny">Rewards are saved the moment you collect them — nothing is lost when you crash.</div>}
        </div>

        {result.rewards.length > 0 && (
          <div className="results-items">
            <h3>Mystery bag{result.rewards.length > 1 ? 's' : ''}</h3>
            <div className="reveal-grid">
              {result.rewards.map((r) => (
                <RevealCard key={r.rewardId} reward={r} revealed={shown.has(r.rewardId)} onReveal={() => reveal([r.rewardId])} />
              ))}
            </div>
          </div>
        )}

        {target && !save.owned[target.id] && (
          <button type="button" className="goal-widget wide" data-testid="results-goal" onClick={() => app.go({ name: 'shop', focusItem: target.id, slot: target.slot })}>
            <TargetIcon size={18} />
            <div className="goal-text">
              <span>
                Goal: <strong>{target.name}</strong> ({RARITY_LABELS[target.rarity]})
              </span>
              <ProgressBar value={save.wallet.cash} max={target.price} label={`${formatCash(Math.min(save.wallet.cash, target.price))} / ${formatCash(target.price)}`} />
            </div>
          </button>
        )}

        <div className="results-actions">
          <Btn variant="primary" size="xl" testId="run-again" onClick={() => app.startRun({ tutorial: false })}>
            RUN AGAIN
          </Btn>
          <div className="results-secondary">
            {unequippedNew.length > 0 && (
              <Btn
                variant="teal"
                testId="equip-new"
                onClick={() => {
                  const it = unequippedNew[0]!;
                  reveal(result.rewards.filter((r) => r.itemId === it.id).map((r) => r.rewardId));
                  const r = store.equip(it.id);
                  if (r.ok) app.toast({ kind: 'info', title: `${it.name} equipped` });
                }}
              >
                Equip New Item
              </Btn>
            )}
            {hasDuplicates && (
              <Btn testId="review-duplicates" onClick={() => app.go({ name: 'duplicates' })}>
                Review / Sell Duplicates
              </Btn>
            )}
            <Btn variant="gold" testId="results-shop" onClick={() => app.go({ name: 'shop' })}>
              Shop
            </Btn>
            <Btn variant="ghost" testId="results-menu" onClick={onMenu}>
              Menu
            </Btn>
          </div>
          {adAvailable && (
            <div className="ad-offer">
              <Btn variant="dark" icon={<TvIcon />} disabled={adBusy} testId="watch-ad" onClick={watchAd}>
                Watch an ad — earn {ECONOMY.rewardedAd.amount} Mall Cash
              </Btn>
              {provider.isDevelopmentMock && <span className="dev-label">Development mock — not a real ad</span>}
              {adMsg && <span className="ad-msg" data-testid="ad-message">{adMsg}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
