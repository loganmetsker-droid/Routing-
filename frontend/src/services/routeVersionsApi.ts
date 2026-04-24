import { apiFetch as apiFetchBody } from './apiClient';
import {
  ensurePreviewRouteVersions,
  getPreviewVersionById,
  getPreviewVersionsForRoute,
  isPreview,
  nowIso,
  toPreviewRouteVersion,
} from './api.preview';
import type { RouteVersion } from './api.types';

export const listRouteVersions = async (
  routeId: string,
): Promise<RouteVersion[]> => {
  if (isPreview()) {
    return getPreviewVersionsForRoute(routeId).map((version) => ({
      ...version,
      status: version.status,
    }));
  }

  const data = await apiFetchBody<{ versions?: RouteVersion[] } | RouteVersion[]>(
    `/api/dispatch/routes/${routeId}/versions`,
  );
  return Array.isArray(data) ? data : data.versions || [];
};

export const createRouteVersionSnapshot = async (
  routeId: string,
): Promise<RouteVersion> => {
  if (isPreview()) {
    const nextVersion = toPreviewRouteVersion(routeId, 'DRAFT');
    const versions = ensurePreviewRouteVersions(routeId);
    versions.unshift(nextVersion);
    return nextVersion;
  }

  const data = await apiFetchBody<{ version: RouteVersion }>(
    `/api/dispatch/routes/${routeId}/versions/snapshot`,
    {
      method: 'POST',
    },
  );
  return data.version;
};

export const reviewRouteVersion = async (
  routeId: string,
  versionId: string,
): Promise<RouteVersion> => {
  if (isPreview()) {
    const version = getPreviewVersionById(routeId, versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found for route ${routeId}`);
    }
    version.status = 'REVIEWED';
    version.reviewedByUserId = 'preview-user';
    version.reviewedAt = nowIso();
    version.updatedAt = nowIso();
    return version;
  }

  const data = await apiFetchBody<{ version: RouteVersion }>(
    `/api/dispatch/routes/${routeId}/versions/${versionId}/review`,
    {
      method: 'POST',
    },
  );
  return data.version;
};

export const approveRouteVersion = async (
  routeId: string,
  versionId: string,
): Promise<RouteVersion> => {
  if (isPreview()) {
    const version = getPreviewVersionById(routeId, versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found for route ${routeId}`);
    }
    version.status = 'APPROVED';
    version.approvedByUserId = 'preview-user';
    version.approvedAt = nowIso();
    version.updatedAt = nowIso();
    return version;
  }

  const data = await apiFetchBody<{ version: RouteVersion }>(
    `/api/dispatch/routes/${routeId}/versions/${versionId}/approve`,
    {
      method: 'POST',
    },
  );
  return data.version;
};

export const publishRouteVersion = async (
  routeId: string,
  versionId: string,
): Promise<RouteVersion> => {
  if (isPreview()) {
    const version = getPreviewVersionById(routeId, versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found for route ${routeId}`);
    }
    const versions = ensurePreviewRouteVersions(routeId);
    versions.forEach((candidate) => {
      if (candidate.status === 'PUBLISHED') {
        candidate.status = 'SUPERSEDED';
      }
    });
    version.status = 'PUBLISHED';
    version.publishedAt = nowIso();
    version.publishedByUserId = 'preview-user';
    version.updatedAt = nowIso();
    return version;
  }

  const data = await apiFetchBody<{ version: RouteVersion }>(
    `/api/dispatch/routes/${routeId}/versions/${versionId}/publish`,
    {
      method: 'POST',
    },
  );
  return data.version;
};
