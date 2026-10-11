import { BADGES, missionByIndex } from '../../config/missions';
import { useApp } from '../AppContext';
import { CashAmount, ProgressBar, ScreenHeader, WalletPill } from '../components';
import { TrophyIcon } from '../icons';
import { formatCash, useSave } from '../services';

export function Missions() {
  const save = useSave();
  const app = useApp();
  return (
    <div className="screen panel-screen" data-testid="missions">
      <ScreenHeader title="Missions" sub="Rewards pay out the moment you finish" onBack={app.back} right={<WalletPill amount={save.wallet.cash} />} />
      <div className="panel-scroll">
        <h3 className="section">Active</h3>
        <ul className="mission-list">
          {save.missions.active.map((m) => {
            const def = missionByIndex(m.missionIndex);
            const progress = Math.min(m.progress, def.target);
            return (
              <li key={m.instanceId} className="mission" data-testid={`mission-${def.id}`}>
                <div className="mission-head">
                  <span className="mission-title">{def.title}</span>
                  <CashAmount amount={def.reward.cash} size="sm" sign />
                </div>
                <ProgressBar value={progress} max={def.target} label={`${formatCash(progress)} / ${formatCash(def.target)}${def.scope === 'run' ? ' (one run)' : ''}`} />
                {def.reward.badge && <div className="mission-badge">+ badge: {BADGES[def.reward.badge]?.name}</div>}
              </li>
            );
          })}
        </ul>
        <h3 className="section">Badges</h3>
        {save.missions.badges.length === 0 ? (
          <p className="muted">Badges are cosmetic recognition earned from missions.</p>
        ) : (
          <div className="badges">
            {save.missions.badges.map((b) => (
              <div className="badge-sticker" key={b} title={BADGES[b]?.description}>
                <TrophyIcon size={18} /> {BADGES[b]?.name ?? b}
              </div>
            ))}
          </div>
        )}
        <h3 className="section">Completed</h3>
        {save.missions.completed.length === 0 ? (
          <p className="muted">Nothing yet — go skate!</p>
        ) : (
          <ul className="done-list">
            {[...save.missions.completed].reverse().slice(0, 20).map((c) => (
              <li key={c.instanceId}>
                <span>{c.title}</span>
                <CashAmount amount={c.reward} size="sm" sign />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
