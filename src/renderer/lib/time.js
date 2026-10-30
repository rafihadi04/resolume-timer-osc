export function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function pad2 (value) {
  return String(Math.trunc(Math.abs(value))).padStart(2, '0');
}

export function formatDuration (totalSeconds, options = {}) {
  const { plus = false } = options;
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${plus ? '+' : ''}${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function msToDisplay (ms, options = {}) {
  const { ceil = false, plus = false } = options;
  const safe = Math.max(0, Number(ms) || 0);
  const totalSeconds = ceil ? Math.ceil(safe / 1000) : Math.floor(safe / 1000);
  return formatDuration(totalSeconds, { plus });
}

export function parseTimeInput (input) {
  if (input === undefined || input === null) return NaN;
  const cleaned = String(input).trim().replace(/^\+/, '');
  if (!cleaned) return NaN;

  if (/^\d+(?:\.\d+)?$/.test(cleaned)) {
    return Number(cleaned);
  }

  const parts = cleaned.split(':');
  if (parts.length > 3 || parts.some((part) => part !== '' && !/^\d+(?:\.\d+)?$/.test(part))) {
    return NaN;
  }

  const numbers = parts.map((part) => (part === '' ? 0 : Number(part)));
  while (numbers.length < 3) numbers.unshift(0);
  const [hours, minutes, seconds] = numbers;
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatProgress (value) {
  return `${clamp(value, 0, 1) * 100}%`;
}
