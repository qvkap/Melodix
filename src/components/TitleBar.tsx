import React from 'react'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import {
  MinimizeRounded, CropSquare, Close, GraphicEq, Menu as MenuIcon
} from '@mui/icons-material'

interface TitleBarProps {
  onToggleSidebar: () => void
}

export const TitleBar: React.FC<TitleBarProps> = ({ onToggleSidebar }) => {
  return (
    <Box
      sx={{
        height: 42,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1.5,
        WebkitAppRegion: 'drag',
        bgcolor: 'rgba(10, 13, 20, 0.45)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1400, // Highest z-index: NEVER blocked by drawers or pages!
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Left: Sidebar toggle (3 полоски) + Logo */}
      <Box display="flex" alignItems="center" gap={1} sx={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' }}>
        <Tooltip title="Скрыть/показать меню (☰)">
          <IconButton
            size="small"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleSidebar()
            }}
            sx={{
              color: '#ffffff',
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 2,
              p: 0.7,
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                transform: 'scale(1.05)'
              },
              transition: 'all 0.15s ease',
            }}
          >
            <MenuIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        <Box display="flex" alignItems="center" gap={1} sx={{ userSelect: 'none', ml: 0.5 }}>
          <Box
            component="img"
            src="./icon.png"
            onError={(e: any) => {
              e.currentTarget.src = '/icon.png'
            }}
            sx={{ width: 22, height: 22, borderRadius: 1 }}
          />
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 800,
              letterSpacing: 1.2,
              color: '#ffffff',
              fontSize: '0.82rem'
            }}
          >
            MELODIX
          </Typography>
          <Typography
            sx={{
              fontSize: '0.62rem',
              fontWeight: 700,
              color: 'primary.main',
              bgcolor: 'rgba(208, 188, 255, 0.12)',
              px: 0.6,
              py: 0.1,
              borderRadius: 1,
              letterSpacing: 0.8,
            }}
          >
            BETA 0.1
          </Typography>
        </Box>
      </Box>

      {/* Right: Window Controls */}
      <Box display="flex" gap={0.5} sx={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' }}>
        <Tooltip title="Свернуть">
          <IconButton
            size="small"
            onClick={() => window.melodix?.minimize?.()}
            sx={{ color: 'rgba(255, 255, 255, 0.65)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <MinimizeRounded fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Развернуть">
          <IconButton
            size="small"
            onClick={() => window.melodix?.maximize?.()}
            sx={{ color: 'rgba(255, 255, 255, 0.65)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <CropSquare fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Закрыть">
          <IconButton
            size="small"
            onClick={() => window.melodix?.close?.()}
            sx={{ color: 'rgba(255, 255, 255, 0.65)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(244,67,54,0.85)', color: '#ffffff' } }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
