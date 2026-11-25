import { app, BrowserWindow, ipcMain, shell, systemPreferences, protocol, net, dialog, session } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { execFile, spawn, ChildProcess } from 'child_process'
import { promisify } from 'util'
import Store from 'electron-store'
import os from 'os'
import fs from 'fs'
import { pathToFileURL } from 'url'

import { MprisService } from "./mpris"

let ytInnertube: any = null
let ytInnertubePromise: Promise<any> | null = null

async function getInnertube(): Promise<any> {
  if (ytInnertube) return ytInnertube
  if (!ytInnertubePromise) {
    // Use native dynamic import() so TypeScript (CommonJS) does not transpile it to require()
    const dynamicImport = new Function('specifier', 'return import(specifier)')
    ytInnertubePromise = dynamicImport('youtubei.js')
      .then((mod: any) => mod.Innertube.create({ generate_session_locally: true }))
      .then((yt: any) => {
        ytInnertube = yt
        return yt
      })
      .catch((err: any) => {
        ytInnertubePromise = null
        throw err
      })
  }
  return ytInnertubePromise
}
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

const execFileAsync = promisify(execFile)
const store = new Store()

// ─── User-Data Storage for Downloaded Binaries ───────────────────────────
function getUserDataBinDir(): string {
  const binDir = join(app.getPath('userData'), 'bin')
  if (!fs.existsSync(binDir)) {
    try {
      fs.mkdirSync(binDir, { recursive: true })
    } catch {}
  }
  return binDir
}

function getYtdlpBinaryName(): string {
  if (process.platform === 'win32') return 'yt-dlp.exe'
  if (process.platform === 'darwin') return 'yt-dlp_macos'
  return 'yt-dlp'
}

function getUserUpdatedYtdlpPath(): string {
  return join(getUserDataBinDir(), getYtdlpBinaryName())
}

function getYtdlpPath(): string {
  // 0. Top priority: Background-updated binary in userData/bin
  try {
    const userBin = getUserUpdatedYtdlpPath()
    if (fs.existsSync(userBin)) {
      const stats = fs.statSync(userBin)
      if (stats.size > 2 * 1024 * 1024) {
        return userBin
      }
    }
  } catch {}

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

  if (process.platform === 'darwin') {
    // macOS: prefer yt-dlp_macos universal binary bundled in CI
    const macBundled = join(process.resourcesPath, 'bin', 'yt-dlp_macos')
    if (fs.existsSync(macBundled)) return macBundled

    const macLocal = join(app.getAppPath(), 'bin', 'yt-dlp_macos')
    if (fs.existsSync(macLocal)) return macLocal

    // Fall back to plain yt-dlp (also bundled in CI)
    const plainBundled = join(process.resourcesPath, 'bin', 'yt-dlp')
    if (fs.existsSync(plainBundled)) return plainBundled

    // Homebrew locations
    if (fs.existsSync('/usr/local/bin/yt-dlp')) return '/usr/local/bin/yt-dlp'
    if (fs.existsSync('/opt/homebrew/bin/yt-dlp')) return '/opt/homebrew/bin/yt-dlp'

    return 'yt-dlp'
  }

  // Linux
  const bundledLinux = join(process.resourcesPath, 'bin', 'yt-dlp')
  if (fs.existsSync(bundledLinux)) return bundledLinux

  const localBinLinux = join(app.getAppPath(), 'bin', 'yt-dlp')
  if (fs.existsSync(localBinLinux)) return localBinLinux

  const userBin = join(os.homedir(), '.local', 'bin', 'yt-dlp')
  if (fs.existsSync(userBin)) return userBin
  return 'yt-dlp'
}

// ─── Proxy Server Configuration ──────────────────────────────────────────
export interface ProxyConfig {
  enabled: boolean
  protocol: 'http' | 'https' | 'socks5' | 'socks4'
  host: string
  port: string | number
  username?: string
  password?: string
  customUrl?: string
  useCustomUrl?: boolean
  applyToElectron?: boolean
}

