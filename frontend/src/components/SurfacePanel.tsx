import { Paper, type PaperProps } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  trovanColors,
  trovanLayout,
  trovanShadows,
} from '../theme/designTokens';

type SurfacePanelVariant =
  | 'default'
  | 'panel'
  | 'elevated'
  | 'muted'
  | 'subtle'
  | 'inverse'
  | 'command'
  | 'canvas'
  | 'accent';

type SurfacePanelProps = Omit<PaperProps, 'variant'> & {
  variant?: SurfacePanelVariant;
  padding?: number | string;
};

export function SurfacePanel({
  variant = 'default',
  padding,
  ...props
}: SurfacePanelProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const panelText = isDark ? '#FFF8ED' : '#17110D';
  const secondaryText = alpha(panelText, isDark ? 0.62 : 0.64);
  const panelBorder = isDark ? 'rgba(255,246,233,0.14)' : 'rgba(32,24,18,0.13)';
  const panelBorderStrong = isDark
    ? 'rgba(255,246,233,0.23)'
    : 'rgba(32,24,18,0.18)';
  const panel = isDark ? '#211A16' : '#F8F7F3';
  const muted = isDark ? '#2A221D' : '#ECE9E3';
  const elevated = isDark ? '#2D241E' : '#FFFFFF';
  const inverse = isDark ? '#120E0B' : trovanColors.black[950];

  const consoleSurfaceText = {
    color: panelText,
    '& .MuiTypography-root': {
      color: 'inherit',
    },
    '& .MuiTypography-colorTextSecondary, & .MuiListItemText-secondary': {
      color: secondaryText,
    },
    '& .MuiInputLabel-root': {
      color: secondaryText,
    },
    '& .MuiOutlinedInput-root': {
      color: panelText,
      backgroundColor: isDark ? alpha('#120E0B', 0.36) : alpha('#FFFFFF', 0.58),
      '& fieldset': {
        borderColor: panelBorderStrong,
      },
      '&:hover fieldset': {
        borderColor: isDark ? trovanColors.copper[300] : trovanColors.copper[500],
      },
      '&.Mui-focused fieldset': {
        borderColor: trovanColors.copper[500],
      },
      '& .MuiSelect-icon': {
        color: secondaryText,
      },
      '& input::placeholder': {
        color: alpha(panelText, 0.54),
        opacity: 1,
      },
    },
    '& .MuiButton-text': {
      color: alpha(panelText, 0.78),
    },
  } as const;

  const variantSx: Record<SurfacePanelVariant, Record<string, string>> = {
    default: {
      bgcolor: panel,
      border: `1px solid ${panelBorder}`,
      boxShadow: trovanShadows.soft,
      color: panelText,
    },
    panel: {
      bgcolor: panel,
      border: `1px solid ${panelBorder}`,
      boxShadow: trovanShadows.soft,
      color: panelText,
    },
    elevated: {
      bgcolor: elevated,
      border: `1px solid ${panelBorder}`,
      boxShadow: trovanShadows.hover,
      color: panelText,
    },
    muted: {
      bgcolor: muted,
      border: `1px solid ${panelBorder}`,
      boxShadow: 'none',
      color: panelText,
    },
    subtle: {
      bgcolor: muted,
      border: `1px solid ${panelBorder}`,
      boxShadow: 'none',
      color: panelText,
    },
    inverse: {
      bgcolor: inverse,
      border: `1px solid ${panelBorderStrong}`,
      boxShadow: trovanShadows.soft,
      color: '#FFF8ED',
    },
    command: {
      bgcolor: panel,
      border: `1px solid ${panelBorderStrong}`,
      boxShadow: trovanShadows.soft,
      color: panelText,
      backgroundImage: 'none',
    },
    canvas: {
      bgcolor: panel,
      border: `1px solid ${panelBorderStrong}`,
      boxShadow: trovanShadows.soft,
      color: panelText,
      backgroundImage: 'none',
    },
    accent: {
      bgcolor: panel,
      border: `1px solid ${alpha(trovanColors.copper[500], 0.28)}`,
      boxShadow: trovanShadows.soft,
      color: panelText,
      backgroundImage: 'none',
    },
  };

  return (
    <Paper
      {...props}
      sx={{
        p: padding ?? 2.5,
        borderRadius: `${trovanLayout.panelRadius}px`,
        backgroundImage: 'none',
        ...variantSx[variant],
        ...consoleSurfaceText,
        ...props.sx,
      }}
    />
  );
}
