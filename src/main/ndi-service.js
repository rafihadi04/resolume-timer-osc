let grandiose = null;
let loadError = null;

try {
  grandiose = require('@stagetimerio/grandiose');
} catch (err) {
  loadError = err.message;
}

const { BrowserWindow } = require('electron');

let sender = null;
let offscreenWindow = null;
let isStreaming = false;
let currentConfig = {
  name: 'Resolume Arena Timer',
  width: 1920,
  height: 1080,
  fps: 30,
  transparent: true,
  notes: true
};

function isAvailable () {
  return Boolean(grandiose && typeof grandiose.send === 'function');
}

function getStatus () {
  let connections = 0;
  let sourceName = currentConfig.name;

  if (sender && typeof sender.connections === 'function') {
    try {
      connections = sender.connections();
    } catch (_err) {}
  }
  if (sender && typeof sender.sourcename === 'function') {
    try {
      sourceName = sender.sourcename();
    } catch (_err) {}
  }

  return {
    available: isAvailable(),
    active: isStreaming,
    sourceName,
    width: currentConfig.width,
    height: currentConfig.height,
    fps: currentConfig.fps,
    connections,
    error: loadError
  };
}

async function start (options = {}) {
  if (!isAvailable()) {
    return { ok: false, error: loadError || 'NDI is not available on this system' };
  }

  if (isStreaming) {
    return { ok: true, status: getStatus() };
  }

  currentConfig = {
    ...currentConfig,
    ...options
  };

  try {
    sender = await grandiose.send({
      name: currentConfig.name || 'Resolume Arena Timer',
      clockVideo: true
    });

    const port = options.port || 8080;
    const url = new URL(`http://127.0.0.1:${port}/output`);
    if (currentConfig.transparent) url.searchParams.set('transparent', '1');
    if (!currentConfig.notes) url.searchParams.set('notes', 'hide');

    offscreenWindow = new BrowserWindow({
      width: currentConfig.width || 1920,
      height: currentConfig.height || 1080,
      show: false,
      frame: false,
      transparent: true,
      webPreferences: {
        offscreen: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    });

    offscreenWindow.webContents.setFrameRate(currentConfig.fps || 30);

    let sendingFrame = false;

    offscreenWindow.webContents.on('paint', (_event, _dirty, image) => {
      if (!sender || !isStreaming || sendingFrame) return;

      const size = image.getSize();
      if (size.width === 0 || size.height === 0) return;

      const bitmap = image.getBitmap();
      sendingFrame = true;

      sender.video({
        xres: size.width,
        yres: size.height,
        frameRateN: (currentConfig.fps || 30) * 1000,
        frameRateD: 1000,
        fourCC: grandiose.FOURCC_BGRA,
        pictureAspectRatio: size.width / size.height,
        frameFormatType: grandiose.FORMAT_TYPE_PROGRESSIVE,
        lineStrideBytes: size.width * 4,
        data: bitmap
      }).catch((_err) => {
        // frame drop handled silently
      }).finally(() => {
        sendingFrame = false;
      });
    });

    await offscreenWindow.loadURL(url.toString());
    isStreaming = true;

    return { ok: true, status: getStatus() };
  } catch (err) {
    await stop();
    return { ok: false, error: err.message };
  }
}

async function stop () {
  isStreaming = false;

  if (offscreenWindow && !offscreenWindow.isDestroyed()) {
    try {
      offscreenWindow.destroy();
    } catch (_err) {}
  }
  offscreenWindow = null;

  if (sender) {
    try {
      if (typeof sender.destroy === 'function') {
        await sender.destroy();
      }
    } catch (_err) {}
  }
  sender = null;

  return { ok: true, status: getStatus() };
}

module.exports = {
  isAvailable,
  getStatus,
  start,
  stop
};

