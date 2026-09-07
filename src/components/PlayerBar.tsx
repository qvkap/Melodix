import React, { useRef } from 'react'
import { Box, IconButton, Typography, Tooltip, Slider, useTheme, useMediaQuery } from '@mui/material'
import {
  PlayArrow, Pause, SkipPrevious, SkipNext,
  VolumeUp, VolumeOff, Shuffle, Repeat, RepeatOne,
  Favorite, FavoriteBorder, OpenInFull, KeyboardArrowUp
} from '@mui/icons-material'
import { Howl } from 'howler'
import { PlayerState } from '../types'
import { formatTime, cleanTitle, detectExplicit } from '../utils'
import { M3ProgressSlider } from './M3ProgressSlider'
import { useSettings } from '../contexts/SettingsContext'
import { ExplicitBadge } from './ExplicitBadge'
import { MarqueeText } from './MarqueeText'
import { detectMobilePlatform } from '../services/mobileBridge'

interface PlayerBarProps {
  state: PlayerState
  howlRef: React.RefObject<Howl | null>
  sidebarWidth: number
  bottomOffset?: number
  onTogglePlay: () => void
  onSeek: (v: number) => void
  onVolume: (v: number) => void
  onToggleMute: () => void
  onNext: () => void
  onPrev: () => void
  onShuffle: () => void
  onRepeat: () => void
  onOpenFullscreenLyrics: () => void
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  state,
  howlRef,
  sidebarWidth,
  bottomOffset = 0,
  onTogglePlay,
  onSeek,
  onVolume,
  onToggleMute,
  onNext,
  onPrev,
  onShuffle,
  onRepeat,
  onOpenFullscreenLyrics,
}) => {
  const { currentTrack, isPlaying, volume, isMuted, shuffle, repeat } = state
  const { settings, isFavorite, toggleFavorite } = useSettings()
  const theme = useTheme()
  const isMobileScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const isMobile = isMobileScreen || bottomOffset > 0
  const isAndroid = detectMobilePlatform() === 'android'

  const isFav = currentTrack ? isFavorite(currentTrack.id) : false
  const isExp = currentTrack ? (currentTrack.isExplicit || detectExplicit(currentTrack.title)) : false
  const displayTitle = currentTrack ? cleanTitle(currentTrack.title, settings.exclusionWords) : ''
  const RepeatIcon = repeat === 'one' ? RepeatOne : Repeat

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: isMobile ? (bottomOffset > 0 ? bottomOffset + 8 : 10) : bottomOffset,
        left: isMobile ? 10 : sidebarWidth,
        right: isMobile ? 10 : 0,
        maxWidth: isMobile ? 600 : 'none',
        mx: isMobile ? 'auto' : 0,
        zIndex: 1100,
        borderRadius: isMobile ? 3.5 : 0,
        background: isAndroid
          ? 'linear-gradient(135deg, rgba(36, 28, 50, 0.97) 0%, rgba(24, 18, 36, 0.98) 100%)'
          : isMobile
          ? 'linear-gradient(0deg, rgba(28, 30, 44, 0.97) 75%, rgba(20, 22, 34, 0.92) 100%)'
          : 'linear-gradient(0deg, rgba(12, 14, 20, 0.98) 75%, rgba(12, 14, 20, 0.75) 100%)',
        backdropFilter: 'blur(32px)',
        border: isMobile
          ? (isAndroid ? '1.5px solid rgba(208, 188, 255, 0.32)' : '1.5px solid rgba(255, 255, 255, 0.18)')
          : 'none',
        borderTop: isMobile
          ? (isAndroid ? '1.5px solid rgba(208, 188, 255, 0.4)' : '1.5px solid rgba(255, 255, 255, 0.22)')
          : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isMobile
          ? (isAndroid
              ? '0 10px 36px rgba(0, 0, 0, 0.7), 0 0 20px rgba(208, 188, 255, 0.15)'
              : '0 10px 36px rgba(0, 0, 0, 0.7)')
          : 'none',
        px: { xs: 1.5, md: 3 },
        pt: 0.6,
        pb: isMobile ? 1.2 : 1.8,
        transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.25s ease',
        pointerEvents: 'auto',
      }}
    >
      {/* M3 Expressive Progress Slider */}
      <Box sx={{ mb: 0.5, cursor: 'pointer' }} className="melodix-slider">
        <M3ProgressSlider
          howlRef={howlRef}
          onSeek={onSeek}
          disabled={!currentTrack}
        />
      </Box>

      {/* Time display */}
      <Box display="flex" justifyContent="space-between" sx={{ mb: 0.8, px: 0.5 }}>
        <TimeLabel howlRef={howlRef} side="current" />
        <TimeLabel howlRef={howlRef} side="duration" />
      </Box>

      {/* Bar Content: Track info | Controls | Volume & Fullscreen */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 2,
          width: '100%',
        }}
      >
        {/* Left: Track Info (clicking opens fullscreen lyrics) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifySelf: 'start',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          {currentTrack ? (
            <Box
              onClick={onOpenFullscreenLyrics}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                minWidth: 0,
                maxWidth: { xs: 200, sm: 260, md: 360 },
                cursor: 'pointer',
                p: 0.5,
                borderRadius: 2,
                transition: 'background 0.15s ease',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)' },
              }}
            >
              <Box
                component="img"
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                onError={(e: any) => {
                  e.target.src = `https://img.youtube.com/vi/${currentTrack.id}/mqdefault.jpg`
                }}
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: 2.5,
                  objectFit: 'cover',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}
              />
              <Box sx={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
                <MarqueeText
                  text={displayTitle}
                  variant="subtitle2"
                  badge={isExp ? <ExplicitBadge size="small" /> : undefined}
                  sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.92rem' }}
                />
                <MarqueeText
                  text={currentTrack.artist}
                  variant="caption"
                  sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block' }}
                />
              </Box>

              {/* Heart Button */}
              <Tooltip title={isFav ? 'Удалить из избранного' : 'В избранное'}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorite(currentTrack)
                  }}
                  sx={{ color: isFav ? '#ff4081' : 'rgba(255, 255, 255, 0.5)' }}
                >
                  {isFav ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Box sx={{ minHeight: 46 }} />
          )}
        </Box>

        {/* Center: Playback Controls (Strict mathematical center) */}
        <Box
          display="flex"
          alignItems="center"
          gap={1}
          sx={{
            justifyContent: 'center',
            justifySelf: 'center',
            pointerEvents: 'auto',
          }}
        >
          <Tooltip title={shuffle ? 'Перемешать: вкл' : 'Перемешать: выкл'}>
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                onShuffle()
              }}
              size="small"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                color: shuffle ? 'primary.main' : 'rgba(255, 255, 255, 0.45)'
              }}
            >
              <Shuffle fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Предыдущий трек">
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                onPrev()
              }}
              sx={{ color: '#ffffff', p: { xs: 0.8, sm: 1 } }}
            >
              <SkipPrevious fontSize={isMobileScreen ? 'medium' : 'large'} />
            </IconButton>
          </Tooltip>

          {/* Big Play/Pause Button (Themed for Android Material You) */}
          <IconButton
            onClick={(e) => {
              e.stopPropagation()
              onTogglePlay()
            }}
            sx={{
              width: isMobileScreen ? 44 : 48,
              height: isMobileScreen ? 44 : 48,
              bgcolor: isAndroid ? 'primary.main' : '#ffffff',
              color: isAndroid ? '#141218' : '#0a0d14',
              boxShadow: isAndroid
                ? '0 4px 14px rgba(208, 188, 255, 0.4)'
                : '0 4px 14px rgba(255, 255, 255, 0.25)',
              transition: 'transform 0.15s ease, background 0.2s ease',
              '&:hover': {
                bgcolor: isAndroid ? 'primary.light' : '#f5f5f5',
                transform: 'scale(1.08)',
              },
              '&:active': { transform: 'scale(0.95)' },
            }}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>

          <Tooltip title="Следующий трек">
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                onNext()
              }}
              sx={{ color: '#ffffff', p: { xs: 0.8, sm: 1 } }}
            >
              <SkipNext fontSize={isMobileScreen ? 'medium' : 'large'} />
            </IconButton>
          </Tooltip>

          <Tooltip title={repeat === 'none' ? 'Повтор: выкл' : repeat === 'all' ? 'Повтор всех' : 'Повтор одного'}>
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                onRepeat()
              }}
              size="small"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                color: repeat !== 'none' ? 'primary.main' : 'rgba(255, 255, 255, 0.45)'
              }}
            >
              <RepeatIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Right: Volume & Expand Fullscreen Lyrics Button */}
        <Box
          display="flex"
          alignItems="center"
          gap={{ xs: 0.5, sm: 1.5 }}
          sx={{
            minWidth: 0,
            justifyContent: 'flex-end',
            justifySelf: 'end',
          }}
        >
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
            <Tooltip title={isMuted ? 'Включить звук' : 'Без звука'}>
              <IconButton
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleMute()
                }}
                size="small"
                sx={{ color: 'rgba(255, 255, 255, 0.65)' }}
              >
                {isMuted ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Slider
              value={isMuted ? 0 : volume}
              min={0}
              max={1}
              step={0.01}
              onChange={(_e, v) => onVolume(v as number)}
              sx={{
                width: { xs: 70, sm: 90 },
                color: 'primary.main',
                '& .MuiSlider-thumb': { width: 12, height: 12 },
              }}
            />
          </Box>

          <Tooltip title="Развернуть текст и обложку">
            <IconButton
              onClick={onOpenFullscreenLyrics}
              size="small"
              sx={{
                color: isAndroid ? 'primary.light' : 'rgba(255, 255, 255, 0.9)',
                bgcolor: isAndroid ? 'rgba(208, 188, 255, 0.16)' : 'rgba(255, 255, 255, 0.08)',
                border: isAndroid ? '1px solid rgba(208, 188, 255, 0.25)' : 'none',
                p: { xs: 1, sm: 0.8 },
                '&:hover': { bgcolor: isAndroid ? 'rgba(208, 188, 255, 0.25)' : 'rgba(255, 255, 255, 0.15)' }
              }}
            >
              <KeyboardArrowUp fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  )
}

const TimeLabel: React.FC<{ howlRef: React.RefObject<Howl | null>; side: 'current' | 'duration' }> = ({
  howlRef, side,
}) => {
  const spanRef = useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    let raf: number
    let lastText = ''
    const tick = () => {
      const h = howlRef.current
      if (h && spanRef.current && h.playing()) {
        const t = h.seek()
        const d = h.duration() || 0
        if (typeof t === 'number' && isFinite(t)) {
          const newText = side === 'current' ? formatTime(t) : formatTime(d)
          if (newText !== lastText) {
            lastText = newText
            spanRef.current.textContent = newText
          }
        }
      } else if (!h && spanRef.current && lastText !== '0:00') {
        // Track unloaded — reset time display immediately
        lastText = '0:00'
        spanRef.current.textContent = '0:00'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [side, howlRef])

  return (
    <Typography
      component="span"
      ref={spanRef}
      sx={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.5)', fontVariantNumeric: 'tabular-nums' }}
    >
      0:00
    </Typography>
  )
}
