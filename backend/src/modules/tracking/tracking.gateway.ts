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
import { TrackingService, VehicleLocation } from './tracking.service';

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

  constructor(private readonly trackingService: TrackingService) {}

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
}
