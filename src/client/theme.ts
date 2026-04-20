import { createTheme } from '@mui/material/styles';

export const SR = {
  surfaceApp:    '#F0EDE6',
  surfacePanel:  '#E4E0D6',
  surfaceCard:   '#D8D3C8',
  surfaceInk:    '#1E2228',
  surfaceInkMid: '#2C333D',
  surfaceInkSub: '#3A424E',
  surfaceInkDim: '#4A5060',

  accentTeal:     '#1E6B5A',
  accentTealHover:'#165A4A',
  accentTealLight:'#6ABFA8',
  accentTealBg:   '#E0F5EF',
  accentGold:     '#AA7946',
  accentGoldBorder:'#D4A870',
  accentGoldLight:'#F5EDD8',
  accentRed:      '#7A3028',
  accentRedLight: '#C49088',
  accentRedBg:    '#F5E8E4',

  textPrimary: '#1E2228',
  textMuted:   '#6A7080',
  textFaint:   '#9098A8',
  textLight:   '#E4E0D6',

  border:     '#C4BFB4',
  borderDark: '#3A424E',

  diffAdd:    '#6ABFA8',
  diffRemove: '#C49088',
  diffHash:   '#AA7946',
  diffMeta:   '#4A5060',

  fontDisplay: "'Cinzel', 'Times New Roman', serif",
  fontUi:      "'Jost', 'Helvetica Neue', sans-serif",
  fontMono:    "'IBM Plex Mono', 'Courier New', monospace",
} as const;

const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: SR.surfaceApp,
      paper: SR.surfacePanel,
    },
    primary: {
      main: SR.accentTeal,
      light: SR.accentTealLight,
      dark: SR.accentTealHover,
      contrastText: SR.accentTealBg,
    },
    secondary: {
      main: SR.accentGold,
      light: SR.accentGoldLight,
      contrastText: SR.textPrimary,
    },
    error: {
      main: SR.accentRed,
      light: SR.accentRedLight,
      contrastText: SR.accentRedBg,
    },
    success: {
      main: SR.accentTeal,
      light: SR.accentTealLight,
      contrastText: SR.accentTealBg,
    },
    text: {
      primary: SR.textPrimary,
      secondary: SR.textMuted,
      disabled: SR.textFaint,
    },
    divider: SR.border,
  },
  typography: {
    fontFamily: SR.fontUi,
    h1: { fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 24, letterSpacing: '0.03em' },
    h2: { fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 18, letterSpacing: '0.03em' },
    h3: { fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 16, letterSpacing: '0.03em' },
    h4: { fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 14, letterSpacing: '0.03em' },
    h5: { fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 22, letterSpacing: '0.03em' },
    h6: { fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 18, letterSpacing: '0.03em' },
    body1: { fontFamily: SR.fontUi, fontSize: 14, fontWeight: 400 },
    body2: { fontFamily: SR.fontUi, fontSize: 13, fontWeight: 400 },
    caption: { fontFamily: SR.fontUi, fontSize: 11, fontWeight: 400, color: SR.textFaint },
    overline: { fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500, letterSpacing: '0.10em', color: SR.textFaint },
    button: { fontFamily: SR.fontUi, fontSize: 12, fontWeight: 500, textTransform: 'none' as const },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: SR.surfaceApp, color: SR.textPrimary, minWidth: 320 },
        '*': { boxSizing: 'border-box' },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: SR.surfaceInk,
          borderBottom: `0.5px solid ${SR.borderDark}`,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 6, fontSize: 12, fontWeight: 500, textTransform: 'none' },
        containedPrimary: {
          backgroundColor: SR.accentTeal,
          color: SR.accentTealBg,
          '&:hover': { backgroundColor: SR.accentTealHover },
        },
        outlinedPrimary: {
          borderColor: SR.border,
          borderWidth: '0.5px',
          color: SR.textMuted,
          '&:hover': { backgroundColor: SR.surfaceCard, borderColor: SR.border },
        },
        text: { color: SR.textMuted },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { color: SR.textMuted },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: SR.surfaceApp,
            fontFamily: SR.fontUi,
            '& fieldset': { borderColor: SR.border, borderWidth: '0.5px' },
            '&:hover fieldset': { borderColor: SR.textMuted },
            '&.Mui-focused fieldset': { borderColor: SR.accentTeal },
          },
          '& .MuiInputLabel-root': { fontFamily: SR.fontUi, fontSize: 13, color: SR.textMuted },
          '& .MuiInputLabel-root.Mui-focused': { color: SR.accentTeal },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          fontFamily: SR.fontUi,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: SR.border, borderWidth: '0.5px' },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: SR.surfacePanel,
          border: `0.5px solid ${SR.border}`,
          borderRadius: 8,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: SR.surfacePanel,
          border: 'none',
          borderRight: `0.5px solid ${SR.border}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: SR.surfaceApp,
          border: `0.5px solid ${SR.border}`,
          borderRadius: 8,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 16, letterSpacing: '0.03em', color: SR.textPrimary },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: SR.border, borderWidth: '0.5px' },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          '&.Mui-selected': {
            backgroundColor: SR.surfaceInk,
            color: SR.textLight,
            '&:hover': { backgroundColor: SR.surfaceInk },
          },
          '&:hover': { backgroundColor: SR.surfaceCard },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontFamily: SR.fontUi, fontSize: 13 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          fontFamily: SR.fontUi,
          fontSize: 12,
          textTransform: 'none',
          borderColor: SR.border,
          borderWidth: '0.5px',
          color: SR.textMuted,
          '&.Mui-selected': {
            backgroundColor: SR.surfaceInk,
            color: SR.textLight,
            '&:hover': { backgroundColor: SR.surfaceInk },
          },
        },
      },
    },
  },
});

export default theme;
