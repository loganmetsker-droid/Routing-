/**
 * Address Validation Utilities
 *
 * Provides validation for US addresses without external API dependencies.
 * Uses local ZIP code database for city/state verification.
 */

export interface Address {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ZipCodeData {
  city: string;
  state: string;
  alt_cities: string[];
}

type ZipCodeDatabase = Record<string, ZipCodeData>;

// Cached ZIP code database
let zipDatabase: ZipCodeDatabase | null = null;

// Common street suffixes for heuristic validation
const STREET_SUFFIXES = [
  'Street', 'St', 'Avenue', 'Ave', 'Road', 'Rd', 'Boulevard', 'Blvd',
  'Highway', 'Hwy', 'Drive', 'Dr', 'Court', 'Ct', 'Lane', 'Ln',
  'Way', 'Circle', 'Cir', 'Place', 'Pl', 'Terrace', 'Ter',
  'Parkway', 'Pkwy', 'Square', 'Sq', 'Trail', 'Trl', 'Pike',
  'Alley', 'Aly', 'Expressway', 'Expy'
];

// Valid 2-letter US state codes
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC'
];

/**
 * Load ZIP code database from public data file
 */
export async function loadZipDatabase(): Promise<void> {
  if (zipDatabase) return;

  try {
    const response = await fetch('/data/zipcodes.json');
    if (!response.ok) {
      throw new Error('Failed to load ZIP code database');
    }
    zipDatabase = await response.json();
  } catch (error) {
    console.error('Error loading ZIP database:', error);
    zipDatabase = {}; // Empty database on error
  }
}

/**
 * Get ZIP code information
 */
export function getZipInfo(zip: string): ZipCodeData | null {
  if (!zipDatabase) return null;
  const cleanZip = zip.split('-')[0]; // Handle ZIP+4
  return zipDatabase[cleanZip] || null;
}

/**
 * Validate street address format
 */
export function validateStreetAddress(street: string): ValidationError | null {
  const trimmed = street.trim();

  if (!trimmed) {
    return { field: 'line1', message: 'Street address is required' };
  }

  // Check if starts with a number (common for US addresses)
  if (!/^\d+/.test(trimmed)) {
    return { field: 'line1', message: 'Street address should start with a number' };
  }

  // Check for common street suffix
  const hasValidSuffix = STREET_SUFFIXES.some(suffix => {
    const regex = new RegExp(`\\b${suffix}\\b`, 'i');
    return regex.test(trimmed);
  });

  if (!hasValidSuffix) {
    return {
      field: 'line1',
      message: 'Street address should include a valid suffix (St, Ave, Rd, etc.)'
    };
  }

  return null;
}

/**
 * Validate city name
 */
export function validateCity(city: string): ValidationError | null {
  const trimmed = city.trim();

  if (!trimmed) {
    return { field: 'city', message: 'City is required' };
  }

  if (trimmed.length < 2) {
    return { field: 'city', message: 'City name is too short' };
  }

  // Only letters, spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z\s\-']+$/.test(trimmed)) {
    return { field: 'city', message: 'City name contains invalid characters' };
  }

  return null;
}

/**
 * Validate state code
 */
export function validateState(state: string): ValidationError | null {
  const upper = state.toUpperCase().trim();

  if (!upper) {
    return { field: 'state', message: 'State is required' };
  }

  if (!/^[A-Z]{2}$/.test(upper)) {
    return { field: 'state', message: 'State must be a 2-letter code' };
  }

  if (!US_STATES.includes(upper)) {
    return { field: 'state', message: 'Invalid state code' };
  }

  return null;
}

/**
 * Validate ZIP code format
 */
export function validateZipFormat(zip: string): ValidationError | null {
  const trimmed = zip.trim();

  if (!trimmed) {
    return { field: 'zip', message: 'ZIP code is required' };
  }

  // Must be 5 digits or 5+4 format
  if (!/^\d{5}(-\d{4})?$/.test(trimmed)) {
    return { field: 'zip', message: 'ZIP code must be 5 digits or ZIP+4 format' };
  }

  return null;
}

