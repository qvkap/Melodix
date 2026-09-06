import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  Box, TextField, InputAdornment, IconButton, Button,
  CircularProgress, Typography, Chip
} from '@mui/material'
import {
  Search, Clear, ChevronRight, LibraryMusic, Album as AlbumIcon,
  PlayArrow, MusicNote
} from '@mui/icons-material'
import { Track, Album } from '../types'
import { TrackCard } from './TrackCard'
import { AlbumModal } from './AlbumModal'
import { cleanTitle, extractArtistAndTitle, formatTime, formatTrackCount } from '../utils'
import { useSettings } from '../contexts/SettingsContext'

interface SearchViewProps {
  onPlay: (track: Track, results: Track[]) => void
  onAddToQueue?: (tracks: Track[]) => void
  initialQuery?: string
  onSelectArtist: (artistName: string, avatarUrl?: string) => void
}

export const SearchView: React.FC<SearchViewProps> = ({
  onPlay, onAddToQueue, initialQuery, onSelectArtist
}) => {
  const { settings, t } = useSettings()
  const [query, setQuery] = useState(initialQuery || '')
  const [results, setResults] = useState<Track[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [playlists, setPlaylists] = useState<Track[]>([])
  const [topArtist, setTopArtist] = useState<{ name: string; avatar: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'tracks' | 'albums'>('all')
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [albumModalOpen, setAlbumModalOpen] = useState(false)
  const lastInitialQueryRef = useRef<string | null>(null)

  const processTrack = useCallback((track: Track): Track => {
    const { artist, title } = extractArtistAndTitle(track.title, track.artist)
    return {
      ...track,
      artist,
      title: cleanTitle(title, settings.exclusionWords),
      thumbnail: track.thumbnail?.startsWith('http')
        ? track.thumbnail
        : `https://img.youtube.com/vi/${track.id}/mqdefault.jpg`,
    }
  }, [settings.exclusionWords])

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setLoading(true)
    setSearched(true)
    setErrorMessage('')

    try {
      // Parallel search: tracks and albums
      const [trackRes, albumRes] = await Promise.all([
        window.melodix?.searchMusic?.(trimmed),
        window.melodix?.searchAlbums ? window.melodix.searchAlbums(trimmed) : Promise.resolve({ success: true, results: [] }),
      ])

      let rawCombined = trackRes?.results || []

      // If sparse track results, fetch secondary query
      if (rawCombined.length < 15) {
        const res2 = await window.melodix?.searchMusic?.(`${trimmed} audio`)
        if (res2?.results) {
          rawCombined = [...rawCombined, ...res2.results]
        }
      }

      setLoading(false)

      // Set albums
      const foundAlbums = albumRes?.results || []
      setAlbums(foundAlbums)

      if (rawCombined.length > 0) {
        const seen = new Set<string>()
        const unique = rawCombined.filter(tr => {
          if (!tr || !tr.id || seen.has(tr.id)) return false
          seen.add(tr.id)
          return true
        })

        const processed = unique.map(processTrack)

        // Helper to detect playlists, full mixes
        const isPlaylistLike = (tr: Track) => {
          const lower = tr.title.toLowerCase()
          return (
            lower.includes('playlist') ||
            lower.includes('full album') ||
            lower.includes('compilation') ||
            lower.includes('discography') ||
            lower.includes('greatest hits') ||
            (tr.duration && tr.duration > 720)
          )
        }

        const foundPlaylists = processed.filter(isPlaylistLike)
        const foundTracks = processed.filter(tr => !isPlaylistLike(tr))

        setResults(foundTracks)
        setPlaylists(foundPlaylists)

        // Primary artist detection
        let foundArtistName = ''
        let foundArtistAvatar = ''

        const handleMatch = trimmed.match(/(?:https?:\/\/(?:www\.)?youtube\.com\/)?@([a-zA-Z0-9_.-]+)/i) ||
                            (trimmed.endsWith('.mp3') ? [null, trimmed.replace(/^@/, '')] : null)
        const cleanHandle = handleMatch ? handleMatch[1] : trimmed.replace(/^@/, '').trim()
        const lowerQuery = cleanHandle.toLowerCase()
        const candidateScores = new Map<string, { name: string; avatar: string; score: number }>()

        for (const t of foundTracks) {
          if (!t.artist || t.artist === 'Unknown Artist') continue
          const art = t.artist.trim()
          const lowerArt = art.toLowerCase()

          if (/\b(reaction|review|tutorial|lesson|trailer|vlog|mix|playlist)\b/i.test(lowerArt)) continue

          const existing = candidateScores.get(lowerArt) || { name: art, avatar: t.thumbnail, score: 0 }
          existing.score += 1

          if (lowerArt === lowerQuery) {
            existing.score += 50
            existing.name = art
          } else if (lowerArt.startsWith(lowerQuery) || lowerQuery.startsWith(lowerArt)) {
            existing.score += 15
          } else if (lowerArt.includes(lowerQuery)) {
            existing.score += 5
          }

          if (!existing.avatar && t.thumbnail) {
            existing.avatar = t.thumbnail
          }
          candidateScores.set(lowerArt, existing)
        }

        const sortedCandidates = Array.from(candidateScores.values()).sort((a, b) => b.score - a.score)
        if (sortedCandidates.length > 0 && sortedCandidates[0].score >= 2) {
          foundArtistName = sortedCandidates[0].name
          foundArtistAvatar = sortedCandidates[0].avatar
        } else if (cleanHandle.length > 1 && foundTracks.length > 0) {
          foundArtistName = cleanHandle
          foundArtistAvatar = foundTracks[0]?.thumbnail || ''
        }

        if (foundArtistName) {
          setTopArtist({
            name: foundArtistName,
            avatar: foundArtistAvatar,
          })
        } else {
          setTopArtist(null)
        }
      } else {
        setResults([])
        setPlaylists([])
        setTopArtist(null)
        if (trackRes?.error && foundAlbums.length === 0) {
          setErrorMessage(trackRes.error)
        }
      }
    } catch (err: any) {
      setLoading(false)
      setResults([])
      setAlbums([])
      setPlaylists([])
      setTopArtist(null)
      setErrorMessage(err?.message || 'Ошибка поиска')
    }
  }, [processTrack])

  useEffect(() => {
    if (initialQuery && initialQuery !== lastInitialQueryRef.current) {
      lastInitialQueryRef.current = initialQuery
      setQuery(initialQuery)
      doSearch(initialQuery)
    }
  }, [initialQuery, doSearch])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch(query)
  }

  const clear = () => {
    setQuery('')
    setResults([])
    setAlbums([])
    setTopArtist(null)
    setSearched(false)
    setErrorMessage('')
  }

  const handleOpenAlbum = (album: Album) => {
    setSelectedAlbum(album)
    setAlbumModalOpen(true)
  }

  const renderAlbumCard = (album: Album) => (
    <Box
      key={album.id}
      onClick={() => handleOpenAlbum(album)}
      sx={{
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
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
      {/* Cover Artwork Container */}
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
            bottom: 12,
            right: 12,
            width: 44,
            height: 44,
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
          <PlayArrow sx={{ fontSize: 28 }} />
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
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
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
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {album.artist}
      </Typography>

      <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: 0.8 }}>
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
      </Box>
    </Box>
  )

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4, lg: 5 }, pb: 16, width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* Search Input Bar & Controls */}
      <Box sx={{ maxWidth: 1000, mx: 'auto', mb: 3 }}>
        <Box sx={{ mb: 2, display: 'flex', gap: 1.2 }}>
          <TextField
            fullWidth
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t.searchPlaceholder}
            variant="outlined"
            size="small"
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'rgba(255,255,255,0.5)' }} />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={clear} sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    <Clear fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.05)',
                borderRadius: 2.5,
                fontSize: '0.95rem',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main' },
              },
            }}
          />

          <Button
            variant="contained"
            onClick={() => doSearch(query)}
            sx={{
              bgcolor: 'primary.main',
              color: '#141218',
              fontWeight: 700,
              borderRadius: 2.5,
              px: 3,
              flexShrink: 0,
              textTransform: 'none',
              '&:hover': { bgcolor: 'primary.light' }
            }}
          >
            Найти
          </Button>
        </Box>

        {/* Filter Tabs (Все / Треки / Альбомы) when results available */}
        {searched && (results.length > 0 || albums.length > 0) && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label="Все"
              onClick={() => setActiveTab('all')}
              sx={{
                fontWeight: 700,
                fontSize: '0.82rem',
                borderRadius: 2,
                px: 1,
                bgcolor: activeTab === 'all' ? 'primary.main' : 'rgba(255,255,255,0.07)',
                color: activeTab === 'all' ? '#141218' : 'rgba(255,255,255,0.75)',
                cursor: 'pointer',
                '&:hover': { bgcolor: activeTab === 'all' ? 'primary.light' : 'rgba(255,255,255,0.14)' }
              }}
            />
            <Chip
              label={`Треки (${results.length})`}
              onClick={() => setActiveTab('tracks')}
              sx={{
                fontWeight: 700,
                fontSize: '0.82rem',
                borderRadius: 2,
                px: 1,
                bgcolor: activeTab === 'tracks' ? 'primary.main' : 'rgba(255,255,255,0.07)',
                color: activeTab === 'tracks' ? '#141218' : 'rgba(255,255,255,0.75)',
                cursor: 'pointer',
                '&:hover': { bgcolor: activeTab === 'tracks' ? 'primary.light' : 'rgba(255,255,255,0.14)' }
              }}
            />
            <Chip
              label={`Альбомы (${albums.length})`}
              onClick={() => setActiveTab('albums')}
              sx={{
                fontWeight: 700,
                fontSize: '0.82rem',
                borderRadius: 2,
                px: 1,
                bgcolor: activeTab === 'albums' ? 'primary.main' : 'rgba(255,255,255,0.07)',
                color: activeTab === 'albums' ? '#141218' : 'rgba(255,255,255,0.75)',
                cursor: 'pointer',
                '&:hover': { bgcolor: activeTab === 'albums' ? 'primary.light' : 'rgba(255,255,255,0.14)' }
              }}
            />
          </Box>
        )}
      </Box>

      {/* Loading Indicator */}
      {loading && (
        <Box display="flex" flexDirection="column" alignItems="center" py={10} gap={2}>
          <CircularProgress color="primary" size={36} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Ищем треки и альбомы...
          </Typography>
        </Box>
      )}

      {/* Top Artist Card (Shown on 'all' or 'tracks' tab) */}
      {!loading && topArtist && activeTab !== 'albums' && (
        <Box sx={{ mb: 3.5 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}>
            Исполнитель
          </Typography>
          <Box
            onClick={() => onSelectArtist(topArtist.name, topArtist.avatar)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              borderRadius: 3,
              bgcolor: 'rgba(255, 255, 255, 0.04)',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              '&:hover': {
                bgcolor: 'rgba(208, 188, 255, 0.14)',
                transform: 'translateY(-1px)',
              },
            }}
          >
            <Box display="flex" alignItems="center" gap={2}>
              <Box
                component="img"
                src={topArtist.avatar}
                alt={topArtist.name}
                sx={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}
              />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#ffffff' }}>
                  {topArtist.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 600 }}>
                  Открыть дискографию и все треки
                </Typography>
              </Box>
            </Box>

            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              <ChevronRight />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Dedicated ALBUMS Section (Shown in 'all' up to 6 or in 'albums' full grid) */}
      {!loading && albums.length > 0 && (activeTab === 'all' || activeTab === 'albums') && (
        <Box sx={{ mb: 4 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Box display="flex" alignItems="center" gap={1}>
              <AlbumIcon sx={{ color: 'primary.main', fontSize: 22 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#ffffff' }}>
                Альбомы ({albums.length})
              </Typography>
            </Box>

            {activeTab === 'all' && albums.length > 4 && (
              <Button
                size="small"
                onClick={() => setActiveTab('albums')}
                sx={{ color: 'primary.light', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}
              >
                Все альбомы ({albums.length}) →
              </Button>
            )}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(auto-fill, minmax(140px, 1fr))',
                sm: 'repeat(auto-fill, minmax(165px, 1fr))',
                md: 'repeat(auto-fill, minmax(185px, 1fr))',
                lg: 'repeat(auto-fill, minmax(210px, 1fr))',
              },
              gap: { xs: 1.5, sm: 2, md: 2.5 },
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            {(activeTab === 'all' ? albums.slice(0, 8) : albums).map(renderAlbumCard)}
          </Box>
        </Box>
      )}

      {/* Tracks Section (Shown in 'all' or 'tracks') */}
      {!loading && results.length > 0 && (activeTab === 'all' || activeTab === 'tracks') && (
        <Box sx={{ mb: 4 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
            <MusicNote sx={{ color: 'primary.main', fontSize: 22 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#ffffff' }}>
              Треки ({results.length})
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            {results.map(track => (
              <TrackCard
                key={track.id}
                track={track}
                onPlay={() => onPlay(track, results)}
                isActive={false}
                onSelectArtist={onSelectArtist}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Playlists section if available and on 'all' tab */}
      {!loading && playlists.length > 0 && activeTab === 'all' && (
        <Box sx={{ mb: 4 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
            <LibraryMusic sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#ffffff' }}>
              Сборники и плейлисты ({playlists.length})
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
            }}
          >
            {playlists.map(pl => (
              <Box
                key={pl.id}
                onClick={() => onPlay(pl, playlists)}
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  bgcolor: 'rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    bgcolor: 'rgba(208, 188, 255, 0.14)',
                    borderColor: 'rgba(208, 188, 255, 0.3)',
                    transform: 'translateY(-1px)',
                    '& .pl-play-btn': { opacity: 1, transform: 'scale(1)' }
                  }
                }}
              >
                <Box sx={{ position: 'relative', width: 62, height: 62, borderRadius: 2.5, overflow: 'hidden', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.05)' }}>
                  <Box
                    component="img"
                    src={pl.thumbnail}
                    alt={pl.title}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <Box
                    className="pl-play-btn"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transform: 'scale(0.85)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <PlayArrow sx={{ color: '#ffffff', fontSize: 32 }} />
                  </Box>
                </Box>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Chip
                    label="Сборник"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      bgcolor: 'rgba(208, 188, 255, 0.18)',
                      color: 'primary.light',
                      mb: 0.5,
                    }}
                  />
                  <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, color: '#ffffff' }}>
                    {pl.title}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ color: 'rgba(255, 255, 255, 0.55)', display: 'block', mt: 0.2 }}>
                    {pl.artist} • {formatTime(pl.duration)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Empty / Error state */}
      {!loading && searched && results.length === 0 && albums.length === 0 && (
        <Box display="flex" flexDirection="column" alignItems="center" py={10} gap={1}>
          <Typography color="rgba(255,255,255,0.6)">{t.noResults}</Typography>
          {errorMessage && (
            <Typography variant="caption" color="rgba(255,255,255,0.4)">
              {errorMessage}
            </Typography>
          )}
        </Box>
      )}

      {/* Initial state placeholder */}
      {!loading && !searched && (
        <Box py={10} textAlign="center">
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
            Введите имя артиста, альбом или название трека для поиска
          </Typography>
        </Box>
      )}

      {/* Album Details Modal */}
      <AlbumModal
        album={selectedAlbum}
        open={albumModalOpen}
        onClose={() => setAlbumModalOpen(false)}
        onPlay={onPlay}
        onAddToQueue={onAddToQueue}
        onTracksLoaded={(albumId, count) => {
          setAlbums(prev => prev.map(a => a.id === albumId ? { ...a, trackCount: count } : a))
        }}
      />
    </Box>
  )
}
