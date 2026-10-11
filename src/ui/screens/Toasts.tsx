import type { Toast } from '../../game/runtime';
import { BagIcon, SparkIcon, TargetIcon, TrophyIcon } from '../icons';

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts" aria-live="polite" data-testid="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} data-testid={`toast-${t.kind}`}>
          <span className="toast-icon">
            {t.kind === 'bag' ? <BagIcon size={22} /> : t.kind === 'mission' ? <TrophyIcon size={22} /> : t.kind === 'route' ? <TargetIcon size={22} /> : <SparkIcon size={22} />}
          </span>
          <div>
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="toast-body">{t.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
