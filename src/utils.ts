import { LrcLine } from './types'

/** Parse LRC format: [mm:ss.xx] text */
export function parseLrc(lrc: string): LrcLine[] {
  const lines: LrcLine[] = []
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/

  for (const raw of lrc.split('\n')) {
    const match = raw.match(regex)
    if (!match) continue
    const min = parseInt(match[1])
    const sec = parseInt(match[2])
    const ms = parseInt(match[3].padEnd(3, '0'))
    const text = match[4].trim()
    if (text) {
      lines.push({ time: min * 60 + sec + ms / 1000, text })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

/** Format seconds → m:ss */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Get currently active lyric line index via fast binary search O(log N) */
export function getActiveLine(lines: LrcLine[], currentTime: number): number {
  if (!lines || lines.length === 0 || currentTime < lines[0].time) return -1

  let low = 0
  let high = lines.length - 1
  let ans = -1

  while (low <= high) {
    const mid = (low + high) >> 1
    if (lines[mid].time <= currentTime) {
      ans = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return ans
}

/**
 * Strip exclusion words from a track title.
 * Removes patterns like (Official Video), [HD], - Official Audio, etc.
 */
export function cleanTitle(title: string, exclusionWords: string[]): string {
  if (!title) return title
  let clean = title

  for (const word of exclusionWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Remove inside brackets/parens
    clean = clean.replace(new RegExp(`[\\[\\(]\\s*${escaped}\\s*[\\]\\)]`, 'gi'), '')
    // Remove after dash/pipe with optional spaces
    clean = clean.replace(new RegExp(`[-–|]\\s*${escaped}\\s*`, 'gi'), '')
    // Remove standalone at end
    clean = clean.replace(new RegExp(`\\s*${escaped}\\s*$`, 'gi'), '')
  }

  return clean.trim().replace(/\s+/g, ' ').replace(/[-–|]\s*$/, '').trim()
}

/** Get thumbnail URL, falling back to YouTube format */
export function getThumbnail(track: { thumbnail?: string; id: string }): string {
  if (track.thumbnail && track.thumbnail.startsWith('http')) return track.thumbnail
  return `https://img.youtube.com/vi/${track.id}/mqdefault.jpg`
}

/** Detect if song has explicit language (profanity in title or lyrics) */
const EXPLICIT_REGEX = /\b(fuck|fucking|fucked|shit|bitch|cunt|dick|pussy|asshole|motherfucker|nigga|nigger|хуй|хуя|хуе|нахуй|похуй|пизд|пиздец|ебат|ебан|выеб|въеб|заеб|бля|бляд|сука|сучка|мудак|гондон|дроч)\b/i

export function detectExplicit(title: string, lyricsText?: string): boolean {
  if (EXPLICIT_REGEX.test(title)) return true
  if (lyricsText && EXPLICIT_REGEX.test(lyricsText)) return true
  return false
}

/**
 * Smart extraction and cleanup of artist and title from media strings.
 * Handles "Artist - Title", VEVO suffixes, Topic channels, and record labels.
 */
export function extractArtistAndTitle(rawTitle: string, rawArtist: string): { artist: string; title: string } {
  let artist = (rawArtist || '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/^@/, '')
    .replace(/VEVO$/i, '')
    .replace(/\s*Official\s*$/i, '')
    .trim()

  let title = rawTitle || ''

  if (title.includes(' - ')) {
    const parts = title.split(' - ')
    const part0 = parts[0].trim()
    const part1 = parts.slice(1).join(' - ').trim()

    // If channel is missing or a generic distributor / uploader
    const isGenericUploader = !artist || artist === 'Unknown Artist' ||
      /records|recording|label|music\s*video|channel|vevo|entertainment|media|uploads|topics|lyrics|audio/i.test(artist)

    if (isGenericUploader) {
      artist = part0
      title = part1
    } else if (part0.toLowerCase() === artist.toLowerCase()) {
      title = part1
    } else if (part0.length > 1 && part0.length < 35 && !title.toLowerCase().startsWith('http')) {
      // If title begins with "Artist Name - Song Name", prefer the artist from the title
      artist = part0
      title = part1
    }
  }

  return { artist: artist || 'Unknown Artist', title }
}

/** Check if search result is a valid, playable single track */
export function isPlayableTrack(track: { title: string; artist: string; duration?: number; id?: string }): boolean {
  if (!track.title || !track.title.trim()) return false
  const t = track.title.trim().toLowerCase()

  // Filter out playlists, full albums, compilation mixes, and non-music videos
  if (
    t.includes('playlist') ||
    t.includes('full album') ||
    t.includes('compilation') ||
    t.includes('greatest hits album') ||
    t.includes('1 hour') ||
    t.includes('10 hour') ||
    t.includes('discography') ||
    /\b(reaction|reacting|interview|review|podcast|guitar lesson|chords|tabs|how to play|vlog|trailer|teaser|behind the scenes)\b/i.test(t)
  ) {
    return false
  }

  // Filter out playlist ID prefixes (PL, VL, RD, UC)
  if (track.id && (track.id.startsWith('PL') || track.id.startsWith('VL') || track.id.startsWith('RD') || track.id.startsWith('UC'))) {
    return false
  }

  if (track.duration && (track.duration > 900 || track.duration < 15)) return false // 15s to 15m

  return true
}

/**
 * Inserts instrumental break lines ('•••') when:
 * 1. The intro before the first lyric is > 4 seconds.
 * 2. The gap between consecutive lyrics lines is >= 7 seconds.
 */
export function prepareLyricsWithInstrumentals(lines: LrcLine[]): LrcLine[] {
  if (!lines || lines.length === 0) return []
  const result: LrcLine[] = []

  // If there's an instrumental intro before the first vocal line (> 4s)
  if (lines[0].time > 4) {
    result.push({ time: 0, text: '•••' })
  }

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i])

    // Check gap to the next line
    if (i < lines.length - 1) {
      const currentLineTime = lines[i].time
      const nextLineTime = lines[i + 1].time
      const gap = nextLineTime - currentLineTime

      // If gap is longer than 7 seconds, insert an instrumental break line ('•••')
      if (gap >= 7) {
        const breakStart = currentLineTime + Math.min(4.5, gap * 0.45)
        result.push({ time: breakStart, text: '•••' })
      }
    }
  }

  return result
}
