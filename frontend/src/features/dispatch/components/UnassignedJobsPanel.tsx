import { Chip, List, ListItem, ListItemText, Stack } from '@mui/material';
import AssignmentLateRoundedIcon from '@mui/icons-material/AssignmentLateRounded';
import PageSection from '../../../components/ui/PageSection';
import EmptyState from '../../../components/ui/EmptyState';
import type { DispatchJob } from '../../../types/dispatch';

type UnassignedJobsPanelProps = {
  jobs: DispatchJob[];
};

export default function UnassignedJobsPanel({ jobs }: UnassignedJobsPanelProps) {
  return (
    <PageSection
      title="Unassigned Jobs"
      subtitle="Jobs not yet attached to a route plan"
    >
      {jobs.length === 0 ? (
        <EmptyState
          title="No unassigned jobs"
          message="Pending or unscheduled work with no route assignment will appear here."
          icon={<AssignmentLateRoundedIcon color="disabled" />}
        />
      ) : (
        <List disablePadding>
          {jobs.slice(0, 12).map((job) => (
            <ListItem key={job.id} disableGutters>
              <ListItemText
                primary={job.customerName || `Job ${job.id.slice(0, 8)}`}
                secondary={job.deliveryAddress || 'Address unavailable'}
              />
              <Stack alignItems="flex-end" spacing={0.5}>
                <Chip size="small" label={job.status} />
                {job.priority ? <Chip size="small" color="warning" label={job.priority} /> : null}
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </PageSection>
  );
}
