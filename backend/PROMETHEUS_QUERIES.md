# Prometheus Metrics & Grafana Setup

## Overview
This document contains all Prometheus query strings, metric definitions, and Grafana dashboard configuration for the Fleet Management System.

## Prometheus Endpoint
- **URL**: `http://localhost:3000/metrics`
- **Auth**: Public endpoint (no authentication required)
- **Format**: Prometheus exposition format
- **Scrape Interval**: Recommended 15-30s

## Metric Definitions

### 1. Fleet Average Distance Per Vehicle (24h)
**Metric Name**: `fleet_avg_distance_per_vehicle_km`
**Type**: Gauge
**Unit**: Kilometers
**Labels**:
- `vehicle_id` - Unique vehicle identifier
- `vehicle_type` - Type of vehicle (van, truck, motorcycle, car, semi_truck)

**Description**: Average distance traveled per vehicle in the last 24 hours, calculated from odometer readings in the telemetry table.

**Prometheus Queries**:

```promql
# Current distance per vehicle
fleet_avg_distance_per_vehicle_km

# Average across all vehicles
avg(fleet_avg_distance_per_vehicle_km)

# Distance by vehicle type
avg by(vehicle_type) (fleet_avg_distance_per_vehicle_km)

# Total distance by vehicle type
sum by(vehicle_type) (fleet_avg_distance_per_vehicle_km)

# Top 5 vehicles by distance
topk(5, fleet_avg_distance_per_vehicle_km)

# Vehicles with distance over 200km
fleet_avg_distance_per_vehicle_km > 200

# Rate of change (trend)
rate(fleet_avg_distance_per_vehicle_km[5m])
```

**TimescaleDB Query** (used internally):
```sql
WITH vehicle_distance AS (
  SELECT
    t.vehicle_id,
    v.vehicle_type,
    COALESCE(MAX(t.odometer) - MIN(t.odometer), 0) AS distance_km
  FROM telemetry t
  INNER JOIN vehicles v ON v.id = t.vehicle_id
  WHERE t.timestamp >= NOW() - INTERVAL '24 hours'
  GROUP BY t.vehicle_id, v.vehicle_type
)
SELECT
  vehicle_id,
  vehicle_type,
  distance_km
FROM vehicle_distance
WHERE distance_km > 0
```

---

### 2. Fuel Consumption Trend (L/100km)
**Metric Name**: `fleet_fuel_consumption_liters_per_100km`
**Type**: Gauge
**Unit**: Liters per 100 kilometers
**Labels**:
- `vehicle_id` - Unique vehicle identifier
- `fuel_type` - Type of fuel (diesel, gasoline, electric, hybrid, cng)

**Description**: Fuel consumption efficiency calculated from fuel level changes and distance traveled in the last 24 hours.

**Prometheus Queries**:

```promql
# Current fuel consumption per vehicle
fleet_fuel_consumption_liters_per_100km

# Fleet average fuel consumption
avg(fleet_fuel_consumption_liters_per_100km)

# Fuel consumption by fuel type
avg by(fuel_type) (fleet_fuel_consumption_liters_per_100km)

# Vehicles with high consumption (>20 L/100km)
fleet_fuel_consumption_liters_per_100km > 20

# Most efficient vehicles (lowest consumption)
bottomk(5, fleet_fuel_consumption_liters_per_100km)

# Least efficient vehicles (highest consumption)
topk(5, fleet_fuel_consumption_liters_per_100km)

# Consumption trend over time
deriv(fleet_fuel_consumption_liters_per_100km[1h])
```

**TimescaleDB Query** (used internally):
```sql
WITH fuel_data AS (
  SELECT
    t.vehicle_id,
    v.fuel_type,
    MAX(t.odometer) - MIN(t.odometer) AS distance_km,
    (
      SELECT t1.fuel_level
      FROM telemetry t1
      WHERE t1.vehicle_id = t.vehicle_id
        AND t1.timestamp >= NOW() - INTERVAL '24 hours'
      ORDER BY t1.timestamp ASC
      LIMIT 1
    ) AS initial_fuel,
    (
      SELECT t2.fuel_level
      FROM telemetry t2
      WHERE t2.vehicle_id = t.vehicle_id
        AND t2.timestamp >= NOW() - INTERVAL '24 hours'
      ORDER BY t2.timestamp DESC
      LIMIT 1
    ) AS final_fuel
  FROM telemetry t
  INNER JOIN vehicles v ON v.id = t.vehicle_id
  WHERE t.timestamp >= NOW() - INTERVAL '24 hours'
    AND t.fuel_level IS NOT NULL
  GROUP BY t.vehicle_id, v.fuel_type
)
SELECT
  vehicle_id,
  fuel_type,
  CASE
    WHEN distance_km > 0 AND initial_fuel > final_fuel
    THEN ((initial_fuel - final_fuel) / distance_km) * 100
    ELSE 0
  END AS fuel_consumption_per_100km
FROM fuel_data
WHERE distance_km > 0
```

