import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Switch, Slider, Chip, TextField,
  Button, Paper, Accordion, AccordionSummary, AccordionDetails,
  Select, MenuItem, FormControl, Tooltip, InputAdornment
} from '@mui/material'
import {
  Add, Delete, RestartAlt, ExpandMore, Language, BlurOn,
  SettingsApplications, Tune, CloudQueue, Check, CheckCircle, ErrorOutline,
  SystemUpdateAlt, Refresh, Download, Palette, Wallpaper, ColorLens,
  VpnLock, Terminal, Speed
} from '@mui/icons-material'
import { useSettings } from '../contexts/SettingsContext'
import { BlurMaterial, AppLanguage, ProxyConfig, YtdlpInfo } from '../types'

const PROXY_PRESETS = [
  { name: 'Clash / Mihomo (7890)', proto: 'http' as const, host: '127.0.0.1', port: '7890' },
  { name: 'V2Ray / Xray (10808)', proto: 'socks5' as const, host: '127.0.0.1', port: '10808' },
  { name: 'Shadowsocks (1080)', proto: 'socks5' as const, host: '127.0.0.1', port: '1080' },
  { name: 'Tor (9050)', proto: 'socks5' as const, host: '127.0.0.1', port: '9050' },
]

function buildProxyUrlClient(cfg: ProxyConfig): string {
  if (cfg.useCustomUrl && cfg.customUrl?.trim()) {
    let u = cfg.customUrl.trim()
    if (!u.includes('://')) u = `http://${u}`
    return u
  }
  if (!cfg.host?.trim() || !cfg.port) return ''
  const proto = cfg.protocol || 'http'
  const host = cfg.host.trim()
  const port = String(cfg.port).trim()
  if (cfg.username?.trim()) {
    const user = encodeURIComponent(cfg.username.trim())
    const pass = cfg.password ? encodeURIComponent(cfg.password) : ''
    return `${proto}://${user}:${pass}@${host}:${port}`
  }
  return `${proto}://${host}:${port}`
}

const PRESET_COLORS = [
  { name: 'Лаванда (Melodix)', hex: '#d0bcff' },
  { name: 'Изумрудный неон', hex: '#69f0ae' },
  { name: 'Небесно-голубой', hex: '#64b5f6' },
  { name: 'Золотой янтарь', hex: '#ffd54f' },
  { name: 'Коралловый', hex: '#ff8a80' },
  { name: 'Электро-фуксия', hex: '#e040fb' },
  { name: 'Свежая мята', hex: '#80cbc4' },
  { name: 'Огненный закат', hex: '#ffab40' },
  { name: 'Розовая сакура', hex: '#f48fb1' },
  { name: 'Индиго', hex: '#b388ff' },
]

