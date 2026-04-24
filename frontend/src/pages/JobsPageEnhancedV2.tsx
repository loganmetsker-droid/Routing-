import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PageHeader } from '../components/PageHeader';
import { StatusPill, type StatusPillTone } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import type { CustomerRecord } from '../services/customersApi';
import { useCustomersQuery } from '../services/customersApi';
import {
  useCreateJobMutation,
  useJobsQuery,
  useUpdateJobMutation,
} from '../services/jobsApi';

interface JobRecord {
  id?: string;
  customerId?: string;
  customerName: string;
  deliveryAddress: string;
  pickupAddress?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
  assignedRouteId?: string | null;
}

type FilterKey = 'all' | 'today' | 'unassigned' | 'high' | 'completed';
type StatusFilter = 'all' | 'pending' | 'assigned' | 'in_progress' | 'completed';
type PriorityFilter = 'all' | 'low' | 'normal' | 'high' | 'urgent';
type AssignmentFilter = 'all' | 'assigned' | 'unassigned';

type SavedViewRecord = {
  id: string;
  name: string;
  createdAt: string;
  params: {
    filter: FilterKey;
    q: string;
    status: StatusFilter;
    priority: PriorityFilter;
    assignment: AssignmentFilter;
  };
};

type ImportCandidate = {
  customerId?: string;
  customerName: string;
  deliveryAddress: string;
  pickupAddress?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: string;
};

const SAVED_VIEWS_STORAGE_KEY = 'trovan.jobs.savedViews';
const SEARCHABLE_FILTER_KEYS = new Set<FilterKey>(['all', 'today', 'unassigned', 'high', 'completed']);
const SEARCHABLE_STATUS_KEYS = new Set<StatusFilter>(['all', 'pending', 'assigned', 'in_progress', 'completed']);
const SEARCHABLE_PRIORITY_KEYS = new Set<PriorityFilter>(['all', 'low', 'normal', 'high', 'urgent']);
const SEARCHABLE_ASSIGNMENT_KEYS = new Set<AssignmentFilter>(['all', 'assigned', 'unassigned']);

const parseSavedViews = (): SavedViewRecord[] => {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistSavedViews = (views: SavedViewRecord[]) => {
  localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(views));
};

const normalizeFilter = (value: string | null): FilterKey =>
  value && SEARCHABLE_FILTER_KEYS.has(value as FilterKey) ? (value as FilterKey) : 'all';

const normalizeStatusFilter = (value: string | null): StatusFilter =>
  value && SEARCHABLE_STATUS_KEYS.has(value as StatusFilter) ? (value as StatusFilter) : 'all';

const normalizePriorityFilter = (value: string | null): PriorityFilter =>
  value && SEARCHABLE_PRIORITY_KEYS.has(value as PriorityFilter) ? (value as PriorityFilter) : 'all';

const normalizeAssignmentFilter = (value: string | null): AssignmentFilter =>
  value && SEARCHABLE_ASSIGNMENT_KEYS.has(value as AssignmentFilter) ? (value as AssignmentFilter) : 'all';

const slugifyViewName = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `view-${Date.now()}`;

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const normalizeImportPriority = (value: string | undefined): ImportCandidate['priority'] => {
  const normalized = String(value || 'normal').toLowerCase();
  if (normalized === 'low' || normalized === 'high' || normalized === 'urgent') {
    return normalized;
  }
  return 'normal';
};

const normalizeImportCandidate = (record: Record<string, unknown>): ImportCandidate => ({
  customerId: String(record.customerId || record.customer_id || '').trim() || undefined,
  customerName: String(record.customerName || record.customer_name || record.customer || '').trim() || 'Imported customer',
  deliveryAddress: String(record.deliveryAddress || record.delivery_address || record.address || '').trim(),
  pickupAddress: String(record.pickupAddress || record.pickup_address || '').trim() || undefined,
  priority: normalizeImportPriority(String(record.priority || record.jobPriority || 'normal')),
  status: String(record.status || 'pending').trim() || 'pending',
});

