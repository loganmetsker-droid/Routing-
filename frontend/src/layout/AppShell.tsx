import { useEffect, useState, type ReactNode } from 'react';
import { Avatar, Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  KeyboardDoubleArrowLeftOutlined as KeyboardDoubleArrowLeftOutlinedIcon,
  KeyboardDoubleArrowRightOutlined as KeyboardDoubleArrowRightOutlinedIcon,
  MenuOutlined as MenuOutlinedIcon,
  SettingsOutlined as SettingsOutlinedIcon,
} from '@mui/icons-material';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getActiveNavItem, navSections } from './navConfig';
import {
  trovanColors,
  trovanLayout,
  trovanTypography,
} from '../theme/designTokens';
import { PreviewBanner } from '../components/PreviewBanner';

type AppShellProps = {
  onLogout: () => void;
  children: ReactNode;
};

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'trovan.shell.sidebarCollapsed';
const COLLAPSED_SIDEBAR_WIDTH = 92;

function NavigationContent({
  pathname,
  collapsed = false,
  onNavigate,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const shellFg = isDark ? '#F8FAFC' : trovanColors.stone[900];
  const shellMuted = isDark ? alpha('#FFFFFF', 0.56) : alpha(trovanColors.stone[900], 0.5);
  const shellLow = isDark ? alpha('#FFFFFF', 0.46) : alpha(trovanColors.stone[900], 0.44);
  const shellBg = isDark ? trovanColors.utility.shell : trovanColors.utility.shell;
  const shellBorder = isDark ? alpha('#FFFFFF', 0.08) : alpha(trovanColors.stone[900], 0.08);
  const selectedText = isDark ? '#FFFFFF' : trovanColors.copper[700];
  const idleText = isDark ? alpha('#FFFFFF', 0.8) : alpha(trovanColors.stone[900], 0.82);
  const idleBg = isDark ? alpha('#FFFFFF', 0.06) : alpha(trovanColors.stone[900], 0.04);

  return (
    <Box sx={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <Box
        sx={{
          px: collapsed ? 1.25 : 2.75,
          py: 2.5,
          borderBottom: `1px solid ${shellBorder}`,
          bgcolor: shellBg,
          background:
            isDark
              ? 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))'
              : 'linear-gradient(180deg, rgba(140,95,52,0.06), rgba(140,95,52,0))',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            variant="rounded"
            sx={{
              width: 38,
              height: 38,
              bgcolor: '#FFFDFB',
              color: trovanColors.copper[600],
              fontWeight: 700,
              borderRadius: 1.25,
              boxShadow: 'none',
              border: `1px solid ${alpha(trovanColors.copper[500], 0.12)}`,
              fontFamily: trovanTypography.brandFontFamily,
            }}
          >
            T
          </Avatar>
          <Box sx={{ minWidth: 0, display: collapsed ? 'none' : 'block' }}>
            <Typography
              variant="subtitle2"
              component="div"
              sx={{ color: shellMuted, mb: 0.4 }}
            >
              Trovan Logistics
            </Typography>
            <Typography
              variant="body2"
              component="div"
              noWrap
              sx={{
                color: shellFg,
                fontFamily: trovanTypography.brandFontFamily,
                fontSize: '1.18rem',
                letterSpacing: '0.07em',
              }}
              className="trovan-wordmark"
            >
              Dispatch Console
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: collapsed ? 1 : 1.5, py: 2, bgcolor: shellBg }}>
        {navSections.map((section) => (
          <Box key={section.label} sx={{ mb: 2.25 }}>
            <Typography
              variant="subtitle2"
              component="div"
              sx={{
                px: collapsed ? 0 : 1.25,
                pb: 1,
                color: shellLow,
                display: collapsed ? 'none' : 'block',
              }}
            >
              {section.label}
            </Typography>
            <Box sx={{ display: 'grid', gap: 0.5 }}>
              {section.items.map((item) => {
                const selected = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to));

                return (
                  <Box
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    onClick={onNavigate}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: collapsed ? 0.55 : 1,
                      py: 0.85,
                      minHeight: 42,
                      borderRadius: '10px',
                      color: selected ? selectedText : idleText,
                      textDecoration: 'none',
                      border: `1px solid ${selected ? alpha(trovanColors.copper[400], 0.48) : 'transparent'}`,
                      background: selected
                        ? `linear-gradient(135deg, ${alpha(
                            trovanColors.copper[500],
                            0.16,
                          )}, ${alpha('#FFFFFF', 0.04)})`
                        : 'transparent',
                      '&:hover': {
                        bgcolor: selected
                          ? alpha(trovanColors.copper[500], 0.18)
                          : idleBg,
                      },
                      justifyContent: collapsed ? 'center' : 'flex-start',
                    }}
                    title={item.label}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: selected
                          ? alpha(trovanColors.copper[500], 0.08)
                          : idleBg,
                        color: selected ? trovanColors.copper[600] : 'inherit',
                        flexShrink: 0,
                        '& svg': {
                          fontSize: 16,
                        },
                      }}
                    >
                      <item.icon fontSize="inherit" />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1, display: collapsed ? 'none' : 'block' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'inherit' }}>
                        {item.label}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          p: collapsed ? 1.25 : 2.25,
          borderTop: `1px solid ${shellBorder}`,
          bgcolor: isDark ? alpha('#FFFFFF', 0.02) : alpha('#0F1720', 0.015),
          background:
            isDark
              ? alpha('#FFFFFF', 0.02)
              : 'linear-gradient(180deg, rgba(185,113,41,0.05), rgba(255,255,255,0.35))',
        }}
      >
        {collapsed ? (
          <Box sx={{ display: 'grid', justifyItems: 'center', gap: 1 }}>
            <Tooltip title="Local preview active">
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.4,
                  border: `1px solid ${alpha(trovanColors.copper[500], 0.22)}`,
                  bgcolor: alpha(trovanColors.copper[500], 0.08),
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '999px',
                    bgcolor: trovanColors.copper[500],
                    boxShadow: `0 0 0 4px ${alpha(trovanColors.copper[500], 0.12)}`,
                  }}
                />
              </Box>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton
                size="small"
                onClick={() => navigate('/settings')}
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.4,
                  border: `1px solid ${isDark ? alpha('#FFFFFF', 0.12) : alpha(trovanColors.stone[900], 0.12)}`,
                  bgcolor: isDark ? alpha('#FFFFFF', 0.02) : '#FFFFFF',
                  color: shellFg,
                }}
              >
                <SettingsOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <>
            <Chip
              label="Preview mode"
              sx={{
                mb: 1.25,
                justifyContent: 'flex-start',
                bgcolor: alpha(trovanColors.copper[500], 0.08),
                color: trovanColors.copper[700],
                border: `1px solid ${alpha(trovanColors.copper[500], 0.14)}`,
                width: 'fit-content',
                borderRadius: 1,
                height: 24,
              }}
            />
            <Box sx={{ mb: 1.25 }}>
              <Typography variant="body2" component="div" sx={{ fontWeight: 700, color: shellFg }}>
                Trovan Admin
              </Typography>
              <Typography variant="body2" component="div" sx={{ color: shellMuted }}>
                Local operations workspace
              </Typography>
            </Box>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigate('/settings')}
              sx={{
                bgcolor: isDark ? alpha('#FFFFFF', 0.02) : '#FFFFFF',
                color: shellFg,
                borderColor: isDark ? alpha('#FFFFFF', 0.12) : alpha(trovanColors.stone[900], 0.12),
              }}
            >
              Settings
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}

