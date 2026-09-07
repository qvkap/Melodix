import React, { useState } from 'react'
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material'
import { Box } from '@mui/material'
import { buildAppTheme } from './theme'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { usePlayer } from './hooks/usePlayer'
import { Track } from './types'
import { cleanTitle, getThumbnail } from './utils'

import { TitleBar } from './components/TitleBar'
import { Sidebar, SIDEBAR_WIDTH, AppView } from './components/Sidebar'
import { PlayerBar } from './components/PlayerBar'
import { MobileBottomBar, MobileBarStyle } from './components/MobileBottomBar'
import { detectMobilePlatform } from './services/mobileBridge'
import { HomeView } from './components/HomeView'
import { SearchView } from './components/SearchView'
import { QueueView } from './components/QueueView'
import { FavoritesView } from './components/FavoritesView'
import { PlaylistsView } from './components/PlaylistsView'
import { LyricsView } from './components/LyricsView'
import { SettingsView } from './components/SettingsView'
import { ArtistView } from './components/ArtistView'
import { LocalView } from './components/LocalView'

function PlayerApp() {
  const [view, setView] = useState<AppView>('home')
  const [selectedArtist, setSelectedArtist] = useState<{ name: string; avatar?: string } | null>(null)
  const [isFullscreenLyrics, setIsFullscreenLyrics] = useState(() => window.location.search.includes('demo=lyrics') || window.location.search.includes('demo=1'))
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !window.location.search.includes('demo'))
  const [searchQuery, setSearchQuery] = useState('')

  const { settings } = useSettings()

  const isSmallScreen = useMediaQuery('(max-width: 768px)')
  const detectedPlatform = React.useMemo(() => detectMobilePlatform(), [])
  const isMobile = isSmallScreen || detectedPlatform !== 'desktop'
  const isBottomBarActive = isMobile && (settings.mobileNavMode || 'bottom') === 'bottom'
  const isSidebarActive = !isMobile || settings.mobileNavMode === 'sidebar'

  const effectiveBarStyle: MobileBarStyle = React.useMemo(() => {
    if (settings.mobileBarStyle === 'ios') return 'ios'
    if (settings.mobileBarStyle === 'android') return 'android'
    return detectedPlatform === 'ios' ? 'ios' : 'android'
  }, [settings.mobileBarStyle, detectedPlatform])

  const mobileBarHeight = effectiveBarStyle === 'ios' ? 86 : 76
  const bottomOffset = isBottomBarActive ? mobileBarHeight : 0

  const handleSelectArtist = (artistName: string, avatarUrl?: string) => {
    setSelectedArtist({ name: artistName, avatar: avatarUrl })
    setView('artist')
    setIsFullscreenLyrics(false)
  }

  const {
    state, setState, lyrics, setLyrics, howlRef,
    loadTrack, togglePlay, seek, seekToTime,
    setVolume, toggleMute,
    skipNext, skipPrev,
    setQueue, addToQueue,
    toggleShuffle, cycleRepeat,
  } = usePlayer()

  // Demo state for screenshot capture
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const demo = params.get('demo')
    if (demo === 'lyrics' || demo === '1') {
      const demoTrack: Track = {
        id: 'demo-nyan',
        title: 'У батарей [Official Audio]',
        artist: 'nyan.mp3',
        album: 'У батарей',
        duration: 182,
        thumbnail: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/8d/c8/4b/8dc84b57-e684-0c95-4516-55d3235f2687/cover.jpg/1000x1000bb.jpg',
      }
      const demoLines = [
        { time: 0, text: '• • •' },
        { time: 5, text: 'У батарей как на жаре' },
        { time: 10, text: 'Тёплые ночи в январе' },
        { time: 15, text: 'Заварю чай, ты постучал' },
        { time: 20, text: 'А я иду открывать дверь' },
        { time: 25, text: 'У батарей как на жаре' },
        { time: 30, text: 'Тёплые ночи в январе' },
        { time: 35, text: 'Я так скучал... (Мяу, nyan.mp3)' },
        { time: 40, text: 'Твой телефонный номер не отвечает больше (А-а-а)' },
        { time: 48, text: 'Я так хотел бы рядом быть с тобою этой ночью (Ночью)' },
        { time: 54, text: 'Новый год наступил (Ступил), по привычке купил' },
        { time: 60, text: 'Тебе подарок, хотя, вряд ли всё будет как раньше' },
        { time: 66, text: 'Оба на год стали старше' },
        { time: 72, text: 'У тебя бизнес, продажи' },
        { time: 78, text: 'Время другое, пейзажи' },
      ]
      setState(s => ({
        ...s,
        currentTrack: demoTrack,
        isPlaying: true,
        progress: 48 / 182,
        currentTime: 48,
        duration: 182,
      }))
      setLyrics({
        lines: demoLines,
        plain: '',
        activeLine: 9,
        loading: false,
      })
      setIsSidebarOpen(false)
      setIsFullscreenLyrics(true)
    } else if (demo === 'mobile') {
      const demoTrack: Track = {
        id: 'demo-nyan',
        title: 'У батарей [Official Audio]',
        artist: 'nyan.mp3',
        album: 'У батарей',
        duration: 182,
        thumbnail: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/8d/c8/4b/8dc84b57-e684-0c95-4516-55d3235f2687/cover.jpg/1000x1000bb.jpg',
      }
      setState(s => ({
        ...s,
        currentTrack: demoTrack,
        isPlaying: true,
        progress: 48 / 182,
        currentTime: 48,
        duration: 182,
      }))
      setIsFullscreenLyrics(false)
    }
  }, [setState, setLyrics])

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

  // Effective sidebar width (hidden during fullscreen lyrics)
  const isSidebarVisible = isSidebarActive && isSidebarOpen && !isFullscreenLyrics
  const currentSidebarWidth = isSidebarVisible ? SIDEBAR_WIDTH : 0

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
      {/* Top TitleBar: hamburger menu only shown if sidebar navigation is active */}
      <TitleBar
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        showSidebarToggle={isSidebarActive}
      />

      {/* Dynamic Background */}
      {renderBackground()}

      {/* Sidebar: only rendered when sidebar navigation is active */}
      {isSidebarActive && (
        <Sidebar
          currentView={view}
          onView={(v) => {
            setView(v)
            setIsFullscreenLyrics(false)
            if (isMobile) setIsSidebarOpen(false)
          }}
          currentTrack={state.currentTrack}
          isOpen={isSidebarVisible}
          onClose={() => setIsSidebarOpen(false)}
          onOpenFullscreenLyrics={() => setIsFullscreenLyrics(true)}
        />
      )}

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
          pb: isFullscreenLyrics ? 0 : (isBottomBarActive ? `${mobileBarHeight + (state.currentTrack ? 94 : 16)}px` : (state.currentTrack ? '100px' : '30px')),
          position: 'relative',
          zIndex: 1,
          ml: isFullscreenLyrics ? 0 : (isBottomBarActive ? 0 : `${currentSidebarWidth}px`),
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
              <FavoritesView
                onPlay={handlePlay}
                onAddToQueue={handleAddToQueue}
                onSelectArtist={handleSelectArtist}
              />
            </Box>
          )}

          {view === 'local' && (
            <Box sx={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
              <LocalView
                onPlay={handlePlay}
                onAddToQueue={handleAddToQueue}
                currentTrackId={state.currentTrack?.id}
              />
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
          sidebarWidth={isBottomBarActive ? 0 : currentSidebarWidth}
          bottomOffset={bottomOffset}
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

      {/* Mobile Bottom Navigation Bar (iOS Liquid Glass / Android Material You) */}
      {isBottomBarActive && !isFullscreenLyrics && (
        <MobileBottomBar
          currentView={view}
          onView={(v) => {
            setView(v)
            setIsFullscreenLyrics(false)
          }}
          style={effectiveBarStyle}
        />
      )}
    </Box>
  )
}

function ThemedApp() {
  const { settings } = useSettings()
  const theme = React.useMemo(() => buildAppTheme(settings.accentColor), [settings.accentColor])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PlayerApp />
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <ThemedApp />
    </SettingsProvider>
  )
}
