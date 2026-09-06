import { app, BrowserWindow, ipcMain, shell, systemPreferences, protocol, net, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { execFile, spawn, ChildProcess } from 'child_process'
import { promisify } from 'util'
import Store from 'electron-store'
import os from 'os'
import fs from 'fs'
import { pathToFileURL } from 'url'

// Register local-audio privileged scheme before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-audio',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
])

// Native Wayland flags (Linux only)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform,WaylandWindowDecorations')
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
  if (process.env.WAYLAND_DISPLAY) {
    app.commandLine.appendSwitch('ozone-platform', 'wayland')
  }
  // Ensure ~/.local/bin is in PATH so yt-dlp is found on Linux
  process.env.PATH = `${os.homedir()}/.local/bin:${process.env.PATH}`
}

function getYtdlpPath(): string {
  if (process.platform === 'win32') {
    // 1. Packaged extraResources: resources/bin/yt-dlp.exe
    const bundledPath = join(process.resourcesPath, 'bin', 'yt-dlp.exe')
    if (fs.existsSync(bundledPath)) return bundledPath

    // 2. Next to executable
    const exeDir = join(app.getAppPath(), '..', 'bin', 'yt-dlp.exe')
    if (fs.existsSync(exeDir)) return exeDir

    const localBin = join(app.getAppPath(), 'bin', 'yt-dlp.exe')
    if (fs.existsSync(localBin)) return localBin

    const cwdBin = join(process.cwd(), 'bin', 'yt-dlp.exe')
    if (fs.existsSync(cwdBin)) return cwdBin

    return 'yt-dlp.exe'
  }

  // Linux / macOS
  const bundledLinux = join(process.resourcesPath, 'bin', 'yt-dlp')
  if (fs.existsSync(bundledLinux)) return bundledLinux

  const localBinLinux = join(app.getAppPath(), 'bin', 'yt-dlp')
  if (fs.existsSync(localBinLinux)) return localBinLinux

  const userBin = join(os.homedir(), '.local', 'bin', 'yt-dlp')
  if (fs.existsSync(userBin)) return userBin
  return 'yt-dlp'
}

const execFileAsync = promisify(execFile)
const store = new Store()

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,
    backgroundColor: '#0a0d14',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    icon: join(__dirname, '../public/icon.png'),
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    const reactIndex = join(__dirname, '../dist-react/index.html')
    if (fs.existsSync(reactIndex)) {
      mainWindow.loadFile(reactIndex)
    } else {
      mainWindow.loadFile(join(__dirname, '../dist/index.html'))
    }
  }

  // Forward all renderer console messages to stdout
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE] level=${level}: ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error(`[FAIL LOAD] ${code}: ${desc} at ${url}`)
  })

  // Support Ctrl+R / F5 / Ctrl+Shift+I on Linux & Windows even in frameless mode
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if ((input.control || input.meta) && (input.key.toLowerCase() === 'r' || input.code === 'KeyR')) {
        mainWindow?.reload()
        event.preventDefault()
      } else if (input.key === 'F5') {
        mainWindow?.reload()
        event.preventDefault()
      } else if ((input.control || input.meta) && input.shift && (input.key.toLowerCase() === 'i' || input.code === 'KeyI')) {
        mainWindow?.webContents.toggleDevTools()
        event.preventDefault()
      }
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (!process.env.VITE_DEV_SERVER_URL) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((e) => console.log('Auto update check note:', e?.message || e))
      }, 5000)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  protocol.handle('local-audio', (request) => {
    try {
      let decoded = decodeURIComponent(request.url.replace(/^local-audio:\/\//, ''))
      if (process.platform === 'win32' && decoded.startsWith('/')) {
        decoded = decoded.slice(1)
      }
      return net.fetch(pathToFileURL(decoded).toString())
    } catch (e) {
      console.error('local-audio protocol error:', e)
      return new Response('File not found', { status: 404 })
    }
  })
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())
ipcMain.on('window-reload', () => mainWindow?.reload())

// Auto Update Configuration
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

autoUpdater.on('checking-for-update', () => {
  mainWindow?.webContents.send('updater-message', { status: 'checking', message: 'Проверка обновлений...' })
})

autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('updater-message', {
    status: 'available',
    version: info.version,
    message: `Доступна новая версия v${info.version}! Загрузка...`
  })
})

