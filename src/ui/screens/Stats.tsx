import { CATALOG_ITEMS } from '../../config/catalog';
import { useApp } from '../AppContext';
import { Btn, ProgressBar, ScreenHeader } from '../components';
import { formatCash, useSave } from '../services';

export function Stats() {
  const save = useSave();
  const app = useApp();
  const s = save.stats;
  const ownedCatalog = CATALOG_ITEMS.filter((i) => save.owned[i.id]).length;
  const discovered = CATALOG_ITEMS.filter((i) => save.discovered.includes(i.id)).length;
  const rows: Array<[string, string]> = [
    ['Best distance', `${formatCash(s.bestDistance)} m`],
    ['Best style score', formatCash(s.bestStyle)],
    ['Best combo', `${formatCash(s.bestCombo)}`],
    ['Total distance', `${formatCash(s.totalDistance)} m`],
    ['Runs played', formatCash(s.runsPlayed)],
    ['Total grinds', formatCash(s.totalGrinds)],
    ['Rail grinded', `${formatCash(s.totalGrindDistance)} m`],
    ['Air tricks', formatCash(s.totalTricks)],
    ['Clean jumps', formatCash(s.totalCleanJumps)],
    ['Near misses', formatCash(s.totalNearMisses)],
    ['Longest clean streak', `${formatCash(s.longestNoHitSeconds)} s`],
    ['Busted by security', formatCash(s.captures)],
    ['Wipeouts', formatCash(s.crashes)],
    ['Mystery bags found', formatCash(s.bagsCollected)],
    ['Bags skated past', formatCash(s.bagsMissed)],
    ['Items discovered', `${discovered} / ${CATALOG_ITEMS.length}`],
    ['Duplicate sale earnings', formatCash(s.duplicateSaleEarnings)],
    ['Mall Cash from pickups', formatCash(s.cashFromPickups)],
    ['Mall Cash from missions', formatCash(s.cashFromMissions)],
    ['Missions completed', formatCash(s.missionsCompleted)],
  ];
  return (
    <div className="screen panel-screen" data-testid="stats">
      <ScreenHeader title="Stats" sub="Stored on this device" onBack={app.back} />
      <div className="panel-scroll">
        <div className="collection-meter">
          <span>Collection</span>
          <ProgressBar value={ownedCatalog} max={CATALOG_ITEMS.length} label={`${ownedCatalog} / ${CATALOG_ITEMS.length} (${Math.round((ownedCatalog / CATALOG_ITEMS.length) * 100)}%)`} testId="collection-progress" />
        </div>
        <dl className="stat-grid">
          {rows.map(([k, v]) => (
            <div key={k} className="stat-cell">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <Btn onClick={() => app.go({ name: 'collection' })} testId="open-collection">
          Collection & bag odds
        </Btn>
      </div>
    </div>
  );
}
