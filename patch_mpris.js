const fs = require('fs')
let content = fs.readFileSync('electron/mpris.ts', 'utf-8')

// Add album metadata and fix seek event
content = content.replace(
  "'xesam:title': state.track.title || 'Unknown Title',",
  "'xesam:title': state.track.title || 'Unknown Title',\n          'xesam:album': state.track.album || 'Unknown Album',"
)
content = content.replace(
  "this.sendCommand('mpris-seek', offset)",
  "// mpris offset is in microseconds relative to current position. The renderer handles 'seek' as absolute seconds. We just pass relative delta:\n        this.sendCommand('seek-relative', offset / 1000000)"
)
fs.writeFileSync('electron/mpris.ts', content)
