const { app, BrowserWindow, ipcMain, shell, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const oscClient = require('./osc-client');
const restClient = require('./rest-client');
const ndiService = require('./ndi-service');

// Prevent background throttling & sleep when app is minimized or unfocused
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const isDev = !app.isPackaged;
let mainWindow = null;
let remoteServer = null;
let remotePort = null;
let remoteState = null;
let remoteHtmlCache = null;
let outputHtmlCache = null;
let remoteReadyResolve = null;
let powerSaveBlockerId = null;
const remoteReady = new Promise((resolve) => {
  remoteReadyResolve = resolve;
});

function lanAddresses () {
  const found = [];

  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets || []) {
      if (net.family !== 'IPv4' || net.internal || net.address === '0.0.0.0') continue;
      found.push(net.address);
    }
  }

  const score = (ip) => {
    if (ip.startsWith('192.168.')) return 0;
    if (ip.startsWith('10.')) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
    if (ip.startsWith('169.254.')) return 9;
    return 3;
  };

  return [...new Set(found)].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

function getRemoteInfo () {
  const addresses = lanAddresses();
  const host = addresses[0] || '127.0.0.1';
  const urls = remotePort ? addresses.map((address) => `http://${address}:${remotePort}/`) : [];
  const outputUrls = remotePort ? addresses.map((address) => `http://${address}:${remotePort}/output`) : [];

  return {
    ready: Boolean(remotePort),
    port: remotePort,
    host,
    url: remotePort ? `http://${host}:${remotePort}/` : null,
    outputUrl: remotePort ? `http://${host}:${remotePort}/output` : null,
    urls,
    outputUrls
  };
}

function getRemoteHtml () {
  if (!remoteHtmlCache) {
    remoteHtmlCache = fs.readFileSync(path.join(__dirname, 'remote.html'), 'utf8');
  }
  return remoteHtmlCache;
}

function getOutputHtml () {
  if (!outputHtmlCache) {
    outputHtmlCache = fs.readFileSync(path.join(__dirname, 'output.html'), 'utf8');
  }
  return outputHtmlCache;
}

function startRemoteServer () {
  if (remoteServer) return;

  remoteServer = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getRemoteHtml());
      return;
    }

    if (
      req.method === 'GET' &&
      (requestUrl.pathname === '/output' ||
        requestUrl.pathname === '/output.html' ||
        requestUrl.pathname === '/timer' ||
        requestUrl.pathname === '/stage' ||
        requestUrl.pathname === '/view')
    ) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getOutputHtml());
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/state') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify(remoteState || {
        text: '00:00:00',
        notes: '',
        speed: 1,
        phase: 'ready',
        phaseLabel: 'Ready',
        modeLabel: '',
        color: '#00ff66',
        progress: 0,
        isOvertime: false,
        status: 'idle',
        updatedAt: 0
      }));
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/command') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 8192) req.destroy();
      });
      req.on('end', () => {
        let command;
        try {
          command = JSON.parse(body || '{}');
        } catch (_error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid json' }));
          return;
        }

        const allowed = ['toggle', 'start', 'pause', 'reset', 'adjust', 'setSpeed', 'setNotes'];
        if (!allowed.includes(command.action)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid action' }));
          return;
        }

        if (command.action === 'adjust') {
          const seconds = Number(command.seconds);
          if (!Number.isFinite(seconds) || seconds < -3600 || seconds > 3600) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid seconds' }));
            return;
          }
          command.seconds = seconds;
        }

        if (command.action === 'setSpeed') {
          const speed = Number(command.speed);
          if (!Number.isFinite(speed) || speed <= 0 || speed > 20) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid speed' }));
            return;
          }
          command.speed = speed;
        }

        if (command.action === 'setNotes') {
          command.notes = String(command.notes !== undefined ? command.notes : '');
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('remote:command', command);
        }

        res.writeHead(204);
        res.end();
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  remoteServer.on('error', (error) => {
    console.error('[remote] server error', error);
    remoteReadyResolve();
  });

  remoteServer.listen(0, '0.0.0.0', () => {
    remotePort = remoteServer.address().port;
    console.log('[remote] listening on', remotePort);
    remoteReadyResolve();
  });
}

function toResolumeColor (value) {
  const hex = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex}ff`;
  if (/^[0-9a-f]{8}$/i.test(hex)) return `#${hex}`;
  return null;
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0b0f14',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('[renderer] failed to load', code, description, url);
  });

  mainWindow.webContents.on('console-message', (_event, _level, message) => {
    console.log('[renderer]', message);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173');
  } else {
    const indexPath = path.join(__dirname, '..', '..', 'dist-renderer', 'index.html');
    console.log('[main] loading renderer from', indexPath);
    mainWindow.loadFile(indexPath);
  }
}

