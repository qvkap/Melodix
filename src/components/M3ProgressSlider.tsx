import React, { useRef, useEffect, useCallback, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { Howl } from 'howler'
import { formatTime } from '../utils'

interface M3ProgressSliderProps {
  howlRef: React.RefObject<Howl | null>
  onSeek: (value: number) => void   // 0–1
  disabled?: boolean
}

/**
 * M3 Expressive progress slider.
 * Updates the DOM directly via RAF — NO React state re-renders for smooth 60fps.
 * Shows a pill-shaped thumb with current time label on hover/drag.
 */
export const M3ProgressSlider: React.FC<M3ProgressSliderProps> = ({
  howlRef, onSeek, disabled,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const timeLabelRef = useRef<HTMLSpanElement>(null)
  const hoverLabelRef = useRef<HTMLDivElement>(null)
  const hoverTimeRef = useRef<HTMLSpanElement>(null)
  const isDragging = useRef(false)
  const isHovering = useRef(false)
  const rafRef = useRef<number>(0)

  // Direct-DOM RAF loop — bypasses React state for smooth updates
  useEffect(() => {
    let lastPct = -1
    const tick = () => {
      if (!isDragging.current) {
        const h = howlRef.current
        if (h && h.playing()) {
          const t = h.seek()
          const d = h.duration() || 1
          if (typeof t === 'number' && isFinite(t)) {
            const pct = Math.min(Math.max((t / d) * 100, 0), 100)
            if (Math.abs(pct - lastPct) > 0.05) {
              lastPct = pct
              if (fillRef.current) fillRef.current.style.width = `${pct}%`
              if (thumbRef.current) thumbRef.current.style.left = `${pct}%`
              if (timeLabelRef.current) timeLabelRef.current.textContent = formatTime(t)
            }
          }
        } else if (!howlRef.current) {
          // No howl loaded (track switching) — reset slider to 0 instantly
          if (lastPct !== 0) {
            lastPct = 0
            if (fillRef.current) fillRef.current.style.width = '0%'
            if (thumbRef.current) thumbRef.current.style.left = '0%'
            if (timeLabelRef.current) timeLabelRef.current.textContent = '0:00'
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const getPct = useCallback((clientX: number): number => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  }, [])

  const applyVisual = (pct: number) => {
    if (fillRef.current) fillRef.current.style.width = `${pct * 100}%`
    if (thumbRef.current) thumbRef.current.style.left = `${pct * 100}%`
    const h = howlRef.current
    const d = h?.duration() || 0
    if (timeLabelRef.current) timeLabelRef.current.textContent = formatTime(pct * d)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return
    e.preventDefault()
    isDragging.current = true

    const pct = getPct(e.clientX)
    applyVisual(pct)

    // Show thumb prominently
    if (thumbRef.current) {
      thumbRef.current.style.opacity = '1'
      thumbRef.current.style.transform = 'translate(-50%, -50%) scale(1.15)'
    }

    const onMove = (ev: MouseEvent) => {
      const p = getPct(ev.clientX)
      applyVisual(p)
      // Show hover time and total duration at cursor position
      if (hoverLabelRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = Math.min(Math.max(ev.clientX - rect.left, 0), rect.width)
        hoverLabelRef.current.style.left = `${x}px`
        hoverLabelRef.current.style.opacity = '1'
        const h = howlRef.current
        const d = h?.duration() || 0
        if (hoverTimeRef.current) hoverTimeRef.current.textContent = `${formatTime(p * d)} / ${formatTime(d)}`
      }
    }

    const onUp = (ev: MouseEvent) => {
      const p = getPct(ev.clientX)
      applyVisual(p)
      onSeek(p)
      isDragging.current = false
      if (!isHovering.current && thumbRef.current) {
        thumbRef.current.style.opacity = '0'
        thumbRef.current.style.transform = 'translate(-50%, -50%) scale(1)'
      }
      if (hoverLabelRef.current) hoverLabelRef.current.style.opacity = '0'
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || isDragging.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const p = getPct(e.clientX)
    if (hoverLabelRef.current) {
      hoverLabelRef.current.style.left = `${x}px`
      hoverLabelRef.current.style.opacity = '1'
    }
    const h = howlRef.current
    const d = h?.duration() || 0
    if (hoverTimeRef.current) hoverTimeRef.current.textContent = `${formatTime(p * d)} / ${formatTime(d)}`
  }

  const handleMouseEnter = () => {
    isHovering.current = true
    if (thumbRef.current) thumbRef.current.style.opacity = '1'
  }

  const handleMouseLeave = () => {
    isHovering.current = false
    if (!isDragging.current && thumbRef.current) {
      thumbRef.current.style.opacity = '0'
    }
    if (hoverLabelRef.current) hoverLabelRef.current.style.opacity = '0'
  }

  return (
    <Box
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{
        position: 'relative',
        height: 20,
        display: 'flex',
        alignItems: 'center',
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none',
        px: 0,
      }}
    >
      {/* Hover time tooltip */}
      <Box
        ref={hoverLabelRef}
        sx={{
          position: 'absolute',
          top: -28,
          transform: 'translateX(-50%)',
          bgcolor: 'rgba(208,188,255,0.15)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(208,188,255,0.25)',
          borderRadius: 2,
          px: 1,
          py: 0.25,
          opacity: 0,
          transition: 'opacity 0.15s',
          pointerEvents: 'none',
          zIndex: 10,
          whiteSpace: 'nowrap',
        }}
      >
        <Typography component="span" ref={hoverTimeRef} sx={{ fontSize: '0.7rem', color: 'primary.light' }}>
          0:00
        </Typography>
      </Box>

      {/* Track background */}
      <Box
        sx={{
          position: 'absolute',
          left: 0, right: 0,
          height: 4,
          bgcolor: 'rgba(208,188,255,0.15)',
          borderRadius: 99,
          overflow: 'visible',
          transition: 'height 0.15s',
          '.melodix-slider:hover &': { height: 5 },
        }}
      >
        {/* Fill */}
        <Box
          ref={fillRef}
          sx={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            bgcolor: 'primary.main',
            borderRadius: 99,
            width: '0%',
          }}
        />
      </Box>

      {/* M3 Expressive pill thumb */}
      <Box
        ref={thumbRef}
        sx={{
          position: 'absolute',
          left: '0%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          bgcolor: 'primary.main',
          borderRadius: 99,
          minWidth: 40,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 1,
          opacity: 0,
          transition: 'opacity 0.2s, transform 0.2s',
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(208,188,255,0.4)',
          zIndex: 2,
        }}
      >
        <Typography
          component="span"
          ref={timeLabelRef}
          sx={{
            fontSize: '0.6rem',
            fontWeight: 700,
            color: '#141218',
            lineHeight: 1,
            letterSpacing: 0.3,
            whiteSpace: 'nowrap',
          }}
        >
          0:00
        </Typography>
      </Box>
    </Box>
  )
}
