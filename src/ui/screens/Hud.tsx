import { useEffect, useRef } from 'react';
import { ENVIRONMENTS } from '../../config/environments';
import type { StyleAward } from '../../engine/scoring';
import type { HudSnapshot } from '../../game/runtime';
import { CashIcon, GuardIcon, PauseIcon } from '../icons';

export interface HudBridge {
  update: ((h: HudSnapshot) => void) | null;
  style: ((a: StyleAward) => void) | null;
}

/**
 * The HUD is updated imperatively from the game loop (textContent / style
 * writes only when values change). React never re-renders per frame.
 */
export function Hud({ bridge, onPause, showHints }: { bridge: HudBridge; onPause: () => void; showHints: boolean }) {
  const dist = useRef<HTMLSpanElement>(null);
  const style = useRef<HTMLSpanElement>(null);
  const cash = useRef<HTMLSpanElement>(null);
  const combo = useRef<HTMLDivElement>(null);
  const comboText = useRef<HTMLSpanElement>(null);
  const comboBar = useRef<HTMLDivElement>(null);
  const pressure = useRef<HTMLDivElement>(null);
  const pressureWrap = useRef<HTMLDivElement>(null);
  const env = useRef<HTMLDivElement>(null);
  const pops = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const last: Record<string, string | number | boolean> = {};
    const set = (key: string, el: HTMLElement | null, value: string) => {
      if (!el || last[key] === value) return;
      last[key] = value;
      el.textContent = value;
    };
    bridge.update = (h) => {
      set('d', dist.current, `${Math.floor(h.distance).toLocaleString('en-US')}`);
      set('s', style.current, h.style.toLocaleString('en-US'));
      set('c', cash.current, h.runCash.toLocaleString('en-US'));
      const comboOn = h.combo >= 2;
      if (last.comboOn !== comboOn && combo.current) {
        last.comboOn = comboOn;
        combo.current.classList.toggle('show', comboOn);
      }
      set('ct', comboText.current, `x${h.multiplier.toFixed(2).replace(/\.?0+$/, '')}  COMBO ${h.combo}`);
      const cw = `${Math.round(h.comboTime * 100)}%`;
      if (last.cw !== cw && comboBar.current) {
        last.cw = cw;
        comboBar.current.style.width = cw;
      }
      const pw = `${Math.round(h.pressure * 100)}%`;
      if (last.pw !== pw && pressure.current) {
        last.pw = pw;
        pressure.current.style.width = pw;
      }
      const danger = h.pressure >= 0.6;
      if (last.danger !== danger && pressureWrap.current) {
        last.danger = danger;
        pressureWrap.current.classList.toggle('danger', danger);
      }
      set('env', env.current, ENVIRONMENTS[h.env].name);
    };
    bridge.style = (a) => {
      const host = pops.current;
      if (!host) return;
      const el = document.createElement('div');
      el.className = `style-pop ${a.bonus ? 'bonus' : ''}`;
      el.textContent = `${a.label} +${a.points.toLocaleString('en-US')}`;
      host.appendChild(el);
      while (host.childElementCount > 4) host.firstElementChild?.remove();
      setTimeout(() => el.remove(), 1200);
    };
    return () => {
      bridge.update = null;
      bridge.style = null;
    };
  }, [bridge]);

  return (
    <div className="hud" data-testid="hud">
      <div className="hud-top">
        <div className="hud-block hud-left">
          <div className="hud-dist">
            <span ref={dist} data-testid="hud-distance">
              0
            </span>
            <small>m</small>
          </div>
          <div className="hud-style">
            STYLE <span ref={style} data-testid="hud-style">0</span>
          </div>
        </div>
        <div className="hud-center">
          <div className="pressure" ref={pressureWrap} data-testid="hud-pressure">
            <GuardIcon size={22} />
            <div className="pressure-track">
              <div className="pressure-fill" ref={pressure} />
            </div>
          </div>
          <div className="hud-env" ref={env} />
        </div>
        <div className="hud-block hud-right">
          <div className="hud-cash">
            <CashIcon size={20} />
            <span ref={cash} data-testid="hud-cash">
              0
            </span>
          </div>
          <button type="button" className="icon-btn pause-btn" aria-label="Pause" data-testid="pause" onClick={onPause}>
            <PauseIcon />
          </button>
        </div>
      </div>
      <div className="combo" ref={combo}>
        <span ref={comboText} />
        <div className="combo-track">
          <div className="combo-fill" ref={comboBar} />
        </div>
      </div>
      <div className="style-pops" ref={pops} aria-live="polite" />
      {showHints && (
        <div className="control-hints" data-testid="control-hints">
          <span>Swipe ← → lanes</span>
          <span>↑ jump</span>
          <span>↓ duck</span>
          <span>air swipe = trick</span>
        </div>
      )}
    </div>
  );
}