autoUpdater.on('update-not-available', () => {
  mainWindow?.webContents.send('updater-message', { status: 'not-available', message: 'У вас установлена последняя версия' })
})

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow?.webContents.send('updater-message', {
    status: 'downloading',
    percent: Math.round(progressObj.percent),
    bytesPerSecond: progressObj.bytesPerSecond,
    message: `Загрузка обновления: ${Math.round(progressObj.percent)}%`
  })
})

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('updater-message', {
    status: 'downloaded',
    version: info.version,
    message: `Версия v${info.version} готова к установке`
  })
})

autoUpdater.on('error', (err) => {
  mainWindow?.webContents.send('updater-message', {
    status: 'error',
    message: err?.message || 'Ошибка обновления'
  })
})

ipcMain.handle('check-for-updates', async () => {
  if (process.env.VITE_DEV_SERVER_URL) {
    return { success: true, status: 'dev', message: 'Автообновление доступно в собранном приложении' }
  }
  try {
    const result = await autoUpdater.checkForUpdates()
    return { success: true, updateInfo: result?.updateInfo }
  } catch (err: any) {
    return { success: false, error: err?.message }
  }
})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall()
})

// System Accent Color (Windows / macOS)
function getNativeAccentColor(): string | null {
  try {
    if (process.platform === 'win32' || process.platform === 'darwin') {
      const raw = systemPreferences.getAccentColor?.()
      if (raw && raw.length >= 6) {
        return '#' + raw.slice(0, 6)
      }
    }
  } catch (err) {
    console.error('Failed to get system accent color:', err)
  }
  return null
}

ipcMain.handle('get-system-accent-color', async () => {
  const color = getNativeAccentColor()
  return { success: true, color }
})

// Listen to Windows accent color changes (when user changes wallpaper or Windows theme)
if (process.platform === 'win32') {
  try {
    systemPreferences.on('accent-color-changed', (_event, newColor) => {
      if (mainWindow && !mainWindow.isDestroyed() && newColor) {
        const hex = '#' + newColor.slice(0, 6)
        mainWindow.webContents.send('system-accent-color-changed', hex)
      }
    })
  } catch (err) {
    console.log('accent-color-changed listener note:', err)
  }
}

// Performance In-Memory Caches
const searchCache = new Map<string, { data: any; ts: number }>()
const streamCache = new Map<string, { url: string; ts: number }>()
const lyricsCache = new Map<string, { data: any; ts: number }>()

const SEARCH_TTL = 10 * 60 * 1000      // 10 minutes
const STREAM_TTL = 4 * 60 * 60 * 1000  // 4 hours (in-memory)
const LYRICS_TTL = 24 * 60 * 60 * 1000 // 24 hours (in-memory)

// Persistent unified track cache (stream URL + lyrics stored together on disk)
const TRACK_CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

interface TrackCacheEntry {
  streamUrl?: string
  syncedLyrics?: string
  plainLyrics?: string
  cachedAt: number
}

function getTrackCache(trackId: string): TrackCacheEntry | null {
  try {
    const key = `track_cache:${trackId}`
    const entry = store.get(key) as TrackCacheEntry | undefined
    if (entry && Date.now() - entry.cachedAt < TRACK_CACHE_TTL) return entry
  } catch {}
  return null
}

function setTrackCache(trackId: string, patch: Partial<Omit<TrackCacheEntry, 'cachedAt'>>) {
  try {
    const key = `track_cache:${trackId}`
    const existing = (store.get(key) as TrackCacheEntry | undefined) || { cachedAt: 0 }
    store.set(key, { ...existing, ...patch, cachedAt: Date.now() })
  } catch {}
}

