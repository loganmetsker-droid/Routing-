import { type ReactNode } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';
import { SurfacePanel } from '../SurfacePanel';

type MapFirstWorkspaceProps = {
  commandBar?: ReactNode;
  map: ReactNode;
  lanes?: ReactNode;
  inspector?: ReactNode;
  mapHeight?: number | string;
  sx?: SxProps<Theme>;
};

export function MapFirstWorkspace({
  commandBar,
  map,
  lanes,
  inspector,
  mapHeight = 520,
  sx,
}: MapFirstWorkspaceProps) {
  return (
    <Box
      sx={[
        { display: 'grid', gap: 1.25 },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {commandBar}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: inspector ? 'minmax(0, 1fr) 360px' : '1fr' },
          gap: 1.25,
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ display: 'grid', gap: 1.25, minWidth: 0 }}>
          <SurfacePanel variant="canvas" padding={0} sx={{ minHeight: mapHeight, overflow: 'hidden' }}>
            {map}
          </SurfacePanel>
          {lanes}
        </Box>
        {inspector}
      </Box>
    </Box>
  );
}

export default MapFirstWorkspace;
