/**
 * Mobile Bridge for Melodix (Capacitor / Android / iOS / Web)
 * Automatically ensures window.melodix exists and handles search, streaming,
 * and storage when running outside the Electron desktop environment.
 */

import { Track, Album } from '../types'

const SC_CLIENT_ID = '2t9loNfhwiJGGjhNQaquodqRutBpBm'

export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.navigator?.userAgent?.includes('Electron'))
}

export function detectMobilePlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'
  // @ts-ignore
  if (window.Capacitor?.getPlatform) {
    // @ts-ignore
    const p = window.Capacitor.getPlatform()
    if (p === 'ios') return 'ios'
    if (p === 'android') return 'android'
  }
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export function initMobileBridge() {
  if (typeof window === 'undefined') return
  if (window.melodix && isElectron()) return // Running in desktop Electron with native yt-dlp

  console.log('[Melodix] Initializing Mobile / Capacitor Bridge...')

  const fallbackStore: Record<string, any> = {}

  window.melodix = {
    ...(window.melodix || {}),

    minimize: () => {},
    maximize: () => {},
    close: () => {},

    storeGet: async (key: string) => {
      try {
        const val = localStorage.getItem(`melodix_store_${key}`)
        return val ? JSON.parse(val) : fallbackStore[key]
      } catch {
        return fallbackStore[key]
      }
    },

    storeSet: async (key: string, value: any) => {
      try {
        localStorage.setItem(`melodix_store_${key}`, JSON.stringify(value))
        fallbackStore[key] = value
      } catch {
        fallbackStore[key] = value
      }
    },

    getUsername: async () => 'Melodix User',

    // Mobile Search (SoundCloud + Invidious fallback)
    searchMusic: async (query: string): Promise<{ success: boolean; results?: Track[]; error?: string }> => {
      try {
        const q = encodeURIComponent(query.trim())
        // Try SoundCloud API first for fast, unblocked mobile streaming
        const scRes = await fetch(
          `https://api-v2.soundcloud.com/search/tracks?q=${q}&client_id=${SC_CLIENT_ID}&limit=25`,
          { headers: { Accept: 'application/json' } }
        )

        if (scRes.ok) {
          const data = await scRes.json()
          if (Array.isArray(data.collection) && data.collection.length > 0) {
            const tracks: Track[] = data.collection
              .filter((item: any) => item && item.id && item.title)
              .map((item: any) => {
                let thumb = item.artwork_url || item.user?.avatar_url || ''
                if (thumb && thumb.includes('-large')) {
                  thumb = thumb.replace('-large', '-t500x500')
                }
                return {
                  id: `sc:${item.id}`,
                  title: item.title,
                  artist: item.user?.username || 'SoundCloud Artist',
                  duration: Math.round((item.duration || 0) / 1000),
                  thumbnail: thumb,
                  url: item.permalink_url || '',
                }
              })

            if (tracks.length > 0) {
              return { success: true, results: tracks }
            }
          }
        }

        // Fallback to Invidious public instance
        const invRes = await fetch(`https://inv.tux.pizza/api/v1/search?q=${q}&type=video`, {
          signal: AbortSignal.timeout(6000),
        })
        if (invRes.ok) {
          const items = await invRes.json()
          if (Array.isArray(items) && items.length > 0) {
            const tracks: Track[] = items
              .filter((v: any) => v.videoId && v.title)
              .slice(0, 25)
              .map((v: any) => ({
                id: v.videoId,
                title: v.title,
                artist: v.author || 'YouTube Artist',
                duration: v.lengthSeconds || 0,
                thumbnail: v.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
                url: `https://youtube.com/watch?v=${v.videoId}`,
              }))
            return { success: true, results: tracks }
          }
        }
      } catch (err: any) {
        console.warn('[MobileBridge] Search fallback notice:', err?.message)
      }

      return { success: false, error: 'Не удалось выполнить поиск на мобильном устройстве' }
    },

    searchAlbums: async (_query: string): Promise<{ success: boolean; results?: Album[]; error?: string }> => {
      return { success: true, results: [] }
    },

    getAlbumTracks: async (_id: string): Promise<{ success: boolean; tracks?: Track[]; error?: string }> => {
      return { success: true, tracks: [] }
    },

    // Mobile Stream URL resolution
    getStreamUrl: async (trackIdOrUrl: string, _fallbackQuery?: string): Promise<{ success: boolean; url?: string; error?: string }> => {
      try {
        // 1. SoundCloud stream resolution
        if (trackIdOrUrl.startsWith('sc:') || trackIdOrUrl.includes('soundcloud.com')) {
          const cleanId = trackIdOrUrl.replace(/^sc:/, '')
          const trackInfoRes = await fetch(`https://api-v2.soundcloud.com/tracks/${cleanId}?client_id=${SC_CLIENT_ID}`)
          if (trackInfoRes.ok) {
            const info = await trackInfoRes.json()
            const media = info?.media?.transcodings || []
            const prog = media.find((m: any) => m.format?.protocol === 'progressive')
            const hls = media.find((m: any) => m.format?.protocol === 'hls')
            const targetTranscoding = prog || hls

            if (targetTranscoding?.url) {
              const streamRes = await fetch(`${targetTranscoding.url}?client_id=${SC_CLIENT_ID}`)
              if (streamRes.ok) {
                const streamData = await streamRes.json()
                if (streamData?.url) {
                  return { success: true, url: streamData.url }
                }
              }
            }
          }
        }

        // 2. YouTube audio stream via Invidious
        const cleanYtId = trackIdOrUrl.replace(/^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=/, '')
        const invRes = await fetch(`https://inv.tux.pizza/api/v1/videos/${cleanYtId}`, {
          signal: AbortSignal.timeout(6000),
        })
        if (invRes.ok) {
          const videoData = await invRes.json()
          const audio = videoData?.adaptiveFormats?.find((f: any) => f.type?.includes('audio/'))
          if (audio?.url) {
            return { success: true, url: audio.url }
          }
        }
      } catch (err: any) {
        console.warn('[MobileBridge] Stream extraction notice:', err?.message)
      }

      return { success: false, error: 'Поток недоступен на данном устройстве' }
    },

    // Lyrics (lrclib.net supports direct browser CORS)
    fetchLyrics: async (opts: { title: string; artist: string; duration?: number; trackId?: string }) => {
      try {
        const cleanT = opts.title.replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').trim()
        const cleanA = opts.artist.replace(/\s*-\s*Topic$/i, '').trim()
        const params = new URLSearchParams({ track_name: cleanT, artist_name: cleanA })
        if (opts.duration) params.append('duration', String(Math.round(opts.duration)))

        const res = await fetch(`https://lrclib.net/api/get?${params}`)
        if (res.ok) {
          const data = await res.json()
          return {
            success: true,
            syncedLyrics: data.syncedLyrics || undefined,
            plainLyrics: data.plainLyrics || undefined,
          }
        }
      } catch {}
      return { success: false }
    },
  }
}
