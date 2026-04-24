import { Box, type SxProps, type Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  trovanColors,
  trovanMapTokens,
  trovanShadows,
} from '../../theme/designTokens';

export const trovanRoutePalette = trovanMapTokens.routePalette;

export const trovanMapLayer = {
  url: trovanMapTokens.tileUrl,
  attribution: trovanMapTokens.attribution,
} as const;

export const mapFloatingPanelSx: SxProps<Theme> = {
  bgcolor: alpha('#FFFDFB', 0.82),
  border: `1px solid ${alpha(trovanColors.stone[700], 0.12)}`,
  boxShadow: trovanShadows.soft,
  backdropFilter: 'blur(18px)',
};

export function MapFilmOverlay() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 450,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: [
            `radial-gradient(circle at 18% 14%, ${alpha('#FFF9F3', 0.44)} 0%, ${alpha(
              '#FFF9F3',
              0.18,
            )} 24%, transparent 44%)`,
            `linear-gradient(180deg, ${alpha('#FFF7EF', 0.16)} 0%, ${alpha(
              '#FFF7EF',
              0.04,
            )} 38%, ${alpha(trovanColors.stone[900], 0.04)} 100%)`,
          ].join(','),
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          boxShadow: `inset 0 0 0 1px ${alpha(
            trovanColors.stone[700],
            0.12,
          )}, inset 0 -90px 110px ${alpha('#FFF9F2', 0.12)}, inset 0 0 160px ${alpha(
            trovanColors.stone[900],
            0.06,
          )}`,
        }}
      />
    </Box>
  );
}
