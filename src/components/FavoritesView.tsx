import React from 'react'
import { Box, Typography, Button } from '@mui/material'
import { Favorite, PlayArrow } from '@mui/icons-material'
import { Track } from '../types'
import { useSettings } from '../contexts/SettingsContext'
import { TrackCard } from './TrackCard'

interface FavoritesViewProps {
  onPlay: (track: Track, results: Track[]) => void
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({ onPlay }) => {
  const { t, settings } = useSettings()

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, pb: 16, maxWidth: 960, mx: 'auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 4,
              bgcolor: 'rgba(255, 64, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Favorite sx={{ color: '#ff4081', fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              {t.favorites}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5 }}>
              {settings.favorites.length} {t.tracksCount}
            </Typography>
          </Box>
        </Box>

        {settings.favorites.length > 0 && (
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={() => onPlay(settings.favorites[0], settings.favorites)}
            sx={{
              bgcolor: 'primary.main',
              color: '#141218',
              fontWeight: 700,
              borderRadius: 99,
              '&:hover': { bgcolor: 'primary.light' }
            }}
          >
            Воспроизвести всё
          </Button>
        )}
      </Box>

      {/* Tracks List */}
      {settings.favorites.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {settings.favorites.map(track => (
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
          sx={{
            py: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 2,
          }}
        >
          <Favorite sx={{ fontSize: 64, color: 'rgba(255,255,255,0.15)' }} />
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
            {t.emptyFavorites}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', maxWidth: 360 }}>
            Добавляйте любимые треки в избранное нажатием на сердечко в поиске или на плеере.
          </Typography>
        </Box>
      )}
    </Box>
  )
}
