const fs = require('fs')
let content = fs.readFileSync('src/components/LyricsView.tsx', 'utf-8')

const target = `            maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',`

const replacement = target + `
            bgcolor: settings.blurMaterial === 'liquid' ? 'transparent' : 'inherit',
            backdropFilter: settings.blurMaterial === 'liquid' ? 'none' : 'inherit',
`

content = content.replace(target, replacement)
fs.writeFileSync('src/components/LyricsView.tsx', content)
