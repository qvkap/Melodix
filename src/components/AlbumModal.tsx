import React, { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, Box, Typography, IconButton, Button,
  CircularProgress, Tooltip, Divider
} from '@mui/material'
import {
  Close, PlayArrow, QueueMusic, AccessTime, MusicNote,
  Favorite, FavoriteBorder
} from '@mui/icons-material'
import { Album, Track } from '../types'
import { cleanTitle, extractArtistAndTitle, formatTime, detectExplicit, formatTrackCount } from '../utils'
import { useSettings } from '../contexts/SettingsContext'
import { ExplicitBadge } from './ExplicitBadge'

interface AlbumModalProps {
  album: Album | null
  open: boolean
  onClose: () => void
  onPlay: (track: Track, results: Track[]) => void
  onAddToQueue?: (tracks: Track[]) => void
  onTracksLoaded?: (albumId: string, count: number) => void
}

export const AlbumModal: React.FC<AlbumModalProps> = ({
  album, open, onClose, onPlay, onAddToQueue, onTracksLoaded
}) => {
  const { settings, isFavorite, toggleFavorite, isFavoriteAlbum, toggleFavoriteAlbum } = useSettings()
  const isFavAlbum = album ? isFavoriteAlbum(album.id) : false
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !album) {
      setTracks([])
      setError('')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    window.melodix?.getAlbumTracks?.(album.id || album.url || '')
      .then(res => {
        if (cancelled) return
        setLoading(false)
        if (res?.success && res.tracks && res.tracks.length > 0) {
          const processed: Track[] = res.tracks.map(tr => {
            const { artist, title } = extractArtistAndTitle(tr.title, tr.artist || album.artist)
            return {
              ...tr,
              artist: artist || album.artist,
              title: cleanTitle(title, settings.exclusionWords),
              thumbnail: tr.thumbnail || album.thumbnail,
              isExplicit: detectExplicit(title),
            }
          })
          setTracks(processed)
          if (onTracksLoaded && album?.id) {
            onTracksLoaded(album.id, processed.length)
          }
        } else {
          setError(res?.error || 'Не удалось загрузить треки альбома')
        }
      })
      .catch(err => {
        if (cancelled) return
        setLoading(false)
        setError(err?.message || 'Ошибка загрузки треков')
      })

    return () => {
      cancelled = true
    }
  }, [open, album, settings.exclusionWords])

  if (!album) return null

  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0)

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      onPlay(tracks[0], tracks)
      onClose()
    }
  }

  const handleTrackClick = (track: Track) => {
    onPlay(track, tracks)
    onClose()
  }

  const handleQueueAll = () => {
    if (tracks.length > 0 && onAddToQueue) {
      onAddToQueue(tracks)
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(22, 24, 34, 0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 4,
          color: '#ffffff',
          maxHeight: '85vh',
          boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      {/* Top Bar with Close */}
      <Box sx={{ position: 'absolute', top: 14, right: 14, zIndex: 10 }}>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'rgba(255,255,255,0.7)',
            bgcolor: 'rgba(255,255,255,0.08)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.18)', color: '#ffffff' }
          }}
        >
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 2.5, sm: 3.5, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
        {/* Album Hero Header */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { xs: 'center', sm: 'flex-start' } }}>
          {/* Cover Art */}
          <Box
            sx={{
              width: { xs: 180, sm: 210 },
              height: { xs: 180, sm: 210 },
              flexShrink: 0,
              borderRadius: 3.5,
              overflow: 'hidden',
              boxShadow: '0 16px 36px rgba(0,0,0,0.6)',
              bgcolor: 'rgba(255,255,255,0.04)',
            }}
          >
            <Box
              component="img"
              src={album.thumbnail}
              alt={album.title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>

          {/* Info & Actions */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: { xs: 'center', sm: 'left' } }}>
            <Box sx={{ display: 'inline-flex', alignSelf: { xs: 'center', sm: 'flex-start' }, px: 1.2, py: 0.3, bgcolor: 'rgba(208, 188, 255, 0.15)', borderRadius: 1.5, mb: 1 }}>
              <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Альбом
              </Typography>
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', mb: 0.8, lineHeight: 1.25 }}>
              {album.title}
            </Typography>

            <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, mb: 1.5 }}>
              {album.artist}
            </Typography>

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2.5, display: 'block' }}>
              {tracks.length > 0 ? formatTrackCount(tracks.length) : (album.trackCount ? formatTrackCount(album.trackCount) : 'Альбом')}
              {totalDuration > 0 ? ` • ${Math.round(totalDuration / 60)} мин.` : ''}
            </Typography>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: { xs: 'center', sm: 'flex-start' }, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={handlePlayAll}
                disabled={loading || tracks.length === 0}
                sx={{
                  bgcolor: 'primary.main',
                  color: '#141218',
                  fontWeight: 700,
                  borderRadius: 3,
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  boxShadow: '0 4px 16px rgba(208, 188, 255, 0.3)',
                  '&:hover': { bgcolor: 'primary.light' }
                }}
              >
                Слушать всё
              </Button>

              {onAddToQueue && (
                <Button
                  variant="outlined"
                  startIcon={<QueueMusic />}
                  onClick={handleQueueAll}
                  disabled={loading || tracks.length === 0}
                  sx={{
                    color: 'rgba(255,255,255,0.85)',
                    borderColor: 'rgba(255,255,255,0.2)',
                    fontWeight: 600,
                    borderRadius: 3,
                    px: 2.5,
                    py: 1,
                    textTransform: 'none',
                    '&:hover': { borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.06)' }
                  }}
                >
                  В очередь
                </Button>
              )}

              <Tooltip title={isFavAlbum ? 'Удалить альбом из избранного' : 'Добавить альбом в избранное'}>
                <IconButton
                  onClick={() => toggleFavoriteAlbum(album)}
                  sx={{
                    color: isFavAlbum ? '#ff4081' : 'rgba(255,255,255,0.7)',
                    bgcolor: isFavAlbum ? 'rgba(255, 64, 129, 0.15)' : 'rgba(255,255,255,0.08)',
                    borderRadius: 3,
                    p: 1.2,
                    '&:hover': {
                      bgcolor: isFavAlbum ? 'rgba(255, 64, 129, 0.25)' : 'rgba(255,255,255,0.18)',
                      color: isFavAlbum ? '#ff4081' : '#ffffff'
                    }
                  }}
                >
                  {isFavAlbum ? <Favorite sx={{ fontSize: 22 }} /> : <FavoriteBorder sx={{ fontSize: 22 }} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

        {/* Tracklist Section */}
        <Box sx={{ flex: 1, minHeight: 200 }}>
          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
              <CircularProgress size={36} color="primary" />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                Загрузка треков альбома...
              </Typography>
            </Box>
          ) : error ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body2" sx={{ color: '#ff8080', mb: 2 }}>
                {error}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setLoading(true)
                  setError('')
                  window.melodix?.getAlbumTracks?.(album.id || album.url || '').then(res => {
                    setLoading(false)
                    if (res?.tracks) setTracks(res.tracks)
                  })
                }}
                sx={{ borderRadius: 2, color: '#ffffff', borderColor: 'rgba(255,255,255,0.2)' }}
              >
                Повторить попытку
              </Button>
            </Box>
          ) : tracks.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <MusicNote sx={{ fontSize: 44, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                Треки не найдены
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {tracks.map((track, idx) => {
                const fav = isFavorite(track.id)
                return (
                  <Box
                    key={track.id || idx}
                    onClick={() => handleTrackClick(track)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1.2,
                      borderRadius: 2.5,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.07)',
                        '& .track-idx': { display: 'none' },
                        '& .track-play-icon': { display: 'inline-flex' },
                      }
                    }}
                  >
                    {/* Index or Play icon */}
                    <Box sx={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Typography
                        className="track-idx"
                        variant="body2"
                        sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {idx + 1}
                      </Typography>
                      <PlayArrow
                        className="track-play-icon"
                        sx={{ fontSize: 20, color: 'primary.main', display: 'none' }}
                      />
                    </Box>

                    {/* Track Title and Artist */}
                    <Box sx={{ flex: 1, minWidth: 0, px: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontWeight: 600, color: '#ffffff' }}
                        >
                          {track.title}
                        </Typography>
                        {track.isExplicit && <ExplicitBadge />}
                      </Box>
                      <Typography variant="caption" noWrap sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {track.artist}
                      </Typography>
                    </Box>

                    {/* Actions and Duration */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                      <Tooltip title={fav ? 'В избранном' : 'Добавить в избранное'}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(track)
                          }}
                          sx={{ color: fav ? '#ff4081' : 'rgba(255,255,255,0.3)', p: 0.5 }}
                        >
                          {fav ? <Favorite sx={{ fontSize: 18 }} /> : <FavoriteBorder sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </Tooltip>

                      <Typography
                        variant="caption"
                        sx={{ color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums', width: 44, textAlign: 'right' }}
                      >
                        {formatTime(track.duration)}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
