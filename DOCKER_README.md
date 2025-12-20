# Docker Setup Guide

This guide explains how to run the Routing & Dispatch SaaS application using Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose V2
- At least 4GB RAM available
- 10GB free disk space

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/routing-dispatch-saas
cd routing-dispatch-saas

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor
```

### 2. Configure Environment Variables

Update the `.env` file with your values:

```bash
# Database
POSTGRES_PASSWORD=your_secure_password

# Redis
REDIS_PASSWORD=your_redis_password

# JWT
JWT_SECRET=generate_a_random_secret_key

# Stripe (from your Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

### 3. Start the Stack

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Check service status
docker compose ps
```

### 4. Access the Application

Once all services are healthy:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **GraphQL Playground**: http://localhost:3000/graphql
- **API Health**: http://localhost:3000/health

## Services

### PostgreSQL + TimescaleDB
- **Port**: 5432
- **Database**: routing_dispatch
- **Features**: Time-series data, geospatial support
- **Data**: Persisted in `postgres_data` volume

### Redis
- **Port**: 6379
- **Usage**: Caching, job queues (Bull)
- **Data**: Persisted in `redis_data` volume

### Backend (NestJS)
- **Port**: 3000
- **Hot Reload**: Enabled in development
- **Logs**: Available in `backend_logs` volume

### Routing Service (OSRM)
- **Port**: 8080
- **Engine**: OSRM (Open Source Routing Machine)
- **Data**: Map data in `./routing-data`

### Frontend (React + Vite)
- **Port**: 5173
- **Hot Reload**: Enabled in development
- **Proxy**: API calls proxied to backend

### Nginx (Production only)
- **Ports**: 80 (HTTP), 443 (HTTPS)
- **Profile**: `production`
- **SSL**: Configure in `./nginx/ssl`

## Development Workflow

### Start Development Environment

```bash
# Start all services in development mode
docker compose up -d

# Follow backend logs
docker compose logs -f backend

# Follow frontend logs
docker compose logs -f frontend
```

### Rebuild After Code Changes

```bash
# Rebuild a specific service
docker compose build backend

# Rebuild and restart
docker compose up -d --build backend
```

### Database Operations

```bash
# Access PostgreSQL
docker compose exec postgres psql -U postgres -d routing_dispatch

# Run migrations
docker compose exec backend npm run migration:run

# Reset database
docker compose exec backend npm run schema:drop
docker compose exec backend npm run schema:sync
```

### Redis Operations

```bash
# Access Redis CLI
docker compose exec redis redis-cli -a your_redis_password

# Clear cache
docker compose exec redis redis-cli -a your_redis_password FLUSHDB

# Monitor Redis
docker compose exec redis redis-cli -a your_redis_password MONITOR
```

## Production Deployment

### 1. Update Environment

```bash
# Set production environment
export NODE_ENV=production
export BUILD_TARGET=production

# Update .env
NODE_ENV=production
BUILD_TARGET=production
DATABASE_SYNCHRONIZE=false
DATABASE_LOGGING=false
```

### 2. Build Production Images

```bash
# Build all services for production
docker compose build --no-cache

# Or build with specific target
docker compose build --build-arg BUILD_TARGET=production
```

### 3. Start with Nginx

```bash
# Start with nginx reverse proxy
docker compose --profile production up -d

# Verify nginx is running
docker compose ps nginx
```

### 4. SSL Configuration

Place your SSL certificates in `./nginx/ssl/`:

```
nginx/ssl/
  ├── cert.pem
  └── key.pem
```

Update `nginx/nginx.conf` to enable HTTPS.

## Troubleshooting

### Services Won't Start

```bash
# Check service status
docker compose ps

# View logs for all services
docker compose logs

# View logs for specific service
docker compose logs backend

# Restart services
docker compose restart
```

### Database Connection Issues

```bash
# Check PostgreSQL is healthy
docker compose ps postgres

# Test connection
docker compose exec postgres pg_isready -U postgres

# Check backend can connect
docker compose logs backend | grep -i database
```

### Port Conflicts

If ports are already in use, update `.env`:

```bash
POSTGRES_PORT=5433
BACKEND_PORT=3001
FRONTEND_PORT=5174
REDIS_PORT=6380
```

### Out of Memory

```bash
# Check Docker resource usage
docker stats

# Increase Docker memory limit in Docker Desktop
# Settings > Resources > Memory > 8GB recommended
```

### Reset Everything

```bash
# Stop and remove all containers, networks, volumes
docker compose down -v

# Remove all images
docker compose down --rmi all

# Clean up build cache
docker builder prune -a

# Start fresh
docker compose up -d --build
```

## Health Checks

All services have health checks configured:

```bash
# View health status
docker compose ps

# Wait for healthy status
docker compose up -d
docker compose ps --filter "health=healthy"
```

Health check endpoints:
- **Backend**: `GET http://localhost:3000/health`
- **PostgreSQL**: `pg_isready` command
- **Redis**: `redis-cli ping`
- **Routing Service**: `GET http://localhost:8080/health`

## Backup and Restore

### Database Backup

```bash
# Create backup
docker compose exec postgres pg_dump -U postgres routing_dispatch > backup.sql

# Restore backup
docker compose exec -T postgres psql -U postgres routing_dispatch < backup.sql
```

### Volume Backup

```bash
# Backup PostgreSQL data
docker run --rm \
  -v routing-dispatch_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz /data

# Restore PostgreSQL data
docker run --rm \
  -v routing-dispatch_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_backup.tar.gz -C /
```

## Scaling

### Scale Backend Instances

```bash
# Run multiple backend instances
docker compose up -d --scale backend=3

# Add nginx load balancer configuration
# Update nginx/nginx.conf with upstream backends
```

### Resource Limits

Add to `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Monitoring

### View Resource Usage

```bash
# Real-time stats
docker stats

# Service-specific stats
docker stats routing-dispatch-backend
```

### Log Management

```bash
# Follow all logs
docker compose logs -f

# Logs since last hour
docker compose logs --since 1h

# Tail last 100 lines
docker compose logs --tail 100
```

## Useful Commands

```bash
# Stop all services
docker compose stop

# Start all services
docker compose start

# Restart all services
docker compose restart

# Remove all containers (keeps volumes)
docker compose down

# Remove containers and volumes
docker compose down -v

# Rebuild without cache
docker compose build --no-cache

# Pull latest images
docker compose pull

# View service configuration
docker compose config
```

## Next Steps

- Configure routing data for OSRM
- Set up monitoring with Prometheus/Grafana
- Configure automated backups
- Set up CI/CD pipeline
- Enable HTTPS with Let's Encrypt
- Configure log aggregation

## Support

For issues or questions:
- GitHub: https://github.com/your-org/routing-dispatch-saas/issues
- Email: support@routingdispatch.com
- Docs: https://docs.routingdispatch.com
