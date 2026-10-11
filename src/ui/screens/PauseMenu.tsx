import { useEffect, useState } from 'react';
import { audio } from '../../audio/audio';
import { Btn, Toggle } from '../components';
import { store, useSave } from '../services';

/** Pause overlay. Resuming counts down 3-2-1 so the player can re-orient. */
export function PauseMenu({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  const save = useSave();
  const [count, setCount] = useState<number | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      audio.play('go');
      onResume();
      return;
    }
    audio.play('countdown');
    const t = setTimeout(() => setCount(count - 1), save.settings.reducedMotion ? 450 : 650);
    return () => clearTimeout(t);
  }, [count, onResume, save.settings.reducedMotion]);

  if (count !== null) {
    return (
      <div className="countdown" data-testid="countdown">
        <span key={count}>{count}</span>
      </div>
    );
  }

  const s = save.settings;
  return (
    <div className="modal-backdrop" data-no-swipe>
      <div className="modal pause-menu" role="dialog" aria-label="Paused" data-testid="pause-menu">
        <div className="modal-head">
          <h2>PAUSED</h2>
        </div>
        <div className="modal-body">
          <p className="muted">Everything you collected this run is already saved.</p>
          <Toggle label="Sound" checked={s.sound} onChange={(v) => store.updateSettings({ sound: v })} />
          <Toggle label="Music" checked={s.music} onChange={(v) => store.updateSettings({ music: v })} />
          <Toggle label="Haptics" checked={s.haptics} onChange={(v) => store.updateSettings({ haptics: v })} />
          <Toggle label="Reduced motion" checked={s.reducedMotion} onChange={(v) => store.updateSettings({ reducedMotion: v })} />
        </div>
        <div className="modal-actions column">
          <Btn variant="primary" size="lg" testId="resume" onClick={() => setCount(3)}>
            Resume
          </Btn>
          {confirmQuit ? (
            <Btn variant="danger" testId="confirm-quit" onClick={onQuit}>
              End run (keep rewards)
            </Btn>
          ) : (
            <Btn variant="ghost" testId="quit-run" onClick={() => setConfirmQuit(true)}>
              End run
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
