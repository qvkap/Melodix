import { LrcLine, LrcWord } from './types'

/**
 * Parse inline word-by-word timestamps from Enhanced LRC lines.
 * Supports <mm:ss.xx> word, (mm:ss.xx) word formats.
 */
function parseEnhancedWords(rawText: string, lineTime: number): LrcWord[] | null {
  const tagRegex = /[<(](\d{2}):(\d{2})\.(\d{2,3})[>)]/g
  if (!tagRegex.test(rawText)) {
    return null
  }
  tagRegex.lastIndex = 0

  const tokens = [...rawText.matchAll(/([<(](\d{2}):(\d{2})\.(\d{2,3})[>)]\s*)*([^<>()\[\]\n\r]+)/g)]
  if (tokens.length === 0) return null

  const parsedWords: LrcWord[] = []
  let lastTimestamp = lineTime

  for (let i = 0; i < tokens.length; i++) {
    const fullMatch = tokens[i][0]
    const wordText = tokens[i][5]?.trim()
    if (!wordText) continue

    const tagMatch = fullMatch.match(/[<(](\d{2}):(\d{2})\.(\d{2,3})[>)]/)
    let wordStart = lastTimestamp
    if (tagMatch) {
      const min = parseInt(tagMatch[1])
      const sec = parseInt(tagMatch[2])
      const ms = parseInt(tagMatch[3].padEnd(3, '0'))
      wordStart = min * 60 + sec + ms / 1000
      lastTimestamp = wordStart
    }

    parsedWords.push({
      text: wordText,
      startTime: wordStart,
      endTime: wordStart + 0.4,
    })
  }

  if (parsedWords.length === 0) return null

  for (let i = 0; i < parsedWords.length; i++) {
    if (i < parsedWords.length - 1) {
      parsedWords[i].endTime = Math.max(parsedWords[i].startTime + 0.1, parsedWords[i + 1].startTime)
    } else {
      parsedWords[i].endTime = parsedWords[i].startTime + 0.6
    }
  }

  return parsedWords
}

/**
 * Advanced Musical Cadence Word-Timing Generator.
 * 
 * Accurately syncs lyrics to musical rhythm and vocal tempo:
 * 1. Phonetic syllabic weight:
 *    - Short auxiliary words ("a", "to", "in", "я", "и", "в", "на", "ты") take ~160-220ms.
 *    - Multi-syllable words take ~220ms per vowel + ~25ms per consonant.
 *    - Rhyme / final word of line is sustained (~1.6x-2.2x duration).
 * 2. Musical cadence bounding:
 *    - Never artificially stretch a short vocal phrase across a long instrumental gap!
 *    - If gap is long (e.g. 5-8s), phrase plays at its true vocal duration (~2-3s)
 *      and rests illuminated until the next bar.
 *    - If gap is tight (e.g. fast rap/chatter), words compress smoothly without clipping.
 */
export function generateWordTimings(lines: LrcLine[]): LrcLine[] {
  if (!lines || lines.length === 0) return []

  return lines.map((line, i) => {
    if (line.text === '•••' || line.text === '...' || (line.words && line.words.length > 0)) {
      return line
    }

    const rawWords = line.text.trim().split(/\s+/).filter(Boolean)
    if (rawWords.length === 0) {
      return line
    }

    const nextLine = lines[i + 1]
    const nextLineTime = nextLine ? nextLine.time : line.time + Math.max(3.0, rawWords.length * 0.5)
    const rawGap = Math.max(0.4, nextLineTime - line.time)

    // Calculate natural phonetic duration for each word in average singing tempo
    const rawDurations = rawWords.map((word, idx) => {
      const isFirst = idx === 0
      const isLast = idx === rawWords.length - 1

      const cleanLetters = word.replace(/[^\p{L}\p{N}]/gu, '')
      const vowels = word.match(/[aeiouyаеёиоуыэюя]/gi)
      const vowelCount = vowels ? vowels.length : 1
      const consonantCount = Math.max(0, cleanLetters.length - vowelCount)

      // Syllabic basis: ~220ms per vowel in average tempo singing
      let duration = vowelCount * 0.22 + consonantCount * 0.025

      // Minimum duration: even a 1-letter word needs ~160ms to be vocalized
      duration = Math.max(0.16, duration)

      // Very short auxiliary words (articles, prepositions, conjunctions) are sung fast
      if (cleanLetters.length <= 2 && vowelCount === 1) {
        duration = Math.min(duration, 0.22)
      }

      // Initial word pick-up (anacrusis): slightly crisper attack
      if (isFirst && rawWords.length > 2) {
        duration *= 0.92
      }

      // Final word of line: in almost every song, the rhyme is sustained!
      if (isLast) {
        duration = Math.max(duration * 1.75, 0.55)
      }

      // Punctuation pauses
      if (/[,;:\-]$/.test(word)) {
        duration += 0.12
      } else if (/[.!?]$/.test(word)) {
        duration += 0.22
      }

      return duration
    })

    const naturalTotalDuration = rawDurations.reduce((sum, d) => sum + d, 0)

    // Available vocal window: singer usually takes a breath ~0.25-0.4s before the next line
    const maxAvailableVocalWindow = Math.max(0.3, rawGap - Math.min(0.35, rawGap * 0.1))

    let effectivePhraseDuration: number

    if (naturalTotalDuration > maxAvailableVocalWindow) {
      // Fast tempo / rap / tight lines: compress phrase to fit the window
      effectivePhraseDuration = maxAvailableVocalWindow
    } else {
      // Gap is larger than natural phrase duration.
      // E.g. gap is 5.0s, natural duration is 2.4s.
      // DO NOT stretch the phrase all the way to 5s!
      // Allow only a gentle musical expansion up to 1.35x natural duration, capped well before next line
      const allowedExpansion = naturalTotalDuration * 1.3
      effectivePhraseDuration = Math.min(allowedExpansion, maxAvailableVocalWindow)
    }

    const scaleFactor = effectivePhraseDuration / naturalTotalDuration
    let currentStart = line.time
    const words: LrcWord[] = []

    for (let j = 0; j < rawWords.length; j++) {
      const wordDur = rawDurations[j] * scaleFactor
      const end = currentStart + wordDur
      words.push({
        text: rawWords[j],
        startTime: currentStart,
        endTime: end,
      })
      currentStart = end
    }

    return {
      ...line,
      words,
    }
  })
}

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
    const rawContent = match[4].trim()
    if (!rawContent) continue

    const time = min * 60 + sec + ms / 1000

    const enhancedWords = parseEnhancedWords(rawContent, time)
    const cleanText = rawContent
      .replace(/[<(]\d{2}:\d{2}\.\d{2,3}[>)]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (cleanText) {
      lines.push({
        time,
        text: cleanText,
        words: enhancedWords || undefined,
      })
    }
  }

  const sorted = lines.sort((a, b) => a.time - b.time)
  return generateWordTimings(sorted)
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
  if (track.thumbnail && (track.thumbnail.startsWith('http') || track.thumbnail.startsWith('data:') || track.thumbnail.startsWith('blob:'))) {
    return track.thumbnail
  }
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

/**
 * Format track count with proper Russian pluralization:
 * 1 трек, 2-4 трека, 5-20 треков, 21 трек, etc.
 */
export function formatTrackCount(count: number): string {
  if (!count || count <= 0) return ''
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10

  if (mod100 >= 11 && mod100 <= 19) {
    return `${count} треков`
  }
  if (mod10 === 1) {
    return `${count} трек`
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} трека`
  }
  return `${count} треков`
}
