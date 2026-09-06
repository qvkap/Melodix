import { createTheme } from '@mui/material/styles'

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ]
  }
  return [
    parseInt(clean.slice(0, 2), 16) || 208,
    parseInt(clean.slice(2, 4), 16) || 188,
    parseInt(clean.slice(4, 6), 16) || 255,
  ]
}

function adjustBrightness(hex: string, percent: number): string {
  const [r, g, b] = parseHex(hex)
  const adjustLight = (val: number) => Math.min(255, Math.max(0, Math.round(val + (255 - val) * (percent / 100))))
  const adjustDark = (val: number) => Math.min(255, Math.max(0, Math.round(val * (1 + percent / 100))))
  const fn = percent > 0 ? adjustLight : adjustDark
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(fn(r))}${toHex(fn(g))}${toHex(fn(b))}`
}

function getContrastYIQ(hex: string): string {
  const [r, g, b] = parseHex(hex)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#141218' : '#ffffff'
}

// Material 3 dark theme builder with dynamic accent color
export function buildAppTheme(accentColor: string = '#d0bcff') {
  const [r, g, b] = parseHex(accentColor)
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--accent-color', accentColor)
    document.documentElement.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`)
  }

  const light = adjustBrightness(accentColor, 35)
  const dark = adjustBrightness(accentColor, -25)
  const contrastText = getContrastYIQ(accentColor)

  return createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: accentColor,
        light,
        dark,
        contrastText,
      },
      secondary: {
        main: '#ccc2dc',
        contrastText: '#332d41',
      },
      background: {
        default: '#0c0e14',
        paper: '#161822',
      },
      text: {
        primary: '#f4f0f6',
        secondary: '#c8c4ce',
      },
      divider: 'rgba(255,255,255,0.06)',
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 500 },
      body1: { fontSize: '0.95rem' },
      body2: { color: '#c8c4ce' },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            textTransform: 'none',
            fontWeight: 600,
            padding: '7px 18px',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'transform 0.15s ease, background-color 0.2s ease',
            '&:active': {
              transform: 'scale(0.92)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: 'none',
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            height: 5,
            color: accentColor,
            '& .MuiSlider-thumb': {
              width: 14,
              height: 14,
              transition: 'width 0.15s, height 0.15s, box-shadow 0.15s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              '&:hover, &.Mui-active': {
                width: 16,
                height: 16,
                boxShadow: `0 0 0 6px rgba(${r}, ${g}, ${b}, 0.25)`,
              },
            },
            '& .MuiSlider-track': {
              border: 'none',
              borderRadius: 6,
            },
            '& .MuiSlider-rail': {
              borderRadius: 6,
              backgroundColor: 'rgba(255,255,255,0.18)',
            },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: {
            width: 48,
            height: 28,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          },
          switchBase: {
            padding: 3,
            color: '#938f99',
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            '&.Mui-checked': {
              transform: 'translateX(20px)',
              color: contrastText,
              '& + .MuiSwitch-track': {
                backgroundColor: accentColor,
                opacity: 1,
                border: 'none',
              },
              '& .MuiSwitch-thumb': {
                backgroundColor: contrastText,
                width: 22,
                height: 22,
              },
            },
          },
          thumb: {
            width: 16,
            height: 16,
            borderRadius: 99,
            backgroundColor: '#938f99',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          },
          track: {
            borderRadius: 14,
            opacity: 1,
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: '1.5px solid #938f99',
            boxSizing: 'border-box',
            transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            '& fieldset': {
              borderColor: 'rgba(255,255,255,0.1)',
            },
            '&:hover fieldset': {
              borderColor: accentColor,
            },
            '&.Mui-focused fieldset': {
              borderColor: accentColor,
              borderWidth: 2,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500,
          },
        },
      },
    },
  })
}

export const darkTheme = buildAppTheme('#d0bcff')