// Search Music: First try YouTube, with instant fallback to SoundCloud if DPI/SSL blocks YouTube
ipcMain.handle('search-music', async (_event, query: string) => {
  const normQuery = query.trim().toLowerCase()
  const cached = searchCache.get(normQuery)
  if (cached && Date.now() - cached.ts < SEARCH_TTL) {
    return cached.data
  }

  const ytdlpPath = getYtdlpPath()
  const rawQuery = query.trim()

  // Helper to parse yt-dlp dump-json lines
  const parseLines = (stdout: string, fallbackArtist?: string) => {
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          const item = JSON.parse(line)
          // Allow official album/release playlists (OLAK5uy...) or single tracks
          const isReleaseAlbum = item.id && typeof item.id === 'string' && item.id.startsWith('OLAK')
          if (item._type === 'channel' || (!isReleaseAlbum && (item._type === 'playlist' || item.ie_key === 'YoutubePlaylist' || item.ie_key === 'YoutubeTab'))) {
            return null
          }
          if (!isReleaseAlbum && item.url && (item.url.includes('/channel/') || item.url.includes('/@'))) return null
          if (!isReleaseAlbum && item.webpage_url && item.webpage_url.includes('/channel/')) return null
          if (typeof item.id === 'string' && (item.id.startsWith('PL') || item.id.startsWith('VL') || item.id.startsWith('RD') || item.id.startsWith('UC'))) return null

          let title = item.title || ''
          const lowerTitle = title.toLowerCase()
          // Filter out non-music videos, reactions, tutorials, compilations
          const isVideoOrNonMusic =
            lowerTitle.includes('reaction') ||
            lowerTitle.includes('reacting') ||
            lowerTitle.includes('interview') ||
            lowerTitle.includes('review') ||
            lowerTitle.includes('podcast') ||
            lowerTitle.includes('guitar lesson') ||
            lowerTitle.includes('chords') ||
            lowerTitle.includes('how to play') ||
            lowerTitle.includes('vlog') ||
            lowerTitle.includes('trailer') ||
            lowerTitle.includes('teaser') ||
            lowerTitle.includes('behind the scenes')
          if (isVideoOrNonMusic) return null
          if (item.duration && (item.duration > 1200 || item.duration < 15)) return null

          // Priority: Official artist metadata > creator > uploader/channel > fallback
          let artist = item.artist || item.creator || item.uploader || item.channel || item.playlist_uploader || fallbackArtist || ''
          artist = artist.replace(/\s*-\s*Topic$/i, '').replace(/^@/, '').trim()

          // Best thumbnail
          let thumb = item.thumbnail
          if (!thumb && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
            thumb = item.thumbnails[item.thumbnails.length - 1].url
          }
          if (!thumb && item.id) {
            thumb = `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`
          }

          return {
            id: String(item.id),
            title,
            artist: artist || 'Unknown Artist',
            duration: item.duration || 0,
            thumbnail: thumb || '',
            url: item.webpage_url || item.url || (isReleaseAlbum ? `https://youtube.com/playlist?list=${item.id}` : `https://youtube.com/watch?v=${item.id}`),
          }
        } catch {
          return null
        }
      })
      .filter(Boolean)
  }

  // Detect channel handle queries like "@nyan.mp3", "nyan.mp3", or "https://www.youtube.com/@nyan.mp3/releases"
  const handleMatch = rawQuery.match(/(?:https?:\/\/(?:www\.)?youtube\.com\/)?@([a-zA-Z0-9_.-]+)/i) ||
                      (rawQuery.endsWith('.mp3') ? [null, rawQuery.replace(/^@/, '')] : null)
  const channelHandle = handleMatch ? handleMatch[1] : null

  let combinedTracks: any[] = []

  // If channel handle detected, fetch official channel videos & releases first
  if (channelHandle) {
    try {
      const { stdout: channelStdout } = await execFileAsync(ytdlpPath, [
        '--flat-playlist',
        '--dump-json',
        `https://www.youtube.com/@${channelHandle}/videos`,
        '--socket-timeout', '10',
      ], { timeout: 20000 })

      const channelTracks = parseLines(channelStdout, channelHandle)
      combinedTracks.push(...channelTracks)
    } catch (e: any) {
      console.log('Channel videos fetch note:', e?.message || e)
    }

    try {
      const { stdout: releaseStdout } = await execFileAsync(ytdlpPath, [
        '--flat-playlist',
        '--dump-json',
        `https://www.youtube.com/@${channelHandle}/releases`,
        '--socket-timeout', '10',
      ], { timeout: 15000 })

      const releaseAlbums = parseLines(releaseStdout, channelHandle)
      combinedTracks.push(...releaseAlbums)
    } catch {}
  }

  // Standard YouTube Search (30 results)
  try {
    const searchQuery = channelHandle ? `${channelHandle} songs` : rawQuery
    const { stdout } = await execFileAsync(ytdlpPath, [
      `ytsearch30:${searchQuery}`,
      '--dump-json',
      '--no-playlist',
      '--flat-playlist',
      '--default-search', 'ytsearch',
      '--no-warnings',
      '--socket-timeout', '10',
    ], { timeout: 20000 })

    const searchTracks = parseLines(stdout, channelHandle || undefined)
    combinedTracks.push(...searchTracks)
  } catch (err: any) {
    console.log('YouTube search failed or blocked, trying fallback:', err?.message || err)
  }

  // Deduplicate combined tracks by id
  const seenIds = new Set<string>()
  const uniqueTracks = combinedTracks.filter(tr => {
    if (!tr || !tr.id || seenIds.has(tr.id)) return false
    seenIds.add(tr.id)
    return true
  })

  if (uniqueTracks.length > 0) {
    const resp = { success: true, results: uniqueTracks }
    searchCache.set(normQuery, { data: resp, ts: Date.now() })
    return resp
  }

  // 2. Fallback: SoundCloud Search (30 results, unblocked, very fast)
  try {
    const soundcloudQuery = channelHandle || rawQuery
    const { stdout } = await execFileAsync(ytdlpPath, [
      `scsearch30:${soundcloudQuery}`,
      '--dump-json',
      '--no-playlist',
      '--flat-playlist',
      '--no-warnings',
      '--socket-timeout', '10',
    ], { timeout: 20000 })

    const results = parseLines(stdout, channelHandle || undefined)
    if (results.length > 0) {
      const resp = { success: true, results }
      searchCache.set(normQuery, { data: resp, ts: Date.now() })
      return resp
    }
  } catch (err: any) {
    console.error('SoundCloud fallback search failed:', err?.message || err)
  }

  return { success: false, error: 'Поиск не дал результатов. Проверьте запрос.' }
})