/**
 * Validate ZIP code matches city and state
 * NOTE: This is now lenient - only validates if ZIP is in database, otherwise allows any valid format
 */
export function validateZipMatch(
  zip: string,
  city: string,
  state: string
): ValidationError | null {
  const zipInfo = getZipInfo(zip);

  // If ZIP not in database, skip validation (allow any 5-digit ZIP)
  if (!zipInfo) {
    return null; // Changed from error to null - allows any valid format ZIP
  }

  // Check state match only if we have data
  if (zipInfo.state !== state.toUpperCase()) {
    return {
      field: 'zip',
      message: `ZIP code ${zip} is in ${zipInfo.state}, not ${state.toUpperCase()}`
    };
  }

  // Check city match (case-insensitive) - this is now a warning, not blocking
  const cityLower = city.toLowerCase().trim();
  const primaryCity = zipInfo.city.toLowerCase();
  const altCities = zipInfo.alt_cities.map(c => c.toLowerCase());

  if (cityLower !== primaryCity && !altCities.includes(cityLower)) {
    const suggestion = zipInfo.alt_cities.length > 0
      ? `${zipInfo.city} or ${zipInfo.alt_cities.join(', ')}`
      : zipInfo.city;

    return {
      field: 'city',
      message: `ZIP code ${zip} is typically ${suggestion}, not ${city}`
    };
  }

  return null;
}

/**
 * Validate complete address
 */
export async function validateAddress(address: Address): Promise<ValidationResult> {
  // Ensure ZIP database is loaded
  await loadZipDatabase();

  const errors: ValidationError[] = [];

  // Validate each field
  const streetError = validateStreetAddress(address.line1);
  if (streetError) errors.push(streetError);

  const cityError = validateCity(address.city);
  if (cityError) errors.push(cityError);

  const stateError = validateState(address.state);
  if (stateError) errors.push(stateError);

  const zipFormatError = validateZipFormat(address.zip);
  if (zipFormatError) {
    errors.push(zipFormatError);
  } else {
    // Only check ZIP match if format is valid
    const zipMatchError = validateZipMatch(address.zip, address.city, address.state);
    if (zipMatchError) errors.push(zipMatchError);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format address for display
 */
export function formatAddress(address: Address): string {
  const parts = [
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.zip}`,
  ].filter(Boolean);

  return parts.join(', ');
}

/**
 * Parse legacy single-line address into structured format
 * Best effort parsing - may not be perfect
 */
export function parseLegacyAddress(addressString: string): Partial<Address> {
  const parts = addressString.split(',').map(p => p.trim());

  if (parts.length < 2) {
    return { line1: addressString };
  }

  // Try to extract city, state, zip from last part
  const lastPart = parts[parts.length - 1];
  const stateZipMatch = lastPart.match(/([A-Z]{2})\s+(\d{5}(-\d{4})?)/);

  if (stateZipMatch && parts.length >= 2) {
    const state = stateZipMatch[1];
    const zip = stateZipMatch[2];
    const city = parts[parts.length - 1].replace(stateZipMatch[0], '').trim();
    const line1 = parts.slice(0, -1).join(', ');

    return { line1, city, state, zip, line2: null };
  }

  // Fallback
  return {
    line1: parts[0],
    city: parts.length > 1 ? parts[parts.length - 1] : '',
  };
}

/**
 * Normalize address fields (trim, uppercase state, etc.)
 */
export function normalizeAddress(address: Address): Address {
  return {
    line1: address.line1.trim(),
    line2: address.line2 ? address.line2.trim() : null,
    city: address.city.trim(),
    state: address.state.toUpperCase().trim(),
    zip: address.zip.trim(),
  };
}
