import React, { useRef } from 'react'
import { Box, IconButton, Typography, Tooltip, Slider } from '@mui/material'
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

interface PlayerBarProps {
  state: PlayerState
  howlRef: React.RefObject<Howl | null>
  sidebarWidth: number
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

  const isFav = currentTrack ? isFavorite(currentTrack.id) : false
  const isExp = currentTrack ? (currentTrack.isExplicit || detectExplicit(currentTrack.title)) : false
  const displayTitle = currentTrack ? cleanTitle(currentTrack.title, settings.exclusionWords) : ''
  const RepeatIcon = repeat === 'one' ? RepeatOne : Repeat

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: sidebarWidth,
        right: 0,
        zIndex: 100,
        background: 'linear-gradient(0deg, rgba(12, 14, 20, 0.98) 75%, rgba(12, 14, 20, 0.75) 100%)',
        backdropFilter: 'blur(30px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        px: { xs: 2, md: 3 },
        pt: 0.8,
        pb: 1.8,
        transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
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
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
        {/* Left: Track Info (clicking opens fullscreen lyrics) */}
        <Box
          onClick={onOpenFullscreenLyrics}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minWidth: 200,
            maxWidth: 320,
            cursor: 'pointer',
            p: 0.5,
            borderRadius: 2,
            transition: 'background 0.15s ease',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)' },
          }}
        >
          {currentTrack && (
            <>
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
                <Box display="flex" alignItems="center" gap={0.8}>
                  <Typography
                    variant="subtitle2"
                    noWrap
                    sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.92rem' }}
                  >
                    {displayTitle}
                  </Typography>
                  {isExp && <ExplicitBadge size="small" />}
                </Box>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block' }}
                >
                  {currentTrack.artist}
                </Typography>
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
            </>
          )}
        </Box>

        {/* Center: Playback Controls */}
        <Box
          display="flex"
          alignItems="center"
          gap={1}
          sx={{ justifyContent: 'center', pointerEvents: 'auto' }}
        >
          <Tooltip title={shuffle ? 'Перемешать: вкл' : 'Перемешать: выкл'}>
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                onShuffle()
              }}
              size="small"
              sx={{ color: shuffle ? 'primary.main' : 'rgba(255, 255, 255, 0.45)' }}
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
              sx={{ color: '#ffffff' }}
            >
              <SkipPrevious />
            </IconButton>
          </Tooltip>

          {/* Big Play/Pause Button */}
          <IconButton
            onClick={(e) => {
              e.stopPropagation()
              onTogglePlay()
            }}
            sx={{
              width: 48,
              height: 48,
              bgcolor: '#ffffff',
              color: '#0a0d14',
              boxShadow: '0 4px 14px rgba(255, 255, 255, 0.25)',
              transition: 'transform 0.15s ease, background 0.2s ease',
              '&:hover': {
                bgcolor: '#f5f5f5',
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
              sx={{ color: '#ffffff' }}
            >
              <SkipNext />
            </IconButton>
          </Tooltip>

          <Tooltip title={repeat === 'none' ? 'Повтор: выкл' : repeat === 'all' ? 'Повтор всех' : 'Повтор одного'}>
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                onRepeat()
              }}
              size="small"
              sx={{ color: repeat !== 'none' ? 'primary.main' : 'rgba(255, 255, 255, 0.45)' }}
            >
              <RepeatIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Right: Volume & Expand Fullscreen Lyrics Button */}
        <Box display="flex" alignItems="center" gap={1.5} sx={{ minWidth: 200, justifyContent: 'flex-end' }}>
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
              width: 90,
              color: 'primary.main',
              '& .MuiSlider-thumb': { width: 12, height: 12 },
            }}
          />

          <Tooltip title="Развернуть текст и обложку">
            <IconButton
              onClick={onOpenFullscreenLyrics}
              size="small"
              sx={{
                color: 'rgba(255, 255, 255, 0.8)',
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)' }
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
