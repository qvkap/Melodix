import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Button, CircularProgress, IconButton, Tooltip
} from '@mui/material'
import {
  ArrowBack, PlayArrow, Shuffle, Person, MusicNote,
  Favorite, FavoriteBorder
} from '@mui/icons-material'
import { Track } from '../types'
import { TrackCard } from './TrackCard'
import { cleanTitle, extractArtistAndTitle, isPlayableTrack } from '../utils'
import { useSettings } from '../contexts/SettingsContext'

interface ArtistViewProps {
  artistName: string
  artistAvatar?: string
  onBack: () => void
  onPlay: (track: Track, results: Track[]) => void
}

export const ArtistView: React.FC<ArtistViewProps> = ({
  artistName, artistAvatar, onBack, onPlay
}) => {
  const { settings, t, isFavoriteArtist, toggleFavoriteArtist } = useSettings()
  const isFavArtist = isFavoriteArtist(artistName)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    // Query multiple terms in parallel to get full discography (25-30 tracks)
    Promise.all([
      window.melodix?.searchMusic?.(`${artistName} songs`),
      window.melodix?.searchMusic?.(`${artistName} official audio`),
    ])
      .then(([res1, res2]) => {
        if (!cancelled) {
          setLoading(false)
          const combined = [...(res1?.results || []), ...(res2?.results || [])]
          const seen = new Set<string>()

          const processed = combined
            .filter(tr => {
              if (!tr || seen.has(tr.id)) return false
              seen.add(tr.id)
              // Strict song filter: no playlists, full albums or mixes in artist view
              if (!isPlayableTrack(tr)) return false
              const lower = (tr.title || '').toLowerCase()
              if (lower.includes('playlist') || lower.includes('full album') || lower.includes('mix') || lower.includes('compilation')) {
                return false
              }
              if (tr.duration && tr.duration > 720) return false
              return true
            })
            .map(tr => {
              const { artist, title } = extractArtistAndTitle(tr.title, tr.artist)
              return {
                ...tr,
                artist: artist === 'Unknown Artist' ? artistName : artist,
                title: cleanTitle(title, settings.exclusionWords),
                thumbnail: tr.thumbnail?.startsWith('http')
                  ? tr.thumbnail
                  : `https://img.youtube.com/vi/${tr.id}/mqdefault.jpg`,
              }
            })

          setTracks(processed)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [artistName, settings.exclusionWords])

  const avatar = artistAvatar || (tracks[0]?.thumbnail || '')

  return (
    <Box sx={{ p: { xs: 2.5, md: 4 }, pb: 16, maxWidth: 960, mx: 'auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Back button */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={onBack}
          sx={{
            color: 'rgba(255, 255, 255, 0.75)',
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 2,
            px: 1.5,
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)', color: '#ffffff' }
          }}
        >
          Назад
        </Button>
      </Box>

      {/* Artist Profile Header Banner */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 3.5,
          p: { xs: 2.5, md: 4 },
          borderRadius: 3.5,
          bgcolor: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(20px)',
          mb: 4,
        }}
      >
        {/* Circular Artist Avatar */}
        <Box
          sx={{
            width: { xs: 90, sm: 130, md: 150 },
            height: { xs: 90, sm: 130, md: 150 },
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
            border: '2px solid rgba(255,255,255,0.1)',
            bgcolor: 'rgba(208,188,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {avatar ? (
            <Box
              component="img"
              src={avatar}
              alt={artistName}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Person sx={{ fontSize: 70, color: 'rgba(255,255,255,0.4)' }} />
          )}
        </Box>

        {/* Artist Name & Actions */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              color: 'primary.light',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              display: 'block',
              mb: 0.5,
            }}
          >
            Исполнитель
          </Typography>
          <Typography
            variant="h4"
            noWrap
            sx={{
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              mb: 2,
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.4rem' }
            }}
          >
            {artistName}
          </Typography>

          <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
            {tracks.length > 0 && (
              <>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={() => onPlay(tracks[0], tracks)}
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#141218',
                    fontWeight: 700,
                    borderRadius: 2.5,
                    px: 2.5,
                    '&:hover': { bgcolor: 'primary.light' }
                  }}
                >
                  Слушать
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Shuffle />}
                  onClick={() => {
                    const shuffled = [...tracks].sort(() => Math.random() - 0.5)
                    onPlay(shuffled[0], shuffled)
                  }}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    fontWeight: 600,
                    borderRadius: 2.5,
                    px: 2,
                    '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.06)' }
                  }}
                >
                  Вперемешку
                </Button>
              </>
            )}

            <Tooltip title={isFavArtist ? 'В избранном' : 'Добавить артиста в избранное'}>
              <IconButton
                onClick={() => toggleFavoriteArtist({ name: artistName, avatar })}
                sx={{
                  color: isFavArtist ? '#ff4081' : 'rgba(255,255,255,0.7)',
                  bgcolor: isFavArtist ? 'rgba(255, 64, 129, 0.15)' : 'rgba(255,255,255,0.08)',
                  borderRadius: 2.5,
                  p: 1.1,
                  '&:hover': {
                    bgcolor: isFavArtist ? 'rgba(255, 64, 129, 0.25)' : 'rgba(255,255,255,0.18)',
                    color: isFavArtist ? '#ff4081' : '#ffffff'
                  }
                }}
              >
                {isFavArtist ? <Favorite sx={{ fontSize: 22 }} /> : <FavoriteBorder sx={{ fontSize: 22 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Tracks Section */}
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#ffffff', mb: 2 }}>
          Популярные треки ({tracks.length})
        </Typography>

        {loading ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={8} gap={2}>
            <CircularProgress color="primary" size={36} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Загружаем треки {artistName}...
            </Typography>
          </Box>
        ) : tracks.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            {tracks.map(track => (
              <TrackCard
                key={track.id}
                track={track}
                onPlay={() => onPlay(track, tracks)}
                isActive={false}
              />
            ))}
          </Box>
        ) : (
          <Box py={6} textAlign="center">
            <Typography color="rgba(255,255,255,0.5)">
              Треки не найдены
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
