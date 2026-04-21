import type { DispatchRoute } from '../../../types/dispatch';

export type LatLngTuple = [number, number];

export function extractRoutePolyline(route: DispatchRoute | null | undefined): LatLngTuple[] {
  const routeData = route?.routeData as
    | { route?: Array<Record<string, unknown>>; polyline?: { coordinates?: unknown } }
    | undefined;
  const rawStops = routeData?.route ?? route?.optimizedStops ?? [];

  if (routeData?.polyline && Array.isArray(routeData.polyline.coordinates)) {
    const coordinates = routeData.polyline.coordinates
      .map((point) => {
        if (!Array.isArray(point) || point.length < 2) return null;
        const [lng, lat] = point;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        return [lat, lng] as LatLngTuple;
      })
      .filter(Boolean) as LatLngTuple[];

    if (coordinates.length >= 2) {
      return coordinates;
    }
  }

  if (!Array.isArray(rawStops)) return [];

  return rawStops
    .map((stop: any) => {
      const lat = stop?.location?.latitude ?? stop?.latitude ?? stop?.lat;
      const lng = stop?.location?.longitude ?? stop?.longitude ?? stop?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') return null;
      return [lat, lng] as LatLngTuple;
    })
    .filter(Boolean) as LatLngTuple[];
}
