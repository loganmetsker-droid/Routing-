export const trovanColors = {
  copper: {
    50: '#FBF5EE',
    100: '#F6E8D7',
    200: '#E8CDA7',
    300: '#DBAF78',
    400: '#C98D49',
    500: '#B97129',
    600: '#9E5D1F',
    700: '#804818',
    800: '#633713',
    900: '#43240C',
  },
  stone: {
    0: '#FBF8F3',
    25: '#F5F0E9',
    50: '#EAE2D7',
    75: '#DDD1C2',
    100: '#CEBEAB',
    200: '#B4A08B',
    300: '#9A846F',
    400: '#7E6A58',
    500: '#655546',
    600: '#4C4034',
    700: '#392F26',
    800: '#241D18',
    900: '#15110F',
  },
  semantic: {
    success: '#5B8763',
    warning: '#B68942',
    danger: '#B66658',
    info: '#6C82B6',
  },
  utility: {
    border: 'rgba(55, 43, 34, 0.09)',
    borderStrong: 'rgba(55, 43, 34, 0.16)',
    surfaceTint: '#F6F1EA',
    selectedTint: 'rgba(185, 113, 41, 0.10)',
    focusRing: 'rgba(185, 113, 41, 0.22)',
    shell: '#F7F3EE',
    shellElevated: '#FFFCF8',
    topbar: 'rgba(253, 249, 243, 0.88)',
    panel: '#FFFDFC',
    panelMuted: '#F9F4EE',
    panelInverse: '#FFFDFC',
    mapCanvas: '#E7DDD2',
  },
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
  brandFontFamily: ['"Newsreader"', 'Georgia', '"Times New Roman"', 'serif'].join(','),
} as const;

export const trovanMapTokens = {
  tileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  routePalette: [
    '#B97129',
    '#708967',
    '#6C82B6',
    '#9D7A4E',
    '#8A6D90',
    '#8F9B88',
  ],
} as const;

export const trovanLayout = {
  sidebarWidth: 304,
  headerHeight: 60,
  pageMaxWidth: 1760,
  pagePaddingX: 28,
  pagePaddingY: 24,
  panelRadius: 14,
  innerRadius: 10,
  controlRadius: 9,
  gridGap: 20,
  compactGap: 12,
} as const;

export const trovanShadows = {
  soft: '0 18px 40px rgba(58, 41, 25, 0.08)',
  hover: '0 26px 60px rgba(58, 41, 25, 0.14)',
  focus: '0 0 0 3px rgba(185, 113, 41, 0.22)',
} as const;
