import React from 'react'
import { Box, Typography } from '@mui/material'

interface ExplicitBadgeProps {
  size?: 'small' | 'medium'
}

export const ExplicitBadge: React.FC<ExplicitBadgeProps> = ({ size = 'small' }) => {
  const isSmall = size === 'small'

  return (
    <Box
      component="span"
      title="Explicit Content (18+)"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(255, 255, 255, 0.18)',
        color: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '3px',
        px: isSmall ? '4px' : '6px',
        py: isSmall ? '1px' : '2px',
        fontSize: isSmall ? '0.65rem' : '0.75rem',
        fontWeight: 800,
        letterSpacing: '0.04em',
        lineHeight: 1,
        userSelect: 'none',
        verticalAlign: 'middle',
        flexShrink: 0,
        backdropFilter: 'blur(4px)',
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: 'inherit',
          fontWeight: 'inherit',
          lineHeight: 'inherit',
          color: 'inherit',
        }}
      >
        E
      </Typography>
    </Box>
  )
}
