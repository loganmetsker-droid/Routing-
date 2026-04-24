import { Paper, type PaperProps } from '@mui/material';
import { alpha } from '@mui/material/styles';
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
  const lightSurfaceText = {
    color: trovanColors.stone[900],
    '& .MuiTypography-root': {
      color: 'inherit',
    },
    '& .MuiTypography-colorTextSecondary, & .MuiListItemText-secondary': {
      color: trovanColors.stone[600],
    },
    '& .MuiInputLabel-root': {
      color: trovanColors.stone[600],
    },
    '& .MuiOutlinedInput-root': {
      color: trovanColors.stone[900],
      backgroundColor: alpha('#FFFDFC', 0.88),
      '& fieldset': {
        borderColor: trovanColors.utility.borderStrong,
      },
      '&:hover fieldset': {
        borderColor: trovanColors.copper[300],
      },
      '&.Mui-focused fieldset': {
        borderColor: trovanColors.copper[500],
      },
      '& .MuiSelect-icon': {
        color: trovanColors.stone[500],
      },
      '& input::placeholder': {
        color: trovanColors.stone[500],
        opacity: 1,
      },
    },
    '& .MuiButton-text': {
      color: trovanColors.stone[700],
    },
  } as const;

  const variantSx: Record<SurfacePanelVariant, Record<string, string>> = {
    default: {
      bgcolor: trovanColors.utility.panel,
      border: `1px solid ${trovanColors.utility.border}`,
      boxShadow: trovanShadows.soft,
      color: trovanColors.stone[900],
    },
    panel: {
      bgcolor: trovanColors.utility.panel,
      border: `1px solid ${trovanColors.utility.border}`,
      boxShadow: trovanShadows.soft,
      color: trovanColors.stone[900],
    },
    elevated: {
      bgcolor: '#FFFFFF',
      border: `1px solid ${trovanColors.utility.border}`,
      boxShadow: trovanShadows.hover,
      color: trovanColors.stone[900],
    },
    muted: {
      bgcolor: trovanColors.utility.panelMuted,
      border: `1px solid ${trovanColors.utility.border}`,
      boxShadow: 'none',
      color: trovanColors.stone[900],
    },
    subtle: {
      bgcolor: trovanColors.utility.panelMuted,
      border: `1px solid ${trovanColors.utility.border}`,
      boxShadow: 'none',
      color: trovanColors.stone[900],
    },
    inverse: {
      bgcolor: trovanColors.utility.panelInverse,
      border: `1px solid ${trovanColors.utility.borderStrong}`,
      boxShadow: trovanShadows.soft,
      color: trovanColors.stone[900],
    },
    command: {
      bgcolor: '#FFFDFC',
      border: `1px solid ${trovanColors.utility.borderStrong}`,
      boxShadow: trovanShadows.soft,
      color: trovanColors.stone[900],
      backgroundImage: 'none',
    },
    canvas: {
      bgcolor: trovanColors.utility.panel,
      border: `1px solid ${trovanColors.utility.borderStrong}`,
      boxShadow: trovanShadows.soft,
      color: trovanColors.stone[900],
      backgroundImage: 'none',
    },
    accent: {
      bgcolor: '#FFFDFC',
      border: `1px solid ${alpha(trovanColors.copper[500], 0.28)}`,
      boxShadow: trovanShadows.soft,
      color: trovanColors.stone[900],
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
        ...lightSurfaceText,
        ...props.sx,
      }}
    />
  );
}
