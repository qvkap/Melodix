cat << 'DIFF' > preload2.diff
--- electron/preload.ts
+++ electron/preload.ts
@@ -62,4 +62,12 @@
     ipcRenderer.on('ytdlp-status', handler)
     return () => ipcRenderer.removeListener('ytdlp-status', handler)
   },
+
+  updateMprisState: (state: any) => ipcRenderer.send('mpris-update-state', state),
+  onMprisCommand: (callback: (cmd: string, val?: any) => void) => {
+    const handler = (_event: any, cmd: string, val?: any) => callback(cmd, val)
+    ipcRenderer.on('mpris-command', handler)
+    return () => ipcRenderer.removeListener('mpris-command', handler)
+  },
 })
DIFF
patch -p0 < preload2.diff
