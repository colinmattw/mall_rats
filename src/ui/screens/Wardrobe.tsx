import { useEffect, useState } from 'react';
import {
  ALL_ITEMS,
  CLOTHING_SLOTS,
  FACES,
  HAIR_COLORS,
  HAIR_STYLES,
  OPTIONAL_SLOTS,
  SKIN_TONES,
  SLOT_LABELS,
  getItem,
  type ClothingSlot,
} from '../../config/catalog';
import { useApp } from '../AppContext';
import { Btn, Chip, ItemCard, ScreenHeader, WalletPill } from '../components';
import { ItemArt } from '../ItemArt';
import { store, useSave } from '../services';
import { DragRotate } from './DragRotate';
import { DuplicatesPanel } from './Duplicates';

type Tab = 'outfit' | 'look' | 'boards' | 'presets' | 'duplicates';

export function Wardrobe({ initialTab }: { initialTab?: Tab }) {
  const save = useSave();
  const app = useApp();
  const [tab, setTab] = useState<Tab>(initialTab ?? 'outfit');
  const [slot, setSlot] = useState<ClothingSlot>('top');
  const [renaming, setRenaming] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    app.runtime()?.showStudio(tab === 'boards' ? 'board' : 'character', { top: 0.085, bottom: 0.55 }, save.equipped, save.appearance);
  }, [app, tab, save.equipped, save.appearance]);

  const equip = (id: string) => {
    const r = store.equip(id);
    if (r.ok && r.value.removed.length) setNote(`Removed ${r.value.removed.map((x) => getItem(x)?.name).join(', ')} so they don't clip.`);
    else setNote(null);
  };

  const ownedIn = (s: ClothingSlot | 'board') => ALL_ITEMS.filter((i) => i.slot === s && save.owned[i.id]);
  const dupeTotal = Object.values(save.duplicates).reduce((n, x) => n + x, 0);

  return (
    <div className="screen shop-screen" data-testid="wardrobe">
      <ScreenHeader title="Wardrobe" sub="Equip what you own" onBack={app.back} right={<WalletPill amount={save.wallet.cash} onClick={() => app.go({ name: 'cash' })} />} />
      <DragRotate className="preview-drag" />
      <div className="sheet catalog-sheet">
        <div className="tabs">
          {(['outfit', 'look', 'boards', 'presets', 'duplicates'] as Tab[]).map((t) => (
            <Chip key={t} active={tab === t} onClick={() => setTab(t)} testId={`tab-${t}`}>
              {t === 'duplicates' ? `Dupes${dupeTotal ? ` (${dupeTotal})` : ''}` : t[0]!.toUpperCase() + t.slice(1)}
            </Chip>
          ))}
        </div>
        {note && <p className="muted small">{note}</p>}

        {tab === 'outfit' && (
          <>
            <div className="chip-row">
              {CLOTHING_SLOTS.map((s) => (
                <Chip key={s} active={slot === s} onClick={() => setSlot(s)} testId={`wslot-${s}`}>
                  {SLOT_LABELS[s]}
                  {ownedIn(s).some((i) => save.newItems.includes(i.id)) && <span className="dot" />}
                </Chip>
              ))}
            </div>
            <div className="item-grid">
              {OPTIONAL_SLOTS.includes(slot) && (
                <button type="button" className={`item-card none-card ${save.equipped[slot] === null ? 'equipped' : ''}`} data-testid={`none-${slot}`} onClick={() => store.unequip(slot)}>
                  <div className="item-card-art none-art">None</div>
                  <div className="item-card-name">No {SLOT_LABELS[slot].toLowerCase().replace(/s$/, '')}</div>
                </button>
              )}
              {ownedIn(slot).map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  owned
                  equipped={save.equipped[it.slot] === it.id}
                  isNew={save.newItems.includes(it.id)}
                  duplicates={save.duplicates[it.id]}
                  onClick={() => equip(it.id)}
                />
              ))}
            </div>
            <Btn variant="gold" onClick={() => app.go({ name: 'shop', slot })} testId="wardrobe-shop">
              Find more {SLOT_LABELS[slot].toLowerCase()}
            </Btn>
          </>
        )}

        {tab === 'look' && (
          <div className="look" data-testid="look">
            <h3>Skin tone</h3>
            <div className="swatches">
              {SKIN_TONES.map((c) => (
                <button key={c} type="button" className={`swatch ${save.appearance.skinTone === c ? 'active' : ''}`} style={{ background: c }} aria-label={`Skin tone ${c}`} onClick={() => store.setAppearance({ skinTone: c })} />
              ))}
            </div>
            <h3>Hairstyle</h3>
            <div className="chip-row wrap">
              {HAIR_STYLES.map((h) => (
                <Chip key={h.id} active={save.appearance.hairStyle === h.id} onClick={() => store.setAppearance({ hairStyle: h.id })} testId={`hair-${h.id}`}>
                  {h.name}
                </Chip>
              ))}
            </div>
            <h3>Hair color</h3>
            <div className="swatches">
              {HAIR_COLORS.map((c) => (
                <button key={c} type="button" className={`swatch ${save.appearance.hairColor === c ? 'active' : ''}`} style={{ background: c }} aria-label={`Hair color ${c}`} onClick={() => store.setAppearance({ hairColor: c })} />
              ))}
            </div>
            <h3>Face</h3>
            <div className="chip-row wrap">
              {FACES.map((f) => (
                <Chip key={f.id} active={save.appearance.face === f.id} onClick={() => store.setAppearance({ face: f.id })} testId={`face-${f.id}`}>
                  {f.name}
                </Chip>
              ))}
            </div>
            <p className="muted small">Looks are always free.</p>
          </div>
        )}

        {tab === 'boards' && (
          <>
            <p className="muted small">Every board rides exactly the same. Drag the preview to see both sides.</p>
            <div className="item-grid">
              {ownedIn('board').map((it) => (
                <ItemCard key={it.id} item={it} owned equipped={save.equipped.board === it.id} isNew={save.newItems.includes(it.id)} duplicates={save.duplicates[it.id]} onClick={() => equip(it.id)} />
              ))}
            </div>
            <Btn variant="gold" onClick={() => app.go({ name: 'shop', slot: 'board' })}>
              Shop boards
            </Btn>
          </>
        )}

        {tab === 'presets' && (
          <div className="presets" data-testid="presets">
            {save.presets.map((p, i) => (
              <div className="preset" key={i} data-testid={`preset-${i}`}>
                <div className="preset-head">
                  {renaming === i ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        store.renamePreset(i, name);
                        setRenaming(null);
                      }}
                    >
                      <input className="text-input" value={name} maxLength={24} autoFocus onChange={(e) => setName(e.target.value)} aria-label="Preset name" />
                      <Btn size="sm" type="submit">
                        Save
                      </Btn>
                    </form>
                  ) : (
                    <strong>{p?.name ?? `Empty slot ${i + 1}`}</strong>
                  )}
                </div>
                {p && (
                  <div className="preset-items">
                    {Object.values(p.loadout)
                      .filter((id): id is string => !!id)
                      .map((id) => getItem(id))
                      .filter((it) => !!it)
                      .map((it) => (
                        <ItemArt key={it!.id} item={it!} size={34} />
                      ))}
                  </div>
                )}
                <div className="preset-actions">
                  <Btn size="sm" testId={`preset-save-${i}`} onClick={() => store.savePreset(i, p?.name ?? `Fit ${i + 1}`)}>
                    {p ? 'Overwrite' : 'Save current'}
                  </Btn>
                  {p && (
                    <Btn size="sm" variant="teal" testId={`preset-load-${i}`} onClick={() => store.loadPreset(i)}>
                      Wear
                    </Btn>
                  )}
                  {p && (
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setName(p.name);
                        setRenaming(i);
                      }}
                    >
                      Rename
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'duplicates' && <DuplicatesPanel />}
      </div>
    </div>
  );
}
