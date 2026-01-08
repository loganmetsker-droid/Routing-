import { useState } from 'react';
import { Box, Paper, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQuery, gql } from '@apollo/client';

const GET_JOB_HISTORY = gql`
  query JobHistory($start: DateTime!, $end: DateTime!) {
    jobHistory(start: $start, end: $end) {
      id
      customerName
      startDate
      endDate
      status
      billingStatus
      priority
      pickupAddress
      deliveryAddress
      notes
    }
  }
`;

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    status: string;
    billingStatus: string;
    priority: string;
    pickupAddress: string;
    deliveryAddress: string;
    notes?: string;
  };
}

const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    unscheduled: '#9e9e9e',
    scheduled: '#2196f3',
    in_progress: '#ff9800',
    completed: '#4caf50',
    archived: '#607d8b',
    cancelled: '#f44336',
    failed: '#d32f2f',
  };
  return colorMap[status] || '#9e9e9e';
};

const getBillingBorderColor = (billingStatus: string): string => {
  return billingStatus === 'paid' ? '#4caf50' : '#f44336';
};

export default function CalendarView() {
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [dateRange, setDateRange] = useState(() => {
    const start = new Date();
    start.setDate(1); // First day of current month
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0); // Last day of current month
    return { start, end };
  });

  const { data } = useQuery(GET_JOB_HISTORY, {
    variables: {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    },
  });

  const events: CalendarEvent[] = (data?.jobHistory || []).map((job: any) => ({
    id: job.id,
    title: job.customerName || 'Untitled Job',
    start: job.startDate,
    end: job.endDate,
    backgroundColor: getStatusColor(job.status),
    borderColor: getBillingBorderColor(job.billingStatus),
    extendedProps: {
      status: job.status,
      billingStatus: job.billingStatus,
      priority: job.priority,
      pickupAddress: job.pickupAddress,
      deliveryAddress: job.deliveryAddress,
      notes: job.notes,
    },
  }));

  const handleViewChange = (_event: React.MouseEvent<HTMLElement>, newView: 'month' | 'week' | 'day' | null) => {
    if (newView) {
      setView(newView);
    }
  };

  const handleDatesSet = (dateInfo: any) => {
    setDateRange({
      start: dateInfo.start,
      end: dateInfo.end,
    });
  };

  const handleEventClick = (info: any) => {
    const props = info.event.extendedProps;
    alert(
      `Job: ${info.event.title}\n` +
      `Status: ${props.status}\n` +
      `Billing: ${props.billingStatus}\n` +
      `Priority: ${props.priority}\n` +
      `Pickup: ${props.pickupAddress}\n` +
      `Delivery: ${props.deliveryAddress}\n` +
      `Notes: ${props.notes || 'None'}`
    );
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          Job Calendar
        </Typography>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={handleViewChange}
          size="small"
        >
          <ToggleButton value="month">Month</ToggleButton>
          <ToggleButton value="week">Week</ToggleButton>
          <ToggleButton value="day">Day</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={view === 'month' ? 'dayGridMonth' : view === 'week' ? 'timeGridWeek' : 'timeGridDay'}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: '',
        }}
        events={events}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        height="auto"
        editable={false}
        selectable={false}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          meridiem: false,
        }}
      />

      <Box sx={{ mt: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" fontWeight={600}>Status:</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: '#9e9e9e', borderRadius: 0.5 }} />
              <Typography variant="caption">Unscheduled</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: '#2196f3', borderRadius: 0.5 }} />
              <Typography variant="caption">Scheduled</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: '#ff9800', borderRadius: 0.5 }} />
              <Typography variant="caption">In Progress</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: '#4caf50', borderRadius: 0.5 }} />
              <Typography variant="caption">Completed</Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" fontWeight={600}>Billing:</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, border: '2px solid #f44336', borderRadius: 0.5 }} />
              <Typography variant="caption">Unpaid</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, border: '2px solid #4caf50', borderRadius: 0.5 }} />
              <Typography variant="caption">Paid</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
