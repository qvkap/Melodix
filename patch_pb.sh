cat << 'DIFF' > pb.diff
--- src/components/PlayerBar.tsx
+++ src/components/PlayerBar.tsx
@@ -53,8 +53,41 @@
   const displayTitle = currentTrack ? cleanTitle(currentTrack.title, settings.exclusionWords) : ''
   const RepeatIcon = repeat === 'one' ? RepeatOne : Repeat

+  const wrapperSx = {
+    position: 'fixed' as const,
+    bottom: isMobile ? (bottomOffset > 0 ? bottomOffset + 8 : 10) : bottomOffset,
+    left: isMobile ? 12 : sidebarWidth,
+    right: isMobile ? 12 : 0,
+    maxWidth: isMobile ? 600 : 'none',
+    mx: isMobile ? 'auto' : 0,
+    zIndex: 1100,
+    borderRadius: isMobile ? 4 : 0,
+    background: isAndroid
+      ? 'linear-gradient(135deg, rgba(34, 26, 48, 0.96) 0%, rgba(26, 20, 38, 0.98) 100%)'
+      : isIos
+      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 50%, rgba(255, 255, 255, 0.1) 100%), rgba(16, 20, 32, 0.52)'
+      : isMobile
+      ? 'linear-gradient(0deg, rgba(22, 24, 34, 0.96) 0%, rgba(18, 20, 28, 0.98) 100%)'
+      : 'linear-gradient(0deg, rgba(12, 14, 20, 0.98) 75%, rgba(12, 14, 20, 0.75) 100%)',
+    backdropFilter: isIos ? 'blur(36px) saturate(210%) brightness(1.05)' : 'blur(28px)',
+    WebkitBackdropFilter: isIos ? 'blur(36px) saturate(210%) brightness(1.05)' : 'blur(28px)',
+    border: isIos ? '1px solid rgba(255, 255, 255, 0.25)' : 'none',
+    borderTop: isIos ? '1.5px solid rgba(255, 255, 255, 0.65)' : (isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.06)'),
+    boxShadow: isIos
+      ? '0 20px 48px -10px rgba(0, 0, 0, 0.7), inset 0 1.5px 1px rgba(255, 255, 255, 0.65), inset 0 -1px 1px rgba(255, 255, 255, 0.12)'
+      : isMobile
+      ? '0 8px 32px rgba(0, 0, 0, 0.55)'
+      : '0 -2px 16px rgba(0, 0, 0, 0.3)',
+    px: { xs: 1.5, md: 3 },
+    pt: 0.6,
+    pb: isMobile ? 1.2 : 1.8,
+    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.25s ease',
+    pointerEvents: 'auto' as const,
+  }
+
   return (
-    <Box
-      sx={{
-        position: 'fixed',
-        bottom: isMobile ? (bottomOffset > 0 ? bottomOffset + 8 : 10) : bottomOffset,
-        left: isMobile ? 12 : sidebarWidth,
-        right: isMobile ? 12 : 0,
-        maxWidth: isMobile ? 600 : 'none',
-        mx: isMobile ? 'auto' : 0,
-        zIndex: 1100,
-        borderRadius: isMobile ? 4 : 0,
-        background: isAndroid
-          ? 'linear-gradient(135deg, rgba(34, 26, 48, 0.96) 0%, rgba(26, 20, 38, 0.98) 100%)'
-          : isIos
-          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 50%, rgba(255, 255, 255, 0.1) 100%), rgba(16, 20, 32, 0.52)'
-          : isMobile
-          ? 'linear-gradient(0deg, rgba(22, 24, 34, 0.96) 0%, rgba(18, 20, 28, 0.98) 100%)'
-          : 'linear-gradient(0deg, rgba(12, 14, 20, 0.98) 75%, rgba(12, 14, 20, 0.75) 100%)',
-        backdropFilter: isIos ? 'blur(36px) saturate(210%) brightness(1.05)' : 'blur(28px)',
-        WebkitBackdropFilter: isIos ? 'blur(36px) saturate(210%) brightness(1.05)' : 'blur(28px)',
-        border: isIos ? '1px solid rgba(255, 255, 255, 0.25)' : 'none',
-        borderTop: isIos ? '1.5px solid rgba(255, 255, 255, 0.65)' : (isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.06)'),
-        boxShadow: isIos
-          ? '0 20px 48px -10px rgba(0, 0, 0, 0.7), inset 0 1.5px 1px rgba(255, 255, 255, 0.65), inset 0 -1px 1px rgba(255, 255, 255, 0.12)'
-          : isMobile
-          ? '0 8px 32px rgba(0, 0, 0, 0.55)'
-          : '0 -2px 16px rgba(0, 0, 0, 0.3)',
-        px: { xs: 1.5, md: 3 },
-        pt: 0.6,
-        pb: isMobile ? 1.2 : 1.8,
-        transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.25s ease',
-        pointerEvents: 'auto',
-      }}
-    >
+    <Box sx={settings.blurMaterial === 'liquid' ? { ...wrapperSx, background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none', border: 'none', boxShadow: 'none' } : wrapperSx}>
+      {settings.blurMaterial === 'liquid' && (
+         <Box sx={{ position: 'absolute', inset: 0, zIndex: -1, borderRadius: isMobile ? 4 : 0, overflow: 'hidden' }}>
+            <LiquidGlass intensity={1.8} blur={40} saturation={1.2} fallbackColor="rgba(12,14,20,0.6)" />
+         </Box>
+      )}
       {/* M3 Expressive Progress Slider */}
       <Box sx={{ mb: 0.5, cursor: 'pointer' }} className="melodix-slider">
DIFF
patch -p0 < pb.diff
