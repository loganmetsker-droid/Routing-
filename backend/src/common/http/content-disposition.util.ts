function stripControlChars(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, '');
}

function stripUnsafeFilenameChars(value: string) {
  return value.replace(/["<>:`|?*\u0000-\u001F\u007F]/g, '');
}

function trimDots(value: string) {
  return value.replace(/^\.+/, '').replace(/\.+$/, '');
}

export function sanitizeContentDispositionFilename(
  value: unknown,
  options?: { fallback?: string; maxLength?: number },
) {
  const fallback = options?.fallback ?? 'download';
  const maxLength = options?.maxLength ?? 160;

  const input = stripControlChars(String(value ?? '').trim());
  const normalizedSlashes = input.replace(/\\/g, '/');
  const basename = (normalizedSlashes.split('/').pop() || '').trim();

  let safe = stripUnsafeFilenameChars(basename).replace(/\s+/g, ' ').trim();
  safe = trimDots(safe);
  if (!safe || safe === '.' || safe === '..') {
    safe = fallback;
  }

  if (safe.length > maxLength) {
    // Keep the tail so extensions like ".pdf" remain visible.
    safe = safe.slice(Math.max(0, safe.length - maxLength));
    safe = trimDots(safe);
    if (!safe) {
      safe = fallback;
    }
  }

  return safe;
}

export function buildInlineContentDisposition(filename: unknown) {
  const safe = sanitizeContentDispositionFilename(filename, {
    fallback: 'proof',
  });
  return `inline; filename="${safe}"`;
}

export function buildAttachmentContentDisposition(filename: unknown) {
  const safe = sanitizeContentDispositionFilename(filename, {
    fallback: 'download',
  });
  return `attachment; filename="${safe}"`;
}
