export const trovanTokens = {
  color: {
    copper: {
      900: '#341A08',
      700: '#713D12',
      600: '#8D4F18',
      500: '#A96321',
      400: '#C77D35',
      300: '#DDA569',
    },
    slate: {
      950: '#050403',
      900: '#0B0908',
      800: '#151210',
      700: '#1E1A17',
      600: '#3D352F',
      500: '#5D4D3F',
      300: '#9D866F',
      200: '#D6C6B4',
      100: '#F2EAE0',
      50: '#FAF6EF',
    },
    semantic: {
      success: '#4E7A56',
      warning: '#A97836',
      danger: '#A95649',
      info: '#60789B',
      neutral: '#7B6754',
    },
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
  },
  border: {
    light: 'rgba(22, 33, 43, 0.12)',
    strong: 'rgba(22, 33, 43, 0.2)',
  },
  shadow: {
    soft: '0 8px 20px -18px rgba(15, 23, 32, 0.24)',
    hover: '0 12px 24px -18px rgba(15, 23, 32, 0.28)',
  },
  typography: {
    heading: '"Instrument Sans", "Avenir Next", "Segoe UI", sans-serif',
    body: '"Instrument Sans", "Avenir Next", "Segoe UI", sans-serif',
  },
} as const;

export const moduleAccents = {
  dashboard: '#713D12',
  jobs: '#5D4D3F',
  dispatch: '#A96321',
  tracking: '#60789B',
  drivers: '#4E7A56',
  vehicles: '#8D4F18',
  customers: '#7B6754',
} as const;

export const statusTokens = {
  live: trovanTokens.color.semantic.info,
  success: trovanTokens.color.semantic.success,
  warning: trovanTokens.color.semantic.warning,
  danger: trovanTokens.color.semantic.danger,
  neutral: trovanTokens.color.semantic.neutral,
} as const;

export const shellTokens = {
  sidebar: {
    compactWidth: 76,
    mobileWidth: 248,
  },
  radius: {
    sm: trovanTokens.radius.sm,
    md: trovanTokens.radius.md,
    lg: trovanTokens.radius.lg,
    xl: trovanTokens.radius.xl,
  },
  spacing: trovanTokens.spacing,
  shadow: {
    soft: trovanTokens.shadow.soft,
    hover: trovanTokens.shadow.hover,
  },
  background: {
    light: '#050403',
    topbarLight: 'rgba(255, 252, 247, 0.88)',
    topbarDark: 'rgba(11, 9, 8, 0.92)',
  },
  surface: {
    cardLight: '#151210',
    cardTintLight: '#1E1A17',
    borderLight: trovanTokens.border.light,
  },
} as const;
