const fs = require('fs')

let content = fs.readFileSync('src/App.tsx', 'utf-8')
content = content.replace(/\\\`url\\\(\\\$\\{currentThumbnail\\}\\)\\\`/g, "\`url(\${currentThumbnail})\`")
content = content.replace(/\\\`saturate\\(1\.2\\) brightness\\(0\.8\\)\\\`/g, "\`saturate(1.2) brightness(0.8)\`")

fs.writeFileSync('src/App.tsx', content)
