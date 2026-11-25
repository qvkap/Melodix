import React, { useEffect, useRef, useState } from 'react'

interface AppleMusicBackgroundProps {
  currentCover: string
  isPlaying?: boolean
  blurAmount?: number
}

// Fallback palette: neutral deep slate (used only if cover is missing)
const DEFAULT_FALLBACK_PALETTE = [
  'rgb(35, 45, 65)',
  'rgb(25, 35, 55)',
  'rgb(40, 50, 70)',
  'rgb(20, 30, 48)',
]

interface ColorCluster {
  r: number
  g: number
  b: number
  count: number
}

const paletteCache = new Map<string, string[]>()

// Extracts the TRUE dominant colors from the album cover based on surface area
async function extractColorsFromImage(imgUrl: string): Promise<string[]> {
  if (!imgUrl) return DEFAULT_FALLBACK_PALETTE
  const cached = paletteCache.get(imgUrl)
  if (cached) return cached

  let objectUrl = ''
  let isBlob = false

  try {
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
      try {
        const res = await fetch(imgUrl)
        if (res.ok) {
          const blob = await res.blob()
          objectUrl = URL.createObjectURL(blob)
          isBlob = true
        }
      } catch {
        objectUrl = imgUrl
      }
    } else {
      objectUrl = imgUrl
    }

    const img = new Image()

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = objectUrl
    })

    if (isBlob) {
      URL.revokeObjectURL(objectUrl)
    }

    const canvas = document.createElement('canvas')
    const size = 64
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return DEFAULT_FALLBACK_PALETTE

    ctx.drawImage(img, 0, 0, size, size)
    const imgData = ctx.getImageData(0, 0, size, size).data

    // Quantize into 5-bit color buckets (32x32x32 = 32768 possible cells)
    const bucketCounts: { [key: number]: { rSum: number; gSum: number; bSum: number; count: number } } = {}

    let totalR = 0, totalG = 0, totalB = 0, validPixelCount = 0
    let isMonochrome = true

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i]
      const g = imgData[i + 1]
      const b = imgData[i + 2]
      const a = imgData[i + 3]
      if (a < 128) continue

      // Check if cover has chromatic color or is black-and-white
      if (Math.abs(r - g) > 14 || Math.abs(r - b) > 14 || Math.abs(g - b) > 14) {
        isMonochrome = false
      }

      totalR += r
      totalG += g
      totalB += b
      validPixelCount++

      // Quantize 8-bit to 5-bit (0-31)
      const qR = r >> 3
      const qG = g >> 3
      const qB = b >> 3
      const key = (qR << 10) | (qG << 5) | qB

      if (!bucketCounts[key]) {
        bucketCounts[key] = { rSum: r, gSum: g, bSum: b, count: 1 }
      } else {
        bucketCounts[key].rSum += r
        bucketCounts[key].gSum += g
        bucketCounts[key].bSum += b
        bucketCounts[key].count++
      }
    }

    if (validPixelCount === 0) return DEFAULT_FALLBACK_PALETTE

    // If the cover is black & white / grayscale, return strictly monochrome grayscale shades!
    if (isMonochrome) {
      const avg = Math.round((totalR + totalG + totalB) / (validPixelCount * 3))
      // Scale brightness so white lyrics remain 100% visible
      const baseGray = Math.max(30, Math.min(100, avg))
      return [
        `rgb(${baseGray}, ${baseGray}, ${baseGray})`,
        `rgb(${Math.max(20, baseGray - 15)}, ${Math.max(20, baseGray - 15)}, ${Math.max(20, baseGray - 15)})`,
        `rgb(${Math.min(115, baseGray + 20)}, ${Math.min(115, baseGray + 20)}, ${Math.min(115, baseGray + 20)})`,
        `rgb(${Math.max(25, baseGray - 8)}, ${Math.max(25, baseGray - 8)}, ${Math.max(25, baseGray - 8)})`,
      ]
    }

    // Convert buckets to color clusters
    const rawClusters: ColorCluster[] = Object.values(bucketCounts).map((b) => ({
      r: Math.round(b.rSum / b.count),
      g: Math.round(b.gSum / b.count),
      b: Math.round(b.bSum / b.count),
      count: b.count,
    }))

    // Sort by pixel population (most dominant colors on the cover first)
    rawClusters.sort((a, b) => b.count - a.count)

    // Merge clusters that are visually very close (Euclidean distance in RGB < 45)
    const distinctColors: ColorCluster[] = []
    for (const cluster of rawClusters) {
      // Must cover at least 0.5% of the cover image to be considered a real color of the artwork
      if (cluster.count < validPixelCount * 0.005) continue

      const isTooClose = distinctColors.some((existing) => {
        const dr = cluster.r - existing.r
        const dg = cluster.g - existing.g
        const db = cluster.b - existing.b
        const dist = Math.sqrt(dr * dr + dg * dg + db * db)
        return dist < 45
      })

      if (!isTooClose) {
        distinctColors.push(cluster)
      }
      if (distinctColors.length >= 4) break
    }

    // Normalize color brightness for Apple Music background:
    // White text must remain sharp and legible (luminance clamped between 40 and 125)
    const formatColor = (c: ColorCluster, brightnessAdjust = 1.0) => {
      let r = c.r * brightnessAdjust
      let g = c.g * brightnessAdjust
      let b = c.b * brightnessAdjust

      // Standard perceived luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b

      if (lum > 130) {
        // Too bright (would wash out white lyrics): gently darken while preserving hue
        const factor = 120 / lum
        r *= factor
        g *= factor
        b *= factor
      } else if (lum < 35) {
        // Too dark (would be pitch black): gently lift while preserving hue
        const factor = 45 / lum
        r *= factor
        g *= factor
        b *= factor
      }

      return `rgb(${Math.round(Math.max(0, Math.min(255, r)))}, ${Math.round(
        Math.max(0, Math.min(255, g))
      )}, ${Math.round(Math.max(0, Math.min(255, b)))})`
    }

    if (distinctColors.length === 0) {
      return DEFAULT_FALLBACK_PALETTE
    }

    // Build the final 4-color palette strictly from the cover's actual dominant colors
    const finalPalette: string[] = []

    if (distinctColors.length === 1) {
      // Single color cover: create shades of that EXACT color
      finalPalette.push(
        formatColor(distinctColors[0], 1.0),
        formatColor(distinctColors[0], 0.8),
        formatColor(distinctColors[0], 1.15),
        formatColor(distinctColors[0], 0.7)
      )
    } else if (distinctColors.length === 2) {
      // 2 dominant colors (e.g. blue sky & green grass): USE ONLY THESE 2 COLORS!
      finalPalette.push(
        formatColor(distinctColors[0], 1.0),   // Color 1
        formatColor(distinctColors[1], 1.0),   // Color 2
        formatColor(distinctColors[0], 0.82),  // Color 1 (deeper tone)
        formatColor(distinctColors[1], 1.12)   // Color 2 (lighter tone)
      )
    } else if (distinctColors.length === 3) {
      finalPalette.push(
        formatColor(distinctColors[0], 1.0),
        formatColor(distinctColors[1], 1.0),
        formatColor(distinctColors[2], 1.0),
        formatColor(distinctColors[0], 0.85)
      )
    } else {
      finalPalette.push(
        formatColor(distinctColors[0], 1.0),
        formatColor(distinctColors[1], 1.0),
        formatColor(distinctColors[2], 1.0),
        formatColor(distinctColors[3], 1.0)
      )
    }

    if (paletteCache.size >= 50) {
      const oldestKey = paletteCache.keys().next().value
      if (oldestKey) paletteCache.delete(oldestKey)
    }
    paletteCache.set(imgUrl, finalPalette)
    return finalPalette
  } catch {
    return DEFAULT_FALLBACK_PALETTE
  }
}