const jobStatusTone = (status: string | undefined): StatusPillTone => {
  const normalized = String(status || 'pending').toLowerCase();
  if (normalized === 'completed') return 'success';
  if (normalized === 'in_progress') return 'info';
  if (normalized === 'assigned') return 'accent';
  if (normalized === 'cancelled' || normalized === 'failed') return 'danger';
  if (normalized === 'urgent') return 'warning';
  return 'default';
};

const priorityTone = (priority: string | undefined): StatusPillTone => {
  const normalized = String(priority || 'normal').toLowerCase();
  if (normalized === 'urgent') return 'danger';
  if (normalized === 'high') return 'warning';
  return 'default';
};

const parseImportFile = async (file: File): Promise<ImportCandidate[]> => {
  const contents = await file.text();
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.json')) {
    const parsed = JSON.parse(contents);
    const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.jobs) ? parsed.jobs : [];
    return records
      .map((record: unknown) =>
        normalizeImportCandidate((record as Record<string, unknown>) || {}),
      )
      .filter((record: ImportCandidate) => Boolean(record.deliveryAddress));
  }

  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines
    .slice(1)
    .map((line) => {
      const values = parseCsvLine(line);
      const record = headers.reduce<Record<string, string>>((accumulator, header, index) => {
        accumulator[header] = values[index] || '';
        return accumulator;
      }, {});
      return normalizeImportCandidate(record);
    })
    .filter((record) => Boolean(record.deliveryAddress));
};

