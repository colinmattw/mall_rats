import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../audio/audio';
import type { TutorialStep } from '../config/routes';
import { GameRuntime, type HudSnapshot, type Toast } from '../game/runtime';
import type { StyleAward } from '../engine/scoring';
import type { StoreProduct } from '../monetization/billing';
import { AppContext, type AppApi, type Screen } from './AppContext';
import { Btn, Modal } from './components';
import { DEV_TOOLS, mockAds, mockBilling, store, useSave } from './services';
import { CashShop } from './screens/CashShop';
import { Collection } from './screens/Collection';
import { DevPanel } from './screens/DevPanel';
import { DuplicatesScreen } from './screens/Duplicates';
import { Hud, type HudBridge } from './screens/Hud';
import { MainMenu } from './screens/MainMenu';
import { Missions } from './screens/Missions';
import { MockAdOverlay, MockPurchaseSheet } from './screens/MockProviders';
import { PauseMenu } from './screens/PauseMenu';
import { Results } from './screens/Results';
import { RevealScreen } from './screens/Reveal';
import { SettingsScreen } from './screens/Settings';
import { Shop } from './screens/Shop';
import { Stats } from './screens/Stats';
import { Toasts } from './screens/Toasts';
import { TutorialOverlay } from './screens/TutorialOverlay';
import { Wardrobe } from './screens/Wardrobe';

let toastCounter = 1000;

