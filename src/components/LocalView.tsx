import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box, Typography, Button, IconButton, TextField, InputAdornment,
  CircularProgress, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText
} from '@mui/material'
import {
  FolderSpecial, PlayArrow, Add, CreateNewFolder, DeleteOutline,
  Search, Clear, Refresh, MoreVert, FolderOpen, AudioFile
} from '@mui/icons-material'
import { Track } from '../types'
import { useSettings } from '../contexts/SettingsContext'
import { TrackCard } from './TrackCard'
import { formatTrackCount } from '../utils'

interface LocalViewProps {
  onPlay: (track: Track, results: Track[]) => void
  onAddToQueue?: (tracks: Track[]) => void
  currentTrackId?: string
}

export const LocalView: React.FC<LocalViewProps> = ({
  onPlay, onAddToQueue, currentTrackId
}) => {
  const { t } = useSettings()
  const [tracks, setTracks] = useState<Track[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  // Track menu state
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)

  // Load saved local tracks & folders on mount
  useEffect(() => {
    let cancelled = false
    const loadSaved = async () => {
      try {
        const savedTracks = await window.melodix?.storeGet?.('local_tracks')
        const savedFolders = await window.melodix?.storeGet?.('local_folders')
        if (!cancelled) {
          if (Array.isArray(savedTracks)) setTracks(savedTracks)
          if (Array.isArray(savedFolders)) setFolders(savedFolders)
        }
      } catch (e) {
        console.error('Failed to load local tracks:', e)
      }
    }
    loadSaved()
    return () => { cancelled = true }
  }, [])

  // Save tracks & folders whenever they change
  const saveTracks = useCallback((newTracks: Track[]) => {
    setTracks(newTracks)
    window.melodix?.storeSet?.('local_tracks', newTracks)
  }, [])

  const saveFolders = useCallback((newFolders: string[]) => {
    setFolders(newFolders)
    window.melodix?.storeSet?.('local_folders', newFolders)
  }, [])

  // Append newly imported tracks (deduplicating by path or id)
  const mergeTracks = useCallback((newItems: Track[]) => {
    setTracks(prev => {
      const seen = new Set(prev.map(t => t.localPath || t.id))
      const added: Track[] = []
      for (const item of newItems) {
        const key = item.localPath || item.id
        if (!seen.has(key)) {
          seen.add(key)
          added.push(item)
        }
      }
      const merged = [...prev, ...added]
      window.melodix?.storeSet?.('local_tracks', merged)
      return merged
    })
  }, [])

  // Add individual files dialog
  const handleAddFiles = async () => {
    if (!window.melodix?.openLocalFiles) return
    setLoading(true)
    setLoadingText('Обработка файлов...')
    try {
      const res = await window.melodix.openLocalFiles()
      if (res?.success && Array.isArray(res.tracks) && res.tracks.length > 0) {
        mergeTracks(res.tracks)
      }
    } catch (err) {
      console.error('Error adding local files:', err)
    } finally {
      setLoading(false)
      setLoadingText('')
    }
  }

  // Add a whole directory dialog
  const handleAddFolder = async () => {
    if (!window.melodix?.openLocalFolder) return
    setLoading(true)
    setLoadingText('Сканирование папки...')
    try {
      const res = await window.melodix.openLocalFolder()
      if (res?.success && Array.isArray(res.tracks)) {
        if (res.tracks.length > 0) {
          mergeTracks(res.tracks)
        }
        if (res.folderPath && !folders.includes(res.folderPath)) {
          const nextFolders = [...folders, res.folderPath]
          saveFolders(nextFolders)
        }
      }
    } catch (err) {
      console.error('Error adding folder:', err)
    } finally {
      setLoading(false)
      setLoadingText('')
    }
  }

  // Rescan all saved folders for new/updated audio files
  const handleRescan = async () => {
    if (!window.melodix?.scanLocalFolder || folders.length === 0) return
    setLoading(true)
    setLoadingText('Синхронизация папок...')
    try {
      let allFound: Track[] = []
      for (const folder of folders) {
        const res = await window.melodix.scanLocalFolder(folder)
        if (res?.success && Array.isArray(res.tracks)) {
          allFound.push(...res.tracks)
        }
      }
      if (allFound.length > 0) {
        mergeTracks(allFound)
      }
    } catch (err) {
      console.error('Error rescanning folders:', err)
    } finally {
      setLoading(false)
      setLoadingText('')
    }
  }

  // Clear local library
  const handleClear = () => {
    if (window.confirm('Очистить список локальных треков? Сами файлы на диске затронуты не будут.')) {
      saveTracks([])
      saveFolders([])
    }
  }

  // Drag and drop handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (!files || files.length === 0) return

    setLoading(true)
    setLoadingText('Импорт треков...')
    try {
      const parsedTracks: Track[] = []
      for (const file of files) {
        const filePath = (file as any).path
        if (!filePath) continue

        const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
        const isAudio = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.opus', '.wma'].includes(ext)

        if (isAudio && window.melodix?.parseLocalFile) {
          const res = await window.melodix.parseLocalFile(filePath)
          if (res?.success && res.track) {
            parsedTracks.push(res.track)
          }
        } else if (!ext && window.melodix?.scanLocalFolder) {
          const res = await window.melodix.scanLocalFolder(filePath)
          if (res?.success && Array.isArray(res.tracks)) {
            parsedTracks.push(...res.tracks)
            if (!folders.includes(filePath)) {
              saveFolders([...folders, filePath])
            }
          }
        }
      }
      if (parsedTracks.length > 0) {
        mergeTracks(parsedTracks)
      }
    } catch (err) {
      console.error('Error importing dropped files:', err)
    } finally {
      setLoading(false)
      setLoadingText('')
    }
  }

  // Remove single track from library
  const handleRemoveTrack = (track: Track) => {
    const next = tracks.filter(t => t.id !== track.id && t.localPath !== track.localPath)
    saveTracks(next)
    setMenuAnchor(null)
  }

  const handleOpenFolder = (track: Track) => {
    const targetPath = track.localPath || track.id.replace(/^local:/, '')
    window.melodix?.showItemInFolder?.(targetPath)
    setMenuAnchor(null)
  }

  // Filtered tracks
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks
    const q = searchQuery.toLowerCase().trim()
    return tracks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.localPath && t.localPath.toLowerCase().includes(q))
    )
  }, [tracks, searchQuery])

  const totalDuration = useMemo(() => {
    return filteredTracks.reduce((acc, t) => acc + (t.duration || 0), 0)
  }, [filteredTracks])

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        p: { xs: 2.5, sm: 3, md: 4, lg: 5 },
        pb: 18,
        maxWidth: 1040,
        mx: 'auto',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        minHeight: '100%',
      }}
    >
      {/* Drag & drop overlay */}
      {isDragging && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            bgcolor: 'rgba(10, 13, 20, 0.88)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            border: '3px dashed',
            borderColor: 'primary.main',
            m: 2,
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        >
          <AudioFile sx={{ fontSize: 72, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff' }}>
            Отпустите файлы или папки для добавления
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Поддерживаются MP3, FLAC, WAV, M4A, OGG, AAC, OPUS
          </Typography>
        </Box>
      )}

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2.5,
          mb: 3.5,
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              width: 58,
              height: 58,
              borderRadius: 3.5,
              bgcolor: 'rgba(208, 188, 255, 0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(208, 188, 255, 0.25)',
              flexShrink: 0,
            }}
          >
            <FolderSpecial sx={{ color: 'primary.main', fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {t.localTracks}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5, fontWeight: 500 }}>
              {formatTrackCount(tracks.length) || '0 треков'}
              {totalDuration > 0 && ` • ${Math.round(totalDuration / 60)} мин.`}
              {folders.length > 0 && ` • ${folders.length} папок`}
            </Typography>
          </Box>
        </Box>

        {/* Header Actions */}
        <Box display="flex" gap={1.2} flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddFiles}
            disabled={loading}
            sx={{
              bgcolor: 'primary.main',
              color: '#141218',
              fontWeight: 700,
              borderRadius: 3,
              px: 2.2,
              py: 0.9,
              textTransform: 'none',
              boxShadow: '0 4px 14px rgba(208, 188, 255, 0.25)',
              '&:hover': { bgcolor: 'primary.light' }
            }}
          >
            {t.addFiles}
          </Button>

          <Button
            variant="outlined"
            startIcon={<CreateNewFolder />}
            onClick={handleAddFolder}
            disabled={loading}
            sx={{
              color: '#ffffff',
              borderColor: 'rgba(255,255,255,0.2)',
              fontWeight: 600,
              borderRadius: 3,
              px: 2,
              py: 0.9,
              textTransform: 'none',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(255,255,255,0.06)' }
            }}
          >
            {t.addFolder}
          </Button>

          {folders.length > 0 && (
            <Tooltip title="Пересканировать добавленные папки">
              <span>
                <IconButton
                  onClick={handleRescan}
                  disabled={loading}
                  sx={{
                    color: 'rgba(255,255,255,0.7)',
                    bgcolor: 'rgba(255,255,255,0.06)',
                    borderRadius: 2.5,
                    p: 1,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.14)', color: '#ffffff' }
                  }}
                >
                  <Refresh fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {tracks.length > 0 && (
            <Tooltip title="Очистить список">
              <IconButton
                onClick={handleClear}
                sx={{
                  color: 'rgba(255, 80, 80, 0.7)',
                  bgcolor: 'rgba(255, 80, 80, 0.08)',
                  borderRadius: 2.5,
                  p: 1,
                  '&:hover': { bgcolor: 'rgba(255, 80, 80, 0.2)', color: '#ff5050' }
                }}
              >
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Loading banner */}
      {loading && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.6,
            mb: 3,
            borderRadius: 3,
            bgcolor: 'rgba(208, 188, 255, 0.12)',
            border: '1px solid rgba(208, 188, 255, 0.25)',
          }}
        >
          <CircularProgress size={20} sx={{ color: 'primary.main' }} />
          <Typography variant="body2" sx={{ color: 'primary.light', fontWeight: 600 }}>
            {loadingText || 'Обработка локальных файлов...'}
          </Typography>
        </Box>
      )}

      {/* Main content */}
      {tracks.length > 0 ? (
        <>
          {/* Controls Bar: Search Filter & Play All */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              mb: 3,
            }}
          >
            {/* Search Input */}
            <TextField
              size="small"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t.filterLocalPlaceholder}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                      <Clear fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{
                flex: 1,
                maxWidth: { sm: 400 },
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 3,
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(208, 188, 255, 0.4)' },
                  '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                },
                '& input': { color: '#ffffff', fontSize: '0.88rem' }
              }}
            />

            {filteredTracks.length > 0 && (
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={() => onPlay(filteredTracks[0], filteredTracks)}
                sx={{
                  bgcolor: 'primary.main',
                  color: '#141218',
                  fontWeight: 700,
                  borderRadius: 3,
                  px: 2.8,
                  py: 0.9,
                  textTransform: 'none',
                  flexShrink: 0,
                  boxShadow: '0 4px 14px rgba(208, 188, 255, 0.25)',
                  '&:hover': { bgcolor: 'primary.light' }
                }}
              >
                Слушать всё ({filteredTracks.length})
              </Button>
            )}
          </Box>

          {/* Tracks list */}
          {filteredTracks.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredTracks.map(track => (
                <Box
                  key={track.id}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 3,
                    transition: 'all 0.15s ease',
                    '&:hover .track-more-btn': {
                      opacity: 1,
                    }
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <TrackCard
                      track={track}
                      onPlay={() => onPlay(track, filteredTracks)}
                      onQueue={onAddToQueue ? () => onAddToQueue([track]) : undefined}
                      onRemove={() => handleRemoveTrack(track)}
                      isActive={currentTrackId === track.id}
                    />
                  </Box>

                  {/* Context menu trigger */}
                  <IconButton
                    className="track-more-btn"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedTrack(track)
                      setMenuAnchor(e.currentTarget)
                    }}
                    sx={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'rgba(255,255,255,0.6)',
                      bgcolor: 'rgba(20, 24, 36, 0.85)',
                      backdropFilter: 'blur(8px)',
                      opacity: 0,
                      transition: 'opacity 0.18s ease',
                      zIndex: 2,
                      '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.18)' }
                    }}
                  >
                    <MoreVert fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          ) : (
            <Box py={8} textAlign="center">
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                По запросу «{searchQuery}» треки не найдены
              </Typography>
            </Box>
          )}
        </>
      ) : (
        /* Empty State */
        <Box
          sx={{
            py: 10,
            px: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 2.5,
            border: '2px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: 4,
            bgcolor: 'rgba(255, 255, 255, 0.02)',
            transition: 'all 0.2s ease',
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(208, 188, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FolderSpecial sx={{ fontSize: 44, color: 'primary.main', opacity: 0.8 }} />
          </Box>

          <Box sx={{ maxWidth: 460 }}>
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 0.8 }}>
              {t.emptyLocal}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              {t.emptyLocalDesc}
            </Typography>
          </Box>

          <Box display="flex" gap={1.5} flexWrap="wrap" justifyContent="center" sx={{ mt: 1 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddFiles}
              sx={{
                bgcolor: 'primary.main',
                color: '#141218',
                fontWeight: 700,
                borderRadius: 3,
                px: 2.8,
                py: 1,
                textTransform: 'none',
                boxShadow: '0 4px 16px rgba(208, 188, 255, 0.3)',
                '&:hover': { bgcolor: 'primary.light' }
              }}
            >
              {t.addFiles}
            </Button>
            <Button
              variant="outlined"
              startIcon={<CreateNewFolder />}
              onClick={handleAddFolder}
              sx={{
                color: '#ffffff',
                borderColor: 'rgba(255,255,255,0.25)',
                fontWeight: 600,
                borderRadius: 3,
                px: 2.5,
                py: 1,
                textTransform: 'none',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(255,255,255,0.06)' }
              }}
            >
              {t.addFolder}
            </Button>
          </Box>
        </Box>
      )}

      {/* Context Menu for track actions */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(22, 26, 38, 0.98)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
            boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
            minWidth: 200,
          }
        }}
      >
        <MenuItem
          onClick={() => selectedTrack && handleOpenFolder(selectedTrack)}
          sx={{ py: 1.2, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
        >
          <ListItemIcon sx={{ color: 'primary.light', minWidth: 36 }}>
            <FolderOpen fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Показать в папке" primaryTypographyProps={{ fontSize: '0.88rem', fontWeight: 600 }} />
        </MenuItem>

        <MenuItem
          onClick={() => selectedTrack && handleRemoveTrack(selectedTrack)}
          sx={{ py: 1.2, color: '#ff6060', '&:hover': { bgcolor: 'rgba(255, 80, 80, 0.12)' } }}
        >
          <ListItemIcon sx={{ color: '#ff6060', minWidth: 36 }}>
            <DeleteOutline fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Удалить из списка" primaryTypographyProps={{ fontSize: '0.88rem', fontWeight: 600 }} />
        </MenuItem>
      </Menu>
    </Box>
  )
}
