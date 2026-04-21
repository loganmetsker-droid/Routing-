import { alpha } from '@mui/material/styles';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
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
        height: 64,
        px: { xs: 2, md: 2.5 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        backdropFilter: 'blur(12px)',
        bgcolor: mode === 'dark' ? shellTokens.background.topbarDark : shellTokens.background.topbarLight,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <IconButton onClick={onOpenMobileNav} sx={{ display: { md: 'none' } }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em' }}>
            MENU
          </Typography>
        </IconButton>
        <Box>
          <Typography variant="caption" sx={{ display: 'block', letterSpacing: '0.12em', color: 'primary.main', fontWeight: 700 }}>
            TROVAN OPS
          </Typography>
          <Typography variant="subtitle1" sx={{ lineHeight: 1.1, fontWeight: 700 }}>
            {title}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <StatusPill compact label={activeModule.toUpperCase()} color={moduleAccents[activeModule]} />
        </Box>
        <Tooltip title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          <IconButton
            onClick={onToggleTheme}
            sx={{
              border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.9)}`,
              borderRadius: `${shellTokens.radius.sm}px`,
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
              {mode === 'dark' ? 'LIGHT' : 'DARK'}
            </Typography>
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
