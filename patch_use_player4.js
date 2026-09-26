const fs = require('fs')
let content = fs.readFileSync('src/hooks/usePlayer.ts', 'utf-8')

const target = `if (cmd === 'seek' && typeof val === 'number') seek(val)`
const replacement = `if (cmd === 'seek' && typeof val === 'number') seek(val)
        if (cmd === 'seek-relative' && typeof val === 'number') {
          if (howlRef.current) {
            seek(Math.max(0, (howlRef.current.seek() as number) + val))
          }
        }`

content = content.replace(target, replacement)
fs.writeFileSync('src/hooks/usePlayer.ts', content)
