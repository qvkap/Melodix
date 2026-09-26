cat << 'DIFF' > settings.diff
--- src/components/SettingsView.tsx
+++ src/components/SettingsView.tsx
@@ -226,6 +226,11 @@
       title: t.blurGlow,
       desc: 'Мягкий радиальный свет по центру'
     },
+    {
+      value: 'liquid',
+      title: 'Liquid Glass (Experimental)',
+      desc: 'Authentic 3D liquid glass effect with refraction (Requires Restart)'
+    },
     {
       value: 'none',
       title: t.blurNone,
DIFF
patch -p0 < settings.diff
