import { Button, FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import { useMemo, useState } from 'react';
import type { DispatchDriver } from '../../../types/dispatch';

type DriverAssignmentPanelProps = {
  driverId?: string | null;
  drivers: DispatchDriver[];
  disabled?: boolean;
  onAssign: (driverId: string) => Promise<void>;
};

export default function DriverAssignmentPanel({
  driverId,
  drivers,
  disabled,
  onAssign,
}: DriverAssignmentPanelProps) {
  const [selectedDriverId, setSelectedDriverId] = useState(driverId || '');

  const availableDrivers = useMemo(
    () => drivers.filter((driver) => String(driver.status || '').toLowerCase() !== 'inactive'),
    [drivers],
  );

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <FormControl fullWidth size="small">
        <InputLabel id="assign-driver-label">Driver</InputLabel>
        <Select
          labelId="assign-driver-label"
          value={selectedDriverId}
          label="Driver"
          onChange={(event) => setSelectedDriverId(String(event.target.value))}
        >
          {availableDrivers.map((driver) => (
            <MenuItem key={driver.id} value={driver.id}>
              {[driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.id}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        variant="contained"
        disabled={disabled || !selectedDriverId}
        onClick={() => void onAssign(selectedDriverId)}
      >
        Assign
      </Button>
    </Stack>
  );
}
