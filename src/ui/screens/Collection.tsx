import { ALL_ITEMS, CATALOG_ITEMS, RARITIES, RARITY_COLORS, RARITY_LABELS } from '../../config/catalog';
import { DROPS } from '../../config/drops';
import { ECONOMY } from '../../config/economy';
import { effectiveRarityOdds } from '../../engine/dropDirector';
import { useApp } from '../AppContext';
import { RarityTag, ScreenHeader } from '../components';
import { ItemArt } from '../ItemArt';
import { formatCash, useSave } from '../services';

function formatOdds(weight: number): string {
  const pct = Math.round(weight * 1000) / 10;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

export function Collection() {
  const save = useSave();
  const app = useApp();
  const odds = effectiveRarityOdds(ALL_ITEMS);
  return (
    <div className="screen panel-screen" data-testid="collection">
      <ScreenHeader title="Collection" sub="Mystery bag odds & catalog" onBack={app.back} />
      <div className="panel-scroll">
        <section className="info-card">
          <h3>How mystery bags work</h3>
          <ul className="bullets">
            <li>
              About one bag appears every {DROPS.opportunityMinutes[0]}–{DROPS.opportunityMinutes[1]} minutes of active skating (counted by distance, across runs). Paused time never counts.
            </li>
            <li>A bag always shows up within {DROPS.maxDroughtMinutes} minutes of skating. Progress carries over between runs and survives reloads.</li>
            <li>Each bag holds one cosmetic. You must physically grab it — it never sits behind an unavoidable obstacle.</li>
            <li>Bags, keys, rerolls and better odds are never sold. Ads and purchases never change drop rates.</li>
            <li>Every item can also be bought directly in the shop at a fixed price.</li>
          </ul>
          <table className="odds-table" data-testid="odds-table">
            <thead>
              <tr>
                <th>Rarity</th>
                <th>Bag odds</th>
                <th>Items</th>
                <th>Duplicate sells for</th>
              </tr>
            </thead>
            <tbody>
              {RARITIES.map((r) => (
                <tr key={r}>
                  <td>
                    <RarityTag rarity={r} />
                  </td>
                  <td data-testid={`odds-${r}`}>{formatOdds(odds[r])}</td>
                  <td>{CATALOG_ITEMS.filter((i) => i.rarity === r).length}</td>
                  <td>{formatCash(ECONOMY.sellback[r])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Within a rarity, each eligible item is equally likely unless configured otherwise.</p>
        </section>
        {RARITIES.map((r) => (
          <section key={r} className="collection-tier">
            <h3 style={{ color: RARITY_COLORS[r] }}>{RARITY_LABELS[r]}</h3>
            <div className="mini-grid">
              {CATALOG_ITEMS.filter((i) => i.rarity === r).map((it) => (
                <div key={it.id} className={`mini-card ${save.owned[it.id] ? 'owned' : 'missing'}`} title={it.name}>
                  <ItemArt item={it} size={44} />
                  <span>{it.name}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
