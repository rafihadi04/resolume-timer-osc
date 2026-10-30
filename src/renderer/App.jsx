import React, { useCallback, useEffect, useRef, useState } from 'react';
import i18n from './i18n';
import TimerDisplay from './components/TimerDisplay';
import TimeControls from './components/TimeControls';
import OscSettings from './components/OscSettings';
import PresetManager from './components/PresetManager';
import QrisDonateModal from './components/QrisDonateModal';
import RemoteAccessModal from './components/RemoteAccessModal';
import { useTimer } from './hooks/useTimer';
import { formatDuration, msToDisplay } from './lib/time';

const DEFAULT_CONFIG = {
  durationSeconds: 900,
  mode: 'COUNTDOWN_THEN_COUNTUP',
  speedMultiplier: 1,
  warningThresholdSeconds: 120,
  colorScheme: {
    running: '#00ff66',
    warning: '#ffcc00',
    timeout: '#ff0055'
  },
  timesUpMessage: "TIME'S UP",
  flashEnabled: true,
  flashHz: 2
};

const DEFAULT_SETTINGS = {
  host: '127.0.0.1',
  restPort: 8080,
  oscHost: '127.0.0.1',
  oscPort: 7000,
  sendMode: 'auto',
  enabled: false,
  syncColor: true,
  timeUpTrigger: {
    enabled: false,
    type: 'clip',
    layer: 1,
    column: 1,
    group: 1
  }
};

const MODE_KEY = {
  COUNTDOWN: 'countdown',
  COUNTUP: 'countup',
  COUNTDOWN_THEN_COUNTUP: 'overtime'
};

function readStorage (key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (_error) {
    return fallback;
  }
}

function loadConfig () {
  const saved = readStorage('rt.config', null);
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_CONFIG };
  const { id: _id, name: _name, ...timing } = saved;
  return {
    ...DEFAULT_CONFIG,
    ...timing,
    colorScheme: { ...DEFAULT_CONFIG.colorScheme, ...(saved.colorScheme || {}) }
  };
}

function loadSettings () {
  const saved = readStorage('rt.settings', null);
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    timeUpTrigger: {
      ...DEFAULT_SETTINGS.timeUpTrigger,
      ...(saved.timeUpTrigger || {})
    }
  };
}

function loadPresets () {
  const saved = readStorage('rt.presets', []);
  return Array.isArray(saved) ? saved : [];
}

function loadLanguage () {
  const saved = readStorage('rt.language', null);
  return saved === 'id' ? 'id' : 'en';
}

