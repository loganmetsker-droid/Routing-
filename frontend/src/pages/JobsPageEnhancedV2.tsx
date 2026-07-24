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
  Divider,
  FormControlLabel,
  IconButton,
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
  useMediaQuery,
} from '@mui/material';
import {
  Add,
  ArchiveOutlined,
  BlockOutlined,
  FileUploadOutlined,
  Groups2Outlined,
  KeyboardArrowDown,
  MoreHoriz,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { StatusPill, type StatusPillTone } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import { trovanMapLayers } from '../components/maps/mapPresentation';
import type { CustomerRecord } from '../services/customersApi';
import { useCustomersQuery } from '../services/customersApi';
import { useDriversQuery, useVehiclesQuery } from '../services/fleetApi';
import {
  useCreateJobMutation,
  useJobsQuery,
  useUpdateJobMutation,
} from '../services/jobsApi';
import type { JobRecord } from '../services/api.types';
import { usePlannerQuery } from '../services/plannerApi';
import { trovanColors } from '../theme/designTokens';
import {
  formatJobEta,
  formatJobWindow,
  formatPersonName,
  formatVehicleName,
  getJobDriver,
  getJobRoute,
  getJobVehicle,
} from './jobs/jobPresentation';

type FilterKey = 'all' | 'today' | 'unassigned' | 'high' | 'completed';
type StatusFilter = 'all' | 'pending' | 'assigned' | 'in_progress' | 'completed';
type PriorityFilter = 'all' | 'low' | 'normal' | 'high' | 'urgent';
type AssignmentFilter = 'all' | 'assigned' | 'unassigned';
type ServiceTypeFilter = 'all' | 'delivery' | 'special';
type TimeWindowFilter = 'all' | 'set' | 'missing';

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
  timeWindowStart?: string;
  timeWindowEnd?: string;
  estimatedDuration?: number;
  routingRequirements?: JobRecord['routingRequirements'];
};

type JobFormData = {
  customerId: string;
  customerName: string;
  deliveryAddress: string;
  pickupAddress: string;
  priority: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  estimatedDuration: string;
  palletCount: string;
  palletLengthIn: string;
  palletWidthIn: string;
  palletHeightIn: string;
  palletWeightLb: string;
  stackable: boolean;
  requiredEquipment: string;
  requiredDriverName: string;
  siteAccessNotes: string;
  dockAppointment: boolean;
  liftgateRequired: boolean;
  insideDelivery: boolean;
  temperatureRequirement: string;
  hazmatClass: string;
  handlingRequirement: string;
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

const toDateTimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const createDefaultFormData = (): JobFormData => {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return {
    customerId: '',
    customerName: '',
    deliveryAddress: '',
    pickupAddress: '',
    priority: 'normal',
    timeWindowStart: toDateTimeLocal(start),
    timeWindowEnd: toDateTimeLocal(end),
    estimatedDuration: '45',
    palletCount: '',
    palletLengthIn: '48',
    palletWidthIn: '40',
    palletHeightIn: '',
    palletWeightLb: '',
    stackable: true,
    requiredEquipment: '',
    requiredDriverName: '',
    siteAccessNotes: '',
    dockAppointment: false,
    liftgateRequired: false,
    insideDelivery: false,
    temperatureRequirement: '',
    hazmatClass: '',
    handlingRequirement: '',
  };
};

const optionalNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && String(value ?? '').trim() !== ''
    ? parsed
    : undefined;
};

const optionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(normalized)) return true;
  if (['false', 'no', '0', 'n'].includes(normalized)) return false;
  return undefined;
};

const toIsoFromLocal = (value: string): string | undefined => {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const parseEquipmentList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const buildRoutingRequirements = (
  formData: JobFormData,
): JobRecord['routingRequirements'] => ({
  load: {
    palletCount: optionalNumber(formData.palletCount),
    palletLengthIn: optionalNumber(formData.palletLengthIn),
    palletWidthIn: optionalNumber(formData.palletWidthIn),
    palletHeightIn: optionalNumber(formData.palletHeightIn),
    palletWeightLb: optionalNumber(formData.palletWeightLb),
    stackable: formData.stackable,
  },
  requiredEquipment: parseEquipmentList(formData.requiredEquipment),
  requiredDriverName: formData.requiredDriverName.trim() || undefined,
  site: {
    accessNotes: formData.siteAccessNotes.trim() || undefined,
    dockAppointment: formData.dockAppointment,
    liftgateRequired: formData.liftgateRequired,
    insideDelivery: formData.insideDelivery,
  },
  temperatureRequirement: formData.temperatureRequirement.trim() || undefined,
  hazmatClass: formData.hazmatClass.trim() || undefined,
  handlingRequirement: formData.handlingRequirement.trim() || undefined,
});

const extractRoutingRequirements = (
  record: Record<string, unknown>,
): JobRecord['routingRequirements'] => {
  const existing = record.routingRequirements;
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return existing as JobRecord['routingRequirements'];
  }

  return {
    load: {
      palletCount: optionalNumber(record.palletCount ?? record.pallet_count),
      palletLengthIn: optionalNumber(record.palletLengthIn ?? record.pallet_length_in),
      palletWidthIn: optionalNumber(record.palletWidthIn ?? record.pallet_width_in),
      palletHeightIn: optionalNumber(record.palletHeightIn ?? record.pallet_height_in),
      palletWeightLb: optionalNumber(record.palletWeightLb ?? record.pallet_weight_lb),
      stackable: optionalBoolean(record.stackable ?? record.nonStackable) === undefined
        ? undefined
        : optionalBoolean(record.stackable) ?? !optionalBoolean(record.nonStackable),
    },
    requiredEquipment: String(record.requiredEquipment || record.required_equipment || '')
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean),
    requiredDriverName: String(record.requiredDriverName || record.required_driver || '').trim() || undefined,
    site: {
      accessNotes: String(record.siteAccessNotes || record.site_access || record.accessNotes || '').trim() || undefined,
      dockAppointment: optionalBoolean(record.dockAppointment ?? record.dock_appointment),
      liftgateRequired: optionalBoolean(record.liftgateRequired ?? record.liftgate_required),
      insideDelivery: optionalBoolean(record.insideDelivery ?? record.inside_delivery),
    },
    temperatureRequirement: String(record.temperatureRequirement || record.temperature || '').trim() || undefined,
    hazmatClass: String(record.hazmatClass || record.hazmat || '').trim() || undefined,
    handlingRequirement: String(record.handlingRequirement || record.handling || '').trim() || undefined,
  };
};

