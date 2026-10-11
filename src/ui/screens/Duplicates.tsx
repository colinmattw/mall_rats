import { useRef, useState } from 'react';
import { audio } from '../../audio/audio';
import { RARITY_LABELS, type CatalogItem } from '../../config/catalog';
import { sellValue } from '../../config/economy';
import { makeId } from '../../engine/rng';
import { useApp } from '../AppContext';
import { Btn, CashAmount, Modal, RarityTag, ScreenHeader, WalletPill } from '../components';
import { ItemArt } from '../ItemArt';
import { formatCash, store, useSave } from '../services';

type Pending = { kind: 'one'; item: CatalogItem; payout: number } | { kind: 'all'; payout: number; count: number };

export function DuplicatesPanel() {
  useSave();
  const [pending, setPending] = useState<Pending | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const saleId = useRef(makeId('sale'));
  const { items, payout } = store.previewSellAll();

  const open = (p: Pending) => {
    saleId.current = makeId('sale');
    setMsg(null);
    setPending(p);
  };

  const confirm = () => {
    if (!pending) return;
    const r = pending.kind === 'one' ? store.sellDuplicates(saleId.current, pending.item.id, 1) : store.sellAllDuplicates(saleId.current, pending.payout);
    setPending(null);
    if (r.ok) {
      audio.play('sell');
      setMsg(r.replayed ? 'Already sold.' : `Sold for ${formatCash(r.value.payout)} Mall Cash.`);
    } else {
      audio.play('error');
      setMsg(r.message);
    }
  };

  return (
    <div className="dupes" data-testid="duplicates">
      <p className="muted">
        Extra copies come from mystery bags. You always keep one owned copy — selling only removes extras.
      </p>
      {msg && (
        <p className="ok-text" data-testid="sale-message">
          {msg}
        </p>
      )}
      {items.length === 0 ? (
        <p className="muted center" data-testid="no-duplicates">
          No duplicates right now.
        </p>
      ) : (
        <>
          <ul className="dupe-list">
            {items.map(({ item, quantity }) => (
              <li key={item.id} className="dupe-row" data-testid={`dupe-${item.id}`}>
                <ItemArt item={item} size={52} />
                <div className="dupe-info">
                  <strong>{item.name}</strong>
                  <div className="dupe-meta">
                    <RarityTag rarity={item.rarity} /> <span data-testid={`dupe-count-${item.id}`}>{quantity} extra</span>
                  </div>
                </div>
                <Btn size="sm" variant="gold" testId={`sell-one-${item.id}`} onClick={() => open({ kind: 'one', item, payout: sellValue(item.rarity) })}>
                  Sell 1 · {formatCash(sellValue(item.rarity))}
                </Btn>
              </li>
            ))}
          </ul>
          <Btn variant="primary" testId="sell-all" onClick={() => open({ kind: 'all', payout, count: items.reduce((n, i) => n + i.quantity, 0) })}>
            Review & sell all · {formatCash(payout)}
          </Btn>
        </>
      )}
      {pending && (
        <Modal
          title={pending.kind === 'one' ? 'Sell duplicate?' : 'Sell all duplicates?'}
          testId="confirm-sale"
          onClose={() => setPending(null)}
          actions={
            <>
              <Btn variant="ghost" onClick={() => setPending(null)} testId="sale-keep">
                Keep
              </Btn>
              <Btn variant="primary" onClick={confirm} testId="sale-confirm">
                Sell for {formatCash(pending.payout)}
              </Btn>
            </>
          }
        >
          {pending.kind === 'one' ? (
            <p>
              Sell 1 extra <strong>{pending.item.name}</strong> ({RARITY_LABELS[pending.item.rarity]}) for <CashAmount amount={pending.payout} size="sm" />? Your owned copy stays in your collection.
            </p>
          ) : (
            <>
              <p>
                Sell {pending.count} extra cop{pending.count === 1 ? 'y' : 'ies'} for exactly <CashAmount amount={pending.payout} size="sm" />. Every owned copy stays.
              </p>
              <ul className="sale-breakdown">
                {items.map(({ item, quantity, payout: p }) => (
                  <li key={item.id}>
                    {quantity} × {item.name} <span>{formatCash(p)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

export function DuplicatesScreen() {
  const save = useSave();
  const app = useApp();
  return (
    <div className="screen panel-screen" data-testid="duplicates-screen">
      <ScreenHeader title="Duplicates" onBack={app.back} right={<WalletPill amount={save.wallet.cash} />} />
      <div className="panel-scroll">
        <DuplicatesPanel />
      </div>
    </div>
  );
}