---

### 3. On-Time Delivery Rate (24h)
**Metric Name**: `fleet_ontime_delivery_rate_percent`
**Type**: Gauge
**Unit**: Percentage (0-100)
**Labels**: None

**Description**: Percentage of shifts completed on time (before or at scheduled end time) in the last 24 hours.

**Prometheus Queries**:

```promql
# Current on-time rate
fleet_ontime_delivery_rate_percent

# Alert if rate drops below 90%
fleet_ontime_delivery_rate_percent < 90

# Alert if rate drops below 80% (critical)
fleet_ontime_delivery_rate_percent < 80

# Rate of change (improving or declining)
deriv(fleet_ontime_delivery_rate_percent[1h])

# Historical trend (last 7 days)
avg_over_time(fleet_ontime_delivery_rate_percent[7d])
```

**TimescaleDB Query** (used internally):
```sql
WITH shift_performance AS (
  SELECT
    COUNT(*) AS total_shifts,
    COUNT(*) FILTER (
      WHERE status = 'completed'
      AND completed_at <= scheduled_end_time
    ) AS ontime_shifts
  FROM shifts
  WHERE completed_at >= NOW() - INTERVAL '24 hours'
    AND status = 'completed'
)
SELECT
  CASE
    WHEN total_shifts > 0
    THEN (ontime_shifts::NUMERIC / total_shifts::NUMERIC) * 100
    ELSE 0
  END AS ontime_rate_percent
FROM shift_performance
```

---

### 4. Active Vehicles Count
**Metric Name**: `fleet_active_vehicles_count`
**Type**: Gauge
**Unit**: Count
**Labels**:
- `status` - Vehicle status (available, in_use, maintenance, out_of_service, retired)

**Description**: Number of vehicles grouped by their current operational status.

**Prometheus Queries**:

```promql
# Vehicles by status
fleet_active_vehicles_count

# Total active vehicles (in_use + available)
sum(fleet_active_vehicles_count{status=~"in_use|available"})

# Vehicles in maintenance
fleet_active_vehicles_count{status="maintenance"}

# Utilization rate (in_use / total available)
(
  fleet_active_vehicles_count{status="in_use"} /
  sum(fleet_active_vehicles_count{status=~"in_use|available"})
) * 100

# Alert if too many vehicles in maintenance (>20%)
(
  fleet_active_vehicles_count{status="maintenance"} /
  sum(fleet_active_vehicles_count)
) * 100 > 20
```

---

### 5. Total Fleet Size
**Metric Name**: `fleet_total_vehicles_count`
**Type**: Gauge
**Unit**: Count
**Labels**: None

**Description**: Total number of vehicles in the fleet database.

**Prometheus Queries**:

```promql
# Total fleet size
fleet_total_vehicles_count

# Change in fleet size over time
delta(fleet_total_vehicles_count[7d])
```

---

## Default Node.js Metrics

The exporter also exposes standard Node.js process metrics:

```promql
# Process CPU usage
process_cpu_user_seconds_total
process_cpu_system_seconds_total

# Memory usage
process_resident_memory_bytes
process_heap_bytes

# Event loop lag (important for performance monitoring)
nodejs_eventloop_lag_seconds
nodejs_eventloop_lag_p99_seconds

# Active handles and requests
nodejs_active_handles_total
nodejs_active_requests_total

# Garbage collection
nodejs_gc_duration_seconds
```

---

## Prometheus Configuration

Add this to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'fleet-management-backend'
    scrape_interval: 30s
    scrape_timeout: 10s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['localhost:3000']
        labels:
          service: 'fleet-management'
          environment: 'production'
```

---

## Grafana Dashboard Import

1. **Import the dashboard**:
   - Go to Grafana UI → Dashboards → Import
   - Upload `grafana-dashboard.json`
   - Select your Prometheus data source

2. **Configure Prometheus data source**:
   - Go to Configuration → Data Sources → Add data source
   - Select Prometheus
   - URL: `http://localhost:9090` (or your Prometheus server)
   - Save & Test

3. **Dashboard includes**:
   - Average distance per vehicle (time series)
   - Fleet average distance (gauge)
   - Fuel consumption trend (time series with thresholds)
   - On-time delivery rate (gauge with color thresholds)
   - Vehicle status distribution (pie chart)
   - Total fleet size (stat panel)
   - Total distance by vehicle type (bar chart)