export const SettingsView: React.FC = () => {
  const { settings, t, update, resetExclusions } = useSettings()
  const [newWord, setNewWord] = useState('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<{
    status: string
    message?: string
    version?: string
    percent?: number
  } | null>(null)

  // Proxy state
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({
    enabled: false,
    protocol: 'http',
    host: '127.0.0.1',
    port: '7890',
    applyToElectron: true,
  })
  const [proxyTesting, setProxyTesting] = useState(false)
  const [proxyTestResult, setProxyTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null)
  const [proxySavedNotice, setProxySavedNotice] = useState(false)

  // yt-dlp state
  const [ytdlpInfo, setYtdlpInfo] = useState<YtdlpInfo | null>(null)
  const [ytdlpChecking, setYtdlpChecking] = useState(false)

  useEffect(() => {
    if (window.melodix?.getProxyConfig) {
      window.melodix.getProxyConfig().then(cfg => {
        if (cfg) setProxyConfig(cfg)
      })
    }
    if (window.melodix?.getYtdlpInfo) {
      window.melodix.getYtdlpInfo().then(info => {
        if (info) setYtdlpInfo(info)
      })
    }
    if (window.melodix?.onYtdlpStatus) {
      const unsub = window.melodix.onYtdlpStatus((info) => {
        setYtdlpInfo(info)
        if (info.status !== 'checking' && info.status !== 'updating') {
          setYtdlpChecking(false)
        }
      })
      return () => unsub?.()
    }
  }, [])

  const handleSaveProxy = async (newCfg: ProxyConfig) => {
    setProxyConfig(newCfg)
    setProxyTestResult(null)
    if (window.melodix?.setProxyConfig) {
      await window.melodix.setProxyConfig(newCfg)
      setProxySavedNotice(true)
      setTimeout(() => setProxySavedNotice(false), 2500)
    }
  }

  const handleTestProxy = async () => {
    setProxyTesting(true)
    setProxyTestResult(null)
    try {
      const urlToTest = buildProxyUrlClient(proxyConfig)
      if (window.melodix?.testProxy) {
        const res = await window.melodix.testProxy(urlToTest)
        setProxyTestResult(res)
      }
    } catch (e: any) {
      setProxyTestResult({ success: false, error: e?.message || 'Ошибка тестирования' })
    } finally {
      setProxyTesting(false)
    }
  }

  const handleUpdateYtdlp = async () => {
    setYtdlpChecking(true)
    try {
      if (window.melodix?.updateYtdlp) {
        const res = await window.melodix.updateYtdlp()
        if (res?.currentVersion && ytdlpInfo) {
          setYtdlpInfo(prev => prev ? { ...prev, currentVersion: res.currentVersion || prev.currentVersion } : null)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setYtdlpChecking(false)
    }
  }

  const handleToggleYtdlpAutoUpdate = async (enabled: boolean) => {
    if (window.melodix?.setYtdlpAutoUpdate) {
      await window.melodix.setYtdlpAutoUpdate(enabled)
      setYtdlpInfo(prev => prev ? { ...prev, autoUpdate: enabled } : null)
    }
  }

  useEffect(() => {
    if (!window.melodix?.onUpdateMessage) return
    const unsub = window.melodix.onUpdateMessage((data) => {
      setUpdateStatus(data)
      if (data.status !== 'checking') {
        setCheckingUpdate(false)
      }
    })
    return () => unsub?.()
  }, [])

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const res = await window.melodix?.checkForUpdates?.()
      if (res?.status === 'dev') {
        setUpdateStatus({ status: 'dev', message: res.message || 'Режим разработки (dev)' })
      } else if (res && !res.success && res.error) {
        setUpdateStatus({ status: 'error', message: res.error })
      }
    } catch (e: any) {
      setUpdateStatus({ status: 'error', message: e?.message || 'Ошибка проверки' })
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleInstallUpdate = () => {
    window.melodix?.installUpdate?.()
  }

  const handleSelectColorMode = async (mode: 'custom' | 'system') => {
    if (mode === 'system') {
      update({ accentColorMode: 'system' })
      if (window.melodix?.getSystemAccentColor) {
        const res = await window.melodix.getSystemAccentColor()
        if (res?.success && res.color) {
          update({ accentColor: res.color, accentColorMode: 'system' })
        }
      }
    } else {
      update({ accentColorMode: 'custom' })
    }
  }

  const addWord = () => {
    const w = newWord.trim()
    if (!w || settings.exclusionWords.includes(w)) return
    update({ exclusionWords: [...settings.exclusionWords, w] })
    setNewWord('')
  }

  const removeWord = (word: string) => {
    update({ exclusionWords: settings.exclusionWords.filter(w => w !== word) })
  }

  const blurOptions: { value: BlurMaterial; title: string; desc: string }[] = [
    {
      value: 'ambient',
      title: t.blurAmbient,
      desc: 'Рассеянное свечение с мягким виньетированием'
    },
    {
      value: 'vibrant',
      title: t.blurVibrant,
      desc: 'Яркие контрастные цвета обложки'
    },
    {
      value: 'acrylic',
      title: t.blurAcrylic,
      desc: 'Матовое стекло с приглушенным тоном'
    },
    {
      value: 'glow',
      title: t.blurGlow,
      desc: 'Мягкий радиальный свет по центру'
    },
    {
      value: 'none',
      title: t.blurNone,
      desc: 'Чистый глубокий темный фон'
    },
  ]

  return (
    <Box sx={{ p: { xs: 2.5, md: 4 }, pb: 28, maxWidth: 780, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', mb: 0.5 }}>
          {t.settingsTitle}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          Персонализация внешнего вида, звука и подключенных сервисов
        </Typography>
      </Box>

      {/* 1. Language Selection */}
      <SectionCard title={t.language} icon={<Language sx={{ color: 'primary.main', fontSize: 20 }} />}>
        <Box sx={{ maxWidth: 280, mt: 1 }}>
          <FormControl fullWidth size="small">
            <Select
              value={settings.language}
              onChange={e => update({ language: e.target.value as AppLanguage })}
              sx={{
                bgcolor: 'rgba(255,255,255,0.06)',
                color: '#ffffff',
                borderRadius: 2.5,
                border: 'none',
                '& fieldset': { border: 'none' },
                '& .MuiSelect-icon': { color: '#ffffff' },
              }}
            >
              <MenuItem value="ru">Русский (Russian)</MenuItem>
              <MenuItem value="en">English (US)</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </SectionCard>

      {/* 2. Appearance & Blur Material (Clickable buttons instead of radio bullets!) */}
      <SectionCard title={t.appearance} icon={<BlurOn sx={{ color: 'primary.main', fontSize: 20 }} />}>
        <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 600, mb: 1.5 }}>
          {t.blurMaterial}
        </Typography>

        {/* Big Clickable Cards without radio bullets */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2, mb: 2.5 }}>
          {blurOptions.map(opt => {
            const isSelected = settings.blurMaterial === opt.value
            return (
              <Box
                key={opt.value}
                onClick={() => update({ blurMaterial: opt.value })}
                sx={{
                  p: 1.8,
                  borderRadius: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: isSelected ? 'rgba(208, 188, 255, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                  transition: 'all 0.18s ease',
                  border: isSelected ? '1.5px solid #d0bcff' : '1.5px solid transparent',
                  '&:hover': {
                    bgcolor: isSelected ? 'rgba(208, 188, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: isSelected ? 'primary.light' : '#ffffff',
                      fontWeight: isSelected ? 700 : 600,
                      fontSize: '0.92rem'
                    }}
                  >
                    {opt.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.55)', display: 'block', mt: 0.3 }}>
                    {opt.desc}
                  </Typography>
                </Box>
                {isSelected && (
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: '#141218',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      ml: 1,
                    }}
                  >
                    <Check sx={{ fontSize: 15, strokeWidth: 2 }} />
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>

        {/* Blur Intensity Slider */}
        {settings.blurMaterial !== 'none' && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                {t.blurIntensity}
              </Typography>
              <Typography variant="body2" sx={{ color: 'primary.light', fontWeight: 600 }}>
                {settings.backgroundBlurAmount}px
              </Typography>
            </Box>
            <Slider
              value={settings.backgroundBlurAmount}
              min={20}
              max={150}
              step={5}
              onChange={(_e, v) => update({ backgroundBlurAmount: v as number })}
              sx={{ color: 'primary.main' }}
            />
          </Box>
        )}
      </SectionCard>

      {/* 3. Accent Color (Custom or Windows Wallpaper / System Color) */}
      <SectionCard title="Акцентный цвет оформления" icon={<Palette sx={{ color: 'primary.main', fontSize: 20 }} />}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Mode Switcher */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
            <Box
              onClick={() => handleSelectColorMode('system')}
              sx={{
                p: 1.8,
                borderRadius: 3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: settings.accentColorMode === 'system' ? 'rgba(208, 188, 255, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                border: settings.accentColorMode === 'system' ? '1.5px solid var(--accent-color, #d0bcff)' : '1.5px solid transparent',
                transition: 'all 0.18s ease',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={1.2}>
                <Wallpaper sx={{ color: settings.accentColorMode === 'system' ? 'primary.main' : 'rgba(255,255,255,0.7)', fontSize: 22 }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                    Цвет системы / обоев
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                    Windows 10/11 & macOS
                  </Typography>
                </Box>
              </Box>
              {settings.accentColorMode === 'system' && <Check sx={{ color: 'primary.main', fontSize: 20 }} />}
            </Box>

            <Box
              onClick={() => update({ accentColorMode: 'custom' })}
              sx={{
                p: 1.8,
                borderRadius: 3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: settings.accentColorMode === 'custom' ? 'rgba(208, 188, 255, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                border: settings.accentColorMode === 'custom' ? '1.5px solid var(--accent-color, #d0bcff)' : '1.5px solid transparent',
                transition: 'all 0.18s ease',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={1.2}>
                <ColorLens sx={{ color: settings.accentColorMode === 'custom' ? 'primary.main' : 'rgba(255,255,255,0.7)', fontSize: 22 }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                    Пользовательский цвет
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                    Палитра пресетов или свой HEX
                  </Typography>
                </Box>
              </Box>
              {settings.accentColorMode === 'custom' && <Check sx={{ color: 'primary.main', fontSize: 20 }} />}
            </Box>
          </Box>

          {/* Quick Preset Colors Palette */}
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', mb: 1.2 }}>
              Быстрые пресеты:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {PRESET_COLORS.map(c => {
                const isSelected = settings.accentColor.toLowerCase() === c.hex.toLowerCase() && settings.accentColorMode === 'custom'
                return (
                  <Tooltip key={c.hex} title={c.name}>
                    <Box
                      onClick={() => update({ accentColor: c.hex, accentColorMode: 'custom' })}
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        bgcolor: c.hex,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        border: isSelected ? '2.5px solid #ffffff' : '2px solid rgba(255,255,255,0.15)',
                        boxShadow: isSelected ? `0 0 14px ${c.hex}` : '0 2px 6px rgba(0,0,0,0.3)',
                        '&:hover': {
                          transform: 'scale(1.15)',
                        },
                      }}
                    >
                      {isSelected && <Check sx={{ color: '#141218', fontSize: 18, fontWeight: 900 }} />}
                    </Box>
                  </Tooltip>
                )
              })}
            </Box>
          </Box>

          {/* Custom Color Picker & Hex Input */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Box sx={{ position: 'relative', width: 44, height: 44, borderRadius: 2.5, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
              <input
                type="color"
                value={settings.accentColor}
                onChange={(e) => update({ accentColor: e.target.value, accentColorMode: 'custom' })}
                style={{
                  position: 'absolute',
                  top: -8,
                  left: -8,
                  width: 64,
                  height: 64,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block' }}>
                Выбрать свой оттенок (Color Picker / HEX):
              </Typography>
              <TextField
                size="small"
                value={settings.accentColor.toUpperCase()}
                onChange={(e) => {
                  let val = e.target.value
                  if (!val.startsWith('#')) val = '#' + val
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    update({ accentColor: val, accentColorMode: 'custom' })
                  }
                }}
                sx={{
                  mt: 0.5,
                  maxWidth: 160,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.06)',
                    borderRadius: 2,
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                  },
                }}
              />
            </Box>
          </Box>
        </Box>
      </SectionCard>

      {/* 4. Lyrics Settings */}
      <SectionCard title={t.lyricsSettings} icon={<Tune sx={{ color: 'primary.main', fontSize: 20 }} />}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          sx={{ cursor: 'pointer' }}
          onClick={() => update({ lyricsBlurFuture: !settings.lyricsBlurFuture })}
        >
          <Box>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
              {t.blurFutureLines}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block', mt: 0.3 }}>
              Мягкое размытие предстоящих строк для фокусировки на текущей
            </Typography>
          </Box>
          <Switch
            checked={settings.lyricsBlurFuture}
            onChange={e => update({ lyricsBlurFuture: e.target.checked })}
            onClick={e => e.stopPropagation()}
          />
        </Box>
      </SectionCard>

      {/* 4. Last.fm Integration */}
      <SectionCard title={t.lastfmTitle} icon={<CloudQueue sx={{ color: 'primary.main', fontSize: 20 }} />}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2, cursor: 'pointer' }}
          onClick={() => update({ lastfmEnabled: !settings.lastfmEnabled })}
        >
          <Box>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
              {t.lastfmEnable}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block', mt: 0.3 }}>
              {t.lastfmDesc}
            </Typography>
          </Box>
          <Switch
            checked={settings.lastfmEnabled}
            onChange={e => update({ lastfmEnabled: e.target.checked })}
            onClick={e => e.stopPropagation()}
          />
        </Box>

        {settings.lastfmEnabled && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <TextField
              size="small"
              label={t.lastfmUsername}
              value={settings.lastfmUsername}
              onChange={e => update({ lastfmUsername: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label={t.lastfmApiKey}
              value={settings.lastfmApiKey}
              onChange={e => update({ lastfmApiKey: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label={t.lastfmSecret}
              type="password"
              value={settings.lastfmSecret}
              onChange={e => update({ lastfmSecret: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label={t.lastfmSessionKey}
              type="password"
              value={settings.lastfmSessionKey}
              onChange={e => update({ lastfmSessionKey: e.target.value })}
              fullWidth
            />

            <Box display="flex" alignItems="center" gap={1} sx={{ mt: 0.5 }}>
              {settings.lastfmSessionKey ? (
                <>
                  <CheckCircle sx={{ color: '#4caf50', fontSize: 18 }} />
                  <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 600 }}>
                    {t.lastfmStatusConnected}
                  </Typography>
                </>
              ) : (
                <>
                  <ErrorOutline sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    Введите Session Key для скробблинга
                  </Typography>
                </>
              )}
            </Box>
          </Box>
        )}
      </SectionCard>

      {/* 5. App Updates */}
      <SectionCard title="Обновление приложения" icon={<SystemUpdateAlt sx={{ color: 'primary.main', fontSize: 20 }} />}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                Melodix Beta 0.3
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                {updateStatus?.message || 'Автоматическая проверка обновлений при запуске'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              {updateStatus?.status === 'downloaded' ? (
                <Button
                  variant="contained"
                  startIcon={<Download />}
                  onClick={handleInstallUpdate}
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#141218',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2.5,
                  }}
                >
                  Перезапустить и обновить
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<Refresh sx={{ animation: checkingUpdate ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />}
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.15)',
                    color: '#ffffff',
                    fontWeight: 600,
                    textTransform: 'none',
                    borderRadius: 2.5,
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(208, 188, 255, 0.08)' }
                  }}
                >
                  {checkingUpdate ? 'Проверка...' : 'Проверить обновления'}
                </Button>
              )}
            </Box>
          </Box>

          {updateStatus?.percent !== undefined && updateStatus.status === 'downloading' && (
            <Box sx={{ width: '100%', mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'primary.light' }}>
                  Загрузка новой версии...
                </Typography>
                <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 700 }}>
                  {updateStatus.percent}%
                </Typography>
              </Box>
              <Box sx={{ width: '100%', height: 6, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <Box
                  sx={{
                    width: `${updateStatus.percent}%`,
                    height: '100%',
                    bgcolor: 'primary.main',
                    transition: 'width 0.2s ease',
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>
      </SectionCard>

      {/* 6. Advanced Settings (Proxy Server, yt-dlp Auto-Updater, Title Cleanup) - Borderless Accordion */}
      <Accordion
        elevation={0}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '16px !important',
          border: 'none',
          overflow: 'hidden',
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMore sx={{ color: '#ffffff' }} />}
          sx={{ px: 2.5, py: 1 }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" pr={1.5}>
            <Box display="flex" alignItems="center" gap={1.2}>
              <SettingsApplications sx={{ color: 'primary.light', fontSize: 22 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ffffff' }}>
                  {t.advancedSettings}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                  Прокси-сервер, движок yt-dlp и фильтрация названий
                </Typography>
              </Box>
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              {proxyConfig.enabled && (
                <Chip
                  size="small"
                  label={`Прокси: ${proxyConfig.useCustomUrl ? 'URL' : `${proxyConfig.protocol.toUpperCase()}:${proxyConfig.port}`}`}
                  sx={{
                    bgcolor: 'rgba(105, 240, 174, 0.16)',
                    color: '#69f0ae',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    height: 22,
                  }}
                />
              )}
              {ytdlpInfo?.currentVersion && (
                <Chip
                  size="small"
                  label={`yt-dlp v${ytdlpInfo.currentVersion}`}
                  sx={{
                    bgcolor: 'rgba(208, 188, 255, 0.12)',
                    color: 'primary.light',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    height: 22,
                  }}
                />
              )}
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2.5, pb: 3, pt: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* ─── Subsection A: Proxy Server ──────────────────────────────── */}
          <Box sx={{ p: 2.2, bgcolor: 'rgba(255, 255, 255, 0.03)', borderRadius: 3, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Box display="flex" alignItems="center" gap={1.2}>
                <VpnLock sx={{ color: proxyConfig.enabled ? 'primary.main' : 'rgba(255,255,255,0.5)', fontSize: 22 }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                    {t.proxyTitle}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block' }}>
                    {t.proxyDesc}
                  </Typography>
                </Box>
              </Box>

              <Switch
                checked={proxyConfig.enabled}
                onChange={e => handleSaveProxy({ ...proxyConfig, enabled: e.target.checked })}
              />
            </Box>

            {proxyConfig.enabled ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Presets */}
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', mb: 1 }}>
                    {t.proxyPresets}
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {PROXY_PRESETS.map(preset => (
                      <Chip
                        key={preset.name}
                        label={preset.name}
                        size="small"
                        clickable
                        onClick={() => {
                          const updated: ProxyConfig = {
                            ...proxyConfig,
                            protocol: preset.proto,
                            host: preset.host,
                            port: preset.port,
                            useCustomUrl: false,
                          }
                          handleSaveProxy(updated)
                        }}
                        sx={{
                          bgcolor: !proxyConfig.useCustomUrl && proxyConfig.protocol === preset.proto && proxyConfig.port === preset.port
                            ? 'rgba(208, 188, 255, 0.22)'
                            : 'rgba(255,255,255,0.06)',
                          color: !proxyConfig.useCustomUrl && proxyConfig.protocol === preset.proto && proxyConfig.port === preset.port
                            ? 'primary.light'
                            : '#ffffff',
                          fontWeight: 600,
                          borderRadius: 2,
                          border: !proxyConfig.useCustomUrl && proxyConfig.protocol === preset.proto && proxyConfig.port === preset.port
                            ? '1px solid #d0bcff'
                            : '1px solid transparent',
                        }}
                      />
                    ))}
                    <Chip
                      label={t.proxyUseCustomUrl}
                      size="small"
                      clickable
                      onClick={() => handleSaveProxy({ ...proxyConfig, useCustomUrl: !proxyConfig.useCustomUrl })}
                      sx={{
                        bgcolor: proxyConfig.useCustomUrl ? 'rgba(208, 188, 255, 0.22)' : 'rgba(255,255,255,0.06)',
                        color: proxyConfig.useCustomUrl ? 'primary.light' : '#ffffff',
                        fontWeight: 600,
                        borderRadius: 2,
                        border: proxyConfig.useCustomUrl ? '1px solid #d0bcff' : '1px solid transparent',
                      }}
                    />
                  </Box>
                </Box>

                {/* Structured vs Custom URL inputs */}
                {!proxyConfig.useCustomUrl ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '130px 1fr 110px' }, gap: 1.5 }}>
                    <FormControl size="small" fullWidth>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', mb: 0.5 }}>
                        {t.proxyProtocol}
                      </Typography>
                      <Select
                        value={proxyConfig.protocol}
                        onChange={e => handleSaveProxy({ ...proxyConfig, protocol: e.target.value as any })}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.06)',
                          color: '#ffffff',
                          borderRadius: 2,
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                        }}
                      >
                        <MenuItem value="http">HTTP</MenuItem>
                        <MenuItem value="https">HTTPS</MenuItem>
                        <MenuItem value="socks5">SOCKS5</MenuItem>
                        <MenuItem value="socks4">SOCKS4</MenuItem>
                      </Select>
                    </FormControl>

                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', mb: 0.5, display: 'block' }}>
                        {t.proxyHost}
                      </Typography>
                      <TextField
                        size="small"
                        fullWidth
                        value={proxyConfig.host}
                        onChange={e => setProxyConfig({ ...proxyConfig, host: e.target.value })}
                        onBlur={() => handleSaveProxy(proxyConfig)}
                        placeholder="127.0.0.1 или proxy.example.com"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(255,255,255,0.06)',
                            borderRadius: 2,
                          },
                        }}
                      />
                    </Box>

                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', mb: 0.5, display: 'block' }}>
                        {t.proxyPort}
                      </Typography>
                      <TextField
                        size="small"
                        fullWidth
                        value={proxyConfig.port}
                        onChange={e => setProxyConfig({ ...proxyConfig, port: e.target.value })}
                        onBlur={() => handleSaveProxy(proxyConfig)}
                        placeholder="7890"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(255,255,255,0.06)',
                            borderRadius: 2,
                          },
                        }}
                      />
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', mb: 0.5, display: 'block' }}>
                      {t.proxyCustomUrl}
                    </Typography>
                    <TextField
                      size="small"
                      fullWidth
                      value={proxyConfig.customUrl || ''}
                      onChange={e => setProxyConfig({ ...proxyConfig, customUrl: e.target.value })}
                      onBlur={() => handleSaveProxy(proxyConfig)}
                      placeholder="socks5://127.0.0.1:10808 или http://user:pass@host:port"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(255,255,255,0.06)',
                          borderRadius: 2,
                          fontFamily: 'monospace',
                        },
                      }}
                    />
                  </Box>
                )}

                {/* Optional Authentication */}
                {!proxyConfig.useCustomUrl && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                    <TextField
                      size="small"
                      label={t.proxyUsername}
                      value={proxyConfig.username || ''}
                      onChange={e => setProxyConfig({ ...proxyConfig, username: e.target.value })}
                      onBlur={() => handleSaveProxy(proxyConfig)}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2 } }}
                    />
                    <TextField
                      size="small"
                      label={t.proxyPassword}
                      type="password"
                      value={proxyConfig.password || ''}
                      onChange={e => setProxyConfig({ ...proxyConfig, password: e.target.value })}
                      onBlur={() => handleSaveProxy(proxyConfig)}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2 } }}
                    />
                  </Box>
                )}

                {/* Route entire electron traffic switch */}
                <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ pt: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                      {t.proxyApplyElectron}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                      Маршрутизирует не только yt-dlp, но и обложки альбомов и HTML5 аудиопотоки
                    </Typography>
                  </Box>
                  <Switch
                    checked={proxyConfig.applyToElectron !== false}
                    onChange={e => handleSaveProxy({ ...proxyConfig, applyToElectron: e.target.checked })}
                  />
                </Box>

                {/* Actions & Test Status */}
                <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Speed sx={{ animation: proxyTesting ? 'spin 1s linear infinite' : 'none' }} />}
                      onClick={handleTestProxy}
                      disabled={proxyTesting}
                      sx={{
                        color: '#ffffff',
                        borderColor: 'rgba(255,255,255,0.2)',
                        textTransform: 'none',
                        borderRadius: 2,
                        '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(208, 188, 255, 0.08)' },
                      }}
                    >
                      {proxyTesting ? t.proxyTesting : t.proxyTest}
                    </Button>

                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleSaveProxy(proxyConfig)}
                      sx={{
                        bgcolor: 'primary.main',
                        color: '#141218',
                        fontWeight: 700,
                        textTransform: 'none',
                        borderRadius: 2,
                      }}
                    >
                      Сохранить
                    </Button>

                    {proxySavedNotice && (
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <CheckCircle sx={{ color: '#4caf50', fontSize: 16 }} />
                        <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 600 }}>
                          Сохранено
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Test Result Indicator */}
                  {proxyTestResult && (
                    <Box display="flex" alignItems="center" gap={0.8}>
                      {proxyTestResult.success ? (
                        <>
                          <CheckCircle sx={{ color: '#4caf50', fontSize: 18 }} />
                          <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 700 }}>
                            {t.proxyTestSuccess} ({proxyTestResult.latencyMs} мс)
                          </Typography>
                        </>
                      ) : (
                        <>
                          <ErrorOutline sx={{ color: '#ff8a80', fontSize: 18 }} />
                          <Typography variant="caption" sx={{ color: '#ff8a80', fontWeight: 600 }}>
                            {proxyTestResult.error || t.proxyTestFailed}
                          </Typography>
                        </>
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                  Прямое сетевое подключение. Включите прокси, если YouTube или SoundCloud замедлены провайдером.
                </Typography>
              </Box>
            )}
          </Box>

          {/* ─── Subsection B: yt-dlp Background Auto-Updater ────────────── */}
          <Box sx={{ p: 2.2, bgcolor: 'rgba(255, 255, 255, 0.03)', borderRadius: 3, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Box display="flex" alignItems="center" gap={1.2}>
                <Terminal sx={{ color: 'primary.main', fontSize: 22 }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                    {t.ytdlpTitle}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block' }}>
                    {t.ytdlpDesc}
                  </Typography>
                </Box>
              </Box>

              <Chip
                size="small"
                label={ytdlpInfo?.currentVersion ? `v${ytdlpInfo.currentVersion}` : 'yt-dlp'}
                sx={{
                  bgcolor: 'rgba(208, 188, 255, 0.16)',
                  color: 'primary.light',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Toggle automatic background updates */}
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                    {t.ytdlpAutoUpdate}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                    {t.ytdlpAutoUpdateDesc}
                  </Typography>
                </Box>
                <Switch
                  checked={ytdlpInfo?.autoUpdate !== false}
                  onChange={e => handleToggleYtdlpAutoUpdate(e.target.checked)}
                />
              </Box>

              {/* Status details & update button */}
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ pt: 0.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                    {ytdlpInfo?.statusText || (ytdlpInfo?.currentVersion ? `Установлен: ${ytdlpInfo.currentVersion}` : 'Готов')}
                  </Typography>
                  {ytdlpInfo?.path && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', fontFamily: 'monospace', display: 'block', maxWidth: 460, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ytdlpInfo.path}
                    </Typography>
                  )}
                </Box>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh sx={{ animation: ytdlpChecking ? 'spin 1s linear infinite' : 'none' }} />}
                  onClick={handleUpdateYtdlp}
                  disabled={ytdlpChecking || ytdlpInfo?.isUpdating}
                  sx={{
                    color: '#ffffff',
                    borderColor: 'rgba(255,255,255,0.2)',
                    textTransform: 'none',
                    borderRadius: 2,
                    fontWeight: 600,
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(208, 188, 255, 0.08)' },
                  }}
                >
                  {ytdlpChecking || ytdlpInfo?.isUpdating ? t.ytdlpUpdating : t.ytdlpCheckNow}
                </Button>
              </Box>
            </Box>
          </Box>

          {/* ─── Subsection C: Title Cleanup (Existing) ──────────────────── */}
          <Box sx={{ p: 2.2, bgcolor: 'rgba(255, 255, 255, 0.03)', borderRadius: 3, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 700, mb: 0.5 }}>
              {t.titleCleanup}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
              {t.titleCleanupDesc}
            </Typography>

            <Box display="flex" gap={1} sx={{ mb: 2 }}>
              <TextField
                size="small"
                value={newWord}
                onChange={e => setNewWord(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addWord()}
                placeholder='например: "Official Video"'
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={addWord}
                sx={{
                  bgcolor: 'primary.main',
                  color: '#141218',
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none'
                }}
              >
                {t.addWord}
              </Button>
            </Box>

            <Box display="flex" flexWrap="wrap" gap={0.8} sx={{ mb: 2 }}>
              {settings.exclusionWords.map(word => (
                <Chip
                  key={word}
                  label={word}
                  onDelete={() => removeWord(word)}
                  deleteIcon={<Delete sx={{ fontSize: '14px !important' }} />}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(208,188,255,0.12)',
                    color: '#ffffff',
                    borderRadius: 1.5,
                    '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.6)' },
                  }}
                />
              ))}
            </Box>

            <Button
              size="small"
              startIcon={<RestartAlt />}
              onClick={resetExclusions}
              sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}
            >
              {t.resetDefaults}
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}

// Borderless, sleek M3 card
const SectionCard: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({
  title, icon, children
}) => (
  <Paper
    elevation={0}
    sx={{
      p: { xs: 2.2, md: 3 },
      mb: 2.5,
      borderRadius: 3.5,
      bgcolor: 'rgba(255, 255, 255, 0.04)',
      border: 'none', // Removed borders as requested!
    }}
  >
    <Box display="flex" alignItems="center" gap={1.2} sx={{ mb: 2 }}>
      {icon}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#ffffff', fontSize: '1.02rem' }}>
        {title}
      </Typography>
    </Box>
    {children}
  </Paper>
)
