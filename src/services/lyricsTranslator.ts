import { LrcLine } from '../types'

// Client-side in-memory translation cache (keyed by `${targetLang}:${text}`)
const clientCache = new Map<string, { translations: string[]; detectedLang?: string }>()

/**
 * Check if the text is heavily Cyrillic (Russian)
 */
export function isRussianText(text: string): boolean {
  const cyrillic = (text.match(/[а-яёА-ЯЁ]/g) || []).length
  const latin = (text.match(/[a-zA-Z]/g) || []).length
  return cyrillic > 15 && cyrillic > latin * 0.4
}

/**
 * Translates an array of LrcLine items into target language (RU or EN).
 * Automatically skips translation if song is already in target language:
 * - If targetLang is 'ru' and song is in Russian -> no translation.
 * - If targetLang is 'en' and song is in English -> no translation.
 */
export async function translateLyricsLines(
  lines: LrcLine[],
  targetLang: 'ru' | 'en'
): Promise<LrcLine[]> {
  if (!lines || lines.length === 0) return lines

  // 1. Quick check for Russian target language
  const combinedSample = lines.slice(0, 25).map(l => l.text).join(' ')
  if (targetLang === 'ru' && isRussianText(combinedSample)) {
    return lines
  }

  // 2. Cache lookup
  const cacheKey = `${targetLang}:${lines.length}:${lines.slice(0, 4).map(l => l.text).join('|')}`
  const cached = clientCache.get(cacheKey)
  if (cached) {
    if (cached.detectedLang === targetLang || !cached.translations.length) {
      return lines
    }
    return lines.map((line, idx) => ({
      ...line,
      translation: cached.translations[idx] || undefined,
    }))
  }

  try {
    const rawTexts = lines.map(l => l.text)
    let res: { success: boolean; translations?: string[]; detectedLang?: string; error?: string }

    if (window.melodix?.translateLyrics) {
      res = await window.melodix.translateLyrics(rawTexts, targetLang)
    } else {
      // Direct fallback
      const placeholder = '§§§'
      const payloadLines = rawTexts.map(t => {
        const trimmed = t.trim()
        if (!trimmed || trimmed === '•••' || trimmed === '...') return placeholder
        return trimmed
      })

      const fetchRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `q=${encodeURIComponent(payloadLines.join('\n'))}`
      })

      if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`)
      const data = await fetchRes.json()
      const detectedLang = data[2]
      const translatedFull = (data[0] || []).map((x: any) => x[0]).join('')
      const transParts = translatedFull.split('\n')

      const translations = rawTexts.map((orig, i) => {
        const trimmed = orig.trim()
        if (!trimmed || trimmed === '•••' || trimmed === '...') return ''
        const tr = transParts[i] || ''
        if (tr.includes(placeholder)) return ''
        return tr.trim()
      })

      res = { success: true, translations, detectedLang }
    }

    if (!res.success) {
      return lines
    }

    // Save in cache
    clientCache.set(cacheKey, {
      translations: res.translations || [],
      detectedLang: res.detectedLang,
    })

    // If source language matches target language, return lines untranslated
    if (res.detectedLang === targetLang || !res.translations || res.translations.length === 0) {
      return lines
    }

    return lines.map((line, idx) => {
      const tr = res.translations![idx]
      return {
        ...line,
        translation: tr && tr.trim() ? tr.trim() : undefined,
      }
    })
  } catch (err) {
    console.warn('[LyricsTranslator] Translation skipped/failed:', err)
    return lines
  }
}

/**
 * Translates plain lyrics paragraph if language differs from target.
 */
export async function translatePlainLyrics(
  plainText: string,
  targetLang: 'ru' | 'en'
): Promise<string | undefined> {
  if (!plainText || !plainText.trim()) return undefined

  if (targetLang === 'ru' && isRussianText(plainText)) {
    return undefined
  }

  const cacheKey = `plain:${targetLang}:${plainText.slice(0, 100)}`
  const cached = clientCache.get(cacheKey)
  if (cached) {
    return cached.translations[0] || undefined
  }

  try {
    const res = await window.melodix?.translateLyrics?.([plainText], targetLang)
    if (res?.success && res.translations && res.translations[0]) {
      if (res.detectedLang === targetLang) {
        clientCache.set(cacheKey, { translations: [], detectedLang: res.detectedLang })
        return undefined
      }
      const translation = res.translations[0]
      clientCache.set(cacheKey, { translations: [translation], detectedLang: res.detectedLang })
      return translation
    }
  } catch {}
  return undefined
}
