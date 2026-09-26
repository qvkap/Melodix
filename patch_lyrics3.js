const fs = require('fs')
let content = fs.readFileSync('src/components/LyricsView.tsx', 'utf-8')

const target = `  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 2,
        px: { xs: 2.5, md: 5, lg: 8 },
        py: 4,
        boxSizing: 'border-box',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >`

const replacement = `  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 2,
        px: { xs: 2.5, md: 5, lg: 8 },
        py: 4,
        boxSizing: 'border-box',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {settings.blurMaterial === 'liquid' && (
         <Box sx={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden' }}>
            <LiquidGlass intensity={1.5} blur={40} saturation={1.2} fallbackColor="rgba(10,13,20,0.1)" />
         </Box>
      )}`

content = content.replace(target, replacement)
fs.writeFileSync('src/components/LyricsView.tsx', content)
