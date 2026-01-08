import React, { useState, useEffect } from 'react';
import {
  TextField,
  Grid,
  FormHelperText,
  Box,
  Typography,
} from '@mui/material';
import {
  Address,
  validateAddress,
  validateStreetAddress,
  validateCity,
  validateState,
  validateZipFormat,
  validateZipMatch,
  normalizeAddress,
  loadZipDatabase,
  ValidationError,
} from '../../utils/addressValidation';

export interface AddressInputProps {
  value: Address;
  onChange: (address: Address) => void;
  onValidationChange?: (valid: boolean) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  validateOnBlur?: boolean;
  showValidationErrors?: boolean;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  value,
  onChange,
  onValidationChange,
  label = 'Address',
  required = true,
  disabled = false,
  validateOnBlur = true,
  showValidationErrors = true,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);

  // Load ZIP database on mount
  useEffect(() => {
    loadZipDatabase();
  }, []);

  // Validate field on blur
  const handleBlur = async (field: keyof Address) => {
    if (!validateOnBlur) return;

    setTouched(prev => ({ ...prev, [field]: true }));

    const newErrors: Record<string, string> = { ...errors };

    // Field-specific validation
    if (field === 'line1') {
      const error = validateStreetAddress(value.line1);
      if (error) {
        newErrors.line1 = error.message;
      } else {
        delete newErrors.line1;
      }
    }

    if (field === 'city') {
      const error = validateCity(value.city);
      if (error) {
        newErrors.city = error.message;
      } else {
        delete newErrors.city;
      }
    }

    if (field === 'state') {
      const error = validateState(value.state);
      if (error) {
        newErrors.state = error.message;
      } else {
        delete newErrors.state;
      }
    }

    if (field === 'zip') {
      const formatError = validateZipFormat(value.zip);
      if (formatError) {
        newErrors.zip = formatError.message;
      } else {
        delete newErrors.zip;

        // Check ZIP-city-state match
        const matchError = validateZipMatch(value.zip, value.city, value.state);
        if (matchError) {
          newErrors[matchError.field] = matchError.message;
        }
      }
    }

    setErrors(newErrors);

    // Notify parent of validation status
    if (onValidationChange) {
      onValidationChange(Object.keys(newErrors).length === 0);
    }
  };

  // Validate all fields
  const validateAll = async () => {
    setIsValidating(true);
    const result = await validateAddress(value);
    setIsValidating(false);

    const newErrors: Record<string, string> = {};
    result.errors.forEach(err => {
      newErrors[err.field] = err.message;
    });

    setErrors(newErrors);
    setTouched({
      line1: true,
      city: true,
      state: true,
      zip: true,
    });

    if (onValidationChange) {
      onValidationChange(result.valid);
    }

    return result.valid;
  };

  // Expose validation method
  useEffect(() => {
    // Store validateAll in a ref accessible from parent if needed
    // This is handled via onValidationChange callback
  }, []);

  const handleFieldChange = (field: keyof Address, val: string) => {
    const newValue = { ...value, [field]: val };
    onChange(newValue);

    // Clear error for this field when user starts typing
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const getFieldError = (field: string): string | undefined => {
    return showValidationErrors && touched[field] ? errors[field] : undefined;
  };

  return (
    <Box>
      {label && (
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          {label}
          {required && <span style={{ color: 'red' }}> *</span>}
        </Typography>
      )}

      <Grid container spacing={2}>
        {/* Street Address Line 1 */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Street Address"
            value={value.line1}
            onChange={(e) => handleFieldChange('line1', e.target.value)}
            onBlur={() => handleBlur('line1')}
            error={!!getFieldError('line1')}
            helperText={getFieldError('line1') || 'e.g., 123 Main St'}
            required={required}
            disabled={disabled}
            size="small"
          />
        </Grid>

        {/* Street Address Line 2 (Optional) */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Apartment, Suite, etc. (Optional)"
            value={value.line2 || ''}
            onChange={(e) => handleFieldChange('line2', e.target.value || null)}
            disabled={disabled}
            size="small"
            helperText="Optional - Apt, Suite, Unit, Building, Floor, etc."
          />
        </Grid>

        {/* City */}
        <Grid item xs={12} sm={5}>
          <TextField
            fullWidth
            label="City"
            value={value.city}
            onChange={(e) => handleFieldChange('city', e.target.value)}
            onBlur={() => handleBlur('city')}
            error={!!getFieldError('city')}
            helperText={getFieldError('city')}
            required={required}
            disabled={disabled}
            size="small"
          />
        </Grid>

        {/* State */}
        <Grid item xs={12} sm={3}>
          <TextField
            fullWidth
            label="State"
            value={value.state}
            onChange={(e) => handleFieldChange('state', e.target.value.toUpperCase())}
            onBlur={() => handleBlur('state')}
            error={!!getFieldError('state')}
            helperText={getFieldError('state')}
            required={required}
            disabled={disabled}
            size="small"
            inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
            placeholder="CO"
          />
        </Grid>

        {/* ZIP Code */}
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="ZIP Code"
            value={value.zip}
            onChange={(e) => handleFieldChange('zip', e.target.value)}
            onBlur={() => handleBlur('zip')}
            error={!!getFieldError('zip')}
            helperText={getFieldError('zip')}
            required={required}
            disabled={disabled}
            size="small"
            inputProps={{ maxLength: 10 }}
            placeholder="12345"
          />
        </Grid>
      </Grid>

      {Object.keys(errors).length > 0 && showValidationErrors && (
        <FormHelperText error sx={{ mt: 1 }}>
          Please correct the errors above before submitting.
        </FormHelperText>
      )}
    </Box>
  );
};

// Hook for using AddressInput with validation
export const useAddressInput = (initialValue?: Partial<Address>) => {
  const [address, setAddress] = useState<Address>({
    line1: '',
    line2: null,
    city: '',
    state: '',
    zip: '',
    ...initialValue,
  });
  const [isValid, setIsValid] = useState(false);

  return {
    address,
    setAddress,
    isValid,
    setIsValid,
  };
};

export default AddressInput;
