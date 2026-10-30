import React from 'react';

const PHASE_CLASS = {
  ready: 'phase-ready',
  running: 'phase-running',
  warning: 'phase-warning',
  overtime: 'phase-overtime',
  finished: 'phase-finished',
  paused: 'phase-paused'
};

export default function TimerDisplay ({
  text,
  color,
  phase,
  phaseLabel,
  modeLabel,
  progress,
  isOvertime
}) {
  return (
    <section className="timer-panel" aria-live="polite">
      <div className="timer-panel__top">
        <span className={`phase-badge ${PHASE_CLASS[phase] || 'phase-ready'}`}>{phaseLabel}</span>
        <span className="mode-chip">{modeLabel}</span>
      </div>

      <div
        className={`timer-value ${isOvertime ? 'timer-value--overtime' : ''}`}
        style={{ color, textShadow: `0 0 38px ${color}55` }}
      >
        {text}
      </div>

      <div className="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100">
        <div
          className="progress-fill"
          style={{ width: `${Math.round(progress * 1000) / 10}%`, backgroundColor: color }}
        />
      </div>
      <div className="progress-caption">
        <span>{Math.round(progress * 100)}%</span>
      </div>
    </section>
  );
}
