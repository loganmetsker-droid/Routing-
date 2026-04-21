import { alpha } from '@mui/material/styles';
import { Box, IconButton, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { shellTokens } from '../../theme/tokens';

type ModuleHeaderProps = {
  title: string;
  subtitle: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
};

export default function ModuleHeader({ title, subtitle, onRefresh, isRefreshing = false }: ModuleHeaderProps) {
  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.4 },
        borderRadius: `${shellTokens.radius.lg}px`,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.97),
        boxShadow: shellTokens.shadow.soft,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
            Trovan Operations
          </Typography>
          <Typography variant="h5" fontWeight={700} sx={{ mt: 0.35, lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {subtitle}
          </Typography>
        </Box>
        <IconButton
          onClick={onRefresh}
          disabled={isRefreshing}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            transform: isRefreshing ? 'rotate(360deg)' : 'none',
            transition: 'transform 0.45s ease',
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.86),
          }}
        >
          <Refresh fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
