import React, { useState } from 'react'
import { Box, Typography, Button, IconButton, Chip, Tooltip } from '@mui/material'
import { Favorite, FavoriteBorder, PlayArrow, Album as AlbumIcon, Person, MusicNote } from '@mui/icons-material'
import { Track, Album, FavoriteArtist } from '../types'
import { useSettings } from '../contexts/SettingsContext'
import { TrackCard } from './TrackCard'
import { AlbumModal } from './AlbumModal'
import { formatTrackCount } from '../utils'

interface FavoritesViewProps {
  onPlay: (track: Track, results: Track[]) => void
  onAddToQueue?: (tracks: Track[]) => void
  onSelectArtist?: (artistName: string, avatar?: string) => void
}

type TabType = 'tracks' | 'albums' | 'artists'

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  onPlay, onAddToQueue, onSelectArtist
}) => {
  const { t, settings, toggleFavoriteAlbum, toggleFavoriteArtist } = useSettings()
  const [activeTab, setActiveTab] = useState<TabType>('tracks')
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [albumModalOpen, setAlbumModalOpen] = useState(false)

  const favoriteTracks = settings.favorites || []
  const favoriteAlbums = settings.favoriteAlbums || []
  const favoriteArtists = settings.favoriteArtists || []

  const handleOpenAlbum = (album: Album) => {
    setSelectedAlbum(album)
    setAlbumModalOpen(true)
  }

  const getSubtitle = () => {
    if (activeTab === 'tracks') {
      return `${favoriteTracks.length} ${t.tracksCount}`
    }
    if (activeTab === 'albums') {
      return `${favoriteAlbums.length} ${favoriteAlbums.length === 1 ? 'альбом' : favoriteAlbums.length >= 2 && favoriteAlbums.length <= 4 ? 'альбома' : 'альбомов'}`
    }
    return `${favoriteArtists.length} ${favoriteArtists.length === 1 ? 'исполнитель' : favoriteArtists.length >= 2 && favoriteArtists.length <= 4 ? 'исполнителя' : 'исполнителей'}`
  }

  return (
    <Box sx={{ p: { xs: 2.5, sm: 3, md: 4 }, pb: 16, maxWidth: 960, mx: 'auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3.5, flexWrap: 'wrap', gap: 2 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 3.5,
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
              {getSubtitle()}
            </Typography>
          </Box>
        </Box>

        {activeTab === 'tracks' && favoriteTracks.length > 0 && (
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={() => onPlay(favoriteTracks[0], favoriteTracks)}
            sx={{
              bgcolor: 'primary.main',
              color: '#141218',
              fontWeight: 700,
              borderRadius: 99,
              px: 2.5,
              '&:hover': { bgcolor: 'primary.light' }
            }}
          >
            Воспроизвести всё
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3.5, overflowX: 'auto', pb: 0.5 }}>
        <Button
          onClick={() => setActiveTab('tracks')}
          sx={{
            borderRadius: 99,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.88rem',
            px: 2.2,
            py: 0.7,
            bgcolor: activeTab === 'tracks' ? 'primary.main' : 'rgba(255,255,255,0.06)',
            color: activeTab === 'tracks' ? '#141218' : 'rgba(255,255,255,0.7)',
            '&:hover': {
              bgcolor: activeTab === 'tracks' ? 'primary.light' : 'rgba(255,255,255,0.12)',
            }
          }}
        >
          Треки ({favoriteTracks.length})
        </Button>

        <Button
          onClick={() => setActiveTab('albums')}
          sx={{
            borderRadius: 99,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.88rem',
            px: 2.2,
            py: 0.7,
            bgcolor: activeTab === 'albums' ? 'primary.main' : 'rgba(255,255,255,0.06)',
            color: activeTab === 'albums' ? '#141218' : 'rgba(255,255,255,0.7)',
            '&:hover': {
              bgcolor: activeTab === 'albums' ? 'primary.light' : 'rgba(255,255,255,0.12)',
            }
          }}
        >
          Альбомы ({favoriteAlbums.length})
        </Button>

        <Button
          onClick={() => setActiveTab('artists')}
          sx={{
            borderRadius: 99,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.88rem',
            px: 2.2,
            py: 0.7,
            bgcolor: activeTab === 'artists' ? 'primary.main' : 'rgba(255,255,255,0.06)',
            color: activeTab === 'artists' ? '#141218' : 'rgba(255,255,255,0.7)',
            '&:hover': {
              bgcolor: activeTab === 'artists' ? 'primary.light' : 'rgba(255,255,255,0.12)',
            }
          }}
        >
          Исполнители ({favoriteArtists.length})
        </Button>
      </Box>

      {/* Tracks Tab */}
      {activeTab === 'tracks' && (
        favoriteTracks.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {favoriteTracks.map(track => (
              <TrackCard
                key={track.id}
                track={track}
                onPlay={() => onPlay(track, favoriteTracks)}
                isActive={false}
              />
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              py: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 2,
            }}
          >
            <Favorite sx={{ fontSize: 60, color: 'rgba(255,255,255,0.15)' }} />
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
              {t.emptyFavorites}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', maxWidth: 360 }}>
              Добавляйте любимые треки в избранное нажатием на сердечко в поиске или на плеере.
            </Typography>
          </Box>
        )
      )}

      {/* Albums Tab */}
      {activeTab === 'albums' && (
        favoriteAlbums.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
              },
              gap: { xs: 1.5, sm: 2 },
            }}
          >
            {favoriteAlbums.map(album => (
              <Box
                key={album.id}
                onClick={() => handleOpenAlbum(album)}
                sx={{
                  minWidth: 0,
                  width: '100%',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: 3.5,
                  bgcolor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  cursor: 'pointer',
                  transition: 'all 0.22s cubic-bezier(0.2, 0, 0, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': {
                    bgcolor: 'rgba(208, 188, 255, 0.12)',
                    borderColor: 'rgba(208, 188, 255, 0.35)',
                    transform: 'translateY(-3px)',
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.45)',
                    '& .album-cover-img': {
                      transform: 'scale(1.04)',
                    },
                    '& .album-play-btn': {
                      opacity: 1,
                      transform: 'scale(1)',
                    }
                  }
                }}
              >
                {/* Cover Artwork */}
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: 2.5,
                    overflow: 'hidden',
                    bgcolor: 'rgba(0,0,0,0.3)',
                    mb: 1.5,
                  }}
                >
                  <Box
                    component="img"
                    className="album-cover-img"
                    src={album.thumbnail}
                    alt={album.title}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.35s ease',
                    }}
                  />

                  {/* Play Overlay Button */}
                  <Box
                    className="album-play-btn"
                    sx={{
                      position: 'absolute',
                      bottom: 10,
                      right: 10,
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: '#141218',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
                      opacity: 0,
                      transform: 'scale(0.85)',
                      transition: 'all 0.2s cubic-bezier(0.34, 1.3, 0.64, 1)',
                    }}
                  >
                    <PlayArrow sx={{ fontSize: 26 }} />
                  </Box>
                </Box>

                {/* Album Info */}
                <Typography
                  variant="subtitle2"
                  noWrap
                  sx={{
                    fontWeight: 700,
                    color: '#ffffff',
                    fontSize: '0.92rem',
                    mb: 0.3,
                  }}
                >
                  {album.title}
                </Typography>

                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontWeight: 500,
                    display: 'block',
                    mb: 0.8,
                  }}
                >
                  {album.artist}
                </Typography>

                <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.8 }}>
                  <Chip
                    label={album.trackCount ? formatTrackCount(album.trackCount) : 'Альбом'}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      bgcolor: 'rgba(208, 188, 255, 0.16)',
                      color: 'primary.light',
                      borderRadius: 1.5,
                    }}
                  />

                  <Tooltip title="Удалить из избранного">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavoriteAlbum(album)
                      }}
                      sx={{
                        p: 0.5,
                        color: '#ff4081',
                        '&:hover': { bgcolor: 'rgba(255, 64, 129, 0.15)' }
                      }}
                    >
                      <Favorite sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              py: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 2,
            }}
          >
            <AlbumIcon sx={{ fontSize: 60, color: 'rgba(255,255,255,0.15)' }} />
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
              Нет избранных альбомов
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', maxWidth: 360 }}>
              Добавляйте любимые альбомы в избранное нажатием на сердечко в поиске или на странице альбома.
            </Typography>
          </Box>
        )
      )}

      {/* Artists Tab */}
      {activeTab === 'artists' && (
        favoriteArtists.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
              },
              gap: { xs: 1.5, sm: 2 },
            }}
          >
            {favoriteArtists.map(artist => (
              <Box
                key={artist.name}
                onClick={() => onSelectArtist?.(artist.name, artist.avatar)}
                sx={{
                  p: 2.5,
                  borderRadius: 3.5,
                  bgcolor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  cursor: onSelectArtist ? 'pointer' : 'default',
                  transition: 'all 0.22s cubic-bezier(0.2, 0, 0, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  position: 'relative',
                  '&:hover': {
                    bgcolor: 'rgba(208, 188, 255, 0.12)',
                    borderColor: 'rgba(208, 188, 255, 0.35)',
                    transform: 'translateY(-3px)',
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.45)',
                  }
                }}
              >
                {/* Heart Button in top right */}
                <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                  <Tooltip title="Удалить из избранного">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavoriteArtist(artist)
                      }}
                      sx={{
                        color: '#ff4081',
                        p: 0.6,
                        '&:hover': { bgcolor: 'rgba(255, 64, 129, 0.15)' }
                      }}
                    >
                      <Favorite sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Circular Avatar */}
                <Box
                  sx={{
                    width: { xs: 76, sm: 96 },
                    height: { xs: 76, sm: 96 },
                    borderRadius: '50%',
                    overflow: 'hidden',
                    mb: 1.8,
                    mt: 0.5,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    bgcolor: 'rgba(208,188,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {artist.avatar ? (
                    <Box
                      component="img"
                      src={artist.avatar}
                      alt={artist.name}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Person sx={{ fontSize: 48, color: 'rgba(255,255,255,0.4)' }} />
                  )}
                </Box>

                <Typography
                  variant="subtitle2"
                  noWrap
                  sx={{
                    fontWeight: 700,
                    color: '#ffffff',
                    maxWidth: '100%',
                    mb: 0.3,
                  }}
                >
                  {artist.name}
                </Typography>

                <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 600 }}>
                  Исполнитель
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              py: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 2,
            }}
          >
            <Person sx={{ fontSize: 60, color: 'rgba(255,255,255,0.15)' }} />
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
              Нет избранных исполнителей
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', maxWidth: 360 }}>
              Добавляйте любимых исполнителей в избранное на странице артиста или в результатах поиска.
            </Typography>
          </Box>
        )
      )}

      {/* Embedded Album Modal */}
      <AlbumModal
        album={selectedAlbum}
        open={albumModalOpen}
        onClose={() => setAlbumModalOpen(false)}
        onPlay={onPlay}
        onAddToQueue={onAddToQueue}
      />
    </Box>
  )
}
