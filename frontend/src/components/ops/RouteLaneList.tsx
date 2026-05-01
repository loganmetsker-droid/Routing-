import { type ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';
import { SurfacePanel } from '../SurfacePanel';
import { trovanColors } from '../../theme/designTokens';

type OpsStyle = SystemStyleObject<Theme>;

export type RouteLaneListItem = {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  content?: ReactNode;
};

type RouteLaneListProps<TItem extends RouteLaneListItem = RouteLaneListItem> = {
  title?: ReactNode;
  subtitle?: ReactNode;
  items: TItem[];
  emptyState?: ReactNode;
  renderItem?: (item: TItem, index: number) => ReactNode;
  sx?: OpsStyle;
};

export function RouteLaneList<TItem extends RouteLaneListItem = RouteLaneListItem>({
  title,
  subtitle,
  items,
  emptyState,
  renderItem,
  sx,
}: RouteLaneListProps<TItem>) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const panelBorder = isDark ? trovanColors.utility.border : alpha(trovanColors.black[900], 0.13);

  return (
    <SurfacePanel
      variant="panel"
      padding={0}
      sx={{ overflow: 'hidden', ...sx }}
    >
      {(title || subtitle) ? (
        <Box sx={{ px: 1.6, py: 1.25, borderBottom: `1px solid ${panelBorder}` }}>
          {title ? (
            <Typography variant="h5" component="div">
              {title}
            </Typography>
          ) : null}
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      ) : null}
      <Stack spacing={0.85} sx={{ p: 1 }}>
        {items.length === 0 ? (
          emptyState ?? (
            <Box sx={{ p: 2, color: 'text.secondary' }}>
              <Typography variant="body2">No route lanes available.</Typography>
            </Box>
          )
        ) : (
          items.map((item, index) =>
            renderItem ? (
              <Box key={item.id}>{renderItem(item, index)}</Box>
            ) : (
              <Box
                key={item.id}
                sx={{
                  p: 1.1,
                  borderRadius: '8px',
                  border: `1px solid ${panelBorder}`,
                  bgcolor: isDark ? alpha(trovanColors.black[950], 0.28) : alpha('#FFFFFF', 0.54),
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" component="div">
                      {item.title}
                    </Typography>
                    {item.subtitle ? (
                      <Typography variant="body2" color="text.secondary">
                        {item.subtitle}
                      </Typography>
                    ) : null}
                  </Box>
                  {item.status}
                </Stack>
                {item.content ? <Box sx={{ mt: 1 }}>{item.content}</Box> : null}
                {item.actions ? (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {item.actions}
                  </Stack>
                ) : null}
              </Box>
            ),
          )
        )}
      </Stack>
    </SurfacePanel>
  );
}

export default RouteLaneList;
