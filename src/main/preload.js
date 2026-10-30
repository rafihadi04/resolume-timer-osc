const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  discover: (settings) => ipcRenderer.invoke('resolume:discover', settings),
  health: (settings) => ipcRenderer.invoke('resolume:health', settings),
  pushText: (payload) => ipcRenderer.invoke('resolume:pushText', payload),
  pushColor: (payload) => ipcRenderer.invoke('resolume:pushColor', payload),
  triggerResolume: (payload) => ipcRenderer.invoke('resolume:trigger', payload),
  remoteInfo: () => ipcRenderer.invoke('remote:info'),
  remoteUpdateState: (state) => ipcRenderer.send('remote:updateState', state),
  onRemoteCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('remote:command', listener);
    return () => ipcRenderer.removeListener('remote:command', listener);
  },
  ndiStatus: () => ipcRenderer.invoke('ndi:status'),
  ndiStart: (options) => ipcRenderer.invoke('ndi:start', options),
  ndiStop: () => ipcRenderer.invoke('ndi:stop'),
  setTimerRunning: (running) => ipcRenderer.send('app:setTimerRunning', running),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  version: () => ipcRenderer.invoke('app:version')
});
