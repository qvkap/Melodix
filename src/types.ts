export interface Track {
  id: string
  title: string
  artist: string
  duration: number
  thumbnail: string
  url: string
  isExplicit?: boolean
  isLocal?: boolean
  localPath?: string
}

export interface Playlist {
  id: string
  name: string
  description?: string
  tracks: Track[]
  createdAt: number
}

export interface LrcLine {
  time: number   // seconds
  text: string
}

export interface PlayerState {
  currentTrack: Track | null
  queue: Track[]
  isPlaying: boolean
  progress: number      // 0–1
  currentTime: number   // seconds
  duration: number
  volume: number        // 0–1
  isMuted: boolean
  shuffle: boolean
  repeat: 'none' | 'one' | 'all'
}

export interface LyricsState {
  lines: LrcLine[]
  plain: string
  activeLine: number
  loading: boolean
}

export interface Album {
  id: string
  title: string
  artist: string
  thumbnail: string
  trackCount?: number
  url?: string
}

export type BlurMaterial = 'acrylic' | 'vibrant' | 'ambient' | 'glow' | 'none'
export type AppLanguage = 'ru' | 'en'

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

export interface YtdlpInfo {
  currentVersion: string | null
  latestVersion: string | null
  lastChecked: number | null
  isUpdating: boolean
  autoUpdate: boolean
  path: string
  status: 'idle' | 'checking' | 'updating' | 'updated' | 'error'
  statusText?: string
}

declare global {
  interface Window {
    melodix: {
      minimize: () => void
      maximize: () => void
      close: () => void
      searchMusic: (query: string) => Promise<{ success: boolean; results?: Track[]; error?: string }>
      searchAlbums?: (query: string) => Promise<{ success: boolean; results?: Album[]; error?: string }>
      getAlbumTracks?: (albumIdOrUrl: string) => Promise<{ success: boolean; tracks?: Track[]; error?: string }>
      getStreamUrl: (videoId: string, fallbackQuery?: string) => Promise<{ success: boolean; url?: string; error?: string }>
      fetchLyrics: (opts: { title: string; artist: string; duration?: number; trackId?: string }) => Promise<{
        success: boolean
        syncedLyrics?: string
        plainLyrics?: string
        error?: string
      }>
      storeGet: (key: string) => Promise<any>
      storeSet: (key: string, value: any) => Promise<void>
      getUsername?: () => Promise<string>
      checkForUpdates?: () => Promise<{ success: boolean; status?: string; message?: string; updateInfo?: any; error?: string }>
      installUpdate?: () => Promise<void>
      onUpdateMessage?: (callback: (data: { status: string; message?: string; version?: string; percent?: number }) => void) => () => void
      getSystemAccentColor?: () => Promise<{ success: boolean; color?: string | null }>
      onSystemAccentColorChanged?: (callback: (color: string) => void) => () => void
      openLocalFiles?: () => Promise<{ success: boolean; tracks?: Track[]; error?: string }>
      openLocalFolder?: () => Promise<{ success: boolean; folderPath?: string; tracks?: Track[]; error?: string }>
      scanLocalFolder?: (folderPath: string) => Promise<{ success: boolean; folderPath?: string; tracks?: Track[]; error?: string }>
      parseLocalFile?: (filePath: string) => Promise<{ success: boolean; track?: Track; error?: string }>
      showItemInFolder?: (filePath: string) => void
      // Proxy & yt-dlp
      getProxyConfig?: () => Promise<ProxyConfig>
      setProxyConfig?: (cfg: ProxyConfig) => Promise<{ success: boolean; error?: string }>
      testProxy?: (proxyUrl?: string) => Promise<{ success: boolean; latencyMs?: number; error?: string }>
      getYtdlpInfo?: () => Promise<YtdlpInfo>
      updateYtdlp?: () => Promise<{ success: boolean; currentVersion?: string; latestVersion?: string; error?: string }>
      setYtdlpAutoUpdate?: (enabled: boolean) => Promise<void>
      onYtdlpStatus?: (callback: (data: YtdlpInfo) => void) => () => void
    }
  }
}
