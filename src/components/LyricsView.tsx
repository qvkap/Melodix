import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Box, Typography, CircularProgress, IconButton, Tooltip, useTheme, useMediaQuery } from '@mui/material'
import {
  PlayArrow, Pause, SkipPrevious, SkipNext,
  Shuffle, Repeat, RepeatOne, MusicNote,
  KeyboardArrowDown, Favorite, FavoriteBorder
} from '@mui/icons-material'
import { Howl } from 'howler'
import { LrcLine, PlayerState } from '../types'
import { useSettings } from '../contexts/SettingsContext'
import { ExplicitBadge } from './ExplicitBadge'
import { MarqueeText } from './MarqueeText'
import { detectExplicit, formatTime } from '../utils'

interface LyricsViewProps {
  lines: LrcLine[]
  plain: string
  activeLine: number
  loading: boolean
  thumbnail: string
  title: string
  artist: string
  playerState: PlayerState
  howlRef: React.RefObject<Howl | null>
  onTogglePlay: () => void
  onNext: () => void
  onPrev: () => void
  onShuffle: () => void
  onRepeat: () => void
  onSeek: (value: number) => void
  onSeekToTime: (seconds: number) => void
  onCloseFullscreen: () => void
}

export const LyricsView: React.FC<LyricsViewProps> = ({
  lines,
  plain,
  activeLine,
  loading,
  thumbnail,
  title,
  artist,
  playerState,
  howlRef,
  onTogglePlay,
  onNext,
  onPrev,
  onShuffle,
  onRepeat,
  onSeek,
  onSeekToTime,
  onCloseFullscreen,
}) => {
  const { settings, isFavorite, toggleFavorite } = useSettings()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement>(null)
  const progressFillRef = useRef<HTMLDivElement>(null)
  const progressTrackRef = useRef<HTMLDivElement>(null)
  const hoverLabelRef = useRef<HTMLDivElement>(null)
  const hoverTimeRef = useRef<HTMLSpanElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Toggle lyrics display ("T" button):
  // On mobile phones: 2 exclusive modes (Mode 1: Only Artwork, Mode 2: Only Lyrics)
  // On desktop: side-by-side or centered
  const [showLyrics, setShowLyrics] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.search.includes('lyrics_only')) return true
      return window.innerWidth > 768
    }
    return true
  })

  const isFav = playerState.currentTrack ? isFavorite(playerState.currentTrack.id) : false
  const isExp = playerState.currentTrack ? (playerState.currentTrack.isExplicit || detectExplicit(playerState.currentTrack.title)) : false

  // Direct 60fps RAF loop for the progress bar
  useEffect(() => {
    let rafId: number
    let lastPct = -1
    const updateProgress = () => {
      const h = howlRef.current
      if (!isDragging && h && h.playing() && progressFillRef.current) {
        const t = h.seek()
        const d = h.duration() || 1
        if (typeof t === 'number' && isFinite(t)) {
          const pct = Math.min(Math.max((t / d) * 100, 0), 100)
          if (Math.abs(pct - lastPct) > 0.05) {
            lastPct = pct
            progressFillRef.current.style.width = `${pct}%`
          }
        }
      }
      rafId = requestAnimationFrame(updateProgress)
    }
    rafId = requestAnimationFrame(updateProgress)
    return () => cancelAnimationFrame(rafId)
  }, [isDragging, howlRef])

  // Center scroll active lyric line smoothly
  useEffect(() => {
    if (showLyrics && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [activeLine, showLyrics])

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressTrackRef.current) return
    const rect = progressTrackRef.current.getBoundingClientRect()
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${pct * 100}%`
    }
    onSeek(pct)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressTrackRef.current) return
    const rect = progressTrackRef.current.getBoundingClientRect()
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width)
    const pct = x / rect.width
    const d = howlRef.current?.duration() || 0
    if (hoverLabelRef.current) {
      hoverLabelRef.current.style.left = `${x}px`
      hoverLabelRef.current.style.opacity = '1'
    }
    if (hoverTimeRef.current) {
      hoverTimeRef.current.textContent = `${formatTime(pct * d)} / ${formatTime(d)}`
    }
  }

  const handleMouseLeave = () => {
    if (hoverLabelRef.current) {
      hoverLabelRef.current.style.opacity = '0'
    }
  }

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    handleProgressBarClick(e)

    const onMouseMove = (ev: MouseEvent) => {
      if (!progressTrackRef.current) return
      const rect = progressTrackRef.current.getBoundingClientRect()
      const pct = Math.min(Math.max((ev.clientX - rect.left) / rect.width, 0), 1)
      if (progressFillRef.current) {
        progressFillRef.current.style.width = `${pct * 100}%`
      }
    }

    const onMouseUp = (ev: MouseEvent) => {
      setIsDragging(false)
      if (progressTrackRef.current) {
        const rect = progressTrackRef.current.getBoundingClientRect()
        const pct = Math.min(Math.max((ev.clientX - rect.left) / rect.width, 0), 1)
        onSeek(pct)
      }
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const RepeatIcon = playerState.repeat === 'one' ? RepeatOne : Repeat

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 2,
        px: { xs: 2.5, md: 5, lg: 8 },
        py: 4,
        boxSizing: 'border-box',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Top Header: Close button on left, title in center (on mobile lyrics mode), and "T" toggle on right */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: { xs: 16, sm: 24, md: 32 },
          right: { xs: 16, sm: 24, md: 32 },
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Tooltip title="Свернуть плеер">
          <IconButton
            onClick={onCloseFullscreen}
            sx={{
              color: 'rgba(255, 255, 255, 0.85)',
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              borderRadius: 2.5,
              p: 1,
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.18)', transform: 'scale(1.05)' },
              transition: 'all 0.18s ease',
            }}
          >
            <KeyboardArrowDown sx={{ fontSize: 28 }} />
          </IconButton>
        </Tooltip>

        {/* Mobile Header Title when in Lyrics mode */}
        {isMobile && showLyrics && (
          <Box sx={{ minWidth: 0, px: 2, flex: 1, textAlign: 'center', overflow: 'hidden' }}>
            <MarqueeText
              text={title || ''}
              variant="subtitle2"
              centered
              sx={{ color: '#ffffff', fontWeight: 700 }}
            />
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', noWrap: true }}>
              {artist || '—'}
            </Typography>
          </Box>
        )}

        {/* Mobile "Т" Lyrics Toggle Button in Top Bar */}
        {isMobile && (
          <Tooltip title={showLyrics ? 'Показать только обложку' : 'Показать только текст'}>
            <IconButton
              onClick={() => setShowLyrics(prev => !prev)}
              sx={{
                color: showLyrics ? 'primary.main' : 'rgba(255, 255, 255, 0.8)',
                bgcolor: showLyrics ? 'rgba(208, 188, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                backdropFilter: 'blur(12px)',
                borderRadius: 2.5,
                width: 42,
                height: 42,
                transition: 'transform 0.15s ease, background 0.15s ease',
                '&:hover': { transform: 'scale(1.06)' },
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>
                Т
              </Typography>
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Main Flex Wrapper with animated layout shift */}
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: isMobile ? 'center' : (showLyrics ? 'space-between' : 'center'),
          px: isMobile ? 1.5 : { xs: 2, sm: 4, md: 6, lg: 10, xl: 14 },
          position: 'relative',
          transition: isMobile ? 'none' : 'all 0.35s ease',
        }}
      >
        {/* LEFT COLUMN: Album Art, Info & Controls (Mode 1: Only Album Art on mobile) */}
        <Box
          sx={{
            flex: isMobile ? '1 1 auto' : '0 0 auto',
            width: isMobile ? '100%' : { xs: 300, sm: 360, md: showLyrics ? 380 : 460, lg: showLyrics ? 420 : 500 },
            maxWidth: isMobile ? 420 : 'none',
            display: isMobile ? (showLyrics ? 'none' : 'flex') : 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: isMobile ? 'opacity 0.2s ease' : 'all 0.35s ease',
            mx: (isMobile || !showLyrics) ? 'auto' : 0,
          }}
        >
          {/* Rounded Album Art */}
          <Box
            sx={{
              width: '100%',
              maxWidth: { xs: 280, sm: 330, md: showLyrics ? 360 : 440, lg: showLyrics ? 400 : 480 },
              aspectRatio: '1 / 1',
              borderRadius: { xs: '14px', sm: '18px', md: '22px' },
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65), 0 6px 16px rgba(0, 0, 0, 0.35)',
              position: 'relative',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              transition: 'all 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)',
              transform: playerState.isPlaying ? 'scale(1)' : 'scale(0.96)',
            }}
          >
            {thumbnail ? (
              <Box
                component="img"
                src={thumbnail}
                alt={title}
                onError={(e: any) => {
                  e.target.style.display = 'none'
                }}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                }}
              >
                <MusicNote sx={{ fontSize: 90, color: 'rgba(255, 255, 255, 0.2)' }} />
              </Box>
            )}
          </Box>

          {/* Title and Artist */}
          <Box
            sx={{
              width: '100%',
              maxWidth: { xs: 280, sm: 330, md: showLyrics ? 360 : 440, lg: showLyrics ? 400 : 480 },
              textAlign: 'center',
              mt: 3,
              mb: 2,
              transition: 'all 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)',
            }}
          >
            <MarqueeText
              text={title || 'Nothing playing'}
              variant="h5"
              centered
              badge={isExp ? <ExplicitBadge size="medium" /> : undefined}
              sx={{
                fontWeight: 700,
                color: '#ffffff',
                fontSize: { xs: '1.25rem', sm: '1.45rem', md: '1.65rem' },
                letterSpacing: '-0.02em',
                textShadow: '0 2px 10px rgba(0,0,0,0.4)',
              }}
            />
            <Box sx={{ mt: 0.5 }}>
              <MarqueeText
                text={artist || '—'}
                variant="body1"
                centered
                sx={{
                  color: 'rgba(255, 255, 255, 0.65)',
                  fontWeight: 500,
                  fontSize: { xs: '0.95rem', sm: '1.05rem' },
                  textShadow: '0 1px 6px rgba(0,0,0,0.3)',
                }}
              />
            </Box>
          </Box>

          {/* Progress Bar */}
          <Box
            ref={progressTrackRef}
            onMouseDown={handleProgressBarMouseDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            sx={{
              width: '100%',
              maxWidth: { xs: 260, sm: 310, md: showLyrics ? 350 : 420, lg: showLyrics ? 390 : 460 },
              height: 24,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)',
            }}
          >
            {/* Hover preview tooltip */}
            <Box
              ref={hoverLabelRef}
              sx={{
                position: 'absolute',
                bottom: 22,
                left: 0,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                opacity: 0,
                transition: 'opacity 0.12s ease',
                bgcolor: 'rgba(20, 20, 25, 0.92)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                px: 1,
                py: 0.35,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
                zIndex: 20,
                whiteSpace: 'nowrap',
              }}
            >
              <Typography
                ref={hoverTimeRef}
                variant="caption"
                sx={{
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                0:00 / 0:00
              </Typography>
            </Box>

            <Box
              sx={{
                width: '100%',
                height: 4,
                borderRadius: 2,
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'height 0.15s ease',
                '&:hover': {
                  height: 6,
                },
              }}
            >
              <Box
                ref={progressFillRef}
                sx={{
                  height: '100%',
                  width: '0%',
                  bgcolor: '#ffffff',
                  borderRadius: 2,
                  boxShadow: '0 0 10px rgba(255, 255, 255, 0.7)',
                }}
              />
            </Box>
          </Box>

          {/* Controls with perfectly centered Play/Pause and balanced buttons on both sides */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.2,
              mt: 1,
              width: '100%',
              maxWidth: { xs: 280, sm: 330, md: showLyrics ? 360 : 440, lg: showLyrics ? 400 : 480 },
              mx: 'auto',
            }}
          >
            {/* Left 1: Favorite */}
            <Tooltip title={isFav ? 'Удалить из избранного' : 'В избранное'}>
              <IconButton
                onClick={() => playerState.currentTrack && toggleFavorite(playerState.currentTrack)}
                size="small"
                sx={{
                  width: 38,
                  height: 38,
                  color: isFav ? '#ff4081' : 'rgba(255,255,255,0.45)',
                  borderRadius: 2,
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    transform: 'scale(1.08)'
                  },
                  '&:active': { transform: 'scale(0.95)' },
                }}
              >
                {isFav ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* Left 2: Shuffle */}
            <Tooltip title={playerState.shuffle ? 'Перемешать: вкл' : 'Перемешать: выкл'}>
              <IconButton
                onClick={onShuffle}
                size="small"
                sx={{
                  width: 38,
                  height: 38,
                  color: playerState.shuffle ? 'primary.main' : 'rgba(255,255,255,0.45)',
                  borderRadius: 2,
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    transform: 'scale(1.08)'
                  },
                  '&:active': { transform: 'scale(0.95)' },
                }}
              >
                <Shuffle fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Left 3: Previous */}
            <Tooltip title="Предыдущий трек">
              <IconButton
                onClick={onPrev}
                sx={{
                  width: 44,
                  height: 44,
                  color: '#ffffff',
                  borderRadius: 2,
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    transform: 'scale(1.08)'
                  },
                  '&:active': { transform: 'scale(0.95)' },
                }}
              >
                <SkipPrevious sx={{ fontSize: 28 }} />
              </IconButton>
            </Tooltip>

            {/* CENTER: Play/Pause (Big center circle - dead center) */}
            <IconButton
              onClick={onTogglePlay}
              sx={{
                width: 52,
                height: 52,
                bgcolor: '#ffffff',
                color: '#0a0d14',
                borderRadius: '50%',
                boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
                transition: 'transform 0.15s ease, background 0.2s ease',
                '&:hover': {
                  bgcolor: '#f5f5f5',
                  transform: 'scale(1.08)',
                },
                '&:active': { transform: 'scale(0.95)' },
              }}
            >
              {playerState.isPlaying ? <Pause sx={{ fontSize: 30 }} /> : <PlayArrow sx={{ fontSize: 30 }} />}
            </IconButton>

            {/* Right 1: Next */}
            <Tooltip title="Следующий трек">
              <IconButton
                onClick={onNext}
                sx={{
                  width: 44,
                  height: 44,
                  color: '#ffffff',
                  borderRadius: 2,
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    transform: 'scale(1.08)'
                  },
                  '&:active': { transform: 'scale(0.95)' },
                }}
              >
                <SkipNext sx={{ fontSize: 28 }} />
              </IconButton>
            </Tooltip>

            {/* Right 2: Repeat */}
            <Tooltip title={playerState.repeat === 'none' ? 'Без повтора' : playerState.repeat === 'all' ? 'Повтор всех' : 'Повтор одного'}>
              <IconButton
                onClick={onRepeat}
                size="small"
                sx={{
                  width: 38,
                  height: 38,
                  color: playerState.repeat !== 'none' ? 'primary.main' : 'rgba(255,255,255,0.45)',
                  borderRadius: 2,
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    transform: 'scale(1.08)'
                  },
                  '&:active': { transform: 'scale(0.95)' },
                }}
              >
                <RepeatIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Right 3: "T" Lyrics Toggle */}
            <Tooltip title={showLyrics ? 'Скрыть текст песни (Т)' : 'Показать текст песни (Т)'}>
              <IconButton
                onClick={() => setShowLyrics(prev => !prev)}
                size="small"
                sx={{
                  color: showLyrics ? 'primary.main' : 'rgba(255, 255, 255, 0.5)',
                  bgcolor: showLyrics ? 'rgba(208, 188, 255, 0.16)' : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 2.5,
                  width: 38,
                  height: 38,
                  border: '1px solid',
                  borderColor: showLyrics ? 'rgba(208, 188, 255, 0.35)' : 'rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    color: '#ffffff',
                    bgcolor: showLyrics ? 'rgba(208, 188, 255, 0.26)' : 'rgba(255, 255, 255, 0.14)',
                    transform: 'scale(1.08)'
                  },
                  '&:active': { transform: 'scale(0.95)' },
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1 }}>
                  Т
                </Typography>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* RIGHT COLUMN: Lyrics (Mode 2: Only Lyrics on mobile) */}
        <Box
          ref={lyricsContainerRef}
          sx={{
            flex: showLyrics ? 1 : 0,
            width: isMobile ? (showLyrics ? '100%' : 0) : (showLyrics ? 'auto' : 0),
            minWidth: 0,
            maxWidth: showLyrics ? '100%' : 0,
            height: '100%',
            maxHeight: '100%',
            overflowY: showLyrics ? 'auto' : 'hidden',
            display: isMobile ? (showLyrics ? 'flex' : 'none') : 'flex',
            flexDirection: 'column',
            alignItems: isMobile ? 'center' : 'flex-start',
            justifyContent: (lines.length || plain) ? 'flex-start' : 'center',
            py: lines.length ? (isMobile ? '28vh' : '35vh') : (plain ? { xs: 4, md: 6 } : 0),
            // Balanced margins
            pl: isMobile ? 1.5 : { xs: 2, md: 4, lg: 6, xl: 8 },
            pr: isMobile ? 1.5 : { xs: 2, md: 3, lg: 5 },
            pb: isMobile ? '120px' : 0,
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
            opacity: showLyrics ? 1 : 0,
            transform: showLyrics ? 'translateX(0)' : (isMobile ? 'none' : 'translateX(60px)'),
            pointerEvents: showLyrics ? 'auto' : 'none',
            visibility: showLyrics ? 'visible' : 'hidden',
            transition: 'opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1), transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), flex 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), max-width 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), visibility 0.45s',
          }}
        >
          {loading ? (
            <Box display="flex" flexDirection="column" alignItems="center" width="100%" gap={2}>
              <CircularProgress size={38} sx={{ color: 'rgba(255,255,255,0.8)' }} />
              <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
                Поиск текста песни...
              </Typography>
            </Box>
          ) : lines.length > 0 ? (
            lines.map((line, i) => {
              const isActive = i === activeLine
              const dist = i - activeLine

              let opacity = 0.4
              let blurPx = 0
              let scale = 0.98

              if (isActive) {
                opacity = 1
                scale = 1
                blurPx = 0
              } else if (dist < 0) {
                const absDist = Math.abs(dist)
                opacity = Math.max(0.18, 0.5 - absDist * 0.08)
              } else {
                if (settings.lyricsBlurFuture) {
                  blurPx = Math.min(dist * 0.8, 4)
                  opacity = Math.max(0.2, 0.65 - dist * 0.08)
                } else {
                  opacity = Math.max(0.3, 0.65 - dist * 0.08)
                }
              }

              const isInstrumental = line.text.trim() === '•••' || line.text.trim() === '...'

              if (isInstrumental) {
                return (
                  <Box
                    key={i}
                    ref={isActive ? activeLineRef : null}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSeekToTime(line.time)
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                    sx={{
                      py: 1.6,
                      px: 2,
                      my: 0.5,
                      borderRadius: 3,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.4,
                      transition: 'all 0.35s cubic-bezier(0.2, 0, 0, 1)',
                      opacity: isActive ? 1 : 0.3,
                      filter: blurPx > 0 ? `blur(${blurPx}px)` : 'none',
                      bgcolor: isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                      '&:hover': {
                        opacity: 1,
                        filter: 'none',
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                  >
                    {[0, 1, 2].map(dotIdx => (
                      <Box
                        key={dotIdx}
                        sx={{
                          width: isActive ? 10 : 7,
                          height: isActive ? 10 : 7,
                          borderRadius: '50%',
                          bgcolor: isActive ? 'primary.light' : 'rgba(255, 255, 255, 0.6)',
                          boxShadow: isActive
                            ? '0 0 12px rgba(208, 188, 255, 0.9), 0 0 20px rgba(255, 255, 255, 0.7)'
                            : 'none',
                          animation: isActive
                            ? `pulseDot 1.4s infinite ease-in-out ${dotIdx * 0.22}s`
                            : 'none',
                          '@keyframes pulseDot': {
                            '0%, 100%': { transform: 'scale(0.85)', opacity: 0.4 },
                            '50%': { transform: 'scale(1.35)', opacity: 1 },
                          },
                          transition: 'all 0.3s ease',
                        }}
                      />
                    ))}
                  </Box>
                )
              }

              return (
                <Box
                  key={i}
                  ref={isActive ? activeLineRef : null}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSeekToTime(line.time)
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                  sx={{
                    py: 1,
                    px: 1.8,
                    borderRadius: 2,
                    cursor: 'pointer',
                    maxWidth: '100%',
                    width: isMobile ? '100%' : 'auto',
                    textAlign: isMobile ? 'center' : 'left',
                    transition: 'all 0.35s cubic-bezier(0.2, 0, 0, 1)',
                    opacity,
                    transform: `scale(${scale})`,
                    transformOrigin: isMobile ? 'center center' : 'left center',
                    filter: blurPx > 0 ? `blur(${blurPx}px)` : 'none',
                    '&:hover': {
                      opacity: 1,
                      filter: 'none',
                      bgcolor: 'rgba(255, 255, 255, 0.08)',
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                      fontSize: isActive
                        ? { xs: '1.55rem', sm: '1.85rem', md: '2.1rem' }
                        : { xs: '1.2rem', sm: '1.38rem', md: '1.55rem' },
                      fontWeight: isActive ? 700 : 600,
                      color: '#ffffff',
                      lineHeight: 1.35,
                      letterSpacing: '-0.02em',
                      textAlign: isMobile ? 'center' : 'left',
                      transition: 'all 0.35s cubic-bezier(0.2, 0, 0, 1)',
                      textShadow: isActive
                        ? '0 0 30px rgba(255, 255, 255, 0.6), 0 2px 10px rgba(0, 0, 0, 0.6)'
                        : '0 2px 8px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {line.text}
                  </Typography>
                </Box>
              )
            })
          ) : plain ? (
            <Box sx={{ width: '100%', maxWidth: 720, py: 2, textAlign: isMobile ? 'center' : 'left' }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.6,
                  py: 0.6,
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 2,
                  mb: 3,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <MusicNote sx={{ fontSize: 16, color: 'primary.light' }} />
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.85)', fontWeight: 600, letterSpacing: '0.03em' }}>
                  Текст песни (без таймингов)
                </Typography>
              </Box>
              <Typography
                sx={{
                  whiteSpace: 'pre-wrap',
                  color: 'rgba(255, 255, 255, 0.88)',
                  lineHeight: 2,
                  fontSize: { xs: '1.15rem', sm: '1.25rem', md: '1.4rem' },
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  textAlign: isMobile ? 'center' : 'left',
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
                }}
              >
                {plain}
              </Typography>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" alignItems="center" width="100%" gap={1}>
              <MusicNote sx={{ fontSize: 50, color: 'rgba(255,255,255,0.25)' }} />
              <Typography variant="subtitle1" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
                Текст песни не найден
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                Приятного прослушивания!
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Mobile Mode 2: Floating Bottom Playback Strip in Lyrics mode */}
      {isMobile && showLyrics && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 22,
            left: 16,
            right: 16,
            maxWidth: 400,
            mx: 'auto',
            zIndex: 10,
            bgcolor: 'rgba(28, 22, 42, 0.94)',
            backdropFilter: 'blur(28px)',
            border: 'none',
            borderRadius: 4,
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
          }}
        >
          <Tooltip title={isFav ? 'Удалить из избранного' : 'В избранное'}>
            <IconButton
              size="small"
              onClick={() => playerState.currentTrack && toggleFavorite(playerState.currentTrack)}
              sx={{ color: isFav ? '#ff4081' : 'rgba(255,255,255,0.5)' }}
            >
              {isFav ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
            </IconButton>
          </Tooltip>

          <IconButton onClick={onPrev} sx={{ color: '#ffffff' }}>
            <SkipPrevious />
          </IconButton>

          <IconButton
            onClick={onTogglePlay}
            sx={{
              width: 46,
              height: 46,
              bgcolor: 'primary.main',
              color: '#141218',
              boxShadow: '0 4px 14px rgba(208, 188, 255, 0.4)',
              '&:hover': { bgcolor: 'primary.light' },
              '&:active': { transform: 'scale(0.95)' },
            }}
          >
            {playerState.isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>

          <IconButton onClick={onNext} sx={{ color: '#ffffff' }}>
            <SkipNext />
          </IconButton>

          <Tooltip title="Показать только обложку">
            <IconButton
              onClick={() => setShowLyrics(false)}
              sx={{
                color: 'primary.main',
                bgcolor: 'rgba(208, 188, 255, 0.2)',
                border: 'none',
                borderRadius: 2.5,
                width: 38,
                height: 38,
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1 }}>
                Т
              </Typography>
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  )
}
