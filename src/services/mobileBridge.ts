/**
 * Mobile Bridge for Melodix (Capacitor / Android / iOS / Web)
 * Automatically ensures window.melodix exists and handles search, streaming,
 * and storage when running outside the Electron desktop environment.
 */

import { Track, Album } from '../types'

let cachedScClientId = 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo'

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

/**
 * Dynamically resolves a valid SoundCloud client_id if the current one expires
 */
async function getSoundCloudClientId(): Promise<string> {
  if (cachedScClientId) return cachedScClientId
  try {
    const res = await fetch('https://soundcloud.com', { signal: AbortSignal.timeout(4000) })
    if (res.ok) {
      const html = await res.text()
      const matches = html.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[0-9]+-[a-zA-Z0-9]+\.js/g) || []
      for (const scriptUrl of matches.slice(0, 5)) {
        try {
          const sRes = await fetch(scriptUrl, { signal: AbortSignal.timeout(3000) })
          if (sRes.ok) {
            const code = await sRes.text()
            const idMatch = code.match(/client_id[:=]["']([a-zA-Z0-9]{32})["']/)
            if (idMatch?.[1]) {
              cachedScClientId = idMatch[1]
              return cachedScClientId
            }
          }
        } catch {}
      }
    }
  } catch {}
  return 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo'
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

    getUsername: async () => 'Melodix',

    // Mobile Search: Parallel multi-source (Audius + iTunes + SoundCloud)
    searchMusic: async (query: string): Promise<{ success: boolean; results?: Track[]; error?: string }> => {
      const trimmed = query.trim()
      if (!trimmed) return { success: true, results: [] }
      const q = encodeURIComponent(trimmed)

      const results: Track[] = []
      const seenTitles = new Set<string>()

      const addTrack = (track: Track) => {
        const key = `${track.artist} - ${track.title}`.toLowerCase()
        if (!seenTitles.has(key)) {
          seenTitles.add(key)
          results.push(track)
        }
      }

      // 1. Fetch from Audius API (Full-length free streaming tracks)
      const audiusPromise = (async () => {
        try {
          const res = await fetch(`https://discoveryprovider.audius.co/v1/tracks/search?query=${q}&app_name=melodix`, {
            signal: AbortSignal.timeout(6000),
          })
          if (res.ok) {
            const data = await res.json()
            const items = data?.data || []
            for (const item of items) {
              if (item?.id && item?.title) {
                const artwork = item.artwork?.['480x480'] || item.artwork?.['1000x1000'] || item.artwork?.['150x150'] || ''
                const streamUrl = `https://discoveryprovider.audius.co/v1/tracks/${item.id}/stream?app_name=melodix`
                addTrack({
                  id: `audius:${item.id}`,
                  title: item.title,
                  artist: item.user?.name || item.user?.handle || 'Artist',
                  duration: Math.round(item.duration || 0),
                  thumbnail: artwork,
                  url: streamUrl,
                })
              }
            }
          }
        } catch (err: any) {
          console.warn('[MobileBridge] Audius search notice:', err?.message)
        }
      })()

      // 2. Fetch from iTunes Search API (Accurate catalog, HD 600x600 artwork, instant audio previews)
      const itunesPromise = (async () => {
        try {
          const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=25`, {
            signal: AbortSignal.timeout(6000),
          })
          if (res.ok) {
            const data = await res.json()
            const items = data?.results || []
            for (const item of items) {
              if (item?.trackName && item?.artistName) {
                const thumb = (item.artworkUrl100 || '').replace('100x100bb', '600x600bb')
                addTrack({
                  id: `itunes:${item.trackId}`,
                  title: item.trackName,
                  artist: item.artistName,
                  duration: Math.round((item.trackTimeMillis || 0) / 1000),
                  thumbnail: thumb,
                  url: item.previewUrl || '',
                })
              }
            }
          }
        } catch (err: any) {
          console.warn('[MobileBridge] iTunes search notice:', err?.message)
        }
      })()

      // 3. Fetch from SoundCloud API
      const scPromise = (async () => {
        try {
          const clientId = await getSoundCloudClientId()
          const res = await fetch(
            `https://api-v2.soundcloud.com/search/tracks?q=${q}&client_id=${clientId}&limit=25`,
            { signal: AbortSignal.timeout(6000) }
          )
          if (res.ok) {
            const data = await res.json()
            const items = data?.collection || []
            for (const item of items) {
              if (item?.id && item?.title) {
                let thumb = item.artwork_url || item.user?.avatar_url || ''
                if (thumb.includes('-large')) thumb = thumb.replace('-large', '-t500x500')
                addTrack({
                  id: `sc:${item.id}`,
                  title: item.title,
                  artist: item.user?.username || 'SoundCloud Artist',
                  duration: Math.round((item.duration || 0) / 1000),
                  thumbnail: thumb,
                  url: item.permalink_url || '',
                })
              }
            }
          }
        } catch (err: any) {
          console.warn('[MobileBridge] SoundCloud search notice:', err?.message)
        }
      })()

      await Promise.allSettled([audiusPromise, itunesPromise, scPromise])

      if (results.length > 0) {
        return { success: true, results }
      }

      return { success: false, error: 'Ничего не найдено по вашему запросу' }
    },

    // Mobile Album Search: via iTunes catalog
    searchAlbums: async (query: string): Promise<{ success: boolean; results?: Album[]; error?: string }> => {
      try {
        const q = encodeURIComponent(query.trim())
        const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=album&limit=20`, {
          signal: AbortSignal.timeout(6000),
        })
        if (res.ok) {
          const data = await res.json()
          const items = data?.results || []
          const albums: Album[] = items
            .filter((item: any) => item?.collectionId && item?.collectionName)
            .map((item: any) => ({
              id: String(item.collectionId),
              title: item.collectionName,
              artist: item.artistName || 'Various Artists',
              year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
              thumbnail: (item.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
              trackCount: item.trackCount || 0,
            }))
          return { success: true, results: albums }
        }
      } catch (err: any) {
        console.warn('[MobileBridge] Album search notice:', err?.message)
      }
      return { success: true, results: [] }
    },

    // Mobile Album Tracks: via iTunes lookup
    getAlbumTracks: async (id: string): Promise<{ success: boolean; tracks?: Track[]; error?: string }> => {
      try {
        const cleanId = id.replace(/[^0-9]/g, '')
        if (!cleanId) return { success: true, tracks: [] }
        const res = await fetch(`https://itunes.apple.com/lookup?id=${cleanId}&entity=song`, {
          signal: AbortSignal.timeout(6000),
        })
        if (res.ok) {
          const data = await res.json()
          const items = data?.results || []
          const tracks: Track[] = items
            .filter((item: any) => item.wrapperType === 'track')
            .map((item: any) => ({
              id: `itunes:${item.trackId}`,
              title: item.trackName,
              artist: item.artistName,
              duration: Math.round((item.trackTimeMillis || 0) / 1000),
              thumbnail: (item.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
              url: item.previewUrl || '',
            }))
          return { success: true, tracks }
        }
      } catch (err: any) {
        console.warn('[MobileBridge] Album tracks lookup notice:', err?.message)
      }
      return { success: true, tracks: [] }
    },

    // Mobile Stream URL resolution
    getStreamUrl: async (trackIdOrUrl: string, fallbackQuery?: string): Promise<{ success: boolean; url?: string; error?: string }> => {
      try {
        // 1. Direct audio stream URLs (e.g. Audius stream, iTunes preview, or direct media link)
        if (
          trackIdOrUrl.startsWith('http') &&
          (trackIdOrUrl.includes('audius.co') ||
           trackIdOrUrl.includes('audio-ssl.itunes.apple.com') ||
           trackIdOrUrl.includes('.m4a') ||
           trackIdOrUrl.includes('.mp3') ||
           trackIdOrUrl.includes('/stream') ||
           trackIdOrUrl.includes('.m3u8'))
        ) {
          return { success: true, url: trackIdOrUrl }
        }

        // 2. Audius track ID
        if (trackIdOrUrl.startsWith('audius:')) {
          const cleanId = trackIdOrUrl.replace(/^audius:/, '')
          const audiusUrl = `https://discoveryprovider.audius.co/v1/tracks/${cleanId}/stream?app_name=melodix`
          return { success: true, url: audiusUrl }
        }

        // 3. iTunes track ID with direct preview search
        if (trackIdOrUrl.startsWith('itunes:')) {
          const cleanId = trackIdOrUrl.replace(/^itunes:/, '')
          try {
            const lookup = await fetch(`https://itunes.apple.com/lookup?id=${cleanId}`, { signal: AbortSignal.timeout(5000) })
            if (lookup.ok) {
              const data = await lookup.json()
              const trackItem = data?.results?.[0]
              if (trackItem?.previewUrl) {
                return { success: true, url: trackItem.previewUrl }
              }
            }
          } catch {}
        }

        // 4. SoundCloud stream resolution
        if (trackIdOrUrl.startsWith('sc:') || trackIdOrUrl.includes('soundcloud.com')) {
          const cleanId = trackIdOrUrl.replace(/^sc:/, '')
          const clientId = await getSoundCloudClientId()
          const trackInfoRes = await fetch(`https://api-v2.soundcloud.com/tracks/${cleanId}?client_id=${clientId}`, {
            signal: AbortSignal.timeout(5000),
          })
          if (trackInfoRes.ok) {
            const info = await trackInfoRes.json()
            const media = info?.media?.transcodings || []
            const prog = media.find((m: any) => m.format?.protocol === 'progressive')
            const hls = media.find((m: any) => m.format?.protocol === 'hls' || m.format?.protocol?.includes('hls'))
            const target = prog || hls

            if (target?.url) {
              const streamRes = await fetch(`${target.url}?client_id=${clientId}`, { signal: AbortSignal.timeout(5000) })
              if (streamRes.ok) {
                const streamData = await streamRes.json()
                if (streamData?.url) {
                  return { success: true, url: streamData.url }
                }
              }
            }
          }
        }

        // 5. Fallback: Search track on Audius by title/artist query
        if (fallbackQuery) {
          const q = encodeURIComponent(fallbackQuery.trim())
          try {
            const audiusRes = await fetch(`https://discoveryprovider.audius.co/v1/tracks/search?query=${q}&app_name=melodix`, {
              signal: AbortSignal.timeout(5000),
            })
            if (audiusRes.ok) {
              const aData = await audiusRes.json()
              const first = aData?.data?.[0]
              if (first?.id) {
                return { success: true, url: `https://discoveryprovider.audius.co/v1/tracks/${first.id}/stream?app_name=melodix` }
              }
            }
          } catch {}

          // Fallback to iTunes preview
          try {
            const itunesRes = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=1`, {
              signal: AbortSignal.timeout(5000),
            })
            if (itunesRes.ok) {
              const iData = await itunesRes.json()
              const first = iData?.results?.[0]
              if (first?.previewUrl) {
                return { success: true, url: first.previewUrl }
              }
            }
          } catch {}
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

        const res = await fetch(`https://lrclib.net/api/get?${params}`, { signal: AbortSignal.timeout(6000) })
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
