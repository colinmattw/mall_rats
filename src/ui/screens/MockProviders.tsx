import { useEffect, useState } from 'react';
import type { StoreProduct } from '../../monetization/billing';
import { Btn } from '../components';

/** Development-only stand-in for a rewarded video. Clearly not a real ad. */
export function MockAdOverlay({ placement, onDone }: { placement: string; onDone: (r: 'completed' | 'cancelled' | 'error') => void }) {
  const [left, setLeft] = useState(3);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div className="mock-ad" data-testid="mock-ad" data-no-swipe>
      <div className="mock-ad-card">
        <div className="dev-label block">DEVELOPMENT MOCK AD — NOT A REAL ADVERTISEMENT</div>
        <h2>Pretend this is a video</h2>
        <p className="muted">Placement: {placement}</p>
        <div className="mock-ad-timer">{left > 0 ? `Reward in ${left}…` : 'Reward ready'}</div>
        <div className="modal-actions column">
          <Btn variant="primary" disabled={left > 0} testId="mock-ad-complete" onClick={() => onDone('completed')}>
            Finish & claim reward
          </Btn>
          <Btn variant="ghost" testId="mock-ad-cancel" onClick={() => onDone('cancelled')}>
            Close early (no reward)
          </Btn>
          <Btn variant="ghost" testId="mock-ad-error" onClick={() => onDone('error')}>
            Simulate playback error
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** Development-only stand-in for the platform purchase sheet. */
export function MockPurchaseSheet({ product, onDone }: { product: StoreProduct; onDone: (r: 'success' | 'cancel' | 'fail' | 'pending') => void }) {
  return (
    <div className="modal-backdrop" data-testid="mock-purchase" data-no-swipe>
      <div className="modal modal-dev" role="dialog" aria-label="Development store">
        <div className="modal-head">
          <h2>Mock store</h2>
        </div>
        <div className="modal-body">
          <p className="dev-label block">DEVELOPMENT MOCK — no real money is involved.</p>
          <p>
            {product.title}: {product.amount.toLocaleString('en-US')} Mall Cash ({product.localizedPrice})
          </p>
        </div>
        <div className="modal-actions column">
          <Btn variant="primary" testId="mock-pay-success" onClick={() => onDone('success')}>
            Approve test purchase
          </Btn>
          <Btn testId="mock-pay-pending" onClick={() => onDone('pending')}>
            Defer (pending)
          </Btn>
          <Btn variant="ghost" testId="mock-pay-fail" onClick={() => onDone('fail')}>
            Decline (failed)
          </Btn>
          <Btn variant="ghost" testId="mock-pay-cancel" onClick={() => onDone('cancel')}>
            Cancel
          </Btn>
        </div>
      </div>
    </div>
  );
}
