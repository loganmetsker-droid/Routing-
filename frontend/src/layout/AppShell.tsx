import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  CalendarTodayOutlined,
  DarkModeOutlined,
  KeyboardCommandKeyOutlined,
  KeyboardDoubleArrowLeftOutlined,
  LightModeOutlined,
  MenuOutlined,
  NotificationsNoneOutlined,
  SearchOutlined,
  LogoutOutlined,
} from '@mui/icons-material';
import { NavLink, useLocation } from 'react-router-dom';
import { getActiveNavItem, navSections, normalizeAppNavigationPath } from './navConfig';
import { trovanBrandAssets, trovanColors, trovanLayout } from '../theme/designTokens';
import { useTrovanThemeMode } from '../contexts/ThemeContext';
import { getSession, type AuthUser } from '../services/api';
import { useNotificationsOverviewQuery } from '../services/notificationsApi';
import { PreviewBanner } from '../components/PreviewBanner';

type AppShellProps = {
  onLogout: () => void;
  children: ReactNode;
};

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'trovan.shell.sidebarCollapsed';
const COLLAPSED_SIDEBAR_WIDTH = 72;

const pageCopy: Record<string, [string, string]> = {
  '/dashboard': ['Operations Dashboard', ''],
  '/jobs': ['Jobs', 'Create, assign, prioritize, and manage delivery or service jobs'],
  '/loads': ['Jobs', 'Create, assign, prioritize, and manage delivery or service jobs'],
  '/customers': ['Customers', 'Manage accounts, service locations, contacts, and delivery requirements'],
  '/drivers': ['Drivers', 'Monitor driver availability, compliance, utilization, and performance'],
  '/vehicles': ['Vehicles', 'Track fleet availability, capacity, maintenance, and assignment readiness'],
  '/assets': ['Vehicles', 'Track fleet availability, capacity, maintenance, and assignment readiness'],
  '/planning': ['Route Planning & Optimization', ''],
  '/routing': ['Route Planning & Optimization', ''],
  '/routes': ['Route Planning & Optimization', ''],
  '/dispatch': ['Dispatch Board', 'Assign, release, and monitor live work across routes and drivers.'],
  '/messages': ['Dispatch Board', 'Assign, release, and monitor live work across routes and drivers.'],
  '/route-runs': ['Route Execution', 'Monitor stop progress, proof capture, exceptions, and driver communication.'],
  '/tracking': ['Tracking', 'Monitor route progress, driver status, POD, and ETA changes in real time'],
  '/depots': ['Tracking', 'Monitor route progress, driver status, POD, and ETA changes in real time'],
  '/pod': ['Proof of Delivery', 'Review proof capture, delivery evidence, exceptions, and route-linked records'],
  '/exceptions': ['Exceptions', 'Resolve route blockers, missed windows, POD gaps, and dispatch risks'],
  '/analytics': ['Reports', 'Measure service, efficiency, utilization, POD completion, and profitability'],
  '/settings': ['Settings', 'Configure users, rules, notifications, depots, integrations, and preferences'],
  '/billing': ['Settings', 'Configure users, rules, notifications, depots, integrations, and preferences'],
  '/integrations': ['Settings', 'Configure users, rules, notifications, depots, integrations, and preferences'],
};

const searchPlaceholders: Record<string, string> = {
  '/dashboard': 'Search jobs, drivers, vehicles, customers...',
  '/customers': 'Search customers, locations, contacts...',
  '/drivers': 'Search jobs, drivers, vehicles, customers...',
  '/vehicles': 'Search vehicles, drivers, routes...',
  '/jobs': 'Search jobs, customers, routes...',
};

function getPageCopy(pathname: string, fallback: string): [string, string] {
  const match = Object.entries(pageCopy).find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return match?.[1] ?? [fallback, 'Real-time operational workspace'];
}

function getSearchPlaceholder(pathname: string) {
  const match = Object.entries(searchPlaceholders).find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return match?.[1] ?? 'Search jobs, drivers, vehicles, customers...';
}

