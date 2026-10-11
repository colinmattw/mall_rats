import { useState } from 'react';
import type { GraphicsQuality } from '../../economy/saveSchema';
import { useApp } from '../AppContext';
import { Btn, Chip, Modal, ScreenHeader, Toggle } from '../components';
import { DEV_TOOLS, MOCKS_ALLOWED, store, useSave } from '../services';

export function SettingsScreen() {
  const save = useSave();
  const app = useApp();
  const s = save.settings;
  const [credits, setCredits] = useState(false);
  const [reset, setReset] = useState(0);
  const vibrateSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  return (
    <div className="screen panel-screen" data-testid="settings">
      <ScreenHeader title="Settings" onBack={app.back} />
      <div className="panel-scroll">
        <section className="settings-group">
          <h3>Audio</h3>
          <Toggle label="Sound effects" checked={s.sound} onChange={(v) => store.updateSettings({ sound: v })} testId="toggle-sound" />
          <label className="slider-row">
            <span>Effects volume</span>
            <input type="range" min={0} max={1} step={0.05} value={s.soundVolume} onChange={(e) => store.updateSettings({ soundVolume: Number(e.target.value) })} aria-label="Effects volume" />
          </label>
          <Toggle label="Music" checked={s.music} onChange={(v) => store.updateSettings({ music: v })} testId="toggle-music" />
          <label className="slider-row">
            <span>Music volume</span>
            <input type="range" min={0} max={1} step={0.05} value={s.musicVolume} onChange={(e) => store.updateSettings({ musicVolume: Number(e.target.value) })} aria-label="Music volume" />
          </label>
        </section>
        <section className="settings-group">
          <h3>Feel</h3>
          <Toggle label={`Haptics${vibrateSupported ? '' : ' (not supported on this device)'}`} checked={s.haptics} onChange={(v) => store.updateSettings({ haptics: v })} testId="toggle-haptics" />
          <Toggle label="Reduced motion (no shake, no speed FOV)" checked={s.reducedMotion} onChange={(v) => store.updateSettings({ reducedMotion: v })} testId="toggle-reduced-motion" />
          <div className="setting-row">
            <span>Graphics quality</span>
            <div className="chip-row">
              {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                <Chip key={q} active={s.graphics === q} onClick={() => store.updateSettings({ graphics: q })} testId={`quality-${q}`}>
                  {q[0]!.toUpperCase() + q.slice(1)}
                </Chip>
              ))}
            </div>
          </div>
        </section>
        <section className="settings-group">
          <h3>Controls</h3>
          <label className="slider-row">
            <span>Swipe sensitivity</span>
            <input type="range" min={0.5} max={2} step={0.1} value={s.swipeSensitivity} onChange={(e) => store.updateSettings({ swipeSensitivity: Number(e.target.value) })} aria-label="Swipe sensitivity" />
          </label>
          <Toggle label="Show control hints" checked={s.showControlHints} onChange={(v) => store.updateSettings({ showControlHints: v })} />
          <table className="controls-table">
            <tbody>
              <tr>
                <td>Change lane</td>
                <td>Swipe ← → · A / D · Arrow keys</td>
              </tr>
              <tr>
                <td>Jump</td>
                <td>Swipe ↑ · Space · Up</td>
              </tr>
              <tr>
                <td>Duck (fast-drop in air)</td>
                <td>Swipe ↓ · S · Down</td>
              </tr>
              <tr>
                <td>Air trick</td>
                <td>Swipe ← → while airborne · Q / E</td>
              </tr>
              <tr>
                <td>Grind</td>
                <td>Land on (or roll up to) a glowing rail</td>
              </tr>
              <tr>
                <td>Pause</td>
                <td>Pause button · Esc / P</td>
              </tr>
            </tbody>
          </table>
          <Btn testId="replay-tutorial" onClick={() => app.startRun({ tutorial: true })}>
            Replay tutorial
          </Btn>
        </section>
        {MOCKS_ALLOWED && (
          <section className="settings-group dev">
            <h3>Development</h3>
            <Toggle label="Use development mock ad & store providers" checked={s.devMockProviders} onChange={(v) => store.updateSettings({ devMockProviders: v })} testId="toggle-mocks" />
            {DEV_TOOLS && (
              <Btn variant="dark" onClick={() => app.go({ name: 'dev' })}>
                Developer fixtures
              </Btn>
            )}
          </section>
        )}
        <section className="settings-group">
          <h3>About</h3>
          <p className="muted small">Progress is saved only on this device (browser storage). Clearing site data erases it.</p>
          <Btn variant="ghost" onClick={() => setCredits(true)} testId="credits">
            Credits & licenses
          </Btn>
          <Btn variant="danger" testId="reset" onClick={() => setReset(1)}>
            Reset all progress
          </Btn>
        </section>
      </div>
      {credits && (
        <Modal title="Credits & licenses" onClose={() => setCredits(false)}>
          <p>Mall Rats — an original game. All characters, stores, 3D models, textures and sounds are generated procedurally in code for this project.</p>
          <ul className="bullets">
            <li>Bungee typeface by David Jonathan Ross — SIL Open Font License 1.1</li>
            <li>Permanent Marker typeface by Font Diner — Apache License 2.0</li>
            <li>Rubik typeface by Hubert &amp; Fischer — SIL Open Font License 1.1</li>
            <li>three.js — MIT License · React — MIT License</li>
          </ul>
          <p className="muted small">Full list: docs/ASSETS_AND_LICENSES.md</p>
        </Modal>
      )}
      {reset > 0 && (
        <Modal
          title={reset === 1 ? 'Reset progress?' : 'Really erase everything?'}
          tone="warn"
          testId="confirm-reset"
          onClose={() => setReset(0)}
          actions={
            <>
              <Btn variant="ghost" onClick={() => setReset(0)}>
                Cancel
              </Btn>
              <Btn
                variant="danger"
                testId="confirm-reset-yes"
                onClick={() => {
                  if (reset === 1) setReset(2);
                  else {
                    store.resetAll();
                    setReset(0);
                    app.go({ name: 'menu' });
                  }
                }}
              >
                {reset === 1 ? 'Reset' : 'Erase all progress'}
              </Btn>
            </>
          }
        >
          <p>This deletes your Mall Cash, items, missions and stats on this device. It cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}
