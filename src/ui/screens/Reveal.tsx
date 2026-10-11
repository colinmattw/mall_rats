import { useState } from 'react';
import { audio } from '../../audio/audio';
import { RARITY_COLORS, RARITY_LABELS, getItem } from '../../config/catalog';
import { sellValue } from '../../config/economy';
import type { UnrevealedReward } from '../../economy/saveSchema';
import { useApp } from '../AppContext';
import { Btn, CashAmount, RarityTag, ScreenHeader } from '../components';
import { BagIcon } from '../icons';
import { ItemArt } from '../ItemArt';
import { store, useSave } from '../services';

export function RevealCard({ reward, revealed, onReveal }: { reward: UnrevealedReward; revealed: boolean; onReveal: () => void }) {
  const save = useSave();
  const app = useApp();
  const item = getItem(reward.itemId);
  if (!item) return null;
  const equipped = save.equipped[item.slot] === item.id;
  return (
    <div className={`reveal-card ${revealed ? 'flipped' : ''}`} data-testid={`reveal-${reward.rewardId}`} style={{ ['--rarity' as string]: RARITY_COLORS[item.rarity] }}>
      {!revealed ? (
        <button
          type="button"
          className="reveal-back"
          data-testid="reveal-button"
          onClick={() => {
            audio.play('bagCollect');
            onReveal();
          }}
        >
          <BagIcon size={34} />
          <span>Tap to reveal</span>
        </button>
      ) : (
        <div className="reveal-front">
          <div className="reveal-art">
            <ItemArt item={item} size={84} />
            {reward.duplicate ? <span className="badge-dupe big">DUPLICATE</span> : <span className="badge-new big">NEW</span>}
          </div>
          <div className="reveal-name">{item.name}</div>
          <RarityTag rarity={item.rarity} />
          {reward.duplicate ? (
            <div className="reveal-note">
              Extra copy saved. Sell value <CashAmount amount={sellValue(item.rarity)} size="sm" />
            </div>
          ) : equipped ? (
            <div className="reveal-note">Equipped</div>
          ) : (
            <Btn
              size="sm"
              variant="teal"
              testId={`equip-${item.id}`}
              onClick={() => {
                const r = store.equip(item.id);
                if (r.ok) app.toast({ kind: 'info', title: `${item.name} equipped`, body: `${RARITY_LABELS[item.rarity]} ${item.slot}` });
              }}
            >
              Equip
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

export function RevealScreen() {
  const save = useSave();
  const app = useApp();
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [rewards] = useState(() => [...save.unrevealed]);
  const reveal = (ids: string[]) => {
    setShown((s) => new Set([...s, ...ids]));
    store.markRevealed(ids);
  };
  return (
    <div className="screen panel-screen" data-testid="reveal-screen">
      <ScreenHeader title="Item Reveal" onBack={app.back} />
      <div className="panel-scroll">
        {rewards.length === 0 && <p className="muted center">Nothing waiting to be revealed.</p>}
        <div className="reveal-grid">
          {rewards.map((r) => (
            <RevealCard key={r.rewardId} reward={r} revealed={shown.has(r.rewardId)} onReveal={() => reveal([r.rewardId])} />
          ))}
        </div>
        {rewards.length > 1 && shown.size < rewards.length && (
          <Btn variant="gold" onClick={() => reveal(rewards.map((r) => r.rewardId))} testId="reveal-all">
            Reveal all
          </Btn>
        )}
      </div>
    </div>
  );
}
