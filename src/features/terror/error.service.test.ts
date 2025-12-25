import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { handleError } from './error.service.ts';

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

function createMockApp(): FastifyInstance & {
  log: {
    error: MockWithTracking;
    info: MockWithTracking;
    warn: MockWithTracking;
    debug: MockWithTracking;
  };
} {
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

  return app as unknown as FastifyInstance & {
    log: {
      error: MockWithTracking;
      info: MockWithTracking;
      warn: MockWithTracking;
      debug: MockWithTracking;
    };
  };
}

describe('Error Service', () => {
  describe('handleError', () => {
    test('devrait sauvegarder l\'erreur en base de données', async () => {
      const app = createMockApp();
      const error = new Error('Test error');
      const context = { url: '/test', method: 'GET', ip: '127.0.0.1', type: 'Route Error' };

      let insertCalled = false;
      (app.pg as any).query = (sql: string) => {
        if (sql.includes('INSERT INTO errors')) {
          insertCalled = true;
          return Promise.resolve({ rows: [{ id: 'test-id' }] });
        }
        if (sql.includes('SELECT COUNT(*)')) {
          return Promise.resolve({ rows: [{ count: '0' }] });
        }
        return Promise.resolve({ rows: [] });
      };

      await handleError(app, error, context);

      assert.ok(insertCalled);
    });

    test('devrait détecter les erreurs dupliquées et ne pas envoyer à Discord', async () => {
      const app = createMockApp();
      const error = new Error('Test error');
      const context = { url: '/test', method: 'GET', ip: '127.0.0.1', type: 'Route Error' };

      let updateCalled = false;
      (app.pg as any).query = (sql: string) => {
        if (sql.includes('INSERT INTO errors')) {
          return Promise.resolve({ rows: [{ id: 'test-id' }] });
        }
        if (sql.includes('SELECT COUNT(*)')) {
          return Promise.resolve({ rows: [{ count: '1' }] });
        }
        if (sql.includes('UPDATE errors SET sent_to_discord')) {
          updateCalled = true;
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      };

      const originalFetch = global.fetch;
      let fetchCalled = false;
      global.fetch = () => {
        fetchCalled = true;
        return Promise.resolve({ ok: true } as Response);
      };

      try {
        await handleError(app, error, context);

        assert.ok(!fetchCalled, 'Discord ne devrait pas être appelé pour un doublon');
        assert.equal(app.log.debug.mock.callCount(), 1);
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('devrait envoyer à Discord si le webhook est configuré', async () => {
      const app = createMockApp();
      const error = new Error('Test error');
      const context = { url: '/test', method: 'GET', ip: '127.0.0.1', type: 'Route Error' };

      process.env.DISCORD_LOG_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';

      let fetchCalled = false;
      const originalFetch = global.fetch;
      global.fetch = ((url: string | URL | Request, options?: any) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString === process.env.DISCORD_LOG_WEBHOOK_URL) {
          fetchCalled = true;
          const payload = JSON.parse(options.body);
          assert.equal(payload.username, 'Ocelot Log');
          assert.ok(payload.embeds);
          assert.equal(payload.embeds[0].title.includes('Erreur 500'), true);
        }
        return Promise.resolve({ ok: true } as Response);
      }) as typeof fetch;

      (app.pg as any).query = (sql: string) => {
        if (sql.includes('INSERT INTO errors')) {
          return Promise.resolve({ rows: [{ id: 'test-id' }] });
        }
        if (sql.includes('SELECT COUNT(*)')) {
          return Promise.resolve({ rows: [{ count: '0' }] });
        }
        if (sql.includes('UPDATE errors SET sent_to_discord')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      };

      try {
        await handleError(app, error, context);

        assert.ok(fetchCalled);
      } finally {
        global.fetch = originalFetch;
        delete process.env.DISCORD_LOG_WEBHOOK_URL;
      }
    });

    test('ne devrait pas envoyer à Discord si le webhook n\'est pas configuré', async () => {
      const app = createMockApp();
      const error = new Error('Test error');
      const context = { url: '/test', method: 'GET', ip: '127.0.0.1', type: 'Route Error' };

      delete process.env.DISCORD_LOG_WEBHOOK_URL;

      let fetchCalled = false;
      const originalFetch = global.fetch;
      global.fetch = () => {
        fetchCalled = true;
        return Promise.resolve({ ok: true } as Response);
      };

      (app.pg as any).query = (sql: string) => {
        if (sql.includes('INSERT INTO errors')) {
          return Promise.resolve({ rows: [{ id: 'test-id' }] });
        }
        if (sql.includes('SELECT COUNT(*)')) {
          return Promise.resolve({ rows: [{ count: '0' }] });
        }
        return Promise.resolve({ rows: [] });
      };

      try {
        await handleError(app, error, context);

        assert.ok(!fetchCalled);
        assert.equal(app.log.warn.mock.callCount(), 1);
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('devrait gérer les erreurs si la base de données n\'est pas disponible', async () => {
      const app = createMockApp();
      (app.pg as any) = null;
      const error = new Error('Test error');
      const context = { url: '/test', method: 'GET', ip: '127.0.0.1', type: 'Route Error' };

      delete process.env.DISCORD_LOG_WEBHOOK_URL;

      await handleError(app, error, context);

      assert.equal(app.log.debug.mock.callCount(), 1);
    });
  });
});

