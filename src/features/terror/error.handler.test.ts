import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { registerErrorHandlers, registerProcessErrorHandlers } from './error.handler.ts';

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
    setErrorHandler: createMockFn(),
    addHook: createMockFn(),
  };

  return app as unknown as FastifyInstance;
}

function createMockRequest(): FastifyRequest {
  return {
    url: '/test',
    method: 'GET',
    ip: '127.0.0.1',
  } as unknown as FastifyRequest;
}

function createMockReply(): FastifyReply & {
  status: MockWithTracking;
  code: MockWithTracking;
  send: MockWithTracking;
} {
  const reply = {} as any;

  reply.status = createMockFn(reply, reply);
  reply.code = createMockFn(reply, reply);
  reply.send = createMockFn(reply, reply);

  return reply as FastifyReply & {
    status: MockWithTracking;
    code: MockWithTracking;
    send: MockWithTracking;
  };
}

describe('Error Handler', () => {
  describe('registerErrorHandlers', () => {
    test('devrait enregistrer le gestionnaire d\'erreurs', () => {
      const app = createMockApp();

      registerErrorHandlers(app);

      assert.equal(app.setErrorHandler.mock.callCount(), 1);
      assert.equal(app.addHook.mock.callCount(), 1);
    });

    test('devrait gérer les erreurs CORS avec 403', async () => {
      const app = createMockApp();
      const reply = createMockReply();

      registerErrorHandlers(app);

      const errorHandler = app.setErrorHandler.mock.calls[0][0];
      const corsError = new Error('by CORS');
      const request = createMockRequest();

      await errorHandler(corsError, request, reply);

      assert.equal(reply.status.mock.callCount(), 1);
      assert.equal(reply.status.mock.calls[0][0], 403);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Origin required in production');
    });

    test('devrait gérer les erreurs de validation avec message personnalisé', async () => {
      const app = createMockApp();
      const reply = createMockReply();

      registerErrorHandlers(app);

      const errorHandler = app.setErrorHandler.mock.calls[0][0];
      const validationError: any = new Error('Validation error');
      validationError.statusCode = 400;
      validationError.validation = [
        { message: 'must be object', instancePath: '' }
      ];
      const request = createMockRequest();

      await errorHandler(validationError, request, reply);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Le body doit être un objet JSON valide avec Content-Type: application/json');
    });

    test('devrait gérer les erreurs serveur (500+)', async () => {
      const app = createMockApp();
      const reply = createMockReply();

      (app.pg as any).query = () => Promise.resolve({ rows: [{ id: 'test-id' }] });

      registerErrorHandlers(app);

      const errorHandler = app.setErrorHandler.mock.calls[0][0];
      const serverError = new Error('Server error');
      (serverError as any).statusCode = 500;
      const request = createMockRequest();

      await errorHandler(serverError, request, reply);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      assert.equal(app.log.error.mock.callCount(), 1);
    });
  });

  describe('registerProcessErrorHandlers', () => {
    let originalUnhandledRejection: NodeJS.UnhandledRejectionListener | undefined;
    let originalUncaughtException: NodeJS.UncaughtExceptionListener | undefined;

    beforeEach(() => {
      originalUnhandledRejection = process.listeners('unhandledRejection')[0];
      originalUncaughtException = process.listeners('uncaughtException')[0];
    });

    afterEach(() => {
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      if (originalUnhandledRejection) {
        process.on('unhandledRejection', originalUnhandledRejection);
      }
      if (originalUncaughtException) {
        process.on('uncaughtException', originalUncaughtException);
      }
    });

    test('devrait enregistrer les gestionnaires de processus', () => {
      const app = createMockApp();
      const shutdown = async () => {};

      registerProcessErrorHandlers(app, shutdown);

      const unhandledRejectionListeners = process.listeners('unhandledRejection');
      const uncaughtExceptionListeners = process.listeners('uncaughtException');

      assert.ok(unhandledRejectionListeners.length > 0);
      assert.ok(uncaughtExceptionListeners.length > 0);
    });
  });
});

