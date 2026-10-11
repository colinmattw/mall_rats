import { useEffect, type ReactNode } from 'react';
import { audio } from '../audio/audio';
import { RARITY_COLORS, RARITY_LABELS, type CatalogItem, type Rarity } from '../config/catalog';
import { BackIcon, CashIcon, CheckIcon, CloseIcon } from './icons';
import { ItemArt } from './ItemArt';
import { formatCash } from './services';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'teal' | 'dark';

export function Btn(props: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  testId?: string;
  title?: string;
  silent?: boolean;
  type?: 'button' | 'submit';
}) {
  const { variant = 'secondary', size = 'md' } = props;
  return (
    <button
      type={props.type ?? 'button'}
      className={`btn btn-${variant} btn-${size} ${props.className ?? ''}`}
      disabled={props.disabled}
      data-testid={props.testId}
      title={props.title}
      onClick={() => {
        if (props.disabled) return;
        if (!props.silent) audio.play(variant === 'ghost' ? 'uiBack' : 'ui');
        props.onClick?.();
      }}
    >
      {props.icon && <span className="btn-icon">{props.icon}</span>}
      {props.children && <span className="btn-label">{props.children}</span>}
    </button>
  );
}

export function IconBtn(props: { onClick: () => void; label: string; children: ReactNode; testId?: string; className?: string }) {
  return (
    <button
      type="button"
      className={`icon-btn ${props.className ?? ''}`}
      aria-label={props.label}
      title={props.label}
      data-testid={props.testId}
      onClick={() => {
        audio.play('ui');
        props.onClick();
      }}
    >
      {props.children}
    </button>
  );
}

export function CashAmount({ amount, size = 'md', testId, sign }: { amount: number; size?: 'sm' | 'md' | 'lg'; testId?: string; sign?: boolean }) {
  return (
    <span className={`cash cash-${size}`} data-testid={testId}>
      <CashIcon size={size === 'lg' ? 28 : size === 'sm' ? 16 : 20} />
      <span className="cash-value">
        {sign && amount > 0 ? '+' : ''}
        {formatCash(amount)}
      </span>
    </span>
  );
}

export function WalletPill({ amount, onClick }: { amount: number; onClick?: () => void }) {
  return (
    <button type="button" className="wallet-pill" onClick={onClick} data-testid="wallet" aria-label={`Wallet: ${formatCash(amount)} Mall Cash`}>
      <CashAmount amount={amount} testId="wallet-amount" />
      {onClick && <span className="wallet-plus">+</span>}
    </button>
  );
}

export function RarityTag({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`rarity-tag rarity-${rarity}`} style={{ ['--rarity' as string]: RARITY_COLORS[rarity] }}>
      {RARITY_LABELS[rarity]}
    </span>
  );
}

export function ProgressBar({ value, max, color, label, testId }: { value: number; max: number; color?: string; label?: string; testId?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="progress" data-testid={testId} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-label={label}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      {label && <span className="progress-label">{label}</span>}
    </div>
  );
}

export function ScreenHeader({ title, onBack, right, sub }: { title: string; onBack?: () => void; right?: ReactNode; sub?: string }) {
  return (
    <header className="screen-header">
      {onBack ? (
        <IconBtn onClick={onBack} label="Back" testId="back">
          <BackIcon />
        </IconBtn>
      ) : (
        <span className="icon-btn-spacer" />
      )}
      <div className="screen-title">
        <h1>{title}</h1>
        {sub && <div className="screen-sub">{sub}</div>}
      </div>
      <div className="screen-header-right">{right}</div>
    </header>
  );
}

export function Modal(props: { title: string; children: ReactNode; onClose?: () => void; actions?: ReactNode; testId?: string; tone?: 'default' | 'warn' | 'dev' }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="modal-backdrop" data-no-swipe>
      <div className={`modal modal-${props.tone ?? 'default'}`} role="dialog" aria-modal="true" aria-label={props.title} data-testid={props.testId}>
        <div className="modal-head">
          <h2>{props.title}</h2>
          {props.onClose && (
            <IconBtn onClick={props.onClose} label="Close" testId="modal-close">
              <CloseIcon />
            </IconBtn>
          )}
        </div>
        <div className="modal-body">{props.children}</div>
        {props.actions && <div className="modal-actions">{props.actions}</div>}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-testid={testId}
        className={`toggle ${checked ? 'on' : ''}`}
        onClick={() => {
          audio.play('ui');
          onChange(!checked);
        }}
      >
        <span className="toggle-knob" />
      </button>
    </label>
  );
}

export function Chip({ active, onClick, children, testId, color }: { active?: boolean; onClick: () => void; children: ReactNode; testId?: string; color?: string }) {
  return (
    <button
      type="button"
      className={`chip ${active ? 'chip-active' : ''}`}
      data-testid={testId}
      style={color ? { ['--chip' as string]: color } : undefined}
      onClick={() => {
        audio.play('ui');
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function ItemCard(props: {
  item: CatalogItem;
  owned?: boolean;
  equipped?: boolean;
  selected?: boolean;
  isNew?: boolean;
  duplicates?: number;
  showPrice?: boolean;
  affordable?: boolean;
  target?: boolean;
  onClick: () => void;
}) {
  const { item } = props;
  return (
    <button
      type="button"
      className={`item-card rarity-border-${item.rarity} ${props.selected ? 'selected' : ''} ${props.equipped ? 'equipped' : ''}`}
      style={{ ['--rarity' as string]: RARITY_COLORS[item.rarity] }}
      data-testid={`item-${item.id}`}
      onClick={() => {
        audio.play('ui');
        props.onClick();
      }}
      aria-label={`${item.name}, ${RARITY_LABELS[item.rarity]}${props.owned ? ', owned' : ''}`}
    >
      <div className="item-card-art">
        <ItemArt item={item} size={64} />
        {props.isNew && <span className="badge-new">NEW</span>}
        {props.target && <span className="badge-goal">GOAL</span>}
        {!!props.duplicates && <span className="badge-dupe">x{props.duplicates + 1}</span>}
      </div>
      <div className="item-card-name">{item.name}</div>
      <div className="item-card-foot">
        {props.equipped ? (
          <span className="tag-equipped">
            <CheckIcon size={12} /> ON
          </span>
        ) : props.owned ? (
          <span className="tag-owned">OWNED</span>
        ) : props.showPrice ? (
          <span className={`price-sticker ${props.affordable === false ? 'pricey' : ''}`}>
            <CashIcon size={13} />
            {formatCash(item.price)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
