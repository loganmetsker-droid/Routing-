import { alpha } from '@mui/material/styles';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { Menu as MenuIcon, Brightness4 as DarkModeIcon, Brightness7 as LightModeIcon } from '@mui/icons-material';
import StatusPill from '../ui/StatusPill';
import { moduleAccents, shellTokens } from '../../theme/tokens';

type ModuleKey = keyof typeof moduleAccents;

type TopbarProps = {
  title: string;
  activeModule: ModuleKey;
  mode: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenMobileNav: () => void;
};

export default function Topbar({
  title,
  activeModule,
  mode,
  onToggleTheme,
  onOpenMobileNav,
}: TopbarProps) {
  return (
    <Box
      sx={{
        height: 72,
        px: { xs: 2, md: 3 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        backdropFilter: 'blur(8px)',
        bgcolor: mode === 'dark' ? shellTokens.background.topbarDark : shellTokens.background.topbarLight,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <IconButton onClick={onOpenMobileNav} sx={{ display: { md: 'none' } }}>
          <MenuIcon />
        </IconButton>
        <Box>
          <Typography variant="caption" sx={{ display: 'block', letterSpacing: '0.1em', color: 'text.secondary' }}>
            SIGNAL OPS
          </Typography>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            {title}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <StatusPill label={activeModule.toUpperCase()} color={moduleAccents[activeModule]} />
        </Box>
        <Tooltip title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          <IconButton
            onClick={onToggleTheme}
            sx={{
              border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.9)}`,
              borderRadius: `${shellTokens.radius.sm}px`,
            }}
          >
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
