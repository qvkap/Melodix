import { useState, useEffect, useRef, useCallback } from 'react'
import { Howl } from 'howler'
import Hls from 'hls.js'
import { Track, PlayerState, LyricsState, LrcLine } from '../types'
import { parseLrc, getActiveLine, getThumbnail, prepareLyricsWithInstrumentals } from '../utils'
import { useSettings } from '../contexts/SettingsContext'
import { LastFmService } from '../services/lastfm'
import { translateLyricsLines, translatePlainLyrics } from '../services/lyricsTranslator'

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

/**
 * Equal-power audio crossfade curve.
 * Maintains constant acoustic energy across transitions (Spotify / Apple Music standard).
 */
function smoothFade(
  audio: any,
  fromVol: number,
  toVol: number,
  durationMs: number,
  onComplete?: () => void
): () => void {
  if (!audio) {
    onComplete?.()
    return () => {}
  }

  const startTime = performance.now()
  let cancelled = false
  let rafId = 0

  try {
    audio.volume(fromVol)
  } catch {}

  const step = () => {
    if (cancelled) return
    const elapsed = performance.now() - startTime
    const progress = Math.min(1, Math.max(0, elapsed / durationMs))

    let currentVol: number
    if (toVol > fromVol) {
      // Fade in using equal power curve
      currentVol = fromVol + (toVol - fromVol) * Math.sin(progress * 0.5 * Math.PI)
    } else {
      // Fade out using equal power curve
      currentVol = fromVol * Math.cos(progress * 0.5 * Math.PI)
    }
    currentVol = Math.min(1, Math.max(0, currentVol))

    try {
      audio.volume(currentVol)
    } catch {}

    if (progress < 1) {
      rafId = requestAnimationFrame(step)
    } else {
      try {
        audio.volume(toVol)
      } catch {}
      onComplete?.()
    }
  }

  rafId = requestAnimationFrame(step)
  return () => {
    cancelled = true
    if (rafId) cancelAnimationFrame(rafId)
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
  const settingsRef = useRef(settings)
  settingsRef.current = settings
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
  const seekingTargetRef = useRef<{ time: number; until: number } | null>(null)
  // Generation counter: incremented on each loadTrack call.
  // After every async await we verify our gen === loadGenRef.current to abort stale loads.
  const loadGenRef = useRef(0)

  // Crossfade & Preload management
  interface PreloadedTrack {
    track: Track
    streamUrl: string
    lyrics?: { lines: LrcLine[]; plain: string; plainTranslation?: string }
    howl?: any
    createdAt: number
  }

  const preloadedRef = useRef<PreloadedTrack | null>(null)
  const isPreloadingRef = useRef<boolean>(false)
  const crossfadeStartedRef = useRef<boolean>(false)
  const outgoingAudioRef = useRef<{ audio: any; cancelFade: () => void } | null>(null)
  const handleTrackEndRef = useRef<() => void>(() => {})
  const executeCrossfadeRef = useRef<(nextTrack: Track, fadeSeconds: number) => void>(() => {})
  const nextTrackRef = useRef<Track | null>(null)

  const getNextTrack = useCallback((forceRefresh: boolean = false): Track | null => {
    if (!forceRefresh && nextTrackRef.current) {
      return nextTrackRef.current
    }

    const { queue, currentTrack, shuffle, repeat } = stateRef.current
    if (!queue.length || !currentTrack) {
      nextTrackRef.current = null
      return null
    }
    if (repeat === 'one') {
      nextTrackRef.current = currentTrack
      return currentTrack
    }
    if (shuffle) {
      const candidates = queue.filter(tr => tr.id !== currentTrack.id)
      const picked = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : currentTrack
      nextTrackRef.current = picked
      return picked
    }
    const currentIdx = queue.findIndex(tr => tr.id === currentTrack.id)
    if (currentIdx === -1) {
      const picked = queue[0] || null
      nextTrackRef.current = picked
      return picked
    }
    if (currentIdx < queue.length - 1) {
      const picked = queue[currentIdx + 1]
      nextTrackRef.current = picked
      return picked
    }
    if (repeat === 'all') {
      const picked = queue[0]
      nextTrackRef.current = picked
      return picked
    }
    nextTrackRef.current = null
    return null
  }, [])

  const preloadNextTrack = useCallback(async (nextTrack: Track) => {
    if (isPreloadingRef.current) return
    isPreloadingRef.current = true

    try {
      const fixedTrack = { ...nextTrack, thumbnail: getThumbnail(nextTrack) }
      let streamUrl = ''

      if (nextTrack.isLocal || nextTrack.url?.startsWith('local-audio://') || nextTrack.id.startsWith('local:')) {
        streamUrl = nextTrack.url?.startsWith('local-audio://')
          ? nextTrack.url
          : `local-audio://${nextTrack.localPath || nextTrack.id.replace(/^local:/, '')}`
      } else {
        const streamTarget = nextTrack.url && nextTrack.url.startsWith('http') ? nextTrack.url : nextTrack.id
        const fallbackQuery = `${fixedTrack.artist} ${fixedTrack.title}`
        const streamRes = await window.melodix?.getStreamUrl?.(streamTarget, fallbackQuery)
        if (streamRes?.success && streamRes.url) {
          streamUrl = streamRes.url
        }
      }

      if (!streamUrl) {
        isPreloadingRef.current = false
        return
      }

      // Pre-fetch lyrics in parallel
      let lyricsData: { lines: LrcLine[]; plain: string; plainTranslation?: string } | undefined
      try {
        const lyrRes = await window.melodix?.fetchLyrics?.({
          title: nextTrack.title,
          artist: nextTrack.artist,
          duration: nextTrack.duration,
          trackId: nextTrack.id,
        })
        if (lyrRes?.success) {
          const rawLines = lyrRes.syncedLyrics ? parseLrc(lyrRes.syncedLyrics) : []
          let lines = prepareLyricsWithInstrumentals(rawLines)
          const targetLang = settingsRef.current.language || 'ru'
          let plainTranslation: string | undefined
          if (settingsRef.current.lyricsShowTranslation !== false) {
            if (lines.length > 0) {
              lines = await translateLyricsLines(lines, targetLang)
            } else if (lyrRes.plainLyrics) {
              plainTranslation = await translatePlainLyrics(lyrRes.plainLyrics, targetLang)
            }
          }
          lyricsData = { lines, plain: lyrRes.plainLyrics || '', plainTranslation }
        }
      } catch {}

      // Pre-create Howl instance with volume: 0
      let preAudio: any = null
      const isM3u8 = streamUrl.includes('.m3u8')
      if (!isM3u8) {
        preAudio = new Howl({
          src: [streamUrl],
          html5: true,
          preload: true,
          volume: 0,
          mute: stateRef.current.isMuted,
        })
      }

      preloadedRef.current = {
        track: fixedTrack,
        streamUrl,
        lyrics: lyricsData,
        howl: preAudio,
        createdAt: Date.now(),
      }
    } catch (e) {
      console.warn('Preload next track failed:', e)
    } finally {
      isPreloadingRef.current = false
    }
  }, [])

  const lastTickRef = useRef(0)

  // Throttled RAF loop (~10Hz) for active lyric line, preloading, and crossfading
  const tick = useCallback(() => {
    const h = howlRef.current
    if (!h) return

    const now = performance.now()
    if (now - lastTickRef.current >= 95 && h.playing()) {
      lastTickRef.current = now
      let t = h.seek()
      if (typeof t === 'number' && isFinite(t)) {
        // If recent seek in progress, respect target until audio actually catches up
        if (seekingTargetRef.current) {
          const { time: targetTime, until } = seekingTargetRef.current
          if (Date.now() < until && Math.abs(t - targetTime) > 1.5) {
            t = targetTime
          } else {
            seekingTargetRef.current = null
          }
        }

        setLyrics(l => {
          if (!l.lines.length) return l
          const newLine = getActiveLine(l.lines, t)
          if (l.activeLine === newLine) return l // DO NOT RE-RENDER IF UNCHANGED!
          return { ...l, activeLine: newLine }
        })

        const d = h.duration() || 0
        const crossfadeSec = settings.crossfade !== false ? (settings.crossfadeDuration || 5) : 0
        const rem = d - t

        // 1. Pre-fetch next track at 15s before end for zero-buffering crossfade transition
        if (!hasPreloadedNextRef.current && d > (crossfadeSec + 5) && rem <= 15) {
          hasPreloadedNextRef.current = true
          const nextTrack = getNextTrack()
          if (nextTrack && nextTrack.id !== stateRef.current.currentTrack?.id) {
            preloadNextTrack(nextTrack)
          }
        }

        // 2. Trigger Crossfade at <= crossfadeSec (default 5s) before end
        if (
          settings.crossfade !== false &&
          crossfadeSec > 0 &&
          !crossfadeStartedRef.current &&
          d > (crossfadeSec + 2) &&
          rem <= crossfadeSec
        ) {
          const nextTrack = getNextTrack()
          if (nextTrack && nextTrack.id !== stateRef.current.currentTrack?.id) {
            crossfadeStartedRef.current = true
            executeCrossfadeRef.current(nextTrack, crossfadeSec)
            return
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
    }
    // ALWAYS reschedule next frame so tick never dies during buffering/play startup
    rafRef.current = requestAnimationFrame(tick)
  }, [
    getNextTrack, preloadNextTrack, settings.crossfade, settings.crossfadeDuration,
    settings.lastfmEnabled, settings.lastfmSessionKey, settings.lastfmApiKey, settings.lastfmSecret
  ])

  // Background interval fallback for lyrics syncing when tab/webview is hidden (RAF paused)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) return
      const h = howlRef.current
      if (h && h.playing()) {
        const t = h.seek()
        if (typeof t === 'number' && isFinite(t)) {
          setLyrics(l => {
            if (!l.lines.length) return l
            const newLine = getActiveLine(l.lines, t)
            if (l.activeLine === newLine) return l
            return { ...l, activeLine: newLine }
          })
        }
      }
    }, 250)
    return () => clearInterval(timer)
  }, [])

  // Auto-translate lyrics when translation setting or language changes
  useEffect(() => {
    if (settings.lyricsShowTranslation === false) return
    const targetLang = settings.language || 'ru'
    if (lyrics.lines.length > 0) {
      const hasAnyTranslation = lyrics.lines.some(l => Boolean(l.translation))
      if (!hasAnyTranslation) {
        translateLyricsLines(lyrics.lines, targetLang).then(translated => {
          setLyrics(l => ({ ...l, lines: translated }))
        })
      }
    } else if (lyrics.plain && !lyrics.plainTranslation) {
      translatePlainLyrics(lyrics.plain, targetLang).then(transPlain => {
        setLyrics(l => ({ ...l, plainTranslation: transPlain }))
      })
    }
  }, [settings.lyricsShowTranslation, settings.language, lyrics.lines.length, lyrics.plain])

  const stopTick = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }

  const executeCrossfade = useCallback((nextTrack: Track, fadeSeconds: number) => {
    nextTrackRef.current = null
    const fadeDurationMs = Math.max(1000, fadeSeconds * 1000)
    const outgoing = howlRef.current
    const targetVol = stateRef.current.isMuted ? 0 : stateRef.current.volume

    // 1. Detach ALL events from outgoing audio immediately so it cannot trigger onend/onpause/tick/etc.
    if (outgoing) {
      if (outgoingAudioRef.current?.cancelFade) {
        outgoingAudioRef.current.cancelFade()
        try { outgoingAudioRef.current.audio?.unload?.() } catch {}
      }
      try {
        if (typeof outgoing.off === 'function') {
          outgoing.off('play')
          outgoing.off('pause')
          outgoing.off('stop')
          outgoing.off('end')
          outgoing.off('loaderror')
        }
        if (outgoing.audio) {
          outgoing.audio.onended = null
          outgoing.audio.onpause = null
          outgoing.audio.onplay = null
          outgoing.audio.ontimeupdate = null
          outgoing.audio.onerror = null
        }
      } catch (e) {
        console.warn('Error detaching outgoing listeners:', e)
      }

      const fromVol = typeof outgoing.volume === 'function' ? outgoing.volume() : targetVol
      const cancelFade = smoothFade(outgoing, fromVol, 0, fadeDurationMs, () => {
        try {
          outgoing.unload()
        } catch {}
        if (outgoingAudioRef.current?.audio === outgoing) {
          outgoingAudioRef.current = null
        }
      })
      outgoingAudioRef.current = { audio: outgoing, cancelFade }
    }

    // 2. Prepare INCOMING audio
    const gen = ++loadGenRef.current
    hasScrobbledRef.current = false
    hasPreloadedNextRef.current = false
    trackStartTimeRef.current = Date.now()

    const pre = preloadedRef.current && preloadedRef.current.track.id === nextTrack.id
      ? preloadedRef.current
      : null
    preloadedRef.current = null

    // Point howlRef to incoming if preloaded, else null so tick does not query outgoing
    howlRef.current = pre?.howl || null

    const fixedTrack = { ...nextTrack, thumbnail: getThumbnail(nextTrack) }

    stateRef.current = {
      ...stateRef.current,
      currentTrack: fixedTrack,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      duration: fixedTrack.duration || 0,
    }

    setState(s => ({
      ...s,
      currentTrack: fixedTrack,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      duration: fixedTrack.duration || 0,
    }))

    // Immediate lyrics update if preloaded (no blank screen or spinner!)
    if (pre?.lyrics) {
      setLyrics({
        lines: pre.lyrics.lines,
        plain: pre.lyrics.plain,
        plainTranslation: pre.lyrics.plainTranslation,
        activeLine: -1,
        loading: false,
      })
    } else {
      setLyrics({ lines: [], plain: '', plainTranslation: undefined, activeLine: -1, loading: true })
      window.melodix?.fetchLyrics?.({
        title: fixedTrack.title,
        artist: fixedTrack.artist,
        duration: fixedTrack.duration,
        trackId: fixedTrack.id,
      }).then(res => {
        if (gen !== loadGenRef.current) return
        if (res?.success) {
          const rawLines = res.syncedLyrics ? parseLrc(res.syncedLyrics) : []
          const lines = prepareLyricsWithInstrumentals(rawLines)
          setLyrics({ lines, plain: res.plainLyrics || '', plainTranslation: undefined, activeLine: -1, loading: false })
          if (settings.lyricsShowTranslation !== false) {
            const targetLang = settings.language || 'ru'
            if (lines.length > 0) {
              translateLyricsLines(lines, targetLang).then(translated => {
                if (gen !== loadGenRef.current) return
                setLyrics(l => ({ ...l, lines: translated }))
              })
            } else if (res.plainLyrics) {
              translatePlainLyrics(res.plainLyrics, targetLang).then(transPlain => {
                if (gen !== loadGenRef.current) return
                setLyrics(l => ({ ...l, plainTranslation: transPlain }))
              })
            }
          }
        } else {
          setLyrics({ lines: [], plain: '', plainTranslation: undefined, activeLine: -1, loading: false })
        }
      })
    }

    addToRecentlyPlayed(fixedTrack)

    if (settings.lastfmEnabled && settings.lastfmSessionKey) {
      LastFmService.updateNowPlaying({
        apiKey: settings.lastfmApiKey,
        secret: settings.lastfmSecret,
        sessionKey: settings.lastfmSessionKey,
        artist: fixedTrack.artist,
        track: fixedTrack.title,
      })
    }

    const opts = {
      volume: 0,
      mute: stateRef.current.isMuted,
      onplay: () => {
        crossfadeStartedRef.current = false
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
        setTimeout(() => handleTrackEndRef.current(), 50)
      },
      onloaderror: (_id: any, err: any) => {
        console.error('Crossfade load error:', err)
        setLyrics(l => ({ ...l, loading: false }))
      },
    }

    const startIncoming = (streamUrl: string, existingHowl?: any) => {
      if (gen !== loadGenRef.current) return
      let incoming: any
      if (streamUrl.includes('.m3u8')) {
        incoming = new HlsAudioAdapter(streamUrl, opts)
      } else if (existingHowl) {
        incoming = existingHowl
        incoming.on('play', opts.onplay)
        incoming.on('pause', opts.onpause)
        incoming.on('stop', opts.onstop)
        incoming.on('end', opts.onend)
        incoming.on('loaderror', opts.onloaderror)
      } else {
        incoming = new Howl({
          src: [streamUrl],
          html5: true,
          ...opts,
        })
      }

      howlRef.current = incoming
      incoming.volume(0)
      incoming.play()
      smoothFade(incoming, 0, targetVol, fadeDurationMs)
    }

    if (pre && pre.streamUrl) {
      startIncoming(pre.streamUrl, pre.howl)
    } else {
      let streamUrlPromise: Promise<string>
      if (fixedTrack.isLocal || fixedTrack.url?.startsWith('local-audio://') || fixedTrack.id.startsWith('local:')) {
        streamUrlPromise = Promise.resolve(
          fixedTrack.url?.startsWith('local-audio://')
            ? fixedTrack.url
            : `local-audio://${fixedTrack.localPath || fixedTrack.id.replace(/^local:/, '')}`
        )
      } else {
        const streamTarget = fixedTrack.url && fixedTrack.url.startsWith('http') ? fixedTrack.url : fixedTrack.id
        const fallbackQuery = `${fixedTrack.artist} ${fixedTrack.title}`
        streamUrlPromise = window.melodix?.getStreamUrl?.(streamTarget, fallbackQuery).then(res => res?.url || '')
      }

      streamUrlPromise.then(url => {
        if (!url || gen !== loadGenRef.current) return
        startIncoming(url)
      })
    }
  }, [tick, addToRecentlyPlayed, settings.lastfmEnabled, settings.lastfmSessionKey, settings.lastfmApiKey, settings.lastfmSecret])

  executeCrossfadeRef.current = executeCrossfade

  const loadTrack = useCallback(async (track: Track) => {
    // Claim this generation — any in-flight older loadTrack will see a mismatch and abort
    const gen = ++loadGenRef.current

    nextTrackRef.current = null

    if (outgoingAudioRef.current?.cancelFade) {
      outgoingAudioRef.current.cancelFade()
      try { outgoingAudioRef.current.audio?.unload?.() } catch {}
      outgoingAudioRef.current = null
    }
    crossfadeStartedRef.current = false
    hasPreloadedNextRef.current = false
    preloadedRef.current = null

    if (howlRef.current) {
      howlRef.current.unload()
      howlRef.current = null
    }
    stopTick()

    hasScrobbledRef.current = false
    hasPreloadedNextRef.current = false
    trackStartTimeRef.current = Date.now()

    const fixedTrack = { ...track, thumbnail: getThumbnail(track) }

    stateRef.current = {
      ...stateRef.current,
      currentTrack: fixedTrack,
      isPlaying: false,
      progress: 0,
      currentTime: 0,
      duration: 0,
    }

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

    // Stream URL (handles local files, direct web URLs, and YouTube IDs)
    let streamUrl = ''
    if (track.isLocal || track.url?.startsWith('local-audio://') || track.id.startsWith('local:')) {
      streamUrl = track.url?.startsWith('local-audio://')
        ? track.url
        : `local-audio://${track.localPath || track.id.replace(/^local:/, '')}`
    } else {
      const streamTarget = track.url && track.url.startsWith('http') ? track.url : track.id
      const fallbackQuery = `${fixedTrack.artist} ${fixedTrack.title}`
      const streamRes = await window.melodix.getStreamUrl(streamTarget, fallbackQuery)

      // ── GUARD: user skipped while we were waiting — abort silently ──
      if (gen !== loadGenRef.current) return

      if (!streamRes.success || !streamRes.url) {
        console.error('Stream error:', streamRes.error)
        setLyrics(l => ({ ...l, loading: false }))
        return
      }
      streamUrl = streamRes.url
    }

    // ── GUARD: check again after any synchronous local-url resolution ──
    if (gen !== loadGenRef.current) return

    // Fetch Lyrics in parallel (fire-and-forget, but guard the callback)
    window.melodix.fetchLyrics({
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      trackId: track.id,
    }).then(res => {
      // Only apply lyrics if this load is still the active one
      if (gen !== loadGenRef.current) return
      if (res.success) {
        const rawLines: LrcLine[] = res.syncedLyrics ? parseLrc(res.syncedLyrics) : []
        const lines: LrcLine[] = prepareLyricsWithInstrumentals(rawLines)
        setLyrics({ lines, plain: res.plainLyrics || '', plainTranslation: undefined, activeLine: -1, loading: false })
        if (settings.lyricsShowTranslation !== false) {
          const targetLang = settings.language || 'ru'
          if (lines.length > 0) {
            translateLyricsLines(lines, targetLang).then(translated => {
              if (gen !== loadGenRef.current) return
              setLyrics(l => ({ ...l, lines: translated }))
            })
          } else if (res.plainLyrics) {
            translatePlainLyrics(res.plainLyrics, targetLang).then(transPlain => {
              if (gen !== loadGenRef.current) return
              setLyrics(l => ({ ...l, plainTranslation: transPlain }))
            })
          }
        }
      } else {
        setLyrics({ lines: [], plain: '', plainTranslation: undefined, activeLine: -1, loading: false })
      }
    })

    const isM3u8 = streamUrl.includes('.m3u8')
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
      const adapter = new HlsAudioAdapter(streamUrl, opts)
      howlRef.current = adapter
      adapter.play()
    } else {
      const howl = new Howl({
        src: [streamUrl],
        html5: true,
        ...opts,
      })
      howlRef.current = howl
      howl.play()
    }
  }, [tick, addToRecentlyPlayed, settings.lastfmEnabled, settings.lastfmSessionKey, settings.lastfmApiKey, settings.lastfmSecret])

  const handleTrackEnd = useCallback(() => {
    // If crossfade already handled this transition, do not double-skip!
    if (crossfadeStartedRef.current) {
      return
    }

    const { repeat, queue, currentTrack, shuffle } = stateRef.current
    if (!currentTrack) return

    const h = howlRef.current
    if (h) {
      const cur = h.seek()
      const dur = h.duration() || currentTrack.duration || 0
      // Guard against false/premature stream disconnects on mobile & seek to 0:
      // If audio supposedly ended but position is far from track duration, do NOT skip!
      if (typeof cur === 'number' && dur > 5 && cur < dur - 2.5) {
        console.warn('[Melodix Player] Premature stream end ignored: cur =', cur, 'dur =', dur)
        if (!h.playing()) {
          try { h.play() } catch {}
        }
        return
      }
    }

    // If Repeat One: rewind and replay existing audio cleanly (prevents mobile autoplay lock and hang)
    if (repeat === 'one') {
      if (h) {
        try {
          h.seek(0)
          h.play()
          setState(s => ({ ...s, isPlaying: true, currentTime: 0, progress: 0 }))
          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(tick)
          }
          return
        } catch (e) {
          console.warn('[Melodix Player] Repeat one seek error, falling back to reload:', e)
        }
      }
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
  }, [loadTrack, tick])

  handleTrackEndRef.current = handleTrackEnd

  const togglePlay = () => {
    const h = howlRef.current
    if (!h) return
    if (h.playing()) h.pause()
    else h.play()
  }

  const seek = useCallback((value: number) => {
    const h = howlRef.current
    if (!h) return
    const d = h.duration() || stateRef.current.currentTrack?.duration || 0
    if (!d) return
    // Clamp so we never seek past the audio's true length
    const rawTarget = value * d
    const targetSeconds = Math.min(Math.max(0, rawTarget), Math.max(0, d - 0.5))

    const crossfadeSec = settings.crossfade !== false ? (settings.crossfadeDuration || 5) : 0
    if (d > 0 && (d - targetSeconds) > (crossfadeSec + 2)) {
      crossfadeStartedRef.current = false
    }

    try {
      h.seek(targetSeconds)
    } catch (e) {
      console.error('seek error:', e)
    }

    seekingTargetRef.current = {
      time: targetSeconds,
      until: Date.now() + 2500,
    }

    setLyrics(l => {
      if (!l.lines.length) return l
      const newLine = getActiveLine(l.lines, targetSeconds)
      return { ...l, activeLine: newLine }
    })

    setState(s => ({
      ...s,
      currentTime: targetSeconds,
      progress: value * 100,
    }))
  }, [settings.crossfade, settings.crossfadeDuration])

  const seekToTime = useCallback((seconds: number) => {
    const h = howlRef.current
    if (!h) return

    const d = h.duration() || stateRef.current.currentTrack?.duration || 0
    // CRITICAL: Clamp seconds so it NEVER seeks beyond duration (causes instant 'ended' skip)
    // and never exactly 0.000s on mobile (can trigger ended event / reset on mobile audio elements)
    const safeSeconds = Math.max(0.05, seconds)
    const clampedSeconds = d > 0
      ? Math.min(safeSeconds, Math.max(0.05, d - 0.6))
      : safeSeconds

    const crossfadeSec = settings.crossfade !== false ? (settings.crossfadeDuration || 5) : 0
    if (d > 0 && (d - clampedSeconds) > (crossfadeSec + 2)) {
      crossfadeStartedRef.current = false
    }

    try {
      h.seek(clampedSeconds)
      if (!h.playing()) {
        h.play()
        setState(s => ({ ...s, isPlaying: true }))
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(tick)
        }
      }
    } catch (e) {
      console.error('seekToTime error:', e)
    }

    seekingTargetRef.current = {
      time: clampedSeconds,
      until: Date.now() + 2500,
    }

    setLyrics(l => {
      if (!l.lines.length) return l
      const newLine = getActiveLine(l.lines, clampedSeconds)
      return { ...l, activeLine: newLine }
    })

    setState(s => ({
      ...s,
      currentTime: clampedSeconds,
      progress: d > 0 ? (clampedSeconds / d) * 100 : 0,
    }))
  }, [tick, settings.crossfade, settings.crossfadeDuration])

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
    const next = getNextTrack()
    if (!next) return
    const crossfadeSec = settings.crossfade !== false ? (settings.crossfadeDuration || 5) : 0
    if (settings.crossfade !== false && crossfadeSec > 0 && stateRef.current.isPlaying) {
      crossfadeStartedRef.current = true
      executeCrossfade(next, Math.min(2.5, crossfadeSec))
    } else {
      loadTrack(next)
    }
  }, [getNextTrack, executeCrossfade, loadTrack, settings.crossfade, settings.crossfadeDuration])

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

  // MPRIS Integration: Send state out
  useEffect(() => {
    if (window.melodix?.updateMprisState) {
      window.melodix.updateMprisState({
        isPlaying: state.isPlaying,
        track: state.currentTrack,
      })
    }
  }, [state.isPlaying, state.currentTrack])

  // MPRIS Integration: Listen to commands in
  useEffect(() => {
    if (window.melodix?.onMprisCommand) {
      return window.melodix.onMprisCommand((cmd, val) => {
        if (cmd === 'play') togglePlay()
        if (cmd === 'pause') togglePlay()
        if (cmd === 'playpause') togglePlay()
        if (cmd === 'next') skipNext()
        if (cmd === 'previous') skipPrev()
        if (cmd === 'seek' && typeof val === 'number') seek(val)
        if (cmd === 'seek-relative' && typeof val === 'number') {
          if (howlRef.current) {
            const h = howlRef.current
            const d = h.duration() || 1
            const cur = h.seek() as number
            seek(Math.max(0, Math.min(1, (cur + val) / d)))
          }
        }
      })
    }
  }, [togglePlay, skipNext, skipPrev, seek])

  return {
    state,
    setState,
    lyrics,
    setLyrics,
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
