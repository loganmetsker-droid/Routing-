import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type { DispatchRouteVersion } from '../types/dispatch';

type PublishRoutesDialogProps = {
  open: boolean;
  version: DispatchRouteVersion | null;
  onClose: () => void;
  onPublish: () => Promise<void>;
};

export default function PublishRoutesDialog({
  open,
  version,
  onClose,
  onPublish,
}: PublishRoutesDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Publish Route Version</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Publishing makes this version the operator-approved route plan for execution. Superseded versions remain in history for audit review.
          </Typography>
          {version ? (
            <Typography variant="subtitle2">
              Version {version.versionNumber} · {version.status}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={async () => {
            await onPublish();
            onClose();
          }}
        >
          Publish
        </Button>
      </DialogActions>
    </Dialog>
  );
}
