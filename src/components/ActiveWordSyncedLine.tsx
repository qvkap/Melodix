import React, { useRef, useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import { Howl } from 'howler'
import { LrcLine } from '../types'
import { useSettings } from '../contexts/SettingsContext'

interface ActiveWordSyncedLineProps {
  line: LrcLine
  howlRef: React.RefObject<Howl | null>
  isMobile: boolean
  onSeekToTime: (seconds: number) => void
  containerRef?: React.Ref<HTMLDivElement>
}

/**
 * Apple Music style word-by-word active lyric line component.
 * Uses high-performance RAF loop with direct DOM property updates to achieve
 * smooth 60fps karaoke gradient sweep and illumination without React re-render overhead.
 */
export const ActiveWordSyncedLine: React.FC<ActiveWordSyncedLineProps> = ({
  line,
  howlRef,
  isMobile,
  onSeekToTime,
  containerRef,
}) => {
  const { settings } = useSettings()
  const wordsRef = useRef<(HTMLSpanElement | null)[]>([])
  const rafRef = useRef<number>(0)
  const offsetRef = useRef(settings.lyricsSyncOffset || 0)
  offsetRef.current = settings.lyricsSyncOffset || 0

  useEffect(() => {
    const words = line.words || []
    if (words.length === 0) return

    let isRunning = true

    const updateWords = () => {
      if (!isRunning) return
      const h = howlRef.current
      if (h) {
        const rawT = h.seek()
        if (typeof rawT === 'number' && isFinite(rawT)) {
          // Compensate for calibrated latency / lead-in
          const t = rawT + offsetRef.current / 1000

          for (let i = 0; i < words.length; i++) {
            const w = words[i]
            const el = wordsRef.current[i]
            if (!el) continue

            if (t >= w.endTime) {
              // Word already voiced
              el.style.background = 'none'
              el.style.webkitBackgroundClip = 'unset'
              el.style.webkitTextFillColor = '#ffffff'
              el.style.opacity = '1'
              el.style.filter = 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.45)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5))'
              el.style.transform = 'scale(1)'
            } else if (t < w.startTime) {
              // Word upcoming in this active line
              el.style.background = 'none'
              el.style.webkitBackgroundClip = 'unset'
              el.style.webkitTextFillColor = 'rgba(255, 255, 255, 0.32)'
              el.style.opacity = '0.75'
              el.style.filter = 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))'
              el.style.transform = 'scale(1)'
            } else {
              // Currently sung word: Apple Music fluid gradient wipe!
              const dur = Math.max(0.01, w.endTime - w.startTime)
              const progress = Math.min(Math.max((t - w.startTime) / dur, 0), 1)
              const pct = progress * 100

              // Soft feathered gradient blend across glyphs (Apple Music style)
              const fillStart = Math.max(0, pct - 12).toFixed(1)
              const fillEnd = Math.min(100, pct + 6).toFixed(1)

              el.style.background = `linear-gradient(90deg, #ffffff 0%, #ffffff ${fillStart}%, rgba(255, 255, 255, 0.32) ${fillEnd}%, rgba(255, 255, 255, 0.32) 100%)`
              el.style.webkitBackgroundClip = 'text'
              el.style.webkitTextFillColor = 'transparent'
              el.style.opacity = '1'
              el.style.filter = `drop-shadow(0 0 ${12 + progress * 10}px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 24px rgba(208, 188, 255, 0.65))`
              
              // Subtle dynamic scale bounce for vocal presence
              const scale = 1 + Math.sin(progress * Math.PI) * 0.04
              el.style.transform = `scale(${scale.toFixed(3)})`
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(updateWords)
    }

    rafRef.current = requestAnimationFrame(updateWords)
    return () => {
      isRunning = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [line, howlRef])

  return (
    <Box
      ref={containerRef}
      onClick={(e) => {
        e.preventDefault()
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
        opacity: 1,
        transform: 'scale(1)',
        transformOrigin: isMobile ? 'center center' : 'left center',
        filter: 'none',
        '&:hover': {
          bgcolor: 'rgba(255, 255, 255, 0.08)',
        },
      }}
    >
      <Typography
        component="div"
        sx={{
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          fontSize: { xs: '1.55rem', sm: '1.85rem', md: '2.1rem' },
          fontWeight: 700,
          lineHeight: 1.35,
          letterSpacing: '-0.02em',
          textAlign: isMobile ? 'center' : 'left',
          wordBreak: 'break-word',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: isMobile ? 'center' : 'flex-start',
          alignItems: 'baseline',
          rowGap: 0.5,
        }}
      >
        {line.words && line.words.length > 0 ? (
          line.words.map((w, idx) => (
            <Box
              component="span"
              key={idx}
              ref={(el: HTMLSpanElement | null) => {
                wordsRef.current[idx] = el
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSeekToTime(w.startTime)
              }}
              sx={{
                display: 'inline-block',
                marginRight: '0.28em',
                cursor: 'pointer',
                transition: 'transform 0.12s ease-out, filter 0.12s ease-out',
                WebkitFontSmoothing: 'antialiased',
                '&:hover': {
                  opacity: 1,
                  filter: 'drop-shadow(0 0 14px rgba(255, 255, 255, 0.95)) !important',
                },
              }}
            >
              {w.text}
            </Box>
          ))
        ) : (
          <Box component="span" sx={{ color: '#ffffff' }}>
            {line.text}
          </Box>
        )}
      </Typography>
    </Box>
  )
}
