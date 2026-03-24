import { useState, type ReactNode } from 'react';
import { Box, Container } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import IconSidebar from './IconSidebar';
import Topbar from './Topbar';
import { moduleAccents, shellTokens } from '../../theme/tokens';

export type ShellNavItem = {
  text: string;
  path: string;
  icon: ReactNode;
};

type AppShellProps = {
  items: ShellNavItem[];
  currentPath: string;
  mode: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
  children: ReactNode;
};

type ModuleKey = keyof typeof moduleAccents;

function getActiveItem(items: ShellNavItem[], currentPath: string) {
  return items.find((item) => {
    if (item.path === '/') return currentPath === '/';
    return currentPath === item.path || currentPath.startsWith(`${item.path}/`);
  });
}

function toModuleKey(itemText: string | undefined): ModuleKey {
  if (!itemText) return 'dashboard';
  const key = itemText.toLowerCase() as ModuleKey;
  return key in moduleAccents ? key : 'dashboard';
}

export default function AppShell({
  items,
  currentPath,
  mode,
  onToggleTheme,
  onLogout,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const activeItem = getActiveItem(items, currentPath);
  const activeModule = toModuleKey(activeItem?.text);

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: theme.palette.mode === 'light' ? shellTokens.background.light : theme.palette.background.default,
      }}
    >
      <IconSidebar
        items={items}
        activePath={currentPath}
        activeModule={activeModule}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onLogout={onLogout}
      />

      <Box
        sx={{
          flex: 1,
          ml: { md: `${shellTokens.sidebar.compactWidth}px` },
          minWidth: 0,
        }}
      >
        <Topbar
          title={activeItem?.text ?? 'Dashboard'}
          activeModule={activeModule}
          mode={mode}
          onToggleTheme={onToggleTheme}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <Box
          component="main"
          sx={{
            px: { xs: 2, md: 3 },
            py: { xs: 2, md: 3 },
          }}
        >
          <Container maxWidth="xl" sx={{ px: { xs: 0, md: 1 } }}>
            {children}
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