// Search albums & release playlists via yt-dlp
ipcMain.handle('search-albums', async (_event, query: string) => {
  const rawQuery = (query || '').trim()
  if (!rawQuery) return { success: true, results: [] }

  const normQuery = `album:${rawQuery.toLowerCase()}`
  const cached = searchCache.get(normQuery)
  if (cached && Date.now() - cached.ts < SEARCH_TTL) {
    return cached.data
  }

  const ytdlpPath = getYtdlpPath()
  const handleMatch = rawQuery.match(/(?:https?:\/\/(?:www\.)?youtube\.com\/)?@([a-zA-Z0-9_.-]+)/i) ||
                      (rawQuery.endsWith('.mp3') ? [null, rawQuery.replace(/^@/, '')] : null)
  const channelHandle = handleMatch ? handleMatch[1] : null

  let albums: any[] = []

  // If channel handle, fetch official channel releases first
  if (channelHandle) {
    try {
      const { stdout: releaseStdout } = await execFileAsync(ytdlpPath, [
        '--flat-playlist',
        '--dump-json',
        `https://www.youtube.com/@${channelHandle}/releases`,
        '--socket-timeout', '10',
      ], { timeout: 15000 })

      const lines = releaseStdout.trim().split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const item = JSON.parse(line)
          if (!item.id) continue
          let thumb = item.thumbnail
          if (!thumb && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
            thumb = item.thumbnails[item.thumbnails.length - 1].url
          }
          albums.push({
            id: String(item.id),
            title: item.title || 'Релиз',
            artist: item.channel || item.uploader || channelHandle,
            thumbnail: thumb || '',
            trackCount: typeof item.playlist_count === 'number' && item.playlist_count > 0 ? item.playlist_count : undefined,
            url: item.url || `https://www.youtube.com/playlist?list=${item.id}`,
          })
        } catch {}
      }
    } catch {}
  }

  // Playlist / Album search on YouTube
  try {
    const searchQuery = channelHandle ? `${channelHandle} album` : rawQuery
    const { stdout } = await execFileAsync(ytdlpPath, [
      '--flat-playlist',
      '--dump-json',
      '--playlist-items', '1:25',
      `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}&sp=EgIQAw%253D%253D`,
      '--no-warnings',
      '--socket-timeout', '10',
    ], { timeout: 20000 })

    const lines = stdout.trim().split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const item = JSON.parse(line)
        if (!item.id) continue
        let thumb = item.thumbnail
        if (!thumb && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
          thumb = item.thumbnails[item.thumbnails.length - 1].url
        }
        let artist = item.channel || item.uploader || item.playlist_uploader || ''
        artist = artist.replace(/\s*-\s*Topic$/i, '').trim()

        albums.push({
          id: String(item.id),
          title: item.title || 'Альбом',
          artist: artist || 'Unknown Artist',
          thumbnail: thumb || '',
          trackCount: typeof item.playlist_count === 'number' && item.playlist_count > 0 ? item.playlist_count : undefined,
          url: item.url || `https://www.youtube.com/playlist?list=${item.id}`,
        })
      } catch {}
    }
  } catch (err: any) {
    console.log('Search albums yt error:', err?.message || err)
  }

  const seen = new Set<string>()
  const unique = albums.filter(a => {
    if (!a.id || seen.has(a.id)) return false
    seen.add(a.id)
    return true
  })

  const resp = { success: true, results: unique }
  searchCache.set(normQuery, { data: resp, ts: Date.now() })
  return resp
})

