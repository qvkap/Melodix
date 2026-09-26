const fs = require('fs')
let content = fs.readFileSync('electron/main.ts', 'utf-8')

// Append cleanup on quit
content = content + `\napp.on('will-quit', () => {\n  if (mpris) (mpris as any).player = null\n})\n`
fs.writeFileSync('electron/main.ts', content)
