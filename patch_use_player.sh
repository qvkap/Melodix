cat << 'DIFF' > use_player.diff
--- src/hooks/usePlayer.ts
+++ src/hooks/usePlayer.ts
@@ -524,6 +524,29 @@
     }
   }, [state.queue, state.currentTrack, state.repeat, state.shuffle, playTrack])

+  // MPRIS Integration: Send state out
+  useEffect(() => {
+    if (window.melodix?.updateMprisState) {
+      window.melodix.updateMprisState({
+        isPlaying: state.isPlaying,
+        track: state.currentTrack,
+      })
+    }
+  }, [state.isPlaying, state.currentTrack])
+
+  // MPRIS Integration: Listen to commands in
+  useEffect(() => {
+    if (window.melodix?.onMprisCommand) {
+      return window.melodix.onMprisCommand((cmd, val) => {
+        if (cmd === 'play') togglePlay()
+        if (cmd === 'pause') togglePlay()
+        if (cmd === 'playpause') togglePlay()
+        if (cmd === 'next') skipNext()
+        if (cmd === 'previous') skipPrev()
+        if (cmd === 'seek' && typeof val === 'number') seek(val)
+      })
+    }
+  }, [togglePlay, skipNext, skipPrev, seek])
+
   return {
     howlRef,
     state,
DIFF
patch -p0 < use_player.diff
