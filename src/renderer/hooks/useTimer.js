import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '../lib/time';

export function useTimer(config, onDurationChange) {
  const [status, setStatus] = useState('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [realElapsedMs, setRealElapsedMs] = useState(0);

  const statusRef = useRef(status);
  const modeRef = useRef(config.mode);
  const durationRef = useRef(Math.max(0, Number(config.durationSeconds) || 0) * 1000);
  const speedRef = useRef(Number(config.speedMultiplier) || 1);
  const lastTickRef = useRef(performance.now());
  const onDurationChangeRef = useRef(onDurationChange);

  useEffect(() => {
    onDurationChangeRef.current = onDurationChange;
  }, [onDurationChange]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    modeRef.current = config.mode;
  }, [config.mode]);

  useEffect(() => {
    durationRef.current = Math.max(0, Number(config.durationSeconds) || 0) * 1000;
  }, [config.durationSeconds]);

  useEffect(() => {
    speedRef.current = Number(config.speedMultiplier) || 1;
  }, [config.speedMultiplier]);

  useEffect(() => {
    if (status !== 'running') return undefined;

    lastTickRef.current = performance.now();
    let frameId = null;

    const tick = () => {
      const now = performance.now();
      const delta = Math.max(0, now - lastTickRef.current);
      if (delta > 0) {
        lastTickRef.current = now;
        setElapsedMs((previous) => previous + delta * speedRef.current);
        setRealElapsedMs((previous) => previous + delta);
      }
    };

    // Smooth 60fps frame loop when window is foreground / visible
    const loop = () => {
      tick();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    // Reliable background interval timer (fires even when window is minimized or compositor is paused)
    const intervalId = setInterval(tick, 50);

    // Instant resync on tab/window visibility restore
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [status]);

  const durationMs = Math.max(0, Number(config.durationSeconds) || 0) * 1000;
  const mode = config.mode || 'COUNTDOWN';

  useEffect(() => {
    if (status !== 'running') return;
    const shouldFinish =
      (mode === 'COUNTDOWN' || mode === 'COUNTUP') &&
      durationMs > 0 &&
      elapsedMs >= durationMs;

    if (shouldFinish) {
      setElapsedMs(durationMs);
      setStatus('finished');
    }
  }, [elapsedMs, durationMs, mode, status]);

  const remainingRawMs = durationMs - elapsedMs;
  let displayMs = elapsedMs;
  let isOvertime = false;
  let isTimeOut = false;

  if (mode === 'COUNTUP') {
    isTimeOut = durationMs > 0 && elapsedMs >= durationMs;
  } else if (remainingRawMs >= 0) {
    displayMs = remainingRawMs;
    isTimeOut = durationMs > 0 && remainingRawMs <= 0;
  } else if (mode === 'COUNTDOWN_THEN_COUNTUP') {
    isOvertime = true;
    isTimeOut = true;
    displayMs = Math.abs(remainingRawMs);
  } else {
    displayMs = 0;
    isTimeOut = true;
  }

  const warningThresholdMs = Math.max(0, Number(config.warningThresholdSeconds) || 0) * 1000;
  const isWarning =
    !isTimeOut &&
    mode !== 'COUNTUP' &&
    warningThresholdMs > 0 &&
    remainingRawMs > 0 &&
    remainingRawMs <= warningThresholdMs;

  const progress = durationMs > 0 ? clamp(elapsedMs / durationMs, 0, 1) : 0;

  const start = useCallback(() => {
    if (statusRef.current === 'finished') {
      setElapsedMs(0);
      setRealElapsedMs(0);
    }
    setStatus('running');
  }, []);

  const pause = useCallback(() => {
    if (statusRef.current === 'running') {
      setStatus('paused');
    }
  }, []);

  const toggle = useCallback(() => {
    if (statusRef.current === 'running') {
      pause();
    } else {
      start();
    }
  }, [pause, start]);

  const reset = useCallback(() => {
    setStatus('idle');
    setElapsedMs(0);
    setRealElapsedMs(0);
  }, []);

  const adjust = useCallback((deltaSeconds) => {
    const deltaMs = Number(deltaSeconds) * 1000;
    if (!Number.isFinite(deltaMs) || deltaMs === 0) return;

    if (statusRef.current === 'idle') {
      const currentDurationSec = Math.round(durationRef.current / 1000);
      const newDurationSec = Math.max(1, currentDurationSec + Number(deltaSeconds));
      if (typeof onDurationChangeRef.current === 'function') {
        onDurationChangeRef.current(newDurationSec);
      }
      setElapsedMs(0);
      return;
    }

    if (modeRef.current === 'COUNTUP') {
      setElapsedMs((previous) => Math.max(0, previous + deltaMs));
    } else {
      setElapsedMs((previous) => {
        const next = previous - deltaMs;
        if (next < 0) {
          const excessMs = -next;
          const currentDurationSec = Math.round(durationRef.current / 1000);
          const addSec = Math.ceil(excessMs / 1000);
          if (typeof onDurationChangeRef.current === 'function') {
            onDurationChangeRef.current(currentDurationSec + addSec);
          }
          return 0;
        }

        if (modeRef.current === 'COUNTDOWN') {
          return clamp(next, 0, durationRef.current);
        }
        return next;
      });
    }

    if (statusRef.current === 'finished') {
      setStatus('paused');
    }
  }, []);

  const setCurrentSeconds = useCallback((seconds) => {
    const valueMs = Math.max(0, Number(seconds) || 0) * 1000;

    if (modeRef.current === 'COUNTUP') {
      setElapsedMs(valueMs);
    } else {
      const next = durationRef.current - valueMs;
      setElapsedMs(
        modeRef.current === 'COUNTDOWN'
          ? clamp(next, 0, durationRef.current)
          : Math.max(0, next)
      );
    }

    if (statusRef.current === 'finished') {
      setStatus('paused');
    }
  }, []);

  const phase =
    status === 'idle'
      ? isTimeOut
        ? isOvertime
          ? 'overtime'
          : 'finished'
        : 'ready'
      : status === 'paused'
        ? 'paused'
        : status === 'finished'
          ? 'finished'
          : isOvertime
            ? 'overtime'
            : isWarning
              ? 'warning'
              : 'running';

  const speed = Number(config.speedMultiplier) > 0 ? Number(config.speedMultiplier) : 1;
  const remainingMs = Math.max(0, remainingRawMs);
  const realRemainingMs = Math.max(0, Math.round(remainingMs / speed));

  return {
    status,
    phase,
    elapsedMs,
    realElapsedMs,
    displayMs,
    remainingMs,
    realRemainingMs,
    overtimeMs: isOvertime ? Math.abs(remainingRawMs) : 0,
    progress,
    isOvertime,
    isTimeOut,
    isWarning,
    start,
    pause,
    toggle,
    reset,
    adjust,
    setCurrentSeconds
  };
}
