import { useQuery } from '@tanstack/react-query';
import { unwrapApiData } from '@shared/contracts';
import { apiFetch } from './api.session';
import { isPreview } from './api.preview';

export type DepotRecord = {
  id: string;
  name: string;
  address: string;
  isPrimary: boolean;
  location?: { lat: number; lng: number } | null;
};

export async function getDepots(): Promise<DepotRecord[]> {
  if (isPreview()) {
    return [{
      id: 'preview-depot',
      name: 'Denver Operations',
      address: 'Denver, CO',
      isPrimary: true,
      location: { lat: 39.7392, lng: -104.9903 },
    }];
  }
  const response = await apiFetch('/api/depots');
  const payload = unwrapApiData<{ depots?: DepotRecord[] }>(await response.json());
  return Array.isArray(payload.depots) ? payload.depots : [];
}

export function useDepotsQuery() {
  return useQuery({
    queryKey: ['depots'],
    queryFn: getDepots,
    staleTime: 30_000,
  });
}