function buildProxyUrl(cfg: ProxyConfig): string {
  if (!cfg) return ''
  if (cfg.useCustomUrl && cfg.customUrl?.trim()) {
    let u = cfg.customUrl.trim()
    if (!u.includes('://')) {
      u = `http://${u}`
    }
    return u
  }
  if (!cfg.host?.trim() || !cfg.port) return ''
  const proto = cfg.protocol || 'http'
  const host = cfg.host.trim()
  const port = String(cfg.port).trim()
  if (cfg.username && cfg.username.trim()) {
    const user = encodeURIComponent(cfg.username.trim())
    const pass = cfg.password ? encodeURIComponent(cfg.password) : ''
    return `${proto}://${user}:${pass}@${host}:${port}`
  }
  return `${proto}://${host}:${port}`
}

function getActiveProxyUrl(): string | null {
  try {
    const cfg = store.get('proxy_config') as ProxyConfig | undefined
    if (cfg && cfg.enabled) {
      const url = buildProxyUrl(cfg)
      if (url) return url
    }
  } catch {}
  return null
}

function applyProxyToSession(cfg?: ProxyConfig) {
  const currentCfg = cfg || (store.get('proxy_config') as ProxyConfig | undefined)
  const proxyUrl = currentCfg && currentCfg.enabled ? buildProxyUrl(currentCfg) : ''
  const applyToElectron = currentCfg ? (currentCfg.applyToElectron !== false) : true

  if (proxyUrl && applyToElectron) {
    try {
      session.defaultSession.setProxy({ proxyRules: proxyUrl })
        .then(() => console.log('[Proxy] Session proxy configured:', proxyUrl.replace(/:([^:@]+)@/, ':***@')))
        .catch(err => console.error('[Proxy] Failed to set session proxy:', err))
      process.env.HTTP_PROXY = proxyUrl
      process.env.HTTPS_PROXY = proxyUrl
      process.env.ALL_PROXY = proxyUrl
    } catch (e) {
      console.error('[Proxy] Error applying session proxy:', e)
    }
  } else {
    try {
      session.defaultSession.setProxy({ mode: 'direct' }).catch(() => {})
      delete process.env.HTTP_PROXY
      delete process.env.HTTPS_PROXY
      delete process.env.ALL_PROXY
    } catch {}
  }
}

// Uniform runner for yt-dlp that always injects the proxy and uses latest binary
async function execYtdlp(args: string[], options: { timeout?: number } = {}) {
  const ytdlpPath = getYtdlpPath()
  const finalArgs = [...args]

  const proxyUrl = getActiveProxyUrl()
  if (proxyUrl) {
    finalArgs.unshift('--proxy', proxyUrl)
  }

  return execFileAsync(ytdlpPath, finalArgs, options)
}

// ─── Automatic Background yt-dlp Updater ─────────────────────────────────
export interface YtdlpUpdateState {
  currentVersion: string | null
  latestVersion: string | null
  lastChecked: number | null
  isUpdating: boolean
  autoUpdate: boolean
  path: string
  status: 'idle' | 'checking' | 'updating' | 'updated' | 'error'
  statusText?: string
}

let ytdlpState: YtdlpUpdateState = {
  currentVersion: null,
  latestVersion: null,
  lastChecked: null,
  isUpdating: false,
  autoUpdate: true,
  path: '',
  status: 'idle',
  statusText: '',
}

function broadcastYtdlpStatus() {
  ytdlpState.path = getYtdlpPath()
  ytdlpState.autoUpdate = store.get('ytdlp_auto_update', true) as boolean
  mainWindow?.webContents.send('ytdlp-status', ytdlpState)
}

async function getCurrentYtdlpVersion(): Promise<string | null> {
  try {
    const p = getYtdlpPath()
    const { stdout } = await execFileAsync(p, ['--version'], { timeout: 8000 })
    const v = stdout.trim()
    if (v) {
      ytdlpState.currentVersion = v
      return v
    }
  } catch {}
  return null
}

