import { createTheme } from '@mui/material/styles'

// Material 3 dark theme with moderate, elegant border-radius
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#d0bcff',       // M3 primary
      light: '#e8def8',
      dark: '#b69df8',
      contrastText: '#381e72',
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
    borderRadius: 12, // Moderate, NOT overly large
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
          color: '#d0bcff',
          '& .MuiSlider-thumb': {
            width: 14,
            height: 14,
            transition: 'width 0.15s, height 0.15s, box-shadow 0.15s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            '&:hover, &.Mui-active': {
              width: 16,
              height: 16,
              boxShadow: '0 0 0 6px rgba(208, 188, 255, 0.2)',
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
    // Working Material You Switch (clean, responsive, reliable)
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
            color: '#381e72',
            '& + .MuiSwitch-track': {
              backgroundColor: '#d0bcff',
              opacity: 1,
              border: 'none',
            },
            '& .MuiSwitch-thumb': {
              backgroundColor: '#381e72',
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
            borderColor: '#d0bcff',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#d0bcff',
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
