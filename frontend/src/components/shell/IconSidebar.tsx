import { Link as RouterLink } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Divider,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { moduleAccents, shellTokens } from '../../theme/tokens';

type ModuleKey = keyof typeof moduleAccents;

type NavItem = {
  text: string;
  path: string;
  icon: ReactNode;
};

type IconSidebarProps = {
  items: NavItem[];
  activePath: string;
  activeModule: ModuleKey;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onLogout: () => void;
};

function isActivePath(itemPath: string, currentPath: string) {
  if (itemPath === '/') return currentPath === '/';
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

function NavList({
  items,
  activePath,
  activeModule,
  compact,
  onItemClick,
}: {
  items: NavItem[];
  activePath: string;
  activeModule: ModuleKey;
  compact: boolean;
  onItemClick?: () => void;
}) {
  return (
    <List sx={{ px: compact ? 1 : 1.25, py: 1 }}>
      {items.map((item) => {
        const selected = isActivePath(item.path, activePath);
        return (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.75 }}>
            <Tooltip title={compact ? item.text : ''} placement="right">
              <ListItemButton
                component={RouterLink}
                to={item.path}
                onClick={onItemClick}
                selected={selected}
                sx={{
                  minHeight: 40,
                  justifyContent: compact ? 'center' : 'flex-start',
                  borderRadius: `${shellTokens.radius.md}px`,
                  px: compact ? 0 : 1.5,
                  color: selected ? moduleAccents[activeModule] : 'text.secondary',
                  bgcolor: selected ? alpha(moduleAccents[activeModule], 0.12) : 'transparent',
                  '&:hover': {
                    bgcolor: selected
                      ? alpha(moduleAccents[activeModule], 0.18)
                      : (theme) => alpha(theme.palette.text.primary, 0.06),
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: compact ? 'auto' : 34,
                    color: 'inherit',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!compact && <ListItemText primary={item.text} />}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        );
      })}
    </List>
  );
}

function LogoutGlyph() {
  return (
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: '5px',
        display: 'grid',
        placeItems: 'center',
        border: '1px solid currentColor',
      }}
    >
      <Typography sx={{ fontSize: 9, lineHeight: 1, fontWeight: 800 }}>
        L
      </Typography>
    </Box>
  );
}

export default function IconSidebar({
  items,
  activePath,
  activeModule,
  mobileOpen,
  onMobileClose,
  onLogout,
}: IconSidebarProps) {
  return (
    <Box component="nav" sx={{ width: { md: shellTokens.sidebar.compactWidth }, flexShrink: { md: 0 } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: shellTokens.sidebar.mobileWidth,
            boxSizing: 'border-box',
            borderRight: (theme) => `1px solid ${alpha(theme.palette.divider, 0.7)}`,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.12em', fontWeight: 700 }}>
            Operations
          </Typography>
          <Typography variant="h6" sx={{ color: 'primary.main', letterSpacing: '0.06em' }}>
            TROVAN
          </Typography>
        </Box>
        <Divider />
        <NavList
          items={items}
          activePath={activePath}
          activeModule={activeModule}
          compact={false}
          onItemClick={onMobileClose}
        />
        <Divider />
        <Box sx={{ p: 1.25 }}>
          <ListItemButton onClick={onLogout} sx={{ borderRadius: `${shellTokens.radius.md}px` }}>
            <ListItemIcon sx={{ minWidth: 34 }}>
              <LogoutGlyph />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </Box>
      </Drawer>

      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: shellTokens.sidebar.compactWidth,
            boxSizing: 'border-box',
            borderRight: (theme) => `1px solid ${alpha(theme.palette.divider, 0.7)}`,
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.94),
          },
        }}
      >
        <Box sx={{ py: 1.5, display: 'flex', justifyContent: 'center' }}>
          <Typography
            variant="caption"
            sx={{
              color: 'primary.main',
              fontWeight: 800,
              letterSpacing: '0.12em',
              transform: 'rotate(-90deg)',
            }}
          >
            TROVAN
          </Typography>
        </Box>
        <NavList items={items} activePath={activePath} activeModule={activeModule} compact />
        <Box sx={{ mt: 'auto', p: 1, display: 'flex', justifyContent: 'center' }}>
          <Tooltip title="Logout" placement="right">
            <IconButton
              onClick={onLogout}
              sx={{
                borderRadius: `${shellTokens.radius.md}px`,
                border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.9)}`,
              }}
            >
              <LogoutGlyph />
            </IconButton>
          </Tooltip>
        </Box>
      </Drawer>
    </Box>
  );
}