export function App() {
  const save = useSave();
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const hud = useRef<HudBridge>({ update: null, style: null });
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const history = useRef<Screen[]>([]);
  const [paused, setPaused] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tutorial, setTutorial] = useState<{ step: TutorialStep; state: 'show' | 'done' | 'retry' } | null>(null);
  const [askTutorial, setAskTutorial] = useState(false);
  const [mockAd, setMockAd] = useState<{ placement: string; resolve: (r: 'completed' | 'cancelled' | 'error') => void } | null>(null);
  const [mockPurchase, setMockPurchase] = useState<{ product: StoreProduct; resolve: (r: 'success' | 'cancel' | 'fail' | 'pending') => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [tutorialRun, setTutorialRun] = useState(false);

  const pushToast = useCallback((t: Omit<Toast, 'id'> & { id?: number }) => {
    const toast = { ...t, id: t.id ?? toastCounter++ } as Toast;
    setToasts((list) => [...list.slice(-2), toast]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== toast.id)), 3200);
  }, []);

  useEffect(() => {
    const el = containerRef.current!;
    const rt = new GameRuntime(el, store, {
      onHud: (h: HudSnapshot) => hud.current.update?.(h),
      onStyle: (a: StyleAward) => hud.current.style?.(a),
      onToast: (t) => pushToast(t),
      onRunEnd: (result) => {
        setPaused(false);
        setTutorial(null);
        history.current = [];
        setScreen({ name: 'results', result });
      },
      onAutoPause: () => setPaused(true),
      onTutorial: (step, state) => setTutorial({ step, state }),
      onBagCollected: () => {},
    });
    runtimeRef.current = rt;
    setReady(true);
    if (mockAds) mockAds.presenter = (placement) => new Promise((resolve) => setMockAd({ placement, resolve }));
    if (mockBilling) mockBilling.presenter = (product) => new Promise((resolve) => setMockPurchase({ product, resolve }));
    if (DEV_TOOLS) {
      (window as unknown as Record<string, unknown>).__mallrats = { store, runtime: rt, mockAds, mockBilling };
    }
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      rt.destroy();
      runtimeRef.current = null;
    };
  }, [pushToast]);

  useEffect(() => {
    runtimeRef.current?.applySettings(save.settings);
  }, [save.settings]);

  // Studio framing for screens that show the skater.
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt || !ready) return;
    if (screen.name === 'menu') {
      rt.showStudio('character', { top: 0.25, bottom: 0.37 }, save.equipped, save.appearance);
      rt.renderer.setAutoSpin(true);
    } else if (screen.name !== 'game' && screen.name !== 'shop' && screen.name !== 'wardrobe' && screen.name !== 'results') {
      rt.showStudio('character', { top: 0.05, bottom: 0.4 }, save.equipped, save.appearance);
    }
  }, [screen.name, ready]);

  useEffect(() => {
    if (screen.name === 'menu') runtimeRef.current?.setPreview(save.equipped, save.appearance);
  }, [save.equipped, save.appearance, screen.name]);

  const screenRef = useRef<Screen>(screen);
  screenRef.current = screen;

  const go = useCallback((next: Screen) => {
    const cur = screenRef.current;
    if (cur.name !== 'game' && cur.name !== next.name) history.current.push(cur);
    if (history.current.length > 12) history.current.shift();
    screenRef.current = next;
    setScreen(next);
  }, []);

  const back = useCallback(() => {
    const prev = history.current.pop() ?? { name: 'menu' };
    screenRef.current = prev;
    setScreen(prev);
  }, []);

  const startRun = useCallback((opts: { tutorial: boolean }) => {
    const rt = runtimeRef.current;
    if (!rt) return;
    history.current = [];
    setPaused(false);
    setTutorial(null);
    setTutorialRun(opts.tutorial);
    screenRef.current = { name: 'game' };
    setScreen({ name: 'game' });
    rt.startRun(opts);
  }, []);

  const play = useCallback(() => {
    const s = store.snapshot;
    if (!s.tutorial.completed && !s.tutorial.skipped && s.stats.runsPlayed === 0) {
      setAskTutorial(true);
      return;
    }
    startRun({ tutorial: false });
  }, [startRun]);

  const api: AppApi = useMemo(
    () => ({
      runtime: () => runtimeRef.current,
      screen,
      go,
      back,
      play,
      startRun,
      toast: (t) => pushToast(t),
    }),
    [screen, go, back, play, startRun, pushToast],
  );

  const inGame = screen.name === 'game';
  const leaveRunToMenu = () => {
    runtimeRef.current?.endSession();
    history.current = [];
    setScreen({ name: 'menu' });
  };

  return (
    <AppContext.Provider value={api}>
      <div className={`app ${inGame ? 'in-game' : ''}`}>
        <div className="stage" ref={containerRef} data-testid="stage" />
        {ready && (
          <div className="ui-layer">
            {inGame && (
              <Hud
                bridge={hud.current}
                showHints={save.settings.showControlHints && save.stats.runsPlayed < 3 && !tutorialRun}
                onPause={() => {
                  runtimeRef.current?.pause();
                  setPaused(true);
                }}
              />
            )}
            {inGame && tutorial && (
              <TutorialOverlay
                step={tutorial.step}
                state={tutorial.state}
                onSkip={() => {
                  store.skipTutorial();
                  runtimeRef.current?.quitRun();
                }}
              />
            )}
            {inGame && paused && (
              <PauseMenu
                onResume={() => {
                  setPaused(false);
                  runtimeRef.current?.resume();
                }}
                onQuit={() => {
                  setPaused(false);
                  runtimeRef.current?.quitRun();
                }}
              />
            )}
            {screen.name === 'menu' && <MainMenu />}
            {screen.name === 'results' && <Results result={screen.result} onMenu={leaveRunToMenu} />}
            {screen.name === 'shop' && <Shop initialSlot={screen.slot} focusItem={screen.focusItem} />}
            {screen.name === 'wardrobe' && <Wardrobe initialTab={screen.tab} />}
            {screen.name === 'duplicates' && <DuplicatesScreen />}
            {screen.name === 'missions' && <Missions />}
            {screen.name === 'stats' && <Stats />}
            {screen.name === 'collection' && <Collection />}
            {screen.name === 'settings' && <SettingsScreen />}
            {screen.name === 'cash' && <CashShop />}
            {screen.name === 'reveal' && <RevealScreen />}
            {screen.name === 'dev' && DEV_TOOLS && <DevPanel />}
            <Toasts toasts={toasts} />
            {askTutorial && (
              <Modal
                title="First time at the mall?"
                testId="tutorial-offer"
                onClose={() => setAskTutorial(false)}
                actions={
                  <>
                    <Btn
                      variant="ghost"
                      testId="skip-tutorial"
                      onClick={() => {
                        setAskTutorial(false);
                        store.skipTutorial();
                        startRun({ tutorial: false });
                      }}
                    >
                      Skip
                    </Btn>
                    <Btn
                      variant="primary"
                      testId="start-tutorial"
                      onClick={() => {
                        setAskTutorial(false);
                        startRun({ tutorial: true });
                      }}
                    >
                      Learn the moves
                    </Btn>
                  </>
                }
              >
                <p>A one-minute interactive tutorial covers lanes, jumps, ducks, grinds and air tricks.</p>
                <p className="reward-line">
                  Finish it once for <strong>600 Mall Cash</strong> — enough for your first cosmetic.
                </p>
              </Modal>
            )}
            {mockAd && (
              <MockAdOverlay
                placement={mockAd.placement}
                onDone={(r) => {
                  mockAd.resolve(r);
                  setMockAd(null);
                }}
              />
            )}
            {mockPurchase && (
              <MockPurchaseSheet
                product={mockPurchase.product}
                onDone={(r) => {
                  mockPurchase.resolve(r);
                  setMockPurchase(null);
                }}
              />
            )}
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