// Get tracks for an album or playlist
ipcMain.handle('get-album-tracks', async (_event, albumIdOrUrl: string) => {
  if (!albumIdOrUrl) return { success: false, error: 'No album id' }

  let playlistUrl = albumIdOrUrl
  if (!playlistUrl.startsWith('http')) {
    playlistUrl = `https://www.youtube.com/playlist?list=${albumIdOrUrl}`
  }

  const cacheKey = `album_tracks:${playlistUrl}`
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < SEARCH_TTL) {
    return cached.data
  }

  const ytdlpPath = getYtdlpPath()
  try {
    const { stdout } = await execFileAsync(ytdlpPath, [
      '--flat-playlist',
      '--dump-json',
      playlistUrl,
      '--no-warnings',
      '--socket-timeout', '15',
    ], { timeout: 25000 })

    const lines = stdout.trim().split('\n').filter(Boolean)
    const tracks: any[] = []

    for (const line of lines) {
      try {
        const item = JSON.parse(line)
        if (!item.id) continue
        let thumb = item.thumbnail
        if (!thumb && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
          thumb = item.thumbnails[item.thumbnails.length - 1].url
        }
        if (!thumb && item.id) {
          thumb = `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`
        }

        let artist = item.artist || item.creator || item.uploader || item.channel || ''
        artist = artist.replace(/\s*-\s*Topic$/i, '').trim()

        tracks.push({
          id: String(item.id),
          title: item.title || 'Unknown Track',
          artist: artist || 'Unknown Artist',
          duration: item.duration || 0,
          thumbnail: thumb || '',
          url: item.webpage_url || item.url || `https://youtube.com/watch?v=${item.id}`,
        })
      } catch {}
    }

    const resp = { success: true, tracks }
    searchCache.set(cacheKey, { data: resp, ts: Date.now() })
    return resp
  } catch (err: any) {
    console.error('Failed to get album tracks:', err?.message || err)
    return { success: false, error: 'Не удалось загрузить треки альбома' }
  }
})

