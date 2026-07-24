export type ProofUploadMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'application/pdf';

const allowedMimeTypes = new Set<ProofUploadMimeType>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function normalizeMimeType(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function startsWith(buffer: Buffer, bytes: number[]) {
  if (buffer.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buffer[i] !== bytes[i]) return false;
  }
  return true;
}

export function detectProofUploadMimeType(
  buffer: Buffer,
): ProofUploadMimeType | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return 'image/png';
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  // PDF: "%PDF-"
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }

  return null;
}

export function resolveProofUploadMimeType(
  mimeType: unknown,
  buffer: Buffer,
): ProofUploadMimeType | null {
  const normalized = normalizeMimeType(mimeType);
  const detected = detectProofUploadMimeType(buffer);

  if (!normalized || normalized === 'application/octet-stream') {
    return detected;
  }

  if (!allowedMimeTypes.has(normalized as ProofUploadMimeType)) {
    return null;
  }

  if (!detected) {
    return null;
  }

  if (detected !== normalized) {
    return null;
  }

  return normalized as ProofUploadMimeType;
}

export function getSafeProofDownloadContentType() {
  return 'application/octet-stream';
}