export function AppShell({ onLogout, children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(true);
  const activeItem = getActiveNavItem(location.pathname);
  const activeSection = navSections.find((section) => section.items.some((item) => item.to === activeItem.to));
  const sidebarWidth = desktopCollapsed ? COLLAPSED_SIDEBAR_WIDTH : trovanLayout.sidebarWidth;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
      if (stored === '0') setDesktopCollapsed(false);
      if (stored === '1') setDesktopCollapsed(true);
    } catch {
      // Ignore localStorage access issues and fall back to expanded state.
    }
  }, []);

  const toggleDesktopCollapsed = () => {
    setDesktopCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Ignore persistence failures; the UI can still toggle in-memory.
      }
      return next;
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
        background:
          isDark
            ? 'radial-gradient(circle at top left, rgba(185,113,41,0.18), transparent 24%), linear-gradient(180deg, #091017 0%, #101821 34%, #0E151D 100%)'
            : 'radial-gradient(circle at top left, rgba(255,246,236,0.92), rgba(255,246,236,0) 32%), linear-gradient(180deg, #FBF7F1 0%, #F6F0E8 100%)',
      }}
    >
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: 'rgba(9, 13, 18, 0.54)',
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition: 'opacity 160ms ease',
          zIndex: 1198,
          display: { xs: 'block', md: 'none' },
        }}
        onClick={() => setMobileOpen(false)}
      />

      <Box
        component="aside"
        sx={{
          width: { xs: trovanLayout.sidebarWidth, md: sidebarWidth },
          flexShrink: 0,
          borderRight: `1px solid ${isDark ? alpha('#FFFFFF', 0.08) : alpha(trovanColors.stone[900], 0.08)}`,
          bgcolor: isDark ? trovanColors.utility.shell : trovanColors.utility.shell,
          boxShadow: isDark
            ? '18px 0 40px rgba(8, 12, 16, 0.24)'
            : 'none',
          position: { xs: 'fixed', md: 'sticky' },
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 1199,
          transform: {
            xs: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            md: 'translateX(0)',
          },
          transition: 'transform 180ms ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'flex-end', p: 1 }}>
          <Button variant="text" onClick={() => setMobileOpen(false)}>
            Close
          </Button>
        </Box>
        <NavigationContent
          pathname={location.pathname}
          collapsed={desktopCollapsed}
          onNavigate={() => setMobileOpen(false)}
        />
      </Box>

      <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            position: 'sticky',
            top: 0,
          zIndex: 1100,
            minHeight: trovanLayout.headerHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: { xs: 2, md: 3 },
            py: 0.55,
            bgcolor: isDark ? alpha('#101821', 0.82) : trovanColors.utility.topbar,
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${trovanColors.utility.border}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{
                display: { xs: 'inline-flex', md: 'none' },
                width: 34,
                height: 34,
                borderRadius: 1,
                border: `1px solid ${trovanColors.utility.border}`,
                bgcolor: alpha('#FFFDFB', 0.74),
              }}
            >
              <MenuOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton
              onClick={toggleDesktopCollapsed}
              sx={{
                display: { xs: 'none', md: 'inline-flex' },
                width: 34,
                height: 34,
                borderRadius: 1,
                border: `1px solid ${trovanColors.utility.border}`,
                bgcolor: '#FFFDFB',
              }}
              title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {desktopCollapsed ? (
                <KeyboardDoubleArrowRightOutlinedIcon fontSize="small" />
              ) : (
                <KeyboardDoubleArrowLeftOutlinedIcon fontSize="small" />
              )}
            </IconButton>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" component="div" color="text.secondary" sx={{ mb: 0.2 }}>
                {activeSection?.label || 'Operations'}
              </Typography>
              <Typography variant="h6" component="div" noWrap>
                {activeItem.label}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <PreviewBanner />
            </Box>
            <Button variant="outlined" onClick={() => navigate('/settings')}>
              Settings
            </Button>
            <Button variant="text" onClick={onLogout}>
              Logout
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            width: '100%',
            px: { xs: 2, md: 3 },
            py: { xs: 1.5, md: 2 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default AppShell;
