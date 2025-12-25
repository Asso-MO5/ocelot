import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  upsertSettingHandler,
  getSettingsHandler,
  getSettingByKeyHandler,
  deleteSettingHandler,
  getMaxCapacityHandler,
  setMaxCapacityHandler,
} from './settings.ctrl.ts';

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
      query: createMockFn(() => Promise.resolve({ rows: [], rowCount: 0 })),
    },
    ws: {
      send: createMockFn(),
    },
  };

  return app as unknown as FastifyInstance;
}

function createMockRequest(body: any = {}, params: any = {}, query: any = {}, user: any = null): FastifyRequest {
  return {
    body,
    params,
    query,
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

describe('Settings Controller', () => {
  describe('upsertSettingHandler', () => {
    test('devrait retourner une erreur 400 si la valeur ne peut pas être convertie', async () => {
      const req = createMockRequest({
        key: 'test_key',
        value: { invalid: 'json' },
        value_type: 'number'
      });
      const reply = createMockReply();
      const app = createMockApp();

      let queryCallCount = 0;
      (app.pg as any).query = (sql: string) => {
        queryCallCount++;
        if (sql.includes('SELECT * FROM museum_settings WHERE key')) {
          return Promise.resolve({ rows: [] });
        }
        if (queryCallCount === 2) {
          return Promise.reject(new Error('La valeur "{\\"invalid\\":\\"json\\"}" ne peut pas être convertie en nombre'));
        }
        return Promise.resolve({ rows: [{ id: '1', key: 'test_key', value: '{}', value_type: 'number', description: null, created_at: '2024-01-01', updated_at: '2024-01-01' }] });
      };

      await upsertSettingHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error.includes('convertie') || response.error.includes('nombre'));
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({
        key: 'test_key',
        value: 'test_value'
      });
      const reply = createMockReply();
      const app = createMockApp();

      let queryCallCount = 0;
      (app.pg as any).query = (sql: string) => {
        queryCallCount++;
        if (sql.includes('SELECT * FROM museum_settings WHERE key')) {
          return Promise.resolve({ rows: [] });
        }
        if (queryCallCount === 2) {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve({ rows: [] });
      };

      await upsertSettingHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la création/mise à jour du paramètre');
    });
  });

  describe('getSettingByKeyHandler', () => {
    test('devrait retourner une erreur 404 si le paramètre n\'existe pas', async () => {
      const req = createMockRequest({}, { key: 'invalid-key' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.resolve({ rows: [] });

      await getSettingByKeyHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 404);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Paramètre non trouvé');
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({}, { key: 'test-key' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await getSettingByKeyHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la récupération du paramètre');
    });
  });

  describe('deleteSettingHandler', () => {
    test('devrait retourner une erreur 404 si le paramètre n\'existe pas', async () => {
      const req = createMockRequest({}, { key: 'invalid-key' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.resolve({ rows: [], rowCount: 0 });

      await deleteSettingHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 404);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Paramètre non trouvé');
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({}, { key: 'test-key' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await deleteSettingHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la suppression du paramètre');
    });
  });

  describe('setMaxCapacityHandler', () => {
    test('devrait retourner une erreur 400 si la capacité est négative', async () => {
      const req = createMockRequest({ max_capacity: -10 });
      const reply = createMockReply();
      const app = createMockApp();

      await setMaxCapacityHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error.includes('positive') || response.error.includes('nulle'));
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({ max_capacity: 90 });
      const reply = createMockReply();
      const app = createMockApp();

      let queryCallCount = 0;
      (app.pg as any).query = (sql: string) => {
        queryCallCount++;
        if (sql.includes('SELECT * FROM museum_settings WHERE key')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO museum_settings')) {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve({ rows: [] });
      };

      await setMaxCapacityHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la définition de la capacité maximale');
    });
  });
});

