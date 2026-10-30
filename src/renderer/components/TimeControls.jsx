import React, { useEffect, useState } from 'react';
import { formatDuration, parseTimeInput } from '../lib/time';

function TimeField ({ label, valueSeconds, onCommit, hint }) {
  const [text, setText] = useState(formatDuration(valueSeconds));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatDuration(valueSeconds));
  }, [valueSeconds, focused]);

  const commit = () => {
    const parsed = parseTimeInput(text);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onCommit(parsed);
    } else {
      setText(formatDuration(valueSeconds));
    }
    setFocused(false);
  };

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        value={text}
        placeholder="HH:MM:SS"
        onChange={(event) => setText(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function QuickButton ({ children, title, onClick }) {
  return (
    <button type="button" className="quick-button" title={title} onClick={onClick}>
      {children}
    </button>
  );
}

export default function TimeControls ({
  config,
  onChange,
  onColorChange,
  timer,
  onManualApply,
  t
}) {
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState(false);
  const speeds = [0.25, 0.5, 1, 1.25, 1.5, 2];
  const speed = Number(config.speedMultiplier) || 1;
  const isCustomSpeed = !speeds.includes(speed);

  const applyManual = () => {
    const parsed = parseTimeInput(manual);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setManualError(true);
      return;
    }
    setManualError(false);
    onManualApply(parsed);
    setManual('');
  };

  const primaryLabel =
    timer.status === 'running'
      ? t('timer.pause')
      : timer.status === 'paused'
        ? t('timer.resume')
        : timer.status === 'finished'
          ? t('timer.restart')
          : t('timer.start');

  const isCountUp = config.mode === 'COUNTUP';

  return (
    <section className="panel controls-panel">
      <div className="panel__header">
        <h2>{t('timer.control')}</h2>
        <span className="panel__hint">{t('settings.saved')}</span>
      </div>

      <div className="action-row">
        <button type="button" className="button button--primary" onClick={timer.toggle}>
          {primaryLabel}
        </button>
        <button type="button" className="button" onClick={timer.reset}>
          {t('timer.reset')}
        </button>
      </div>

      <div className="control-grid">
        <label className="field">
          <span>{t('timer.speed')}</span>
          <div className="inline-field">
            <select
              value={isCustomSpeed ? 'custom' : String(speed)}
              onChange={(event) => {
                const value = event.target.value;
                onChange({ speedMultiplier: value === 'custom' ? 3 : Number(value) });
              }}
            >
              {speeds.map((value) => (
                <option key={value} value={String(value)}>
                  {value}x
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
            {isCustomSpeed ? (
              <input
                type="number"
                min="0.1"
                max="20"
                step="0.05"
                value={speed}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value > 0) {
                    onChange({ speedMultiplier: value });
                  }
                }}
              />
            ) : null}
          </div>
        </label>

        <label className="field">
          <span>{t('timer.warning')}</span>
          <input
            type="number"
            min="0"
            step="1"
            value={config.warningThresholdSeconds}
            onChange={(event) => {
              const value = Math.max(0, Number(event.target.value) || 0);
              onChange({ warningThresholdSeconds: value });
            }}
          />
        </label>

        <div className="field field--wide">
          <span>{isCountUp ? t('timer.target') : t('timer.duration')}</span>
          <div className="inline-field">
            <TimeField
              label=""
              valueSeconds={config.durationSeconds}
              onCommit={(seconds) => onChange({ durationSeconds: seconds })}
            />
            <select
              value={config.mode}
              onChange={(event) => onChange({ mode: event.target.value })}
            >
              <option value="COUNTDOWN">{t('mode.countdown')}</option>
              <option value="COUNTUP">{t('mode.countup')}</option>
              <option value="COUNTDOWN_THEN_COUNTUP">{t('mode.overtime')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="subsection">
        <h3>{t('timer.quick')}</h3>
        <div className="quick-grid">
          <QuickButton title={t('timer.add')} onClick={() => timer.adjust(3600)}>+1 hr</QuickButton>
          <QuickButton title={t('timer.add')} onClick={() => timer.adjust(300)}>+5 min</QuickButton>
          <QuickButton title={t('timer.add')} onClick={() => timer.adjust(60)}>+1 min</QuickButton>
          <QuickButton title={t('timer.add')} onClick={() => timer.adjust(10)}>+10 sec</QuickButton>
          <QuickButton title={t('timer.subtract')} onClick={() => timer.adjust(-3600)}>-1 hr</QuickButton>
          <QuickButton title={t('timer.subtract')} onClick={() => timer.adjust(-300)}>-5 min</QuickButton>
          <QuickButton title={t('timer.subtract')} onClick={() => timer.adjust(-60)}>-1 min</QuickButton>
          <QuickButton title={t('timer.subtract')} onClick={() => timer.adjust(-10)}>-10 sec</QuickButton>
        </div>
      </div>

      <div className="subsection">
        <h3>{t('timer.manual')}</h3>
        <div className="inline-field">
          <input
            type="text"
            value={manual}
            placeholder="00:15:00"
            onChange={(event) => {
              setManual(event.target.value);
              setManualError(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyManual();
            }}
          />
          <button type="button" className="button" onClick={applyManual}>
            {t('timer.apply')}
          </button>
        </div>
        {manualError ? <p className="error-text">{t('timer.invalid')}</p> : null}
      </div>

      <div className="subsection">
        <h3>{t('colors.title')}</h3>
        <div className="color-grid">
          {['running', 'warning', 'timeout'].map((key) => (
            <label key={key} className="color-field">
              <input
                type="color"
                value={config.colorScheme[key]}
                onChange={(event) => onColorChange(key, event.target.value)}
              />
              <span>{t(`colors.${key}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="subsection">
        <h3>{t('flash.title')}</h3>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={config.flashEnabled}
            onChange={(event) => onChange({ flashEnabled: event.target.checked })}
          />
          <span>{t('flash.enabled')}</span>
        </label>

        <div className="control-grid">
          <label className="field">
            <span>{t('flash.message')}</span>
            <input
              type="text"
              value={config.timesUpMessage}
              onChange={(event) => onChange({ timesUpMessage: event.target.value })}
            />
          </label>
          <label className="field">
            <span>{t('flash.frequency')}</span>
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              value={config.flashHz}
              onChange={(event) => {
                const value = Math.min(10, Math.max(0.5, Number(event.target.value) || 2));
                onChange({ flashHz: value });
              }}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
