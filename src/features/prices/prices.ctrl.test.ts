import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createPriceHandler,
  getPricesHandler,
  getPriceByIdHandler,
  updatePriceHandler,
  deletePriceHandler,
  reorderPricesHandler,
} from './prices.ctrl.ts';

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

describe('Prices Controller', () => {
  describe('createPriceHandler', () => {
    test('devrait retourner une erreur 400 si les données sont invalides', async () => {
      const req = createMockRequest({ amount: -10, audience_type: 'public', translations: [] });
      const reply = createMockReply();
      const app = createMockApp();

      await createPriceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error.includes('montant') || response.error.includes('positif'));
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({ amount: 10, audience_type: 'public', translations: [{ lang: 'fr', field_name: 'name', translation: 'Test' }] });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await createPriceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la création/mise à jour du tarif');
    });
  });

  describe('getPriceByIdHandler', () => {
    test('devrait retourner une erreur 404 si le tarif n\'existe pas', async () => {
      const req = createMockRequest({}, { id: 'invalid-id' });
      const reply = createMockReply();
      const app = createMockApp();

      let queryCallCount = 0;
      (app.pg as any).query = (sql: string) => {
        queryCallCount++;
        if (sql.includes('SELECT * FROM prices WHERE id')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT field_name, lang, translation')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      };

      await getPriceByIdHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 404);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Tarif non trouvé');
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({}, { id: 'test-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await getPriceByIdHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la récupération du tarif');
    });
  });

  describe('updatePriceHandler', () => {
    test('devrait retourner une erreur 404 si le tarif n\'existe pas', async () => {
      const req = createMockRequest({ amount: 15 }, { id: 'invalid-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = (sql: string) => {
        if (sql.includes('SELECT * FROM prices WHERE id')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      };

      await updatePriceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 404);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Tarif non trouvé');
    });

    test('devrait retourner une erreur 400 si les données sont invalides', async () => {
      const req = createMockRequest({ amount: -10 }, { id: 'test-id' });
      const reply = createMockReply();
      const app = createMockApp();

      let queryCallCount = 0;
      (app.pg as any).query = (sql: string) => {
        queryCallCount++;
        if (sql.includes('SELECT * FROM prices WHERE id') && queryCallCount === 1) {
          return Promise.resolve({
            rows: [{
              id: 'test-id',
              amount: 10,
              audience_type: 'public',
              start_date: null,
              end_date: null,
              is_active: true,
              requires_proof: false,
              position: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]
          });
        }
        if (sql.includes('SELECT field_name, lang, translation')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      };

      await updatePriceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error.includes('montant') || response.error.includes('positif'));
    });
  });

  describe('deletePriceHandler', () => {
    test('devrait retourner une erreur 404 si le tarif n\'existe pas', async () => {
      const req = createMockRequest({}, { id: 'invalid-id' });
      const reply = createMockReply();
      const app = createMockApp();

      let queryCallCount = 0;
      (app.pg as any).query = (sql: string) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        if (queryCallCount === 2) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      await deletePriceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 404);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Tarif non trouvé');
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({}, { id: 'test-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await deletePriceHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la suppression du tarif');
    });
  });

  describe('reorderPricesHandler', () => {
    test('devrait retourner une erreur 400 si le tableau est vide', async () => {
      const req = createMockRequest({ price_ids: [] });
      const reply = createMockReply();
      const app = createMockApp();

      await reorderPricesHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error.includes('vide') || response.error.includes('price_ids'));
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({ price_ids: ['id1', 'id2'] });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await reorderPricesHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors du réordonnancement des tarifs');
    });
  });
});

