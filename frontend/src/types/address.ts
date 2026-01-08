/**
 * Shared address type definitions
 */

export interface Address {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
}

export interface AddressWithCoordinates extends Address {
  lat?: number;
  lng: number;
}

/**
 * Format address for single-line display
 */
export function formatAddressSingleLine(address: Address): string {
  const parts = [
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.zip}`,
  ].filter(Boolean);

  return parts.join(', ');
}

/**
 * Format address for multi-line display
 */
export function formatAddressMultiLine(address: Address): string[] {
  const lines = [address.line1];
  if (address.line2) lines.push(address.line2);
  lines.push(`${address.city}, ${address.state} ${address.zip}`);
  return lines;
}
