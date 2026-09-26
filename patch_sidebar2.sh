cat << 'DIFF' > sidebar.diff
--- src/components/Sidebar.tsx
+++ src/components/Sidebar.tsx
@@ -49,9 +49,9 @@
         '& .MuiDrawer-paper': {
           width: SIDEBAR_WIDTH,
           boxSizing: 'border-box',
-          bgcolor: 'rgba(16, 18, 26, 0.96)',
-          backdropFilter: 'blur(24px)',
-          borderRight: '1px solid rgba(255,255,255,0.06)',
+          bgcolor: settings.blurMaterial === 'liquid' ? 'transparent' : 'rgba(16, 18, 26, 0.96)',
+          backdropFilter: settings.blurMaterial === 'liquid' ? 'none' : 'blur(24px)',
+          borderRight: settings.blurMaterial === 'liquid' ? 'none' : '1px solid rgba(255,255,255,0.06)',
           top: '42px',
           height: 'calc(100% - 42px)',
           zIndex: 1300,
           transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
         },
       }}
     >
+      {settings.blurMaterial === 'liquid' && (
+         <Box sx={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden' }}>
+            <LiquidGlass intensity={1.5} blur={35} saturation={1.1} fallbackColor="rgba(12,14,20,0.6)" />
+         </Box>
+      )}
       <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
DIFF
patch -p0 < sidebar.diff
