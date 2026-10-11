import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../../audio/audio';
import {
  CATALOG_ITEMS,
  CLOTHING_SLOTS,
  OPTIONAL_SLOTS,
  RARITIES,
  RARITY_COLORS,
  RARITY_LABELS,
  SLOT_LABELS,
  conflictingItems,
  getItem,
  type CatalogItem,
  type ClothingSlot,
  type Loadout,
  type Rarity,
  type Slot,
} from '../../config/catalog';
import { makeId } from '../../engine/rng';
import { useApp } from '../AppContext';
import { Btn, CashAmount, Chip, ItemCard, Modal, RarityTag, ScreenHeader, WalletPill } from '../components';
import { TargetIcon } from '../icons';
import { formatCash, store, useSave } from '../services';
import { DragRotate } from './DragRotate';

export function applyPreview(loadout: Loadout, item: CatalogItem): Loadout {
  const next = { ...loadout, [item.slot]: item.id } as Loadout;
  for (const id of conflictingItems(item.id, next)) {
    const other = getItem(id);
    if (other && OPTIONAL_SLOTS.includes(other.slot)) (next as Record<Slot, string | null>)[other.slot] = null;
  }
  return next;
}

type Sort = 'price-asc' | 'price-desc' | 'rarity';

export function Shop({ initialSlot, focusItem }: { initialSlot?: Slot | 'board'; focusItem?: string }) {
  const save = useSave();
  const app = useApp();
  const [cat, setCat] = useState<'clothing' | 'board'>(initialSlot === 'board' ? 'board' : 'clothing');
  const [slot, setSlot] = useState<ClothingSlot | 'all'>(initialSlot && initialSlot !== 'board' ? (initialSlot as ClothingSlot) : 'all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [sort, setSort] = useState<Sort>('price-asc');
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [hideOwned, setHideOwned] = useState(false);
  const [selected, setSelected] = useState<string | null>(focusItem ?? null);
  const [confirm, setConfirm] = useState<CatalogItem | null>(null);
  const [purchased, setPurchased] = useState<CatalogItem | null>(null);
  const [shortfall, setShortfall] = useState<{ item: CatalogItem; need: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const purchaseId = useRef(makeId('buy'));

  const selectedItem = getItem(selected);
  const previewLoadout = useMemo(() => (selectedItem ? applyPreview(save.equipped, selectedItem) : save.equipped), [selectedItem, save.equipped]);
  const boardFocus = selectedItem ? selectedItem.slot === 'board' : cat === 'board';

  useEffect(() => {
    app.runtime()?.showStudio(boardFocus ? 'board' : 'character', { top: 0.085, bottom: 0.55 }, previewLoadout, save.appearance);
  }, [app, boardFocus, previewLoadout, save.appearance]);

  // Leaving the shop always restores the real outfit on the preview.
  useEffect(() => {
    return () => {
      const s = store.snapshot;
      app.runtime()?.setPreview(s.equipped, s.appearance);
    };
  }, [app]);

  const items = useMemo(() => {
    let list = CATALOG_ITEMS.filter((i) => (cat === 'board' ? i.slot === 'board' : i.slot !== 'board'));
    if (cat === 'clothing' && slot !== 'all') list = list.filter((i) => i.slot === slot);
    if (rarity !== 'all') list = list.filter((i) => i.rarity === rarity);
    if (affordableOnly) list = list.filter((i) => i.price <= save.wallet.cash || save.owned[i.id]);
    if (hideOwned) list = list.filter((i) => !save.owned[i.id]);
    const r = (x: Rarity) => RARITIES.indexOf(x);
    return [...list].sort((a, b) => (sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : r(b.rarity) - r(a.rarity) || a.price - b.price));
  }, [cat, slot, rarity, affordableOnly, hideOwned, sort, save.wallet.cash, save.owned]);

  const owned = selectedItem ? !!save.owned[selectedItem.id] : false;
  const equipped = selectedItem ? save.equipped[selectedItem.slot] === selectedItem.id : false;
  const isGoal = selectedItem ? save.saveTarget === selectedItem.id : false;

  const tryBuy = (item: CatalogItem) => {
    setError(null);
    if (save.wallet.cash < item.price) {
      audio.play('error');
      setShortfall({ item, need: item.price - save.wallet.cash });
      return;
    }
    purchaseId.current = makeId('buy');
    setConfirm(item);
  };

  const doBuy = (item: CatalogItem) => {
    const r = store.purchaseItem(item.id, purchaseId.current);
    setConfirm(null);
    if (r.ok) {
      audio.play('purchase');
      setPurchased(item);
    } else if (r.code === 'insufficient_funds') {
      audio.play('error');
      setShortfall({ item, need: Number(r.detail?.shortfall ?? item.price - save.wallet.cash) });
    } else {
      audio.play('error');
      setError(r.message);
    }
  };

  return (
    <div className="screen shop-screen" data-testid="shop">
      <ScreenHeader title="Shop" sub="Board Room Skate · fixed prices" onBack={app.back} right={<WalletPill amount={save.wallet.cash} onClick={() => app.go({ name: 'cash' })} />} />
      <DragRotate className="preview-drag" />
      {selectedItem && (
        <div className="preview-banner" data-testid="preview-banner">
          {owned ? 'Previewing' : 'Trying on'}: <strong>{selectedItem.name}</strong>
        </div>
      )}
      <div className="sheet catalog-sheet">
        {selectedItem ? (
          <div className="detail" data-testid="item-detail" style={{ ['--rarity' as string]: RARITY_COLORS[selectedItem.rarity] }}>
            <div className="detail-head">
              <div>
                <h2>{selectedItem.name}</h2>
                <div className="detail-meta">
                  <RarityTag rarity={selectedItem.rarity} />
                  <span className="muted">{SLOT_LABELS[selectedItem.slot]}</span>
                </div>
              </div>
              {owned ? <span className="tag-owned big">OWNED</span> : <CashAmount amount={selectedItem.price} size="lg" />}
            </div>
            <p className="detail-desc">{selectedItem.description}</p>
            <p className="detail-fine">Cosmetic only — never changes speed, jumps, hitboxes or scoring.</p>
            {error && <p className="error-text">{error}</p>}
            <div className="detail-actions">
              {!owned && (
                <Btn variant={save.wallet.cash >= selectedItem.price ? 'primary' : 'secondary'} testId="buy" onClick={() => tryBuy(selectedItem)}>
                  {save.wallet.cash >= selectedItem.price ? `Buy · ${formatCash(selectedItem.price)}` : `Need ${formatCash(selectedItem.price - save.wallet.cash)} more`}
                </Btn>
              )}
              {owned && !equipped && (
                <Btn
                  variant="teal"
                  testId="equip"
                  onClick={() => {
                    const r = store.equip(selectedItem.id);
                    if (r.ok) app.toast({ kind: 'info', title: `${selectedItem.name} equipped`, body: r.value.removed.length ? `Removed ${r.value.removed.map((id) => getItem(id)?.name).join(', ')} to avoid clipping.` : undefined });
                  }}
                >
                  Equip
                </Btn>
              )}
              {owned && equipped && (
                <Btn disabled testId="equipped">
                  Equipped
                </Btn>
              )}
              {!owned && (
                <Btn variant="ghost" icon={<TargetIcon size={18} />} testId="save-for" onClick={() => store.setSaveTarget(isGoal ? null : selectedItem.id)}>
                  {isGoal ? 'Saving ✓' : 'Save for this'}
                </Btn>
              )}
              <Btn variant="ghost" testId="cancel-preview" onClick={() => setSelected(null)}>
                {owned ? 'Close' : 'Cancel preview'}
              </Btn>
            </div>
          </div>
        ) : (
          <div className="filters">
            <div className="tabs">
              <Chip active={cat === 'clothing'} onClick={() => setCat('clothing')} testId="cat-clothing">
                Clothing
              </Chip>
              <Chip active={cat === 'board'} onClick={() => setCat('board')} testId="cat-boards">
                Boards
              </Chip>
              <span className="spacer" />
              <select className="select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} data-testid="sort">
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
                <option value="rarity">Rarity</option>
              </select>
            </div>
            {cat === 'clothing' && (
              <div className="chip-row">
                <Chip active={slot === 'all'} onClick={() => setSlot('all')}>
                  All
                </Chip>
                {CLOTHING_SLOTS.map((s) => (
                  <Chip key={s} active={slot === s} onClick={() => setSlot(s)} testId={`slot-${s}`}>
                    {SLOT_LABELS[s]}
                  </Chip>
                ))}
              </div>
            )}
            <div className="chip-row">
              <Chip active={rarity === 'all'} onClick={() => setRarity('all')}>
                Any rarity
              </Chip>
              {RARITIES.map((r) => (
                <Chip key={r} active={rarity === r} onClick={() => setRarity(r)} color={RARITY_COLORS[r]} testId={`rarity-${r}`}>
                  {RARITY_LABELS[r]}
                </Chip>
              ))}
            </div>
            <div className="chip-row">
              <Chip active={affordableOnly} onClick={() => setAffordableOnly(!affordableOnly)} testId="filter-affordable">
                Affordable
              </Chip>
              <Chip active={hideOwned} onClick={() => setHideOwned(!hideOwned)} testId="filter-unowned">
                Hide owned
              </Chip>
              <button type="button" className="link small" onClick={() => app.go({ name: 'collection' })}>
                Bag odds & info
              </button>
            </div>
          </div>
        )}
        <div className="item-grid" data-testid="item-grid">
          {items.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              owned={!!save.owned[it.id]}
              equipped={save.equipped[it.slot] === it.id}
              selected={selected === it.id}
              target={save.saveTarget === it.id}
              showPrice
              affordable={save.wallet.cash >= it.price}
              duplicates={save.duplicates[it.id]}
              onClick={() => setSelected(selected === it.id ? null : it.id)}
            />
          ))}
          {items.length === 0 && <p className="muted center">Nothing matches those filters.</p>}
        </div>
      </div>

      {confirm && (
        <Modal
          title="Confirm purchase"
          testId="confirm-purchase"
          onClose={() => setConfirm(null)}
          actions={
            <>
              <Btn variant="ghost" onClick={() => setConfirm(null)} testId="confirm-cancel">
                Cancel
              </Btn>
              <Btn variant="primary" onClick={() => doBuy(confirm)} testId="confirm-buy">
                Buy
              </Btn>
            </>
          }
        >
          <p>
            Buy <strong>{confirm.name}</strong> ({RARITY_LABELS[confirm.rarity]}) for <CashAmount amount={confirm.price} size="sm" />?
          </p>
          <p className="muted">
            Balance after: {formatCash(save.wallet.cash - confirm.price)} Mall Cash. It will not be equipped unless you choose to.
          </p>
        </Modal>
      )}
      {purchased && (
        <Modal
          title="It's yours!"
          testId="purchased"
          onClose={() => setPurchased(null)}
          actions={
            <>
              <Btn variant="ghost" onClick={() => setPurchased(null)} testId="keep-shopping">
                Not now
              </Btn>
              <Btn
                variant="teal"
                testId="equip-purchased"
                onClick={() => {
                  store.equip(purchased.id);
                  setPurchased(null);
                }}
              >
                Equip now
              </Btn>
            </>
          }
        >
          <p>
            <strong>{purchased.name}</strong> is now permanently in your collection.
          </p>
        </Modal>
      )}
      {shortfall && (
        <Modal
          title="Not enough Mall Cash"
          testId="insufficient-funds"
          tone="warn"
          onClose={() => setShortfall(null)}
          actions={
            <>
              <Btn
                variant="ghost"
                testId="shortfall-save"
                onClick={() => {
                  store.setSaveTarget(shortfall.item.id);
                  setShortfall(null);
                }}
              >
                Save for this
              </Btn>
              <Btn
                variant="gold"
                testId="shortfall-cash"
                onClick={() => {
                  setShortfall(null);
                  app.go({ name: 'cash' });
                }}
              >
                Get Mall Cash
              </Btn>
            </>
          }
        >
          <p>
            You need <strong data-testid="shortfall-amount">{formatCash(shortfall.need)}</strong> more Mall Cash for {shortfall.item.name}.
          </p>
          <p className="muted">Keep skating: every run pays out, and missions add more.</p>
        </Modal>
      )}
    </div>
  );
}
