import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    CircularProgress,
    Chip,
    Card,
    CardContent,
    Stack,
} from '@mui/material';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { AutoAwesome, Save, Refresh } from '@mui/icons-material';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getJobs, getVehicles, generateGlobalRoute, updateJob, connectSSE } from '../services/api';

const ROUTE_COLORS = [
    '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94', '#95E1D3',
    '#F38181', '#7FDBFF', '#B4A7D6', '#FFD93D', '#6BCF7F', '#FF9F1C',
];

export default function RoutingGlobalPage() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState(false);

    // Lanes logic: "unassigned" + one lane per vehicle
    const [columns, setColumns] = useState<Record<string, any[]>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [jobsData, vehiclesData] = await Promise.all([
                getJobs(),
                getVehicles(),
            ]);

            setJobs(jobsData || []);
            const activeVehicles = (vehiclesData || []).filter(v => v.status === 'ACTIVE' || v.status === 'active' || v.status === 'AVAILABLE');
            setVehicles(activeVehicles);

            buildColumns(jobsData || [], activeVehicles);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const buildColumns = (allJobs: any[], activeVehicles: any[]) => {
        const cols: Record<string, any[]> = {
            unassigned: allJobs.filter(j => j.status === 'pending' && !j.assignedVehicleId),
        };

        activeVehicles.forEach(v => {
            cols[v.id] = allJobs.filter(j => j.assignedVehicleId === v.id).sort((a, b) => (a.stopSequence || 0) - (b.stopSequence || 0));
        });

        setColumns(cols);
    };

    const handleAutoRoute = async () => {
        const unassignedJobIds = columns['unassigned'].map(j => j.id);
        const vehicleIds = vehicles.map(v => v.id);

        if (unassignedJobIds.length === 0) {
            alert("No unassigned jobs to route!");
            return;
        }

        if (vehicleIds.length === 0) {
            alert("No active vehicles available for routing!");
            return;
        }

        setOptimizing(true);
        try {
            const resultRoutes = await generateGlobalRoute(vehicleIds, unassignedJobIds);
            setRoutes(resultRoutes);
            await loadData(); // reload jobs to get new assignments
        } catch (e) {
            console.error(e);
            alert("Global Auto Routing failed.");
        } finally {
            setOptimizing(false);
        }
    };

    const onDragEnd = async (result: DropResult) => {
        const { source, destination, draggableId } = result;

        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        const sourceCol = [...columns[source.droppableId]];
        const destCol = source.droppableId === destination.droppableId ? sourceCol : [...columns[destination.droppableId]];

        const [removed] = sourceCol.splice(source.index, 1);
        destCol.splice(destination.index, 0, removed);

        setColumns(prev => ({
            ...prev,
            [source.droppableId]: sourceCol,
            [destination.droppableId]: destCol,
        }));

        // Update backend asynchronously
        try {
            const vehicleId = destination.droppableId === 'unassigned' ? null : destination.droppableId;
            await updateJob(draggableId, {
                assignedVehicleId: vehicleId,
                stopSequence: destination.index,
                status: vehicleId ? 'assigned' : 'pending'
            });

            // Update sequences for all affected items in destination
            destCol.forEach((item, index) => {
                if (item.id !== draggableId) {
                    updateJob(item.id, { stopSequence: index });
                }
            });

        } catch (e) {
            console.error('Failed to update job assignment', e);
            loadData(); // Revert on failure
        }
    };

    if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;

    return (
        <Box sx={{ p: 3, bgcolor: '#0D1117', minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" color="#fff" fontWeight="bold">Global Auto-Routing</Typography>
                <Stack direction="row" spacing={2}>
                    <Button variant="outlined" onClick={loadData} startIcon={<Refresh />} sx={{ color: '#fff' }}>Refresh</Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleAutoRoute}
                        disabled={optimizing || columns['unassigned']?.length === 0}
                        startIcon={optimizing ? <CircularProgress size={20} /> : <AutoAwesome />}
                    >
                        {optimizing ? 'Optimizing...' : 'Auto-Route Unassigned'}
                    </Button>
                </Stack>
            </Box>

            {/* Map visualization area (Mocked logic for paths since locations are text in this demo) */}
            <Paper sx={{ mb: 4, height: 300, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                <MapContainer center={[39.0997, -94.5786]} zoom={10} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {/* We would draw polylines here if we had lat/lngs from the backend routing result */}
                </MapContainer>
            </Paper>

            <DragDropContext onDragEnd={onDragEnd}>
                <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
                    {/* Unassigned Lane */}
                    <Droppable droppableId="unassigned">
                        {(provided) => (
                            <Box
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                sx={{
                                    minWidth: 320,
                                    bgcolor: 'rgba(255,255,255,0.03)',
                                    p: 2,
                                    borderRadius: 2,
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                <Typography variant="h6" color="#fff" mb={2}>
                                    Unassigned ({columns['unassigned']?.length || 0})
                                </Typography>
                                <Stack spacing={1} sx={{ minHeight: 100 }}>
                                    {columns['unassigned']?.map((job, index) => (
                                        <Draggable key={job.id} draggableId={job.id} index={index}>
                                            {(provided, snapshot) => (
                                                <Card
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    sx={{
                                                        bgcolor: snapshot.isDragging ? '#2196F3' : 'rgba(255,255,255,0.08)',
                                                        color: '#fff',
                                                        border: '1px solid',
                                                        borderColor: snapshot.isDragging ? '#64B5F6' : 'transparent',
                                                    }}
                                                >
                                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                                        <Typography variant="subtitle2" fontWeight="bold">{job.customerName}</Typography>
                                                        <Typography variant="caption" color="rgba(255,255,255,0.7)">{job.deliveryAddress}</Typography>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </Stack>
                            </Box>
                        )}
                    </Droppable>

                    {/* Vehicle Lanes */}
                    {vehicles.map((v, i) => (
                        <Droppable key={v.id} droppableId={v.id}>
                            {(provided, snapshot) => (
                                <Box
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    sx={{
                                        minWidth: 320,
                                        bgcolor: snapshot.isDraggingOver ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255,255,255,0.03)',
                                        p: 2,
                                        borderRadius: 2,
                                        border: '1px solid',
                                        borderColor: ROUTE_COLORS[i % ROUTE_COLORS.length],
                                    }}
                                >
                                    <Typography variant="h6" color="#fff" mb={2}>
                                        {v.make} {v.model} ({columns[v.id]?.length || 0})
                                    </Typography>
                                    <Stack spacing={1} sx={{ minHeight: 100 }}>
                                        {columns[v.id]?.map((job, index) => (
                                            <Draggable key={job.id} draggableId={job.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <Card
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        sx={{
                                                            bgcolor: snapshot.isDragging ? '#2196F3' : 'rgba(255,255,255,0.08)',
                                                            color: '#fff',
                                                        }}
                                                    >
                                                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                                            <Box display="flex" justifyContent="space-between">
                                                                <Typography variant="subtitle2" fontWeight="bold">{job.customerName}</Typography>
                                                                <Chip size="small" label={`Stop ${index + 1}`} sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                                                            </Box>
                                                            <Typography variant="caption" color="rgba(255,255,255,0.7)">{job.deliveryAddress}</Typography>
                                                        </CardContent>
                                                    </Card>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </Stack>
                                </Box>
                            )}
                        </Droppable>
                    ))}
                </Box>
            </DragDropContext>
        </Box>
    );
}
