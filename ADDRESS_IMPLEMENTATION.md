# Address Handling Implementation

This document describes the improved address handling system implemented across the logistics application.

## Overview

The address system has been upgraded from simple string fields to structured, validated address inputs that work without external APIs.

## Features

✅ **Structured Address Storage**
- Street Address Line 1 (required)
- Street Address Line 2 (optional - apt, suite, etc.)
- City (required)
- State (required - 2-letter USPS code)
- ZIP Code (required - 5 digits or ZIP+4 format)

✅ **Multi-Layer Validation**
1. Format validation (regex patterns)
2. ZIP code database lookup
3. City/State matching with ZIP code
4. Street address heuristics

✅ **No External Dependencies**
- Local ZIP code database (JSON file)
- No API keys required
- No signup services
- Works completely offline

## File Structure

```
frontend/
├── public/
│   └── data/
│       └── zipcodes.json              # Local ZIP code database
├── src/
│   ├── components/
│   │   └── forms/
│   │       └── AddressInput.tsx       # Reusable address input component
│   ├── types/
│   │   └── address.ts                 # Shared TypeScript types
│   ├── utils/
│   │   └── addressValidation.ts       # Validation utilities
│   └── pages/
│       ├── JobsPage.tsx               # Updated with AddressInput
│       ├── CustomersPage.tsx          # Updated with AddressInput
│       └── RoutingPage.tsx            # Can be updated similarly

backend/
├── src/
│   └── modules/
│       └── jobs/
│           └── entities/
│               └── job.entity.ts      # Updated with structured address fields
└── seed-multi.ts                      # Updated seed data
```

## Components

### AddressInput Component

A reusable React component that handles all address input with built-in validation.

**Usage:**
```typescript
import AddressInput from '../components/forms/AddressInput';
import { Address } from '../types/address';

const [address, setAddress] = useState<Address>({
  line1: '',
  line2: null,
  city: '',
  state: '',
  zip: '',
});
const [isValid, setIsValid] = useState(false);

<AddressInput
  value={address}
  onChange={setAddress}
  onValidationChange={setIsValid}
  label="Delivery Address"
  required
/>
```

**Props:**
- `value: Address` - Current address object
- `onChange: (address: Address) => void` - Callback when address changes
- `onValidationChange?: (valid: boolean) => void` - Callback when validation status changes
- `label?: string` - Label for the address group (default: "Address")
- `required?: boolean` - Whether address is required (default: true)
- `disabled?: boolean` - Disable all inputs
- `validateOnBlur?: boolean` - Validate fields on blur (default: true)
- `showValidationErrors?: boolean` - Show validation errors (default: true)

## Validation Rules

### Street Address (Line 1)
- ✅ Required
- ✅ Must start with a number
- ✅ Must contain a valid street suffix (St, Ave, Rd, Blvd, etc.)

### Street Address Line 2
- ✅ Optional
- ✅ No validation (free-form for apt, suite, etc.)

### City
- ✅ Required
- ✅ Minimum 2 characters
- ✅ Only letters, spaces, hyphens, and apostrophes
- ✅ Must match ZIP code city (case-insensitive)

### State
- ✅ Required
- ✅ Must be valid 2-letter USPS code
- ✅ Must match ZIP code state

### ZIP Code
- ✅ Required
- ✅ Format: 5 digits or ZIP+4 (12345 or 12345-6789)
- ✅ Must exist in local database
- ✅ Must match entered city and state

## Validation Utilities

### Core Functions

```typescript
// Load ZIP database (call once on app init)
await loadZipDatabase();

// Validate complete address
const result = await validateAddress(address);
// Returns: { valid: boolean, errors: ValidationError[] }

// Validate individual fields
const streetError = validateStreetAddress(street);
const cityError = validateCity(city);
const stateError = validateState(state);
const zipError = validateZipFormat(zip);
const matchError = validateZipMatch(zip, city, state);

// Format address for display
const formatted = formatAddress(address);
// Returns: "123 Main St, Apt 4, Denver, CO 80202"

// Parse legacy single-line address
const parsed = parseLegacyAddress("123 Main St, Denver, CO 80202");
// Returns: { line1, line2, city, state, zip }

// Normalize address (trim, uppercase state)
const normalized = normalizeAddress(address);
```

## Backend Entity Updates

The Job entity now supports both legacy and structured addresses:

```typescript
// Legacy fields (backward compatible)
pickupAddress: string;
deliveryAddress: string;

// New structured fields
pickupAddressStructured?: {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
};
deliveryAddressStructured?: {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
};

// Geocoded coordinates (for future use)
pickupLocation?: { lat: number; lng: number };
deliveryLocation?: { lat: number; lng: number };
```

