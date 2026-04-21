export const trovanColors = {
  copper: {
    50: '#FAF1EA',
    100: '#F2E2D4',
    200: '#E7C7AF',
    300: '#D8A27F',
    400: '#C27A4E',
    500: '#B6673A',
    600: '#A85D34',
    700: '#8D4B2A',
    800: '#6E3A22',
    900: '#512918',
  },
  stone: {
    0: '#FFFCF9',
    25: '#FCFAF7',
    50: '#F7F3EE',
    75: '#F3ECE4',
    100: '#E9DED3',
    200: '#D9C9B8',
    300: '#C2AE97',
    400: '#A78E78',
    500: '#816B5A',
    600: '#5E5147',
    700: '#493E36',
    800: '#322A24',
    900: '#1F1A17',
  },
  semantic: {
    success: '#2F7D5B',
    warning: '#B8781C',
    danger: '#C6513A',
    info: '#2F6EA5',
  },
  utility: {
    border: '#E8DDD2',
    borderStrong: '#D9C9B8',
    surfaceTint: '#FFF8F2',
    selectedTint: '#FAF1EA',
    focusRing: '#D8A27F',
  },
} as const;

export const trovanLayout = {
  sidebarWidth: 280,
  headerHeight: 72,
  pageMaxWidth: 1680,
  pagePaddingX: 24,
  pagePaddingY: 20,
  panelRadius: 20,
  innerRadius: 16,
  controlRadius: 12,
  gridGap: 20,
  compactGap: 12,
} as const;

export const trovanShadows = {
  soft: '0 10px 30px rgba(31, 26, 23, 0.06)',
  hover: '0 12px 36px rgba(31, 26, 23, 0.09)',
  focus: '0 0 0 3px rgba(216, 162, 127, 0.28)',
} as const;