function normalizePreset (preset) {
  if (!preset || typeof preset !== 'object') return null;
  const mode = MODE_KEY[preset.mode] ? preset.mode : 'COUNTDOWN';
  return {
    id: String(preset.id || `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    name: String(preset.name || 'Untitled preset'),
    durationSeconds: Math.max(0, Number(preset.durationSeconds) || 0),
    mode,
    speedMultiplier: Number(preset.speedMultiplier) > 0 ? Number(preset.speedMultiplier) : 1,
    warningThresholdSeconds: Math.max(0, Number(preset.warningThresholdSeconds) || 0),
    timesUpMessage: String(preset.timesUpMessage || "TIME'S UP"),
    flashEnabled: preset.flashEnabled !== false,
    flashHz: Math.min(10, Math.max(0.5, Number(preset.flashHz) || 2)),
    colorScheme: {
      ...DEFAULT_CONFIG.colorScheme,
      ...(preset.colorScheme || {})
    }
  };
}

function healthLevelFor (health) {
  if (!health) return 'checking';
  const rest = health.rest;
  const osc = health.osc ? health.osc.ok : null;

  if (rest === true && osc !== false) return 'connected';
  if (rest === false && osc === false) return 'disconnected';
  if (rest === true || osc === true) return 'degraded';
  if (rest === false) return 'disconnected';
  return 'checking';
}

function pushLabel (result, t) {
  if (result && result.ok) {
    return `${String(result.transport || 'sent').toUpperCase()} · ${new Date().toLocaleTimeString()}`;
  }
  return `${t('resolume.error')} · ${(result && result.error) || 'unknown'}`;
}

export default function App () {
  const [config, setConfig] = useState(loadConfig);
  const [settings, setSettings] = useState(loadSettings);
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(() => readStorage('rt.target', null));
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [presetImportError, setPresetImportError] = useState(false);
  const [health, setHealth] = useState(null);
  const [lastPush, setLastPush] = useState(null);
  const [lastTrigger, setLastTrigger] = useState(null);
  const [presets, setPresets] = useState(loadPresets);
  const [language, setLanguage] = useState(loadLanguage);
  const [donateOpen, setDonateOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [remoteInfo, setRemoteInfo] = useState(null);
  const [version, setVersion] = useState('');

  const didAutoScan = useRef(false);
  const timeUpTriggeredRef = useRef(false);
  const remoteStateRef = useRef(null);

  const timer = useTimer(config);

  const t = useCallback((key, options) => i18n.t(key, options), [language]);

  useEffect(() => {
    window.localStorage.setItem('rt.config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    window.localStorage.setItem('rt.settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (selectedTarget) {
      window.localStorage.setItem('rt.target', JSON.stringify(selectedTarget));
    } else {
      window.localStorage.removeItem('rt.target');
    }
  }, [selectedTarget]);

  useEffect(() => {
    window.localStorage.setItem('rt.presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    window.localStorage.setItem('rt.language', JSON.stringify(language));
  }, [language]);

  const changeLanguage = useCallback((nextLanguage) => {
    i18n.changeLanguage(nextLanguage);
    setLanguage(nextLanguage);
  }, []);

  useEffect(() => {
    if (window.api && window.api.version) {
      window.api.version().then(setVersion).catch(() => {});
    }
  }, []);

  const refreshRemoteInfo = useCallback(async () => {
    if (!window.api || !window.api.remoteInfo) return;
    try {
      setRemoteInfo(await window.api.remoteInfo());
    } catch (_error) {
      setRemoteInfo(null);
    }
  }, []);

  useEffect(() => {
    refreshRemoteInfo();
  }, [refreshRemoteInfo]);

  useEffect(() => {
    if (remoteOpen) refreshRemoteInfo();
  }, [remoteOpen, refreshRemoteInfo]);

  useEffect(() => {
    if (!window.api || !window.api.onRemoteCommand) return undefined;

    return window.api.onRemoteCommand((command) => {
      if (!command) return;
      if (command.action === 'toggle') timer.toggle();
      else if (command.action === 'start') timer.start();
      else if (command.action === 'pause') timer.pause();
      else if (command.action === 'reset') timer.reset();
      else if (command.action === 'adjust') timer.adjust(Number(command.seconds) || 0);
    });
  }, [timer.toggle, timer.start, timer.pause, timer.reset, timer.adjust]);

  const scanComposition = useCallback(async (options = {}) => {
    if (!window.api || !window.api.discover) return;
    const silent = Boolean(options && options.silent);
    setScanning(true);
    if (!silent) setScanError('');

    try {
      const result = await window.api.discover(settings);
      if (result.ok) {
        setTargets(result.targets);
        setSelectedTarget((previous) => {
          if (previous) {
            const existing = result.targets.find((target) => target.id === previous.id);
            if (existing) return existing;
          }
          return result.targets[0] || null;
        });
      } else {
        setTargets([]);
        if (!silent) setScanError(result.error || 'Unable to reach Resolume');
      }
    } catch (error) {
      if (!silent) setScanError(error.message);
    } finally {
      setScanning(false);
    }
  }, [settings]);

  useEffect(() => {
    if (didAutoScan.current) return;
    didAutoScan.current = true;
    scanComposition({ silent: true });
  }, [scanComposition]);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!window.api || !window.api.health) return;
      try {
        const result = await window.api.health(settings);
        if (!cancelled) setHealth(result);
      } catch (_error) {
        if (!cancelled) setHealth({ rest: false, osc: null, error: 'health check failed' });
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [settings.host, settings.restPort, settings.oscHost, settings.oscPort]);

  const flashPeriod = 1000 / Math.max(0.5, Number(config.flashHz) * 2);
  const shouldFlash =
    timer.isTimeOut &&
    config.flashEnabled &&
    (config.mode === 'COUNTDOWN' || config.mode === 'COUNTDOWN_THEN_COUNTUP');
  const flashOn = !shouldFlash || Math.floor(timer.elapsedMs / flashPeriod) % 2 === 0;

  const timerText = msToDisplay(timer.displayMs, {
    ceil: config.mode !== 'COUNTUP' && !timer.isOvertime,
    plus: timer.isOvertime
  });
  const timesUpText = config.timesUpMessage || "TIME'S UP";
  const outputText = flashOn ? timerText : timesUpText;

  const activeColor = timer.isTimeOut
    ? config.colorScheme.timeout
    : timer.isWarning
      ? config.colorScheme.warning
      : config.colorScheme.running;

  const phaseLabel = t(`status.${timer.phase === 'ready' ? 'ready' : timer.phase}`);
  const modeLabel = t(`mode.${MODE_KEY[config.mode] || 'countdown'}`);
  const healthLevel = healthLevelFor(health);

  remoteStateRef.current = {
    text: outputText,
    phase: timer.phase,
    phaseLabel,
    modeLabel,
    color: activeColor,
    progress: timer.progress,
    isOvertime: timer.isOvertime,
    status: timer.status
  };

  useEffect(() => {
    if (!window.api || !window.api.remoteUpdateState) return undefined;
    const sendState = () => window.api.remoteUpdateState(remoteStateRef.current);
    sendState();
    const interval = setInterval(sendState, 300);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!settings.enabled || !selectedTarget) return undefined;
    if (!window.api || !window.api.pushText) return undefined;

    let cancelled = false;

    const send = async () => {
      try {
        const result = await window.api.pushText({
          settings,
          target: selectedTarget,
          text: outputText
        });
        if (!cancelled) {
          setLastPush({
            ok: Boolean(result.ok),
            transport: result.transport,
            label: pushLabel(result, t),
            at: Date.now()
          });
        }
      } catch (error) {
        if (!cancelled) {
          setLastPush({
            ok: false,
            label: `${t('resolume.error')} · ${error.message}`,
            at: Date.now()
          });
        }
      }
    };

    send();
    return () => {
      cancelled = true;
    };
  }, [
    outputText,
    settings.enabled,
    settings.sendMode,
    settings.host,
    settings.restPort,
    settings.oscHost,
    settings.oscPort,
    selectedTarget,
    t
  ]);

  useEffect(() => {
    if (!settings.enabled || settings.syncColor === false) return undefined;
    if (!selectedTarget || !selectedTarget.colorParamId) return undefined;
    if (!window.api || !window.api.pushColor) return undefined;

    let cancelled = false;

    const sendColor = async () => {
      try {
        const result = await window.api.pushColor({
          settings,
          target: selectedTarget,
          color: activeColor
        });
        if (!cancelled) {
          setLastPush({
            ok: Boolean(result.ok),
            transport: 'color',
            label: result.ok
              ? `COLOR · ${new Date().toLocaleTimeString()}`
              : `${t('resolume.error')} · ${result.error}`,
            at: Date.now()
          });
        }
      } catch (error) {
        if (!cancelled) {
          setLastPush({ ok: false, label: error.message, at: Date.now() });
        }
      }
    };

    sendColor();
    return () => {
      cancelled = true;
    };
  }, [
    activeColor,
    settings.enabled,
    settings.syncColor,
    settings.host,
    settings.restPort,
    settings.oscHost,
    settings.oscPort,
    settings.sendMode,
    selectedTarget,
    t
  ]);

  useEffect(() => {
    if (!timer.isTimeOut) {
      timeUpTriggeredRef.current = false;
      return;
    }

    if (timer.status !== 'running' && timer.status !== 'finished') return;

    const trigger = settings.timeUpTrigger;
    if (!trigger || !trigger.enabled) return;
    if (timeUpTriggeredRef.current) return;
    if (!window.api || !window.api.triggerResolume) return;

    timeUpTriggeredRef.current = true;
    const startedAt = new Date().toLocaleTimeString();

    window.api.triggerResolume({ settings, trigger }).then((result) => {
      setLastTrigger({
        ok: Boolean(result.ok),
        label: result.ok
          ? `${String(trigger.type || '').toUpperCase()} · ${startedAt}`
          : `${t('resolume.error')} · ${result.error}`
      });
    }).catch((error) => {
      setLastTrigger({ ok: false, label: error.message });
    });
  }, [timer.isTimeOut, timer.status, settings.timeUpTrigger, settings.host, settings.restPort, t]);

  const updateConfig = useCallback((patch) => {
    setConfig((previous) => ({ ...previous, ...patch }));
  }, []);

  const updateColor = useCallback((key, value) => {
    setConfig((previous) => ({
      ...previous,
      colorScheme: { ...previous.colorScheme, [key]: value }
    }));
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      if (patch && patch.timeUpTrigger) {
        next.timeUpTrigger = { ...previous.timeUpTrigger, ...patch.timeUpTrigger };
      }
      return next;
    });
  }, []);

  const applyManualTime = useCallback(
    (seconds) => {
      if (config.mode !== 'COUNTUP' && config.durationSeconds <= 0) {
        setConfig((previous) => ({ ...previous, durationSeconds: seconds }));
        timer.reset();
        return;
      }
      timer.setCurrentSeconds(seconds);
    },
    [config.mode, config.durationSeconds, timer]
  );

  const testSend = useCallback(async () => {
    if (!selectedTarget || !window.api || !window.api.pushText) return;
    try {
      const result = await window.api.pushText({
        settings,
        target: selectedTarget,
        text: t('resolume.testText')
      });
      setLastPush({
        ok: Boolean(result.ok),
        transport: result.transport,
        label: pushLabel(result, t),
        at: Date.now()
      });
    } catch (error) {
      setLastPush({ ok: false, label: error.message, at: Date.now() });
    }
  }, [selectedTarget, settings, t]);

  const savePreset = useCallback((name) => {
    const preset = normalizePreset({
      ...config,
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name
    });
    setPresets((previous) => [preset, ...previous]);
  }, [config]);

  const loadPreset = useCallback((preset) => {
    const normalized = normalizePreset(preset);
    if (!normalized) return;
    const { id, name, ...presetConfig } = normalized;
    setConfig((previous) => ({ ...previous, ...presetConfig }));
    timer.reset();
  }, [timer]);

  const updatePreset = useCallback((preset) => {
    const normalized = normalizePreset({ ...config, id: preset.id, name: preset.name });
    setPresets((previous) =>
      previous.map((item) => (item.id === preset.id ? normalized : item))
    );
  }, [config]);

  const deletePreset = useCallback((id) => {
    setPresets((previous) => previous.filter((preset) => preset.id !== id));
  }, []);

  const exportPresets = useCallback(() => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'resolume-timer-presets.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [presets]);

  const importPresets = useCallback(async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.presets)
          ? parsed.presets
          : [parsed];

      const normalized = incoming.map(normalizePreset).filter(Boolean);
      if (normalized.length === 0) throw new Error('empty preset file');

      setPresets((previous) => {
        const existing = new Set(previous.map((preset) => preset.id));
        const fresh = normalized.map((preset) =>
          existing.has(preset.id)
            ? { ...preset, id: `${preset.id}_${Math.random().toString(36).slice(2, 6)}` }
            : preset
        );
        return [...fresh, ...previous];
      });
      setPresetImportError(false);
    } catch (_error) {
      setPresetImportError(true);
    }
  }, []);

  const stats = [
    { label: t('timer.elapsed'), value: formatDuration(timer.elapsedMs / 1000) },
    { label: t('timer.remaining'), value: formatDuration(timer.remainingMs / 1000) }
  ];
  if (timer.isOvertime) {
    stats.push({ label: t('timer.overtime'), value: formatDuration(timer.overtimeMs / 1000), overtime: true });
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand__mark">RT</div>
          <div>
            <h1>{t('app.title')}</h1>
            <p>{t('app.subtitle')}</p>
          </div>
        </div>

        <div className="header-actions">
          <span className={`health-pill health-pill--${healthLevel}`}>
            <span className={`status-dot status-dot--${healthLevel}`} />
            {healthLevel === 'checking' ? t('status.checking') : t(`health.${healthLevel}`)}
          </span>

          <label className="language-select">
            <span className="sr-only">{t('lang.label')}</span>
            <select value={language} onChange={(event) => changeLanguage(event.target.value)}>
              <option value="en">{t('lang.en')}</option>
              <option value="id">{t('lang.id')}</option>
            </select>
          </label>

          <button type="button" className="button" onClick={() => setRemoteOpen(true)}>
            {t('remote.button')}
          </button>
          <button type="button" className="button button--accent" onClick={() => setDonateOpen(true)}>
            {t('donate.button')}
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="layout__left">
          <TimerDisplay
            text={outputText}
            color={activeColor}
            phase={timer.phase}
            phaseLabel={phaseLabel}
            modeLabel={modeLabel}
            progress={timer.progress}
            isOvertime={timer.isOvertime || (!flashOn && shouldFlash)}
          />

          <section className="stat-strip">
            {stats.map((stat) => (
              <div key={stat.label} className={`stat ${stat.overtime ? 'stat--overtime' : ''}`}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
            <div className="stat stat--speed">
              <span>{t('timer.speed')}</span>
              <strong>{config.speedMultiplier}x</strong>
            </div>
          </section>

          <section className="panel output-panel">
            <div className="panel__header">
              <h2>{t('app.outputPreview')}</h2>
              <span className="muted">
                {settings.enabled
                  ? selectedTarget
                    ? selectedTarget.scope
                    : t('resolume.selectTarget')
                  : t('resolume.enabled')}
              </span>
            </div>
            <div className="output-box">{outputText}</div>
          </section>

          <PresetManager
            presets={presets}
            onSave={savePreset}
            onLoad={loadPreset}
            onUpdate={updatePreset}
            onDelete={deletePreset}
            onExport={exportPresets}
            onImport={importPresets}
            importError={presetImportError}
            t={t}
          />
        </div>

        <div className="layout__right">
          <TimeControls
            config={config}
            onChange={updateConfig}
            onColorChange={updateColor}
            timer={timer}
            onManualApply={applyManualTime}
            t={t}
          />

          <OscSettings
            settings={settings}
            targets={targets}
            selectedTarget={selectedTarget}
            scanning={scanning}
            health={health}
            lastPush={lastPush}
            lastTrigger={lastTrigger}
            error={scanError}
            onSettingsChange={updateSettings}
            onScan={scanComposition}
            onSelectTarget={(id) => {
              const target = targets.find((item) => item.id === id) || null;
              setSelectedTarget(target);
            }}
            onTest={testSend}
            t={t}
          />
        </div>
      </main>

      <footer className="app-footer">
        <span>{t('footer.note')}</span>
        {version ? <span>{t('app.version', { version })}</span> : null}
      </footer>

      <QrisDonateModal open={donateOpen} onClose={() => setDonateOpen(false)} t={t} />
      <RemoteAccessModal
        open={remoteOpen}
        onClose={() => setRemoteOpen(false)}
        info={remoteInfo}
        t={t}
      />
    </div>
  );
}
