cat << 'DIFF' > sidebar.diff
--- src/components/Sidebar.tsx
+++ src/components/Sidebar.tsx
@@ -9,6 +9,7 @@
 import { Track } from '../types'
 import { useSettings } from '../contexts/SettingsContext'
 import { ExplicitBadge } from './ExplicitBadge'
+import { LiquidGlass } from 'simple-liquid-glass'

 interface SidebarProps {
   currentView: 'home' | 'search' | 'artist' | 'queue' | 'favorites' | 'local' | 'playlists' | 'settings'
@@ -62,8 +63,9 @@
     if (!isMobile) return null

-    return (
-      <Box
+    const wrapperSx = {
-        sx={{
           position: 'fixed',
           top: 0,
           left: 0,
@@ -87,8 +89,14 @@
           willChange: 'transform, opacity',
           zIndex: 1200,
           pointerEvents: isOpen ? 'auto' : 'none',
-        }}
-      >
+        }
+
+    return (
+      <Box
+        sx={settings.blurMaterial === 'liquid' ? { ...wrapperSx, background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none', borderRight: 'none', boxShadow: 'none' } : wrapperSx}
+      >
+        {settings.blurMaterial === 'liquid' && (
+           <Box sx={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden' }}>
+              <LiquidGlass intensity={1.5} blur={35} saturation={1.1} fallbackColor="rgba(12,14,20,0.6)" />
+           </Box>
+        )}
         {/* Drawer handle for mobile */}
DIFF
patch -p0 < sidebar.diff
