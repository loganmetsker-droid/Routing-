type BullJobDataLike = Record<string, unknown> | null | undefined;

export type BullJobDataLogSummary = {
  jobId: string | null;
  organizationId: string | null;
  routeId: string | null;
  keys: string[];
  truncatedKeys: boolean;
};

const MAX_KEYS = 25;
const MAX_ID_LENGTH = 128;

function safeId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > MAX_ID_LENGTH ? text.slice(0, MAX_ID_LENGTH) : text;
}

export function summarizeBullJobDataForLog(data: unknown): BullJobDataLogSummary {
  const record: BullJobDataLike = data && typeof data === 'object' ? (data as any) : undefined;
  const keys = record ? Object.keys(record).sort() : [];

  return {
    jobId: safeId(record?.jobId),
    organizationId: safeId(record?.organizationId),
    routeId: safeId(record?.routeId),
    keys: keys.slice(0, MAX_KEYS),
    truncatedKeys: keys.length > MAX_KEYS,
  };
}
