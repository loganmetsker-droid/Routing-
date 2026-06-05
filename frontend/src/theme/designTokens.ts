export const trovanColors = {
  copper: {
    50: '#FCF7F1',
    100: '#F7E9D8',
    200: '#EAC99F',
    300: '#DDA569',
    400: '#C77D35',
    500: '#A96321',
    600: '#8D4F18',
    700: '#713D12',
    800: '#552C0D',
    900: '#341A08',
  },
  black: {
    50: '#F4F1ED',
    100: '#DDD6CE',
    300: '#93867A',
    500: '#3D352F',
    700: '#1E1A17',
    800: '#151210',
    900: '#0B0908',
    950: '#050403',
  },
  stone: {
    0: '#FFFDF9',
    25: '#FAF6EF',
    50: '#F2EAE0',
    75: '#E6D9CA',
    100: '#D6C6B4',
    200: '#BCA88F',
    300: '#9D866F',
    400: '#7B6754',
    500: '#5D4D3F',
    600: '#44382E',
    700: '#302720',
    800: '#1D1713',
    900: '#100C0A',
  },
  semantic: {
    success: '#4E7A56',
    warning: '#A97836',
    danger: '#A95649',
    info: '#60789B',
  },
  utility: {
    border: 'rgba(255, 246, 233, 0.13)',
    borderStrong: 'rgba(255, 246, 233, 0.22)',
    surfaceTint: '#151210',
    selectedTint: 'rgba(169, 99, 33, 0.18)',
    focusRing: 'rgba(169, 99, 33, 0.24)',
    shell: '#0B0908',
    shellElevated: '#211A16',
    shellLine: 'rgba(255, 246, 233, 0.10)',
    topbar: 'rgba(18, 14, 11, 0.92)',
    panel: '#211A16',
    panelMuted: '#2A221D',
    panelInverse: '#120E0B',
    mapCanvas: '#E7DED2',
  },
} as const;

export const trovanTopoTokens = {
  line: 'rgba(169, 99, 33, 0.13)',
  lineSoft: 'rgba(52, 26, 8, 0.07)',
  glow: 'rgba(169, 99, 33, 0.2)',
  grid: 'rgba(52, 26, 8, 0.052)',
} as const;

export const trovanTypography = {
  uiFontFamily: [
    '"Instrument Sans"',
    '"Avenir Next"',
    '"Segoe UI"',
    'system-ui',
    '-apple-system',
    'sans-serif',
  ].join(','),
  brandFontFamily: [
    '"Instrument Sans"',
    '"Avenir Next"',
    '"Segoe UI"',
    'system-ui',
    '-apple-system',
    'sans-serif',
  ].join(','),
} as const;

export const trovanMapTokens = {
  tileUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  routePalette: [
    '#A96321',
    '#4E7A56',
    '#60789B',
    '#B74D47',
    '#8E658D',
    '#5E8B70',
  ],
} as const;

export const trovanLayout = {
  sidebarWidth: 304,
  headerHeight: 58,
  pageMaxWidth: 1760,
  pagePaddingX: 28,
  pagePaddingY: 24,
  panelRadius: 12,
  innerRadius: 9,
  controlRadius: 8,
  gridGap: 18,
  compactGap: 12,
} as const;

export const trovanShadows = {
  soft: '0 20px 48px rgba(0, 0, 0, 0.34)',
  hover: '0 28px 70px rgba(0, 0, 0, 0.44)',
  focus: '0 0 0 3px rgba(169, 99, 33, 0.24)',
} as const;
