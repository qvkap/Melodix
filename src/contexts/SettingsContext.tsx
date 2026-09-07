import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Track, Playlist, BlurMaterial, AppLanguage, Album, FavoriteArtist } from '../types'
import { translations } from '../i18n'

export interface Settings {
  language: AppLanguage
  blurMaterial: BlurMaterial
  backgroundBlur: boolean
  backgroundBlurAmount: number      // 20–150
  lyricsBlurFuture: boolean
  accentColorMode: 'custom' | 'system'
  accentColor: string
  exclusionWords: string[]
  mobileBarStyle: 'auto' | 'ios' | 'android'
  mobileNavMode: 'bottom' | 'sidebar'
  // Last.fm
  lastfmEnabled: boolean
  lastfmApiKey: string
  lastfmSecret: string
  lastfmUsername: string
  lastfmSessionKey: string
  // User library
  favorites: Track[]
  favoriteAlbums: Album[]
  favoriteArtists: FavoriteArtist[]
  playlists: Playlist[]
  recentlyPlayed: Track[]
}

const DEFAULTS: Settings = {
  language: 'ru',
  blurMaterial: 'ambient',
  backgroundBlur: true,
  backgroundBlurAmount: 75,
  lyricsBlurFuture: true,
  accentColorMode: 'custom',
  accentColor: '#d0bcff',
  exclusionWords: [
    'Official Video', 'Official Audio', 'Official Music Video',
    'Official Lyric Video', 'Lyric Video', 'Music Video',
    'Official MV', 'MV', 'Official', 'HD', 'HQ', '4K',
    'Full HD', 'Audio Only', 'Visualizer', 'Live', 'Live Performance',
    'Topic', 'Lyrics', 'Audio'
  ],
  mobileBarStyle: 'auto',
  mobileNavMode: 'bottom',
  lastfmEnabled: false,
  lastfmApiKey: '',
  lastfmSecret: '',
  lastfmUsername: '',
  lastfmSessionKey: '',
  favorites: [],
  favoriteAlbums: [],
  favoriteArtists: [],
  playlists: [
    {
      id: 'pl-favorites-default',
      name: 'Любимые треки',
      tracks: [],
      createdAt: Date.now(),
    }
  ],
  recentlyPlayed: [],
}

interface SettingsCtx {
  settings: Settings
  t: Record<keyof typeof translations['ru'], string>
  update: (patch: Partial<Settings>) => void
  resetExclusions: () => void
  toggleFavorite: (track: Track) => boolean
  isFavorite: (trackId: string) => boolean
  toggleFavoriteAlbum: (album: Album) => boolean
  isFavoriteAlbum: (albumId: string) => boolean
  toggleFavoriteArtist: (artist: FavoriteArtist) => boolean
  isFavoriteArtist: (artistName: string) => boolean
  createPlaylist: (name: string) => void
  deletePlaylist: (id: string) => void
  addTrackToPlaylist: (playlistId: string, track: Track) => void
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void
  addToRecentlyPlayed: (track: Track) => void
}

