import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createGiftCodePackHandler,
  validateGiftCodeHandler,
  purchaseGiftCodesHandler,
  confirmPurchaseGiftCodesHandler,
} from './gift-codes.ctrl.ts';

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

function createMockRequest(body: any = {}, query: any = {}, params: any = {}): FastifyRequest {
  return {
    body,
    query,
    params,
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

describe('Gift Codes Controller', () => {
  describe('createGiftCodePackHandler', () => {
    test('devrait retourner une erreur 500 si la création échoue', async () => {
      const req = createMockRequest({ quantity: 10 });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await createGiftCodePackHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error);
    });
  });

  describe('validateGiftCodeHandler', () => {
    test('devrait retourner une erreur 400 si le code n\'existe pas', async () => {
      const req = createMockRequest({}, {}, { code: 'ABC123DEF456' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.resolve({ rows: [] });

      await validateGiftCodeHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
    });

    test('devrait retourner une erreur 400 si le code est déjà utilisé', async () => {
      const req = createMockRequest({}, {}, { code: 'USEDCODE123' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.resolve({
        rows: [{
          id: 'test-id',
          code: 'USEDCODE123',
          status: 'used',
          ticket_id: 'ticket-id',
          pack_id: 'pack-id',
          recipient_email: null,
          expires_at: null,
          used_at: new Date().toISOString(),
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]
      });

      await validateGiftCodeHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
    });
  });

  describe('purchaseGiftCodesHandler', () => {
    test('devrait retourner une erreur 400 si l\'achat échoue', async () => {
      const req = createMockRequest({
        quantity: 5,
        email: 'test@example.com',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.resolve({ rows: [{ value: null }] });

      await purchaseGiftCodesHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error);
    });
  });

  describe('confirmPurchaseGiftCodesHandler', () => {
    test('devrait retourner une erreur 500 si getCheckoutStatus échoue', async () => {
      const req = createMockRequest({ checkout_id: 'test-checkout-id' });
      const reply = createMockReply();
      const app = createMockApp();

      process.env.STRIPE_SECRET_KEY = 'sk_test_fake';

      await confirmPurchaseGiftCodesHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
    });
  });
});
