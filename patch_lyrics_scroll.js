const fs = require('fs')
let content = fs.readFileSync('src/components/LyricsView.tsx', 'utf-8')

const target = `  // Center scroll active lyric line smoothly
  useEffect(() => {
    if (showLyrics && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [activeLine, showLyrics])`

const replacement = `  // Center scroll active lyric line smoothly
  useEffect(() => {
    if (showLyrics && activeLineRef.current && !isDragging) {
      // Small timeout helps avoid clash with layout shifts
      setTimeout(() => {
        if (activeLineRef.current) {
          activeLineRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
        }
      }, 50)
    }
  }, [activeLine, showLyrics, isDragging])`

content = content.replace(target, replacement)
fs.writeFileSync('src/components/LyricsView.tsx', content)
