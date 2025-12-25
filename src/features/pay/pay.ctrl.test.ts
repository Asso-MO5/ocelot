import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  getCheckoutStatusHandler,
  webhookHandlerWithRawBody,
} from './pay.ctrl.ts';

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
    ws: null,
  };

  return app as unknown as FastifyInstance;
}

function createMockRequest(params: any = {}, headers: any = {}): FastifyRequest {
  return {
    params,
    headers,
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

describe('Pay Controller', () => {
  describe('getCheckoutStatusHandler', () => {
    test('devrait retourner une erreur 400 si sessionId est manquant', async () => {
      const req = createMockRequest({});
      const reply = createMockReply();
      const app = createMockApp();

      await getCheckoutStatusHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'sessionId est requis');
    });

    test('devrait retourner une erreur 404 si la session n\'existe pas', async () => {
      const req = createMockRequest({ sessionId: 'invalid-session-id' });
      const reply = createMockReply();
      const app = createMockApp();

      delete process.env.STRIPE_SECRET_KEY;

      await getCheckoutStatusHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la vérification du statut');
    });
  });

  describe('webhookHandlerWithRawBody', () => {
    test('devrait retourner une erreur 400 si la signature est manquante', async () => {
      const req = createMockRequest({}, {});
      const reply = createMockReply();
      const app = createMockApp();
      const rawBody = Buffer.from('{}');
      const body = { id: 'evt_123', type: 'checkout.session.completed', created: 1234567890, data: { object: { id: 'session_123', object: 'checkout.session' } } };

      await webhookHandlerWithRawBody(req as any, reply, app, rawBody, body);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Signature manquante');
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({}, { 'stripe-signature': 'test-signature' });
      const reply = createMockReply();
      const app: any = createMockApp();
      app.pg = {
        query: () => Promise.reject(new Error('Database connection error'))
      };
      const rawBody = Buffer.from('{}');
      const body = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        created: 1234567890,
        data: {
          object: {
            id: 'session_123',
            object: 'checkout.session',
            payment_status: 'paid',
            status: 'complete'
          }
        }
      };

      process.env.NODE_ENV = 'development';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

      await webhookHandlerWithRawBody(req as any, reply, app, rawBody, body);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors du traitement du webhook');
    });
  });
});