const Ctx = createContext<SettingsCtx>({} as any)

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem('melodix-settings-v2')
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
    } catch {}
    return DEFAULTS
  })

  useEffect(() => {
    localStorage.setItem('melodix-settings-v2', JSON.stringify(settings))
  }, [settings])

  // Sync with Windows / System Accent Color when mode is 'system'
  useEffect(() => {
    if (settings.accentColorMode === 'system' && window.melodix?.getSystemAccentColor) {
      window.melodix.getSystemAccentColor().then(res => {
        if (res?.success && res.color) {
          setSettings(s => ({ ...s, accentColor: res.color! }))
        }
      })
    }

    if (window.melodix?.onSystemAccentColorChanged) {
      const unsub = window.melodix.onSystemAccentColorChanged((newColor) => {
        setSettings(s => {
          if (s.accentColorMode === 'system') {
            return { ...s, accentColor: newColor }
          }
          return s
        })
      })
      return () => unsub?.()
    }
  }, [settings.accentColorMode])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(s => ({ ...s, ...patch }))
  }, [])

  const resetExclusions = useCallback(() => {
    setSettings(s => ({ ...s, exclusionWords: DEFAULTS.exclusionWords }))
  }, [])

  const isFavorite = useCallback((trackId: string) => {
    return settings.favorites.some(t => t.id === trackId)
  }, [settings.favorites])

  const toggleFavorite = useCallback((track: Track) => {
    let nowFav = false
    setSettings(s => {
      const exists = s.favorites.some(t => t.id === track.id)
      nowFav = !exists
      const newFavs = exists
        ? s.favorites.filter(t => t.id !== track.id)
        : [track, ...s.favorites]
      return { ...s, favorites: newFavs }
    })
    return nowFav
  }, [])

  const isFavoriteAlbum = useCallback((albumId: string) => {
    return (settings.favoriteAlbums || []).some(a => a.id === albumId)
  }, [settings.favoriteAlbums])

  const toggleFavoriteAlbum = useCallback((album: Album) => {
    let nowFav = false
    setSettings(s => {
      const list = s.favoriteAlbums || []
      const exists = list.some(a => a.id === album.id)
      nowFav = !exists
      const newList = exists ? list.filter(a => a.id !== album.id) : [album, ...list]
      return { ...s, favoriteAlbums: newList }
    })
    return nowFav
  }, [])

  const isFavoriteArtist = useCallback((artistName: string) => {
    const clean = (artistName || '').trim().toLowerCase()
    return (settings.favoriteArtists || []).some(a => (a.name || '').trim().toLowerCase() === clean)
  }, [settings.favoriteArtists])

  const toggleFavoriteArtist = useCallback((artist: FavoriteArtist) => {
    let nowFav = false
    const clean = (artist.name || '').trim().toLowerCase()
    setSettings(s => {
      const list = s.favoriteArtists || []
      const exists = list.some(a => (a.name || '').trim().toLowerCase() === clean)
      nowFav = !exists
      const newList = exists
        ? list.filter(a => (a.name || '').trim().toLowerCase() !== clean)
        : [artist, ...list]
      return { ...s, favoriteArtists: newList }
    })
    return nowFav
  }, [])

  const createPlaylist = useCallback((name: string) => {
    if (!name.trim()) return
    const newPl: Playlist = {
      id: 'pl-' + Date.now(),
      name: name.trim(),
      tracks: [],
      createdAt: Date.now(),
    }
    setSettings(s => ({ ...s, playlists: [...s.playlists, newPl] }))
  }, [])

  const deletePlaylist = useCallback((id: string) => {
    setSettings(s => ({ ...s, playlists: s.playlists.filter(p => p.id !== id) }))
  }, [])

  const addTrackToPlaylist = useCallback((playlistId: string, track: Track) => {
    setSettings(s => ({
      ...s,
      playlists: s.playlists.map(pl => {
        if (pl.id === playlistId) {
          if (pl.tracks.some(t => t.id === track.id)) return pl
          return { ...pl, tracks: [...pl.tracks, track] }
        }
        return pl
      }),
    }))
  }, [])

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setSettings(s => ({
      ...s,
      playlists: s.playlists.map(pl => {
        if (pl.id === playlistId) {
          return { ...pl, tracks: pl.tracks.filter(t => t.id !== trackId) }
        }
        return pl
      }),
    }))
  }, [])

  const addToRecentlyPlayed = useCallback((track: Track) => {
    setSettings(s => {
      const filtered = s.recentlyPlayed.filter(t => t.id !== track.id)
      return {
        ...s,
        recentlyPlayed: [track, ...filtered].slice(0, 30),
      }
    })
  }, [])

  const currentT = translations[settings.language] || translations.ru

  return (
    <Ctx.Provider
      value={{
        settings,
        t: currentT,
        update,
        resetExclusions,
        toggleFavorite,
        isFavorite,
        toggleFavoriteAlbum,
        isFavoriteAlbum,
        toggleFavoriteArtist,
        isFavoriteArtist,
        createPlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        addToRecentlyPlayed,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useSettings = () => useContext(Ctx)
