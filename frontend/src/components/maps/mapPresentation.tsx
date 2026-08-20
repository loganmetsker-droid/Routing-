import { useCallback, useEffect, useState } from 'react';
import { Box, Button, type SxProps, type Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  trovanColors,
  trovanMapTokens,
  trovanShadows,
} from '../../theme/designTokens';

export const trovanRoutePalette = trovanMapTokens.routePalette;

export type TrovanMapStyle = 'satellite' | 'streets';

export const TROVAN_MAP_STYLE_STORAGE_KEY = 'trovan.map.baseStyle';
const TROVAN_MAP_STYLE_EVENT = 'trovan-map-style-change';

export const trovanMapLayers: Record<TrovanMapStyle, {
  label: string;
  url: string;
  labelUrl?: string;
  attribution: string;
  tileFilter: string;
  labelOpacity?: number;
}> = {
  satellite: {
    label: 'Satellite',
    url: trovanMapTokens.tileUrl,
    labelUrl: trovanMapTokens.labelTileUrl,
    attribution: trovanMapTokens.attribution,
    tileFilter: 'saturate(1.14) brightness(0.92) contrast(1.1)',
    labelOpacity: 0.82,
  },
  streets: {
    label: 'Streets',
    url: trovanMapTokens.streetTileUrl,
    labelUrl: trovanMapTokens.streetOverlayTileUrl,
    attribution: trovanMapTokens.streetAttribution,
    tileFilter: 'saturate(1.28) brightness(1.04) contrast(1.06)',
    labelOpacity: 0.62,
  },
} as const;

export const trovanMapLayer = trovanMapLayers.satellite;

const normalizeMapStyle = (value: unknown): TrovanMapStyle =>
  value === 'streets' ? 'streets' : 'satellite';

const readStoredMapStyle = (): TrovanMapStyle => {
  if (typeof window === 'undefined') return 'satellite';
  return normalizeMapStyle(window.localStorage.getItem(TROVAN_MAP_STYLE_STORAGE_KEY));
};

export function usePersistedTrovanMapStyle() {
  const [mapStyle, setMapStyleState] = useState<TrovanMapStyle>(() => readStoredMapStyle());

  const setMapStyle = useCallback((nextStyle: TrovanMapStyle) => {
    setMapStyleState(nextStyle);
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TROVAN_MAP_STYLE_STORAGE_KEY, nextStyle);
    window.dispatchEvent(new CustomEvent(TROVAN_MAP_STYLE_EVENT, { detail: nextStyle }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sync = (event: Event) => {
      const nextStyle =
        event instanceof CustomEvent
          ? normalizeMapStyle(event.detail)
          : readStoredMapStyle();
      setMapStyleState(nextStyle);
    };
    window.addEventListener('storage', sync);
    window.addEventListener(TROVAN_MAP_STYLE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(TROVAN_MAP_STYLE_EVENT, sync);
    };
  }, []);

  return [mapStyle, setMapStyle] as const;
}

export function MapStyleToggle({
  value,
  onChange,
}: {
  value: TrovanMapStyle;
  onChange: (style: TrovanMapStyle) => void;
}) {
  return (
    <Box
      data-testid="map-style-toggle"
      sx={{
        position: 'absolute',
        top: 12,
        left: 58,
        zIndex: 1000,
        display: 'inline-flex',
        overflow: 'hidden',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.58)',
        bgcolor: alpha('#FFFFFF', 0.92),
        boxShadow: '0 8px 18px rgba(11,19,36,0.18)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {(['satellite', 'streets'] as const).map((style) => {
        const selected = value === style;
        return (
          <Button
            key={style}
            size="small"
            aria-pressed={selected}
            data-map-style={style}
            data-active={selected ? 'true' : 'false'}
            onClick={() => onChange(style)}
            sx={{
              minWidth: 78,
              height: 34,
              borderRadius: 0,
              color: selected ? '#FFFFFF !important' : trovanColors.black[800],
              bgcolor: selected ? trovanColors.copper[500] : 'transparent',
              fontSize: 12,
              fontWeight: 850,
              textTransform: 'none',
              '&:hover': {
                bgcolor: selected ? trovanColors.copper[600] : alpha(trovanColors.black[950], 0.06),
              },
            }}
          >
            {trovanMapLayers[style].label}
          </Button>
        );
      })}
    </Box>
  );
}

export const mapFloatingPanelSx: SxProps<Theme> = {
  bgcolor: alpha(trovanColors.utility.panel, 0.86),
  border: `1px solid ${trovanColors.utility.borderStrong}`,
  boxShadow: trovanShadows.soft,
  backdropFilter: 'blur(18px)',
  color: '#FFF8ED',
};

export function MapFilmOverlay({ variant = 'satellite' }: { variant?: TrovanMapStyle }) {
  const satellite = variant === 'satellite';
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 350,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: satellite
            ? [
                `linear-gradient(180deg, ${alpha(trovanColors.black[950], 0.12)} 0%, transparent 36%, ${alpha(
                  trovanColors.black[950],
                  0.18,
                )} 100%)`,
                `radial-gradient(circle at 18% 18%, ${alpha(trovanColors.copper[300], 0.08)} 0%, transparent 46%)`,
                `linear-gradient(90deg, ${alpha('#123D2C', 0.16)} 0%, transparent 48%, ${alpha(
                  '#0A1D35',
                  0.14,
                )} 100%)`,
              ].join(',')
            : [
                `linear-gradient(180deg, ${alpha('#FFFFFF', 0.02)} 0%, transparent 58%, ${alpha(
                  '#5D6F91',
                  0.03,
                )} 100%)`,
                `radial-gradient(circle at 18% 18%, ${alpha('#BFEFD8', 0.04)} 0%, transparent 46%)`,
              ].join(','),
          mixBlendMode: satellite ? 'multiply' : 'normal',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          boxShadow: satellite
            ? `inset 0 0 0 1px ${alpha(
                '#FFFFFF',
                0.18,
              )}, inset 0 -70px 120px ${alpha(
                trovanColors.black[950],
                0.16,
              )}, inset 0 0 80px ${alpha(
                trovanColors.black[950],
                0.12,
              )}`
            : `inset 0 0 0 1px ${alpha('#FFFFFF', 0.32)}, inset 0 0 56px ${alpha(
                trovanColors.black[950],
                0.035,
              )}`,
        }}
      />
    </Box>
  );
}
