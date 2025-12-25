import { strict as assert } from 'node:assert';
import { test, describe, beforeEach } from 'node:test';
import { connections, broadcast, sendToRoom } from './websocket.manager.ts';

class MockWebSocket {
  readyState: number;
  sentMessages: string[] = [];
  OPEN = 1;
  CLOSED = 3;

  constructor(readyState: number = 1) {
    this.readyState = readyState;
  }

  send(message: string) {
    this.sentMessages.push(message);
  }
}

describe('WebSocket Manager', () => {
  beforeEach(() => {
    connections.clear();
  });

  describe('broadcast', () => {
    test('devrait envoyer un message à toutes les connexions ouvertes sauf l\'expéditeur', () => {
      const ws1 = new MockWebSocket(1);
      const ws2 = new MockWebSocket(1);
      const ws3 = new MockWebSocket(1);

      connections.add(ws1 as any);
      connections.add(ws2 as any);
      connections.add(ws3 as any);

      broadcast('Test message', ws1 as any);

      assert.equal(ws1.sentMessages.length, 0);
      assert.equal(ws2.sentMessages.length, 1);
      assert.equal(ws3.sentMessages.length, 1);
      assert.equal(ws2.sentMessages[0], 'Test message');
      assert.equal(ws3.sentMessages[0], 'Test message');
    });

    test('ne devrait pas envoyer à des connexions fermées', () => {
      const ws1 = new MockWebSocket(1);
      const ws2 = new MockWebSocket(3);

      connections.add(ws1 as any);
      connections.add(ws2 as any);

      broadcast('Test message');

      assert.equal(ws1.sentMessages.length, 1);
      assert.equal(ws2.sentMessages.length, 0);
    });

    test('devrait supprimer les connexions en erreur', () => {
      const ws1 = new MockWebSocket(1);
      const ws2 = new MockWebSocket(1);

      connections.add(ws1 as any);
      connections.add(ws2 as any);

      ws2.send = () => {
        throw new Error('Send error');
      };

      broadcast('Test message');

      assert.equal(connections.size, 1);
      assert.ok(connections.has(ws1 as any));
      assert.ok(!connections.has(ws2 as any));
    });
  });

  describe('sendToRoom', () => {
    test('devrait envoyer un message JSON à toutes les connexions ouvertes', () => {
      const ws1 = new MockWebSocket(1);
      const ws2 = new MockWebSocket(1);

      connections.add(ws1 as any);
      connections.add(ws2 as any);

      sendToRoom('test-room', 'refresh');

      assert.equal(ws1.sentMessages.length, 1);
      assert.equal(ws2.sentMessages.length, 1);

      const message1 = JSON.parse(ws1.sentMessages[0]);
      const message2 = JSON.parse(ws2.sentMessages[0]);

      assert.equal(message1.room, 'test-room');
      assert.equal(message1.action, 'refresh');
      assert.equal(message2.room, 'test-room');
      assert.equal(message2.action, 'refresh');
    });

    test('devrait supprimer les connexions fermées', () => {
      const ws1 = new MockWebSocket(1);
      const ws2 = new MockWebSocket(3);

      connections.add(ws1 as any);
      connections.add(ws2 as any);

      sendToRoom('test-room', 'refresh');

      assert.equal(connections.size, 1);
      assert.ok(connections.has(ws1 as any));
      assert.ok(!connections.has(ws2 as any));
    });

    test('devrait supprimer les connexions en erreur', () => {
      const ws1 = new MockWebSocket(1);
      const ws2 = new MockWebSocket(1);

      connections.add(ws1 as any);
      connections.add(ws2 as any);

      ws2.send = () => {
        throw new Error('Send error');
      };

      sendToRoom('test-room', 'refresh');

      assert.equal(connections.size, 1);
      assert.ok(connections.has(ws1 as any));
      assert.ok(!connections.has(ws2 as any));
    });
  });
});

