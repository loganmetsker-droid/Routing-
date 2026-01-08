import { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Paper,
  Chip,
  Button,
} from '@mui/material';
import {
  DragHandle,
  LocationOn,
  LocalShipping,
  Save,
  Cancel,
} from '@mui/icons-material';

interface Stop {
  jobId: string;
  address: string;
  type: 'pickup' | 'delivery';
  customerName?: string;
}

interface ReorderableStopsListProps {
  routeId: string;
  stops: Stop[];
  routeColor: string;
  onReorder: (routeId: string, newJobOrder: string[]) => Promise<void>;
}

export default function ReorderableStopsList({
  routeId,
  stops,
  routeColor,
  onReorder,
}: ReorderableStopsListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [reorderedStops, setReorderedStops] = useState<Stop[]>(stops);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newStops = [...reorderedStops];
    const draggedStop = newStops[draggedIndex];
    newStops.splice(draggedIndex, 1);
    newStops.splice(index, 0, draggedStop);

    setReorderedStops(newStops);
    setDraggedIndex(index);
    setHasChanges(true);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const newJobOrder = reorderedStops.map((stop) => stop.jobId);
      await onReorder(routeId, newJobOrder);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to reorder stops:', error);
      alert('Failed to reorder stops. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setReorderedStops(stops);
    setHasChanges(false);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Route Stops</Typography>
        {hasChanges && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<Cancel />}
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Order'}
            </Button>
          </Box>
        )}
      </Box>

      <List>
        {reorderedStops.map((stop, index) => (
          <ListItem
            key={`${stop.jobId}-${index}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            sx={{
              border: '1px solid',
              borderColor: draggedIndex === index ? routeColor : 'divider',
              borderRadius: 1,
              mb: 1,
              bgcolor: draggedIndex === index ? `${routeColor}15` : 'background.paper',
              cursor: 'grab',
              '&:active': {
                cursor: 'grabbing',
              },
            }}
          >
            <ListItemIcon>
              <DragHandle sx={{ color: routeColor }} />
            </ListItemIcon>
            <ListItemIcon>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: routeColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 14,
                }}
              >
                {index + 1}
              </Box>
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" fontWeight={600}>
                    {stop.customerName || 'Unknown Customer'}
                  </Typography>
                  <Chip
                    label={stop.type}
                    size="small"
                    color={stop.type === 'pickup' ? 'primary' : 'success'}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>
              }
              secondary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <LocationOn fontSize="small" />
                  <Typography variant="caption">{stop.address}</Typography>
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>

      {reorderedStops.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <LocalShipping sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No stops in this route</Typography>
        </Box>
      )}
    </Paper>
  );
}
