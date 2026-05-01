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
  bgcolor: alpha(trovanColors.utility.panel, 0.86),
  border: `1px solid ${trovanColors.utility.borderStrong}`,
  boxShadow: trovanShadows.soft,
  backdropFilter: 'blur(18px)',
  color: '#FFF8ED',
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
            `radial-gradient(circle at 18% 14%, ${alpha(trovanColors.copper[200], 0.16)} 0%, ${alpha(
              trovanColors.copper[500],
              0.05,
            )} 28%, transparent 50%)`,
            `linear-gradient(180deg, ${alpha(trovanColors.stone[0], 0.06)} 0%, transparent 46%, ${alpha(
              trovanColors.black[950],
              0.06,
            )} 100%)`,
          ].join(','),
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          boxShadow: `inset 0 0 0 1px ${alpha(
            trovanColors.black[950],
            0.1,
          )}, inset 0 -80px 110px ${alpha(trovanColors.black[950], 0.1)}, inset 0 0 120px ${alpha(
            trovanColors.copper[900],
            0.05,
          )}`,
        }}
      />
    </Box>
  );
}
