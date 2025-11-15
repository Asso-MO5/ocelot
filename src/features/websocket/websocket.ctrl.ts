import type { FastifyInstance } from 'fastify';
import { connections, broadcast } from './websocket.manager.ts';
import type { WebSocket } from '@fastify/websocket';

export function registerWebSocketRoutes(app: FastifyInstance) {
  app.get('/', { websocket: true }, (connection, request) => {
    const clientIP = request.socket.remoteAddress;
    console.log(`Client connected from ${clientIP}`);
    connections.add(connection as WebSocket);
    console.log(`Total connections: ${connections.size}`);

    connection.send(`Welcome! ${connections.size} clients connected.`);

    broadcast(`New user joined. ${connections.size} total users.`, connection as any);

    connection.on('message', message => {
      try {
        const text = message.toString();
        console.log(`Received from ${clientIP}:`, text);

        // Broadcast message to all other clients
        broadcast(`User says: ${text}`, connection as any);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    connection.on('error', (error) => {
      console.error(`WebSocket error for ${clientIP}:`, error);
    });

    connection.on('close', (code, reason) => {
      connections.delete(connection);
      console.log(`Client ${clientIP} disconnected - Code: ${code}`);
      console.log(`Remaining connections: ${connections.size}`);

      // Notify remaining clients
      broadcast(`User left. ${connections.size} total users.`);
    });
  });
}