export function shouldShowShellOperatingDate(pathname: string) {
  return !['/dispatch', '/messages'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function TrovanBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
      }}
    >
      <Box
        component="img"
        src={collapsed ? trovanBrandAssets.standaloneIconCrop : trovanBrandAssets.primaryLockupCrop}
        alt="Trovan Dispatch"
        sx={{
          position: 'relative',
          width: collapsed ? 46 : 194,
          height: collapsed ? 46 : 50,
          flex: '0 0 auto',
          objectFit: 'contain',
          objectPosition: collapsed ? 'center center' : 'left center',
          borderRadius: 0,
          filter: 'none',
        }}
      />
    </Box>
  );
}

function NavigationContent({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const shellFg = '#eef6fc';
  const shellMuted = alpha(shellFg, 0.68);
  const shellLow = alpha(shellFg, 0.44);
  const navigationPath = normalizeAppNavigationPath(pathname);

  return (
    <Box sx={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <Box
        sx={{
          height: 72,
          px: collapsed ? 0 : 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          bgcolor: '#010C1B',
        }}
      >
        <TrovanBrand collapsed={collapsed} />
      </Box>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 1,
          pt: 1,
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha('#fff', 0.16)} transparent`,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: alpha('#fff', 0.14),
            borderRadius: 999,
          },
        }}
      >
        {navSections.map((section) => (
          <Box key={section.label}>
            {!collapsed ? (
              <Typography
                sx={{
                  px: 1.2,
                  mb: 0.7,
                  color: shellLow,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                {section.label}
              </Typography>
            ) : null}
            <Box sx={{ display: 'grid', gap: 0.35 }}>
              {section.items.map((item) => {
                const selected =
                  navigationPath === item.to ||
                  (item.to !== '/' && navigationPath.startsWith(`${item.to}/`));
                const navItem = (
                  <Box
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    onClick={onNavigate}
                    sx={{
                      minHeight: 40,
                      px: collapsed ? 0.6 : 1.25,
                      py: 0.6,
                      borderRadius: '9px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      gap: 1.15,
                      textDecoration: 'none',
                      color: selected ? trovanColors.copper[100] : shellMuted,
                      background: selected
                        ? `linear-gradient(90deg, ${alpha(trovanColors.copper[500], 0.28)} 0%, ${alpha(trovanColors.copper[500], 0.13)} 100%)`
                        : 'transparent',
                      border: `1px solid ${selected ? alpha(trovanColors.copper[400], 0.36) : 'transparent'}`,
                      boxShadow: selected ? `inset 3px 0 0 ${trovanColors.copper[400]}` : 'none',
                      transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease',
                      '&:hover': {
                        bgcolor: selected ? undefined : alpha('#fff', 0.055),
                        color: '#fff',
                      },
                      '&:focus-visible': {
                        outline: 'none',
                        boxShadow: selected
                          ? `inset 3px 0 0 ${trovanColors.copper[400]}, 0 0 0 2px ${alpha(trovanColors.copper[300], 0.32)}`
                          : `0 0 0 2px ${alpha(trovanColors.copper[300], 0.32)}`,
                      },
                      '& svg': {
                        fontSize: 20,
                        strokeWidth: 2,
                      },
                    }}
                  >
                    <item.icon />
                    {!collapsed ? (
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: 'inherit' }}>
                        {item.label}
                      </Typography>
                    ) : null}
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

      {!collapsed ? (
        <Box sx={{ p: 1.4 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.2,
              py: 0.9,
              borderRadius: '9px',
              border: `1px solid ${alpha('#fff', 0.14)}`,
              color: shellFg,
              bgcolor: alpha('#fff', 0.035),
              fontSize: 12,
              fontWeight: 750,
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: trovanColors.semantic.success }} />
            Operations workspace
            <Box component="span" sx={{ ml: 'auto', color: shellMuted }}>⌄</Box>
          </Box>
          <Typography sx={{ mt: 1.55, color: shellMuted, fontSize: 10.5, lineHeight: 1.55 }}>
            © {new Date().getFullYear()} Trovan Dispatch
            <br />
            Live workspace
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

export function AppShell({ onLogout, children }: AppShellProps) {
  const location = useLocation();
  const theme = useTheme();
  const { mode, toggleMode } = useTrovanThemeMode();
  const isDark = theme.palette.mode === 'dark';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState<HTMLElement | null>(null);
  const [accountAnchorEl, setAccountAnchorEl] = useState<HTMLElement | null>(null);
  const notificationsOverviewQuery = useNotificationsOverviewQuery();
  const activeItem = getActiveNavItem(location.pathname);
  const [pageTitle, pageSubtitle] = getPageCopy(location.pathname, activeItem.label);
  const searchPlaceholder = getSearchPlaceholder(location.pathname);
  const showShellOperatingDate = shouldShowShellOperatingDate(location.pathname);
  const sidebarWidth = desktopCollapsed ? COLLAPSED_SIDEBAR_WIDTH : trovanLayout.sidebarWidth;
  const currentDateLabel = new Date().toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const userLabel = sessionUser?.email || 'Signed-in operator';
  const userInitials =
    userLabel
      .split('@')[0]
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'TO';
  const roleLabel = sessionUser?.role
    ? sessionUser.role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Operator';
  const notificationOverview = notificationsOverviewQuery.data;
  const failedNotificationCount = notificationOverview?.failedLast24Hours ?? 0;
  const pendingNotificationReviewCount =
    notificationOverview?.pendingReviewLast24Hours ?? 0;
  const notificationAttentionCount =
    failedNotificationCount + pendingNotificationReviewCount;
  const notificationSummary = notificationsOverviewQuery.isLoading
    ? 'Checking customer notification delivery status…'
    : notificationsOverviewQuery.isError
      ? 'Notification delivery status is temporarily unavailable.'
      : pendingNotificationReviewCount > 0
        ? `${pendingNotificationReviewCount} customer notification ${pendingNotificationReviewCount === 1 ? 'delivery needs' : 'deliveries need'} operator review because the provider outcome could not be confirmed.`
      : failedNotificationCount > 0
        ? `${failedNotificationCount} customer notification ${failedNotificationCount === 1 ? 'delivery has' : 'deliveries have'} failed in the last 24 hours. Review delivery settings and affected routes.`
        : notificationOverview?.controls.emailReady
          ? `No failed customer notification deliveries in the last 24 hours. ${notificationOverview.sentLast24Hours} sent.`
          : 'Customer email delivery is not configured. Notifications are logged for operator review but are not sent.';

  useEffect(() => {
    try {
      setDesktopCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === '1');
    } catch {
      // Ignore localStorage access issues.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getSession()
      .then((session) => {
        if (!cancelled) setSessionUser(session.user);
      })
      .catch(() => {
        if (!cancelled) setSessionUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleDesktopCollapsed = () => {
    setDesktopCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Ignore persistence failures.
      }
      return next;
    });
  };

  const openNotifications = (event: MouseEvent<HTMLButtonElement>) => {
    setNotificationsAnchorEl(event.currentTarget);
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: `${sidebarWidth}px minmax(0, 1fr)` },
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        bgcolor: isDark ? trovanColors.dark.appBg : trovanColors.light.appBg,
        color: 'text.primary',
      }}
    >
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: alpha(trovanColors.brand.navy950, 0.55),
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          zIndex: 1198,
          display: { xs: 'block', md: 'none' },
        }}
        onClick={() => setMobileOpen(false)}
      />

      <Box
        component="aside"
        sx={{
          width: { xs: trovanLayout.sidebarWidth, md: sidebarWidth },
          height: '100vh',
          minHeight: 0,
          overflow: 'hidden',
          position: { xs: 'fixed', md: 'relative' },
          left: 0,
          top: 0,
          zIndex: 1199,
          transform: { xs: mobileOpen ? 'translateX(0)' : 'translateX(-100%)', md: 'translateX(0)' },
          transition: 'transform 180ms ease, width 180ms ease',
          bgcolor: '#010C1B',
          background: [
            'linear-gradient(180deg, #010C1B 0%, #010D1B 42%, #020B16 100%)',
          ].join(','),
          color: '#fff',
          borderRight: `1px solid ${alpha('#fff', 0.08)}`,
          boxShadow: '10px 0 30px rgba(5, 15, 27, 0.14)',
        }}
      >
        <NavigationContent
          pathname={location.pathname}
          collapsed={desktopCollapsed}
          onNavigate={() => setMobileOpen(false)}
        />
        <IconButton
          aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleDesktopCollapsed}
          sx={{
            position: 'absolute',
            right: 12,
            bottom: 22,
            width: 32,
            height: 32,
            color: '#fff',
            bgcolor: alpha('#fff', 0.09),
            '&:hover': { bgcolor: alpha('#fff', 0.14) },
            display: { xs: 'none', md: 'inline-flex' },
          }}
        >
          <KeyboardDoubleArrowLeftOutlined sx={{ transform: desktopCollapsed ? 'rotate(180deg)' : 'none' }} />
        </IconButton>
      </Box>

      <Box
        component="main"
        sx={{
          minWidth: 0,
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: isDark ? trovanColors.dark.appBg : trovanColors.light.appBg,
          background: isDark
            ? `radial-gradient(circle at 78% -10%, ${alpha(trovanColors.copper[500], 0.12)}, transparent 32%), ${trovanColors.dark.appBg}`
            : trovanColors.light.appBg,
        }}
      >
        <Box
          component="header"
          sx={{
            height: trovanLayout.headerHeight,
            flex: '0 0 auto',
            borderBottom: `1px solid ${isDark ? trovanColors.dark.border : trovanColors.light.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, md: 1.4 },
            px: { xs: 1.25, md: 2.25 },
            bgcolor: isDark ? alpha(trovanColors.dark.surface, 0.86) : alpha('#fff', 0.88),
            backdropFilter: 'blur(18px) saturate(135%)',
            boxShadow: isDark ? '0 1px 0 rgba(255,255,255,.018)' : '0 1px 8px rgba(11,19,36,.035)',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <IconButton
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
          >
            <MenuOutlined />
          </IconButton>
          <Box sx={{ minWidth: 0, flex: { xs: 1, xl: '0 0 440px' } }}>
            <Typography
              component="h1"
              sx={{
                m: 0,
                fontSize: { xs: 18, md: 20 },
                lineHeight: 1.08,
                letterSpacing: '-0.025em',
                fontWeight: 800,
              }}
            >
              {pageTitle}
            </Typography>
            {pageSubtitle ? (
              <Typography
                sx={{
                  display: { xs: 'none', md: 'block' },
                  mt: 0.25,
                  color: 'text.secondary',
                  fontSize: 12.5,
                  lineHeight: 1.25,
                }}
              >
                {pageSubtitle}
              </Typography>
            ) : null}
          </Box>

          <Box sx={{ display: { xs: 'none', lg: 'block' }, flex: '0 1 300px', minWidth: 0, overflow: 'hidden' }}>
            <PreviewBanner />
          </Box>

          <TextField
            size="small"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            sx={{
              display: { xs: 'none', xl: 'block' },
              flex: '0 1 320px',
              width: 320,
              maxWidth: 320,
              ml: 'auto',
              '& .MuiOutlinedInput-root': {
                height: 40,
                borderRadius: '9px',
                bgcolor: isDark ? trovanColors.dark.panel : '#fff',
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: '6px',
                      px: 0.7,
                      py: 0.2,
                      color: 'text.secondary',
                      fontSize: 11,
                      fontWeight: 800,
                      bgcolor: 'background.default',
                    }}
                  >
                    <KeyboardCommandKeyOutlined sx={{ fontSize: 13 }} /> K
                  </Box>
                </InputAdornment>
              ),
            }}
          />

          {showShellOperatingDate ? (
            <Box
              aria-label={`Current operating date: ${currentDateLabel}`}
              sx={{
                height: 40,
                display: { xs: 'none', md: 'inline-flex' },
                minWidth: 150,
                px: 1.5,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.9,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '8px',
                bgcolor: 'background.paper',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              <CalendarTodayOutlined sx={{ fontSize: 19 }} />
              {currentDateLabel}
            </Box>
          ) : null}
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
              onClick={toggleMode}
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              sx={{ width: 38, height: 38, border: '1px solid', borderColor: 'divider', borderRadius: '9px' }}
            >
              {mode === 'dark' ? <LightModeOutlined /> : <DarkModeOutlined />}
            </IconButton>
          </Tooltip>
          <IconButton
            aria-label="Notifications"
            aria-haspopup="dialog"
            aria-expanded={Boolean(notificationsAnchorEl)}
            onClick={openNotifications}
            sx={{ width: 38, height: 38, border: '1px solid', borderColor: 'divider', borderRadius: '9px' }}
          >
            <Badge
              badgeContent={notificationAttentionCount}
              color="error"
              max={99}
              invisible={notificationAttentionCount === 0}
            >
              <NotificationsNoneOutlined />
            </Badge>
          </IconButton>
          <Button
            aria-label={`Open account menu for ${userLabel}`}
            aria-haspopup="menu"
            aria-expanded={Boolean(accountAnchorEl)}
            onClick={(event) => setAccountAnchorEl(event.currentTarget)}
            sx={{
              display: 'flex',
              minWidth: 0,
              pl: 0.5,
              pr: 0.75,
              color: 'text.primary',
              textTransform: 'none',
              justifyContent: 'flex-start',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: trovanColors.copper[500], fontSize: 13, fontWeight: 800 }}>{userInitials}</Avatar>
              <Box sx={{ display: { xs: 'none', xl: 'block' }, minWidth: 0, textAlign: 'left' }}>
                <Typography noWrap sx={{ maxWidth: 180, fontSize: 13, fontWeight: 850 }}>{userLabel}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{roleLabel}</Typography>
              </Box>
              <Typography aria-hidden="true" sx={{ display: { xs: 'none', xl: 'block' }, color: 'text.secondary' }}>⌄</Typography>
            </Stack>
          </Button>
        </Box>
        <Popover
          open={Boolean(notificationsAnchorEl)}
          anchorEl={notificationsAnchorEl}
          onClose={() => setNotificationsAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { width: 300, mt: 1, p: 1.5 } } }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
            Notifications
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {notificationSummary}
          </Typography>
          <Button
            component={NavLink}
            to="/settings"
            size="small"
            onClick={() => setNotificationsAnchorEl(null)}
            sx={{ mt: 1, px: 0 }}
          >
            Open notification settings
          </Button>
        </Popover>
        <Menu
          anchorEl={accountAnchorEl}
          open={Boolean(accountAnchorEl)}
          onClose={() => setAccountAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { minWidth: 220, mt: 1 } } }}
        >
          <MenuItem
            onClick={() => {
              setAccountAnchorEl(null);
              void onLogout();
            }}
          >
            <ListItemIcon>
              <LogoutOutlined fontSize="small" />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>

        <Box
          sx={{
            height: `calc(100vh - ${trovanLayout.headerHeight}px)`,
            overflow: 'auto',
            px: { xs: 1.25, md: `${trovanLayout.pagePaddingX}px` },
            py: { xs: 1.25, md: `${trovanLayout.pagePaddingY}px` },
            scrollbarGutter: 'stable',
            scrollbarWidth: 'thin',
            scrollbarColor: `${alpha(isDark ? '#fff' : trovanColors.brand.navy950, 0.18)} transparent`,
            '&::-webkit-scrollbar': { width: 8, height: 8 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: alpha(isDark ? '#fff' : trovanColors.brand.navy950, 0.16),
              borderRadius: 999,
            },
          }}
        >
          <Box sx={{ width: '100%', maxWidth: trovanLayout.pageMaxWidth, mx: 'auto' }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default AppShell;
