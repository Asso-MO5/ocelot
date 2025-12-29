import { strict as assert } from 'node:assert';
import { test, describe, beforeEach } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { saveUserIfNotExists } from './auth.service.ts';

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

function createMockApp(withDatabase: boolean = false): FastifyInstance {
  const app: any = {
    log: {
      error: createMockFn(),
      info: createMockFn(),
      warn: createMockFn(),
      debug: createMockFn(),
    },
  };

  if (withDatabase) {
    app.pg = {
      query: createMockFn(Promise.resolve({ rows: [] })),
    };
  }

  return app as unknown as FastifyInstance;
}

describe('Auth Service', () => {
  describe('saveUserIfNotExists', () => {
    test('devrait retourner sans erreur si la base de données n\'est pas disponible', async () => {
      const app = createMockApp(false);

      await saveUserIfNotExists(app, '123456789', 'testuser');

      assert.equal((app.log.debug as MockWithTracking).mock.callCount(), 1);
      assert.equal((app.pg?.query as MockWithTracking)?.mock.callCount(), undefined);
    });

    test('devrait insérer un nouvel utilisateur', async () => {
      const app = createMockApp(true);

      await saveUserIfNotExists(app, '123456789', 'testuser');

      // saveUserIfNotExists fait 2 requêtes : INSERT/UPDATE puis SELECT
      assert.equal((app.pg.query as MockWithTracking).mock.callCount(), 2);
      const insertQueryCall = (app.pg.query as MockWithTracking).mock.calls[0];
      assert.ok(insertQueryCall[0].includes('INSERT INTO users'));
      assert.deepEqual(insertQueryCall[1], ['123456789', 'testuser']);
      const selectQueryCall = (app.pg.query as MockWithTracking).mock.calls[1];
      assert.ok(selectQueryCall[0].includes('SELECT * FROM users'));
      assert.deepEqual(selectQueryCall[1], ['123456789']);
    });

    test('devrait mettre à jour un utilisateur existant', async () => {
      const app = createMockApp(true);

      await saveUserIfNotExists(app, '123456789', 'testuser');
      await saveUserIfNotExists(app, '123456789', 'updateduser');

      // Chaque appel fait 2 requêtes : INSERT/UPDATE puis SELECT
      // Donc 2 appels = 4 requêtes au total
      assert.equal((app.pg.query as MockWithTracking).mock.callCount(), 4);
      const secondInsertQueryCall = (app.pg.query as MockWithTracking).mock.calls[2];
      assert.ok(secondInsertQueryCall[0].includes('ON CONFLICT'));
      assert.deepEqual(secondInsertQueryCall[1], ['123456789', 'updateduser']);
    });

    test('devrait logger une erreur si la requête échoue', async () => {
      const error = new Error('Database error');
      const app: any = {
        log: {
          error: createMockFn(),
          info: createMockFn(),
          warn: createMockFn(),
          debug: createMockFn(),
        },
        pg: {
          query: createMockFn(Promise.reject(error)),
        },
      };

      await saveUserIfNotExists(app, '123456789', 'testuser');

      // La fonction fait 2 requêtes : la première (INSERT) échoue et est loggée,
      // la deuxième (SELECT) échoue aussi et est loggée
      assert.equal((app.pg.query as MockWithTracking).mock.callCount(), 2);
      assert.equal((app.log.error as MockWithTracking).mock.callCount(), 2);
      const firstErrorCall = (app.log.error as MockWithTracking).mock.calls[0];
      assert.equal(firstErrorCall[0].err, error);
      assert.equal(firstErrorCall[0].discordId, '123456789');
      assert.equal(firstErrorCall[0].name, 'testuser');
    });
  });
});

