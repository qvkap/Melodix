const fs = require('fs')
let content = fs.readFileSync('package.json', 'utf-8')
content = content.replace(
  '"target": [\n        "portable",\n        "zip"\n      ]',
  '"target": [\n        "nsis",\n        "portable",\n        "zip"\n      ]'
)
fs.writeFileSync('package.json', content)
