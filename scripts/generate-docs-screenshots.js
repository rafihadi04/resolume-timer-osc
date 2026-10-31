const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outputDir = path.join(__dirname, '..', 'docs', 'images');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Use natural resolution for desktop layout
// app.commandLine.appendSwitch('force-device-scale-factor', '2');

async function wait (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  console.log('[capture] Starting screenshot generator...');

  const mockPreloadPath = path.join(__dirname, 'mock-preload.js');
  fs.writeFileSync(mockPreloadPath, `
    const { contextBridge } = require('electron');

    const mockTargets = [
      {
        id: 'layer3_clip4_source',
        name: 'Text Block (Layer 3, Clip 4)',
        type: 'source',
        layer: 3,
        clip: 4,
        paramId: 1793278954342,
        colorParamId: 1793347371940
      },
      {
        id: 'layer1_clip2_source',
        name: 'Stage Notes (Layer 1, Clip 2)',
        type: 'source',
        layer: 1,
        clip: 2,
        paramId: 1793278999999
      },
      {
        id: 'layer2_effect1_effect',
        name: 'Text Block Effect (Layer 2)',
        type: 'effect',
        layer: 2,
        clip: 0,
        paramId: 1793278988888
      }
    ];

    contextBridge.exposeInMainWorld('api', {
      discover: async () => ({
        ok: true,
        composition: 'Arena Main Show 2026',
        targets: mockTargets
      }),
      health: async () => ({
        ok: true,
        composition: 'Arena Main Show 2026',
        host: '127.0.0.1',
        port: 8080,
        osc: { ok: true, host: '127.0.0.1', port: 7000 }
      }),
      pushText: async () => ({ ok: true, transport: 'rest' }),
      pushColor: async () => ({ ok: true }),
      triggerResolume: async () => ({ ok: true }),
      remoteInfo: async () => ({
        ready: true,
        port: 54321,
        host: '192.168.1.100',
        url: 'http://192.168.1.100:54321/',
        outputUrl: 'http://192.168.1.100:54321/output',
        urls: ['http://192.168.1.100:54321/'],
        outputUrls: ['http://192.168.1.100:54321/output']
      }),
      remoteUpdateState: () => {},
      onRemoteCommand: () => () => {},
      ndiStatus: async () => ({
        available: true,
        active: true,
        sourceName: 'Resolume Arena Timer',
        width: 1920,
        height: 1080,
        fps: 30,
        connections: 2,
        error: null
      }),
      ndiStart: async () => ({ ok: true }),
      ndiStop: async () => ({ ok: true }),
      setTimerRunning: () => {},
      openExternal: async () => true,
      version: async () => '1.0.0'
    });
  `);

  // 1. Capture Main App Window (1400 x 960)
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 980,
    show: false,
    webPreferences: {
      preload: mockPreloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const indexPath = path.join(__dirname, '..', 'dist-renderer', 'index.html');
  await mainWindow.loadFile(indexPath);

  // Set mock initial state in localStorage and reload
  await mainWindow.webContents.executeJavaScript(`
    window.localStorage.setItem('rt.config', JSON.stringify({
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
      flashHz: 2,
      notes: 'Keynote Speaker: Welcome & Project Vision',
      notesMode: 'separate',
      notesTargetId: 'layer1_clip2_source'
    }));

    window.localStorage.setItem('rt.settings', JSON.stringify({
      host: '127.0.0.1',
      restPort: 8080,
      oscHost: '127.0.0.1',
      oscPort: 7000,
      sendMode: 'auto',
      enabled: true,
      syncColor: true,
      targetId: 'layer3_clip4_source',
      ndi: {
        enabled: true,
        name: 'Resolume Arena Timer',
        fps: 30,
        transparent: true,
        includeNotes: true
      }
    }));
  `);

  // Reload to pick up local storage
  await mainWindow.loadFile(indexPath);
  await wait(1200);

  // Trigger scan composition to populate targets
  await mainWindow.webContents.executeJavaScript(`
    const scanBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Scan'));
    if (scanBtn) scanBtn.click();
  `);
  await wait(800);

  // Start the timer to show active running state
  await mainWindow.webContents.executeJavaScript(`
    const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start') || b.textContent.includes('Resume'));
    if (startBtn) startBtn.click();
  `);
  await wait(800);

  // Capture Full Main App Dashboard
  const mainImage = await mainWindow.capturePage();
  fs.writeFileSync(path.join(outputDir, '01-full-dashboard.png'), mainImage.toPNG());
  console.log('[capture] Saved 01-full-dashboard.png');

  // Capture Focused Resolume Output Panel
  const panelRect = await mainWindow.webContents.executeJavaScript(`
    const panel = document.querySelector('.resolume-panel');
    if (panel) {
      panel.scrollIntoView({ block: 'start' });
      const rect = panel.getBoundingClientRect();
      ({ x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.ceil(rect.width), height: Math.ceil(rect.height) });
    } else {
      null;
    }
  `);

  if (panelRect) {
    await wait(400);
    const panelImage = await mainWindow.capturePage(panelRect);
    fs.writeFileSync(path.join(outputDir, '02-resolume-ndi-panel.png'), panelImage.toPNG());
    console.log('[capture] Saved 02-resolume-ndi-panel.png');
  }

  // Scroll back to top
  await mainWindow.webContents.executeJavaScript(`window.scrollTo(0, 0);`);
  await wait(200);

  // Open Remote Access Modal
  await mainWindow.webContents.executeJavaScript(`
    const remoteBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Remote'));
    if (remoteBtn) remoteBtn.click();
  `);
  await wait(600);

  const modalImage = await mainWindow.capturePage();
  fs.writeFileSync(path.join(outputDir, '03-remote-access-modal.png'), modalImage.toPNG());
  console.log('[capture] Saved 03-remote-access-modal.png');

  // Switch to Web Output tab inside modal
  await mainWindow.webContents.executeJavaScript(`
    const tabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Web Timer Display') || b.textContent.includes('Stage / OBS'));
    if (tabBtn) tabBtn.click();
  `);
  await wait(500);

  const webTabImage = await mainWindow.capturePage();
  fs.writeFileSync(path.join(outputDir, '03b-remote-modal-web-output.png'), webTabImage.toPNG());
  console.log('[capture] Saved 03b-remote-modal-web-output.png');

  // Close modal
  await mainWindow.webContents.executeJavaScript(`
    const closeBtn = document.querySelector('.modal-close') || Array.from(document.querySelectorAll('button')).find(b => b.textContent === '✕' || b.textContent.includes('Close'));
    if (closeBtn) closeBtn.click();
  `);
  await wait(400);

  mainWindow.close();

  // Capture Web Confidence Monitor (output.html)
  const outputWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const outputHtmlPath = path.join(__dirname, '..', 'src', 'main', 'output.html');
  await outputWindow.loadFile(outputHtmlPath);

  // Inject sample state into output.html
  await outputWindow.webContents.executeJavaScript(`
    document.getElementById('timerText').textContent = '00:09:45';
    document.getElementById('timerText').style.color = '#00ff66';
    document.getElementById('phaseBadge').textContent = 'RUNNING';
    document.getElementById('modeLabel').textContent = '15 MIN COUNTDOWN';
    document.getElementById('progressBar').style.width = '65%';
    document.getElementById('progressBar').style.backgroundColor = '#00ff66';
    document.getElementById('notesContent').textContent = 'Keynote Speaker: Welcome & Project Vision\\nNext Speaker: Architecture Deep Dive (10:15 AM)';
    document.getElementById('notesCard').style.display = 'block';
    document.getElementById('statusDot').className = 'status-dot connected';
  `);
  await wait(500);

  const webOutputImage = await outputWindow.capturePage();
  fs.writeFileSync(path.join(outputDir, '04-web-confidence-monitor.png'), webOutputImage.toPNG());
  console.log('[capture] Saved 04-web-confidence-monitor.png');

  outputWindow.close();

  // Capture Phone Remote View (remote.html)
  const phoneWindow = new BrowserWindow({
    width: 440,
    height: 980,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const remoteHtmlPath = path.join(__dirname, '..', 'src', 'main', 'remote.html');
  await phoneWindow.loadFile(remoteHtmlPath);

  // Inject sample state into remote.html
  await phoneWindow.webContents.executeJavaScript(`
    document.getElementById('timer').textContent = '00:09:45';
    document.getElementById('timer').style.color = '#00ff66';
    document.getElementById('phase').textContent = 'RUNNING';
    document.getElementById('mode').textContent = 'COUNTDOWN';
    document.getElementById('progress').style.width = '65%';
    document.getElementById('progress').style.backgroundColor = '#00ff66';
    document.getElementById('notesInput').value = 'Keynote Speaker: Welcome & Project Vision\\nWrap up in 2 mins.';
    document.getElementById('connection').textContent = 'Connected';
    document.getElementById('connection').className = 'connection connected';
  `);
  await wait(500);

  const phoneImage = await phoneWindow.capturePage();
  fs.writeFileSync(path.join(outputDir, '05-phone-remote.png'), phoneImage.toPNG());
  console.log('[capture] Saved 05-phone-remote.png');

  phoneWindow.close();

  // Cleanup mock preload
  if (fs.existsSync(mockPreloadPath)) {
    fs.unlinkSync(mockPreloadPath);
  }

  console.log('[capture] All screenshots generated successfully!');
  app.quit();
});
