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
  const surfaces = isDark ? trovanColors.dark : trovanColors.light;
  const panelText = surfaces.text;
  const secondaryText = surfaces.muted;
  const panelBorder = surfaces.border;
  const panelBorderStrong = surfaces.borderStrong;
  const panel = surfaces.surface;
  const muted = surfaces.surfaceAlt;
  const elevated = isDark ? trovanColors.dark.surfaceAlt : '#FFFFFF';
  const inverse = isDark ? trovanColors.dark.sidebar : trovanColors.brand.navy950;

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
      backgroundColor: isDark ? alpha('#FFFFFF', 0.025) : alpha('#FFFFFF', 0.72),
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
      color: trovanColors.dark.text,
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
        p: padding ?? 2,
        borderRadius: `${trovanLayout.panelRadius}px`,
        backgroundImage: 'none',
        backgroundClip: 'padding-box',
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        ...variantSx[variant],
        ...consoleSurfaceText,
        ...props.sx,
      }}
    />
  );
}
