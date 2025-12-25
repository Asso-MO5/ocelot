import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  upsertPresenceHandler,
  getPresencesHandler,
  refusePresenceHandler,
  deletePresenceHandler,
} from './member-presences.ctrl.ts';

interface MockWithTracking {
  (...args: any[]): any;
  mock: {
    calls: any[][];
    callCount(): number;
  };
}

function createMockFn(returnValue?: any, chainTarget?: any): MockWithTracking {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
    return returnValue ?? chainTarget ?? fn;
  }) as MockWithTracking;
  fn.mock = {
    calls,
    callCount: () => calls.length,
  };
  return fn;
}

function createMockApp(): FastifyInstance {
  const app: any = {
    log: {
      error: createMockFn(),
      info: createMockFn(),
      warn: createMockFn(),
      debug: createMockFn(),
    },
    pg: {
      query: createMockFn(),
    },
  };

  return app as unknown as FastifyInstance;
}

function createMockRequest(body: any = {}, query: any = {}, params: any = {}, user: any = null): FastifyRequest {
  return {
    body,
    query,
    params,
    user,
  } as unknown as FastifyRequest;
}

function createMockReply(): FastifyReply & {
  code: MockWithTracking;
  send: MockWithTracking;
} {
  const reply = {} as any;

  reply.code = createMockFn(reply, reply);
  reply.send = createMockFn(reply, reply);

  return reply as FastifyReply & {
    code: MockWithTracking;
    send: MockWithTracking;
  };
}

describe('Member Presences Controller', () => {
  describe('upsertPresenceHandler', () => {
    test('devrait retourner une erreur 401 si non authentifié', async () => {
      const req = createMockRequest({ date: '2024-01-01', period: 'morning' });
      const reply = createMockReply();
      const app = createMockApp();

      await upsertPresenceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 401);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Non authentifié');
    });

    test('devrait retourner une erreur 400 si la création échoue', async () => {
      const req = createMockRequest(
        { date: '2024-01-01', period: 'morning' },
        {},
        {},
        { id: 'discord-id-123' }
      );
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await upsertPresenceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error);
    });
  });

  describe('getPresencesHandler', () => {
    test('devrait retourner une erreur 401 si non authentifié', async () => {
      const req = createMockRequest({}, { start_date: '2024-01-01' });
      const reply = createMockReply();
      const app = createMockApp();

      await getPresencesHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 401);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Non authentifié');
    });

    test('devrait retourner une erreur 500 si la récupération échoue', async () => {
      const req = createMockRequest(
        {},
        { start_date: '2024-01-01' },
        {},
        { id: 'discord-id-123', roles: [] }
      );
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await getPresencesHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error);
    });
  });

  describe('refusePresenceHandler', () => {
    test('devrait retourner une erreur 401 si non authentifié', async () => {
      const req = createMockRequest({ refused: true }, {}, { id: 'presence-id' });
      const reply = createMockReply();
      const app = createMockApp();

      await refusePresenceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 401);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Non authentifié');
    });

    test('devrait retourner une erreur 400 si la présence n\'existe pas', async () => {
      const req = createMockRequest(
        { refused: true },
        {},
        { id: 'invalid-id' },
        { id: 'discord-id-123' }
      );
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.resolve({ rows: [] });

      await refusePresenceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error);
    });
  });

  describe('deletePresenceHandler', () => {
    test('devrait retourner une erreur 401 si non authentifié', async () => {
      const req = createMockRequest({}, {}, { id: 'presence-id' });
      const reply = createMockReply();
      const app = createMockApp();

      await deletePresenceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 401);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Non authentifié');
    });

    test('devrait retourner une erreur 404 si la présence n\'existe pas', async () => {
      const req = createMockRequest({}, {}, { id: 'invalid-id' }, { id: 'discord-id-123', roles: [] });
      const reply = createMockReply();
      const app = createMockApp();

      let queryCallCount = 0;
      (app.pg as any).query = (sql: string) => {
        queryCallCount++;
        if (sql.includes('SELECT id FROM users')) {
          return Promise.resolve({ rows: [{ id: 'user-id-123' }] });
        }
        if (sql.includes('SELECT user_id FROM member_presences')) {
          return Promise.resolve({ rows: [{ user_id: 'user-id-123' }] });
        }
        if (sql.includes('DELETE FROM member_presences')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      await deletePresenceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 404);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Présence non trouvée');
    });
  });
});

