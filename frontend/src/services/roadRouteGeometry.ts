export type RoadRoutePoint = [number, number];

type RoadRouteResponse = {
  code?: string;
  routes?: Array<{
    geometry?: {
      coordinates?: unknown;
    };
  }>;
};

const roadRouteBaseUrl =
  (import.meta.env.VITE_ROAD_ROUTE_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';

const roundCoordinate = (value: number) => Number(value.toFixed(6));

export const getRoadRouteSignature = (points: RoadRoutePoint[]) =>
  points
    .map(([lng, lat]) => `${roundCoordinate(lng)},${roundCoordinate(lat)}`)
    .join(';');

const toValidRoadRouteCoordinates = (value: unknown): RoadRoutePoint[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const [lng, lat] = point;
      const normalizedLng = Number(lng);
      const normalizedLat = Number(lat);
      if (!Number.isFinite(normalizedLng) || !Number.isFinite(normalizedLat)) return null;
      return [normalizedLng, normalizedLat] as RoadRoutePoint;
    })
    .filter(Boolean) as RoadRoutePoint[];
};

export const fetchRoadRoutePolyline = async (
  points: RoadRoutePoint[],
  signal?: AbortSignal,
  baseUrlOverride?: string,
): Promise<RoadRoutePoint[] | null> => {
  if (points.length < 2) return null;
  const baseUrl = (baseUrlOverride || roadRouteBaseUrl).replace(/\/$/, '');
  if (!baseUrl) return null;

  const coordinatePath = getRoadRouteSignature(points);
  const url = `${baseUrl}/${coordinatePath}?overview=full&geometries=geojson&continue_straight=false`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Road route geometry failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as RoadRouteResponse;
  const coordinates = toValidRoadRouteCoordinates(data.routes?.[0]?.geometry?.coordinates);
  return coordinates.length >= 2 ? coordinates : null;
};
