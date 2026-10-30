import React from 'react';

function HealthDot ({ level }) {
  return <span className={`status-dot status-dot--${level}`} />;
}

export default function OscSettings ({
  settings,
  targets,
  selectedTarget,
  scanning,
  health,
  lastPush,
  lastTrigger,
  error,
  onSettingsChange,
  onScan,
  onSelectTarget,
  onTest,
  ndiStatus,
  onToggleNdi,
  t
}) {
  const restOk = health ? health.rest : null;
  const oscOk = health && health.osc ? health.osc.ok : null;
  const targetOptions =
    selectedTarget && !targets.some((target) => target.id === selectedTarget.id)
      ? [selectedTarget, ...targets]
      : targets;
  const timeUpTrigger = settings.timeUpTrigger || {
    enabled: false,
    type: 'clip',
    layer: 1,
    column: 1,
    group: 1
  };
  const updateTrigger = (patch) => {
    onSettingsChange({ timeUpTrigger: { ...timeUpTrigger, ...patch } });
  };

  const ndiConfig = settings.ndi || {
    enabled: false,
    name: 'Resolume Arena Timer',
    fps: 30,
    transparent: true,
    includeNotes: true
  };
  const updateNdi = (patch) => {
    const nextNdi = { ...ndiConfig, ...patch };
    onSettingsChange({ ndi: nextNdi });
    if (patch.enabled !== undefined && onToggleNdi) {
      onToggleNdi(patch.enabled, nextNdi);
    }
  };

  let level = 'checking';
  if (restOk === true && oscOk !== false) level = 'connected';
  else if (restOk === false && oscOk === false) level = 'disconnected';
  else if (restOk === true || oscOk === true) level = 'degraded';
  else if (restOk === false) level = 'disconnected';

  const healthLabel = t(`health.${level === 'checking' ? 'degraded' : level}`);

  const isNdiActive = ndiStatus && ndiStatus.active;
  const isNdiAvailable = ndiStatus ? ndiStatus.available : true;

  return (
    <section className="panel resolume-panel">
      <div className="panel__header">
        <h2>{t('resolume.title')}</h2>
        <span className={`health-pill health-pill--${level}`}>
          <HealthDot level={level} />
          {healthLabel}
        </span>
      </div>

      <label className="checkbox-row checkbox-row--strong">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => onSettingsChange({ enabled: event.target.checked })}
        />
        <span>{t('resolume.enabled')}</span>
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={settings.syncColor !== false}
          disabled={!selectedTarget || !selectedTarget.colorParamId}
          onChange={(event) => onSettingsChange({ syncColor: event.target.checked })}
        />
        <span>{t('resolume.syncColor')}</span>
      </label>

      {selectedTarget && !selectedTarget.colorParamId ? (
        <p className="muted">{t('resolume.colorUnavailable')}</p>
      ) : null}

      <div className="control-grid">
        <label className="field">
          <span>{t('resolume.host')}</span>
          <input
            type="text"
            value={settings.host}
            onChange={(event) => onSettingsChange({ host: event.target.value })}
          />
        </label>
        <label className="field">
          <span>{t('resolume.restPort')}</span>
          <input
            type="number"
            min="1"
            max="65535"
            value={settings.restPort}
            onChange={(event) => onSettingsChange({ restPort: Number(event.target.value) || 8080 })}
          />
        </label>
        <label className="field">
          <span>{t('resolume.oscHost')}</span>
          <input
            type="text"
            value={settings.oscHost}
            onChange={(event) => onSettingsChange({ oscHost: event.target.value })}
          />
        </label>
        <label className="field">
          <span>{t('resolume.oscPort')}</span>
          <input
            type="number"
            min="1"
            max="65535"
            value={settings.oscPort}
            onChange={(event) => onSettingsChange({ oscPort: Number(event.target.value) || 7000 })}
          />
        </label>
      </div>

      <div className="control-grid">
        <label className="field">
          <span>{t('resolume.mode')}</span>
          <select
            value={settings.sendMode}
            onChange={(event) => onSettingsChange({ sendMode: event.target.value })}
          >
            <option value="auto">{t('resolume.auto')}</option>
            <option value="rest">{t('resolume.rest')}</option>
            <option value="osc">{t('resolume.osc')}</option>
          </select>
        </label>
      </div>

      <div className="subsection">
        <div className="inline-field inline-field--between">
          <button type="button" className="button" onClick={onScan} disabled={scanning}>
            {scanning ? t('resolume.scanning') : t('resolume.scan')}
          </button>
          <span className="muted">
            {targetOptions.length > 0 ? t('resolume.targets', { count: targetOptions.length }) : t('resolume.noTarget')}
          </span>
        </div>

        <label className="field field--wide">
          <span>{t('resolume.target')}</span>
          <select
            value={selectedTarget ? selectedTarget.id : ''}
            onChange={(event) => onSelectTarget(event.target.value)}
          >
            <option value="">{t('resolume.selectTarget')}</option>
            {targetOptions.map((target) => (
              <option key={target.id} value={target.id}>
                {target.scope} — {target.paramName}
              </option>
            ))}
          </select>
        </label>

        {selectedTarget ? (
          <div className="target-details">
            <div>
              <span>{t('resolume.paramId')}</span>
              <code>{selectedTarget.paramId || '—'}</code>
            </div>
            <div>
              <span>{t('resolume.oscPath')}</span>
              <code>{selectedTarget.oscPath}</code>
            </div>
            {selectedTarget.currentValue !== null && selectedTarget.currentValue !== undefined ? (
              <div>
                <span>Resolume</span>
                <code>{String(selectedTarget.currentValue)}</code>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="subsection">
        <div className="inline-field inline-field--between">
          <button
            type="button"
            className="button"
            onClick={onTest}
            disabled={!selectedTarget || scanning}
          >
            {t('resolume.test')}
          </button>
          <span className="muted">
            {t('resolume.lastSent')}: {lastPush ? lastPush.label : t('resolume.never')}
          </span>
        </div>

        <div className="transport-grid">
          <div className={`transport-card ${restOk === true ? 'is-ok' : restOk === false ? 'is-bad' : ''}`}>
            <span>{t('health.rest')}</span>
            <strong>
              {restOk === true
                ? t('health.connected')
                : restOk === false
                  ? t('health.disconnected')
                  : t('status.checking')}
            </strong>
          </div>
          <div className={`transport-card ${oscOk === true ? 'is-ok' : oscOk === false ? 'is-bad' : ''}`}>
            <span>{t('health.osc')}</span>
            <strong>
              {oscOk === true
                ? t('health.connected')
                : oscOk === false
                  ? t('health.disconnected')
                  : t('health.unknown')}
            </strong>
          </div>
        </div>
      </div>

      {/* NDI Output Subsection */}
      <div className="subsection">
        <div className="panel__header" style={{ marginBottom: '12px' }}>
          <h3>{t('ndi.title')}</h3>
          <span className={`health-pill health-pill--${isNdiActive ? 'connected' : isNdiAvailable ? 'checking' : 'disconnected'}`}>
            <HealthDot level={isNdiActive ? 'connected' : isNdiAvailable ? 'checking' : 'disconnected'} />
            {isNdiActive ? t('ndi.active') : isNdiAvailable ? t('ndi.inactive') : t('ndi.unavailable')}
          </span>
        </div>

        <label className="checkbox-row checkbox-row--strong">
          <input
            type="checkbox"
            checked={Boolean(ndiConfig.enabled)}
            disabled={!isNdiAvailable}
            onChange={(event) => updateNdi({ enabled: event.target.checked })}
          />
          <span>{t('ndi.enabled')}</span>
        </label>

        {isNdiActive ? (
          <p className="muted" style={{ color: 'var(--accent)', fontSize: '12px', margin: '4px 0 10px' }}>
            {t('ndi.receivers', { count: ndiStatus.connections || 0 })}
          </p>
        ) : null}

        <div className="control-grid">
          <label className="field">
            <span>{t('ndi.name')}</span>
            <input
              type="text"
              value={ndiConfig.name || 'Resolume Arena Timer'}
              onChange={(event) => updateNdi({ name: event.target.value })}
            />
          </label>
          <label className="field">
            <span>{t('ndi.fps')}</span>
            <select
              value={ndiConfig.fps || 30}
              onChange={(event) => updateNdi({ fps: Number(event.target.value) || 30 })}
            >
              <option value="30">30 FPS</option>
              <option value="60">60 FPS</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={ndiConfig.transparent !== false}
              onChange={(event) => updateNdi({ transparent: event.target.checked })}
            />
            <span>{t('ndi.transparent')}</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={ndiConfig.includeNotes !== false}
              onChange={(event) => updateNdi({ includeNotes: event.target.checked })}
            />
            <span>{t('ndi.includeNotes')}</span>
          </label>
        </div>
      </div>

      <div className="subsection">
        <h3>{t('resolume.timeUpAction')}</h3>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(timeUpTrigger.enabled)}
            onChange={(event) => updateTrigger({ enabled: event.target.checked })}
          />
          <span>{t('resolume.triggerEnabled')}</span>
        </label>

        <div className="control-grid">
          <label className="field">
            <span>{t('resolume.triggerType')}</span>
            <select
              value={timeUpTrigger.type}
              onChange={(event) => updateTrigger({ type: event.target.value })}
            >
              <option value="clip">{t('resolume.triggerClip')}</option>
              <option value="column">{t('resolume.triggerColumn')}</option>
              <option value="group">{t('resolume.triggerGroup')}</option>
            </select>
          </label>

          {timeUpTrigger.type === 'clip' ? (
            <label className="field">
              <span>{t('resolume.layer')}</span>
              <input
                type="number"
                min="1"
                value={timeUpTrigger.layer}
                onChange={(event) => updateTrigger({ layer: Math.max(1, Number(event.target.value) || 1) })}
              />
            </label>
          ) : null}

          {timeUpTrigger.type === 'group' ? (
            <label className="field">
              <span>{t('resolume.group')}</span>
              <input
                type="number"
                min="1"
                value={timeUpTrigger.group}
                onChange={(event) => updateTrigger({ group: Math.max(1, Number(event.target.value) || 1) })}
              />
            </label>
          ) : null}

          <label className="field">
            <span>{t('resolume.column')}</span>
            <input
              type="number"
              min="1"
              value={timeUpTrigger.column}
              onChange={(event) => updateTrigger({ column: Math.max(1, Number(event.target.value) || 1) })}
            />
          </label>
        </div>

        <p className="muted">
          {t('resolume.lastTrigger')}: {lastTrigger ? lastTrigger.label : t('resolume.notTriggered')}
        </p>
      </div>

      {error ? <p className="error-text">{t('resolume.error')}: {error}</p> : null}
    </section>
  );
}
