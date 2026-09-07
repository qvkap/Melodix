import React from 'react'
import { Box, Typography } from '@mui/material'
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
  const isIos = style === 'ios'

  const navItems = [
    { id: 'home' as AppView, label: 'Главная', icon: HomeRounded },
    { id: 'playlists' as AppView, label: 'Плейлисты', icon: QueueMusicRounded },
    { id: 'settings' as AppView, label: 'Настройки', icon: SettingsRounded },
  ]

  if (isIos) {
    // ─── iOS Style: True Apple Liquid Glass Floating Capsule ────────────────
    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1200,
          width: 'calc(100% - 28px)',
          maxWidth: 420,
          height: 68,
          borderRadius: '34px',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.04) 45%, rgba(255, 255, 255, 0.12) 100%), rgba(16, 20, 32, 0.45)',
          backdropFilter: 'blur(40px) saturate(220%) brightness(1.08)',
          WebkitBackdropFilter: 'blur(40px) saturate(220%) brightness(1.08)',
          border: '1px solid rgba(255, 255, 255, 0.28)',
          borderTop: '1.5px solid rgba(255, 255, 255, 0.72)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: `
            0 24px 48px -12px rgba(0, 0, 0, 0.75),
            0 8px 24px -4px rgba(0, 0, 0, 0.45),
            inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.75),
            inset 0 -1.5px 1px 0 rgba(255, 255, 255, 0.15),
            inset 0 0 20px 0 rgba(255, 255, 255, 0.06),
            0 0 35px -5px rgba(208, 188, 255, 0.18)
          `,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.2,
          userSelect: 'none',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 1,
            left: '16px',
            right: '16px',
            height: '46%',
            borderRadius: '32px 32px 100px 100px',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.03) 75%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 1,
          },
        }}
      >
        {/* Navigation Tabs (Left & Center) */}
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'space-around', position: 'relative', zIndex: 2 }}>
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
                  py: 0.7,
                  px: 1.8,
                  borderRadius: '24px',
                  bgcolor: isActive ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
                  border: isActive ? '1px solid rgba(255, 255, 255, 0.32)' : '1px solid transparent',
                  boxShadow: isActive
                    ? '0 4px 14px rgba(0, 0, 0, 0.25), inset 0 1px 1.5px rgba(255, 255, 255, 0.65)'
                    : 'none',
                  backdropFilter: isActive ? 'blur(16px)' : 'none',
                  WebkitBackdropFilter: isActive ? 'blur(16px)' : 'none',
                  transition: 'all 0.24s cubic-bezier(0.34, 1.4, 0.64, 1)',
                  position: 'relative',
                  '&:active': { transform: 'scale(0.92)' },
                }}
              >
                <Icon
                  sx={{
                    fontSize: 24,
                    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                    transition: 'color 0.2s ease, transform 0.2s ease',
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                    filter: isActive ? 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.6))' : 'none',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
                    mt: 0.2,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            )
          })}
        </Box>

        {/* Vertical subtle glass divider */}
        <Box sx={{ width: '1px', height: 28, background: 'linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.35), transparent)', mx: 0.8, zIndex: 2 }} />

        {/* Distinct Liquid Glass Search Orb at the end */}
        <Box
          onClick={() => onView('search')}
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 2,
            background: currentView === 'search'
              ? 'linear-gradient(135deg, rgba(208, 188, 255, 0.95) 0%, rgba(179, 136, 255, 0.9) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.2) 100%), rgba(20, 24, 40, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.55)',
            borderTop: '1.5px solid rgba(255, 255, 255, 0.9)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: currentView === 'search'
              ? '0 8px 24px rgba(208, 188, 255, 0.65), inset 0 2px 2px rgba(255, 255, 255, 0.95), inset 0 -2px 3px rgba(0, 0, 0, 0.3)'
              : '0 8px 20px rgba(0, 0, 0, 0.45), inset 0 2px 2px rgba(255, 255, 255, 0.85), inset 0 -1.5px 2px rgba(0, 0, 0, 0.25), 0 0 16px rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(24px) saturate(220%)',
            WebkitBackdropFilter: 'blur(24px) saturate(220%)',
            transition: 'all 0.24s cubic-bezier(0.34, 1.4, 0.64, 1)',
            flexShrink: 0,
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 2,
              left: '20%',
              width: '60%',
              height: '40%',
              borderRadius: '50%',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, transparent 100%)',
              pointerEvents: 'none',
            },
            '&:hover': { transform: 'scale(1.08)' },
            '&:active': { transform: 'scale(0.94)' },
          }}
        >
          <SearchRounded
            sx={{
              color: currentView === 'search' ? '#141218' : '#ffffff',
              fontSize: 25,
              position: 'relative',
              zIndex: 3,
            }}
          />
        </Box>
      </Box>
    )
  }

  // ─── Android Style: Material You M3 ──────────────────────────────────────
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
        bgcolor: 'rgba(20, 22, 32, 0.97)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        userSelect: 'none',
      }}
    >
      {/* M3 Navigation Tabs */}
      <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'space-around' }}>
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
              }}
            >
              {/* M3 Active Indicator Pill */}
              <Box
                sx={{
                  width: 58,
                  height: 32,
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isActive ? 'rgba(208, 188, 255, 0.22)' : 'transparent',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <Icon
                  sx={{
                    fontSize: 23,
                    color: isActive ? 'primary.light' : 'rgba(255, 255, 255, 0.65)',
                    transition: 'color 0.2s ease',
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                  mt: 0.4,
                  letterSpacing: '0.2px',
                }}
              >
                {item.label}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* M3 Search Floating Action Bubble at the end */}
      <Box
        onClick={() => onView('search')}
        sx={{
          width: 52,
          height: 52,
          borderRadius: '18px', // M3 squircle
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: currentView === 'search' ? 'primary.main' : 'rgba(208, 188, 255, 0.16)',
          color: currentView === 'search' ? '#141218' : 'primary.light',
          boxShadow: currentView === 'search'
            ? '0 6px 18px rgba(208, 188, 255, 0.4)'
            : '0 2px 8px rgba(0, 0, 0, 0.25)',
          transition: 'all 0.2s ease',
          ml: 1,
          flexShrink: 0,
          '&:hover': { transform: 'scale(1.06)' },
          '&:active': { transform: 'scale(0.95)' },
        }}
      >
        <SearchRounded sx={{ fontSize: 26 }} />
      </Box>
    </Box>
  )
}
