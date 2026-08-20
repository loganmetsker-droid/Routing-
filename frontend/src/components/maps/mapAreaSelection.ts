export type MapPoint = { lat: number; lng: number };

export function isPointInsidePolygon(point: MapPoint, polygon: MapPoint[]) {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crossesLatitude = currentPoint.lat > point.lat !== previousPoint.lat > point.lat;
    if (!crossesLatitude) continue;

    const intersectionLng =
      ((previousPoint.lng - currentPoint.lng) * (point.lat - currentPoint.lat)) /
        (previousPoint.lat - currentPoint.lat) +
      currentPoint.lng;
    if (point.lng < intersectionLng) inside = !inside;
  }
  return inside;
}
