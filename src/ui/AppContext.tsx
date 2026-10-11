import { createContext, useContext } from 'react';
import type { Slot } from '../config/catalog';
import type { RunResult } from '../economy/store';
import type { GameRuntime, Toast } from '../game/runtime';

export type Screen =
  | { name: 'menu' }
  | { name: 'game' }
  | { name: 'results'; result: RunResult }
  | { name: 'shop'; slot?: Slot | 'board'; focusItem?: string }
  | { name: 'wardrobe'; tab?: 'outfit' | 'look' | 'boards' | 'presets' | 'duplicates' }
  | { name: 'duplicates' }
  | { name: 'missions' }
  | { name: 'stats' }
  | { name: 'collection' }
  | { name: 'settings' }
  | { name: 'cash' }
  | { name: 'reveal' }
  | { name: 'dev' };

export interface AppApi {
  runtime(): GameRuntime | null;
  screen: Screen;
  go(screen: Screen): void;
  back(): void;
  play(): void;
  startRun(opts: { tutorial: boolean }): void;
  toast(t: Omit<Toast, 'id'>): void;
}

export const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppContext missing');
  return v;
}
