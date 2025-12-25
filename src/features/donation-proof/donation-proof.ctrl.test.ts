import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { generateDonationProofHandler, generateDonationProofDebugHandler } from './donation-proof.ctrl.ts';

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
  };

  return app as unknown as FastifyInstance;
}

function createMockRequest(query: Record<string, string> = {}): FastifyRequest<{ Querystring: any }> {
  return {
    query,
  } as unknown as FastifyRequest<{ Querystring: any }>;
}

function createMockReply(): FastifyReply & {
  code: MockWithTracking;
  send: MockWithTracking;
  type: MockWithTracking;
  header: MockWithTracking;
} {
  const reply = {} as any;

  reply.code = createMockFn(reply, reply);
  reply.send = createMockFn(reply, reply);
  reply.type = createMockFn(reply, reply);
  reply.header = createMockFn(reply, reply);

  return reply as FastifyReply & {
    code: MockWithTracking;
    send: MockWithTracking;
    type: MockWithTracking;
    header: MockWithTracking;
  };
}

describe('Donation Proof Controller', () => {
  describe('generateDonationProofHandler', () => {
    test('devrait retourner une erreur 400 si ticket_id est manquant', async () => {
      const req = createMockRequest({});
      const reply = createMockReply();
      const app = createMockApp();

      await generateDonationProofHandler(req, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      assert.equal(reply.send.mock.callCount(), 1);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'ticket_id est requis');
    });
  });
});
