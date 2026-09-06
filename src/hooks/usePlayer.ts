import { useState, useEffect, useRef, useCallback } from 'react'
import { Howl } from 'howler'
import Hls from 'hls.js'
import { Track, PlayerState, LyricsState, LrcLine } from '../types'
import { parseLrc, getActiveLine, getThumbnail, prepareLyricsWithInstrumentals } from '../utils'
import { useSettings } from '../contexts/SettingsContext'
import { LastFmService } from '../services/lastfm'

class HlsAudioAdapter {
  private audio: HTMLAudioElement
  private hls: Hls | null = null

  constructor(url: string, opts: {
    volume: number;
    mute: boolean;
    onplay: () => void;
    onpause: () => void;
    onstop: () => void;
    onend: () => void;
    onloaderror: (id: any, err: any) => void;
  }) {
    this.audio = new Audio()
    this.audio.volume = opts.volume
    this.audio.muted = opts.mute

    this.audio.addEventListener('play', opts.onplay)
    this.audio.addEventListener('pause', opts.onpause)
    this.audio.addEventListener('ended', opts.onend)
    this.audio.addEventListener('error', (e) => opts.onloaderror(null, e))

    if (url.includes('.m3u8') && Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      })
      this.hls.loadSource(url)
      this.hls.attachMedia(this.audio)
      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          opts.onloaderror(null, data)
        }
      })
    } else {
      this.audio.src = url
    }
  }

  play() {
    this.audio.play().catch(() => {})
  }

  pause() {
    this.audio.pause()
  }

  playing(): boolean {
    return !this.audio.paused && !this.audio.ended
  }

  seek(val?: number): number {
    if (typeof val === 'number') {
      this.audio.currentTime = val
      return val
    }
    return this.audio.currentTime || 0
  }

  duration(): number {
    return this.audio.duration || 0
  }

  volume(v?: number): number {
    if (typeof v === 'number') {
      this.audio.volume = v
      return v
    }
    return this.audio.volume
  }

  mute(m?: boolean): boolean {
    if (typeof m === 'boolean') {
      this.audio.muted = m
      return m
    }
    return this.audio.muted
  }

  unload() {
    this.audio.pause()
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
    this.audio.src = ''
    this.audio.remove()
  }
}

const DEFAULT_STATE: PlayerState = {
  currentTrack: null,
  queue: [],
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  shuffle: false,
  repeat: 'none',
}

