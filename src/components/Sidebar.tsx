import React from 'react'
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography, Divider, IconButton, Tooltip
} from '@mui/material'
import {
  Home, Search, QueueMusic, Favorite, LibraryMusic, Settings, ChevronLeft
} from '@mui/icons-material'
import { Track } from '../types'
import { useSettings } from '../contexts/SettingsContext'
import { cleanTitle } from '../utils'

export const SIDEBAR_WIDTH = 230

export type AppView = 'home' | 'search' | 'queue' | 'favorites' | 'playlists' | 'settings' | 'artist'

interface SidebarProps {
  currentView: AppView
  onView: (v: AppView) => void
  currentTrack: Track | null
  isOpen: boolean
  onClose: () => void
  onOpenFullscreenLyrics: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView, onView, currentTrack, isOpen, onClose, onOpenFullscreenLyrics
}) => {
  const { t, settings } = useSettings()

  const navItems: { id: AppView; icon: React.ReactNode; label: string }[] = [
    { id: 'home',      icon: <Home />,         label: t.home      },
    { id: 'search',    icon: <Search />,       label: t.search    },
    { id: 'queue',     icon: <QueueMusic />,   label: t.queue     },
    { id: 'favorites', icon: <Favorite />,     label: t.favorites },
    { id: 'playlists', icon: <LibraryMusic />, label: t.playlists },
    { id: 'settings',  icon: <Settings />,     label: t.settings  },
  ]

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={isOpen}
      sx={{
        width: isOpen ? SIDEBAR_WIDTH : 0,
        flexShrink: 0,
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTH,
          boxSizing: 'border-box',
          bgcolor: 'rgba(16, 18, 26, 0.96)',
          backdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          top: '42px',
          height: 'calc(100% - 42px)',
          zIndex: 1300,
          transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }}
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header with quick collapse button */}
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, px: 0.5 }}>
          <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 1 }}>
            МЕНЮ
          </Typography>
          <Tooltip title="Скрыть меню">
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' } }}
            >
              <ChevronLeft fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Now Playing Mini Widget */}
        {currentTrack && (
          <Box
            onClick={onOpenFullscreenLyrics}
            sx={{
              p: 1.2,
              borderRadius: 2.5,
              bgcolor: 'rgba(208,188,255,0.1)',
              mb: 2,
              cursor: 'pointer',
              border: '1px solid rgba(208,188,255,0.2)',
              transition: 'all 0.18s ease',
              '&:hover': {
                bgcolor: 'rgba(208,188,255,0.18)',
                transform: 'translateY(-1px)',
              },
            }}
          >
            <Box display="flex" alignItems="center" gap={1.2}>
              <Box
                component="img"
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                onError={(e: any) => {
                  e.target.src = `https://img.youtube.com/vi/${currentTrack.id}/mqdefault.jpg`
                }}
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 1.5,
                  objectFit: 'cover',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)'
                }}
              />
              <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ color: 'primary.light', display: 'block', fontWeight: 700, letterSpacing: 0.5, fontSize: '0.7rem' }}
                >
                  {t.nowPlaying.toUpperCase()}
                </Typography>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ color: '#ffffff', fontWeight: 600, fontSize: '0.82rem' }}
                >
                  {cleanTitle(currentTrack.title, settings.exclusionWords)}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Navigation Items */}
        <List disablePadding sx={{ flex: 1 }}>
          {navItems.map(nav => {
            const isSelected = currentView === nav.id
            return (
              <ListItemButton
                key={nav.id}
                selected={isSelected}
                onClick={() => onView(nav.id)}
                sx={{
                  borderRadius: 2.5,
                  mb: 0.6,
                  py: 1,
                  px: 1.8,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(208, 188, 255, 0.16)',
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                    '& .MuiListItemText-primary': { color: '#ffffff', fontWeight: 700 },
                  },
                  '&:hover': {
                    bgcolor: isSelected ? 'rgba(208, 188, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: isSelected ? 'primary.main' : 'rgba(255,255,255,0.6)' }}>
                  {nav.icon}
                </ListItemIcon>
                <ListItemText
                  primary={nav.label}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.8)',
                    fontSize: '0.9rem',
                  }}
                />
              </ListItemButton>
            )
          })}
        </List>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 1.5 }} />

        <Typography
          variant="caption"
          sx={{ color: 'rgba(255, 255, 255, 0.35)', textAlign: 'center', pb: 0.5, letterSpacing: 1, fontWeight: 700 }}
        >
          MELODIX BETA 0.1
        </Typography>
      </Box>
    </Drawer>
  )
}
