import React from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import {
  HomeRounded,
  QueueMusicRounded,
  SettingsRounded,
  SearchRounded,
} from '@mui/icons-material'
import { AppView } from './Sidebar'

export type MobileBarStyle = 'ios' | 'android'

interface MobileBottomBarProps {
  currentView: AppView
  onView: (view: AppView) => void
  style?: MobileBarStyle
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  currentView,
  onView,
  style = 'android',
}) => {
  const theme = useTheme()
  const isIos = style === 'ios'

  const navItems = [
    { id: 'home' as AppView, label: 'Главная', icon: HomeRounded },
    { id: 'search' as AppView, label: 'Поиск', icon: SearchRounded },
    { id: 'playlists' as AppView, label: 'Плейлисты', icon: QueueMusicRounded },
    { id: 'settings' as AppView, label: 'Настройки', icon: SettingsRounded },
  ]

  if (isIos) {
    // ─── iOS 18 Authentic Apple Liquid Glass Floating Capsule ───────────────
    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1200,
          width: 'calc(100% - 32px)',
          maxWidth: 420,
          height: 64,
          borderRadius: '32px',
          bgcolor: 'rgba(28, 28, 34, 0.68)',
          backdropFilter: 'blur(35px) saturate(210%) brightness(1.05)',
          WebkitBackdropFilter: 'blur(35px) saturate(210%) brightness(1.05)',
          border: '0.5px solid rgba(255, 255, 255, 0.22)',
          boxShadow: `
            0 16px 40px -8px rgba(0, 0, 0, 0.55),
            0 6px 16px -4px rgba(0, 0, 0, 0.35),
            inset 0 1px 0.5px rgba(255, 255, 255, 0.4),
            inset 0 -0.5px 0.5px rgba(0, 0, 0, 0.35)
          `,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          px: 1,
          userSelect: 'none',
        }}
      >
        {navItems.map(item => {
          const isActive = currentView === item.id
          const Icon = item.icon
          const activeColor = theme.palette.primary.main || '#d0bcff'

          return (
            <Box
              key={item.id}
              onClick={() => onView(item.id)}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                py: 0.6,
                transition: 'transform 0.15s ease',
                '&:active': { transform: 'scale(0.92)' },
              }}
            >
              <Icon
                sx={{
                  fontSize: 25,
                  color: isActive ? activeColor : 'rgba(255, 255, 255, 0.55)',
                  transition: 'color 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.3, 0.64, 1)',
                  transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  filter: isActive ? `drop-shadow(0 2px 8px ${activeColor}66)` : 'none',
                }}
              />
              <Typography
                sx={{
                  fontSize: '0.66rem',
                  fontWeight: isActive ? 600 : 500,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
                  color: isActive ? activeColor : 'rgba(255, 255, 255, 0.55)',
                  mt: 0.3,
                  letterSpacing: '-0.01em',
                  transition: 'color 0.2s ease',
                }}
              >
                {item.label}
              </Typography>
            </Box>
          )
        })}
      </Box>
    )
  }

  // ─── Android Material You (M3) with Dynamic System Color ─────────────────
  const primaryColor = theme.palette.primary.main || '#d0bcff'
  const primaryLight = theme.palette.primary.light || '#eaddff'

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        height: 'calc(76px + env(safe-area-inset-bottom, 0px))',
        pb: 'env(safe-area-inset-bottom, 0px)',
        bgcolor: `color-mix(in srgb, ${primaryColor} 9%, #15131b)`,
        borderTop: '1px solid rgba(255, 255, 255, 0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        px: 1.5,
        userSelect: 'none',
      }}
    >
      {navItems.map(item => {
        const isActive = currentView === item.id
        const Icon = item.icon

        return (
          <Box
            key={item.id}
            onClick={() => onView(item.id)}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flex: 1,
              py: 0.5,
              transition: 'transform 0.12s ease',
              '&:active': { transform: 'scale(0.96)' },
            }}
          >
            {/* M3 Dynamic Color Active Indicator Pill */}
            <Box
              sx={{
                width: 64,
                height: 32,
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: isActive
                  ? `color-mix(in srgb, ${primaryColor} 26%, transparent)`
                  : 'transparent',
                transition: 'background-color 0.22s cubic-bezier(0.2, 0, 0, 1)',
              }}
            >
              <Icon
                sx={{
                  fontSize: 24,
                  color: isActive ? primaryLight : 'rgba(255, 255, 255, 0.6)',
                  transition: 'color 0.2s ease',
                }}
              />
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.72rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? theme.palette.text.primary : 'rgba(255, 255, 255, 0.6)',
                mt: 0.4,
                letterSpacing: '0.2px',
                transition: 'color 0.2s ease',
              }}
            >
              {item.label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
