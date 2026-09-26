const fs = require('fs')

// Fix PlayerBar overlay bug
let pbContent = fs.readFileSync('src/components/PlayerBar.tsx', 'utf-8')
pbContent = pbContent.replace(
  '<LiquidGlass intensity={1.8} blur={40} saturation={1.2} fallbackColor="rgba(12,14,20,0.6)" />',
  '<LiquidGlass intensity={0.5} blur={25} saturation={1.05} fallbackColor="rgba(12,14,20,0.85)" />'
)
fs.writeFileSync('src/components/PlayerBar.tsx', pbContent)

// Fix App background bug (z-index issue overlaying everything else)
let appContent = fs.readFileSync('src/App.tsx', 'utf-8')
const targetApp = `<LiquidGlass intensity={0} blur={0} saturation={1} fallbackColor="rgba(10,13,20,0.1)" />`
const replaceApp = `<Box sx={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}><LiquidGlass intensity={0.2} blur={50} saturation={1.2} fallbackColor="rgba(10,13,20,0.5)" /></Box>`
appContent = appContent.replace(targetApp, replaceApp)
fs.writeFileSync('src/App.tsx', appContent)

// Fix Lyrics scroll block bug
let lyricsContent = fs.readFileSync('src/components/LyricsView.tsx', 'utf-8')
lyricsContent = lyricsContent.replace(
  "e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })",
  "// Handle seek without aggressive smooth scroll clashing\n                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })"
)
lyricsContent = lyricsContent.replace(
  "e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })",
  "// Handle seek without aggressive smooth scroll clashing\n                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })"
)
fs.writeFileSync('src/components/LyricsView.tsx', lyricsContent)
