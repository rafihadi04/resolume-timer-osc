import React, { useEffect, useState } from 'react';
import { formatDuration, parseTimeInput } from '../lib/time';

function TimeField({ label, valueSeconds, onCommit, hint }) {
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

function QuickButton({ children, title, onClick }) {
  return (
    <button type="button" className="quick-button" title={title} onClick={onClick}>
      {children}
    </button>
  );
}

export default function TimeControls({
  config,
  onChange,
  onColorChange,
  timer,
  onManualApply,
  targets = [],
  selectedNotesTarget,
  onSelectNotesTarget,
  onTestNotes,
  lastNotesPush,
  screenFlashRemaining = 0,
  onTriggerScreenFlash,
  onStopScreenFlash,
  t
}) {
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState(false);
  const [draftNotes, setDraftNotes] = useState(config.notes || '');

  useEffect(() => {
    setDraftNotes(config.notes || '');
  }, [config.notes]);

  const isNotesDirty = draftNotes !== (config.notes || '');
  const hasLiveNotes = Boolean((config.notes || '').trim());

  const handleSendNotes = () => {
    onChange({ notes: draftNotes });
  };

  const handleClearNotes = () => {
    setDraftNotes('');
    onChange({ notes: '' });
  };
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
  const notesMode = config.notesMode || 'append';

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

      {/* Stage & Speaker Notes Section */}
      <div className="subsection">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={{ margin: 0 }}>{t('notes.title')}</h3>
          {isNotesDirty ? (
            <span className="notes-status-badge notes-status-badge--draft">
              {t('notes.unsent')}
            </span>
          ) : hasLiveNotes ? (
            <span className="notes-status-badge notes-status-badge--live">
              {t('notes.live')}
            </span>
          ) : null}
        </div>

        <label className="field field--wide">
          <textarea
            style={{
              width: '100%',
              minHeight: '80px',
              fontFamily: 'inherit',
              padding: '10px 12px',
              background: '#0d141c',
              border: isNotesDirty ? '1px solid rgba(255, 204, 0, 0.6)' : '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: '1.4'
            }}
            placeholder={t('notes.placeholder')}
            value={draftNotes}
            onChange={(event) => setDraftNotes(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                handleSendNotes();
              }
            }}
          />
        </label>

        <div className="notes-actions-bar">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="button button--primary"
              onClick={handleSendNotes}
              disabled={!isNotesDirty && !hasLiveNotes}
              title="Ctrl+Enter"
            >
              {t('notes.send')}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={handleClearNotes}
              disabled={!draftNotes && !hasLiveNotes}
            >
              {t('notes.clear')}
            </button>
          </div>
          {isNotesDirty ? (
            <span className="muted" style={{ fontSize: '11px' }}>
              Ctrl+Enter {t('timer.apply').toLowerCase()}
            </span>
          ) : null}
        </div>

        <label className="checkbox-row" style={{ marginTop: '10px', marginBottom: '6px' }}>
          <input
            type="checkbox"
            checked={Boolean(config.notesFlash)}
            onChange={(event) => onChange({ notesFlash: event.target.checked })}
          />
          <span>{t('notes.flashAlert')}</span>
        </label>

        <div className="control-grid" style={{ marginTop: '10px' }}>
          <label className="field field--wide">
            <span>{t('notes.mode')}</span>
            <select
              value={notesMode}
              onChange={(event) => onChange({ notesMode: event.target.value })}
            >
              <option value="append">{t('notes.modeAppend')}</option>
              <option value="separate">{t('notes.modeSeparate')}</option>
            </select>
          </label>
        </div>

        {notesMode === 'separate' ? (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="field field--wide">
              <span>{t('notes.target')}</span>
              <select
                value={selectedNotesTarget ? selectedNotesTarget.id : ''}
                onChange={(event) => onSelectNotesTarget(event.target.value)}
              >
                <option value="">{t('notes.noTarget')}</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.scope} — {target.paramName}
                  </option>
                ))}
              </select>
            </label>

            {selectedNotesTarget ? (
              <div className="inline-field inline-field--between" style={{ marginTop: '4px' }}>
                <button
                  type="button"
                  className="button"
                  onClick={onTestNotes}
                >
                  {t('notes.test')}
                </button>
                <span className="muted" style={{ fontSize: '12px' }}>
                  {lastNotesPush ? lastNotesPush.label : t('resolume.never')}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
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

        {/* Screen Flash Alert Card */}
        <div className={`flash-alert-card ${screenFlashRemaining > 0 ? 'flash-alert-card--active' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff8099' }}>
              ⚡ {t('flash.screenTitle')}
            </span>
            {screenFlashRemaining > 0 ? (
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#ff4d6d' }}>
                {t('flash.flashing', { sec: screenFlashRemaining })}
              </span>
            ) : null}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '11px', lineHeight: 1.4 }}>
            {t('flash.screenDesc')}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="button button--small"
              onClick={() => onTriggerScreenFlash && onTriggerScreenFlash(3)}
            >
              {t('flash.screenBtn', { sec: 3 })}
            </button>
            <button
              type="button"
              className="button button--small"
              onClick={() => onTriggerScreenFlash && onTriggerScreenFlash(5)}
            >
              {t('flash.screenBtn', { sec: 5 })}
            </button>
            <button
              type="button"
              className="button button--small"
              onClick={() => onTriggerScreenFlash && onTriggerScreenFlash(10)}
            >
              {t('flash.screenBtn', { sec: 10 })}
            </button>
            {screenFlashRemaining > 0 ? (
              <button
                type="button"
                className="button button--danger button--small"
                onClick={() => onStopScreenFlash && onStopScreenFlash()}
              >
                {t('flash.stopScreen')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
