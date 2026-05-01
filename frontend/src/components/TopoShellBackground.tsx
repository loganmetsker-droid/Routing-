import { Box } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import { trovanColors, trovanTopoTokens } from '../theme/designTokens';

const topoDrift = keyframes`
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    background-position: 0 0, 0 0, 0 0, 0 0, 0 0;
  }
  50% {
    transform: translate3d(-48px, 30px, 0) scale(1.022);
    background-position: 22px -14px, -18px 12px, 32px -24px, -28px 20px, 18px 26px;
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    background-position: 0 0, 0 0, 0 0, 0 0, 0 0;
  }
`;

const topoPulse = keyframes`
  0%, 100% {
    opacity: 0.46;
    background-position: 0 0, 0 0;
  }
  50% {
    opacity: 0.62;
    background-position: 30px 0, 0 30px;
  }
`;

type TopoShellBackgroundProps = {
  active?: boolean;
  tone?: 'canvas' | 'black';
};

export function TopoShellBackground({ active = true, tone = 'canvas' }: TopoShellBackgroundProps) {
  if (!active) return null;
  const dark = tone === 'black';
  const warmPaperInk = alpha(trovanColors.copper[900], 0.12);
  const warmPaperCopper = alpha(trovanColors.copper[500], 0.14);

  return (
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        bgcolor: 'transparent',
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          inset: '-14%',
          willChange: 'transform, opacity',
        },
        '&::before': {
          opacity: dark ? 0.64 : 0.78,
          backgroundImage: [
            `radial-gradient(ellipse at 20% 12%, ${dark ? alpha(trovanColors.copper[500], 0.2) : trovanTopoTokens.glow}, transparent 34%)`,
            `radial-gradient(ellipse at 84% 4%, ${dark ? alpha('#FFF4E4', 0.05) : alpha(trovanColors.copper[800], 0.06)}, transparent 30%)`,
            `repeating-radial-gradient(ellipse at 16% 24%, transparent 0 18px, ${dark ? alpha(trovanColors.copper[400], 0.1) : trovanTopoTokens.lineSoft} 19px, transparent 21px, transparent 35px)`,
            `repeating-radial-gradient(ellipse at 84% 18%, transparent 0 16px, ${dark ? alpha('#FFF4E4', 0.07) : trovanTopoTokens.line} 17px, transparent 19px, transparent 33px)`,
            `repeating-radial-gradient(ellipse at 62% 72%, transparent 0 20px, ${dark ? alpha(trovanColors.copper[500], 0.085) : warmPaperInk} 21px, transparent 23px, transparent 40px)`,
          ].join(', '),
          backgroundBlendMode: dark ? 'screen' : 'multiply',
          animation: `${topoDrift} 16s ease-in-out infinite`,
        },
        '&::after': {
          opacity: dark ? 0.38 : 0.48,
          backgroundImage: [
            `linear-gradient(90deg, ${dark ? alpha('#FFF4E4', 0.045) : trovanTopoTokens.grid} 1px, transparent 1px)`,
            `linear-gradient(0deg, ${dark ? alpha('#FFF4E4', 0.04) : warmPaperCopper} 1px, transparent 1px)`,
          ].join(', '),
          backgroundSize: '86px 86px',
          maskImage: 'linear-gradient(135deg, rgba(0,0,0,0.72), transparent 68%)',
          animation: `${topoPulse} 12s ease-in-out infinite`,
        },
        '@media (prefers-reduced-motion: reduce)': {
          '&::before, &::after': {
            animation: 'none',
            transform: 'none',
          },
        },
      }}
    />
  );
}

export default TopoShellBackground;