export const AppleMusicBackground: React.FC<AppleMusicBackgroundProps> = ({
  currentCover,
  isPlaying = true,
  blurAmount = 80,
}) => {
  const [currentPalette, setCurrentPalette] = useState<string[]>(DEFAULT_FALLBACK_PALETTE)
  const [prevPalette, setPrevPalette] = useState<string[] | null>(null)
  const [fadeProgress, setFadeProgress] = useState(1)
  const activeCoverRef = useRef('')

  useEffect(() => {
    if (!currentCover || activeCoverRef.current === currentCover) return

    activeCoverRef.current = currentCover
    let cancelled = false
    let t1: ReturnType<typeof setTimeout>
    let t2: ReturnType<typeof setTimeout>

    extractColorsFromImage(currentCover).then((newPalette) => {
      if (cancelled) return
      setCurrentPalette(prev => {
        setPrevPalette(prev)
        return newPalette
      })
      setFadeProgress(0)

      t1 = setTimeout(() => setFadeProgress(1), 50)
      t2 = setTimeout(() => setPrevPalette(null), 1800)
    })

    return () => {
      cancelled = true
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [currentCover])

  const calculatedBlur = Math.max(30, Math.round(blurAmount * 0.48))

  const renderColorBlobs = (palette: string[], opacity: number) => {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity,
          transition: 'opacity 1.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Blob 1: Color 1 from cover (Top-Left, moves right and down) */}
        <div
          className="apple-blob-1"
          style={{
            position: 'absolute',
            top: '-20vh',
            left: '-15vw',
            width: '95vw',
            height: '95vw',
            borderRadius: '50%',
            background: `radial-gradient(circle at 45% 45%, ${palette[0]} 0%, ${palette[0]} 40%, transparent 75%)`,
            opacity: 0.9,
          }}
        />

        {/* Blob 2: Color 2 from cover (Top-Right, moves left and down) */}
        <div
          className="apple-blob-2"
          style={{
            position: 'absolute',
            top: '-15vh',
            right: '-15vw',
            width: '100vw',
            height: '100vw',
            borderRadius: '50%',
            background: `radial-gradient(circle at 55% 45%, ${palette[1] || palette[0]} 0%, ${palette[1] || palette[0]} 40%, transparent 75%)`,
            opacity: 0.88,
          }}
        />

        {/* Blob 3: Color 3 or Color 1 shade (Bottom-Left, moves right and up) */}
        <div
          className="apple-blob-3"
          style={{
            position: 'absolute',
            bottom: '-20vh',
            left: '-15vw',
            width: '95vw',
            height: '95vw',
            borderRadius: '50%',
            background: `radial-gradient(circle at 45% 55%, ${palette[2] || palette[0]} 0%, ${palette[2] || palette[0]} 40%, transparent 75%)`,
            opacity: 0.88,
          }}
        />

        {/* Blob 4: Color 4 or Color 2 shade (Bottom-Right, moves left and up) */}
        <div
          className="apple-blob-4"
          style={{
            position: 'absolute',
            bottom: '-15vh',
            right: '-15vw',
            width: '105vw',
            height: '105vw',
            borderRadius: '50%',
            background: `radial-gradient(circle at 50% 50%, ${palette[3] || palette[1] || palette[0]} 0%, ${palette[3] || palette[1] || palette[0]} 40%, transparent 75%)`,
            opacity: 0.9,
          }}
        />

        {/* Blob 5: Center blend blob using Color 1 / Color 2 */}
        <div
          className="apple-blob-5"
          style={{
            position: 'absolute',
            top: '20vh',
            left: '20vw',
            width: '80vw',
            height: '80vw',
            borderRadius: '50%',
            background: `radial-gradient(circle at center, ${palette[1] || palette[0]} 0%, ${palette[1] || palette[0]} 35%, transparent 70%)`,
            opacity: 0.78,
          }}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: -100,
        width: 'calc(100vw + 200px)',
        height: 'calc(100vh + 200px)',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        // The base is a blend of the cover's actual colors
        background: `linear-gradient(135deg, ${currentPalette[0]}, ${currentPalette[1] || currentPalette[0]}, ${currentPalette[2] || currentPalette[0]})`,
        transition: 'background 1.6s ease',
      }}
    >
      {/* 
        Half-resolution Blur & Saturation Container (4x fewer GPU pixels to blur):
        Scaled 2.2x to fill viewport while cutting GPU VRAM and shader load
      */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '25%',
          width: '50%',
          height: '50%',
          filter: `blur(${calculatedBlur}px) saturate(1.8)`,
          transform: 'translate3d(0, 0, 0) scale(2.2)',
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {prevPalette && renderColorBlobs(prevPalette, 1 - fadeProgress)}
        {renderColorBlobs(currentPalette, prevPalette ? fadeProgress : 1)}
      </div>

      {/* 
        Uniform subtle contrast veil:
        - 15% dark tint so white lyrics and controls pop with 100% clarity
        - NO black vignette/border: completely uniform edge to edge
      */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(5, 7, 12, 0.15)',
          pointerEvents: 'none',
        }}
      />

      {/* Fluid Blobs Continuous Keyframe Animations (Apple Music Living Mesh Style) */}
      <style>{`
        @keyframes appleFloat1 {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(40vw, 25vh, 0) scale(1.2);
          }
          100% {
            transform: translate3d(15vw, 45vh, 0) scale(1.05);
          }
        }

        @keyframes appleFloat2 {
          0% {
            transform: translate3d(0, 0, 0) scale(1.1);
          }
          50% {
            transform: translate3d(-45vw, 30vh, 0) scale(1.25);
          }
          100% {
            transform: translate3d(-20vw, 15vh, 0) scale(0.95);
          }
        }

        @keyframes appleFloat3 {
          0% {
            transform: translate3d(0, 0, 0) scale(1.05);
          }
          50% {
            transform: translate3d(35vw, -35vh, 0) scale(1.2);
          }
          100% {
            transform: translate3d(50vw, -15vh, 0) scale(1.1);
          }
        }

        @keyframes appleFloat4 {
          0% {
            transform: translate3d(0, 0, 0) scale(1.15);
          }
          50% {
            transform: translate3d(-40vw, -28vh, 0) scale(1.05);
          }
          100% {
            transform: translate3d(-15vw, -45vh, 0) scale(1.25);
          }
        }

        @keyframes appleFloat5 {
          0% {
            transform: translate3d(-10vw, -10vh, 0) scale(0.9);
          }
          50% {
            transform: translate3d(15vw, 10vh, 0) scale(1.15);
          }
          100% {
            transform: translate3d(-5vw, 15vh, 0) scale(1.0);
          }
        }

        .apple-blob-1 {
          animation: appleFloat1 21s ease-in-out infinite alternate;
          animation-play-state: ${isPlaying ? 'running' : 'paused'};
        }

        .apple-blob-2 {
          animation: appleFloat2 27s ease-in-out infinite alternate;
          animation-play-state: ${isPlaying ? 'running' : 'paused'};
        }

        .apple-blob-3 {
          animation: appleFloat3 24s ease-in-out infinite alternate;
          animation-play-state: ${isPlaying ? 'running' : 'paused'};
        }

        .apple-blob-4 {
          animation: appleFloat4 30s ease-in-out infinite alternate;
          animation-play-state: ${isPlaying ? 'running' : 'paused'};
        }

        .apple-blob-5 {
          animation: appleFloat5 18s ease-in-out infinite alternate;
          animation-play-state: ${isPlaying ? 'running' : 'paused'};
        }
      `}</style>
    </div>
  )
}
