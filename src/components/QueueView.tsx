import React from 'react'
import { Box, Typography, Divider } from '@mui/material'
import { QueueMusic } from '@mui/icons-material'
import { Track } from '../types'
import { TrackCard } from './TrackCard'

interface QueueViewProps {
  queue: Track[]
  currentTrack: Track | null
  onPlay: (track: Track) => void
}

export const QueueView: React.FC<QueueViewProps> = ({ queue, currentTrack, onPlay }) => {
  if (!queue.length) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height="60vh"
        gap={2}
      >
        <QueueMusic sx={{ fontSize: 64, color: 'rgba(255,255,255,0.15)' }} />
        <Typography color="text.secondary">Queue is empty</Typography>
        <Typography variant="caption" color="text.secondary">
          Search for tracks and add them to your queue
        </Typography>
      </Box>
    )
  }

  const currentIdx = queue.findIndex(t => t.id === currentTrack?.id)

  return (
    <Box sx={{ p: 3, pb: 14 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Queue · {queue.length} tracks
      </Typography>

      {currentIdx >= 0 && (
        <>
          <Typography variant="overline" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
            Now Playing
          </Typography>
          <TrackCard
            track={queue[currentIdx]}
            onPlay={() => onPlay(queue[currentIdx])}
            isActive
          />
          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
          <Typography variant="overline" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
            Up Next
          </Typography>
        </>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {queue
          .filter((_, i) => i !== currentIdx)
          .map(track => (
            <TrackCard
              key={track.id}
              track={track}
              onPlay={() => onPlay(track)}
              isActive={false}
            />
          ))}
      </Box>
    </Box>
  )
}