export function usePlayer() {
  const { settings, addToRecentlyPlayed } = useSettings()
  const [state, setState] = useState<PlayerState>(DEFAULT_STATE)
  const [lyrics, setLyrics] = useState<LyricsState>({
    lines: [], plain: '', activeLine: -1, loading: false,
  })

  const howlRef = useRef<any>(null)
  const rafRef = useRef<number>(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const hasScrobbledRef = useRef(false)
  const hasPreloadedNextRef = useRef(false)
  const trackStartTimeRef = useRef(0)

  // Lightweight RAF loop for active lyric line and next track preloading
  const tick = useCallback(() => {
    const h = howlRef.current
    if (!h) return

    if (h.playing()) {
      const t = h.seek()
      if (typeof t === 'number' && isFinite(t)) {
        setLyrics(l => {
          if (!l.lines.length) return l
          const newLine = getActiveLine(l.lines, t)
          if (l.activeLine === newLine) return l // DO NOT RE-RENDER IF UNCHANGED!
          return { ...l, activeLine: newLine }
        })

        const d = h.duration() || 0

        // Pre-fetch next track 15s before end for gapless, zero-buffering transitions
        if (!hasPreloadedNextRef.current && d > 20 && (d - t <= 15)) {
          hasPreloadedNextRef.current = true
          const { queue, currentTrack, shuffle } = stateRef.current
          if (queue.length > 1 && currentTrack) {
            const currentIdx = queue.findIndex(tr => tr.id === currentTrack.id)
            const nextTrack = shuffle
              ? queue[Math.floor(Math.random() * queue.length)]
              : queue[(currentIdx + 1) % queue.length]
            if (nextTrack && nextTrack.id !== currentTrack.id) {
              const nextTarget = nextTrack.url && nextTrack.url.startsWith('http') ? nextTrack.url : nextTrack.id
              window.melodix?.getStreamUrl?.(nextTarget, `${nextTrack.artist} ${nextTrack.title}`)
            }
          }
        }

        // Last.fm Scrobble Check (at 50% or 240 seconds)
        if (
          settings.lastfmEnabled &&
          settings.lastfmSessionKey &&
          !hasScrobbledRef.current &&
          d > 30 &&
          (t > d * 0.5 || t > 240) &&
          stateRef.current.currentTrack
        ) {
          hasScrobbledRef.current = true
          LastFmService.scrobble({
            apiKey: settings.lastfmApiKey,
            secret: settings.lastfmSecret,
            sessionKey: settings.lastfmSessionKey,
            artist: stateRef.current.currentTrack.artist,
            track: stateRef.current.currentTrack.title,
            timestamp: trackStartTimeRef.current || Date.now(),
          })
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [settings.lastfmEnabled, settings.lastfmSessionKey, settings.lastfmApiKey, settings.lastfmSecret])

  const stopTick = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }

  const loadTrack = useCallback(async (track: Track) => {
    if (howlRef.current) {
      howlRef.current.unload()
      howlRef.current = null
    }
    stopTick()

    hasScrobbledRef.current = false
    hasPreloadedNextRef.current = false
    trackStartTimeRef.current = Date.now()

    const fixedTrack = { ...track, thumbnail: getThumbnail(track) }

    setState(s => ({
      ...s,
      currentTrack: fixedTrack,
      isPlaying: false,
      progress: 0,
      currentTime: 0,
      duration: 0,
    }))
    setLyrics({ lines: [], plain: '', activeLine: -1, loading: true })

    addToRecentlyPlayed(fixedTrack)

    // Last.fm Now Playing update
    if (settings.lastfmEnabled && settings.lastfmSessionKey) {
      LastFmService.updateNowPlaying({
        apiKey: settings.lastfmApiKey,
        secret: settings.lastfmSecret,
        sessionKey: settings.lastfmSessionKey,
        artist: fixedTrack.artist,
        track: fixedTrack.title,
      })
    }

    // Stream URL (handles both direct web URLs and YouTube IDs, with fallback query)
    const streamTarget = track.url && track.url.startsWith('http') ? track.url : track.id
    const fallbackQuery = `${fixedTrack.artist} ${fixedTrack.title}`
    const streamRes = await window.melodix.getStreamUrl(streamTarget, fallbackQuery)
    if (!streamRes.success || !streamRes.url) {
      console.error('Stream error:', streamRes.error)
      setLyrics(l => ({ ...l, loading: false }))
      return
    }

    // Fetch Lyrics in parallel
    window.melodix.fetchLyrics({
      title: track.title,
      artist: track.artist,
      duration: track.duration,
    }).then(res => {
      if (res.success) {
        const rawLines: LrcLine[] = res.syncedLyrics ? parseLrc(res.syncedLyrics) : []
        const lines: LrcLine[] = prepareLyricsWithInstrumentals(rawLines)
        setLyrics({ lines, plain: res.plainLyrics || '', activeLine: -1, loading: false })
      } else {
        setLyrics({ lines: [], plain: '', activeLine: -1, loading: false })
      }
    })

    const isM3u8 = streamRes.url.includes('.m3u8')
    const opts = {
      volume: stateRef.current.volume,
      mute: stateRef.current.isMuted,
      onplay: () => {
        setState(s => ({ ...s, isPlaying: true }))
        rafRef.current = requestAnimationFrame(tick)
      },
      onpause: () => {
        setState(s => ({ ...s, isPlaying: false }))
        stopTick()
      },
      onstop: () => {
        setState(s => ({ ...s, isPlaying: false }))
        stopTick()
      },
      onend: () => {
        stopTick()
        setTimeout(handleTrackEnd, 50)
      },
      onloaderror: (_id: any, err: any) => {
        console.error('Load error:', err)
        setLyrics(l => ({ ...l, loading: false }))
      },
    }

    if (isM3u8) {
      const adapter = new HlsAudioAdapter(streamRes.url, opts)
      howlRef.current = adapter
      adapter.play()
    } else {
      const howl = new Howl({
        src: [streamRes.url],
        html5: true,
        ...opts,
      })
      howlRef.current = howl
      howl.play()
    }
  }, [tick, addToRecentlyPlayed, settings.lastfmEnabled, settings.lastfmSessionKey, settings.lastfmApiKey, settings.lastfmSecret])

  const handleTrackEnd = useCallback(() => {
    const { repeat, queue, currentTrack, shuffle } = stateRef.current
    if (!currentTrack) return

    // If Repeat One: restart current track completely
    if (repeat === 'one') {
      loadTrack(currentTrack)
      return
    }

    if (!queue.length) {
      if (repeat === 'all') {
        loadTrack(currentTrack)
      }
      return
    }

    const idx = queue.findIndex(t => t.id === currentTrack.id)
    if (repeat === 'all' || (idx !== -1 && idx < queue.length - 1)) {
      let next: Track
      if (shuffle) {
        next = queue[Math.floor(Math.random() * queue.length)]
      } else {
        const nextIdx = idx === -1 ? 0 : (idx + 1) % queue.length
        next = queue[nextIdx]
      }
      loadTrack(next)
    }
  }, [loadTrack])

  const togglePlay = () => {
    const h = howlRef.current
    if (!h) return
    if (h.playing()) h.pause()
    else h.play()
  }

  const seek = useCallback((value: number) => {
    const h = howlRef.current
    if (!h) return
    const d = h.duration()
    if (!d) return
    h.seek(value * d)
  }, [])

  const seekToTime = useCallback((seconds: number) => {
    const h = howlRef.current
    if (!h) return
    h.seek(seconds)
  }, [])

  const setVolume = (v: number) => {
    howlRef.current?.volume(v)
    setState(s => ({ ...s, volume: v, isMuted: v === 0 }))
  }

  const toggleMute = () => {
    const muted = !stateRef.current.isMuted
    howlRef.current?.mute(muted)
    setState(s => ({ ...s, isMuted: muted }))
  }

  const skipNext = useCallback(() => {
    const { queue, currentTrack, shuffle } = stateRef.current
    if (!queue.length) return
    const idx = queue.findIndex(t => t.id === currentTrack?.id)
    const next = shuffle
      ? queue[Math.floor(Math.random() * queue.length)]
      : queue[(idx + 1) % queue.length]
    loadTrack(next)
  }, [loadTrack])

  const skipPrev = useCallback(() => {
    const h = howlRef.current
    const { queue, currentTrack } = stateRef.current
    if (h) {
      const t = h.seek()
      if (typeof t === 'number' && t > 3) {
        h.seek(0)
        return
      }
    }
    if (!queue.length) return
    const idx = queue.findIndex(t => t.id === currentTrack?.id)
    loadTrack(queue[(idx - 1 + queue.length) % queue.length])
  }, [loadTrack])

  const setQueue = (tracks: Track[]) => {
    stateRef.current = { ...stateRef.current, queue: tracks }
    setState(s => ({ ...s, queue: tracks }))
  }
  const addToQueue = (track: Track) => setState(s => ({ ...s, queue: [...s.queue, track] }))
  const toggleShuffle = () => setState(s => ({ ...s, shuffle: !s.shuffle }))
  const cycleRepeat = () =>
    setState(s => ({
      ...s,
      repeat: s.repeat === 'none' ? 'all' : s.repeat === 'all' ? 'one' : 'none',
    }))

  useEffect(() => () => {
    howlRef.current?.unload()
    stopTick()
  }, [])

  return {
    state,
    lyrics,
    howlRef,
    loadTrack,
    togglePlay,
    seek,
    seekToTime,
    setVolume,
    toggleMute,
    skipNext,
    skipPrev,
    setQueue,
    addToQueue,
    toggleShuffle,
    cycleRepeat,
  }
}
