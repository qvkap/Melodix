const fs = require('fs')

let content = fs.readFileSync('src/hooks/usePlayer.ts', 'utf-8')
const target = `  return {
    state,
    setState,`

const replacement = `  // MPRIS Integration: Send state out
  useEffect(() => {
    if (window.melodix?.updateMprisState) {
      window.melodix.updateMprisState({
        isPlaying: state.isPlaying,
        track: state.currentTrack,
      })
    }
  }, [state.isPlaying, state.currentTrack])

  // MPRIS Integration: Listen to commands in
  useEffect(() => {
    if (window.melodix?.onMprisCommand) {
      return window.melodix.onMprisCommand((cmd, val) => {
        if (cmd === 'play') togglePlay()
        if (cmd === 'pause') togglePlay()
        if (cmd === 'playpause') togglePlay()
        if (cmd === 'next') skipNext()
        if (cmd === 'previous') skipPrev()
        if (cmd === 'seek' && typeof val === 'number') seek(val)
      })
    }
  }, [togglePlay, skipNext, skipPrev, seek])

  return {
    state,
    setState,`

content = content.replace(target, replacement)
fs.writeFileSync('src/hooks/usePlayer.ts', content)