// Get audio stream URL via yt-dlp (works for both YouTube and SoundCloud URLs, or local files)
ipcMain.handle('get-stream-url', async (_event, trackIdOrUrl: string, fallbackQuery?: string) => {
  if (!trackIdOrUrl) return { success: false, error: 'No track ID or URL' }

  // Direct return for local audio files
  if (trackIdOrUrl.startsWith('local-audio://') || trackIdOrUrl.startsWith('local:') || (trackIdOrUrl.startsWith('/') && fs.existsSync(trackIdOrUrl))) {
    let url = trackIdOrUrl
    if (trackIdOrUrl.startsWith('local:')) {
      url = `local-audio://${trackIdOrUrl.replace(/^local:/, '')}`
    } else if (!trackIdOrUrl.startsWith('local-audio://')) {
      url = `local-audio://${trackIdOrUrl}`
    }
    return { success: true, url }
  }

  // 1. Check in-memory cache first (fastest, sub-millisecond)
  const cachedStream = streamCache.get(trackIdOrUrl)
  if (cachedStream && Date.now() - cachedStream.ts < STREAM_TTL) {
    return { success: true, url: cachedStream.url }
  }

  // 2. Check persistent disk cache (survives restarts)
  const diskCached = getTrackCache(trackIdOrUrl)
  if (diskCached?.streamUrl) {
    streamCache.set(trackIdOrUrl, { url: diskCached.streamUrl, ts: Date.now() })
    return { success: true, url: diskCached.streamUrl }
  }

  const ytdlpPath = getYtdlpPath()
  let targetUrl = trackIdOrUrl
  if (!targetUrl.startsWith('http')) {
    targetUrl = `https://youtube.com/watch?v=${trackIdOrUrl}`
  }

  const isSoundCloud = targetUrl.includes('soundcloud.com') || targetUrl.includes('sndcdn.com')
  const formatArg = isSoundCloud
    ? 'http_mp3/http_mp3_128/hls_aac_160k/hls_mp3_0_1/bestaudio/best'
    : 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best'

  try {
    const { stdout } = await execFileAsync(ytdlpPath, [
      targetUrl,
      '-f', formatArg,
      '--get-url',
      '--no-warnings',
      '--socket-timeout', '15',
    ], { timeout: 25000 })

    const url = stdout.trim().split('\n')[0]
    if (url && url.startsWith('http')) {
      streamCache.set(trackIdOrUrl, { url, ts: Date.now() })
      setTrackCache(trackIdOrUrl, { streamUrl: url })
      return { success: true, url }
    }
  } catch (err: any) {
    console.error('get-stream-url direct failed:', targetUrl, err?.message || err)
  }

  // Fallback: If SoundCloud track failed (e.g. DRM or blocked), search on YouTube!
  if (fallbackQuery) {
    try {
      const { stdout } = await execFileAsync(ytdlpPath, [
        `ytsearch1:${fallbackQuery}`,
        '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
        '--get-url',
        '--no-warnings',
        '--socket-timeout', '15',
      ], { timeout: 25000 })

      const url = stdout.trim().split('\n')[0]
      if (url && url.startsWith('http')) {
        streamCache.set(trackIdOrUrl, { url, ts: Date.now() })
        setTrackCache(trackIdOrUrl, { streamUrl: url })
        return { success: true, url }
      }
    } catch (err2: any) {
      console.error('get-stream-url fallback failed:', err2?.message || err2)
    }
  }

  return { success: false, error: 'Could not extract stream URL' }
})

// Intelligent Lyrics Fetching from lrclib.net with Multi-Query Fallback
const LRCLIB_UA = 'MelodixApp/1.0.0 (https://github.com/rorka/melodix)'

