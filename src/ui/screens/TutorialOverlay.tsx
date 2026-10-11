import type { TutorialStep } from '../../config/routes';

const GESTURE: Record<TutorialStep['expect'], string> = {
  lane: 'gesture-lr',
  jump: 'gesture-up',
  duck: 'gesture-down',
  grind: 'gesture-rail',
  trick: 'gesture-air',
  none: 'gesture-none',
};

export function TutorialOverlay({ step, state, onSkip }: { step: TutorialStep; state: 'show' | 'done' | 'retry'; onSkip: () => void }) {
  return (
    <div className="tutorial" data-testid="tutorial">
      <div className={`tutorial-card ${state}`} data-testid={`tutorial-${step.id}`}>
        <div className="tutorial-kicker">{state === 'done' ? 'Nice!' : state === 'retry' ? 'Try again' : 'Tutorial'}</div>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        {state !== 'done' && <div className={`gesture ${GESTURE[step.expect]}`} aria-hidden />}
      </div>
      <button type="button" className="tutorial-skip" onClick={onSkip} data-testid="tutorial-skip">
        Skip tutorial
      </button>
    </div>
  );
}
