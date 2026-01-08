import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackingService, VehicleLocation } from './tracking.service';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Telemetry } from './entities/telemetry.entity';

/**
 * WebSocket Gateway for real-time vehicle tracking
 */
@WebSocketGateway({
  cors: {
    origin: '*', // Configure appropriately for production
    credentials: true,
  },
  namespace: '/tracking',
})
export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);
  private connectedClients = new Set<string>();

  constructor(
    private readonly trackingService: TrackingService,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Telemetry)
    private readonly telemetryRepository: Repository<Telemetry>,
  ) {}

  /**
   * Gateway initialization
   */
  afterInit(server: Server) {
    this.logger.log('🚀 Tracking WebSocket Gateway initialized');
  }

  /**
   * Handle client connection
   */
  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.add(client.id);

    try {
      // Send current vehicle locations immediately on connect
      const locations = await this.trackingService.getLatestVehicleLocations();

      client.emit('vehicle:locations', {
        vehicles: locations,
        timestamp: new Date().toISOString(),
        count: locations.length,
      });

      this.logger.log(
        `Sent ${locations.length} vehicle locations to client ${client.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending initial locations to client ${client.id}: ${error.message}`,
      );
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  /**
   * Subscribe to vehicle location updates
   */
  @SubscribeMessage('subscribe:locations')
  handleSubscribeLocations(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} subscribed to location updates`);
    client.join('locations');
    return {
      event: 'subscribed',
      data: {
        room: 'locations',
        updateInterval: 30000, // 30 seconds
      },
    };
  }

  /**
   * Get location history for specific vehicle
   */
  @SubscribeMessage('get:vehicle-history')
  async handleGetVehicleHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { vehicleId: string; hours?: number },
  ) {
    this.logger.log(
      `Client ${client.id} requested history for vehicle ${data.vehicleId}`,
    );

    try {
      const history = await this.trackingService.getVehicleLocationHistory(
        data.vehicleId,
        data.hours || 24,
      );

      return {
        event: 'vehicle:history',
        data: {
          vehicleId: data.vehicleId,
          history,
          count: history.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error fetching vehicle history: ${error.message}`,
        error.stack,
      );
      return {
        event: 'error',
        data: {
          message: 'Failed to fetch vehicle history',
          error: error.message,
        },
      };
    }
  }

  /**
   * Broadcast vehicle locations to all connected clients every 30 seconds
   */
  @Interval(30000) // 30 seconds
  async broadcastVehicleLocations() {
    if (this.connectedClients.size === 0) {
      this.logger.debug('No connected clients, skipping location broadcast');
      return;
    }

    try {
      this.logger.debug(
        `Broadcasting vehicle locations to ${this.connectedClients.size} clients`,
      );

      const locations = await this.trackingService.getLatestVehicleLocations();

      // Broadcast to all clients in the 'locations' room
      this.server.to('locations').emit('vehicle:locations', {
        vehicles: locations,
        timestamp: new Date().toISOString(),
        count: locations.length,
      });

      // Also broadcast to all connected clients (even if not subscribed to room)
      this.server.emit('vehicle:locations', {
        vehicles: locations,
        timestamp: new Date().toISOString(),
        count: locations.length,
      });

      this.logger.debug(
        `✅ Broadcast ${locations.length} vehicle locations`,
      );
    } catch (error) {
      this.logger.error(
        `Error broadcasting vehicle locations: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manually trigger location broadcast (for testing)
   */
  async triggerLocationBroadcast() {
    this.logger.log('🔧 Manual location broadcast triggered');
    await this.broadcastVehicleLocations();
  }

  /**
   * Emit single vehicle location update
   */
  emitVehicleLocationUpdate(vehicleLocation: VehicleLocation) {
    this.server.emit('vehicle:location-update', vehicleLocation);
  }

  /**
   * Get tracking statistics
   */
  @SubscribeMessage('get:statistics')
  async handleGetStatistics(@ConnectedSocket() client: Socket) {
    try {
      const stats = await this.trackingService.getStatistics();
      return {
        event: 'tracking:statistics',
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Error fetching statistics: ${error.message}`);
      return {
        event: 'error',
        data: { message: 'Failed to fetch statistics' },
      };
    }
  }

  /**
   * Broadcast route update to all connected clients
   * Called when routes are created, updated, or dispatched
   */
  broadcastRouteUpdate(route: any, eventType: 'created' | 'updated' | 'dispatched' | 'completed') {
    this.logger.log(`Broadcasting route ${eventType}: ${route.id}`);
    this.server.emit('route:update', {
      type: eventType,
      route,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle driver GPS location updates from mobile app
   */
  @SubscribeMessage('driver:location')
  async handleDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      vehicleId: string;
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
      timestamp: string;
    },
  ) {
    try {
      this.logger.log(
        `Received location update for vehicle ${data.vehicleId} from client ${client.id}`,
      );

      // Validate data
      if (!data.vehicleId || !data.lat || !data.lng) {
        return {
          event: 'error',
          data: { message: 'Missing required fields: vehicleId, lat, lng' },
        };
      }

      // Update vehicle current location
      await this.vehicleRepository.update(data.vehicleId, {
        currentLocation: { lat: data.lat, lng: data.lng } as any,
      });

      // Store in telemetry table for history
      const telemetry = this.telemetryRepository.create({
        vehicleId: data.vehicleId,
        location: { lat: data.lat, lng: data.lng },
        speed: data.speed || null,
        heading: data.heading || null,
        timestamp: new Date(data.timestamp),
      });
      await this.telemetryRepository.save(telemetry);

      // Broadcast to all connected clients (dispatchers, other drivers)
      this.server.emit('vehicle:location-update', {
        vehicleId: data.vehicleId,
        lat: data.lat,
        lng: data.lng,
        speed: data.speed,
        heading: data.heading,
        timestamp: data.timestamp,
      });

      this.logger.log(
        `✅ Location updated for vehicle ${data.vehicleId} and broadcast to clients`,
      );

      return {
        event: 'location:acknowledged',
        data: {
          vehicleId: data.vehicleId,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error handling driver location: ${error.message}`,
        error.stack,
      );
      return {
        event: 'error',
        data: { message: 'Failed to update location' },
      };
    }
  }
}
