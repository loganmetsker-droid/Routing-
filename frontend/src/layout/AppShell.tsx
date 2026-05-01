import { useEffect, useState, type ReactNode } from 'react';
import { Avatar, Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  DarkModeOutlined as DarkModeOutlinedIcon,
  KeyboardDoubleArrowLeftOutlined as KeyboardDoubleArrowLeftOutlinedIcon,
  KeyboardDoubleArrowRightOutlined as KeyboardDoubleArrowRightOutlinedIcon,
  LightModeOutlined as LightModeOutlinedIcon,
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
import { TopoShellBackground } from '../components/TopoShellBackground';
import { useTrovanThemeMode } from '../contexts/ThemeContext';

type AppShellProps = {
  onLogout: () => void;
  children: ReactNode;
};

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'trovan.shell.sidebarCollapsed';
const COLLAPSED_SIDEBAR_WIDTH = 78;

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
  const shellFg = '#FFF8ED';
  const shellMuted = alpha('#FFF8ED', 0.58);
  const shellLow = alpha('#FFF8ED', 0.38);
  const shellBg = isDark ? trovanColors.black[950] : trovanColors.utility.shell;
  const shellBorder = trovanColors.utility.shellLine;
  const selectedText = trovanColors.copper[300];
  const idleText = alpha('#FFF8ED', 0.76);
  const idleBg = alpha('#FFF8ED', 0.045);

  return (
    <Box sx={{ display: 'flex', height: '100%', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
      <Box
        sx={{
          px: collapsed ? 1.25 : 2.75,
          py: 2.1,
          borderBottom: `1px solid ${shellBorder}`,
          bgcolor: shellBg,
          background:
            'linear-gradient(180deg, rgba(169,99,33,0.16), rgba(169,99,33,0.02))',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            variant="rounded"
            sx={{
              width: 38,
              height: 38,
              bgcolor: alpha(trovanColors.copper[500], 0.12),
              color: trovanColors.copper[300],
              fontWeight: 700,
              borderRadius: 1.25,
              boxShadow: 'none',
              border: `1px solid ${alpha(trovanColors.copper[300], 0.24)}`,
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

      <Box sx={{ flex: 1, overflowY: 'auto', px: collapsed ? 0.85 : 1.2, py: 1.5, bgcolor: shellBg }}>
        {navSections.map((section) => (
          <Box key={section.label} sx={{ mb: 1.65 }}>
            <Typography
              variant="subtitle2"
              component="div"
              sx={{
                px: collapsed ? 0 : 1.25,
                pb: 0.85,
                color: shellLow,
                display: collapsed ? 'none' : 'block',
              }}
            >
              {section.label}
            </Typography>
            <Box sx={{ display: 'grid', gap: 0.5 }}>
              {section.items.map((item) => {
                const selected = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to));
                const navItem = (
                  <Box
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    onClick={onNavigate}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      position: 'relative',
                      px: collapsed ? 0.4 : 1,
                      py: 0.72,
                      minHeight: 38,
                      borderRadius: '9px',
                      color: selected ? selectedText : idleText,
                      textDecoration: 'none',
                      border: `1px solid ${selected ? alpha(trovanColors.copper[400], 0.26) : 'transparent'}`,
                      background: selected
                        ? `linear-gradient(90deg, ${alpha(trovanColors.copper[500], 0.2)}, ${alpha('#FFFFFF', 0.035)})`
                        : 'transparent',
                      '&::before': selected
                        ? {
                            content: '""',
                            position: 'absolute',
                            left: collapsed ? 2 : 0,
                            top: 8,
                            bottom: 8,
                            width: 2,
                            borderRadius: 999,
                            backgroundColor: trovanColors.copper[300],
                          }
                        : undefined,
                      '&:hover': {
                        bgcolor: selected
                          ? alpha(trovanColors.copper[500], 0.16)
                          : idleBg,
                      },
                      justifyContent: collapsed ? 'center' : 'flex-start',
                    }}
                  >
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '7px',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: selected
                          ? alpha(trovanColors.copper[500], 0.12)
                          : 'transparent',
                        color: selected ? trovanColors.copper[300] : 'inherit',
                        flexShrink: 0,
                        '& svg': {
                          fontSize: 18,
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

                return collapsed ? (
                  <Tooltip key={item.to} title={item.label} placement="right" arrow>
                    {navItem}
                  </Tooltip>
                ) : navItem;
              })}
            </Box>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          p: collapsed ? 1.25 : 2.25,
          borderTop: `1px solid ${shellBorder}`,
          bgcolor: alpha('#FFF8ED', 0.018),
          background: 'linear-gradient(180deg, rgba(169,99,33,0.08), rgba(255,255,255,0.018))',
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
                  border: `1px solid ${alpha(trovanColors.copper[300], 0.22)}`,
                  bgcolor: alpha(trovanColors.copper[500], 0.11),
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '999px',
                    bgcolor: trovanColors.copper[300],
                    boxShadow: `0 0 0 4px ${alpha(trovanColors.copper[300], 0.12)}`,
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
                  border: `1px solid ${alpha('#FFF8ED', 0.12)}`,
                  bgcolor: alpha('#FFF8ED', 0.035),
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
                color: trovanColors.copper[200],
                border: `1px solid ${alpha(trovanColors.copper[300], 0.16)}`,
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
                bgcolor: alpha('#FFF8ED', 0.035),
                color: shellFg,
                borderColor: alpha('#FFF8ED', 0.12),
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
  const { mode, toggleMode } = useTrovanThemeMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(true);
  const activeItem = getActiveNavItem(location.pathname);
  const activeSection = navSections.find((section) => section.items.some((item) => item.to === activeItem.to));
  const sidebarWidth = desktopCollapsed ? COLLAPSED_SIDEBAR_WIDTH : trovanLayout.sidebarWidth;
  const showTopoShellBackground = true;

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
            ? 'radial-gradient(circle at top left, rgba(169,99,33,0.22), transparent 24%), linear-gradient(180deg, #16110E 0%, #211914 46%, #120E0B 100%)'
            : `radial-gradient(circle at top left, ${alpha(trovanColors.copper[500], 0.12)}, transparent 24%), linear-gradient(180deg, #F3F2EF 0%, #E7E5E0 42%, #DAD6CF 100%)`,
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
          borderRight: `1px solid ${trovanColors.utility.shellLine}`,
          bgcolor: trovanColors.utility.shell,
          boxShadow: '18px 0 46px rgba(5, 4, 3, 0.24)',
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
          overflow: 'hidden',
        }}
      >
        <TopoShellBackground active tone="black" />
        <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'flex-end', p: 1, position: 'relative', zIndex: 1 }}>
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

      <Box component="main" sx={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        <TopoShellBackground active={showTopoShellBackground} tone={isDark ? 'black' : 'canvas'} />
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
            bgcolor: isDark ? alpha('#120E0B', 0.92) : alpha(trovanColors.black[950], 0.9),
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${alpha('#FFF8ED', 0.11)}`,
            color: '#FFF8ED',
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
                border: `1px solid ${alpha('#FFF8ED', 0.12)}`,
                bgcolor: alpha('#FFF8ED', 0.06),
                color: '#FFF8ED',
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
                border: `1px solid ${alpha('#FFF8ED', 0.12)}`,
                bgcolor: alpha('#FFF8ED', 0.06),
                color: '#FFF8ED',
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
              <Typography variant="subtitle2" component="div" sx={{ mb: 0.2, color: alpha('#FFF8ED', 0.54) }}>
                {activeSection?.label || 'Operations'}
              </Typography>
              <Typography variant="h6" component="div" noWrap sx={{ color: '#FFF8ED' }}>
                {activeItem.label}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <PreviewBanner />
            </Box>
            <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton
                onClick={toggleMode}
                aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1,
                  color: '#FFF8ED',
                  border: `1px solid ${alpha('#FFF8ED', 0.16)}`,
                  bgcolor: alpha('#FFF8ED', 0.035),
                  '&:hover': {
                    borderColor: alpha(trovanColors.copper[300], 0.45),
                    bgcolor: alpha(trovanColors.copper[500], 0.16),
                  },
                }}
              >
                {mode === 'dark' ? (
                  <LightModeOutlinedIcon fontSize="small" />
                ) : (
                  <DarkModeOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              onClick={() => navigate('/settings')}
              sx={{
                color: '#FFF8ED',
                borderColor: alpha('#FFF8ED', 0.16),
                bgcolor: alpha('#FFF8ED', 0.035),
                '&:hover': {
                  borderColor: alpha(trovanColors.copper[300], 0.45),
                  bgcolor: alpha(trovanColors.copper[500], 0.16),
                },
              }}
            >
              Settings
            </Button>
            <Button
              variant="text"
              onClick={onLogout}
              sx={{
                color: alpha('#FFF8ED', 0.78),
                '&:hover': { bgcolor: alpha('#FFF8ED', 0.06) },
              }}
            >
              Logout
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
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
