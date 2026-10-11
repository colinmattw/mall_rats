import { getItem } from '../../config/catalog';
import { useApp } from '../AppContext';
import { Btn, IconBtn, ProgressBar, WalletPill } from '../components';
import { BagIcon, BoardIcon, ChartIcon, GearIcon, ShirtIcon, TargetIcon, TrophyIcon } from '../icons';
import { DEV_TOOLS, formatCash, useSave } from '../services';
import { DragRotate } from './DragRotate';

export function MainMenu() {
  const save = useSave();
  const app = useApp();
  const target = getItem(save.saveTarget);
  const newCount = save.newItems.length;
  return (
    <div className="screen menu-screen" data-testid="main-menu">
      <div className="menu-top">
        <IconBtn label="Settings" onClick={() => app.go({ name: 'settings' })} testId="open-settings">
          <GearIcon />
        </IconBtn>
        <WalletPill amount={save.wallet.cash} onClick={() => app.go({ name: 'cash' })} />
      </div>
      <div className="logo" aria-label="Mall Rats">
        <div className="logo-sticker">
          <span className="logo-mall">MALL</span>
          <span className="logo-rats">RATS</span>
        </div>
        <div className="tagline">Skate the mall. Dodge security. Collect your style.</div>
      </div>
      <DragRotate className="menu-drag" />
      {save.unrevealed.length > 0 && (
        <button type="button" className="reveal-banner" data-testid="reveal-banner" onClick={() => app.go({ name: 'reveal' })}>
          <BagIcon size={20} /> {save.unrevealed.length} unrevealed item{save.unrevealed.length === 1 ? '' : 's'} — tap to reveal
        </button>
      )}
      <div className="menu-bottom">
        {target && (
          <button type="button" className="goal-widget" data-testid="goal-widget" onClick={() => app.go({ name: 'shop', focusItem: target.id, slot: target.slot })}>
            <TargetIcon size={18} />
            <div className="goal-text">
              <span>
                Saving for <strong>{target.name}</strong>
              </span>
              <ProgressBar value={save.wallet.cash} max={target.price} label={`${formatCash(Math.min(save.wallet.cash, target.price))} / ${formatCash(target.price)}`} />
            </div>
          </button>
        )}
        <Btn variant="primary" size="xl" onClick={app.play} testId="play">
          SKATE
        </Btn>
        <div className="menu-grid">
          <Btn icon={<BagIcon />} onClick={() => app.go({ name: 'shop' })} testId="open-shop" variant="gold">
            Shop
          </Btn>
          <Btn icon={<ShirtIcon />} onClick={() => app.go({ name: 'wardrobe' })} testId="open-wardrobe" variant="teal">
            Wardrobe{newCount > 0 && <span className="dot-badge">{newCount}</span>}
          </Btn>
          <Btn icon={<TrophyIcon />} onClick={() => app.go({ name: 'missions' })} testId="open-missions">
            Missions
          </Btn>
          <Btn icon={<ChartIcon />} onClick={() => app.go({ name: 'stats' })} testId="open-stats">
            Stats
          </Btn>
        </div>
        <div className="menu-records">
          <span>
            Best <strong>{formatCash(save.stats.bestDistance)} m</strong>
          </span>
          <span>
            Style <strong>{formatCash(save.stats.bestStyle)}</strong>
          </span>
          <button type="button" className="link" onClick={() => app.go({ name: 'wardrobe', tab: 'boards' })}>
            <BoardIcon size={16} /> Boards
          </button>
          {DEV_TOOLS && (
            <button type="button" className="link dev-link" data-testid="open-dev" onClick={() => app.go({ name: 'dev' })}>
              Dev
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
