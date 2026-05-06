export type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

function sanitizeOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(/[\u0000-\u001F\u007F]/g, '');
  if (!cleaned) {
    return null;
  }

  if (cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength);
  }

  return cleaned;
}

export function sanitizeSessionContext(sessionContext?: SessionContext) {
  return {
    userAgent: sanitizeOptionalString(sessionContext?.userAgent, 1024),
    ipAddress: sanitizeOptionalString(sessionContext?.ipAddress, 128),
  };
}