## ZIP Code Database

Location: `frontend/public/data/zipcodes.json`

Format:
```json
{
  "80202": {
    "city": "Denver",
    "state": "CO",
    "alt_cities": []
  },
  "10001": {
    "city": "New York",
    "state": "NY",
    "alt_cities": ["Manhattan"]
  }
}
```

**Current Coverage:**
- Denver/Aurora/Boulder/Lakewood/Englewood, CO
- Los Angeles/Santa Monica, CA
- New York, NY (Manhattan)
- Chicago, IL
- Dallas/Houston, TX
- Seattle, WA
- San Francisco, CA

**Expanding the Database:**
To add more ZIP codes, download a free ZIP code database and convert to this JSON format. No API keys or services required.

## Migration Strategy

The system maintains backward compatibility:

1. **Legacy Format**: Old addresses stored as single strings still work
2. **Dual Storage**: New entries save both legacy string and structured format
3. **Parsing**: `parseLegacyAddress()` converts old addresses to structured format
4. **Gradual Migration**: Frontend displays structured input, backend stores both

## Integration Examples

### Creating a Job

```typescript
import { formatAddress } from '../utils/addressValidation';

const handleCreateJob = async () => {
  const jobData = {
    customerName: 'John Doe',
    // Legacy format for backward compatibility
    pickupAddress: formatAddress(pickupAddressData),
    deliveryAddress: formatAddress(deliveryAddressData),
    // Structured format for new features
    pickupAddressStructured: pickupAddressData,
    deliveryAddressStructured: deliveryAddressData,
    priority: 'normal',
  };

  await createJob(jobData);
};
```

### Creating a Customer

```typescript
const handleSubmit = async () => {
  const customerData = {
    name: formData.name,
    address: formatAddress(addressData), // Legacy string
    addressStructured: addressData,       // Structured object
    businessName: formData.businessName,
  };

  await fetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customerData),
  });
};
```

### Loading Existing Address

```typescript
import { parseLegacyAddress } from '../utils/addressValidation';

const handleEdit = (customer) => {
  // If structured address exists, use it
  if (customer.addressStructured) {
    setAddressData(customer.addressStructured);
  } else {
    // Parse legacy format
    const parsed = parseLegacyAddress(customer.address);
    setAddressData({
      line1: parsed.line1 || '',
      line2: parsed.line2 || null,
      city: parsed.city || '',
      state: parsed.state || '',
      zip: parsed.zip || '',
    });
  }
};
```

## Future Enhancements

The system is designed with clean interfaces to support:

1. **Geocoding**: Add lat/lng coordinates without changing address structure
2. **Address Autocomplete**: Integrate Google Places or similar (optional)
3. **Delivery Area Validation**: Check if address is in service area
4. **Route Optimization**: Use coordinates from structured addresses
5. **International Addresses**: Extend validation for non-US addresses

## Testing

### Manual Testing Checklist

- [ ] Create job with valid address
- [ ] Try submitting with invalid ZIP code
- [ ] Verify city/state mismatch shows error
- [ ] Test ZIP+4 format (12345-6789)
- [ ] Test Address Line 2 (optional)
- [ ] Verify state auto-uppercases
- [ ] Check validation on blur
- [ ] Test with existing customer addresses
- [ ] Verify form disables submit until valid

### Example Test Addresses

**Valid:**
- `123 Main St, Denver, CO 80202`
- `456 Oak Ave Apt 2B, Aurora, CO 80014`
- `789 Pine Rd, Boulder, CO 80301`

**Invalid (should show errors):**
- `Main Street, Denver, CO 80202` (no number)
- `123 Main, Denver, CO 80202` (no street suffix)
- `123 Main St, Denver, CA 80202` (wrong state for ZIP)
- `123 Main St, Boulder, CO 80202` (wrong city for ZIP)
- `123 Main St, Denver, CO 12345` (invalid ZIP)

## Troubleshooting

### ZIP Database Not Loading
- Check file exists at `public/data/zipcodes.json`
- Verify JSON is valid
- Check browser console for fetch errors

### Validation Not Working
- Ensure `loadZipDatabase()` is called
- Check validation callbacks are wired up
- Verify address state is being updated

### Form Not Submitting
- Check `addressValid` state is true
- Verify all required fields have values
- Look for validation errors in UI

## Support

For questions or issues with the address system, check:
1. Browser console for validation errors
2. Network tab for ZIP database loading
3. Component props are correctly passed
4. Address state is properly initialized

## License

Part of the Routing & Dispatch SaaS Platform.
