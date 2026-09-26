const fs = require('fs')

let content = fs.readFileSync('src/App.tsx', 'utf-8')
content = content.replace("backgroundImage: \\`url(\\${currentThumbnail})\\`,", "backgroundImage: `url(${currentThumbnail})`,")
content = content.replace("filter: \\`saturate(1.2) brightness(0.8)\\`,", "filter: `saturate(1.2) brightness(0.8)`,")

fs.writeFileSync('src/App.tsx', content)
