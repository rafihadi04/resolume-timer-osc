import React, { useRef, useState } from 'react';
import { formatDuration } from '../lib/time';

const MODE_LABEL = {
  COUNTDOWN: 'countdown',
  COUNTUP: 'countup',
  COUNTDOWN_THEN_COUNTUP: 'overtime'
};

export default function PresetManager ({
  presets,
  onSave,
  onLoad,
  onUpdate,
  onDelete,
  onExport,
  onImport,
  importError,
  t
}) {
  const [name, setName] = useState('');
  const fileInput = useRef(null);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName('');
  };

  return (
    <section className="panel presets-panel">
      <div className="panel__header">
        <h2>{t('presets.title')}</h2>
        <div className="mini-actions">
          <button type="button" className="button button--ghost" onClick={onExport}>
            {t('presets.export')}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => fileInput.current && fileInput.current.click()}
          >
            {t('presets.import')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden-input"
            onChange={(event) => {
              const file = event.target.files && event.target.files[0];
              if (file) onImport(file);
              event.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="inline-field">
        <input
          type="text"
          value={name}
          placeholder={t('presets.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save();
          }}
        />
        <button type="button" className="button" onClick={save} disabled={!name.trim()}>
          {t('presets.save')}
        </button>
      </div>

      {importError ? <p className="error-text">{t('presets.importError')}</p> : null}

      <div className="preset-list">
        {presets.length === 0 ? (
          <p className="muted">{t('presets.empty')}</p>
        ) : (
          presets.map((preset) => (
            <article key={preset.id} className="preset-item">
              <div>
                <strong>{preset.name}</strong>
                <small>
                  {formatDuration(preset.durationSeconds)} · {t(`mode.${MODE_LABEL[preset.mode] || 'countdown'}`)} · {preset.speedMultiplier}x
                </small>
              </div>
              <div className="preset-actions">
                <button type="button" className="button button--small" onClick={() => onLoad(preset)}>
                  {t('presets.load')}
                </button>
                <button type="button" className="button button--small" onClick={() => onUpdate(preset)}>
                  {t('presets.update')}
                </button>
                <button
                  type="button"
                  className="button button--small button--danger"
                  onClick={() => onDelete(preset.id)}
                >
                  {t('presets.delete')}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
