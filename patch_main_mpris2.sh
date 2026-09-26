cat << 'DIFF' > mpris2.diff
--- electron/main.ts
+++ electron/main.ts
@@ -1378,3 +1378,7 @@
     shell.showItemInFolder(filePath)
   }
 })
+
+ipcMain.on('mpris-update-state', (_e, state: any) => {
+  if (mpris) mpris.updateState(state)
+})
DIFF
patch -p0 < mpris2.diff
