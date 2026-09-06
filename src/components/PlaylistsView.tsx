import React, { useState } from 'react'
import {
  Box, Typography, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, Card, CardContent, IconButton, Tooltip
} from '@mui/material'
import { Add, Delete, QueueMusic, PlayArrow, Favorite } from '@mui/icons-material'
import { Track, Playlist } from '../types'
import { useSettings } from '../contexts/SettingsContext'
import { TrackCard } from './TrackCard'

interface PlaylistsViewProps {
  onPlay: (track: Track, results: Track[]) => void
  initialSelectedPlaylistId?: string
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  onPlay, initialSelectedPlaylistId
}) => {
  const { t, settings, createPlaylist, deletePlaylist, removeTrackFromPlaylist } = useSettings()
  const [openCreate, setOpenCreate] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    initialSelectedPlaylistId || (settings.playlists[0]?.id || null)
  )

  const handleCreate = () => {
    if (playlistName.trim()) {
      createPlaylist(playlistName.trim())
      setPlaylistName('')
      setOpenCreate(false)
    }
  }

  const selectedPlaylist = settings.playlists.find(p => p.id === selectedPlaylistId)

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, pb: 16, maxWidth: 960, mx: 'auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            {t.playlists}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5 }}>
            {settings.playlists.length} {t.playlists.toLowerCase()}
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenCreate(true)}
          sx={{
            bgcolor: 'primary.main',
            color: '#141218',
            fontWeight: 700,
            borderRadius: 99,
            '&:hover': { bgcolor: 'primary.light' }
          }}
        >
          {t.createPlaylist}
        </Button>
      </Box>

      {/* Playlist Grid */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {settings.playlists.map(pl => {
          const isSelected = pl.id === selectedPlaylistId
          return (
            <Grid item xs={12} sm={6} md={4} key={pl.id}>
              <Card
                onClick={() => setSelectedPlaylistId(pl.id)}
                sx={{
                  bgcolor: isSelected ? 'rgba(208,188,255,0.18)' : 'rgba(255,255,255,0.04)',
                  border: isSelected ? '1px solid #d0bcff' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  p: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: isSelected ? 'rgba(208,188,255,0.22)' : 'rgba(255,255,255,0.08)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 3,
                        bgcolor: 'rgba(208,188,255,0.15)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {pl.tracks[0]?.thumbnail ? (
                        <Box
                          component="img"
                          src={pl.tracks[0].thumbnail}
                          alt={pl.name}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <QueueMusic sx={{ color: 'primary.main', fontSize: 26 }} />
                      )}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700, color: '#ffffff' }}>
                        {pl.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {pl.tracks.length} {t.tracksCount}
                      </Typography>
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="center" gap={0.5}>
                    {pl.tracks.length > 0 && (
                      <Tooltip title="Слушать плейлист">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            onPlay(pl.tracks[0], pl.tracks)
                          }}
                          sx={{
                            bgcolor: 'primary.main',
                            color: '#141218',
                            width: 34,
                            height: 34,
                            '&:hover': { bgcolor: 'primary.light', transform: 'scale(1.08)' },
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <PlayArrow sx={{ fontSize: 20 }} />
                        </IconButton>
                      </Tooltip>
                    )}

                    {pl.id !== 'pl-favorites-default' && (
                      <Tooltip title={t.delete}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            deletePlaylist(pl.id)
                            if (selectedPlaylistId === pl.id) {
                              setSelectedPlaylistId(settings.playlists[0]?.id || null)
                            }
                          }}
                          sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#f44336' } }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {/* Selected Playlist Tracks */}
      {selectedPlaylist && (
        <Box sx={{ mt: 4 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff' }}>
                {selectedPlaylist.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                {selectedPlaylist.tracks.length} {t.tracksCount}
              </Typography>
            </Box>

            {selectedPlaylist.tracks.length > 0 && (
              <Box display="flex" gap={1}>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={() => onPlay(selectedPlaylist.tracks[0], selectedPlaylist.tracks)}
                  sx={{
                    borderRadius: 2.5,
                    bgcolor: 'primary.main',
                    color: '#141218',
                    fontWeight: 700,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'primary.light' }
                  }}
                >
                  Слушать всё
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    const shuffled = [...selectedPlaylist.tracks].sort(() => Math.random() - 0.5)
                    onPlay(shuffled[0], shuffled)
                  }}
                  sx={{
                    borderRadius: 2.5,
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    textTransform: 'none',
                    '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.06)' }
                  }}
                >
                  Вперемешку
                </Button>
              </Box>
            )}
          </Box>

          {selectedPlaylist.tracks.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              {selectedPlaylist.tracks.map(track => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onPlay={() => onPlay(track, selectedPlaylist.tracks)}
                  isActive={false}
                  onRemove={() => removeTrackFromPlaylist(selectedPlaylist.id, track.id)}
                />
              ))}
            </Box>
          ) : (
            <Box
              sx={{
                p: 5,
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px dashed rgba(255,255,255,0.1)',
                textAlign: 'center'
              }}
            >
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                В этом плейлисте пока нет треков. Найдите трек в Поиске и добавьте его сюда!
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Create Dialog */}
      <Dialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        PaperProps={{
          sx: {
            borderRadius: 4,
            bgcolor: '#1c1b1f',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: 320,
            p: 1
          }
        }}
      >
        <DialogTitle sx={{ color: '#ffffff', fontWeight: 700 }}>
          {t.createPlaylist}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            placeholder={t.newPlaylistName}
            value={playlistName}
            onChange={e => setPlaylistName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCreate(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
            {t.cancel}
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            sx={{ bgcolor: 'primary.main', color: '#141218', borderRadius: 99, fontWeight: 700 }}
          >
            {t.create}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