function cleanQuery(str: string): string {
  return str
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '') // remove bracketed text like (Official Video), [4K]
    .replace(/(official video|official audio|music video|lyric video|official visualizer|remastered|lyrics)/gi, '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\|.*$/g, '')
    .trim()
}

ipcMain.handle('fetch-lyrics', async (_event, { title, artist, duration, trackId }: { title: string; artist: string; duration?: number; trackId?: string }) => {
  const cacheKey = `${(artist || '').toLowerCase().trim()}:${(title || '').toLowerCase().trim()}`

  // 1. Check in-memory lyrics cache
  const cached = lyricsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < LYRICS_TTL) {
    return cached.data
  }

  // 2. Check persistent disk cache keyed by trackId (survives restarts)
  if (trackId) {
    const diskCached = getTrackCache(trackId)
    if (diskCached && (diskCached.syncedLyrics || diskCached.plainLyrics)) {
      const resp = {
        success: true,
        syncedLyrics: diskCached.syncedLyrics,
        plainLyrics: diskCached.plainLyrics,
      }
      lyricsCache.set(cacheKey, { data: resp, ts: Date.now() })
      return resp
    }
  }

  try {
    const cleanT = cleanQuery(title)
    const cleanA = cleanQuery(artist)

    let candidateQueries: string[] = []
    if (cleanT.includes(' - ')) {
      const parts = cleanT.split(' - ')
      candidateQueries.push(`${parts[0].trim()} ${parts.slice(1).join(' ').trim()}`)
      candidateQueries.push(parts.slice(1).join(' ').trim())
    }

    if (cleanA && cleanA !== 'Unknown Artist') {
      candidateQueries.push(`${cleanA} ${cleanT}`)
    }
    candidateQueries.push(cleanT)
    candidateQueries = Array.from(new Set(candidateQueries.map(q => q.trim()).filter(Boolean)))

    // Helper: cache result in-memory + on disk and return
    const cacheAndReturn = (resp: { success: boolean; syncedLyrics?: string; plainLyrics?: string }) => {
      lyricsCache.set(cacheKey, { data: resp, ts: Date.now() })
      if (trackId && resp.success) {
        setTrackCache(trackId, {
          syncedLyrics: resp.syncedLyrics,
          plainLyrics: resp.plainLyrics,
        })
      }
      return resp
    }

    // 3. Exact get from lrclib
    if (cleanA && cleanT) {
      try {
        const params = new URLSearchParams({ track_name: cleanT, artist_name: cleanA })
        if (duration) params.append('duration', String(Math.round(duration)))
        const directRes = await fetch(`https://lrclib.net/api/get?${params}`, {
          headers: { 'User-Agent': LRCLIB_UA },
        })
        if (directRes.ok) {
          const directData: any = await directRes.json()
          if (directData.syncedLyrics || directData.plainLyrics) {
            return cacheAndReturn({
              success: true,
              syncedLyrics: directData.syncedLyrics || undefined,
              plainLyrics: directData.plainLyrics || undefined,
            })
          }
        }
      } catch {}
    }

    // 4. Search queries fallback
    for (const q of candidateQueries) {
      try {
        const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
          headers: { 'User-Agent': LRCLIB_UA },
        })
        if (searchRes.ok) {
          const items: any[] = await searchRes.json()
          if (Array.isArray(items) && items.length > 0) {
            const bestWithSynced = items.find(it => it.syncedLyrics && it.syncedLyrics.length > 0)
            const chosen = bestWithSynced || items[0]
            if (chosen.syncedLyrics || chosen.plainLyrics) {
              return cacheAndReturn({
                success: true,
                syncedLyrics: chosen.syncedLyrics || undefined,
                plainLyrics: chosen.plainLyrics || undefined,
              })
            }
          }
        }
      } catch (err) {
        console.error('Lrclib query error for:', q, err)
      }
    }

    return { success: false, error: 'No lyrics found' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Store: get/set
ipcMain.handle('store-get', (_event, key: string) => store.get(key))
ipcMain.handle('store-set', (_event, key: string, value: any) => store.set(key, value))

// System username
ipcMain.handle('get-username', () => {
  try {
    return os.userInfo().username || process.env.USER || process.env.USERNAME || 'User'
  } catch {
    return process.env.USER || process.env.USERNAME || 'User'
  }
})

// Local Music Player Helpers & Handlers
const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.opus', '.wma'])

async function parseLocalAudioFile(filePath: string) {
  const fileName = filePath.split(/[/\\]/).pop() || 'Unknown Track'
  const baseName = fileName.replace(/\.[^/.]+$/, '')
  try {
    const mm = await import('music-metadata')
    const metadata = await mm.parseFile(filePath, { skipCovers: false })
    let thumbnail = ''
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0]
      thumbnail = `data:${pic.format};base64,${Buffer.from(pic.data).toString('base64')}`
    }

    const title = metadata.common.title || baseName
    const artist = metadata.common.artist || metadata.common.albumartist || 'Локальный трек'
    const duration = Math.round(metadata.format.duration || 0)

    return {
      id: `local:${filePath}`,
      title,
      artist,
      duration,
      thumbnail,
      url: `local-audio://${filePath}`,
      isLocal: true,
      localPath: filePath,
    }
  } catch {
    return {
      id: `local:${filePath}`,
      title: baseName,
      artist: 'Локальный трек',
      duration: 0,
      thumbnail: '',
      url: `local-audio://${filePath}`,
      isLocal: true,
      localPath: filePath,
    }
  }
}

