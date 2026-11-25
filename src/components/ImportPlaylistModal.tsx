import React, { useState, useRef } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, LinearProgress,
  RadioGroup, FormControlLabel, Radio, Alert, Chip
} from '@mui/material'
import {
  CloudDownload, CheckCircle, QueueMusic, Favorite, Close
} from '@mui/icons-material'
import { ImportPlatform } from '../types'
import { useSettings } from '../contexts/SettingsContext'

interface ImportPlaylistModalProps {
  open: boolean
  onClose: () => void
  defaultDestination?: 'playlist' | 'favorites'
  onPlaylistCreated?: (playlistId: string) => void
}

const PLATFORMS: {
  id: ImportPlatform
  label: string
  playlistGenitive: string
  color: string
  placeholder: string
}[] = [
  {
    id: 'yandex',
    label: 'Яндекс Музыка',
    playlistGenitive: 'Яндекс Музыки',
    color: '#FFCC00',
    placeholder: 'https://music.yandex.ru/users/.../playlists/...',
  },
  {
    id: 'apple',
    label: 'Apple Music',
    playlistGenitive: 'Apple Music',
    color: '#FA243C',
    placeholder: 'https://music.apple.com/.../playlist/...',
  },
  {
    id: 'spotify',
    label: 'Spotify',
    playlistGenitive: 'Spotify',
    color: '#1DB954',
    placeholder: 'https://open.spotify.com/playlist/...',
  },
]

