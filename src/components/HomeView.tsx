import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Button, TextField, InputAdornment, IconButton,
  useTheme, useMediaQuery
} from '@mui/material'
import {
  Search, Favorite, LibraryMusic, PlayArrow, History,
  WbSunnyRounded, NightsStayRounded, BedtimeRounded, WbTwilightRounded
} from '@mui/icons-material'
import { Track } from '../types'
import { useSettings } from '../contexts/SettingsContext'
import { TrackCard } from './TrackCard'
import { detectMobilePlatform } from '../services/mobileBridge'

interface HomeViewProps {
  onPlay: (track: Track, results: Track[]) => void
  onNavigate: (view: 'search' | 'favorites' | 'playlists') => void
  onSearchQuery: (query: string) => void
}

export const HomeView: React.FC<HomeViewProps> = ({ onPlay, onNavigate, onSearchQuery }) => {
  const { t, settings } = useSettings()
  const theme = useTheme()
  const isMobileScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const isMobileDevice = isMobileScreen || detectMobilePlatform() !== 'desktop'
  const [username, setUsername] = useState('')
  const [quickInput, setQuickInput] = useState('')

  useEffect(() => {
    // Read real system username from Linux / Windows / macOS
    window.melodix?.getUsername?.().then(name => {
      if (name && name.toLowerCase() !== 'melodix' && name.toLowerCase() !== 'melodix user') {
        setUsername(name)
      }
    }).catch(() => {})
  }, [])

  const getTimeInfo = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) {
      return { greeting: t.goodMorning, icon: WbTwilightRounded, color: '#ffd54f', sub: 'Начните день с хорошей музыки' }
    }
    if (hour >= 12 && hour < 18) {
      return { greeting: t.goodAfternoon, icon: WbSunnyRounded, color: '#ffb74d', sub: t.recommended }
    }
    if (hour >= 18 && hour < 23) {
      return { greeting: t.goodEvening, icon: NightsStayRounded, color: '#ce93d8', sub: 'Время расслабиться и послушать музыку' }
    }
    return { greeting: t.goodNight, icon: BedtimeRounded, color: '#b39ddb', sub: 'Спокойная музыка для приятного отдыха' }
  }

  const timeInfo = getTimeInfo()
  const TimeIcon = timeInfo.icon

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (quickInput.trim()) {
      onSearchQuery(quickInput.trim())
    }
  }

  // Never display username on mobile devices ("убери юзер с главного экрана для мобильныйх телеофнов")
  const displayName = (!isMobileDevice && username)
    ? (username.charAt(0).toUpperCase() + username.slice(1))
    : ''

  return (
    <Box sx={{ p: { xs: 2.5, md: 4 }, pb: 16, maxWidth: 960, mx: 'auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Personalized Greeting Header with Time-of-day Icon ("Доброе утро", "Добрый день", etc.) */}
      <Box sx={{ mb: 3.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.5 }}>
          <TimeIcon sx={{ color: timeInfo.color, fontSize: { xs: 28, md: 34 } }} />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.65rem', md: '2.1rem' },
            }}
          >
            {displayName ? `${timeInfo.greeting}, ${displayName}` : timeInfo.greeting}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.65)', ml: { xs: 0.5, md: 5.5 } }}>
          {timeInfo.sub}
        </Typography>
      </Box>

      {/* Quick Search Bar directly on Home */}
      <Box component="form" onSubmit={handleSearchSubmit} sx={{ mb: 4, maxWidth: 580 }}>
        <TextField
          fullWidth
          size="small"
          value={quickInput}
          onChange={e => setQuickInput(e.target.value)}
          placeholder="Что хотите послушать сегодня?"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: 2.5,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
              '&:hover fieldset': { borderColor: 'primary.main' },
              '&.Mui-focused fieldset': { borderColor: 'primary.main' },
            },
          }}
        />
      </Box>

      {/* Recently Played */}
      {settings.recentlyPlayed.length > 0 && (
        <Box sx={{ mb: 4.5 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1.8 }}>
            <History sx={{ color: 'primary.light', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#ffffff' }}>
              {t.recentlyPlayed}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            {settings.recentlyPlayed.slice(0, 5).map(track => (
              <TrackCard
                key={track.id}
                track={track}
                onPlay={() => onPlay(track, settings.recentlyPlayed)}
                isActive={false}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Favorites Section */}
      <Box sx={{ mb: 4.5 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1.8 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Favorite sx={{ color: '#ff4081', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#ffffff' }}>
              {t.favorites}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              ({settings.favorites.length})
            </Typography>
          </Box>
          {settings.favorites.length > 0 && (
            <Button
              size="small"
              onClick={() => onNavigate('favorites')}
              sx={{ color: 'primary.light', textTransform: 'none', fontSize: '0.85rem' }}
            >
              Смотреть все →
            </Button>
          )}
        </Box>

        {settings.favorites.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            {settings.favorites.slice(0, 5).map(track => (
              <TrackCard
                key={track.id}
                track={track}
                onPlay={() => onPlay(track, settings.favorites)}
                isActive={false}
              />
            ))}
          </Box>
        ) : (
          <Box
            onClick={() => onNavigate('search')}
            sx={{
              p: 2.5,
              borderRadius: 2.5,
              border: '1px dashed rgba(255,255,255,0.12)',
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
            }}
          >
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              {t.emptyFavorites}. Нажмите сердечко на любом треке, чтобы добавить его в коллекцию!
            </Typography>
          </Box>
        )}
      </Box>

      {/* Playlists Quick Access */}
      <Box sx={{ mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1.8 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <LibraryMusic sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#ffffff' }}>
              {t.playlists}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              ({settings.playlists.length})
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => onNavigate('playlists')}
            sx={{ color: 'primary.light', textTransform: 'none', fontSize: '0.85rem' }}
          >
            Управление плейлистами →
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {settings.playlists.map(pl => (
            <Box
              key={pl.id}
              onClick={() => onNavigate('playlists')}
              sx={{
                px: 2,
                py: 1.2,
                borderRadius: 2.5,
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'all 0.18s ease',
                '&:hover': {
                  bgcolor: 'rgba(208, 188, 255, 0.15)',
                  transform: 'translateY(-1px)',
                }
              }}
            >
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ffffff' }}>
                  {pl.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mt: 0.2, display: 'block' }}>
                  {pl.tracks.length} {t.tracksCount}
                </Typography>
              </Box>

              {pl.tracks.length > 0 && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    onPlay(pl.tracks[0], pl.tracks)
                  }}
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#141218',
                    width: 28,
                    height: 28,
                    '&:hover': { bgcolor: 'primary.light' }
                  }}
                >
                  <PlayArrow sx={{ fontSize: 18 }} />
                </IconButton>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