async function scanDirectoryForAudio(dirPath: string, maxDepth = 4, currentDepth = 0): Promise<string[]> {
  if (currentDepth > maxDepth) return []
  const results: string[] = []
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) {
          const sub = await scanDirectoryForAudio(fullPath, maxDepth, currentDepth + 1)
          results.push(...sub)
        }
      } else if (entry.isFile()) {
        const ext = entry.name.toLowerCase().slice(entry.name.lastIndexOf('.'))
        if (AUDIO_EXTENSIONS.has(ext)) {
          results.push(fullPath)
        }
      }
    }
  } catch (err) {
    console.error('Scan dir error:', err)
  }
  return results
}

ipcMain.handle('open-local-files', async () => {
  if (!mainWindow) return { success: false, error: 'No main window' }
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите аудиофайлы',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Аудиофайлы', extensions: ['mp3', 'flac', 'wav', 'm4a', 'ogg', 'aac', 'opus', 'wma'] }
    ]
  })
  if (res.canceled || !res.filePaths.length) {
    return { success: true, tracks: [] }
  }
  const tracks = await Promise.all(res.filePaths.map(parseLocalAudioFile))
  return { success: true, tracks }
})

ipcMain.handle('open-local-folder', async () => {
  if (!mainWindow) return { success: false, error: 'No main window' }
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите папку с музыкой',
    properties: ['openDirectory']
  })
  if (res.canceled || !res.filePaths.length) {
    return { success: true, tracks: [] }
  }
  const folderPath = res.filePaths[0]
  const audioFiles = await scanDirectoryForAudio(folderPath)
  const tracks = await Promise.all(audioFiles.map(parseLocalAudioFile))
  return { success: true, folderPath, tracks }
})

ipcMain.handle('scan-local-folder', async (_e, folderPath: string) => {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { success: false, error: 'Папка не существует' }
  }
  const audioFiles = await scanDirectoryForAudio(folderPath)
  const tracks = await Promise.all(audioFiles.map(parseLocalAudioFile))
  return { success: true, folderPath, tracks }
})

ipcMain.handle('parse-local-file', async (_e, filePath: string) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return { success: false, error: 'Файл не найден' }
  }
  const track = await parseLocalAudioFile(filePath)
  return { success: true, track }
})

ipcMain.on('show-item-in-folder', (_e, filePath: string) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath)
  }
})