const normalizeImportCandidate = (record: Record<string, unknown>): ImportCandidate => ({
  customerId: String(record.customerId || record.customer_id || '').trim() || undefined,
  customerName: String(record.customerName || record.customer_name || record.customer || '').trim() || 'Imported customer',
  deliveryAddress: String(record.deliveryAddress || record.delivery_address || record.address || '').trim(),
  pickupAddress: String(record.pickupAddress || record.pickup_address || '').trim() || undefined,
  priority: normalizeImportPriority(String(record.priority || record.jobPriority || 'normal')),
  status: String(record.status || 'pending').trim() || 'pending',
  timeWindowStart: String(record.timeWindowStart || record.time_window_start || '').trim() || undefined,
  timeWindowEnd: String(record.timeWindowEnd || record.time_window_end || '').trim() || undefined,
  estimatedDuration: optionalNumber(record.estimatedDuration ?? record.serviceDuration ?? record.service_duration),
  routingRequirements: extractRoutingRequirements(record),
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

const readinessTone = (job: JobRecord): StatusPillTone => {
  const status = job.routingReadiness?.status;
  if (status === 'routable') return 'success';
  if (status === 'access_risk' || status === 'appointment_risk') return 'warning';
  if (status === 'capacity_risk' || status === 'missing_data') return 'danger';
  return 'default';
};

const readinessLabel = (job: JobRecord) =>
  String(job.routingReadiness?.status || 'missing_data').replace(/_/g, ' ');

const formatLoadSummary = (job: JobRecord) => {
  const summary = job.routingReadiness?.loadSummary;
  if (!summary?.palletCount) return 'Load details pending';
  const parts = [`${summary.palletCount} pallets`];
  if (summary.totalWeightKg) parts.push(`${Math.round(summary.totalWeightKg * 2.20462).toLocaleString()} lb`);
  if (summary.totalVolumeM3) parts.push(`${(summary.totalVolumeM3 * 35.3147).toFixed(1)} cu ft`);
  parts.push(summary.stackable === false ? 'non-stackable' : 'stackable');
  return parts.join(' • ');
};

const formatReasonCodes = (job: JobRecord) =>
  job.routingReadiness?.reasonCodes.length
    ? job.routingReadiness.reasonCodes.map((code) => code.replace(/_/g, ' ').toLowerCase()).join(', ')
    : job.routingReadiness?.summary || 'Ready for routing';

const hasSpecialHandling = (job: JobRecord) =>
  Boolean(
    job.routingRequirements?.requiredEquipment?.length ||
      job.routingRequirements?.requiredDriverName ||
      job.routingRequirements?.site?.dockAppointment ||
      job.routingRequirements?.site?.liftgateRequired ||
      job.routingRequirements?.site?.insideDelivery ||
      job.routingRequirements?.site?.accessNotes ||
      job.routingRequirements?.temperatureRequirement ||
      job.routingRequirements?.hazmatClass ||
      job.routingRequirements?.handlingRequirement,
  );

const readLocation = (value: unknown): { lat: number; lng: number } | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown };
  const lat = Number(candidate.lat ?? candidate.latitude);
  const lng = Number(candidate.lng ?? candidate.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

function JobMiniMap({ job }: { job: JobRecord }) {
  const layer = trovanMapLayers.streets;
  const pickup = readLocation(job.pickupLocation);
  const delivery = readLocation(job.deliveryLocation);
  const center = delivery || pickup || { lat: 39.7392, lng: -104.9903 };
  const line = [pickup, delivery].filter(Boolean) as Array<{ lat: number; lng: number }>;

  return (
    <Box
      data-testid="jobs-inspector-map"
      sx={{
        height: 170,
        overflow: 'hidden',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        '& .leaflet-container': { height: '100%', width: '100%', bgcolor: 'background.default' },
        '& .leaflet-tile-pane': { filter: layer.tileFilter },
        '& .leaflet-control-container': { display: 'none' },
      }}
    >
      <MapContainer
        attributionControl={false}
        center={[center.lat, center.lng]}
        zoom={pickup && delivery ? 12 : 11}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={layer.url} attribution={layer.attribution} />
        {layer.labelUrl ? (
          <TileLayer url={layer.labelUrl} attribution={layer.attribution} opacity={layer.labelOpacity ?? 0.65} />
        ) : null}
        {line.length === 2 ? (
          <Polyline
            positions={line.map((point) => [point.lat, point.lng] as [number, number])}
            pathOptions={{ color: '#B87333', weight: 4, opacity: 0.82 }}
          />
        ) : null}
        {pickup ? (
          <CircleMarker center={[pickup.lat, pickup.lng]} radius={6} pathOptions={{ color: '#0B1324', fillColor: '#fff', fillOpacity: 1, weight: 3 }} />
        ) : null}
        {delivery ? (
          <CircleMarker center={[delivery.lat, delivery.lng]} radius={7} pathOptions={{ color: '#B87333', fillColor: '#B87333', fillOpacity: 1, weight: 2 }} />
        ) : null}
      </MapContainer>
    </Box>
  );
}

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const plannerQuery = usePlannerQuery(todayKey);

  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceTypeFilter>('all');
  const [timeWindowFilter, setTimeWindowFilter] = useState<TimeWindowFilter>('all');
  const [savedViews, setSavedViews] = useState<SavedViewRecord[]>(() => parseSavedViews());
  const [savedViewName, setSavedViewName] = useState('');
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [formData, setFormData] = useState<JobFormData>(() => createDefaultFormData());
  const [mobilePage, setMobilePage] = useState(1);

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
        if (serviceTypeFilter === 'special') return hasSpecialHandling(job);
        return true;
      })
      .filter((job) => {
        const hasWindow = Boolean(job.timeWindow?.start || job.timeWindowStart || job.timeWindow?.end || job.timeWindowEnd);
        if (timeWindowFilter === 'set') return hasWindow;
        if (timeWindowFilter === 'missing') return !hasWindow;
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
  }, [activeFilter, assignmentFilter, jobs, priorityFilter, searchTerm, serviceTypeFilter, statusFilter, timeWindowFilter, todayKey]);

  const mobilePageSize = 10;
  const mobilePageCount = Math.max(1, Math.ceil(visibleJobs.length / mobilePageSize));
  const mobilePageStart = (mobilePage - 1) * mobilePageSize;
  const mobileJobs = visibleJobs.slice(mobilePageStart, mobilePageStart + mobilePageSize);

  useEffect(() => {
    setMobilePage((current) => Math.min(current, mobilePageCount));
  }, [mobilePageCount]);

  useEffect(() => {
    setMobilePage(1);
  }, [activeFilter, assignmentFilter, priorityFilter, searchTerm, serviceTypeFilter, statusFilter, timeWindowFilter]);

  useEffect(() => {
    setSelectedJobIds((current) => current.filter((id) => visibleJobs.some((job) => job.id === id)));
  }, [visibleJobs]);

  const selectedJobs = visibleJobs.filter((job) => job.id && selectedJobIds.includes(job.id));
  const jobsOnCurrentSurface = isMobile ? mobileJobs : visibleJobs;
  const selectableJobIds = jobsOnCurrentSurface.map((job) => job.id).filter(Boolean) as string[];
  const selectedVisibleJobCount = selectableJobIds.filter((id) => selectedJobIds.includes(id)).length;
  const allVisibleJobsSelected =
    selectableJobIds.length > 0 && selectedVisibleJobCount === selectableJobIds.length;
  const activeView = savedViews.find((view) => view.id === activeViewId) || null;
  const focusedJob = selectedJobs[0] || jobsOnCurrentSurface[0] || visibleJobs[0] || null;
  const routeGroups = plannerQuery.data?.groups ?? [];
  const routeStops = plannerQuery.data?.stops ?? [];
  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const focusedRoute = focusedJob ? getJobRoute(focusedJob, routeGroups, routeStops) : null;
  const focusedDriver = getJobDriver(focusedRoute, drivers);
  const focusedVehicle = focusedJob ? getJobVehicle(focusedJob, focusedRoute, vehicles) : null;
  const focusedCustomer = focusedJob
    ? customers.find((customer) => customer.id === focusedJob.customerId || customer.name === focusedJob.customerName) || null
    : null;
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

  const handleCancelSelected = async () => {
    await Promise.all(selectedJobIds.map((id) => updateJobMutation.mutateAsync({ id, updates: { status: 'cancelled' } })));
    setSelectedJobIds([]);
    await refreshJobs();
    setBannerMessage('Selected jobs marked cancelled.');
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
      setCreateError(null);
      const customer = customers.find((item) => item.id === formData.customerId);
      await createJobMutation.mutateAsync({
        customerId: customer?.id,
        customerName: formData.customerName || customer?.name || 'Unknown Customer',
        customerPhone: customer?.phone,
        customerEmail: customer?.email,
        deliveryAddress: formData.deliveryAddress,
        pickupAddress: formData.pickupAddress,
        timeWindowStart: toIsoFromLocal(formData.timeWindowStart),
        timeWindowEnd: toIsoFromLocal(formData.timeWindowEnd),
        estimatedDuration: optionalNumber(formData.estimatedDuration),
        routingRequirements: buildRoutingRequirements(formData),
        priority: formData.priority,
        status: 'pending',
      });
      setFormData(createDefaultFormData());
      updateUrl({ create: null });
      await refreshJobs();
      setBannerMessage('Job added with routing constraints and readiness context.');
    } catch (error) {
      setCreateError('Job could not be created. Check the customer, addresses, and service window, then try again.');
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
            timeWindowStart: candidate.timeWindowStart,
            timeWindowEnd: candidate.timeWindowEnd,
            estimatedDuration: candidate.estimatedDuration,
            routingRequirements: candidate.routingRequirements,
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
    <Box
      data-testid="jobs-page"
      sx={{
        display: 'grid',
        gap: 1.25,
        minWidth: 0,
        pb: selectedJobIds.length ? 8 : 0,
      }}
    >
      <input ref={fileInputRef} type="file" accept=".json,.csv" hidden onChange={handleImportSelection} />

      {bannerMessage ? (
        <Alert severity="success" onClose={() => setBannerMessage(null)}>
          {bannerMessage}
        </Alert>
      ) : null}

      <SurfacePanel data-testid="jobs-command-panel" variant="command" padding={0} sx={{ overflow: 'hidden' }}>
        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xl: 'center' }}
          sx={{ px: 1.2, py: 1.1, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="contained" startIcon={<Add />} onClick={() => { setCreateError(null); updateUrl({ create: 'true' }); }}>
              New Job
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileUploadOutlined />}
              onClick={() => updateUrl({ import: 'true' })}
            >
              Import CSV
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Groups2Outlined />}
              disabled={!selectedJobIds.length}
              onClick={handleOptimizeSelected}
            >
              Batch Assign
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArchiveOutlined />}
              disabled={!selectedJobIds.length}
              onClick={() => void handleArchive()}
            >
              Archive
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<BlockOutlined />}
              disabled={!selectedJobIds.length}
              onClick={() => void handleCancelSelected()}
            >
              Cancel
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xl: 'flex-end' }} useFlexGap>
            <TextField
              size="small"
              value={searchTerm}
              onChange={(event) => updateQueueParams({ q: event.target.value })}
              placeholder="Search jobs, customers, addresses..."
              sx={{ minWidth: { xs: '100%', sm: 240, xl: 300 } }}
            />
            <Button variant="outlined" endIcon={<KeyboardArrowDown />} onClick={() => updateUrl({ views: 'true' })}>
              Saved Views
            </Button>
            <StatusPill label={`${queueCounts.all} active`} />
            {activeView ? <StatusPill label={activeView.name} tone="accent" /> : null}
          </Stack>
        </Stack>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          flexWrap="wrap"
          sx={{ px: 1.2, py: 1.1 }}
          useFlexGap
        >
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(event) => updateQueueParams({ status: event.target.value as StatusFilter })}
            sx={{ width: { xs: '100%', md: 150 } }}
          >
            <MenuItem value="all">Status ({queueCounts.all})</MenuItem>
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
            sx={{ width: { xs: '100%', md: 150 } }}
          >
            <MenuItem value="all">Priority (All)</MenuItem>
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="normal">Normal</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="urgent">Urgent</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Date"
            value={activeFilter === 'today' ? 'today' : 'all'}
            onChange={(event) => updateQueueParams({ filter: event.target.value === 'today' ? 'today' : 'all' })}
            sx={{ width: { xs: '100%', md: 180 } }}
          >
            <MenuItem value="all">All dates</MenuItem>
            <MenuItem value="today">Today</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Service Type"
            value={serviceTypeFilter}
            onChange={(event) => setServiceTypeFilter(event.target.value as ServiceTypeFilter)}
            sx={{ width: { xs: '100%', md: 170 } }}
          >
            <MenuItem value="all">Service Type (All)</MenuItem>
            <MenuItem value="delivery">Delivery</MenuItem>
            <MenuItem value="special">Special handling</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Time Window"
            value={timeWindowFilter}
            onChange={(event) => setTimeWindowFilter(event.target.value as TimeWindowFilter)}
            sx={{ width: { xs: '100%', md: 170 } }}
          >
            <MenuItem value="all">Time Window (All)</MenuItem>
            <MenuItem value="set">Window set</MenuItem>
            <MenuItem value="missing">Missing window</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Assignment"
            value={assignmentFilter}
            onChange={(event) => updateQueueParams({ assignment: event.target.value as AssignmentFilter })}
            sx={{ width: { xs: '100%', md: 160 } }}
          >
            <MenuItem value="all">All jobs</MenuItem>
            <MenuItem value="assigned">Assigned</MenuItem>
            <MenuItem value="unassigned">Unassigned</MenuItem>
          </TextField>
          <Button variant="outlined" endIcon={<KeyboardArrowDown />} onClick={() => setMoreFiltersOpen(true)}>
            More Filters
          </Button>
          <Button
            variant="text"
            onClick={() => {
              setServiceTypeFilter('all');
              setTimeWindowFilter('all');
              updateUrl({ filter: 'all', q: null, status: null, priority: null, assignment: null, view: null });
            }}
          >
            Clear
          </Button>
        </Stack>
      </SurfacePanel>

      <Box
        data-testid="jobs-workspace-grid"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(300px, 340px)', xl: 'minmax(0, 1fr) 360px' },
          gap: 1.25,
          minWidth: 0,
          alignItems: 'start',
        }}
      >
        <SurfacePanel data-testid="jobs-table-panel" variant="command" sx={{ p: 0, minWidth: 0, overflow: 'hidden' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ md: 'center' }}
            sx={{ px: 1.2, py: 0.85, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Checkbox
                size="small"
                inputProps={{ 'aria-label': 'Select all visible jobs' }}
                checked={allVisibleJobsSelected}
                indeterminate={selectedVisibleJobCount > 0 && !allVisibleJobsSelected}
                onChange={() => {
                  if (allVisibleJobsSelected) {
                    setSelectedJobIds([]);
                  } else {
                    setSelectedJobIds(selectableJobIds);
                  }
                }}
              />
              <Button
                size="small"
                variant="outlined"
                endIcon={<KeyboardArrowDown />}
                onClick={() => {
                  if (allVisibleJobsSelected) {
                    setSelectedJobIds([]);
                  } else {
                    setSelectedJobIds(selectableJobIds);
                  }
                }}
              >
                {selectedJobIds.length || 0} selected
              </Button>
              <Typography variant="body2" color="text.secondary">
                {isMobile
                  ? `Showing ${visibleJobs.length ? mobilePageStart + 1 : 0} - ${Math.min(mobilePageStart + mobilePageSize, visibleJobs.length)} of ${visibleJobs.length} matching jobs`
                  : `Showing 1 - ${visibleJobs.length} of ${queueCounts.all} jobs`}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Sort by: <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>Promised Window</Box>
              </Typography>
              <IconButton
                size="small"
                aria-label="Table actions"
                onClick={() => updateUrl({ views: 'true' })}
              >
                <MoreHoriz fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>

          {isMobile ? (
            <Stack data-testid="jobs-mobile-list" spacing={1} sx={{ p: 1.1 }}>
              {visibleJobs.length === 0 ? (
                <Stack spacing={0.75} sx={{ py: 2 }}>
                  <Typography variant="subtitle1">No jobs match this queue view</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Adjust search, filter chips, or apply a different saved view.
                  </Typography>
                </Stack>
              ) : null}
              {mobileJobs.map((job) => {
                const route = getJobRoute(job, routeGroups, routeStops);
                const selected = Boolean(job.id && selectedJobIds.includes(job.id));
                return (
                  <Box
                    key={job.id}
                    role="group"
                    aria-label={`Job ${job.id || 'record'}`}
                    sx={{
                      p: 1.25,
                      borderRadius: 1.4,
                      border: '1px solid',
                      borderColor: selected ? trovanColors.copper[500] : 'divider',
                      bgcolor: selected ? alpha(trovanColors.copper[500], 0.08) : 'background.paper',
                      boxShadow: selected ? `0 0 0 2px ${alpha(trovanColors.copper[500], 0.12)}` : 'none',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Checkbox
                        size="small"
                        inputProps={{ 'aria-label': `Select ${job.id || 'job'}` }}
                        checked={selected}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          event.stopPropagation();
                          if (!job.id) return;
                          setSelectedJobIds((current) => (
                            current.includes(job.id as string)
                              ? current.filter((id) => id !== job.id)
                              : [...current, job.id as string]
                          ));
                        }}
                        sx={{ mt: -0.5, ml: -0.5 }}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 850, lineHeight: 1.25 }}>
                          {job.customerName || 'Unassigned customer'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {job.id?.slice(0, 12) || 'Job ID pending'}
                        </Typography>
                      </Box>
                      <StatusPill
                        label={String(job.status || 'pending').replace(/_/g, ' ')}
                        tone={jobStatusTone(job.status)}
                      />
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1, fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {job.deliveryAddress || 'Delivery address pending'}
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mt: 0.9 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Window</Typography>
                        <Typography variant="body2">{formatJobWindow(job)}</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="text.secondary">Route</Typography>
                        <Typography variant="body2">{route?.label || route?.id || 'Unassigned'}</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                      <StatusPill label={job.priority || 'normal'} tone={priorityTone(job.priority)} />
                      <Button
                        size="small"
                        variant="text"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (job.id) setSelectedJobIds([job.id]);
                        }}
                      >
                        View details
                      </Button>
                    </Stack>
                  </Box>
                );
              })}
              {visibleJobs.length > mobilePageSize ? (
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 0.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={mobilePage === 1}
                    onClick={() => setMobilePage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    Page {mobilePage} of {mobilePageCount}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={mobilePage === mobilePageCount}
                    onClick={() => setMobilePage((current) => Math.min(mobilePageCount, current + 1))}
                  >
                    Next
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          ) : (
          <TableContainer sx={{ maxHeight: { lg: 'calc(100vh - 320px)' }, overflowX: 'hidden' }}>
          <Table
            stickyHeader
            size="small"
            sx={{
              width: '100%',
              tableLayout: 'fixed',
              '& .MuiTableCell-root': { px: 1 },
            }}
          >
            <TableHead
              sx={(theme) => ({
                '& .MuiTableCell-head': {
                  bgcolor:
                    theme.palette.mode === 'dark'
                      ? trovanColors.dark.surfaceAlt
                      : trovanColors.light.surfaceAlt,
                  backgroundImage: 'none',
                  color: 'text.secondary',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  boxShadow: `0 1px 0 ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.35 : 0.12)}`,
                  zIndex: theme.zIndex.appBar - 1,
                },
              })}
            >
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 38 }} />
                <TableCell sx={{ width: 82, whiteSpace: 'nowrap' }}>Job ID</TableCell>
                <TableCell sx={{ width: 132, whiteSpace: 'nowrap' }}>Customer</TableCell>
                <TableCell sx={{ width: { xs: 135, xl: 190 }, whiteSpace: 'nowrap' }}>Address</TableCell>
                <TableCell sx={{ width: 118, whiteSpace: 'nowrap' }}>Time Window</TableCell>
                <TableCell sx={{ width: 76, whiteSpace: 'nowrap' }}>Priority</TableCell>
                <TableCell sx={{ width: 84, whiteSpace: 'nowrap' }}>Status</TableCell>
                <TableCell sx={{ width: 108, whiteSpace: 'nowrap', display: { xs: 'none', xl: 'table-cell' } }}>Driver</TableCell>
                <TableCell sx={{ width: 112, whiteSpace: 'nowrap', display: { xs: 'none', xl: 'table-cell' } }}>Vehicle</TableCell>
                <TableCell sx={{ width: 76, whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>Route</TableCell>
                <TableCell sx={{ width: 76, whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>ETA</TableCell>
                <TableCell sx={{ width: 48, whiteSpace: 'nowrap' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12}>
                    <Stack spacing={0.75} sx={{ py: 2 }}>
                      <Typography variant="subtitle1">No jobs match this queue view</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Adjust search, filter chips, or apply a different saved view.
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : null}
              {visibleJobs.map((job) => {
                const route = getJobRoute(job, routeGroups, routeStops);
                const driver = getJobDriver(route, drivers);
                const vehicle = getJobVehicle(job, route, vehicles);
                const routeLabel = route?.label || route?.id || job.assignedRouteId || '—';
                const eta = formatJobEta(route, job, routeStops);

                return (
                <TableRow
                  key={job.id}
                  hover
                  selected={job.id ? selectedJobIds.includes(job.id) : false}
                  tabIndex={0}
                  aria-label={`Select job ${job.id || 'job'}`}
                  onClick={() => job.id && setSelectedJobIds([job.id])}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && job.id) {
                      event.preventDefault();
                      setSelectedJobIds([job.id]);
                    }
                  }}
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
                      size="small"
                      inputProps={{ 'aria-label': `Select ${job.id || 'job'}` }}
                      checked={job.id ? selectedJobIds.includes(job.id) : false}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        event.stopPropagation();
                        if (!job.id) return;
                        setSelectedJobIds((current) => (
                          current.includes(job.id as string)
                            ? current.filter((id) => id !== job.id)
                            : [...current, job.id as string]
                        ));
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 800 }}>
                    {job.id?.slice(0, 8) || '—'}
                  </TableCell>
                  <TableCell sx={{ overflow: 'hidden' }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {job.customerName || 'Unassigned customer'}
                    </Typography>
                    {(job.customerPhone || job.customerEmail) ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ whiteSpace: 'nowrap', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {job.customerPhone || job.customerEmail}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell sx={{ overflow: 'hidden' }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {job.deliveryAddress || 'Address pending'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {job.pickupAddress || 'Pickup pending'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatJobWindow(job)}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <StatusPill
                      label={job.priority || 'normal'}
                      tone={priorityTone(job.priority)}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <StatusPill
                      label={String(job.status || 'pending').replace(/_/g, ' ')}
                      tone={jobStatusTone(job.status)}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: { xs: 'none', xl: 'table-cell' } }}>
                    {driver ? formatPersonName(driver) : '—'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: { xs: 'none', xl: 'table-cell' } }}>
                    {vehicle ? formatVehicleName(vehicle) : '—'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: { xs: 'none', md: 'table-cell' } }}>
                    {routeLabel}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: { xs: 'none', md: 'table-cell' } }}>
                    {eta}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      aria-label={`Actions for ${job.id || 'job'}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!job.id) return;
                        setSelectedJobIds([job.id]);
                        setBannerMessage(`${job.id} selected. Review assignment, route staging, or bulk actions from this queue.`);
                      }}
                    >
                      <MoreHoriz fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
          )}
        </SurfacePanel>

        <SurfacePanel data-testid="jobs-inspector" variant="command" sx={{ p: 0, minWidth: 0, overflow: 'hidden' }}>
          {focusedJob ? (
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ px: 1.2, pt: 1.2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="h5" component="h2" sx={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {focusedJob.id?.slice(0, 8) || 'Job'}
                    </Typography>
                    <StatusPill label={String(focusedJob.status || 'pending').replace(/_/g, ' ')} tone={jobStatusTone(focusedJob.status)} />
                    <StatusPill label={readinessLabel(focusedJob)} tone={readinessTone(focusedJob)} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {readinessLabel(focusedJob)}
                  </Typography>
                </Box>
                <StatusPill label="Selected job" tone="accent" />
              </Stack>

              <Box sx={{ px: 1.2 }}>
                <JobMiniMap job={focusedJob} />
              </Box>

              <Stack spacing={1.1} sx={{ px: 1.2, pb: 1.2 }}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">Customer</Typography>
                    <Button
                      size="small"
                      variant="text"
                      disabled={!focusedCustomer?.id}
                      onClick={() => focusedCustomer?.id && navigate(`/customers?customerId=${encodeURIComponent(focusedCustomer.id)}`)}
                    >
                      View customer
                    </Button>
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {focusedCustomer?.name || focusedJob.customerName || 'Unassigned customer'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {focusedCustomer?.phone || focusedJob.customerPhone || 'Phone pending'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                    {focusedCustomer?.email || focusedJob.customerEmail || 'Email pending'}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2">Address</Typography>
                  <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 700 }}>
                    {focusedJob.deliveryAddress || 'Delivery address pending'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pickup: {focusedJob.pickupAddress || 'Not set'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <SurfacePanel variant="muted" padding={1}>
                    <Typography variant="subtitle2">Service Details</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Service type
                    </Typography>
                    <Typography variant="body2">Delivery</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                      Capacity needed
                    </Typography>
                    <Typography variant="body2">{formatLoadSummary(focusedJob)}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                      Promised window
                    </Typography>
                    <Typography variant="body2">{formatJobWindow(focusedJob)}</Typography>
                  </SurfacePanel>

                  <SurfacePanel variant="muted" padding={1}>
                    <Typography variant="subtitle2">Notes</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Service notes
                    </Typography>
                    <Typography variant="body2">
                      {focusedJob.routingRequirements?.site?.accessNotes || focusedCustomer?.notes || 'No site notes recorded'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                      Special instructions
                    </Typography>
                    <Typography variant="body2">
                      {formatReasonCodes(focusedJob)}
                    </Typography>
                  </SurfacePanel>
                </Box>

                <SurfacePanel variant="muted" padding={1}>
                  <Typography variant="subtitle2">Proof of Delivery</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.75 }}>
                    <StatusPill label="Required" tone="success" />
                    <StatusPill label="Photo" />
                    <StatusPill label="Signature" />
                  </Stack>
                </SurfacePanel>

                <SurfacePanel variant="muted" padding={1}>
                  <Typography variant="subtitle2">Assignment</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.85 }}>
                    <TextField
                      size="small"
                      label="Driver"
                      value={focusedDriver ? formatPersonName(focusedDriver) : 'Unassigned'}
                      InputProps={{ readOnly: true }}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Vehicle"
                      value={focusedVehicle ? formatVehicleName(focusedVehicle) : 'Unassigned'}
                      InputProps={{ readOnly: true }}
                      fullWidth
                    />
                  </Stack>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{ mt: 1 }}
                    onClick={() => focusedJob.id && navigate(`/routing?jobId=${encodeURIComponent(focusedJob.id)}`)}
                  >
                    Update Assignment
                  </Button>
                </SurfacePanel>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ p: 1.5 }}>
              <Typography variant="subtitle1">No job selected</Typography>
              <Typography variant="body2" color="text.secondary">
                Select a row to review customer, service, POD, and assignment details.
              </Typography>
            </Stack>
          )}
        </SurfacePanel>
      </Box>

      {selectedJobIds.length > 0 ? (
        <SurfacePanel
          data-testid="jobs-bulk-bar"
          variant="command"
          sx={{
            position: 'sticky',
            bottom: 12,
            zIndex: theme.zIndex.appBar - 1,
            px: 1.2,
            py: 1,
            boxShadow: `0 18px 44px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.44 : 0.18)}`,
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ lg: 'center' }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {selectedJobIds.length} jobs selected
              </Typography>
              <Button size="small" variant="text" onClick={() => setSelectedJobIds([])}>
                Clear selection
              </Button>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button variant="outlined" startIcon={<Groups2Outlined />} onClick={handleOptimizeSelected}>
                Batch Assign
              </Button>
              <Button variant="outlined" startIcon={<ArchiveOutlined />} onClick={() => void handleArchive()}>
                Archive
              </Button>
              <Button variant="outlined" onClick={handleExport}>
                Export
              </Button>
              <Button variant="outlined" color="error" startIcon={<BlockOutlined />} onClick={() => void handleCancelSelected()}>
                Cancel Jobs
              </Button>
            </Stack>
          </Stack>
        </SurfacePanel>
      ) : null}

      <Dialog open={dialogOpen} onClose={() => { setCreateError(null); updateUrl({ create: null }); }} fullWidth maxWidth="md">
        <DialogTitle>Create Job</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          {createError ? <Alert severity="error">{createError}</Alert> : null}
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
          <TextField label="Pickup address" value={formData.pickupAddress} onChange={(event) => setFormData((current) => ({ ...current, pickupAddress: event.target.value }))} />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              label="Window start"
              type="datetime-local"
              value={formData.timeWindowStart}
              onChange={(event) => setFormData((current) => ({ ...current, timeWindowStart: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Window end"
              type="datetime-local"
              value={formData.timeWindowEnd}
              onChange={(event) => setFormData((current) => ({ ...current, timeWindowEnd: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Service minutes"
              type="number"
              value={formData.estimatedDuration}
              onChange={(event) => setFormData((current) => ({ ...current, estimatedDuration: event.target.value }))}
              fullWidth
            />
          </Stack>
          <Divider />
          <Typography variant="subtitle2">Load fit</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField label="Pallet count" type="number" value={formData.palletCount} onChange={(event) => setFormData((current) => ({ ...current, palletCount: event.target.value }))} fullWidth />
            <TextField label="Length in" type="number" value={formData.palletLengthIn} onChange={(event) => setFormData((current) => ({ ...current, palletLengthIn: event.target.value }))} fullWidth />
            <TextField label="Width in" type="number" value={formData.palletWidthIn} onChange={(event) => setFormData((current) => ({ ...current, palletWidthIn: event.target.value }))} fullWidth />
            <TextField label="Height in" type="number" value={formData.palletHeightIn} onChange={(event) => setFormData((current) => ({ ...current, palletHeightIn: event.target.value }))} fullWidth />
            <TextField label="Weight each lb" type="number" value={formData.palletWeightLb} onChange={(event) => setFormData((current) => ({ ...current, palletWeightLb: event.target.value }))} fullWidth />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <FormControlLabel
              control={<Checkbox checked={formData.stackable} onChange={(event) => setFormData((current) => ({ ...current, stackable: event.target.checked }))} />}
              label="Stackable"
            />
            <TextField label="Required equipment" value={formData.requiredEquipment} placeholder="liftgate, reefer" onChange={(event) => setFormData((current) => ({ ...current, requiredEquipment: event.target.value }))} fullWidth />
            <TextField label="Specific driver" value={formData.requiredDriverName} onChange={(event) => setFormData((current) => ({ ...current, requiredDriverName: event.target.value }))} fullWidth />
          </Stack>
          <Divider />
          <Typography variant="subtitle2">Site and handling</Typography>
          <TextField label="Site/access rules" multiline minRows={2} value={formData.siteAccessNotes} onChange={(event) => setFormData((current) => ({ ...current, siteAccessNotes: event.target.value }))} />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <FormControlLabel
              control={<Checkbox checked={formData.dockAppointment} onChange={(event) => setFormData((current) => ({ ...current, dockAppointment: event.target.checked }))} />}
              label="Dock appointment"
            />
            <FormControlLabel
              control={<Checkbox checked={formData.liftgateRequired} onChange={(event) => setFormData((current) => ({ ...current, liftgateRequired: event.target.checked }))} />}
              label="Liftgate"
            />
            <FormControlLabel
              control={<Checkbox checked={formData.insideDelivery} onChange={(event) => setFormData((current) => ({ ...current, insideDelivery: event.target.checked }))} />}
              label="Inside delivery"
            />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField label="Temperature" value={formData.temperatureRequirement} placeholder="ambient, refrigerated, frozen" onChange={(event) => setFormData((current) => ({ ...current, temperatureRequirement: event.target.value }))} fullWidth />
            <TextField label="Hazmat class" value={formData.hazmatClass} onChange={(event) => setFormData((current) => ({ ...current, hazmatClass: event.target.value }))} fullWidth />
            <TextField label="Handling" value={formData.handlingRequirement} placeholder="non-stackable, fragile" onChange={(event) => setFormData((current) => ({ ...current, handlingRequirement: event.target.value }))} fullWidth />
          </Stack>
          <TextField select label="Priority" value={formData.priority} onChange={(event) => setFormData((current) => ({ ...current, priority: event.target.value }))}>
            <MenuItem value="normal">Normal</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="urgent">Urgent</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateError(null); updateUrl({ create: null }); }}>Cancel</Button>
          <Button variant="contained" disabled={createJobMutation.isPending} onClick={() => void handleSubmit()}>
            {createJobMutation.isPending ? 'Creating…' : 'Create Job'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialogOpen} onClose={() => updateUrl({ import: null })} fullWidth maxWidth="md">
        <DialogTitle>Import Jobs</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <Alert severity="info">
            Import JSON arrays or CSV files with customerName, deliveryAddress, priority, status, pickupAddress, timeWindowStart, timeWindowEnd, serviceDuration, palletCount, pallet dimensions, palletWeightLb, stackable, requiredEquipment, requiredDriver, siteAccess, temperature, hazmat, and handling columns.
          </Alert>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>Choose file</Button>
            <Typography variant="body2" color="text.secondary">
              {importFileName ? `${importFileName} • ${importCandidates.length} rows ready` : 'No file selected yet.'}
            </Typography>
          </Stack>
          {importError ? <Alert severity="error">{importError}</Alert> : null}
          {importCandidates.length > 0 ? (
            <SurfacePanel sx={{ bgcolor: 'rgba(30, 26, 23, 1)' }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Preview</Typography>
              <Stack spacing={1}>
                {importCandidates.slice(0, 5).map((candidate, index) => (
                  <Box key={`${candidate.customerName}-${candidate.deliveryAddress}-${index}`}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{candidate.customerName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {candidate.deliveryAddress} • {candidate.priority} • {candidate.status} • {candidate.routingRequirements?.load?.palletCount || 0} pallets
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

      <Dialog open={moreFiltersOpen} onClose={() => setMoreFiltersOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>More Filters</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField
            select
            label="Service Type"
            value={serviceTypeFilter}
            onChange={(event) => setServiceTypeFilter(event.target.value as ServiceTypeFilter)}
            fullWidth
          >
            <MenuItem value="all">All service types</MenuItem>
            <MenuItem value="delivery">Delivery</MenuItem>
            <MenuItem value="special">Special handling</MenuItem>
          </TextField>
          <TextField
            select
            label="Time Window"
            value={timeWindowFilter}
            onChange={(event) => setTimeWindowFilter(event.target.value as TimeWindowFilter)}
            fullWidth
          >
            <MenuItem value="all">All time windows</MenuItem>
            <MenuItem value="set">Window set</MenuItem>
            <MenuItem value="missing">Missing window</MenuItem>
          </TextField>
          <TextField
            select
            label="Assignment"
            value={assignmentFilter}
            onChange={(event) => updateQueueParams({ assignment: event.target.value as AssignmentFilter })}
            fullWidth
          >
            <MenuItem value="all">All jobs</MenuItem>
            <MenuItem value="assigned">Assigned</MenuItem>
            <MenuItem value="unassigned">Unassigned</MenuItem>
          </TextField>
          <Alert severity="info">
            These filters operate on the live jobs query and route-derived assignment data. They do not create a separate static queue.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setServiceTypeFilter('all');
              setTimeWindowFilter('all');
              updateQueueParams({ assignment: 'all' });
            }}
          >
            Clear advanced filters
          </Button>
          <Button variant="contained" onClick={() => setMoreFiltersOpen(false)}>
            Apply
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
