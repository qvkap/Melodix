import React, { useState, useRef, useEffect } from 'react'
import { Box, Typography, TypographyProps } from '@mui/material'

interface MarqueeTextProps extends TypographyProps {
  text: string
  centered?: boolean
  gap?: number
  badge?: React.ReactNode
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  centered = false,
  gap = 40,
  badge,
  sx,
  ...typographyProps
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [duration, setDuration] = useState(16)

  useEffect(() => {
    const updateOverflow = () => {
      if (containerRef.current && measureRef.current) {
        const cWidth = containerRef.current.clientWidth
        const tWidth = measureRef.current.offsetWidth
        const overflowing = tWidth > cWidth + 2
        setIsOverflowing(overflowing)
        if (overflowing) {
          // Comfortable floating speed (~25-30 pixels per second)
          const dynamicDuration = Math.max(12, Math.min(32, Math.round((tWidth + gap) / 28)))
          setDuration(dynamicDuration)
        }
      }
    }

    updateOverflow()
    const timer = setTimeout(updateOverflow, 120)
    window.addEventListener('resize', updateOverflow)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateOverflow)
    }
  }, [text, gap])

  return (
    <Box
      ref={containerRef}
      sx={{
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: centered && !isOverflowing ? 'center' : 'flex-start',
        maskImage: isOverflowing
          ? 'linear-gradient(90deg, transparent 0px, black 16px, black calc(100% - 16px), transparent 100%)'
          : 'none',
        WebkitMaskImage: isOverflowing
          ? 'linear-gradient(90deg, transparent 0px, black 16px, black calc(100% - 16px), transparent 100%)'
          : 'none',
      }}
    >
      {/* Hidden element to accurately measure unconstrained text width */}
      <Box
        ref={measureRef}
        component="span"
        aria-hidden="true"
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography {...typographyProps} sx={{ ...sx, whiteSpace: 'nowrap', display: 'inline' }}>
          {text}
        </Typography>
        {badge}
      </Box>

      {/* Render Marquee when overflowing */}
      {isOverflowing ? (
        <Box
          key={text}
          sx={{
            display: 'inline-flex',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            animation: `marqueeGlide ${duration}s linear infinite`,
            animationDelay: '1.2s',
            willChange: 'transform',
            '@keyframes marqueeGlide': {
              '0%': { transform: 'translateX(0%)' },
              '100%': { transform: 'translateX(-50%)' },
            },
            '&:hover': {
              animationPlayState: 'paused',
            },
          }}
        >
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', pr: `${gap}px`, gap: 1 }}>
            <Typography {...typographyProps} sx={{ ...sx, whiteSpace: 'nowrap' }}>
              {text}
            </Typography>
            {badge}
          </Box>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', pr: `${gap}px`, gap: 1 }}>
            <Typography {...typographyProps} sx={{ ...sx, whiteSpace: 'nowrap' }}>
              {text}
            </Typography>
            {badge}
          </Box>
        </Box>
      ) : (
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <Typography
            {...typographyProps}
            noWrap
            sx={{
              ...sx,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {text}
          </Typography>
          {badge}
        </Box>
      )}
    </Box>
  )
}
