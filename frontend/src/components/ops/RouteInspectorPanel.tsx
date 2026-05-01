import { type ReactNode } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';
import { SurfacePanel } from '../SurfacePanel';
import { trovanColors } from '../../theme/designTokens';

type OpsStyle = SystemStyleObject<Theme>;

type RouteInspectorPanelProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  sx?: OpsStyle;
};

export function RouteInspectorPanel({
  title,
  subtitle,
  status,
  actions,
  summary,
  children,
  footer,
  sx,
}: RouteInspectorPanelProps) {
  const theme = useTheme();
  const panelBorder = theme.palette.mode === 'dark'
    ? trovanColors.utility.border
    : alpha(trovanColors.black[900], 0.13);

  return (
    <SurfacePanel
      variant="panel"
      padding={0}
      sx={{
        alignSelf: 'stretch',
        display: 'flex',
        minHeight: 0,
        flexDirection: 'column',
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Box sx={{ p: 1.6, borderBottom: `1px solid ${panelBorder}` }}>
        <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            {title ? (
              <Typography variant="h5" component="div">
                {title}
              </Typography>
            ) : null}
            {subtitle ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {status}
        </Stack>
        {actions ? (
          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
            {actions}
          </Stack>
        ) : null}
      </Box>
      {summary ? (
        <>
          <Box sx={{ p: 1.6 }}>{summary}</Box>
          <Divider />
        </>
      ) : null}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: children ? 1.6 : 0 }}>
        {children}
      </Box>
      {footer ? (
        <Box sx={{ p: 1.6, borderTop: `1px solid ${panelBorder}` }}>
          {footer}
        </Box>
      ) : null}
    </SurfacePanel>
  );
}

export default RouteInspectorPanel;
