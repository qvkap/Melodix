import React, { useState } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { Box } from '@mui/material'
import { darkTheme } from './theme'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { usePlayer } from './hooks/usePlayer'
import { Track } from './types'
import { cleanTitle, getThumbnail } from './utils'

import { TitleBar } from './components/TitleBar'
import { Sidebar, SIDEBAR_WIDTH, AppView } from './components/Sidebar'
import { PlayerBar } from './components/PlayerBar'
import { HomeView } from './components/HomeView'
import { SearchView } from './components/SearchView'
import { QueueView } from './components/QueueView'
import { FavoritesView } from './components/FavoritesView'
import { PlaylistsView } from './components/PlaylistsView'
import { LyricsView } from './components/LyricsView'
import { SettingsView } from './components/SettingsView'
import { ArtistView } from './components/ArtistView'

function PlayerApp() {
  const [view, setView] = useState<AppView>('home')
  const [selectedArtist, setSelectedArtist] = useState<{ name: string; avatar?: string } | null>(null)
  const [isFullscreenLyrics, setIsFullscreenLyrics] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const { settings } = useSettings()

  const handleSelectArtist = (artistName: string, avatarUrl?: string) => {
    setSelectedArtist({ name: artistName, avatar: avatarUrl })
    setView('artist')
    setIsFullscreenLyrics(false)
  }

  const {
    state, lyrics, howlRef,
    loadTrack, togglePlay, seek, seekToTime,
    setVolume, toggleMute,
    skipNext, skipPrev,
    setQueue, addToQueue,
    toggleShuffle, cycleRepeat,
  } = usePlayer()

  // Playing a track from anywhere opens the immersive Lyrics + Artwork view
  const handlePlay = (track: Track, results?: Track[]) => {
    if (results) setQueue(results)
    loadTrack(track)
    setIsFullscreenLyrics(true)
  }

  const handleAddToQueue = (tracks: Track[]) => {
    setQueue([...state.queue, ...tracks])
  }

  const handleQueuePlay = (track: Track) => {
    loadTrack(track)
    setIsFullscreenLyrics(true)
  }

  const handleNavigate = (newView: 'search' | 'favorites' | 'playlists') => {
    setView(newView)
    setIsFullscreenLyrics(false)
  }

  const handleSearchFromHome = (q: string) => {
    setSearchQuery(q)
    setView('search')
    setIsFullscreenLyrics(false)
  }

  // Global Spacebar Play/Pause & Ctrl+R reload handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyR' || e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'к')) {
        window.location.reload()
        return
      }
      if (e.key === 'F5') {
        window.location.reload()
        return
      }
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay])

  const currentThumbnail = state.currentTrack
    ? getThumbnail(state.currentTrack)
    : ''

  // Effective sidebar width
  const currentSidebarWidth = isSidebarOpen ? SIDEBAR_WIDTH : 0

  // Background style based on chosen blur material
  const renderBackground = () => {
    if (!state.currentTrack || !settings.backgroundBlur || settings.blurMaterial === 'none') {
      return (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            bgcolor: '#0a0d14',
            pointerEvents: 'none',
          }}
        />
      )
    }

    if (settings.blurMaterial === 'vibrant') {
      return (
        <>
          <Box
            sx={{
              position: 'fixed',
              inset: -30,
              zIndex: 0,
              backgroundImage: `url(${currentThumbnail})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `blur(${settings.backgroundBlurAmount}px) saturate(2.2) brightness(0.38)`,
              transform: 'scale(1.15)',
              pointerEvents: 'none',
              transition: 'background-image 0.8s ease',
            }}
          />
          <Box
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 0,
              background: 'radial-gradient(circle at center, rgba(208,188,255,0.08) 0%, rgba(10,13,20,0.7) 70%, rgba(10,13,20,0.95) 100%)',
              pointerEvents: 'none',
            }}
          />
        </>
      )
    }

    if (settings.blurMaterial === 'acrylic') {
      return (
        <>
          <Box
            sx={{
              position: 'fixed',
              inset: -30,
              zIndex: 0,
              backgroundImage: `url(${currentThumbnail})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `blur(${Math.max(settings.backgroundBlurAmount, 24)}px) saturate(1.8) brightness(0.45)`,
              transform: 'scale(1.15)',
              pointerEvents: 'none',
              transition: 'background-image 0.8s ease',
            }}
          />
          <Box
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 0,
              background: 'radial-gradient(ellipse at 50% 15%, rgba(255, 255, 255, 0.05) 0%, rgba(12, 16, 26, 0.65) 65%, rgba(8, 10, 16, 0.95) 100%)',
              pointerEvents: 'none',
            }}
          />
        </>
      )
    }

    if (settings.blurMaterial === 'glow') {
      return (
        <>
          <Box
            sx={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) scale(1.1)',
              width: '80vw',
              height: '80vw',
              maxWidth: 800,
              maxHeight: 800,
              zIndex: 0,
              borderRadius: '50%',
              backgroundImage: `url(${currentThumbnail})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `blur(${settings.backgroundBlurAmount + 30}px) saturate(1.8) brightness(0.35)`,
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 0,
              bgcolor: 'rgba(10, 13, 20, 0.55)',
              pointerEvents: 'none',
            }}
          />
        </>
      )
    }

    // Default 'ambient' (smooth & highly optimized)
    return (
      <>
        <Box
          sx={{
            position: 'fixed',
            inset: -30,
            zIndex: 0,
            backgroundImage: `url(${currentThumbnail})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: `blur(${settings.backgroundBlurAmount}px) saturate(1.8) brightness(0.3)`,
            transform: 'scale(1.15)',
            pointerEvents: 'none',
            transition: 'background-image 0.8s ease',
          }}
        />
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            background: 'radial-gradient(ellipse at center, rgba(10,13,20,0.15) 0%, rgba(10,13,20,0.72) 75%, rgba(10,13,20,0.96) 100%)',
            pointerEvents: 'none',
          }}
        />
      </>
    )
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw', bgcolor: '#0a0d14', overflow: 'hidden', position: 'relative' }}>
      {/* Top TitleBar with 3 Lines Hamburger Menu - always clickable */}
      <TitleBar onToggleSidebar={() => setIsSidebarOpen(prev => !prev)} />

      {/* Dynamic Background */}
      {renderBackground()}

      {/* Sidebar: slides in/out smoothly and can be toggled on ANY screen */}
      <Sidebar
        currentView={view}
        onView={(v) => {
          setView(v)
          setIsFullscreenLyrics(false)
        }}
        currentTrack={state.currentTrack}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenFullscreenLyrics={() => setIsFullscreenLyrics(true)}
      />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flex: 1,
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          pt: '42px',
          pb: isFullscreenLyrics ? 0 : '76px',
          position: 'relative',
          zIndex: 1,
          ml: isFullscreenLyrics ? 0 : `${currentSidebarWidth}px`,
          minHeight: 0,
          minWidth: 0,
          transition: 'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Fullscreen Lyrics + Artwork View (Active when playing / expanded) */}
        <Box
          sx={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            display: isFullscreenLyrics ? 'block' : 'none',
          }}
        >
          <LyricsView
            lines={lyrics.lines}
            plain={lyrics.plain}
            activeLine={lyrics.activeLine}
            loading={lyrics.loading}
            thumbnail={currentThumbnail}
            title={state.currentTrack
              ? cleanTitle(state.currentTrack.title, settings.exclusionWords)
              : ''}
            artist={state.currentTrack?.artist ?? ''}
            playerState={state}
            howlRef={howlRef}
            onTogglePlay={togglePlay}
            onNext={skipNext}
            onPrev={skipPrev}
            onShuffle={toggleShuffle}
            onRepeat={cycleRepeat}
            onSeek={seek}
            onSeekToTime={seekToTime}
            onCloseFullscreen={() => setIsFullscreenLyrics(false)}
          />
        </Box>

        {/* Views Container - stays mounted so searches and scroll position are never lost! */}
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            height: '100%',
            minHeight: 0,
            display: isFullscreenLyrics ? 'none' : 'flex',
            flexDirection: 'column',
          }}
        >
          {view === 'home' && (
            <Box sx={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
              <HomeView
                onPlay={handlePlay}
                onNavigate={handleNavigate}
                onSearchQuery={handleSearchFromHome}
              />
            </Box>
          )}

          <Box sx={{ height: '100%', minHeight: 0, width: '100%', minWidth: 0, overflowY: 'auto', overflowX: 'hidden', display: view === 'search' ? 'block' : 'none' }}>
            <SearchView
              onPlay={handlePlay}
              onAddToQueue={handleAddToQueue}
              initialQuery={searchQuery}
              onSelectArtist={handleSelectArtist}
            />
          </Box>

          <Box sx={{ height: '100%', minHeight: 0, overflowY: 'auto', display: view === 'artist' ? 'block' : 'none' }}>
            {selectedArtist && (
              <ArtistView
                artistName={selectedArtist.name}
                artistAvatar={selectedArtist.avatar}
                onBack={() => setView('search')}
                onPlay={handlePlay}
              />
            )}
          </Box>

          {view === 'queue' && (
            <Box sx={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
              <QueueView
                queue={state.queue}
                currentTrack={state.currentTrack}
                onPlay={handleQueuePlay}
              />
            </Box>
          )}

          {view === 'favorites' && (
            <Box sx={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
              <FavoritesView onPlay={handlePlay} />
            </Box>
          )}

          {view === 'playlists' && (
            <Box sx={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
              <PlaylistsView onPlay={handlePlay} />
            </Box>
          )}

          {view === 'settings' && (
            <Box sx={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
              <SettingsView />
            </Box>
          )}
        </Box>
      </Box>

      {/* Bottom PlayerBar - shown when NOT in fullscreen lyrics mode */}
      {!isFullscreenLyrics && (
        <PlayerBar
          state={state}
          howlRef={howlRef}
          sidebarWidth={currentSidebarWidth}
          onTogglePlay={togglePlay}
          onSeek={seek}
          onVolume={setVolume}
          onToggleMute={toggleMute}
          onNext={skipNext}
          onPrev={skipPrev}
          onShuffle={toggleShuffle}
          onRepeat={cycleRepeat}
          onOpenFullscreenLyrics={() => setIsFullscreenLyrics(true)}
        />
      )}
    </Box>
  )
}

export default function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <SettingsProvider>
        <PlayerApp />
      </SettingsProvider>
    </ThemeProvider>
  )
}
