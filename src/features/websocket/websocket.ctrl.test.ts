import { strict as assert } from 'node:assert';
import { test, describe, beforeEach } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { registerWebSocketRoutes } from './websocket.ctrl.ts';
import { connections } from './websocket.manager.ts';

class MockWebSocket {
  readyState: number;
  sentMessages: string[] = [];
  listeners: { [key: string]: Function[] } = {};
  OPEN = 1;
  CLOSED = 3;

  constructor(readyState: number = 1) {
    this.readyState = readyState;
  }

  send(message: string) {
    this.sentMessages.push(message);
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(...args));
    }
  }
}

function createMockApp(): FastifyInstance & { routes: any[] } {
  const routes: any[] = [];
  const app: any = {
    routes,
    get: (path: string, options: any, handler?: any) => {
      routes.push({ path, options, handler });
    },
  };

  return app as unknown as FastifyInstance & { routes: any[] };
}

function createMockRequest(): any {
  return {
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };
}

describe('WebSocket Controller', () => {
  beforeEach(() => {
    connections.clear();
  });

  describe('registerWebSocketRoutes', () => {
    test('devrait enregistrer la route WebSocket', () => {
      const app = createMockApp();

      registerWebSocketRoutes(app);

      assert.equal(app.routes.length, 1);
      assert.equal(app.routes[0].path, '/');
      assert.equal(app.routes[0].options.websocket, true);
    });

    test('devrait ajouter la connexion à la liste des connexions', () => {
      const app = createMockApp();
      const connection = new MockWebSocket();
      const request = createMockRequest();

      registerWebSocketRoutes(app);

      const registeredRoute = app.routes[0];
      if (registeredRoute && registeredRoute.handler) {
        registeredRoute.handler(connection, request);
      }

      assert.equal(connections.size, 1);
      assert.ok(connections.has(connection as any));
    });

    test('devrait envoyer un message de bienvenue', () => {
      const app = createMockApp();
      const connection = new MockWebSocket();
      const request = createMockRequest();

      registerWebSocketRoutes(app);

      const registeredRoute = app.routes[0];
      if (registeredRoute && registeredRoute.handler) {
        registeredRoute.handler(connection, request);
      }

      assert.ok(connection.sentMessages.length > 0);
      assert.ok(connection.sentMessages[0].includes('Welcome!'));
    });

    test('devrait gérer les messages reçus', () => {
      const app = createMockApp();
      const connection1 = new MockWebSocket();
      const connection2 = new MockWebSocket();
      const request = createMockRequest();

      connections.add(connection2 as any);

      registerWebSocketRoutes(app);

      const registeredRoute = app.routes[0];
      if (registeredRoute && registeredRoute.handler) {
        registeredRoute.handler(connection1, request);
        const initialMessageCount = connection2.sentMessages.length;
        connection1.emit('message', Buffer.from('Hello'));
        assert.equal(connection2.sentMessages.length, initialMessageCount + 1);
        assert.ok(connection2.sentMessages[connection2.sentMessages.length - 1].includes('User says:'));
      }
    });

    test('devrait nettoyer la connexion lors de la fermeture', () => {
      const app = createMockApp();
      const connection = new MockWebSocket();
      const request = createMockRequest();

      connections.add(connection as any);

      registerWebSocketRoutes(app);

      const registeredRoute = app.routes[0];
      if (registeredRoute && registeredRoute.handler) {
        registeredRoute.handler(connection, request);
        connection.emit('close', 1000, Buffer.from('Normal closure'));
      }

      assert.equal(connections.size, 0);
      assert.ok(!connections.has(connection as any));
    });

    test('devrait gérer les erreurs de connexion', () => {
      const app = createMockApp();
      const connection = new MockWebSocket();
      const request = createMockRequest();

      registerWebSocketRoutes(app);

      const registeredRoute = app.routes[0];
      if (registeredRoute && registeredRoute.handler) {
        registeredRoute.handler(connection, request);
        connection.emit('error', new Error('Connection error'));
      }

      assert.ok(true);
    });
  });
});