---

## Alert Rules (Recommended)

Create `alerts.yml` for Prometheus Alertmanager:

```yaml
groups:
  - name: fleet_alerts
    interval: 1m
    rules:
      - alert: LowOnTimeRate
        expr: fleet_ontime_delivery_rate_percent < 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "On-time delivery rate below 85%"
          description: "Current rate: {{ $value }}%"

      - alert: CriticalOnTimeRate
        expr: fleet_ontime_delivery_rate_percent < 75
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "CRITICAL: On-time rate below 75%"
          description: "Current rate: {{ $value }}%"

      - alert: HighFuelConsumption
        expr: fleet_fuel_consumption_liters_per_100km > 30
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Vehicle {{ $labels.vehicle_id }} has high fuel consumption"
          description: "{{ $value }} L/100km for vehicle {{ $labels.vehicle_id }}"

      - alert: TooManyVehiclesInMaintenance
        expr: (fleet_active_vehicles_count{status="maintenance"} / sum(fleet_active_vehicles_count)) * 100 > 25
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "More than 25% of fleet in maintenance"
          description: "{{ $value }}% of fleet is in maintenance status"

      - alert: LowVehicleUtilization
        expr: (fleet_active_vehicles_count{status="in_use"} / sum(fleet_active_vehicles_count{status=~"in_use|available"})) * 100 < 50
        for: 30m
        labels:
          severity: info
        annotations:
          summary: "Low vehicle utilization rate"
          description: "Only {{ $value }}% of available vehicles are in use"
```

---

## Testing the Metrics Endpoint

```bash
# Check if metrics endpoint is working
curl http://localhost:3000/metrics

# Filter for custom metrics only
curl http://localhost:3000/metrics | grep fleet_

# Check specific metric
curl http://localhost:3000/metrics | grep fleet_avg_distance

# Validate Prometheus format
promtool check metrics < <(curl -s http://localhost:3000/metrics)
```

---

## Performance Considerations

1. **Query Optimization**: All TimescaleDB queries use:
   - Proper indexes (vehicle_id, timestamp)
   - Continuous aggregates where applicable
   - Limited time windows (24h default)

2. **Scrape Interval**: Recommended 30s
   - Metrics are computed on-demand
   - TimescaleDB continuous aggregates are pre-computed
   - Query execution time: ~50-200ms per metric

3. **Cardinality**:
   - Vehicle-level labels: ~N vehicles
   - Total unique series: ~(N vehicles × 2 metrics) + 3 global metrics
   - For 100 vehicles: ~203 time series

4. **Resource Usage**:
   - Memory: ~10MB for metrics registry
   - CPU: Negligible (queries cached by TimescaleDB)
   - Network: ~5-10KB per scrape

---

## Extending Metrics

To add new metrics, edit `metrics.service.ts`:

```typescript
// 1. Define the metric in constructor
this.customMetric = new Gauge({
  name: 'fleet_custom_metric',
  help: 'Description of metric',
  labelNames: ['label1', 'label2'],
  registers: [this.register],
});

// 2. Create update method
private async updateCustomMetric(): Promise<void> {
  const query = `SELECT ...`;
  const results = await this.repository.query(query);

  this.customMetric.reset();
  for (const row of results) {
    this.customMetric.set({ label1: row.value1 }, row.metric);
  }
}

// 3. Add to updateMetrics()
await Promise.all([
  // ...existing metrics
  this.updateCustomMetric(),
]);
```

---

## Troubleshooting

### Metrics endpoint returns 404
- Ensure MetricsModule is registered in app.module.ts
- Check NestJS server is running on port 3000
- Verify @Public() decorator is applied

### No data in Grafana
- Check Prometheus is scraping: `http://localhost:9090/targets`
- Verify data source configuration in Grafana
- Check Prometheus logs for scrape errors

### Metrics show 0 or NaN
- Ensure TimescaleDB migrations have run (V1 and V2)
- Check telemetry data exists: `SELECT COUNT(*) FROM telemetry`
- Verify time windows: data should exist in last 24h

### High query latency
- Check database indexes: `\d+ telemetry`
- Verify continuous aggregates are enabled
- Consider reducing time window from 24h to 12h or 6h

---

## Next Steps

1. Set up Prometheus server
2. Configure scraping for the `/metrics` endpoint
3. Import Grafana dashboard
4. Set up alert rules in Alertmanager
5. Configure notification channels (Slack, PagerDuty, email)
6. Add custom metrics as needed
