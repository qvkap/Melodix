import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('melodix', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Music
  searchMusic: (query: string) => ipcRenderer.invoke('search-music', query),
  searchAlbums: (query: string) => ipcRenderer.invoke('search-albums', query),
  getAlbumTracks: (albumIdOrUrl: string) => ipcRenderer.invoke('get-album-tracks', albumIdOrUrl),
  getStreamUrl: (videoIdOrUrl: string, fallbackQuery?: string) =>
    ipcRenderer.invoke('get-stream-url', videoIdOrUrl, fallbackQuery),

  // Lyrics
  fetchLyrics: (opts: { title: string; artist: string; duration?: number }) =>
    ipcRenderer.invoke('fetch-lyrics', opts),

  // Store
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: any) => ipcRenderer.invoke('store-set', key, value),

  // System Username
  getUsername: async () => {
    try {
      const name = await ipcRenderer.invoke('get-username')
      return name || 'rorka'
    } catch {
      return 'rorka'
    }
  },

  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateMessage: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('updater-message', handler)
    return () => ipcRenderer.removeListener('updater-message', handler)
  },

  // System Accent Color
  getSystemAccentColor: () => ipcRenderer.invoke('get-system-accent-color'),
  onSystemAccentColorChanged: (callback: (color: string) => void) => {
    const handler = (_event: any, color: string) => callback(color)
    ipcRenderer.on('system-accent-color-changed', handler)
    return () => ipcRenderer.removeListener('system-accent-color-changed', handler)
  },

  // Local Player
  openLocalFiles: () => ipcRenderer.invoke('open-local-files'),
  openLocalFolder: () => ipcRenderer.invoke('open-local-folder'),
  scanLocalFolder: (folderPath: string) => ipcRenderer.invoke('scan-local-folder', folderPath),
  parseLocalFile: (filePath: string) => ipcRenderer.invoke('parse-local-file', filePath),
  showItemInFolder: (filePath: string) => ipcRenderer.send('show-item-in-folder', filePath),
})