export const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({
  open,
  onClose,
  defaultDestination = 'playlist',
  onPlaylistCreated,
}) => {
  const { settings, createPlaylist, addTrackToPlaylist, addToFavorites } = useSettings()
  const isEn = settings.language === 'en'

  const [platform, setPlatform] = useState<ImportPlatform>('yandex')
  const [url, setUrl] = useState('')
  const [destination, setDestination] = useState<'playlist' | 'favorites'>(defaultDestination)

  const [stage, setStage] = useState<'idle' | 'fetching' | 'searching' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)
  const [addedCount, setAddedCount] = useState(0)
  const [currentTrackLabel, setCurrentTrackLabel] = useState('')
  const [createdPlaylistName, setCreatedPlaylistName] = useState('')

  const cancelledRef = useRef(false)

  const activePlatform = PLATFORMS.find(p => p.id === platform) || PLATFORMS[0]

  const defaultPlaylistName = isEn
    ? `Tracks from ${activePlatform.label}`
    : `Треки из ${activePlatform.playlistGenitive}`

  const handleUrlChange = (val: string) => {
    setUrl(val)
    setError(null)
    const lower = val.toLowerCase()
    if (lower.includes('music.yandex.')) setPlatform('yandex')
    else if (lower.includes('music.apple.com')) setPlatform('apple')
    else if (lower.includes('spotify.com') || lower.startsWith('spotify:')) setPlatform('spotify')
  }

  const resetState = () => {
    cancelledRef.current = false
    setStage('idle')
    setError(null)
    setTotalCount(0)
    setProcessedCount(0)
    setAddedCount(0)
    setCurrentTrackLabel('')
    setCreatedPlaylistName('')
  }

  const handleClose = () => {
    if (stage === 'fetching' || stage === 'searching') {
      cancelledRef.current = true
    }
    resetState()
    setUrl('')
    onClose()
  }

  const handleStartImport = async () => {
    if (!url.trim()) {
      setError(isEn ? 'Please paste a playlist link' : 'Вставьте ссылку на плейлист')
      return
    }
    if (!window.melodix?.importPlaylist) {
      setError(isEn ? 'Import is unavailable' : 'Импорт недоступен')
      return
    }

    cancelledRef.current = false
    setError(null)
    setStage('fetching')
    setTotalCount(0)
    setProcessedCount(0)
    setAddedCount(0)
    setCurrentTrackLabel('')

    try {
      const res = await window.melodix.importPlaylist({ platform, url: url.trim() })
      if (cancelledRef.current) return

      if (!res.success || !res.tracks || res.tracks.length === 0) {
        setStage('idle')
        setError(res.error || (isEn ? 'Could not load tracks from playlist' : 'Не удалось получить треки из плейлиста'))
        return
      }

      const importedTracks = res.tracks
      setTotalCount(importedTracks.length)
      setStage('searching')

      let targetPlaylistId = ''
      if (destination === 'playlist') {
        const plName = defaultPlaylistName
        setCreatedPlaylistName(plName)
        targetPlaylistId = createPlaylist(plName)
        if (targetPlaylistId && onPlaylistCreated) {
          onPlaylistCreated(targetPlaylistId)
        }
      }

      let foundTotal = 0
      let doneTotal = 0
      const CONCURRENCY = 3

      for (let i = 0; i < importedTracks.length; i += CONCURRENCY) {
        if (cancelledRef.current) break
        const batch = importedTracks.slice(i, i + CONCURRENCY)

        await Promise.all(
          batch.map(async item => {
            if (cancelledRef.current) return
            const query = item.artist ? `${item.artist} - ${item.title}` : item.title
            setCurrentTrackLabel(query)
            try {
              const searchRes = await window.melodix.searchMusic(query)
              if (cancelledRef.current) return
              if (searchRes?.success && searchRes.results && searchRes.results.length > 0) {
                const bestMatch = searchRes.results[0]
                if (destination === 'playlist' && targetPlaylistId) {
                  addTrackToPlaylist(targetPlaylistId, bestMatch)
                } else {
                  addToFavorites(bestMatch)
                }
                foundTotal += 1
                setAddedCount(foundTotal)
              }
            } catch {}
            doneTotal += 1
            setProcessedCount(doneTotal)
          })
        )
      }

      if (!cancelledRef.current) {
        setStage('done')
      }
    } catch (err: any) {
      if (!cancelledRef.current) {
        setStage('idle')
        setError(err?.message || (isEn ? 'Import failed' : 'Ошибка при импорте'))
      }
    }
  }

  const isBusy = stage === 'fetching' || stage === 'searching'
  const progressPercent = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0

  return (
    <Dialog
      open={open}
      onClose={isBusy ? undefined : handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1c1824',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 4,
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle sx={{ color: '#ffffff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1.2}>
          <CloudDownload sx={{ color: 'primary.main' }} />
          <span>{isEn ? 'Import tracks from other platforms' : 'Импорт треков с других площадок'}</span>
        </Box>
        {!isBusy && (
          <Button
            size="small"
            onClick={handleClose}
            sx={{ minWidth: 32, p: 0.5, color: 'rgba(255,255,255,0.5)', borderRadius: 2 }}
          >
            <Close fontSize="small" />
          </Button>
        )}
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        {stage === 'idle' && (
          <Box display="flex" flexDirection="column" gap={2.5}>
            {/* Platform selection */}
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', mb: 1 }}>
                {isEn ? '1. Select platform' : '1. Выберите площадку'}
              </Typography>
              <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={1.2}>
                {PLATFORMS.map(p => {
                  const selected = platform === p.id
                  return (
                    <Box
                      key={p.id}
                      onClick={() => setPlatform(p.id)}
                      sx={{
                        p: 1.5,
                        borderRadius: 3,
                        cursor: 'pointer',
                        textAlign: 'center',
                        border: selected ? `1.5px solid ${p.color}` : '1px solid rgba(255,255,255,0.1)',
                        bgcolor: selected ? `${p.color}22` : 'rgba(255,255,255,0.03)',
                        transition: 'all 0.18s ease',
                        '&:hover': {
                          bgcolor: selected ? `${p.color}2a` : 'rgba(255,255,255,0.07)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: p.color,
                          mx: 'auto',
                          mb: 0.8,
                          boxShadow: selected ? `0 0 10px ${p.color}` : 'none',
                        }}
                      />
                      <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: selected ? 700 : 500, fontSize: '0.84rem' }}>
                        {p.label}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>

            {/* Playlist URL */}
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', mb: 1 }}>
                {isEn ? '2. Paste public playlist link' : '2. Вставьте ссылку на публичный плейлист'}
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder={activePlatform.placeholder}
                value={url}
                onChange={e => handleUrlChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStartImport()}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#ffffff',
                    borderRadius: 2.5,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                  },
                }}
              />
            </Box>

            {/* Destination choice */}
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', mb: 0.5 }}>
                {isEn ? '3. Where to add tracks' : '3. Куда добавить треки'}
              </Typography>
              <RadioGroup
                value={destination}
                onChange={e => setDestination(e.target.value as 'playlist' | 'favorites')}
              >
                <FormControlLabel
                  value="playlist"
                  control={<Radio size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-checked': { color: 'primary.main' } }} />}
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <QueueMusic sx={{ fontSize: 18, color: 'primary.main' }} />
                      <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                        {isEn ? `Create new playlist «${defaultPlaylistName}»` : `Создать новый плейлист «${defaultPlaylistName}»`}
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 0.5 }}
                />
                <FormControlLabel
                  value="favorites"
                  control={<Radio size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-checked': { color: '#ff4081' } }} />}
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Favorite sx={{ fontSize: 18, color: '#ff4081' }} />
                      <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                        {isEn ? 'Add all to Favorite tracks' : 'Добавить всё в «Любимые треки»'}
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </Box>

            {error && (
              <Alert severity="error" sx={{ borderRadius: 2.5, bgcolor: 'rgba(244,67,54,0.12)', color: '#ff8a80', border: '1px solid rgba(244,67,54,0.3)' }}>
                {error}
              </Alert>
            )}
          </Box>
        )}

        {(stage === 'fetching' || stage === 'searching') && (
          <Box py={2} display="flex" flexDirection="column" gap={2}>
            <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {stage === 'fetching'
                ? (isEn ? `Loading playlist from ${activePlatform.label}...` : `Загружаем плейлист из ${activePlatform.playlistGenitive}...`)
                : (isEn ? `Searching and adding tracks (${processedCount} / ${totalCount})...` : `Поиск и добавление треков (${processedCount} из ${totalCount})...`)}
            </Typography>

            <LinearProgress
              variant={stage === 'fetching' ? 'indeterminate' : 'determinate'}
              value={progressPercent}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: 'primary.main' },
              }}
            />

            {stage === 'searching' && (
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" noWrap sx={{ color: 'rgba(255,255,255,0.6)', maxWidth: '70%' }}>
                  {currentTrackLabel}
                </Typography>
                <Chip
                  size="small"
                  label={isEn ? `Added: ${addedCount}` : `Добавлено: ${addedCount}`}
                  sx={{ bgcolor: 'rgba(208,188,255,0.16)', color: 'primary.light', fontWeight: 700 }}
                />
              </Box>
            )}
          </Box>
        )}

        {stage === 'done' && (
          <Box py={2} textAlign="center" display="flex" flexDirection="column" alignItems="center" gap={1.5}>
            <CheckCircle sx={{ fontSize: 52, color: '#69f0ae' }} />
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 800 }}>
              {isEn ? 'Import complete!' : 'Импорт завершён!'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>
              {isEn
                ? `Successfully found and added ${addedCount} of ${totalCount} tracks`
                : `Успешно найдено и добавлено ${addedCount} из ${totalCount} треков`}
              {destination === 'playlist' && createdPlaylistName
                ? (isEn ? ` to «${createdPlaylistName}».` : ` в плейлист «${createdPlaylistName}».`)
                : (isEn ? ' to Favorites.' : ' в «Любимые треки».')}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, pt: 1 }}>
        {stage === 'idle' && (
          <>
            <Button onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.65)' }}>
              {isEn ? 'Cancel' : 'Отмена'}
            </Button>
            <Button
              variant="contained"
              onClick={handleStartImport}
              disabled={!url.trim()}
              sx={{ bgcolor: 'primary.main', color: '#141218', fontWeight: 700, borderRadius: 99, px: 3 }}
            >
              {isEn ? 'Import' : 'Импортировать'}
            </Button>
          </>
        )}

        {isBusy && (
          <Button
            onClick={() => {
              cancelledRef.current = true
              setStage('done')
            }}
            sx={{ color: '#ff8a80', fontWeight: 600 }}
          >
            {isEn ? 'Stop' : 'Остановить'}
          </Button>
        )}

        {stage === 'done' && (
          <Button
            variant="contained"
            onClick={handleClose}
            sx={{ bgcolor: 'primary.main', color: '#141218', fontWeight: 700, borderRadius: 99, px: 3 }}
          >
            {isEn ? 'Done' : 'Готово'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