async function fetchLatestYtdlpVersion(): Promise<string | null> {
  // Method 1: Check GitHub releases/latest redirect URL (instant, no rate limit)
  try {
    const res = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest', {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': 'MelodixApp/1.0.0' }
    })
    const loc = res.headers.get('location')
    if (loc) {
      const match = loc.match(/\/tag\/([^/]+)/)
      if (match && match[1]) {
        return match[1].replace(/^v/, '')
      }
    }
  } catch {}

  // Method 2: GitHub API
  try {
    const res = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
      headers: { 'User-Agent': 'MelodixApp/1.0.0' }
    })
    if (res.ok) {
      const data: any = await res.json()
      if (data.tag_name) {
        return data.tag_name.replace(/^v/, '')
      }
    }
  } catch {}

  return null
}

async function downloadAndInstallYtdlp(latestVer: string): Promise<boolean> {
  const binaryName = getYtdlpBinaryName()
  const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`
  const userBinDir = getUserDataBinDir()
  const tempPath = join(userBinDir, `${binaryName}.download`)
  const targetPath = join(userBinDir, binaryName)

  console.log(`[yt-dlp Updater] Downloading ${binaryName} from ${downloadUrl}...`)

  const res = await fetch(downloadUrl, {
    headers: { 'User-Agent': 'MelodixApp/1.0.0' },
    redirect: 'follow',
  })

  if (!res.ok || !res.body) {
    throw new Error(`Failed to download yt-dlp binary: HTTP ${res.status}`)
  }

  // @ts-ignore
  const { Readable } = await import('stream')
  // @ts-ignore
  const { pipeline } = await import('stream/promises')

  const fileStream = fs.createWriteStream(tempPath)
  await pipeline(Readable.fromWeb(res.body as any), fileStream)

  if (process.platform !== 'win32') {
    fs.chmodSync(tempPath, 0o755)
  }

  // Validation: run --version on downloaded binary
  const { stdout } = await execFileAsync(tempPath, ['--version'], { timeout: 10000 })
  const verOut = stdout.trim()
  if (!verOut || !/^\d{4}\./.test(verOut)) {
    try { fs.unlinkSync(tempPath) } catch {}
    throw new Error(`Downloaded binary validation failed (version output: "${verOut}")`)
  }

  // Atomic replace
  if (fs.existsSync(targetPath)) {
    try { fs.unlinkSync(targetPath) } catch {}
  }
  fs.renameSync(tempPath, targetPath)

  ytdlpState.currentVersion = verOut
  ytdlpState.path = targetPath
  console.log(`[yt-dlp Updater] Successfully installed yt-dlp ${verOut} to ${targetPath}`)
  return true
}

async function checkAndUpdateYtdlp(isManual: boolean = false): Promise<{ success: boolean; currentVersion?: string; latestVersion?: string; error?: string }> {
  if (ytdlpState.isUpdating) {
    return { success: false, error: 'Обновление уже выполняется' }
  }

  const autoEnabled = store.get('ytdlp_auto_update', true) as boolean
  if (!isManual && !autoEnabled) {
    return { success: true, currentVersion: ytdlpState.currentVersion || undefined }
  }

  ytdlpState.isUpdating = true
  ytdlpState.status = 'checking'
  ytdlpState.statusText = 'Проверка версии...'
  broadcastYtdlpStatus()

  try {
    const [currentVer, latestVer] = await Promise.all([
      getCurrentYtdlpVersion(),
      fetchLatestYtdlpVersion(),
    ])

    ytdlpState.currentVersion = currentVer
    ytdlpState.latestVersion = latestVer
    ytdlpState.lastChecked = Date.now()

    if (!latestVer) {
      ytdlpState.status = 'idle'
      ytdlpState.statusText = 'Не удалось получить данные о последней версии'
      broadcastYtdlpStatus()
      return { success: false, currentVersion: currentVer || undefined, error: 'Не удалось проверить версию на GitHub' }
    }

    if (currentVer && currentVer === latestVer && !isManual) {
      ytdlpState.status = 'idle'
      ytdlpState.statusText = `Установлена последняя версия (${currentVer})`
      broadcastYtdlpStatus()
      return { success: true, currentVersion: currentVer, latestVersion: latestVer }
    }

    // Need update or manual force update
    if (!currentVer || currentVer !== latestVer || (isManual && !fs.existsSync(getUserUpdatedYtdlpPath()))) {
      ytdlpState.status = 'updating'
      ytdlpState.statusText = `Загрузка yt-dlp v${latestVer}...`
      broadcastYtdlpStatus()

      await downloadAndInstallYtdlp(latestVer)

      ytdlpState.status = 'updated'
      ytdlpState.statusText = `yt-dlp обновлен до v${ytdlpState.currentVersion}`
      broadcastYtdlpStatus()
      return { success: true, currentVersion: ytdlpState.currentVersion || latestVer, latestVersion: latestVer }
    } else {
      ytdlpState.status = 'idle'
      ytdlpState.statusText = `Установлена последняя версия (${currentVer})`
      broadcastYtdlpStatus()
      return { success: true, currentVersion: currentVer, latestVersion: latestVer }
    }
  } catch (err: any) {
    console.error('[yt-dlp Updater] Error:', err?.message || err)
    ytdlpState.status = 'error'
    ytdlpState.statusText = err?.message || 'Ошибка обновления yt-dlp'
    broadcastYtdlpStatus()
    return { success: false, currentVersion: ytdlpState.currentVersion || undefined, error: err?.message || String(err) }
  } finally {
    ytdlpState.isUpdating = false
    broadcastYtdlpStatus()
  }
}

function scheduleYtdlpBackgroundUpdater() {
  // 1. Check once 25 seconds after app start (keeps initial startup fast)
  setTimeout(() => {
    getCurrentYtdlpVersion().then(() => {
      broadcastYtdlpStatus()
      checkAndUpdateYtdlp(false).catch(e => console.log('[yt-dlp Background Updater note]:', e?.message || e))
    })
  }, 25000)

  // 2. Periodic background check every 12 hours
  setInterval(() => {
    checkAndUpdateYtdlp(false).catch(e => console.log('[yt-dlp Periodic Updater note]:', e?.message || e))
  }, 12 * 60 * 60 * 1000)
}

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let mpris: MprisService | null = null

function createWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    icon: join(__dirname, '../public/logo.png'),
  })

  const splashHtml = join(__dirname, '../public/splash.html')
  splashWindow.loadFile(splashHtml)
  splashWindow.center()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
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
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
    }
    mainWindow?.show()
    if (!process.env.VITE_DEV_SERVER_URL) {
      setTimeout(() => {
        // isUpdaterAvailable is defined after createWindow() in the file,
        // but we check the file existence inline here too for safety
        const updateYml = join(process.resourcesPath, 'app-update.yml')
        if (fs.existsSync(updateYml)) {
          autoUpdater.checkForUpdates().catch((e) => console.log('Auto update check note:', e?.message || e))
        }
      }, 5000)
    }
  })

  mpris = new MprisService()
  mpris.init(mainWindow)

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
  applyProxyToSession()
  createWindow()
  scheduleYtdlpBackgroundUpdater()
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
// Portable / ZIP builds on Windows don't include app-update.yml — skip updater for those
const appUpdateYml = join(process.resourcesPath, 'app-update.yml')
const isUpdaterAvailable = !process.env.VITE_DEV_SERVER_URL && fs.existsSync(appUpdateYml)

if (isUpdaterAvailable) {
  try {
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
      console.log('AutoUpdater error (non-fatal):', err?.message || err)
      mainWindow?.webContents.send('updater-message', {
        status: 'error',
        message: err?.message || 'Ошибка обновления'
      })
    })
  } catch (err) {
    console.log('AutoUpdater setup error (non-fatal):', err)
  }
}

ipcMain.handle('check-for-updates', async () => {
  if (process.env.VITE_DEV_SERVER_URL) {
    return { success: true, status: 'dev', message: 'Автообновление доступно в собранном приложении' }
  }
  if (!isUpdaterAvailable) {
    return { success: true, status: 'portable', message: 'Portable-версия: проверьте обновления на GitHub вручную' }
  }
  try {
    const result = await autoUpdater.checkForUpdates()
    return { success: true, updateInfo: result?.updateInfo }
  } catch (err: any) {
    return { success: false, error: err?.message }
  }
})

ipcMain.handle('install-update', () => {
  if (!isUpdaterAvailable) return
  try { autoUpdater.quitAndInstall() } catch {}
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
      const { stdout: channelStdout } = await execYtdlp([
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
      const { stdout: releaseStdout } = await execYtdlp([
        '--flat-playlist',
        '--dump-json',
        `https://www.youtube.com/@${channelHandle}/releases`,
        '--socket-timeout', '10',
      ], { timeout: 15000 })

      const releaseAlbums = parseLines(releaseStdout, channelHandle)
      combinedTracks.push(...releaseAlbums)
    } catch {}
  }

  // 1. Primary: Official YouTube Music Songs Search via youtubei.js (clean titles, official artists, square album art)
  if (!channelHandle) {
    try {
      const yt = await getInnertube()
      const res = await yt.music.search(rawQuery, { type: 'song' })
      const shelf: any = res.contents?.find((c: any) => c.contents?.length > 0) || res
      const items: any[] = shelf?.contents || []

      const ytmTracks = items
        .filter((item: any) => item && item.id && item.title)
        .map((item: any) => {
          const thumbs = item.thumbnail?.contents || []
          let thumb = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : ''
          if (thumb && thumb.includes('googleusercontent.com') && /=w\d+-h\d+/.test(thumb)) {
            thumb = thumb.replace(/=w\d+-h\d+[^&]*/, '=w544-h544-l90-rj')
          }
          if (!thumb) {
            thumb = `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`
          }

          const artist = Array.isArray(item.artists) && item.artists.length > 0
            ? item.artists.map((a: any) => a.name).filter(Boolean).join(', ')
            : (item.author?.name || 'Unknown Artist')

          return {
            id: String(item.id),
            title: String(item.title).trim(),
            artist: artist.trim() || 'Unknown Artist',
            album: item.album?.name ? String(item.album.name).trim() : undefined,
            duration: Number(item.duration?.seconds) || 0,
            thumbnail: thumb,
            url: `https://music.youtube.com/watch?v=${item.id}`,
          }
        })

      if (ytmTracks.length > 0) {
        const resp = { success: true, results: ytmTracks }
        searchCache.set(normQuery, { data: resp, ts: Date.now() })
        return resp
      }
    } catch (err: any) {
      console.log('YouTube Music search failed, falling back to yt-dlp:', err?.message || err)
    }
  }

  // Standard YouTube Search (30 results)
  try {
    const searchQuery = channelHandle ? `${channelHandle} songs` : rawQuery
    const { stdout } = await execYtdlp([
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
    const { stdout } = await execYtdlp([
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

  const handleMatch = rawQuery.match(/(?:https?:\/\/(?:www\.)?youtube\.com\/)?@([a-zA-Z0-9_.-]+)/i) ||
                      (rawQuery.endsWith('.mp3') ? [null, rawQuery.replace(/^@/, '')] : null)
  const channelHandle = handleMatch ? handleMatch[1] : null

  let albums: any[] = []

  // If channel handle, fetch official channel releases first
  if (channelHandle) {
    try {
      const { stdout: releaseStdout } = await execYtdlp([
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
    const { stdout } = await execYtdlp([
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

  try {
    const { stdout } = await execYtdlp([
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

  let targetUrl = trackIdOrUrl
  if (!targetUrl.startsWith('http')) {
    targetUrl = `https://youtube.com/watch?v=${trackIdOrUrl}`
  }

  const isSoundCloud = targetUrl.includes('soundcloud.com') || targetUrl.includes('sndcdn.com')
  const formatArg = isSoundCloud
    ? 'http_mp3/http_mp3_128/hls_aac_160k/hls_mp3_0_1/bestaudio/best'
    : 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best'

  try {
    const { stdout } = await execYtdlp([
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
      const { stdout } = await execYtdlp([
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

// In-Memory Lyrics Translation Cache
const translationCache = new Map<string, { translations: string[]; detectedLang?: string; ts: number }>()
const TRANSLATION_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

// Intelligent Lyrics Translation with Language Detection & Auto-Skip
ipcMain.handle('translate-lyrics', async (_event, { texts, targetLang }: { texts: string[]; targetLang: string }) => {
  try {
    if (!texts || !texts.length) return { success: true, translations: [] }
    const lang = targetLang === 'en' ? 'en' : 'ru'

    // Fast heuristic on input text
    const sample = texts.slice(0, 30).join(' ')
    const cyrillicCount = (sample.match(/[а-яёА-ЯЁ]/g) || []).length
    const latinCount = (sample.match(/[a-zA-Z]/g) || []).length

    // If target is Russian and text has substantial Russian characters: already Russian, skip!
    if (lang === 'ru' && cyrillicCount > 15 && cyrillicCount > latinCount * 0.4) {
      return { success: true, translations: [], detectedLang: 'ru' }
    }

    // Cache key based on lang + length + first few lines
    const cacheKey = `${lang}:${texts.length}:${texts.slice(0, 5).join('|')}`
    const cached = translationCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < TRANSLATION_TTL) {
      return { success: true, translations: cached.translations, detectedLang: cached.detectedLang }
    }

    // Replace instrumental / empty lines with placeholder token
    const placeholder = '§§§'
    const payloadLines = texts.map(t => {
      const trimmed = t.trim()
      if (!trimmed || trimmed === '•••' || trimmed === '...') return placeholder
      return trimmed
    })

    const bodyText = payloadLines.join('\n')
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `q=${encodeURIComponent(bodyText)}`
    })

    if (!res.ok) {
      return { success: false, error: `Translation request failed with status ${res.status}` }
    }

    const data: any = await res.json()
    const detectedLang = data[2]

    // If detected language is already target language, skip translation
    if (detectedLang === lang) {
      translationCache.set(cacheKey, { translations: [], detectedLang, ts: Date.now() })
      return { success: true, translations: [], detectedLang }
    }

    const translatedFull = (data[0] || []).map((x: any) => x[0]).join('')
    const transParts = translatedFull.split('\n')

    const translations = texts.map((orig, i) => {
      const trimmed = orig.trim()
      if (!trimmed || trimmed === '•••' || trimmed === '...') return ''
      const tr = transParts[i] || ''
      if (tr.includes(placeholder)) return ''
      return tr.trim()
    })

    translationCache.set(cacheKey, { translations, detectedLang, ts: Date.now() })
    return { success: true, translations, detectedLang }
  } catch (err: any) {
    console.error('Translation error:', err)
    return { success: false, error: err?.message || 'Translation error' }
  }
})

// Import Playlist from Yandex Music, Apple Music, or Spotify
ipcMain.handle('import-playlist', async (_event, { platform, url }: { platform: string; url: string }) => {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  try {
    const cleanUrl = (url || '').trim()
    if (!cleanUrl) return { success: false, error: 'Укажите ссылку на плейлист' }

    if (platform === 'spotify') {
      const match = cleanUrl.match(/(?:playlist\/|spotify:playlist:)([a-zA-Z0-9]+)/)
      if (!match) return { success: false, error: 'Неверная ссылка на плейлист Spotify' }
      const playlistId = match[1]
      const res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
        headers: { 'User-Agent': UA },
      })
      if (!res.ok) return { success: false, error: `Spotify вернул статус ${res.status}` }
      const html = await res.text()
      const idx = html.indexOf('__NEXT_DATA__')
      if (idx === -1) return { success: false, error: 'Не удалось прочитать данные плейлиста Spotify (возможно, он приватный)' }
      const start = html.indexOf('>', idx) + 1
      const end = html.indexOf('</script>', start)
      const data: any = JSON.parse(html.slice(start, end))
      const entity = data?.props?.pageProps?.state?.data?.entity
      const trackList = entity?.trackList || []
      const tracks = trackList
        .filter((t: any) => t?.title)
        .map((t: any) => ({
          title: String(t.title).trim(),
          artist: String(t.subtitle || '').replace(/\u00a0/g, ' ').trim(),
        }))
      if (!tracks.length) return { success: false, error: 'В плейлисте Spotify не найдено треков' }
      return { success: true, playlistTitle: entity?.title || entity?.name || '', tracks }
    }

    if (platform === 'apple') {
      if (!cleanUrl.includes('music.apple.com') || !cleanUrl.includes('playlist')) {
        return { success: false, error: 'Неверная ссылка на плейлист Apple Music' }
      }
      const res = await fetch(cleanUrl, { headers: { 'User-Agent': UA } })
      if (!res.ok) return { success: false, error: `Apple Music вернул статус ${res.status}` }
      const html = await res.text()
      const idx = html.indexOf('serialized-server-data')
      if (idx === -1) return { success: false, error: 'Не удалось прочитать данные плейлиста Apple Music' }
      const start = html.indexOf('>', idx) + 1
      const end = html.indexOf('</script>', start)
      const data: any = JSON.parse(html.slice(start, end))

      const tracks: { title: string; artist: string }[] = []
      const seen = new Set<string>()
      let playlistTitle = ''

      const walk = (obj: any) => {
        if (!obj || typeof obj !== 'object') return
        if (Array.isArray(obj)) {
          for (const item of obj) walk(item)
          return
        }
        if (!playlistTitle && obj.itemKind === 'playlistHeaderLockup' && obj.title) {
          playlistTitle = String(obj.title)
        }
        if (obj.itemKind === 'trackLockup' || (obj.title && obj.subtitleLinks && obj.contentDescriptor?.kind === 'song')) {
          const title = String(obj.title || '').trim()
          const artist = Array.isArray(obj.subtitleLinks)
            ? obj.subtitleLinks.map((l: any) => l.title).filter(Boolean).join(', ').trim()
            : ''
          const key = `${title.toLowerCase()}::${artist.toLowerCase()}`
          if (title && !seen.has(key)) {
            seen.add(key)
            tracks.push({ title, artist })
          }
        }
        for (const k of Object.keys(obj)) {
          walk(obj[k])
        }
      }
      walk(data)
      if (!tracks.length) return { success: false, error: 'В плейлисте Apple Music не найдено треков' }
      return { success: true, playlistTitle, tracks }
    }

    if (platform === 'yandex') {
      if (!cleanUrl.includes('music.yandex.')) {
        return { success: false, error: 'Неверная ссылка на плейлист Яндекс Музыки' }
      }
      const res = await fetch(cleanUrl, { headers: { 'User-Agent': UA } })
      if (!res.ok) return { success: false, error: `Яндекс Музыка вернула статус ${res.status}` }
      const html = await res.text()

      let playlistTitle = ''
      const orderedIds: string[] = []
      const seenIds = new Set<string>()
      const trackMap = new Map<string, { title: string; artist: string }>()

      const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
      for (const m of scriptMatches) {
        const s = m[1]
        if (!s.includes('__STATE_PATCHES__')) continue
        const pushIdx = s.indexOf('.push(')
        if (pushIdx === -1) continue
        const arrStart = s.indexOf('[', pushIdx)
        const arrEnd = s.lastIndexOf(']')
        if (arrStart === -1 || arrEnd === -1 || arrEnd <= arrStart) continue
        try {
          const ops = JSON.parse(s.slice(arrStart, arrEnd + 1))
          if (!Array.isArray(ops)) continue
          for (const op of ops) {
            if (op.path === '/playlist/meta' && op.value?.title) {
              playlistTitle = String(op.value.title)
            }
            if ((op.path?.startsWith('/playlist/items/') || op.path?.startsWith('/playlist/initialItems/')) && op.value?.id) {
              const id = String(op.value.id)
              if (!seenIds.has(id)) {
                seenIds.add(id)
                orderedIds.push(id)
              }
              if (op.value.data?.title) {
                const artist = Array.isArray(op.value.data.artists)
                  ? op.value.data.artists.map((a: any) => a.name).filter(Boolean).join(', ')
                  : ''
                trackMap.set(id, { title: String(op.value.data.title).trim(), artist: artist.trim() })
              }
            }
          }
        } catch {}
      }

      // Fetch any remaining track details from Yandex Music public tracks endpoint in batches of 100
      const missingIds = orderedIds.filter(id => !trackMap.has(id))
      for (let i = 0; i < missingIds.length; i += 100) {
        const batch = missingIds.slice(i, i + 100)
        try {
          const trRes = await fetch('https://api.music.yandex.net/tracks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': UA,
            },
            body: `track-ids=${batch.join(',')}`,
          })
          if (trRes.ok) {
            const trData: any = await trRes.json()
            for (const item of (trData?.result || [])) {
              const id = String(item.id)
              if (item.title) {
                const artist = Array.isArray(item.artists)
                  ? item.artists.map((a: any) => a.name).filter(Boolean).join(', ')
                  : ''
                trackMap.set(id, { title: String(item.title).trim(), artist: artist.trim() })
              }
            }
          }
        } catch {}
      }

      const tracks = orderedIds
        .map(id => trackMap.get(id))
        .filter((t): t is { title: string; artist: string } => Boolean(t && t.title))

      if (!tracks.length) {
        return { success: false, error: 'Не удалось найти треки. Убедитесь, что плейлист публичный и ссылка корректна.' }
      }
      return { success: true, playlistTitle, tracks }
    }

    return { success: false, error: 'Неизвестная площадка' }
  } catch (err: any) {
    console.error('Import playlist error:', err)
    return { success: false, error: err?.message || 'Ошибка при импорте плейлиста' }
  }
})

// Store: get/set
ipcMain.handle('store-get', (_event, key: string) => store.get(key))
ipcMain.handle('store-set', (_event, key: string, value: any) => store.set(key, value))

// Proxy Configuration IPC Handlers
ipcMain.handle('get-proxy-config', () => {
  const defaultCfg: ProxyConfig = {
    enabled: false,
    protocol: 'http',
    host: '127.0.0.1',
    port: '7890',
    applyToElectron: true,
  }
  return (store.get('proxy_config') as ProxyConfig) || defaultCfg
})

ipcMain.handle('set-proxy-config', async (_event, cfg: ProxyConfig) => {
  try {
    store.set('proxy_config', cfg)
    applyProxyToSession(cfg)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
})

ipcMain.handle('test-proxy', async (_event, proxyUrl?: string) => {
  const start = Date.now()
  const targetUrl = proxyUrl || getActiveProxyUrl()
  if (!targetUrl) {
    return { success: false, error: 'Прокси-сервер не указан' }
  }

  try {
    const ytdlpPath = getYtdlpPath()
    await execFileAsync(ytdlpPath, [
      '--proxy', targetUrl,
      '--socket-timeout', '8',
      '--no-warnings',
      '--dump-user-agent',
    ], { timeout: 12000 })

    return { success: true, latencyMs: Date.now() - start }
  } catch (err: any) {
    console.log('[test-proxy note]:', err?.message || err)
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err?.message?.includes('timed out') || err?.code === 'ETIMEDOUT'
        ? 'Таймаут подключения (прокси не отвечает)'
        : (err?.message?.slice(0, 100) || 'Ошибка подключения к прокси'),
    }
  }
})

// yt-dlp Updater IPC Handlers
ipcMain.handle('get-ytdlp-info', async () => {
  if (!ytdlpState.currentVersion) {
    await getCurrentYtdlpVersion()
  }
  ytdlpState.path = getYtdlpPath()
  ytdlpState.autoUpdate = store.get('ytdlp_auto_update', true) as boolean
  return ytdlpState
})

ipcMain.handle('update-ytdlp', async () => {
  return checkAndUpdateYtdlp(true)
})

ipcMain.handle('set-ytdlp-auto-update', (_event, enabled: boolean) => {
  store.set('ytdlp_auto_update', Boolean(enabled))
  ytdlpState.autoUpdate = Boolean(enabled)
  broadcastYtdlpStatus()
})

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


ipcMain.on('mpris-update-state', (_e, state: any) => {
  if (mpris) mpris.updateState(state)
})


app.on('will-quit', () => {
  if (mpris) (mpris as any).player = null
})
