const fs = require('fs')

let content = fs.readFileSync('src/components/LyricsView.tsx', 'utf-8')
const target = `            pl: isMobile ? 1.5 : { xs: 2, md: 4, lg: 6, xl: 8 },
            pr: isMobile ? 1.5 : { xs: 2, md: 3, lg: 5 },
            pb: isMobile ? '120px' : 0,
            scrollbarWidth: 'none',`

const replacement = `            pl: isMobile ? 1.5 : { xs: 2, md: 4, lg: 6, xl: 8 },
            pr: isMobile ? 1.5 : { xs: 2, md: 3, lg: 5 },
            pb: 0,
            scrollPaddingBottom: isMobile ? '120px' : '40px',
            scrollPaddingTop: '40px',
            scrollbarWidth: 'none',`

content = content.replace(target, replacement)
fs.writeFileSync('src/components/LyricsView.tsx', content)
