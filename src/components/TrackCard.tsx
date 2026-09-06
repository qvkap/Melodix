import React, { useState } from 'react'
import {
  Box, Typography, IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText
} from '@mui/material'
import {
  PlayArrow, Favorite, FavoriteBorder, PlaylistAdd, DeleteOutline, MoreVert
} from '@mui/icons-material'
import { Track } from '../types'
import { formatTime, cleanTitle, detectExplicit } from '../utils'
import { useSettings } from '../contexts/SettingsContext'
import { ExplicitBadge } from './ExplicitBadge'

interface TrackCardProps {
  track: Track
  onPlay: () => void
  onQueue?: () => void
  onRemove?: () => void
  isActive: boolean
  onSelectArtist?: (artistName: string, avatarUrl?: string) => void
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track, onPlay, onQueue, onRemove, isActive, onSelectArtist
}) => {
  const { settings, isFavorite, toggleFavorite, addTrackToPlaylist } = useSettings()
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)

  const isFav = isFavorite(track.id)
  const isExp = track.isExplicit || detectExplicit(track.title)
  const displayTitle = cleanTitle(track.title, settings.exclusionWords)

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    setMenuAnchor(e.currentTarget)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1,
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        bgcolor: isActive ? 'rgba(208, 188, 255, 0.16)' : 'transparent',
        border: isActive ? '1px solid rgba(208, 188, 255, 0.3)' : '1px solid transparent',
        '&:hover': {
          bgcolor: isActive ? 'rgba(208, 188, 255, 0.22)' : 'rgba(255, 255, 255, 0.05)',
          '& .track-play-overlay': { opacity: 1 },
          '& .track-actions': { opacity: 1 },
        },
      }}
      onClick={onPlay}
    >
      {/* Thumbnail with overlay play */}
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <Box
          component="img"
          src={track.thumbnail}
          alt={track.title}
          onError={(e: any) => {
            e.target.src = `https://img.youtube.com/vi/${track.id}/mqdefault.jpg`
          }}
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2.5,
            objectFit: 'cover',
            display: 'block',
            bgcolor: 'rgba(255,255,255,0.05)',
          }}
        />
        <Box
          className="track-play-overlay"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.5)',
            borderRadius: 2.5,
            opacity: isActive ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        >
          <PlayArrow sx={{ color: '#ffffff', fontSize: 28 }} />
        </Box>
      </Box>

      {/* Info */}
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography
            variant="subtitle2"
            noWrap
            sx={{
              color: isActive ? 'primary.main' : '#ffffff',
              fontWeight: isActive ? 700 : 600,
              fontSize: '0.98rem',
            }}
          >
            {displayTitle}
          </Typography>
          {isExp && <ExplicitBadge size="small" />}
        </Box>
        <Typography
          variant="caption"
          noWrap
          onClick={(e) => {
            if (onSelectArtist && track.artist && track.artist !== 'Unknown Artist') {
              e.stopPropagation()
              onSelectArtist(track.artist, track.thumbnail)
            }
          }}
          sx={{
            color: 'rgba(255, 255, 255, 0.65)',
            display: 'block',
            mt: 0.2,
            cursor: (onSelectArtist && track.artist && track.artist !== 'Unknown Artist') ? 'pointer' : 'inherit',
            transition: 'color 0.15s ease',
            '&:hover': (onSelectArtist && track.artist && track.artist !== 'Unknown Artist')
              ? { color: 'primary.light', textDecoration: 'underline' }
              : {},
          }}
        >
          {track.artist}
        </Typography>
      </Box>

      {/* Duration */}
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255, 255, 255, 0.5)',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {formatTime(track.duration)}
      </Typography>

      {/* Action Buttons */}
      <Box
        className="track-actions"
        display="flex"
        alignItems="center"
        gap={0.5}
        sx={{
          opacity: isFav ? 1 : { xs: 1, md: 0 },
          transition: 'opacity 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Favorite Heart Button */}
        <Tooltip title={isFav ? 'Удалить из избранного' : 'В избранное'}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              toggleFavorite(track)
            }}
            sx={{ color: isFav ? '#ff4081' : 'rgba(255, 255, 255, 0.45)' }}
          >
            {isFav ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* More Options / Add to Playlist Menu */}
        <Tooltip title="Действия">
          <IconButton
            size="small"
            onClick={handleMenuClick}
            sx={{ color: 'rgba(255, 255, 255, 0.45)' }}
          >
            <MoreVert fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Remove from playlist if applicable */}
        {onRemove && (
          <Tooltip title="Удалить из плейлиста">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              sx={{ color: 'rgba(255, 255, 255, 0.45)', '&:hover': { color: '#f44336' } }}
            >
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Dropdown Menu for Playlists */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            bgcolor: '#1c1b1f',
            backgroundImage: 'none',
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: 200,
          }
        }}
      >
        <Typography variant="overline" sx={{ px: 2, py: 0.5, color: 'primary.light', display: 'block' }}>
          Добавить в плейлист
        </Typography>
        {settings.playlists.map(pl => (
          <MenuItem
            key={pl.id}
            onClick={() => {
              addTrackToPlaylist(pl.id, track)
              handleMenuClose()
            }}
          >
            <ListItemIcon>
              <PlaylistAdd fontSize="small" sx={{ color: 'text.secondary' }} />
            </ListItemIcon>
            <ListItemText primary={pl.name} primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}
