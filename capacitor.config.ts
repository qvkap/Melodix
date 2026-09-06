import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.qvkap.melodix',
  appName: 'Melodix',
  webDir: 'dist-react',
  server: {
    androidScheme: 'https',
  },
}

export default config
