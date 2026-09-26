import { BrowserWindow } from 'electron'

export class MprisService {
  private player: any = null
  private mainWindow: BrowserWindow | null = null

  constructor() {}

  init(window: BrowserWindow) {
    this.mainWindow = window

    if (process.platform !== 'linux') {
      return
    }

    try {
      const Mpris = require('mpris-service')
      this.player = Mpris({
        name: 'melodix',
        identity: 'Melodix',
        supportedUriSchemes: ['http', 'https'],
        supportedMimeTypes: ['audio/mpeg', 'audio/flac', 'audio/ogg', 'audio/aac'],
        supportedInterfaces: ['player']
      })

      // Setup Events
      this.player.on('play', () => this.sendCommand('play'))
      this.player.on('pause', () => this.sendCommand('pause'))
      this.player.on('playpause', () => this.sendCommand('playpause'))
      this.player.on('next', () => this.sendCommand('next'))
      this.player.on('previous', () => this.sendCommand('previous'))
      this.player.on('stop', () => this.sendCommand('stop'))

      this.player.on('seek', (offset: number) => {
        // MPRIS seek is relative offset in microseconds
        // We will pass this to renderer and handle it there, but our app prefers absolute.
        // Let's just emit raw seek offset.
        // mpris offset is in microseconds relative to current position. The renderer handles 'seek' as absolute seconds. We just pass relative delta:
        this.sendCommand('seek-relative', offset / 1000000)
      })

      this.player.on('position', (args: { position: number }) => {
        // Absolute position in microseconds
        const positionSec = args.position / 1_000_000
        this.sendCommand('seek', positionSec)
      })

    } catch (e: any) {
      console.log('Failed to initialize MPRIS:', e?.message)
    }
  }

  private sendCommand(cmd: string, val?: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('mpris-command', cmd, val)
    }
  }

  updateState(state: any) {
    if (!this.player) return

    try {
      if (state.isPlaying !== undefined) {
        this.player.playbackStatus = state.isPlaying ? 'Playing' : 'Paused'
      }

      if (state.track) {
        // Metadata expects specific mpris / xesam keys
        const metadata: any = {
          'mpris:trackid': this.player.objectPath('track/' + (state.track.id || '0').replace(/[^a-zA-Z0-9]/g, '')),
          'mpris:length': (state.track.duration || 0) * 1_000_000,
          'xesam:title': state.track.title || 'Unknown Title',
          'xesam:album': state.track.album || 'Unknown Album',
          'xesam:artist': [state.track.artist || 'Unknown Artist'],
        }

        if (state.track.thumbnail) {
          metadata['mpris:artUrl'] = state.track.thumbnail
        }

        this.player.metadata = metadata
      }
    } catch (e: any) {
      console.log('MPRIS update error:', e?.message)
    }
  }
}
