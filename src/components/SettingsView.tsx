import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Switch, Slider, Chip, TextField,
  Button, Paper, Accordion, AccordionSummary, AccordionDetails,
  Select, MenuItem, FormControl, Tooltip
} from '@mui/material'
import {
  Add, Delete, RestartAlt, ExpandMore, Language, BlurOn,
  SettingsApplications, Tune, CloudQueue, Check, CheckCircle, ErrorOutline,
  SystemUpdateAlt, Refresh, Download, Palette, Wallpaper, ColorLens
} from '@mui/icons-material'
import { useSettings } from '../contexts/SettingsContext'
import { BlurMaterial, AppLanguage } from '../types'

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
                Melodix Beta 0.2
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

      {/* 6. Advanced Settings (Title Cleanup) - Borderless Accordion */}
      <Accordion
        elevation={0}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '14px !important',
          border: 'none',
          overflow: 'hidden',
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMore sx={{ color: '#ffffff' }} />}
          sx={{ px: 2.5, py: 0.5 }}
        >
          <Box display="flex" alignItems="center" gap={1.2}>
            <SettingsApplications sx={{ color: 'primary.light', fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ffffff' }}>
              {t.advancedSettings}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
          <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 600, mb: 0.5 }}>
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
