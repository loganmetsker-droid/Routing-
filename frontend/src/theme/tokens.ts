export const trovanTokens = {
  color: {
    copper: {
      900: '#5A341F',
      700: '#8A5530',
      600: '#A7663A',
      500: '#C27A44',
      400: '#D89668',
      300: '#E8B08B',
    },
    slate: {
      950: '#0F1720',
      900: '#16212B',
      800: '#243341',
      700: '#314557',
      600: '#4A6174',
      500: '#667D92',
      300: '#A7B7C6',
      200: '#CBD6E0',
      100: '#E5ECF2',
      50: '#F4F7FB',
    },
    semantic: {
      success: '#2E7D58',
      warning: '#B7791F',
      danger: '#B23A3A',
      info: '#2F6EA8',
      neutral: '#64748B',
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
    heading: '"Space Grotesk", "Inter", "Segoe UI", sans-serif',
    body: '"Inter", "Segoe UI", sans-serif',
  },
} as const;

export const moduleAccents = {
  dashboard: '#5E7388',
  jobs: '#2F6EA8',
  dispatch: '#C27A44',
  tracking: '#7C9155',
  drivers: '#6A63A8',
  vehicles: '#4E5E93',
  customers: '#2F7E77',
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
    light: trovanTokens.color.slate[50],
    topbarLight: 'rgba(250, 252, 255, 0.9)',
    topbarDark: 'rgba(15, 23, 32, 0.84)',
  },
  surface: {
    cardLight: '#ffffff',
    cardTintLight: '#f8fafc',
    borderLight: trovanTokens.border.light,
  },
} as const;
