import { Box, IconButton, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';

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
        p: { xs: 2, md: 2.5 },
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
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
          }}
        >
          <Refresh fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