function registerIpc () {
  ipcMain.handle('resolume:discover', async (_event, settings) => {
    return restClient.discover(settings || {});
  });

  ipcMain.handle('resolume:health', async (_event, settings) => {
    const result = await restClient.health(settings || {});
    return { ...result, osc: oscClient.getStatus(settings || {}) };
  });

  ipcMain.handle('resolume:pushText', async (_event, payload = {}) => {
    const { settings = {}, target, text } = payload;

    if (!target) {
      return { ok: false, error: 'No Resolume target selected' };
    }

    const mode = settings.sendMode || 'auto';
    const shouldUseRest = mode === 'auto' || mode === 'rest';
    const shouldUseOsc = mode === 'auto' || mode === 'osc';
    let restResult = null;
    let oscResult = null;

    if (shouldUseRest && target.paramId) {
      try {
        await restClient.setParamValue(settings, target.paramId, text);
        restResult = { ok: true };
      } catch (error) {
        restResult = { ok: false, error: error.message };
      }
    }

    if (mode === 'rest' || (mode === 'auto' && restResult && restResult.ok)) {
      if (restResult && restResult.ok) {
        return { ok: true, transport: 'rest', rest: restResult };
      }
      return {
        ok: false,
        error: restResult ? restResult.error : 'REST target has no parameter id',
        rest: restResult
      };
    }

    if (shouldUseOsc) {
      const addresses = Array.isArray(target.oscPaths) && target.oscPaths.length > 0
        ? target.oscPaths
        : target.oscPath;

      try {
        await oscClient.send(settings, addresses, text);
        oscResult = { ok: true };
      } catch (error) {
        oscResult = { ok: false, error: error.message };
      }
    }

    if ((restResult && restResult.ok) || (oscResult && oscResult.ok)) {
      return {
        ok: true,
        transport: restResult && restResult.ok ? 'rest' : 'osc',
        rest: restResult,
        osc: oscResult
      };
    }

    return {
      ok: false,
      error:
        (restResult && restResult.error) ||
        (oscResult && oscResult.error) ||
        'No transport available',
      rest: restResult,
      osc: oscResult
    };
  });

  ipcMain.handle('resolume:pushColor', async (_event, payload = {}) => {
    const { settings = {}, target, color } = payload;

    if (!target || !target.colorParamId) {
      return { ok: false, error: 'Target has no Resolume color parameter' };
    }

    const rgba = toResolumeColor(color);
    if (!rgba) {
      return { ok: false, error: 'Invalid color value' };
    }

    try {
      await restClient.setParamValue(settings, target.colorParamId, rgba);
      return { ok: true, color: rgba, paramId: target.colorParamId };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('resolume:trigger', async (_event, payload = {}) => {
    const { settings = {}, trigger } = payload;
    const type = trigger && trigger.type;
    const layer = Math.max(1, Number(trigger && trigger.layer) || 1);
    const column = Math.max(1, Number(trigger && trigger.column) || 1);
    const group = Math.max(1, Number(trigger && trigger.group) || 1);

    let apiPath = null;
    if (type === 'clip') {
      apiPath = `/api/v1/composition/layers/${layer}/clips/${column}/connect`;
    } else if (type === 'column') {
      apiPath = `/api/v1/composition/columns/${column}/connect`;
    } else if (type === 'group') {
      apiPath = `/api/v1/composition/layergroups/${group}/columns/${column}/connect`;
    } else {
      return { ok: false, error: 'No time-up trigger configured' };
    }

    try {
      await restClient.trigger(settings, apiPath);
      return { ok: true, path: apiPath };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('remote:info', async () => {
    await remoteReady;
    return getRemoteInfo();
  });

  ipcMain.on('remote:updateState', (_event, state) => {
    remoteState = { ...(state || {}), updatedAt: Date.now() };
  });

  ipcMain.on('app:setTimerRunning', (_event, running) => {
    if (running) {
      if (powerSaveBlockerId === null || !powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
      }
    } else {
      if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlocker.stop(powerSaveBlockerId);
        powerSaveBlockerId = null;
      }
    }
  });

  ipcMain.handle('ndi:status', async () => {
    return ndiService.getStatus();
  });

  ipcMain.handle('ndi:start', async (_event, options = {}) => {
    return ndiService.start({ ...options, port: remotePort });
  });

  ipcMain.handle('ndi:stop', async () => {
    return ndiService.stop();
  });

  ipcMain.handle('app:openExternal', async (_event, url) => {
    if (/^https?:\/\//i.test(String(url))) {
      await shell.openExternal(String(url));
      return true;
    }
    return false;
  });

  ipcMain.handle('app:version', () => app.getVersion());
}

app.whenReady().then(() => {
  registerIpc();
  startRemoteServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  oscClient.close();
  ndiService.stop().catch(() => {});
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }
  if (remoteServer) {
    try {
      remoteServer.close();
    } catch (_error) {
      // ignore close errors
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
