import { useState, type ReactNode } from 'react';
import { Avatar, Box, Button, Chip, Divider, Typography } from '@mui/material';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getActiveNavItem, navSections } from './navConfig';
import { trovanColors, trovanLayout } from '../theme/designTokens';
import { PreviewBanner } from '../components/PreviewBanner';

type AppShellProps = {
  onLogout: () => void;
  children: ReactNode;
};

function NavigationContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            variant="rounded"
            sx={{
              width: 44,
              height: 44,
              bgcolor: 'primary.main',
              color: '#fff',
              fontWeight: 800,
              borderRadius: 3,
            }}
          >
            T
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.25 }}>
              Trovan
            </Typography>
            <Typography variant="h6" noWrap>
              Routing & Dispatch
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 2 }}>
        {navSections.map((section) => (
          <Box key={section.label} sx={{ mb: 2.25 }}>
            <Typography variant="subtitle2" sx={{ px: 1.25, pb: 1, color: 'text.secondary' }}>
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
                      px: 1.25,
                      py: 1,
                      minHeight: 46,
                      borderRadius: '14px',
                      color: selected ? trovanColors.copper[700] : 'text.primary',
                      textDecoration: 'none',
                      border: `1px solid ${selected ? trovanColors.copper[200] : 'transparent'}`,
                      bgcolor: selected ? trovanColors.utility.selectedTint : 'transparent',
                      '&:hover': {
                        bgcolor: selected ? trovanColors.utility.selectedTint : trovanColors.stone[50],
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 2.5,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: selected ? '#fff' : trovanColors.stone[25],
                        color: 'inherit',
                        flexShrink: 0,
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                      }}
                    >
                      {item.monogram}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
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

      <Divider />

      <Box sx={{ p: 2 }}>
        <Chip
          label="System healthy"
          color="success"
          variant="outlined"
          sx={{ mb: 1.5, justifyContent: 'flex-start' }}
        />
        <Box sx={{ mb: 1.25 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Trovan Admin
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Local preview workspace
          </Typography>
        </Box>
        <Button fullWidth variant="outlined" onClick={() => navigate('/settings')}>
          Settings
        </Button>
      </Box>
    </Box>
  );
}

export function AppShell({ onLogout, children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = getActiveNavItem(location.pathname);
  const activeSection = navSections.find((section) => section.items.some((item) => item.to === activeItem.to));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: 'rgba(31, 26, 23, 0.28)',
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
          width: trovanLayout.sidebarWidth,
          flexShrink: 0,
          borderRight: `1px solid ${trovanColors.utility.border}`,
          bgcolor: trovanColors.stone[75],
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
        <NavigationContent pathname={location.pathname} onNavigate={() => setMobileOpen(false)} />
      </Box>

      <Box component="main" sx={{ flex: 1, minWidth: 0, ml: { md: `${trovanLayout.sidebarWidth}px` } }}>
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
            py: 1.5,
            bgcolor: 'rgba(255, 255, 255, 0.82)',
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${trovanColors.utility.border}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Button variant="text" onClick={() => setMobileOpen(true)} sx={{ display: { xs: 'inline-flex', md: 'none' }, minWidth: 0, px: 1.25 }}>
              Menu
            </Button>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {activeSection?.label || 'Operations'}
              </Typography>
              <Typography variant="h6" noWrap>
                {activeItem.label}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Chip
              label={import.meta.env.VITE_MOCK_PREVIEW === 'true' ? 'Mock data' : 'Live workspace'}
              variant="outlined"
              sx={{ borderColor: trovanColors.utility.borderStrong, display: { xs: 'none', sm: 'inline-flex' } }}
            />
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
            maxWidth: trovanLayout.pageMaxWidth,
            mx: 'auto',
            px: { xs: 2, md: `${trovanLayout.pagePaddingX}px` },
            py: { xs: 2, md: `${trovanLayout.pagePaddingY}px` },
          }}
        >
          <PreviewBanner />
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default AppShell;