export default function JobsPageEnhancedV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jobsQuery = useJobsQuery();
  const customersQuery = useCustomersQuery();
  const createJobMutation = useCreateJobMutation();
  const updateJobMutation = useUpdateJobMutation();
  const loading = jobsQuery.isLoading || customersQuery.isLoading;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeFilter = normalizeFilter(searchParams.get('filter'));
  const searchTerm = searchParams.get('q') || '';
  const statusFilter = normalizeStatusFilter(searchParams.get('status'));
  const priorityFilter = normalizePriorityFilter(searchParams.get('priority'));
  const assignmentFilter = normalizeAssignmentFilter(searchParams.get('assignment'));
  const activeViewId = searchParams.get('view') || '';
  const dialogOpen = searchParams.get('create') === 'true';
  const importDialogOpen = searchParams.get('import') === 'true';
  const savedViewsOpen = searchParams.get('views') === 'true';
  const todayKey = new Date().toISOString().slice(0, 10);

  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [savedViews, setSavedViews] = useState<SavedViewRecord[]>(() => parseSavedViews());
  const [savedViewName, setSavedViewName] = useState('');
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    deliveryAddress: '',
    priority: 'normal',
  });

  const updateUrl = (updates: Record<string, string | null | undefined>, options: { replace?: boolean } = {}) => {
    const nextParams = new URLSearchParams(location.search);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });
    navigate({ pathname: location.pathname, search: nextParams.toString() }, { replace: options.replace });
  };

  const updateQueueParams = (updates: Partial<SavedViewRecord['params']>) => {
    updateUrl({
      filter: updates.filter ?? activeFilter,
      q: updates.q ?? searchTerm,
      status: updates.status ?? statusFilter,
      priority: updates.priority ?? priorityFilter,
      assignment: updates.assignment ?? assignmentFilter,
      view: null,
    });
  };

  useEffect(() => {
    if (jobsQuery.data) {
      setJobs(jobsQuery.data);
    }
  }, [jobsQuery.data]);

  useEffect(() => {
    if (customersQuery.data) {
      setCustomers(customersQuery.data);
    }
  }, [customersQuery.data]);

  useEffect(() => {
    persistSavedViews(savedViews);
  }, [savedViews]);

  useEffect(() => {
    if (!activeViewId) return;
    if (!savedViews.some((view) => view.id === activeViewId)) {
      updateUrl({ view: null }, { replace: true });
    }
  }, [activeViewId, savedViews]);

  const visibleJobs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return jobs
      .filter((job) => job.status !== 'archived')
      .filter((job) => {
        switch (activeFilter) {
          case 'today':
            return String(job.createdAt || '').slice(0, 10) === todayKey;
          case 'unassigned':
            return !job.assignedRouteId && (job.status || 'pending') === 'pending';
          case 'high':
            return ['high', 'urgent'].includes(String(job.priority || '').toLowerCase());
          case 'completed':
            return String(job.status || '').toLowerCase() === 'completed';
          default:
            return true;
        }
      })
      .filter((job) => statusFilter === 'all' || String(job.status || 'pending').toLowerCase() === statusFilter)
      .filter((job) => priorityFilter === 'all' || String(job.priority || 'normal').toLowerCase() === priorityFilter)
      .filter((job) => {
        if (assignmentFilter === 'assigned') return Boolean(job.assignedRouteId);
        if (assignmentFilter === 'unassigned') return !job.assignedRouteId;
        return true;
      })
      .filter((job) => {
        if (!normalizedSearch) return true;
        const haystack = [
          job.id,
          job.customerName,
          job.deliveryAddress,
          job.pickupAddress,
          job.priority,
          job.status,
          job.assignedRouteId,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
  }, [activeFilter, assignmentFilter, jobs, priorityFilter, searchTerm, statusFilter, todayKey]);

  useEffect(() => {
    setSelectedJobIds((current) => current.filter((id) => visibleJobs.some((job) => job.id === id)));
  }, [visibleJobs]);

  const selectedJobs = visibleJobs.filter((job) => job.id && selectedJobIds.includes(job.id));
  const activeView = savedViews.find((view) => view.id === activeViewId) || null;
  const focusedJob = selectedJobs[0] || visibleJobs[0] || null;
  const queueCounts = {
    all: jobs.filter((job) => job.status !== 'archived').length,
    unassigned: jobs.filter((job) => !job.assignedRouteId && job.status !== 'archived').length,
    assigned: jobs.filter((job) => Boolean(job.assignedRouteId) && job.status !== 'archived').length,
    inTransit: jobs.filter((job) => String(job.status).toLowerCase() === 'in_progress').length,
    completed: jobs.filter((job) => String(job.status).toLowerCase() === 'completed').length,
  };

  const refreshJobs = async () => {
    const jobsData = await jobsQuery.refetch();
    setJobs(jobsData.data ?? []);
  };

  const handleOptimizeSelected = () => {
    const params = new URLSearchParams();
    selectedJobIds.forEach((id) => params.append('jobId', id));
    navigate('/routing?' + params.toString());
  };

  const handleArchive = async () => {
    await Promise.all(selectedJobIds.map((id) => updateJobMutation.mutateAsync({ id, updates: { status: 'archived' } })));
    setSelectedJobIds([]);
    await refreshJobs();
    setBannerMessage('Selected jobs archived from the operator queue.');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(selectedJobs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trovan-jobs-export.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    try {
      const customer = customers.find((item) => item.id === formData.customerId);
      await createJobMutation.mutateAsync({
        customerId: customer?.id,
        customerName: formData.customerName || customer?.name || 'Unknown Customer',
        customerPhone: customer?.phone,
        customerEmail: customer?.email,
        deliveryAddress: formData.deliveryAddress,
        priority: formData.priority,
        status: 'pending',
      });
      setFormData({ customerId: '', customerName: '', deliveryAddress: '', priority: 'normal' });
      updateUrl({ create: null });
      await refreshJobs();
      setBannerMessage('Job added to the queue.');
    } catch (error) {
      console.error('Failed to create job', error);
    }
  };

  const handleImportSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseImportFile(file);
      setImportCandidates(parsed);
      setImportFileName(file.name);
      setImportError(parsed.length ? null : 'No valid jobs were found in the selected file.');
      updateUrl({ import: 'true' });
    } catch (error) {
      console.error('Failed to parse import file', error);
      setImportCandidates([]);
      setImportFileName(file.name);
      setImportError('Import supports JSON arrays or CSV files with customerName and deliveryAddress columns.');
      updateUrl({ import: 'true' });
    } finally {
      event.target.value = '';
    }
  };

  const handleImportJobs = async () => {
    if (!importCandidates.length) {
      setImportError('Choose a file with at least one valid job row before importing.');
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      await Promise.all(
        importCandidates.map(async (candidate) => {
          const matchedCustomer = customers.find((customer) => {
            if (candidate.customerId && customer.id === candidate.customerId) return true;
            return customer.name.toLowerCase() === candidate.customerName.toLowerCase();
          });

          await createJobMutation.mutateAsync({
            customerId: matchedCustomer?.id,
            customerName: matchedCustomer?.name || candidate.customerName,
            customerPhone: matchedCustomer?.phone,
            customerEmail: matchedCustomer?.email,
            deliveryAddress: candidate.deliveryAddress,
            pickupAddress: candidate.pickupAddress,
            priority: candidate.priority,
            status: candidate.status || 'pending',
          });
        }),
      );

      await refreshJobs();
      setImportCandidates([]);
      setImportFileName('');
      updateUrl({ import: null });
      setBannerMessage(`Imported ${importCandidates.length} jobs into the operator queue.`);
    } catch (error) {
      console.error('Failed to import jobs', error);
      setImportError('One or more jobs could not be imported. Check the file format and try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveCurrentView = () => {
    const name = savedViewName.trim() || `Queue view ${savedViews.length + 1}`;
    const id = slugifyViewName(name);
    const nextView: SavedViewRecord = {
      id,
      name,
      createdAt: new Date().toISOString(),
      params: {
        filter: activeFilter,
        q: searchTerm,
        status: statusFilter,
        priority: priorityFilter,
        assignment: assignmentFilter,
      },
    };

    const deduped = savedViews.filter((view) => view.id !== id && view.name.toLowerCase() !== name.toLowerCase());
    const nextViews = [nextView, ...deduped].slice(0, 12);
    setSavedViews(nextViews);
    setSavedViewName('');
    updateUrl({
      filter: nextView.params.filter,
      q: nextView.params.q,
      status: nextView.params.status,
      priority: nextView.params.priority,
      assignment: nextView.params.assignment,
      view: nextView.id,
    });
    setBannerMessage(`Saved view \"${name}\" is ready to reuse.`);
  };

  const handleApplyView = (view: SavedViewRecord) => {
    updateUrl({
      filter: view.params.filter,
      q: view.params.q,
      status: view.params.status,
      priority: view.params.priority,
      assignment: view.params.assignment,
      view: view.id,
      views: null,
    });
  };

  const handleDeleteView = (viewId: string) => {
    setSavedViews((current) => current.filter((view) => view.id !== viewId));
    if (activeViewId === viewId) {
      updateUrl({ view: null });
    }
  };

  if (loading) {
    return <LoadingState label="Loading jobs queue..." minHeight="50vh" />;
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Planning"
        title="Jobs queue"
        subtitle="A dense intake workspace for triage, routing staging, and dispatch handoff."
        actions={
          <>
            <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>Bulk import</Button>
            <Button variant="outlined" onClick={() => updateUrl({ views: 'true' })}>Saved views</Button>
            <Button variant="contained" onClick={() => updateUrl({ create: 'true' })}>New job</Button>
          </>
        }
      />

      <input ref={fileInputRef} type="file" accept=".json,.csv" hidden onChange={handleImportSelection} />

      {bannerMessage ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setBannerMessage(null)}>
          {bannerMessage}
        </Alert>
      ) : null}

      <SurfacePanel variant="command" padding={1.45} sx={{ mb: 1.5 }}>
        <Stack spacing={1.25}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between">
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                size="small"
                variant={activeFilter === 'all' ? 'contained' : 'outlined'}
                sx={{ minHeight: 30, px: 1.15 }}
                onClick={() => updateQueueParams({ filter: 'all', status: 'all', assignment: 'all' })}
              >
                All jobs {queueCounts.all}
              </Button>
              <Button
                size="small"
                variant={activeFilter === 'unassigned' ? 'contained' : 'outlined'}
                sx={{ minHeight: 30, px: 1.15 }}
                onClick={() => updateQueueParams({ filter: 'unassigned', assignment: 'unassigned' })}
              >
                Unassigned {queueCounts.unassigned}
              </Button>
              <Button
                size="small"
                variant={assignmentFilter === 'assigned' ? 'contained' : 'outlined'}
                sx={{ minHeight: 30, px: 1.15 }}
                onClick={() => updateQueueParams({ assignment: 'assigned' })}
              >
                Assigned {queueCounts.assigned}
              </Button>
              <Button
                size="small"
                variant={statusFilter === 'in_progress' ? 'contained' : 'outlined'}
                sx={{ minHeight: 30, px: 1.15 }}
                onClick={() => updateQueueParams({ status: 'in_progress' })}
              >
                In transit {queueCounts.inTransit}
              </Button>
              <Button
                size="small"
                variant={activeFilter === 'completed' ? 'contained' : 'outlined'}
                sx={{ minHeight: 30, px: 1.15 }}
                onClick={() => updateQueueParams({ filter: 'completed', status: 'completed' })}
              >
                Delivered {queueCounts.completed}
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {activeView ? <StatusPill label={`View: ${activeView.name}`} tone="accent" /> : null}
              <StatusPill label={`${visibleJobs.length} visible`} />
              <StatusPill label={`${selectedJobIds.length} selected`} tone={selectedJobIds.length ? 'accent' : 'default'} />
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.2} alignItems={{ xl: 'center' }}>
            <TextField
              size="small"
              label="Search jobs"
              value={searchTerm}
              onChange={(event) => updateQueueParams({ q: event.target.value })}
              placeholder="Customer, address, route, or job ID"
              fullWidth
            />
            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(event) => updateQueueParams({ status: event.target.value as StatusFilter })}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="assigned">Assigned</MenuItem>
              <MenuItem value="in_progress">In progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Priority"
              value={priorityFilter}
              onChange={(event) => updateQueueParams({ priority: event.target.value as PriorityFilter })}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="all">All priorities</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Assignment"
              value={assignmentFilter}
              onChange={(event) => updateQueueParams({ assignment: event.target.value as AssignmentFilter })}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All jobs</MenuItem>
              <MenuItem value="assigned">Assigned</MenuItem>
              <MenuItem value="unassigned">Unassigned</MenuItem>
            </TextField>
            <Button variant="text" onClick={() => updateUrl({ filter: 'all', q: null, status: null, priority: null, assignment: null, view: null })}>
              Clear
            </Button>
          </Stack>
        </Stack>
      </SurfacePanel>

      {selectedJobIds.length > 0 ? (
        <SurfacePanel variant="subtle" padding={1.45} sx={{ mb: 1.5 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ lg: 'center' }}>
            <Box>
              <Typography variant="h6">{selectedJobIds.length} jobs selected</Typography>
              <Typography variant="body2" color="text.secondary">
                This queue stages work before it becomes routing and dispatch.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button variant="contained" onClick={handleOptimizeSelected}>Send selected to routing</Button>
              <Button variant="outlined" onClick={() => navigate('/dispatch')}>Open dispatch</Button>
              <Button variant="outlined" onClick={() => void handleArchive()}>Archive</Button>
              <Button variant="outlined" onClick={handleExport}>Export</Button>
            </Stack>
          </Stack>
        </SurfacePanel>
      ) : null}

      <SurfacePanel variant="command" sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 320px' }, minHeight: 'calc(100vh - 240px)' }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 240px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={visibleJobs.length > 0 && selectedJobIds.length === visibleJobs.filter((job) => job.id).length}
                    indeterminate={selectedJobIds.length > 0 && selectedJobIds.length < visibleJobs.filter((job) => job.id).length}
                    onChange={() => {
                      const selectableIds = visibleJobs.map((job) => job.id).filter(Boolean) as string[];
                      if (selectedJobIds.length === selectableIds.length) {
                        setSelectedJobIds([]);
                      } else {
                        setSelectedJobIds(selectableIds);
                      }
                    }}
                  />
                </TableCell>
                <TableCell sx={{ width: 118, whiteSpace: 'nowrap' }}>Job ID</TableCell>
                <TableCell sx={{ width: 146, whiteSpace: 'nowrap' }}>Status</TableCell>
                <TableCell sx={{ width: 172, whiteSpace: 'nowrap' }}>Pickup</TableCell>
                <TableCell sx={{ minWidth: 250 }}>Delivery</TableCell>
                <TableCell sx={{ width: 170, whiteSpace: 'nowrap' }}>Customer</TableCell>
                <TableCell sx={{ width: 132, whiteSpace: 'nowrap' }}>Date</TableCell>
                <TableCell sx={{ width: 104, whiteSpace: 'nowrap' }}>Priority</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Stack spacing={0.75} sx={{ py: 2 }}>
                      <Typography variant="subtitle1">No jobs match this queue view</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Adjust search, filter chips, or apply a different saved view.
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : null}
              {visibleJobs.map((job) => (
                <TableRow
                  key={job.id}
                  hover
                  selected={job.id ? selectedJobIds.includes(job.id) : false}
                  onClick={() => job.id && setSelectedJobIds([job.id])}
                  sx={{
                    cursor: 'pointer',
                    '&.Mui-selected': {
                      bgcolor: alpha('#B97129', 0.08),
                    },
                    '& .MuiTableCell-root': {
                      py: 0.8,
                      verticalAlign: 'top',
                      fontSize: '0.84rem',
                    },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={job.id ? selectedJobIds.includes(job.id) : false}
                      onChange={() => {
                        if (!job.id) return;
                        setSelectedJobIds((current) => (
                          current.includes(job.id as string)
                            ? current.filter((id) => id !== job.id)
                            : [...current, job.id as string]
                        ));
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.82rem' }}>
                    {job.id?.slice(0, 8) || '—'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <StatusPill
                      label={String(job.status || 'pending').replace(/_/g, ' ')}
                      tone={jobStatusTone(job.status)}
                    />
                  </TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 172,
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {job.pickupAddress || '—'}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 258 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        mb: 0.15,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {job.deliveryAddress || 'Address pending'}
                    </Typography>
                    {job.assignedRouteId ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ whiteSpace: 'nowrap', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        Route {job.assignedRouteId.slice(0, 8)}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 170,
                    }}
                  >
                    {job.customerName || 'Unassigned customer'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'Just now'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <StatusPill
                      label={job.priority || 'normal'}
                      tone={priorityTone(job.priority)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box
          sx={{
            display: { xs: 'none', xl: 'block' },
            borderLeft: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            p: 1.6,
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 0.55, letterSpacing: '0.08em' }}>SELECTED JOB</Typography>
          {focusedJob ? (
            <Stack spacing={1.2}>
              <Typography variant="h5">{focusedJob.customerName || 'Queue item'}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <StatusPill label={String(focusedJob.status || 'pending').replace(/_/g, ' ')} tone={jobStatusTone(focusedJob.status)} />
                <StatusPill label={focusedJob.priority || 'normal'} tone={priorityTone(focusedJob.priority)} />
                {focusedJob.assignedRouteId ? <StatusPill label={`Route ${focusedJob.assignedRouteId.slice(0, 8)}`} tone="accent" /> : null}
              </Stack>
              <SurfacePanel variant="muted" padding={1.3}>
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Pickup</Typography>
                    <Typography variant="body2" sx={{ mt: 0.25 }}>
                      {focusedJob.pickupAddress || 'Pickup address not set'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Delivery</Typography>
                    <Typography variant="body2" sx={{ mt: 0.25 }}>
                      {focusedJob.deliveryAddress || 'Delivery address pending'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Queue context</Typography>
                    <Typography variant="body2" sx={{ mt: 0.25 }}>
                      {focusedJob.createdAt ? new Date(focusedJob.createdAt).toLocaleString() : 'Created recently'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {focusedJob.id || 'ID pending'}
                    </Typography>
                  </Box>
                </Stack>
              </SurfacePanel>
              <Button
                variant="contained"
                onClick={() =>
                  focusedJob.id &&
                  navigate(`/routing?jobId=${encodeURIComponent(focusedJob.id)}`)
                }
              >
                Send to routing
              </Button>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No job is available in the current queue view.
            </Typography>
          )}
        </Box>
        </Box>
      </SurfacePanel>

      <Dialog open={dialogOpen} onClose={() => updateUrl({ create: null })} fullWidth maxWidth="sm">
        <DialogTitle>Create Job</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField
            select
            label="Customer"
            value={formData.customerId}
            onChange={(event) => {
              const customer = customers.find((item) => item.id === event.target.value);
              setFormData((current) => ({
                ...current,
                customerId: event.target.value,
                customerName: customer?.name || current.customerName,
                deliveryAddress:
                  typeof customer?.defaultAddress === 'string'
                    ? customer.defaultAddress
                    : typeof customer?.address === 'string'
                      ? customer.address
                      : current.deliveryAddress,
              }));
            }}
          >
            {customers.map((customer) => <MenuItem key={customer.id} value={customer.id}>{customer.name}</MenuItem>)}
          </TextField>
          <TextField label="Customer name" value={formData.customerName} onChange={(event) => setFormData((current) => ({ ...current, customerName: event.target.value }))} />
          <TextField label="Delivery address" multiline minRows={3} value={formData.deliveryAddress} onChange={(event) => setFormData((current) => ({ ...current, deliveryAddress: event.target.value }))} />
          <TextField select label="Priority" value={formData.priority} onChange={(event) => setFormData((current) => ({ ...current, priority: event.target.value }))}>
            <MenuItem value="normal">Normal</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="urgent">Urgent</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => updateUrl({ create: null })}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSubmit()}>Create Job</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialogOpen} onClose={() => updateUrl({ import: null })} fullWidth maxWidth="md">
        <DialogTitle>Import Jobs</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <Alert severity="info">
            Import JSON arrays or CSV files with `customerName`, `deliveryAddress`, `priority`, `status`, and optional `pickupAddress` columns.
          </Alert>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>Choose file</Button>
            <Typography variant="body2" color="text.secondary">
              {importFileName ? `${importFileName} • ${importCandidates.length} rows ready` : 'No file selected yet.'}
            </Typography>
          </Stack>
          {importError ? <Alert severity="error">{importError}</Alert> : null}
          {importCandidates.length > 0 ? (
            <SurfacePanel sx={{ bgcolor: 'rgba(255, 248, 242, 1)' }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Preview</Typography>
              <Stack spacing={1}>
                {importCandidates.slice(0, 5).map((candidate, index) => (
                  <Box key={`${candidate.customerName}-${candidate.deliveryAddress}-${index}`}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{candidate.customerName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {candidate.deliveryAddress} • {candidate.priority} • {candidate.status}
                    </Typography>
                  </Box>
                ))}
                {importCandidates.length > 5 ? (
                  <Typography variant="caption" color="text.secondary">+ {importCandidates.length - 5} more rows</Typography>
                ) : null}
              </Stack>
            </SurfacePanel>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => updateUrl({ import: null })}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleImportJobs()} disabled={importing || !importCandidates.length}>
            {importing ? 'Importing...' : 'Import jobs'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={savedViewsOpen} onClose={() => updateUrl({ views: null })} fullWidth maxWidth="sm">
        <DialogTitle>Saved Views</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              label="View name"
              value={savedViewName}
              onChange={(event) => setSavedViewName(event.target.value)}
              fullWidth
              placeholder="Morning dispatch review"
            />
            <Button variant="contained" onClick={handleSaveCurrentView}>Save current view</Button>
          </Stack>
          {savedViews.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Save a queue state to reopen it with the same search and filters later.
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {savedViews.map((view) => (
                <SurfacePanel key={view.id} sx={{ bgcolor: view.id === activeViewId ? 'rgba(250, 241, 234, 0.72)' : undefined }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle1">{view.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {view.params.filter} • {view.params.status} • {view.params.priority} • {view.params.assignment}
                        {view.params.q ? ` • ${view.params.q}` : ''}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" onClick={() => handleApplyView(view)}>Apply</Button>
                      <Button variant="text" color="error" onClick={() => handleDeleteView(view.id)}>Delete</Button>
                    </Stack>
                  </Stack>
                </SurfacePanel>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => updateUrl({ views: null })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
